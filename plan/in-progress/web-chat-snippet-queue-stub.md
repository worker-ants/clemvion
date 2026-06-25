---
title: 웹채팅 설치 스니펫 — command-queue 스텁 누락으로 인한 ClemvionChat ReferenceError 수정
worktree: web-chat-snippet-queue-stub-629472
started: 2026-06-25
owner: developer
related_spec:
  - spec/7-channel-web-chat/2-sdk.md
---

# 배경

운영자가 콘솔 설치 스니펫을 실제 사이트에 삽입하면 콘솔 에러:
`Uncaught ReferenceError: ClemvionChat is not defined`.

# Root cause (코드 확정)

`buildWebChatSnippet`(`codebase/frontend/src/lib/web-chat/snippet.ts:100-112`)가 생성하는 스니펫:
```
<script>(function(d,s){var j=d.createElement(s);j.async=1;j.src="...loader.js";d.head.appendChild(j);})(document,"script");</script>
<script>ClemvionChat('boot', {...});</script>
```
로더를 **async** 로 붙인 뒤 곧바로 인라인 `ClemvionChat('boot')` 를 **동기 실행** → 로더가 `ClemvionChat` 을
정의하기 전이라 ReferenceError.

설계는 **command-queue 패턴**(spec 2-sdk §1 "단일 전역 진입점 + 명령 큐"): 스니펫이 **큐 스텁**을 동기 설치해
boot 전 호출을 버퍼링하고, `loader.js`(`packages/web-chat-sdk` `installGlobal`)가 로드되면 `.q` 큐를 **replay**
(`loader.ts:97-105`)한다. example `packages/web-chat-sdk/examples/snippet.html:18-22` 에는 스텁이 있다.
**그러나 콘솔 생성 스니펫·spec §1 예시·유저 가이드 스니펫에는 스텁이 누락**돼 있다(drift).

# 수정 — 6곳에 동일 큐 스텁 추가

표준 스텁(example·spec §1·loader 와 정합):
```js
window.ClemvionChat=window.ClemvionChat||function(){(window.ClemvionChat.q=window.ClemvionChat.q||[]).push(arguments)};
```
로더 IIFE 안, 로더 script 생성 **전**에 삽입(동기 정의).

1. **(code)** `codebase/frontend/src/lib/web-chat/snippet.ts` `buildWebChatSnippet` — 스텁 추가.
2. **(spec)** `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시 — 스텁 추가 + (필요시) Rationale 보강(왜 스텁 필수).
3. **(docs)** 유저 가이드 4파일 M1 스니펫 — 스텁 추가:
   - `web-chat.mdx` / `web-chat.en.mdx` / `web-chat-sdk.mdx` / `web-chat-sdk.en.mdx`.

# 테스트
`snippet.test.ts`: 생성 스니펫에 (a) 큐 스텁(`ClemvionChat.q`/`push(arguments)`) 포함, (b) 스텁이 `ClemvionChat('boot'`
호출보다 **앞**(인덱스), (c) 로더 src·boot JSON 유지 검증.

# 리뷰
lint/build/test → /ai-review → fix → /consistency-check --impl-done → push + PR.

# 주의
- 로더는 이미 `.q` replay 처리(installGlobal) — 백엔드/로더 변경 불필요. 스니펫 측 스텁만 추가하면 됨.
- 스텁은 정적 문자열(사용자 입력 없음) → escapeForScript 불필요. boot JSON 은 기존대로 escape.
- npm SDK 경로(`import { ClemvionChat }`)는 본 버그와 무관(스니펫 로더 한정).
