# Release

Releases are built by `.github/workflows/release.yml` on a `macos-latest` runner and published as a universal (Apple Silicon + Intel) `.dmg` attached to a GitHub Release.

## Cut a release

1. Bump the version in **both** files — they must match:
   - `app/package.json`
   - `app/src-tauri/tauri.conf.json`
2. Commit and push to `main`.
3. Tag with a matching `v` prefix and push the tag:

```sh
git commit -am "v0.2.0"
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

Pushing the tag is what triggers the workflow. `git push` alone does not push tags.

For the first release at `0.1.0`, both files already carry that version, so only the tag is needed.

## What the workflow does

1. Installs dependencies and builds `--target universal-apple-darwin`.
2. Creates a **draft** release named `jasa <tag>` with the `.dmg` attached.
3. Stops there. Nothing is public until you publish it.

Progress: https://github.com/polyphilz/jasa/actions

Then open the Releases page, confirm the `.dmg` is attached and the notes are correct, and click **Publish release**.

Expect 5–15 minutes on a cold cache. Subsequent runs are faster once `Swatinem/rust-cache` is warm.

## Version mismatch

Nothing enforces that the tag matches the version in the two config files. Tagging `v0.2.0` without bumping `tauri.conf.json` succeeds and produces a release named `jasa v0.2.0` containing `jasa_0.1.0_universal.dmg`. Harmless, but redo it.

## Redo a tag

Only for a draft that has not been published.

```sh
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0
git tag v0.2.0
git push origin v0.2.0
```

Delete the existing draft release in the GitHub UI first, or the workflow creates a duplicate.

Do not move a tag that has already been published.

## Dry run

**Actions → Release → Run workflow**, passing a tag name as the input. Runs the full build without tagging.

## Code signing

Releases are unsigned by default. macOS reports an unsigned download as "damaged" on first launch; users clear it with:

```sh
xattr -cr /Applications/jasa.app
```

To ship signed and notarized builds, add these as Actions secrets (Settings → Secrets and variables → Actions):

- `APPLE_CERTIFICATE` — base64 of the Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: Your Name (TEAMID)`
- `APPLE_ID`
- `APPLE_PASSWORD` — an app-specific password, not the account password
- `APPLE_TEAM_ID`

Requires the Apple Developer Program ($99/yr). The workflow needs no edits: it picks the secrets up automatically and drops the `xattr` instructions from the release notes once `APPLE_SIGNING_IDENTITY` is set.

The Mac App Store is not an option. The sandbox forbids spawning binaries outside the app bundle, and jasa executes the user's `claude` CLI (`app/src-tauri/src/agent.rs`).

## Build locally

```sh
cd app
rustup target add x86_64-apple-darwin   # once, for the Intel half
pnpm tauri build --target universal-apple-darwin
```

Output:

```
app/src-tauri/target/universal-apple-darwin/release/bundle/
  macos/jasa.app
  dmg/jasa_<version>_universal.dmg
```

Verify the result is universal:

```sh
lipo -archs app/src-tauri/target/universal-apple-darwin/release/bundle/macos/jasa.app/Contents/MacOS/jasa
# -> x86_64 arm64
```

## Troubleshooting

**`403` creating the release.** Check Settings → Actions → General → Workflow permissions. An org-level restriction on `GITHUB_TOKEN` overrides the workflow's `permissions: contents: write`.

**Release build behaves differently from `pnpm tauri dev`.** Release builds use `app.security.csp` in `tauri.conf.json`; dev uses `devCsp`. A blank window in the packaged app usually means something is blocked by the stricter production policy.

**Data location.** Release builds use the platform app-data directory; dev builds use `app/.data/local`. Override either with `JASA_DATA_DIR`.
