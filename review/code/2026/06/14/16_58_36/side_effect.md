# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 상수 이름 변경 (`TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES`) — 명명 충돌 해소
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L52
- 상세: 직전 리뷰(16_17_36)의 W3(부작용)에서 "reconcile() swept 로그 제거 후 token service 로그 존재 여부 diff 에서 미확인" 이 제기되었고, consistency 리뷰(16_28_07)에서는 `TERMINAL_STATUSES` 상수명이 같은 `external-interaction/` 폴더 내 `interaction.service.ts`의 `ReadonlySet`과 동명 충돌을 일으킨다는 WARNING이 발견되었다. 이번 변경은 해당 상수를 `RECONCILE_TERMINAL_STATUSES`로 rename해 충돌을 해소했다. 두 상수는 파일별 private 스코프(non-export)이므로 런타임 충돌은 애초에 없었으나, 동명이 같은 폴더 내 두 파일에 병존하면 향후 terminal 상태 목록 변경 시 한쪽만 갱신되는 drift 위험이 있었다. rename은 그 위험을 제거한다.
- 제안: 현행 유지. rename으로 명명 분리가 완료됐다.

### [INFO] 상수 JSDoc 업데이트 — 용도·타입 분리 명시
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L38–41
- 상세: 새 JSDoc이 "(SQL `IN` 절용 배열. `interaction.service.ts` 의 동명 `ReadonlySet`(`.has()` 용)과 용도·타입이 달라 파일별 private 로 분리 — 이름 충돌 회피 위해 `RECONCILE_` prefix.)" 를 명시한다. 유지보수자가 두 상수의 차이를 인식하도록 문서화한 것으로 의도된 부작용이다.
- 제안: 없음.

### [INFO] `system-status.constants.ts` — `TERMINAL_REVOKE_RECONCILE_QUEUE` 임포트·`MONITORED_QUEUES` 등록
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L10, L75–78
- 상세: consistency 리뷰(16_43_08)의 naming_collision WARNING이 "system-status.constants.ts의 MONITORED_QUEUES에 TERMINAL_REVOKE_RECONCILE_QUEUE 미등록"을 지적했고 이번 변경에서 수정했다. `TERMINAL_REVOKE_RECONCILE_QUEUE`를 `terminal-revoke-reconciler.service`에서 임포트하고 `MONITORED_QUEUES` 배열에 `{ name, group: 'system', concurrency: 1 }` 항목을 추가했다. 이로 인해 시스템 상태 모니터링 화면이 이 큐를 인식하게 된다. 이 변경은 의도된 부작용이며 누락 시 모니터링 갭이 발생하는 이전 상태의 수정이다. 임포트가 서비스 구현 파일 전체를 참조하는 구조는 유지되나(architecture 리뷰 INFO), 이는 이번 diff 의 신규 도입이 아니다.
- 제안: 없음.

### [INFO] `system-status.e2e-spec.ts` — `EXPECTED_QUEUE_NAMES`에 `'terminal-revoke-reconcile'` 추가
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` L37
- 상세: e2e 스펙의 큐 이름 목록이 MONITORED_QUEUES와 동기화되었다. 이 목록은 시스템 상태 API 응답의 큐 이름 집합을 검증하는 데 사용된다. 추가 전에는 e2e 테스트가 실패하거나 새 큐를 검증하지 못했을 것이며, 이번 추가로 회귀 보호가 강화된다.
- 제안: 없음.

### [INFO] `interaction-token.service.ts` 쿼리 파라미터 바인딩 — 상수 rename 반영
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L375
- 상세: `.where('e.status IN (:...terminal)', { terminal: RECONCILE_TERMINAL_STATUSES })` 로 변경됐다. 파라미터 값 자체(`[COMPLETED, FAILED, CANCELLED]`)는 동일하므로 DB 동작에 변화 없음. 이름 변경만이 반영된 안전한 rename이다.
- 제안: 없음.

## 요약

이번 변경 세트는 직전 fresh 리뷰(16_17_36)의 W3 후속 검증 및 consistency 리뷰(16_43_08) WARNING 항목을 수정한 것으로, 부작용 관점의 변경은 모두 의도된 것이다. `TERMINAL_STATUSES`를 `RECONCILE_TERMINAL_STATUSES`로 rename하여 동일 폴더 내 `interaction.service.ts`의 동명 `ReadonlySet`과의 충돌·drift 위험을 제거했고, `MONITORED_QUEUES`와 e2e `EXPECTED_QUEUE_NAMES`에 `terminal-revoke-reconcile` 큐를 등록해 모니터링 갭을 닫았다. 전역 변수 도입 없음, 예상치 못한 파일시스템 작업 없음, 외부 네트워크 호출 도입 없음, 공개 API/시그니처 변경 없음. 모든 변경이 명시적으로 의도된 수정이며 의도하지 않은 부작용은 발견되지 않는다.

## 위험도

NONE
