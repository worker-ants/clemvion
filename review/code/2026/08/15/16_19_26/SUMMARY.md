# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. 실질 WARNING 2건 중 testing 리뷰어가 뮤테이션으로 직접 실측한 "Execution UPDATE 의 `WHERE id = :id` 절이 어떤 assertion 으로도 검증되지 않음(3개 테스트 전부 GREEN 유지)"이 가장 중요한 잔여 갭이며, maintainability 는 이번 diff 가 새로 만든 JSDoc/인라인 주석 중복(LOW) 을 지적했다. 나머지 10개 리뷰어(security/performance/architecture/requirement/scope/side_effect/documentation/database/concurrency/user_guide_sync)는 전부 NONE 또는 LOW 로, 다수가 직전 라운드(`16_04_38`) WARNING 4건이 실제로 반영됐음을 소스 대조로 재확인했다. **forced(router_safety) 화이트리스트 7명 전원 결과 확보 — 강제 이행 이슈 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `finalizeStalledExhausted` 의 Execution UPDATE `WHERE id = :id` 절이 어떤 테스트 assertion 으로도 검증되지 않음. `.where('id = :id', {...})` 값을 변조하는 뮤테이션 테스트를 직접 실행한 결과 3개 테스트 전부 GREEN 유지(생존 확인, 저장소는 원복 후 clean). 같은 함수 안에서 NodeExecution cascade UPDATE 에는 이미 이번 diff 로 `where`/`andWhere` 하드닝이 적용됐는데, Execution UPDATE 자체의 `id` 조건에는 미적용 — WHERE 절 오식별 시 엉뚱한 execution 을 마킹하거나 진짜 stalled 케이스를 조용히 no-op 시켜도 단위테스트가 못 잡음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3369` / `execution-engine.service.spec.ts` (`finalizeStalledExhausted (PR4)` describe, 게이트 4914~4976) | `RUNNING` 성공 테스트(게이트 4938 부근)에 `expect(execQb.where).toHaveBeenCalledWith('id = :id', { id: 'exec-stalled' });` 추가. 대칭성 위해 "같은 트랜잭션 manager" 테스트(게이트 4914)에도 추가 권장 |
| 2 | maintainability | JSDoc 문단과 바로 아래 함수 본문 인라인 주석이 거의 동일한 문장(약 90% 동일 문구, 4줄씩)을 반복 — 직전 라운드 WARNING("JSDoc 미갱신")을 고치며 이번 diff 가 새로 만든 중복. 자매 `cancelParkedExecution` 은 근거를 JSDoc 한 곳에만 적는데 이 함수만 두 곳에 적힌 형태로 벗어남 — 향후 한쪽만 갱신되면 두 설명이 모순될 위험 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3325-3328`(JSDoc) vs `:3348-3351`(인라인 주석) | 인라인 주석을 "자매와 동형 — 근거는 위 JSDoc 참조" 한 줄로 축약하거나 반대 방향으로 통합해 근거 서술을 한 곳에만 남긴다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 다수(architecture/requirement/maintainability/testing/documentation/database) | `finalizeStalledExhausted` 는 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 달리 함수 레벨 `try/catch` 가 없어 트랜잭션 예외를 그대로 호출자에 전파 — diff 이전부터 존재하던 비대칭(회귀 아님). 유일 호출부 `execution-run.processor.ts:88` 의 `.catch()` 가 흡수해 최종 동작은 자매와 동등. 직전 라운드에서 이미 "무조치(선택)"로 명시 처분됨 — 이번 라운드는 재확인만 | `execution-engine.service.ts:3340` (`finalizeStalledExhausted` 함수) | 조치 불요(기존 판정 유지). 이 계약을 잠그는 테스트(자매엔 있음)를 추가하면 향후 회귀 방지에 유리(선택) |
| 2 | security/testing/concurrency | 트랜잭션 롤백(진짜 원자성)은 unit mock 으로 검증되지 않음 — 실 DB 기반 e2e 트랙으로 별도 분리 예정이며 자매 함수들과 동일한 기존 관례 | `execution-engine.service.spec.ts` (`installStalledTx` 헬퍼, 테스트 자체 주석이 한계 명시) | 조치 불요(선택). 실 DB e2e 로 둘째 UPDATE 강제 실패 → 첫째 미커밋 확인 추가 시 가점 |
| 3 | architecture | 자매 3개 메서드(`cancelParkedExecution`/`markWebChatIdleTimeout`/`finalizeStalledExhausted`)에 걸친 트랜잭션 보일러플레이트 삼중화 — 재사용 헬퍼 추출 후보이나 이번 PR 은 세 번째 사례를 패턴에 맞춰 정합화한 것뿐. 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 이미 등재·의도적 defer | `execution-engine.service.ts:1023, 1152, 3340` | 조치 불요, 현행 defer 유지 |
| 4 | maintainability | `RETURNING` duration 추출 관용구가 3개 자매 함수에 손으로 복붙 — 신규 중복 아님, 기존 패턴 답습. `spec-sync-external-interaction-api-gaps.md` 에 "16곳 복붙, 별도 PR 로 defer" 근거 기 등재 | `execution-engine.service.ts` (3개 자매 함수) | 이번 PR 범위 밖, 조치 불요 |
| 5 | concurrency | `recoverStuckExecutions`(부팅 backstop) 와의 이론적 race — job stalled 소진과 부팅 스캔이 겹치는 극히 좁은 창에서 정상 재구동 중인 세그먼트를 잘못 마감할 가능성. 이번 diff 가 만든 것도, 창 크기를 바꾼 것도 아님 — JSDoc 에 "수용된 기존 노출"로 이미 명시, 완전 fencing 은 별도 defer 항목 | `execution-engine.service.ts:3331` (JSDoc) | 조치 불요, 이미 인지·문서화·defer |
| 6 | concurrency | 락 획득 순서 불일치(pre-existing) — 자매 3함수는 Execution→NodeExecution 순, `claimResumeEntry` 는 역순. 대상 상태값이 배타적이라 실질 충돌 창은 매우 좁음. 이번 diff 는 `claimResumeEntry` 를 건드리지 않았고 오히려 자매 3함수 간 순서 일관성은 개선 | `execution-engine.service.ts:1259-1301`(claimResumeEntry, 비대상) vs `:3354-3402` | 이번 PR 블로커 아님. 향후 락 순서 정리는 별도 검토 가치 |
| 7 | side_effect | 트랜잭션 도입으로 "둘째 UPDATE 실패 시 최종 관측 상태"가 부분성공(Execution만 FAILED 잔류)에서 전체 롤백(RUNNING 유지)으로 바뀜 — 원자성 수정의 목적 그 자체, 의도된 변경 | `execution-engine.service.ts:3354, 3403` | 조치 불요 |
| 8 | performance | 트랜잭션 도입으로 두 UPDATE 구간의 커넥션 보유 시간이 소폭 늘어남 — 커밋 횟수는 2→1 로 줄어 순수 처리량 관점은 중립~약간 개선, 저빈도(운영 크래시) 경로라 실질 영향 무시 가능 | `execution-engine.service.ts:3354` | 조치 불요, 원자성이 트레이드오프를 정당화 |
| 9 | documentation | 직전 라운드 documentation WARNING 3건(CHANGELOG 누락·JSDoc 미갱신·헬퍼 우회) 전부 소스 직접 대조로 반영 확인됨. "30줄 아래" 줄수-의존 주석도 코드-위치-비의존 표현으로 교체 확인. spec(`4-execution-engine.md §7.1`) 도 같은 커밋에서 동기화 확인 | `CHANGELOG.md:3-15`, `execution-engine.service.ts:3325-3330`, `execution-engine.service.spec.ts:4914-4936, 4968-4976`, `spec/5-system/4-execution-engine.md:851` | 조치 불요, 재확인만 |
| 10 | requirement | 직전 라운드 WARNING 4건 + consistency WARNING 1건 전부 이번 diff 에서 실제 반영 확인(위조·누락 없음). 신규 테스트 3건 실행 결과 GREEN, tsc 신규 타입 에러 없음을 직접 검증 | 상동 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가 표면 없음. 트랜잭션 mock 한계 INFO 1건만 |
| performance | NONE | N+1/복잡도 변화 없음. 커넥션 보유 소폭 증가 INFO 1건(무시 가능) |
| architecture | NONE | 자매 패턴과 완전 동형, 새 위반 없음. 보일러플레이트 삼중화 등 INFO 3건(모두 pre-existing/defer) |
| requirement | NONE | 기능 완전성·엣지케이스·spec fidelity 전부 충족. 직전 라운드 WARNING 4건 반영 재확인 |
| scope | NONE | 스코프 이탈 없음, 발견사항 없음 |
| side_effect | NONE | 공개 인터페이스·emit payload·시그니처 불변. 관측 상태 변화는 의도된 것 |
| maintainability | LOW | WARNING 1건 — 이번 diff 가 새로 만든 JSDoc/인라인 주석 중복 |
| testing | MEDIUM | WARNING 1건 — Execution UPDATE `WHERE id` 미검증, 뮤테이션 생존 실측 |
| documentation | NONE | 직전 라운드 WARNING 3건 전부 반영 확인, 신규 결함 없음 |
| database | LOW | 쿼리/인덱스/트랜잭션 경계 전부 견고. try/catch 비대칭 INFO(기처분) 재확인 |
| concurrency | LOW | 새 race/데드락 없음. 기존 이론적 race·락순서 불일치 INFO 2건(pre-existing) |
| user_guide_sync | NONE | doc-sync-matrix 20행 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- **scope** — "발견사항: 없음" (변경이 원자성 수정이라는 단일 목적에 정확히 결속됨을 확인)
- **user_guide_sync** — 유저 가이드/i18n/노드 스키마 트리거 매칭 0건, "해당 없음"

## 권장 조치사항

1. (WARNING #1) testing 이 뮤테이션으로 실측한 갭을 메운다 — `RUNNING` 성공 테스트에 `execQb.where` 에 대한 값 assertion(`{ id: 'exec-stalled' }`)을 추가해 Execution UPDATE 대상 오식별을 회귀 테스트로 잠근다.
2. (WARNING #2) `finalizeStalledExhausted` JSDoc 문단과 인라인 주석 중 한쪽을 축약해 근거 서술 중복을 제거한다(향후 각자 갱신되며 모순되는 것을 예방).
3. 그 외 INFO 항목은 전부 pre-existing 이거나 이미 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 defer 근거와 함께 등재돼 있어 이번 PR 범위에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (12명)
  - **제외**: 아래 표 (2명, 사유는 라우터가 별도 텍스트로 제공하지 않음)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨, 강제 이행 이슈 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(diff 에 신규/변경 의존성 없음으로 추정, 명시적 사유 텍스트 미제공) |
  | api_contract | 라우터 판단(diff 에 API/DTO/controller 변경 없음으로 추정, 명시적 사유 텍스트 미제공) |