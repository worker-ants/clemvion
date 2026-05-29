# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
검토 일시: 2026-05-29
대상 변경셋: worktree `workflow-resumable-phase3-a4ea4a` vs origin/main

## 검토 범위

변경된 파일:
- `spec/5-system/4-execution-engine.md` — §7.5.1 구현 상태 갱신 + §9.3 DLQ 모니터링 신설
- `plan/in-progress/workflow-resumable-execution.md` — Phase 3 / 변경 2.3 완료 기록
- `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` — 변경 2.3 완료 처리
- `codebase/backend/**` — `InvalidExecutionStateError` 도입, 4개 WS handler, REST controller, interaction.service, DlqMonitorService, onFailed processor

---

## 발견사항

### [INFO] sentinel 잔존 범위의 spec 명시 적절
- target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 갱신 note
- 과거 결정 출처: `4-execution-engine.md ## Rationale "Durable Continuation (2026-05-24)"` — "항상 BullMQ enqueue" 원칙, "키 없음 → DB 재구성(§7.5 rehydration)" 연장
- 상세: spec §7.5.1 의 구현 상태 note 가 `__no_node_exec__` sentinel 을 "cancel 류(nodeExecutionId 부재) 및 deploy 전 enqueue 된 legacy job 호환을 위해 worker 측에만 잔존"으로 명시했다. 이는 기존 Rationale 의 "항상 publish" 원칙(publisher 에서 직접 resolve 금지)과 정합한다 — publisher 에서 sentinel 을 제거하고 worker 측에만 남겨 publisher/worker 경계를 유지. 충돌 없음.
- 제안: 해당 worker-only 잔존 sentinel 이 언제까지 유지될지 (legacy job 호환의 만료 조건 등)를 Rationale 에 짧게 기록해두면 미래 제거 시점에 근거 없이 삭제하는 상황을 방지할 수 있다.

### [INFO] DLQ 모니터 설계 — "별도 메트릭 SDK 미사용" 선택의 Rationale 보완 가능
- target 위치: `spec/5-system/4-execution-engine.md` §9.3 "Dead-letter 모니터링 (Phase 3.1)"
- 과거 결정 출처: 동일 문서 §4.4 / §Rationale "Durable Continuation" — BullMQ 채택 근거로 "DLQ 까지 BullMQ 내장"을 명시
- 상세: `ContinuationDlqMonitorService` 가 "별도 메트릭 SDK 미사용 — 현 backend 는 OTel traces-only"라고 명시하는 것은 설계 선택이 충분히 문서화된 수준이다. 기존 Rationale 에서 DLQ 알람 구현 방식을 특정하지 않았으므로 기각된 대안을 재도입하거나 원칙을 위반하는 사항이 없다.
- 제안: spec §9.3 에 왜 polling 방식(push/event 기반이 아닌)을 선택했는지 한 줄 근거 추가를 검토할 수 있다 — "큐 events API 는 job 이 `failed` 상태로 전이된 후 emit 이 누락될 수 있어 polling 이 더 안정적" 같은 수준이면 충분.

### [INFO] EIA 진입점 에러코드 `STATE_MISMATCH` — 기존 코드 체계와의 정합 확인 권장
- target 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `dispatchContinuation` + spec §7.5.1 갱신 note
- 과거 결정 출처: `4-execution-engine.md ## Rationale "Phase 2 cont 후속 정리 (2026-05-25)" §2` — WS `INVALID_EXECUTION_STATE` vs REST `INVALID_STATE` 분리 결정. `spec/5-system/3-error-handling.md` 가 오류 코드 vocabulary SoT
- 상세: Phase 2 cont Rationale 은 WS(`INVALID_EXECUTION_STATE`)·REST(`INVALID_STATE`) 두 layer 이름 분리를 명시 기각/채택으로 문서화했다. 그런데 이번 변경에서 EIA 외부 진입점은 409 `STATE_MISMATCH` 라는 세 번째 코드를 추가했다. 이 분기는 spec §7.5.1 갱신 note 에 간략히 언급되어 있으나, Rationale "Phase 2 cont 후속 정리 §2"가 WS/REST 두 layer 만을 다루고 EIA 세 번째 layer 를 다루지 않은 채로 남아 있다. `STATE_MISMATCH` 가 `3-error-handling.md` vocabulary 에 정의되어 있는지도 확인이 필요하다.
- 제안: `4-execution-engine.md ## Rationale "Phase 2 cont 후속 정리 §2"` 또는 §7.5.1 본문에 "EIA 진입점은 기존 `assertWaiting` 409 코드체계와 통일하여 `STATE_MISMATCH`를 사용한다 — WS/REST 두 layer 의 이름 분리와는 별개로, EIA 는 자체 HTTP 응답 vocabulary 를 따른다"는 한 줄 설명을 Rationale 에 추가하면 세 코드가 왜 다른지 명확해진다. `3-error-handling.md` 에 `STATE_MISMATCH` 등재 여부도 확인 권장.

---

## 요약

이번 변경셋(Phase 3.1 DLQ 모니터 + 변경 2.3 `INVALID_EXECUTION_STATE` 동기 surface)은 `## Rationale "Durable Continuation (2026-05-24)"` 에서 확립된 설계 원칙("항상 BullMQ enqueue", "publisher 에서 직접 resolve 금지", "키 없음 → rehydration 경로")을 일관되게 구현하며, `"Phase 2 cont 후속 정리 §2"` 에서 기각된 대안(sentinel 반환 → 비동기 worker surface)을 채택된 대안(동기 throw)으로 정확히 대체하고 있다. 기각된 대안의 재도입이나 합의된 invariant 우회는 발견되지 않았다. 다만 EIA 세 번째 에러 코드 `STATE_MISMATCH` 의 선택 근거가 기존 Rationale 문서에 명시되어 있지 않아 INFO 수준의 Rationale 보완이 권장된다.

## 위험도

LOW
