# GitHub release descriptions

These instructions govern GitHub descriptions only. They do not change `src/changelog.ts`, in-app categories, rendering, parsing, update checks, release channels or versioning. Use the `reprise-release-manager` skill with the conventions below.

## Stable

Use `docs/releases/stable.md`. Describe confirmed user-visible additions, changes and bug fixes. Prefix each bullet:

- `✦` for a new capability.
- `→` for a change to existing behavior.
- `▲` for a resolved defect.

Omit a prefix when it has no confirmed entry. Keep one concise sentence per bullet where possible. No em dashes, promotional claims, invented contributors or unverified issue or pull-request references. Do not add pixel-art banners, duplicate text headings, or symbols other than the three prefixes.

Do not include Implementation, Validation or Known Limitations sections. Do not include test counts, build output, CI reports or architectural explanations. Continue running and recording checks in development records. Excluding them from user-facing copy does not waive testing. Communicate a material user-impacting issue honestly during release review. Obtain approval before publication.

An optional personal note is a paragraph supplied or approved by the developer. Never manufacture a voice, opinion, thank-you or announcement. Omit the note otherwise.

## Nightly

Use `docs/releases/nightly.md`. Keep implementation detail, commit references, tests, experimental behavior, installation guidance and known limitations. Distinguish a successful notification submission from an observed notification. Do not use the Stable prefixes. Keep the prerelease channel and its separate installation and data identity.

## What the workflow checks

`scripts/updater/build-release.mjs` reads `docs/releases/VERSION.md` and the publisher uploads that file with `--notes-file`. Neither script generates prose, prefixes or images. For Stable, the build rejects a heading named Implementation, Validation or Known limitations. It does not require or reject the symbol prefixes.

Published Stable notes from 3.3.0 through 3.4.3 use the pixel-art banners in `assets/releases/` with ordinary bullets. Those files stay as published. Do not rewrite them to the prefix style. New Stable notes, starting with 3.4.4, use the prefixes above.

## Artwork boundary

`assets/releases/` remains repository artwork: `additions.png`, `changes.png`, `bugfixes.png` and `hey.png`. Do not normalize, crop, recolor or re-encode those files, and do not regenerate them. They are not headings in new Stable notes. Do not import them into Vite or Tauri resources. Tauri bundles `dist` and has no resource glob for this directory. Do not zip the repository as an application package.

## Manual release procedure

Author the description from verified changes and store it as `docs/releases/VERSION.md`. See [signed update operations](UPDATES.md).

Dispatch `.github/workflows/signed-release.yml` with the channel, approved full source SHA and `publish` flag. The default is artifacts only. Publishing requires the installed-upgrade acceptance fingerprint. The build and the publisher both validate it. Stable source must belong to `main`, Nightly to `develop`. Versioned releases and tags cannot be reused. The `nightly-updates` prerelease is only a rolling manifest pointer and never replaces Latest Stable.

1. Inspect the intended branch, commit range, versions, confirmed changes and release channel.
2. Prepare the corresponding template. Fill only verified changes. Omit empty prefixes and an unapproved personal note.
3. Run the relevant checks, preserve test coverage, and keep the results in development records.
4. For Stable, confirm the three prefixes and the absence of developer sections. For Nightly, confirm the technical claims and known limitations.
5. Present the final description, exact source commit, channel and installer checksum for review.
6. Obtain explicit publication authorization before pushing, tagging, creating or editing a release. Keep a Nightly prerelease from replacing the latest Stable release.
7. After authorized publication, verify the tag target, uploaded assets, checksum and release channel. Do not silently rewrite historical releases.

Documentation: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
