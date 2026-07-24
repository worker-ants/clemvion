---
title: 웹채팅 위젯 — `wc:boot` 경로의 `apiBase` 스킴 검증 (query 폴백엔 있음)
worktree: (unstarted)
started: 2026-07-24
owner: developer
priority: P3
status: in-progress
---

## Overview

`review/code/2026/07/24/22_09_46` INFO 2 + `review/consistency/2026/07/24/22_35_51`
plan_coherence W2 에서 분리. **선재 신뢰 경계**이며 apiBase 바인딩 PR 이 만든 표면이 아니다.

RESOLUTION 이 "이 PR 범위 밖" 으로 미룬 항목이 **어떤 plan 에도 안착하지 않았다**는 지적을
받아 티켓화한다 — 이 계열(webchat)이 이미 세 번 학습한 "형제 티켓 분리" 관행이다
(`webchat-usewidget-extraction` · `webchat-command-failure-is-not-termination` ·
`webchat-spec-rationale-followup` 이 같은 이유로 만들어졌다).

## 문제

직접 로드 경로의 쿼리 파라미터 `?apiBase=` 는 `safeApiBaseFromQuery` 가 **http(s) URL 로만**
허용한다(사용자가 URL 을 통제할 수 있는 외부 입력이라 하드닝). 그런데 **`wc:boot`(postMessage)
경로로 들어오는 `apiBase` 는 같은 스킴 검증을 거치지 않는다** (`use-widget.ts`).

오늘 무해한 이유는 `wc:boot` 이 host SDK 계약이고 host 를 신뢰 경계 안으로 보기 때문이다.
다만 두 입력 경로에 **비대칭 하드닝**이 있다는 사실 자체는 기록해 둘 값이 있다 — 특히
[apiBase 세션 바인딩](../complete/webchat-session-apibase-binding.md) 이후로 `apiBase` 는
"세션 토큰이 어디로 가는지" 를 정하는 값이 됐다.

## 체크리스트

- [ ] `wc:boot` 경로에도 `safeApiBaseFromQuery` 와 동등한 스킴 검증을 적용할지 판정
      — host 신뢰 경계를 어디까지 볼 것인가의 **설계 결정**이다(무조건 적용이 답이 아닐 수 있다:
      host 가 상대경로/프록시 경유 base 를 쓰는 정당한 배포가 있는지 먼저 확인)
- [ ] 적용하기로 하면 구현 + 회귀 테스트(비-http(s) 스킴 boot → 거부)
- [ ] 적용하지 않기로 하면 **그 근거를 `use-widget.ts` 주석에 고정** (다음 리뷰의 재지적 방지)

## 관련

- `codebase/channel-web-chat/src/widget/use-widget.ts` (`safeApiBaseFromQuery`, `wc:boot` 처리)
- 선행: [`webchat-session-apibase-binding.md`](../complete/webchat-session-apibase-binding.md)
- `spec/7-channel-web-chat/2-sdk.md` §boot / `4-security.md`

## Rationale

**왜 P3 인가.** 선재이고, host 가 신뢰 경계 안이라는 현행 전제에서는 활성 결함이 아니다.
다만 apiBase 가 토큰 전송 대상을 정하게 된 이상 "검증 비대칭" 을 방치하기보다 **판정해서
닫는 편**이 낫다 — 채택이든 미채택이든 근거가 코드에 남는 것이 목표다.
