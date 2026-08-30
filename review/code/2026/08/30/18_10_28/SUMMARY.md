# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 9개 reviewer 전원 결과 확보(누락 없음, forced 화이트리스트 전원 성공). 새로 발견된 두 WARNING 모두 문서 정확성 문제(코드 결함 아님)이며, 현재 시점에 실제로 트리거되는 위험 경로는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency / side_effect | `updateExecutionStatus` JSDoc 의 self-deadlock 회피 근거("현재 호출부 11곳은 전부 top-level")가 같은 파일 안의 직접 호출(11곳)만 세고, `EngineDriver` 를 경유하는 외부 호출부 9곳(`ai-turn-orchestrator.service.ts` 3곳, `button-interaction.service.ts` 2곳, `retry-turn.service.ts` 2곳, `form-interaction.service.ts` 2곳 — 실제 호출부 총 20곳)을 감사 범위에서 누락. 두 reviewer(concurrency, side_effect)가 직접 전수 대조해 현재는 그 9곳 중 어디도 이미 열린 트랜잭션 콜백 안에서 호출되지 않아 지금 당장 self-deadlock 이 트리거되는 경로는 없음을 확인했으나, "전수 대조"라는 문구가 실제보다 좁은 범위를 "확인됨"으로 오인하게 해 향후 회귀 방지 효과가 약함 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8570` (`updateExecutionStatus` JSDoc) | JSDoc 문구를 "20곳(본 파일 11 + `EngineDriver` 소비 4개 서비스의 9)은 전부 top-level" 로 정정하거나 최소 "internal 호출부만 대조" 로 범위를 좁혀 명시. 여력이 되면 9곳의 상위 호출 스택에 열린 트랜잭션이 없는지도 확인해 실제 전수 대조로 채울 것 |
| 2 | documentation | 이번 diff 로 신규 커밋된 리뷰 산출물 `plan_coherence.md` 에 sub-agent 반환 프로토콜 헤더(`STATUS=...` 줄과 `===REPORT_MARKDOWN_BELOW===` 구분자)가 보고서 본문 1~2행에 그대로 섞여 있음 — 실제 제목(`# Plan 정합성 검토 — ...`)은 3번째 줄부터 시작. 같은 세션의 형제 산출물 4개와 SUMMARY.md 는 모두 정상 | `review/consistency/2026/08/30/17_49_59/plan_coherence.md:1-2` | 1-2행 두 줄(`STATUS=...`, `===REPORT_MARKDOWN_BELOW===`)을 제거하고 `#` 제목으로 시작하도록 정정. 재발 방지로 orchestrator/summary 집계 시 output_file 선두에 이 패턴이 남아있는지 가벼운 검사 추가 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 검증 중 1회(전체 6회 실행 중), 신규 테스트 2건 + 무관한 기존 테스트 1건이 동시에 `Resolved to value: false` 로 실패 — 이후 5회 재실행(캐시 클리어 포함)에서는 재현되지 않음. 코드 로직상 실패할 경로가 없어(예외를 삼키는 catch 없음, 직접 재확인) 병렬 리뷰 세션 간 ts-jest 캐시 경합 등 harness 잡음 가능성이 가장 높음. 코드 결함 단정 근거 없음 | `execution-engine.service.spec.ts:4812`, `:4780`, `:6069` | 조치 불요. 향후 단독 실행이 아닌 상황에서 유사 간헐 실패가 반복되면 이번 기록을 근거로 harness 잡음이라 단정하지 말고 재조사 |
| 2 | concurrency / database / side_effect | else 분기가 매 상태 전이마다 신규 DB 트랜잭션(BEGIN/COMMIT)을 열어 hot path choke point 의 커넥션 풀 점유 시간이 늘어남 — 이전 라운드(`17_36_15`)가 이미 "의도된 트레이드오프, 조치 불요"로 처분, 이번 라운드는 재확인만 | `execution-engine.service.ts:8698-8734` | 조치 불요. 커넥션 풀이 작은 배포 환경이면 이 choke point 의 처리량을 모니터링에 포함 권장 |
| 3 | database / side_effect | self-deadlock 방지가 런타임 가드 없이 JSDoc 문서 규약에만 의존 — 위반해도 컴파일/런타임 어느 쪽도 막지 못함 | `execution-engine.service.ts:8565-8570` | 필수 아님. 재발 방지를 원하면 `AsyncLocalStorage` 로 "현재 트랜잭션 콜백 안" 여부를 런타임에 감지해 개발 환경에서만 assert 하는 저비용 가드 고려 |
| 4 | requirement / side_effect | else 분기에서 `execution.status = newStatus` 대입이 `dataSource.transaction` 오픈보다 먼저 실행 — 트랜잭션이 shape 위반으로 롤백돼도 호출자가 쥔 in-memory `execution.status` 는 이미 새 값으로 오염된 채 예외가 올라감. diff 이전부터 있던 기존 동작이며 이전 라운드가 이미 "조치 불요"로 처분, DB 상태 자체는 롤백으로 정확히 보존됨 | `execution-engine.service.ts:8677` (else 분기, `dataSource.transaction` 호출 이전) | 조치 불요(기존 처분 유지). 필요 시 후속으로 `execution.status` 대입을 트랜잭션 콜백 안, UPDATE 성공 확인 이후로 이동 가능 |
| 5 | scope | 이번 diff 목적(else 분기 트랜잭션화)과 무관한 stale 체크박스("backend 전역 raw-query 소비 지점 감사")가 같은 커밋에 동반 완료 처리 — 직전 라운드(`17_36_15` scope)에서 이미 지적·수용된 동일 항목, 커밋 메시지가 사유를 투명하게 설명 | `plan/in-progress/backend-lint-gate-broken-on-main.md:1300` | 추가 조치 불요(이미 수용됨). 다음엔 별도 커밋으로 가른다는 이전 개선 약속의 실제 이행 여부만 추적 |
| 6 | maintainability | `updateExecutionStatus` 함수가 여전히 169줄 — 이전 라운드가 "W2 헬퍼 추출로 완화됨"이라 처분했으나 실측하면 `finishStatusTransition` 추출은 중복(drift 위험) 제거가 목적이었지 길이 축소 목적이 아니어서(168→169줄, 오히려 소폭 증가) 그 처분 근거는 길이 축에서는 성립하지 않음. 다만 실질 위험은 낮음(과거 버그 설명 이력 주석이 길이의 상당 부분, 순환 복잡도 자체는 얕음) | `execution-engine.service.ts:8573-8741` | 급하지 않음. 다음 손질 기회에 `linkedNodeExec`/else 두 트랜잭션 본문을 각각 private 메서드로 추출해 dispatcher 화. 이전 처분 근거 재인용 시 "무엇을 줄였는지" 축 구분 |
| 7 | maintainability | 신규 회귀 테스트 2건이 준비 코드(`svcAny` 캐스팅 + 정규식 필터링)를 거의 동일하게 반복 | `execution-engine.service.spec.ts:4812-4864` | 급하지 않음. `getTxUpdateCalls(mockTxManagerQuery)` 같은 로컬 헬퍼로 추출 가능 |
| 8 | testing | `finishStatusTransition` 추출에 대한 전용 단위 테스트는 없으나 기존 WARNING #9 회귀 테스트들이 양쪽 분기에서 이미 그 행동을 고정하고 있어 실질 커버리지 갭 아님 | `execution-engine.service.ts:8757` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | Critical/Warning 신규 없음. `updateExecutionStatus` else 분기 트랜잭션화가 의도(무기한 대기 창 폐쇄)를 정확히 충족함을 뮤테이션 검증으로 확인. spec 문서(§1.1, data-flow §2.1)와 코드 line-level 일치 |
| testing | LOW | 456/456 GREEN 재확인. 간헐적 1회 테스트 실패 관측(재현 안 됨, harness 잡음 추정) |
| concurrency | LOW | self-deadlock JSDoc "11곳 전수 대조" 문구가 실제 20곳 중 11곳만 반영(WARNING). 현재 트리거 경로는 없음 확인 |
| database | NONE | 트랜잭션 사용 적절·SQL 인젝션 벡터 없음·커넥션 관리 정상. 전부 INFO 수준 트레이드오프 |
| documentation | LOW | 대부분 이전 라운드 지적사항이 정확히 해소됐음을 확인. 신규: `plan_coherence.md` 프로토콜 헤더 오염(WARNING) |
| scope | NONE | 29개 파일 diff 전부 단일 의도 체인에 수렴. stale 체크박스 1건은 기 처분된 재확인 |
| security | NONE | 8개 관점 전수 대조, 신규 취약점 없음. 파라미터 바인딩 유지, static enum 상수만 보간 |
| side_effect | LOW | concurrency 와 동일한 JSDoc 완전성 WARNING을 독립적으로 재확인. 나머지는 기존 처분 재확인 |
| maintainability | LOW | 새 유지보수성 결함 없음. 함수 길이 관련 이전 처분 근거가 실측 기준 다소 부정확했다는 점만 지적 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상(INFO 포함)의 관찰을 보고했다. Critical/Warning 이 전혀 없는 순수 NONE 판정: requirement, database, scope, security.

## 권장 조치사항

1. `updateExecutionStatus` JSDoc 의 self-deadlock 감사 범위 서술을 실제 호출부 20곳(internal 11 + `EngineDriver` 경유 9) 기준으로 정정하거나 "internal 만 대조"로 범위를 명시한다 (concurrency WARNING 1, side_effect WARNING 1 — 동일 항목).
2. `review/consistency/2026/08/30/17_49_59/plan_coherence.md` 선두 2행에 남은 sub-agent 프로토콜 헤더(`STATUS=...`, `===REPORT_MARKDOWN_BELOW===`)를 제거하고 `#` 제목으로 시작하도록 고친다 (documentation WARNING 1).
3. (선택, 급하지 않음) `EngineDriver` 경유 9개 호출부의 상위 호출 스택에 열린 트랜잭션이 없는지 마저 확인해 self-deadlock 감사를 실제 전수로 채운다.
4. (선택, 급하지 않음) 다음 `updateExecutionStatus` 손질 기회에 두 트랜잭션 분기를 private 메서드로 추출해 함수를 얇은 dispatcher 로 만든다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, concurrency, database, documentation, scope, security, side_effect, maintainability` (9명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, concurrency, database` (9명 전원, forced 화이트리스트 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 제외된 reviewer 없음 |
