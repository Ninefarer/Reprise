import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  formatReport,
  dispatchPayload,
  validateIssue,
  validateBody,
} from "./issue-report.mjs";

const workflow = readFileSync(
  new URL("../../.github/workflows/codex-issue-comment.yml", import.meta.url),
  "utf8",
);
const scripts = [
  ...workflow.matchAll(/node <<'NODE'\n([\s\S]*?)          NODE/g),
].map((match) => match[1].replace(/^          /gm, ""));
function sandbox(
  env = {},
  fetch = async () => {
    throw Error("Unexpected API call");
  },
) {
  const logs = [],
    summaries = [];
  return {
    process: {
      env,
      exitCode: 0,
      exit: (code) => {
        throw Error(`exit ${code}`);
      },
    },
    console: {
      log: (text) => logs.push(text),
      error: (text) => logs.push(text),
    },
    Buffer,
    AbortSignal,
    fetch,
    require: (name) => {
      assert.equal(name, "node:fs");
      return { appendFileSync: (path, body) => summaries.push({ path, body }) };
    },
    logs,
    summaries,
  };
}
test("input and formatter validation preserve report text without evaluation", () => {
  for (const issue of [
    "0",
    "-2",
    "2/path",
    "2;echo",
    "1e3",
    "9007199254740992",
    undefined,
  ])
    assert.throws(() => validateIssue(issue));
  assert.equal(validateIssue("2"), "2");
  for (const body of ["", "   ", "😀".repeat(12501)])
    assert.throws(() => validateBody(body));
  const report = formatReport({
    batch: "Integration test",
    changes: ["`$(whoami)` stays literal."],
    verification: ["Live bot verification pending."],
    status: "In Progress",
  });
  assert.match(report, /^\*\*Codex — Development Report\*\*/);
  assert.match(report, /— Codex\n$/);
  assert.equal(dispatchPayload(2, report, "main").inputs.comment_body, report);
  assert.throws(() =>
    formatReport({
      batch: "Bad",
      changes: [],
      verification: ["x"],
      status: "Done",
    }),
  );
});
test("workflow has restricted permissions, repository and default branch guards", () => {
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(workflow, /github.repository == 'Ninefarer\/Reprise'/);
  assert.match(
    workflow,
    /github.ref == format\('refs\/heads\/\{0\}', github.event.repository.default_branch\)/,
  );
  assert.match(workflow, /uses: actions\/create-github-app-token@v2/);
  assert.match(
    workflow,
    /owner: Ninefarer\n\s+repositories: Reprise\n\s+permission-issues: write/,
  );
  assert.doesNotMatch(
    workflow,
    /uses: actions\/checkout|skip-token-revoke: true|permission-(contents|actions|pull-requests):/,
  );
  assert.equal(scripts.length, 2);
  for (const script of scripts) {
    assert.doesNotMatch(script, /\$\{\{/);
    new vm.Script(script);
  }
});
test("workflow preflight rejects invalid input before token creation", () => {
  assert.throws(
    () =>
      vm.runInNewContext(
        scripts[0],
        sandbox({ ISSUE_NUMBER: "2/../../../", COMMENT_BODY: "x" }),
      ),
    /exit 1/,
  );
  assert.throws(
    () =>
      vm.runInNewContext(
        scripts[0],
        sandbox({ ISSUE_NUMBER: "2", COMMENT_BODY: " " }),
      ),
    /exit 1/,
  );
  vm.runInNewContext(
    scripts[0],
    sandbox({
      ISSUE_NUMBER: "2",
      COMMENT_BODY: "${{ secrets.X }}\n$(whoami)\n'\"`",
    }),
  );
});
test("workflow posts literal JSON only to the fixed repository and verifies bot identity", async () => {
  const requests = [],
    body = "INTEGRATION TEST\n$(whoami)\n${{ secrets.X }}\n'\"`";
  const context = sandbox(
    {
      APP_TOKEN: "test-only-placeholder",
      APP_SLUG: "reprise-helper",
      ISSUE_NUMBER: "2",
      COMMENT_BODY: body,
      GITHUB_STEP_SUMMARY: "summary",
    },
    async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () =>
          requests.length === 1
            ? { number: 2 }
            : { id: 123, user: { type: "Bot", login: "reprise-helper[bot]" } },
      };
    },
  );
  await vm.runInNewContext(scripts[1], context);
  assert.equal(context.process.exitCode, 0);
  assert.equal(requests.length, 2);
  assert.equal(
    requests[1].url,
    "https://api.github.com/repos/Ninefarer/Reprise/issues/2/comments",
  );
  assert.equal(JSON.parse(requests[1].options.body).body, body);
  assert.equal(requests[1].options.redirect, "error");
  assert.match(context.summaries[0].body, /reprise-helper\[bot\]/);
  assert.doesNotMatch(context.logs.join(""), /test-only-placeholder|whoami/);
});
for (const [name, response, expected] of [
  [
    "pull requests",
    { ok: true, json: async () => ({ pull_request: {} }) },
    /issues only/,
  ],
  [
    "locked issues",
    { ok: true, json: async () => ({ locked: true }) },
    /locked/,
  ],
  ["API failures", { ok: false, status: 403 }, /HTTP 403/],
])
  test(`workflow rejects ${name} without posting`, async () => {
    let calls = 0;
    const context = sandbox(
      { APP_TOKEN: "test-placeholder", APP_SLUG: "app", ISSUE_NUMBER: "2" },
      async () => {
        calls++;
        return response;
      },
    );
    await vm.runInNewContext(scripts[1], context);
    assert.equal(context.process.exitCode, 1);
    assert.equal(calls, 1);
    assert.match(context.logs.join(""), expected);
  });
test("workflow fails verification if a response claims a personal author", async () => {
  let calls = 0;
  const context = sandbox(
    {
      APP_TOKEN: "test-placeholder",
      APP_SLUG: "app",
      ISSUE_NUMBER: "2",
      COMMENT_BODY: "test",
    },
    async () => ({
      ok: true,
      json: async () =>
        ++calls === 1
          ? {}
          : { id: 123, user: { login: "Ninefarer", type: "User" } },
    }),
  );
  await vm.runInNewContext(scripts[1], context);
  assert.equal(context.process.exitCode, 1);
  assert.match(context.logs.join(""), /author did not match/);
  assert.equal(context.summaries.length, 0);
});
