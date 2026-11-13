# Codex issue reports through the GitHub App

The dedicated `codex-issue-comment.yml` workflow posts only to issues in
`Ninefarer/Reprise`. It does not build, publish, push, or modify Reprise. Existing
release workflows are independent.

## Activation

The workflow must land on the repository's default branch (`main` when this was
prepared). The repository instructions require owner approval before a push or
merge. Transfer only this automation commit; do not merge the pending 3.4.0 UI
work to Stable to register it. No release is needed to activate this workflow.

The installed App requires **Issues: write**, with its installation approved for
Reprise. Metadata read access is implicit. The workflow requests a token narrowed
to Reprise and Issues write; it does not request Contents, Actions, or PR write
permission for the bot. `REPRISE_BOT_APP_ID` and `REPRISE_BOT_PRIVATE_KEY` remain
exclusively in Actions repository secrets. Token masking and end-of-job revocation
are handled by `actions/create-github-app-token@v2`.

The dispatching human/automation account needs repository write access and an
authenticated GitHub CLI. A fine-grained dispatch token needs **Actions: write**;
classic/OAuth private-repository access uses `repo`. Registering/changing workflow
files can additionally require `workflow`. The dispatching account starts the run;
the installation token determines the comment author. Never copy the App key or
installation token to T3 Code or local configuration.

The workflow runs only from the default branch, checks no source out, and takes
inputs through environment variables rather than interpolating them into shell
code. The built-in GITHUB_TOKEN has no permissions. Invalid input is rejected
before obtaining an App token. Pull requests and locked issues are rejected.

## Reusable command from T3 Code or a terminal

Create a UTF-8 JSON report, containing verified observations only:

```json
{
  "batch": "6 — Notification panel",
  "changes": ["Describe the actual changes here."],
  "verification": [
    "List commands and observed results; label native checks pending if unverified."
  ],
  "status": "In Progress"
}
```

```powershell
# Preview formatting locally; makes no GitHub request.
node scripts/github/issue-report.mjs --issue 2 --report C:/path/report.json

# Read-only readiness check; cannot prove dispatch or bot credentials work.
node scripts/github/issue-report.mjs --check

# Explicitly submit the report to the workflow after activation.
node scripts/github/issue-report.mjs --issue 2 --report C:/path/report.json --dispatch

# Alternatively, use an existing UTF-8 Markdown body file.
node scripts/github/issue-report.mjs --issue 2 --body-file C:/path/report.md --dispatch
```

The command uses the installed `gh` CLI without a shell and sends JSON on stdin.
It has no application dependency or personal-account comment fallback. It always
targets Ninefarer/Reprise and the default branch. A manual Actions UI invocation
accepts `issue_number` and `comment_body` directly.

## First live verification

After activation, use a report whose batch is **Integration test — GitHub App
reporting**. State that the comment is a clearly labeled integration test and that
it makes no claim about completion of the UI overhaul. Dispatch once to Issue #2.

The prepared test body can be previewed or submitted with:

```powershell
node scripts/github/issue-report.mjs --report scripts/github/integration-test-report.json
node scripts/github/issue-report.mjs --report scripts/github/integration-test-report.json --dispatch
```

Inspect the run and its summary. Success requires the App-token step to complete,
the API comment to succeed, and its author to have type `Bot` and login matching
the action's `app-slug` plus `[bot]`. The workflow fails on a mismatch. Verify the
comment URL and author through an authenticated API read as well. Do not count a
successful dispatch as a successfully posted or verified comment.

HTTP 401 can indicate invalid App credentials; HTTP 403/422 during token creation
can indicate missing installation/Issues permission. Comment API errors include
the HTTP status without logging credentials, bodies or raw API responses. For a
timeout or uncertain result, inspect the issue before retrying to avoid duplicate
comments. The action revokes the temporary token at job completion by default.

## Local checks

```powershell
node --test scripts/github/issue-report.test.mjs
npx prettier --check .github/workflows/codex-issue-comment.yml
```

These checks do not create an installation token or post a comment. Live App
verification remains pending until the workflow exists on the default branch and
a real run succeeds.

## Preparation evidence (November 13, 2026)

- GitHub CLI authenticated to Ninefarer/Reprise; active account Ninefarer reports
  `repo` and `workflow` OAuth scopes. Existing Actions and repository reads succeed.
- Repository Actions are enabled; default branch is `main`.
- Both requested repository secret **names** are present; their values were not
  read, copied, printed or used outside Actions.
- `actionlint` 1.7.12 passed for the dedicated workflow. Its official Windows
  binary was downloaded to the OS temporary directory and checked against the
  release's SHA-256 checksum. No project dependency was added.
- Eight Node tests passed, including sandboxed execution of both inline workflow
  scripts with mocked API responses. These are local tests, not live App evidence.
- Workflow YAML passes Prettier's parser/formatting check.
- `--check` correctly reports the workflow absent from `main`. Installation-token
  creation, live dispatch permission and bot-authored commenting remain unverified.
- No push, default-branch merge, workflow dispatch, test comment or release was
  performed during preparation. Existing publishing workflows were unchanged.

References: [manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[dispatch API permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event),
[token action v2 inputs](https://github.com/actions/create-github-app-token/blob/v2/action.yml).
