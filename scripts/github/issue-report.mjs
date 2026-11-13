import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const repository = "Ninefarer/Reprise";
const workflow = "codex-issue-comment.yml";
export function validateIssue(issue) {
  if (!/^[1-9]\d*$/.test(String(issue)) || !Number.isSafeInteger(Number(issue)))
    throw Error("Issue number must be a positive safe integer.");
  return String(issue);
}
export function validateBody(body) {
  if (
    typeof body !== "string" ||
    !body.trim() ||
    Buffer.byteLength(body, "utf8") > 50000
  )
    throw Error(
      "Comment body must contain text and fit within 50000 UTF-8 bytes.",
    );
  return body;
}
export function formatReport(report) {
  if (
    !report ||
    typeof report.batch !== "string" ||
    !report.batch.trim() ||
    !["Completed", "In Progress", "Blocked"].includes(report.status)
  )
    throw Error(
      "Report requires batch text and status Completed, In Progress or Blocked.",
    );
  for (const field of ["changes", "verification"])
    if (
      !Array.isArray(report[field]) ||
      !report[field].length ||
      report[field].some((item) => typeof item !== "string" || !item.trim())
    )
      throw Error(`Report ${field} must contain nonempty text entries.`);
  return validateBody(
    `**Codex — Development Report**\n\n**Batch:** ${report.batch}\n\n**Changes:**\n${report.changes.map((item) => `- ${item}`).join("\n")}\n\n**Verification:**\n${report.verification.map((item) => `- ${item}`).join("\n")}\n\n**Status:** ${report.status}\n\n— Codex\n`,
  );
}
export function dispatchPayload(issue, body, ref) {
  if (typeof ref !== "string" || !ref.trim())
    throw Error("Default branch is unavailable.");
  return {
    ref,
    inputs: {
      issue_number: validateIssue(issue),
      comment_body: validateBody(body),
    },
  };
}
function gh(args, input) {
  const result = spawnSync(
    "gh",
    [args[0], "--hostname", "github.com", ...args.slice(1)],
    {
      input,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 60000,
      env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_DEBUG: "" },
    },
  );
  if (result.error?.code === "ENOENT")
    throw Error(
      "GitHub CLI is unavailable; install/authenticate gh before dispatching.",
    );
  if (result.status !== 0) {
    // Avoid echoing response bodies, credentials or supplied comment text.
    const http = result.stderr?.match(/HTTP (\d{3})/)?.[1];
    throw Error(
      `GitHub CLI request failed${http ? ` (HTTP ${http})` : ""}. Check authentication, repository access and Actions: write permission. No direct-comment fallback is used.`,
    );
  }
  return result.stdout;
}
export function main(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (["--dispatch", "--check"].includes(key)) options[key] = true;
    else if (
      ["--issue", "--body-file", "--report"].includes(key) &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      options[key] = args[++index];
    else throw Error(`Unsupported or incomplete argument: ${key}`);
  }
  if (options["--body-file"] && options["--report"])
    throw Error("Choose --body-file or --report.");
  if (options["--dispatch"] && options["--check"])
    throw Error("Choose --check or --dispatch.");
  const issue = validateIssue(options["--issue"] ?? "2");
  let body;
  if (options["--body-file"])
    body = validateBody(
      readFileSync(options["--body-file"], "utf8").replace(/^\uFEFF/, ""),
    );
  if (options["--report"])
    body = formatReport(
      JSON.parse(
        readFileSync(options["--report"], "utf8").replace(/^\uFEFF/, ""),
      ),
    );
  if (!options["--dispatch"] && !options["--check"]) {
    if (!body)
      throw Error(
        "Provide --report JSON or --body-file Markdown. Add --check for read-only readiness or --dispatch to submit.",
      );
    process.stdout.write(body);
    return;
  }
  const repo = JSON.parse(gh(["api", `repos/${repository}`]));
  const ref = repo.default_branch;
  // Check the actual default-branch file, not merely a workflow registered elsewhere.
  try {
    gh([
      "api",
      `repos/${repository}/contents/.github/workflows/${workflow}?ref=${encodeURIComponent(ref)}`,
    ]);
  } catch {
    throw Error(
      `Reporting workflow is missing or inaccessible on default branch ${ref}. Land the automation-only workflow there with owner approval before dispatching.`,
    );
  }
  const registered = JSON.parse(
    gh(["api", `repos/${repository}/actions/workflows/${workflow}`]),
  );
  if (registered.state !== "active")
    throw Error("Reporting workflow is not active.");
  if (options["--check"]) {
    console.log(
      `Workflow registered on ${repository}:${ref}. Read access verified; dispatch, App token creation and bot identity still require a successful run.`,
    );
    return;
  }
  const payload = dispatchPayload(issue, body, ref);
  gh(
    [
      "api",
      "--method",
      "POST",
      `repos/${repository}/actions/workflows/${workflow}/dispatches`,
      "--input",
      "-",
    ],
    JSON.stringify(payload),
  );
  console.log(
    `Dispatched ${workflow} on ${repository}:${ref}. Submission is not comment verification. Inspect https://github.com/${repository}/actions/workflows/${workflow} and confirm the resulting bot-authored comment before reporting success. Do not automatically retry uncertain submissions.`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
