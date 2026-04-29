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
- Source is Flow (`//@flow`). Migration to TypeScript is tracked in issue #43 — prefer not to introduce new Flow code.
- `yarn test` reruns compiled tests after `yarn build` because `lib/` isn't excluded from Jest. Wipe `packages/*/lib` before re-running tests if counts look doubled.
