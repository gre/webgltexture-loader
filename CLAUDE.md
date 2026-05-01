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
- Source is TypeScript. Build is per-package `tsc` orchestrated by `yarn workspaces foreach -Apt --no-private run build` from the root (parallel topological; `--no-private` skips private workspaces such as `apps/example-web`). Tests are transformed by `ts-jest`.
- Peer-deps for the Expo and React Native loaders are not installed; minimal type stubs live in `packages/*/src/types.d.ts` files. Don't try to install `expo-camera` / `react-native` to type-check — keep the stubs minimal.
- Lint / format are oxc tools: `yarn lint` (oxlint) and `yarn format` (oxfmt --check) / `yarn format:fix`. `oxfmt` has no config file yet — it uses defaults.
- Headless GL tests use the `gl` package (`9.0.0-rc.10` for Node 24 compat). They're suffixed `*.gl.test.ts` and skip themselves if `require("gl")` throws (so local macOS without the prebuilt binding still passes the rest of the suite). CI installs `xvfb + mesa` and runs the suite under `xvfb-run`.
- The visual smoke-test demo lives in `apps/example-web/` (Vite + vanilla TS). It is private (`"private": true`) and therefore excluded from the root `yarn build` cascade by `--no-private` so library builds stay fast; verify it standalone with `corepack yarn workspace example-web build`.
- The Expo smoke-test demo lives in `apps/example-expo/` (Expo SDK 54 + expo-camera + expo-gl). It exercises the `webgltexture-loader-expo-camera` path on a real device via Expo Go and is **not** part of CI. It is private and excluded from the root build cascade; verify the TypeScript with `corepack yarn workspace example-expo exec tsc --noEmit`. Run on-device via `corepack yarn workspace example-expo start`.
