# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 범위: `cafe24-call-401-retry`
Target: `plan/in-progress/cafe24-call-401-retry.md` + `plan/in-progress/spec-update-cafe24-call-401-retry.md`

> **참고**: Target 문서 섹션이 `(없음)` 으로 전달됨. 구현 착수 전 상태로, 실제 코드 변경은 아직 없다. Plan 문서와 관련 spec 의 기존 Rationale 을 대조하여 계획된 구현 방향의 정합성을 분석한다.

---

### 발견사항

- **[INFO]** `call()` 의 401 retry 를 `withIntegrationLock` 내부에서 수행하는 구조적 위치 명시 필요
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §코드 항목 "executeWithRateLimit 401 분기를 새 helper tryRefreshAndRetry(또는 inline) 로 교체"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" + `cafe24-api.client.ts` JSDoc "잠금 의미: `withIntegrationLock` 은 task 단위 promise-chain 직렬화이며, task 내부에서 호출하는 ensureFreshToken/refreshAccessToken/rawPing 은 락을 다시 잡지 않는다"
  - 상세: `call()` 은 `withIntegrationLock` 내부에서 `executeWithRateLimit` 를 호출한다. `pingConnection()` 의 JSDoc 은 lock 재진입 부재를 명시하고 있으며, 제안하는 401 retry 패턴이 동일하게 lock 내부에서 `refreshViaQueue(waitUntilFinished)` 를 호출하게 된다. BullMQ worker 는 별도 프로세스이므로 Promise-chain lock 의 교착 위험은 없지만, plan 문서에 이 안전성 근거가 명시되어 있지 않다. 구현자가 `pingConnection` 의 lock 경계와 `call()` 의 lock 경계 차이를 오해해 retry 경로에 별도 `withIntegrationLock` 을 추가하거나 lock 없이 직접 호출하는 실수를 할 수 있다.
  - 제안: plan 의 코드 항목에 "retry 는 이미 `withIntegrationLock` 내부에서 실행되므로 별도 lock 재진입 불필요 — `pingConnection` JSDoc 의 '락을 다시 잡지 않는다' 와 동일 패턴" 을 명시적으로 기재. 실제 구현 시 `executeWithRateLimit` 시그니처에 `triedAuthRetry: boolean` 인자를 추가하는 방식(plan 에 언급됨) 이 lock 범위를 벗어나지 않으므로 적합.

- **[INFO]** Spec §10.5 에 401 자동 회복 정책이 아직 반영되어 있지 않은 상태로 구현 착수
  - target 위치: `plan/in-progress/spec-update-cafe24-call-401-retry.md` "머지 의존성 — 본 spec 갱신은 코드 PR 머지 후 착수"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §10.5` 현행 본문은 "Refresh token 보유 시 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출" 만 명시. 401 수신 후 재시도 경로는 기재 없음.
  - 상세: `developer` skill 은 spec 을 read-only 로 취급하고 구현 후 `project-planner` 가 spec 을 갱신하는 의도적 순서다. plan 이 이 의존성을 명시하고 있어 절차는 정합하다. 다만 구현 기간 동안 spec §10.5 와 실제 동작이 불일치하는 상태가 지속되므로, 향후 consistency-check 에서 `spec vs 구현 불일치` 경고가 발생할 수 있다.
  - 제안: 코드 PR 과 spec 갱신 PR 사이의 시간 간격을 최소화하고, `spec-update-cafe24-call-401-retry.md` 의 위임 노트가 plan/in-progress 에 남아있는 동안 `spec/2-navigation/4-integration.md §10.5` 에 `<!-- TODO: cafe24-401-refresh-a3f2c1 PR 머지 후 401 회복 정책 명문화 예정 -->` 형태의 in-spec 마커를 추가하는 방안 고려.

- **[INFO]** `403` 분기의 `markAuthFailed` 동작 보전 의도가 spec 에 미반영
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §비목표 "403 분기 동작 변경"
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` 본문 "응답이 401/403 이면 다음을 동시에 수행 (Spec MCP Client §8.4 와 동일 정책)" — 현재 spec 이 401/403 을 동일 분기로 기술하지만, 실제 구현은 이미 `pingConnection` (403 시 status 격하 안 함) 과 `executeWithRateLimit` (403 시 markAuthFailed 즉시) 이 다른 정책을 가진다.
  - 상세: plan 이 "403 분기는 기존 그대로 (insufficient_scope/auth_failed markAuthFailed + throw). 변경 금지" 를 명시하고 있어 의도는 명확하다. 그러나 `spec/4-nodes/4-integration/4-cafe24.md` 의 표현이 두 분기의 차이를 기술하지 않아, 미래 구현자가 `pingConnection` 의 403 정책을 `call()` 에도 적용하는 혼동이 생길 수 있다.
  - 제안: `spec-update-cafe24-call-401-retry.md` 의 spec 갱신 제안에 "403 은 `call()` 경로에서 여전히 즉시 `markAuthFailed` — `pingConnection()` 의 403 비격하 정책과 의도적으로 다름 (노드 실행 중 scope 오류는 사용자 즉시 신호 필요)" 를 §10.5 갱신 본문에 함께 기재하도록 위임 노트 보강.

---

### 요약

이번 검토 대상(`cafe24-call-401-retry`)은 구현 코드가 없는 `--impl-prep` 단계이며, 핵심 분석 대상은 plan 이 기존 Rationale 의 결정들을 위반하거나 기각된 대안을 재도입하는지 여부다. 분석 결과 plan 이 제안하는 방향(BullMQ `refreshViaQueue` 경유 1회 재시도, 403 분기 불변, `pingConnection` 과 정책 통일)은 기존 Rationale 의 핵심 결정 — BullMQ dedup 직렬화(PostgreSQL advisory lock/Redis redlock/in-memory mutex 기각), 1회 재시도 상한(무한 retry 기각), 401과 403의 분리 처리 — 과 모두 정합하다. 기각된 대안의 재도입이나 invariant 직접 위반은 발견되지 않는다. 세 건의 INFO 는 구현 시 혼동 방지를 위한 lock 경계 명시, spec-코드 불일치 기간 관리, 403 분기 정책 이중화 기술 보강에 관한 제안으로, 구현 착수를 차단할 CRITICAL 또는 WARNING 이슈는 없다.

### 위험도

NONE
