# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `RECONCILE_TERMINAL_STATUSES` 상수 JSDoc — rename 배경 설명 충분
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` 상수 블록
- 상세: `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` rename 과 함께 JSDoc 이 확장됐다. 신규 JSDoc 은 "(SQL `IN` 절용 배열. `interaction.service.ts` 의 동명 `ReadonlySet`(`.has()` 용)과 용도·타입이 달라 파일별 private 로 분리 — 이름 충돌 회피 위해 `RECONCILE_` prefix.)" 를 명시해 rename 경위와 두 상수의 의미론적 차이를 모두 기술한다. 이전 리뷰(16_17_36)의 동명 상수 중복 지적(naming_collision W-3)에 대한 명확한 fix 이며 문서화 수준이 양호하다.
- 제안: 없음.

### [INFO] `system-status.constants.ts` — 신규 큐 등록 인라인 문서화 충분
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` `MONITORED_QUEUES` 배열 신규 항목
- 상세: `{ name: TERMINAL_REVOKE_RECONCILE_QUEUE, group: 'system', concurrency: 1 }` 항목이 추가됐다. 기존 항목들과 형식이 동일하며 상수 이름 자체(`TERMINAL_REVOKE_RECONCILE_QUEUE`)가 역할을 충분히 표현한다. 파일 상단에 이미 "큐 추가 시 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 목록도 갱신하라" 주석이 있는 것으로 이전 리뷰 산출물에서 확인됐으며, 이번 변경에서 e2e 목록도 동기화됐다.
- 제안: 없음.

### [INFO] `system-status.e2e-spec.ts` — 큐 이름 추가만이므로 추가 문서화 불요
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 배열
- 상세: `'terminal-revoke-reconcile'` 문자열 한 줄 추가. 이 테스트 파일이 "등록된 큐 이름과 기대 목록이 정확히 일치하는지" 를 검증하는 목적임이 파일 구조상 자명하므로 추가 주석 없이도 의도가 명확하다.
- 제안: 없음.

### [INFO] spec 파일 변경 — 부팅 정책 Rationale 추가 (문서화 양호)
- 위치: `spec/5-system/14-external-interaction-api.md` R15 절 내 신규 단락
- 상세: "부팅 정책" 단락이 신설됐다. `onModuleInit` fail-fast vs 런타임 reconcile fail-open 의 비대칭을 명문화하고 login-history-pruner 선례를 인용해 결정 근거를 기술한다. 이전 consistency-check(16_43_08 rationale_continuity.md INFO)에서 제안된 내용이 반영된 것으로 확인된다. 또한 `MONITORED_QUEUES` 등재 사실을 명시해 운영 가시성 측면도 기술된 점이 양호하다.
- 제안: 없음.

### [INFO] `spec/data-flow/0-overview.md` BullMQ 큐 카탈로그 갱신 — 문서화 완전
- 위치: `spec/data-flow/0-overview.md` 큐 카운트 업데이트 및 §4 카탈로그 신규 행
- 상세: 큐 수를 15→16으로 업데이트하고 `terminal-revoke-reconcile` 큐 행이 카탈로그에 추가됐다. 행에 등록 모듈, Producer/Consumer, 스케줄 패턴(`* * * * *`), concurrency, 작업 단위, spec 교차 링크(`[EIA §3.4 EIA-RL-06 / §9.3 R15](../5-system/14-external-interaction-api.md)`)가 모두 기재되어 기존 행들과 정보 밀도가 일치한다. 이전 consistency-check(16_43_08 naming_collision WARNING)에서 지적된 카탈로그 미등재 문제가 해소됐다.
- 제안: 없음.

## 요약

이번 변경 세트의 문서화 수준은 전반적으로 우수하다. 소스 코드 변경(상수 rename, 큐 등록, e2e 목록 추가) 모두 이전 리뷰(16_17_36)와 consistency-check(16_43_08)에서 지적된 문서화 갭을 충실히 해소했다. 특히 `RECONCILE_TERMINAL_STATUSES` rename 과 함께 추가된 JSDoc 이 naming collision 해소 경위를 명확히 설명하고, spec R15 의 부팅 정책 단락이 fail-fast/fail-open 비대칭을 공식화했으며, BullMQ 큐 카탈로그가 완전히 동기화됐다. 새로 추가된 상수·등록·테스트 항목에 추가적으로 개선이 필요한 문서화 갭은 발견되지 않는다.

## 위험도

NONE
