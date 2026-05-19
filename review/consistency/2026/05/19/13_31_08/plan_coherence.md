# Plan 정합성 검토 결과

검토 대상 plan: `plan/in-progress/cafe24-token-lifecycle-logs.md`
worktree: `cafe24-token-lifecycle-logs-196308`
검토 시각: 2026-05-19

---

## 발견사항

### 1. [INFO] bg-refresh-tuning worktree 와의 경계 — 이미 분리됨 (충돌 없음)

- target 위치: `plan/in-progress/cafe24-token-lifecycle-logs.md` §2 "integration-expiry-scanner.service.ts"
- 관련 plan: `plan/in-progress/cafe24-bg-refresh-tuning.md` (worktree: `cafe24-bg-refresh-tuning-fb72d5`)
- 상세: `cafe24-bg-refresh-tuning` 은 `integration-expiry-scanner.service.ts` 와 `cafe24-token-refresh.constants.ts` 를 변경하고 이미 커밋 (`bb24e368`) 했다. target plan 은 동일 파일에 대해 "enqueue 성공 로그가 이미 있음, 변경 없음" 이라고 명시적으로 작업 범위에서 제외하고 있다. 실제 코드 변경 대상이 `cafe24-api.client.ts` 단일 파일이므로 파일 단위 경합은 없다. 단, target plan 이 작성된 시점 (`cafe24-token-lifecycle-logs-196308` 브랜치의 base는 main 커밋 `fcd61be8`) 은 bg-refresh-tuning 커밋이 아직 origin/main 에 미머지된 상태다. merge 순서에 따라 `REFRESH_PROACTIVE_THRESHOLD_DAYS` 값이 10 → 7 로 변경된 bg-refresh-tuning 변경사항이 먼저 main 에 반영될 수 있으나, target plan 은 해당 상수를 건드리지 않으므로 충돌 없음.
- 제안: 추적 메모 수준. bg-refresh-tuning PR 이 먼저 merge 되면 `REFRESH_PROACTIVE_THRESHOLD_DAYS=7` + cron `0 */6 * * *` 상태가 base 가 됨을 참고. target plan 변경 대상 파일인 `cafe24-api.client.ts` 는 bg-refresh-tuning 이 전혀 건드리지 않으므로 rebase 충돌 가능성 없음.

---

### 2. [INFO] node-output-redesign/cafe24.md 미완료 항목과의 영역 교차 — 경합 없음

- target 위치: `plan/in-progress/cafe24-token-lifecycle-logs.md` §1 변경 범위
- 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` (worktree 미할당, Phase 2 대기)
- 상세: `node-output-redesign/cafe24.md` 의 미완료 항목은 `cafe24-api.client.ts` 를 참조하되 직접 수정 대상으로 지정하지 않는다. 해당 plan 의 잔여 항목은 (a) `spec/4-nodes/4-integration/4-cafe24.md` cursor 표기 정정 (spec 작업), (b) `cafe24.handler.spec.ts` 테스트 추가, (c) `buildMeta` 회귀 보호 등이며 모두 `cafe24-api.client.ts` 본문 변경이 아니라 테스트·spec 영역이다. target plan 이 `cafe24-api.client.ts` 내부에 로그만 추가하므로 handler/schema/spec 을 손대지 않아 충돌 없음.
- 제안: 추적 메모 수준. 향후 `node-output-redesign/cafe24.md` Phase E 착수 시 `cafe24-api.client.ts` 의 `refreshAccessToken`·`executeWithRateLimit` 코드 경로가 이 plan 에 의해 log 추가로 인한 줄번호 이동이 발생한다는 점을 해당 worktree 착수자가 인지할 필요가 있음.

---

### 3. [INFO] cafe24-backlog-residual B-5-8 alt 의 refreshAccessToken — 다른 파일의 동명 메서드

- target 위치: `plan/in-progress/cafe24-token-lifecycle-logs.md` §1 `refreshAccessToken` 로그 추가
- 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §B-5-8 alt (worktree: TBD)
- 상세: `cafe24-backlog-residual` §B-5-8 alt 는 `refreshAccessToken` 의 unit 테스트 추가를 다루나, 그 대상 메서드는 `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 동명 메서드다 (영향 범위로 `cafe24/**.spec.ts` 명시). target plan 의 `refreshAccessToken` 은 `cafe24-api.client.ts` 의 별도 메서드다. 두 메서드는 서로 다른 파일에 위치하며 기능도 다르다 (BullMQ 기반 토큰 갱신 클라이언트 vs. OAuth 콜백 토큰 교환). 파일 수준 충돌 없음.
- 제안: 추가 조치 불필요. 동명 메서드로 인한 혼동 가능성만 메모.

---

### 4. [INFO] cafe24-restricted-scopes-followups §INSUFFICIENT_SCOPE — cafe24-api.client.ts markAuthFailed 언급

- target 위치: `plan/in-progress/cafe24-token-lifecycle-logs.md` §1 `executeWithRateLimit` 401 자가회복 로그
- 관련 plan: `plan/in-progress/cafe24-restricted-scopes-followups.md` (worktree: TBD per-item)
- 상세: `cafe24-restricted-scopes-followups.md` 는 `cafe24-api.client.ts` 의 `markAuthFailed` 에 `requiresCafe24Approval` 추가를 계획하고 있다 (§INSUFFICIENT_SCOPE 보강). target plan 이 다루는 401 자가회복 경로 (`executeWithRateLimit`) 와 `markAuthFailed` 는 인접한 코드 경로다. 그러나 target plan 은 `executeWithRateLimit` 내부에 log 만 추가하고 `markAuthFailed` 로직 자체를 건드리지 않는다. `cafe24-restricted-scopes-followups` 도 현재 worktree 미할당 (TBD per-item) 이라 동시 작업 중이 아니므로 경합 없음.
- 제안: `cafe24-restricted-scopes-followups` 가 `markAuthFailed` 변경을 착수할 때 target plan 의 log 추가 커밋이 이미 main 에 반영되어 있으면 줄번호 이동 정도의 rebase 충돌만 예상된다. CRITICAL 수준 아님.

---

## 미해결 결정 우회 검토

target plan(`cafe24-token-lifecycle-logs.md`) 이 다른 plan 에서 "결정 필요"로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리는지 검토:

- `ai-agent-tool-connection-rewrite.md` 의 5개 TBD 결정 — Cafe24 API client 로그와 무관. 충돌 없음.
- `cafe24-backlog-residual.md` 의 미해결 항목 (A-1 frontend UI, B-5-8 alt 테스트, 운영 항목들) — target plan 이 이 결정에 개입하지 않음.
- `merge-p2-async-fanin.md` 의 엔진 비동기 모델 선결 조건 — 무관.

미해결 결정 우회: **없음**.

---

## 선행 plan 미해소 검토

target plan 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는지 검토:

target plan 의 배경은 "현재 로그 부재" 이며 선행 구현 완료를 가정하지 않는다. 유일한 선행 조건은 기존 `sanitize` 패턴(이미 구현됨)을 유지하는 것이며, 코드에서 `sanitizeConfigEcho` 등 관련 패턴이 이미 존재함이 확인됐다. `cafe24-bg-refresh-tuning` 이 동일 날 진행 중이지만 target plan 에 선행 조건으로 명시되어 있지 않으며 파일 영역도 겹치지 않는다.

선행 plan 미해소 차단: **없음**.

---

## 후속 항목 누락 검토

target plan 의 변경이 다른 plan 의 후속 항목을 무효화하거나 새 후속을 만들어야 하는지 검토:

1. `cafe24-token-lifecycle-logs.md` §"후속" 항목에 "spec 갱신 follow-up (cron 6h, 7일 cutoff) — project-planner 위임 진행 중 (Task #13)" 이 기재되어 있다. 이 후속은 `cafe24-bg-refresh-tuning.md` 가 구현한 cron 6h + cutoff 7일 변경의 spec 정합화를 지칭하는 것으로 보인다. `cafe24-bg-refresh-tuning.md` 의 §"후속" 에도 동일하게 spec 갱신을 project-planner 위임으로 명시하고 있다. 두 plan 이 동일 후속 항목을 각각 별도 언급하고 있으나 둘 다 "project-planner 위임"으로 처리하고 있어 중복 추적이 발생한다. 어느 plan 이 이 후속을 실제로 추적하는지 명확하지 않을 수 있다.
2. target plan 의 신규 로그 항목 자체는 spec 변경을 유발하지 않으며 (신규 spec / 식별자 없음을 명시), 다른 plan 의 후속 항목을 무효화하지 않는다.

후속 항목 누락 경고: **낮음**. cron 6h / cutoff 7일 spec 갱신 후속이 두 plan 에 걸쳐 중복 기재된 점만 추적 혼란 가능성 있음.

---

## worktree 충돌 검토

| plan | worktree | 변경 대상 파일 |
|---|---|---|
| `cafe24-token-lifecycle-logs.md` (target) | `cafe24-token-lifecycle-logs-196308` | `cafe24-api.client.ts` |
| `cafe24-bg-refresh-tuning.md` | `cafe24-bg-refresh-tuning-fb72d5` | `integration-expiry-scanner.service.ts`, `cafe24-token-refresh.constants.ts` |
| `cafe24-restricted-scopes-followups.md` | TBD per-item | `cafe24-api.client.ts` (markAuthFailed, 착수 전) |
| `node-output-redesign/cafe24.md` | 미할당 | `cafe24-api.client.ts` 참조만, 직접 수정 아님 |
| `cafe24-backlog-residual.md` | TBD | `integration-oauth.service.ts` 내 refreshAccessToken 테스트 |

현재 active worktree (`cafe24-bg-refresh-tuning-fb72d5`) 와 target worktree (`cafe24-token-lifecycle-logs-196308`) 는 서로 다른 파일을 수정한다. `cafe24-restricted-scopes-followups` 는 동일 파일(`cafe24-api.client.ts`)을 손댈 계획이나 아직 worktree 미할당(착수 전)이므로 동시 경합 없음.

동시 작업 worktree 충돌: **없음**.

---

## 요약

`cafe24-token-lifecycle-logs` plan 은 `cafe24-api.client.ts` 단일 파일에 로그를 추가하는 좁은 scope 의 작업이다. 현재 active 한 다른 worktree(`cafe24-bg-refresh-tuning-fb72d5`)와 파일 수준 경합이 없고, 다른 in-progress plan 들이 "결정 필요"로 남긴 항목에 개입하지 않는다. 선행 조건 미해소나 미해결 결정 우회도 없다. 유일한 주의 사항은 cron 6h / cutoff 7일 spec 갱신 후속 항목이 `cafe24-token-lifecycle-logs.md` 와 `cafe24-bg-refresh-tuning.md` 양쪽에 중복 기재된 점(추적 중복)과, 향후 `cafe24-restricted-scopes-followups` 착수 시 동일 파일의 인접 코드 영역에 대한 rebase 주의가 필요한 점이다. 모두 INFO 수준이며 구현 착수를 차단할 이유가 없다.

---

## 위험도

NONE
