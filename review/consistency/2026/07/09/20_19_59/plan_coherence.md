# Plan 정합성 검토 — spec/7-channel-web-chat/

## 발견사항

- **[WARNING]** `4-security.md` 의 interact rate-limit 서술이 이미 완료된 in-progress plan 항목과 모순(stale)
  - target 위치: `spec/7-channel-web-chat/4-security.md:136` (§4 공개 webhook 남용 방어, blockquote)
    > "기존 EIA §8.4 유지 — **SSE 동시 3/execution 은 구현됨**(초과 시 `429 TOO_MANY_CONNECTIONS`), **interact 분당
    > 60/execution 은 Planned(미구현)**. 두 제한의 구현 상태가 다르므로 분리 기재한다."
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목 3
    > "[x] **Inbound per-execution rate-limit 및 `RATE_LIMITED` 429** (§5.1 / §8.4 rows 1·3) — `/interact` 60/분·
    > status 120/분 (execution 당). `InteractionRateLimiterService`(Redis fixed-window, fail-open) +
    > `InteractionRateLimitGuard` + `@RateLimit`. `429 RATE_LIMITED` + `Retry-After`. spec §5.1/§8.4/§3.1 EIA-NX-11
    > + §2-api-convention §7 + user-guide triggers.mdx/en.mdx 동기화. lint·unit·build·e2e 통과."
  - 상세: 이 plan 항목은 `[x]`(완료)로 체크돼 있고, 실제 `spec/5-system/14-external-interaction-api.md:734` 도
    "Inbound 명령 (`/interact`) execution 당 분당 60 | **구현됨** — `InteractionRateLimiterService`(Redis
    fixed-window, fail-open) + `InteractionRateLimitGuard`. 초과 시 `429 RATE_LIMITED` + `Retry-After`" 로
    이미 flip 되어 있다. 그런데 `4-security.md:136` 은 여전히 "interact 분당 60/execution 은 **Planned(미구현)**"
    이라고 반대로 서술한다 — 같은 사실(EIA §8.4 interact rate-limit)에 대해 target 문서와 (완료된) in-progress plan
    이 상반된 구현 상태를 주장하는 상태. 이는 본 webchat-session-history PR 이 만든 drift 는 아니고(spec_impact 에
    `4-security.md` 미포함) 이전부터 있던 stale 서술이지만, target 문서 번들(`spec/7-channel-web-chat/**`) 안에
    현재도 남아 있어 웹챗 위젯/SDK 사용자가 "interact 명령은 rate-limit 이 없다"고 오인할 수 있다(실제로는
    분당 60회 초과 시 `429 RATE_LIMITED` 를 받는다).
  - 제안: `4-security.md §4` 를 갱신해 "interact 분당 60/execution 은 **구현됨**"으로 flip(EIA §8.4 와 동일 문구로
    정정). SSE 동시 3/execution 행과 나란히 "두 제한의 구현 상태가 다르므로 분리 기재" 라는 전제 자체가 더 이상
    성립하지 않으므로 해당 문장도 함께 정리 필요.

- **[INFO]** EIA gaps plan 의 `getStatus` 서술이 2026-07-09 `conversationThread` 확장을 반영하지 못함
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 · R17 "`conversationThread` 노출로의
    재조정(2026-07-09)" (본 PR 이 추가) — `spec/7-channel-web-chat/3-auth-session.md §3.1` 이 이를 소비
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목 17
    > "[x] **`GET /api/external/executions/:id` 의 currentNode / context 실값** (§5.3) — 완료/정합 확인
    > (2026-07-08 재검증): ... `context`(buttons=`buttonConfig{buttons,nodeOutput}`, form/ai_conversation=
    > `nodeOutput`)를 SSE `waiting_for_input` wire 와 동일 형식으로 복원..."
  - 상세: 항목 17 은 2026-07-08 시점 스냅샷이라 `context.conversationThread` 필드(본 PR 이 2026-07-09 에 추가)를
    언급하지 않는다. 모순은 아니고(새 필드가 기존 서술을 무효화하지 않음) 단지 완료 표시된 항목의 설명이 최신
    확장을 누락한 상태 — 추후 이 plan 재검증 시 §5.3 서술을 최신화하면 됨. 차단 사유 아님.
  - 제안: 항목 17 설명에 "(2026-07-09) `context.conversationThread` durable 스냅샷 동봉 추가"를 한 줄 보강하거나,
    다음 spec-sync 재검증 라운드에서 갱신.

## 비고 — 정합 확인 (충돌 없음)

- `1-widget-app.md §3.1` 의 "`execution.replay_unavailable` 서버 emit 은 구현됐으나 위젯 소비 분기(`handleEiaEvent`)는
  미배선(no-op), 로컬 시간(>5분) 폴백 유지 — 클라이언트 측 후속" 서술은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  항목 19("[ ] (후속) web-chat 위젯 클라이언트 소비 ... channel-web-chat 범위 — 별도")와 정확히 일치한다. 미해결
  결정을 우회하지도, 선행 조건을 어기지도 않는다.
- 본 PR(웹채팅 세션 컨트롤 + 새로고침 히스토리 복원, `plan/complete/webchat-session-controls-history-restore.md`)의
  "사용자 결정(2026-07-09): 새 대화 + 대화 종료 둘 다 헤더 노출, 가벼운 확인" 은 `plan/in-progress/**` 어느 문서의
  "결정 필요" 항목과도 충돌하지 않는다 — 관련 열린 plan(`chat-channel-*`, `node-cancellation-inflight-followups.md`,
  `self-hosting-deployment.md` 등)은 모두 채널·주제가 달라 겹치는 미해결 결정이 없다.
- `plan/in-progress/**` 전수 스캔(30여 개 파일 + `node-output-redesign/` 하위 폴더) 결과 `channel-web-chat`/`widget`/
  `webchat` 를 직접 언급하는 문서는 `spec-sync-external-interaction-api-gaps.md` 가 유일하며, 위 두 항목 외에는
  target 과 충돌하는 서술이 없다.

## 요약

이번 target(`spec/7-channel-web-chat/**`, 웹채팅 세션 컨트롤 + 히스토리 복원)은 `plan/in-progress/**` 의 미해결
결정을 우회하거나 선행 조건을 무시하지 않으며, 이 PR 이 직접 건드린 EIA `getStatus`/`conversationThread` 확장은
관련 spec-sync in-progress plan 의 열린 항목(EIA-NF-03 클라이언트 소비 미배선)과 정확히 일치해 후속 항목 누락도
없다. 다만 target 문서 번들 안에 이 PR 과 무관한 pre-existing stale 서술 하나(`4-security.md` interact rate-limit
"Planned" 표기가 이미 구현 완료된 in-progress plan 항목·EIA 본문과 모순)가 발견돼 WARNING 으로 보고한다. 즉시 차단할
CRITICAL 은 없다.

## 위험도

LOW
