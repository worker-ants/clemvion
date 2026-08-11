---
title: 웹채팅 위젯 — `wc:boot` 경로의 `apiBase` 스킴 검증 (query 폴백엔 있음)
worktree: webchat-apibase-scheme
started: 2026-07-24
owner: developer
priority: P3
status: complete
spec_impact:
  - spec/7-channel-web-chat/4-security.md
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

- [x] `wc:boot` 경로에도 동등한 스킴 검증을 적용할지 판정 — **적용한다.** 판정 기준이었던
      "정당한 상대경로/프록시 배포가 있는가" 는 **없다**로 실측 확정: 위젯은 CDN origin 의
      iframe 에서 돌므로(`widgetOrigin: originOf(base)`) 상대 `apiBase` 는 host 가 아니라
      **CDN origin** 으로 해소돼 애초에 프록시 수단이 못 된다. SDK 자신도 같은 값을 iframe
      쿼리에 실어 http(s) 검증을 통과시켜야 하므로 정상 배포는 이미 이 술어를 만족한다.
- [x] 구현 + 회귀 테스트 — `safeApiBase(raw, source)` 로 일반화하고 `mergeBootConfig` 신설.
      회귀 5건 + 뮤테이션(종전 동작 복원) **4건 RED**.
- [x] ~~적용하지 않기로 하면 근거를 주석에 고정~~ — 적용했으므로 해당 없음. 대신 **적용
      근거**를 `4-security.md §R0`(기각한 대안 포함)과 `safeApiBase` JSDoc 양쪽에 남겼다.

## 관련

- `codebase/channel-web-chat/src/widget/use-widget.ts` (`safeApiBaseFromQuery`, `wc:boot` 처리)
- 선행: [`webchat-session-apibase-binding.md`](../complete/webchat-session-apibase-binding.md)
- `spec/7-channel-web-chat/2-sdk.md` §boot / `4-security.md`

## Rationale

**왜 P3 인가.** 선재이고, host 가 신뢰 경계 안이라는 현행 전제에서는 활성 결함이 아니다.
다만 apiBase 가 토큰 전송 대상을 정하게 된 이상 "검증 비대칭" 을 방치하기보다 **판정해서
닫는 편**이 낫다 — 채택이든 미채택이든 근거가 코드에 남는 것이 목표다.

## 완료 (2026-08-11) — 진단이 plan 보다 한 칸 나빴다

plan 은 이 건을 "**비대칭 하드닝**(boot 에 검증이 없다)" 으로 적었다. 실측하니 그보다 나쁘다:

1. SDK 는 같은 `apiBase` 를 **양쪽으로** 보낸다 — iframe src 쿼리(`resolveIframeTarget`)와
   `wc:boot` postMessage 둘 다.
2. 위젯의 병합은 `{ ...configFromQuery(), ...boot }` 라 **boot 이 나중에 덮는다.**

⇒ 쿼리 쪽 검증은 boot 이 도착하는 순간 **덮여서 사라진다.** 검증의 **부재**가 아니라
**무력화**였고, 그래서 "무조건 적용이 답이 아닐 수 있다" 는 plan 의 유보가 성립하지 않는다 —
비대칭 유지는 곧 쿼리 검증을 장식으로 두는 선택이다.

**부수 발견 (선재)**: `boot.apiBase` 가 **명시적 `undefined`** 면 spread 가 검증된 쿼리 값을
덮어 지웠다. 회귀 테스트를 쓰다 내 첫 구현이 그 자리를 그대로 재현해 발각됐다 — 거절과
부재를 둘 다 쿼리 폴백으로 보내도록 `mergeBootConfig` 에서 명시 계산한다.

검증: channel-web-chat **448 passed**, 타입 오류 0, lint 0.

