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
