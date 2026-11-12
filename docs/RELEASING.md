# GitHub release descriptions

These instructions govern GitHub descriptions only. They do not change `src/changelog.ts`, in-app categories, rendering, parsing, update checks, release channels or versioning. Use the `reprise-release-manager` skill; these project instructions replace its older Stable bullet-prefix guidance.

## Stable

Use `docs/releases/stable.md`. Describe confirmed user-visible additions, changes and bug fixes. Use each relevant official PNG as its section heading with meaningful alt text and ordinary Markdown bullets. Do not add duplicate text section headings or symbols before bullets. Omit empty categories. Keep one concise sentence per bullet where possible. No em dash separators, promotional claims, invented contributors or unverified issue/PR references.

Do not include Implementation, Validation or Known Limitations sections in Stable descriptions. Do not include test counts, build output, CI reports or architectural explanations. Continue running and recording all checks in development records; excluding them from user-facing copy does not waive testing. Communicate any material user-impacting issue honestly during release review; do not hide it or claim a fix. Obtain approval for appropriate user-facing communication before publication.

`...HEY` is optional, uses paragraphs, and requires a personal message supplied or approved by the developer. Never manufacture a voice, opinion, thank-you or announcement. Omit this section otherwise.

## Nightly

Use `docs/releases/nightly.md`. Retain implementation details, commit references, tests, experimental behavior, installation guidance and known limitations. Distinguish successful submission from observed notification display. Do not automatically use the Stable banners. Keep prerelease channels and separate installation/data identities intact.

## Artwork and private repository hosting

Use the original files, byte-for-byte, from `assets/releases/`: `additions.png`, `changes.png`, `bugfixes.png`, `hey.png`. Do not normalize dimensions, crop, recolor or re-encode them. ...HEY has intentionally different proportions. Use natural aspect ratios. Do not duplicate identical assets per release.

After the artwork is committed and an authorized push makes it available, pin every banner URL to that full immutable commit SHA, using this GitHub repository-image form:

`https://github.com/Ninefarer/Reprise/blob/FULL_ARTWORK_COMMIT_SHA/assets/releases/additions.png?raw=true`

Use the corresponding filename for each section. Verify each URL and the rendered description while authenticated as a reader of this repository. Do not publish unresolved template variables or an image URL that has not been checked. GitHub private images require repository access; no anonymous/public availability is promised. Do not place access tokens or expiring signed image URLs in descriptions. If repository-image rendering does not work in the release preview, stop and review a GitHub-hosted private attachment alternative with the owner. Do not create a public asset repository, change visibility, or upload externally without approval.

At the time these instructions were added, the artwork existed locally but was untracked. Consequently no live immutable artwork URL had been verified. Local previews are not GitHub-rendering verification.

## Packaging boundary

`assets/releases/` is repository documentation, outside Vite's `src` and public assets. Tauri currently bundles `dist` and has no resource glob including this directory. Keep this boundary. Do not add artwork to installer resources or distributable ZIPs; do not zip the entire repository as an application package. GitHub's automatic source archives can naturally include tracked documentation; they are not application installation packages.

## Manual release procedure

There is currently no GitHub Actions release generator. Descriptions are prepared manually and passed to GitHub CLI using `--notes-file`. No publication automation is added by these templates.

1. Inspect the intended branch, commit range, versions, confirmed changes and release channel.
2. Prepare the corresponding template. Fill only verified changes and references; omit empty categories and unapproved ...HEY.
3. Run all relevant checks, preserve test coverage, and keep results in development records. Inspect installer contents and assets.
4. Check immutable banner URLs and authenticated rendering for Stable. Check technical claims and known limitations for Nightly.
5. Present final description, exact source commit, channel and installer/checksum for review.
6. Obtain explicit publication authorization before pushing, tagging, creating or editing a release. Keep Nightly prereleases from replacing the latest Stable release.
7. After authorized publication, verify tag target, uploaded assets, checksum and release channel. Do not silently rewrite historical releases.

Documentation: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
