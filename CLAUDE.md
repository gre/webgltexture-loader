# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach

- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Project notes

- Yarn 4 is pinned via Corepack (`packageManager` field). If `yarn` is shimmed by `proto` and refuses to run, invoke `corepack yarn ...` instead.
- Source is TypeScript. Build is per-package `tsc` orchestrated by `yarn workspaces foreach -Apt run build` from the root (parallel topological). Tests are transformed by `ts-jest`.
- Peer-deps for the Expo and React Native loaders are not installed; minimal type stubs live in `packages/*/src/types.d.ts` files. Don't try to install `expo-camera` / `react-native` to type-check — keep the stubs minimal.
- Lint / format are oxc tools: `yarn lint` (oxlint) and `yarn format` (oxfmt --check) / `yarn format:fix`. `oxfmt` has no config file yet — it uses defaults.
- Headless GL tests use the `gl` package (`9.0.0-rc.10` for Node 24 compat). They're suffixed `*.gl.test.ts` and skip themselves if `require("gl")` throws (so local macOS without the prebuilt binding still passes the rest of the suite). CI installs `xvfb + mesa` and runs the suite under `xvfb-run`.
