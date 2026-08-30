# Code Review 통합 보고서

## 전체 위험도
**LOW** — `updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction` 으로 감싸 shape-위반 throw 시 실제 롤백을 보장한 변경. Critical 0건. 9개 reviewer 전원이 결과를 확보했고(forced 화이트리스트 7종 + 라우터 추가 2종 전원 success, 결과 누락 없음), Critical 은 어느 reviewer 에서도 발견되지 않았다. WARNING 2건(CHANGELOG 미갱신, 두 분기 epilogue 코드 중복)과 SPEC-DRIFT 1건(spec 원자성 보장 문단이 이번 트랜잭션화를 반영 안 함)이 실질 조치 대상이며, 코드 동작 자체의 결함은 발견되지 않았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 이 저장소의 확립된 관례(유사 급 수정마다 CHANGELOG 에 dated addendum 을 남김)를 이번 커밋만 어겼다 — `CHANGELOG.md` 의 "`UPDATE … RETURNING` 결과를 8곳이 행 배열로 오인했다" 섹션(항목 5, `updateExecutionStatus`)에 후속 정정을 붙이기 좋은 자리인데 미갱신 | `CHANGELOG.md`(미포함); `plan/in-progress/backend-lint-gate-broken-on-main.md:1308`, `plan/in-progress/update-returning-tuple-shape.md:238` | 해당 섹션 끝에 "② updateExecutionStatus 트랜잭션화 완료(2026-08-30)" 소급 정정 블록 추가. 두 plan 파일 체크리스트에도 "CHANGELOG 반영" 항목을 별도로 명시 |
| 2 | Maintainability | `updateExecutionStatus` 의 두 분기(`linkedNodeExec`/else)가 이번 diff 로 대칭이 되며 트랜잭션 epilogue(세그먼트 기록+메트릭 발행+return, 4줄)를 손으로 복제. 이 파일 자체가 "형제 분기 drift" 결함을 여러 차례 겪은 이력(WARNING #9 주석 참조)이 있어, 다음에 epilogue 로직이 바뀔 때 한쪽만 고칠 위험이 구조적으로 존재 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8647-8652`(linkedNodeExec), `:8728-8733`(else, 신설) | `lockNonTerminalExecutionRow`/`recordRunningSegmentStart` 처럼 기존 관례를 따라 트랜잭션 실행+epilogue 를 감싸는 private 헬퍼로 추출해 두 분기가 공유하도록 정리 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 의 "원자성 보장" 문단이 이번에 추가된 else 분기 트랜잭션 래핑을 반영하지 않는다 — `linkedNodeExec`(짝 전이) 분기와 §7.5 재개 claim 의 트랜잭션 보장만 명시하고, else 분기(RUNNING/COMPLETED/FAILED/CANCELLED 직접 마감)의 guarded UPDATE 가 트랜잭션 안에서 도는지는 언급 없음. 또한 2026-08-30 소급 각주는 `8332d9a20`(throw 도입)만 서술하고 "DB 는 안 깨졌다"로 마무리하는데, 실제로는 그 throw 가 트랜잭션 밖 단발이라 롤백을 부르지 못해 이번 커밋(`1a12088f2`) 전까지 무기한 대기 창이 있었다는 사실이 각주에 없다. 코드는 명백히 옳고(형제 분기와 패턴 일치, 회귀 테스트 2건 + 뮤테이션 실측), spec 이 뒤처진 SPEC-DRIFT 사례 | `spec/5-system/4-execution-engine.md:98`(원자성 보장 인용 블록), `:51-58`(2026-08-30 소급 각주) | 코드는 유지. `project-planner` 경로로 (1) §1.1 원자성 보장 문단에 "else 분기 guarded UPDATE 도 트랜잭션 안에서 실행되어 shape 위반 throw 시 UPDATE 자체가 롤백된다" 문장 추가, (2) 소급 각주에 "이 throw-기반 수정 자체는 롤백을 보장하지 못해 `8332d9a20`~`1a12088f2` 사이 무기한 대기 창이 있었고 `1a12088f2` 가 트랜잭션 래핑으로 닫았다"는 후속 각주 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Database / Side Effect | else 분기가 단발 autocommit UPDATE 에서 명시 트랜잭션(BEGIN+UPDATE+COMMIT)으로 바뀌어 라운드트립·커넥션 풀 점유 시간이 늘어난다. 이 함수는 실행 상태 전이의 단일 choke point라 hot path | `execution-engine.service.ts:8691-8727` | 의도된 트레이드오프(롤백 보장이 목적)로 조치 불필요. 커넥션 풀이 작은 환경이면 부하 테스트/모니터링에 커넥션 풀 사용률 포함 권장 |
| 2 | Concurrency | `updateExecutionStatus` 가 내부에서 새 트랜잭션을 여는데, 이미 열린 트랜잭션 콜백 안에서 호출되면 self-deadlock 가능 — 현재 호출부 11곳 전수 대조 결과 해당 케이스 없음(트리거되지 않음), 향후 회귀 방지용 문서화 권장 | `execution-engine.service.ts:8566`(함수 시그니처/JSDoc) | JSDoc 에 "호출자는 자신의 트랜잭션 콜백 밖(top-level)에서 호출해야 한다" 한 줄 경고 추가 |
| 3 | Testing / Documentation | 신규 테스트 이름 "…UPDATE 가 롤백된다"가 mock 경계(트랜잭션 경유+throw 전파 확인)보다 넓게 읽힐 수 있다 — 실제 DB ROLLBACK 자체는 TypeORM 계약에 위임하는 부분이며 unit 테스트로 증명 불가. 바로 위 JSDoc 은 스코프를 정확히 좁혀 뒀으나 테스트 `it()` 명은 결론형으로 과대 표현 | `execution-engine.service.spec.ts:4806` | 테스트 이름을 "…트랜잭션 manager 경유 + throw 전파(롤백 전제조건)"처럼 스코프에 맞게 좁히거나 mock 경계 caveat 추가 |
| 4 | Testing | 이 특정 shape-위반→롤백 경로를 실 Postgres 로 재현하는 e2e/integration 테스트가 없음(드라이버 mock 이 필요해 구조적으로 어려움) — 문서화되지 않으면 "이미 e2e 급 검증됨"으로 오인될 수 있음 | `codebase/backend/test/`(해당 테스트 부재) | plan 문서에 "실 DB ROLLBACK 은 TypeORM 계약에 의존하며 이 PR 은 mock 경계까지만 검증했다" caveat 한 줄 추가 |
| 5 | Testing | 신규 테스트 2건이 내용과 무관한 기존 `describe` 블록(`admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)`)에 배치돼 있어 가독성 저하 누적(이번 diff 가 새로 만든 문제는 아니고 기존 패턴 계승) | `execution-engine.service.spec.ts:4491` | 급하지 않음. 다음 손질 시 `updateExecutionStatus` 전용 하위 `describe` 로 분리 권장 |
| 6 | Testing | `execution.status = newStatus` 대입이 트랜잭션 시작 **전에** 무조건 실행됨(기존 코드, 이번 diff 의 회귀 아님) — throw 시 인자로 받은 `execution` 객체가 이미 `status` 오염된 채로 예외가 올라감. 호출자가 catch 후 이 stale 값을 쓰는지 검증하는 테스트 없음 | `execution-engine.service.ts:8670` | 필수 아님. shape 위반은 드라이버 버그급 이벤트로 실제 발생 가능성 낮음. 원하면 reject 후 `execution.status` 상태를 문서화/테스트 |
| 7 | Requirement | `8332d9a20`(2026-08-13, throw 도입)~`1a12088f2`(2026-08-30, 트랜잭션 래핑) 약 17일간, else 분기 shape 위반 시 "커밋된 UPDATE + 미발행 종결 이벤트 + stuck recovery 미포착" 창이 이론상 열려 있었음(실제 트리거 여부 불명, 방어적 가드라 정상 운영에서 거의 미발생) | 커밋 이력, `plan/in-progress/backend-lint-gate-broken-on-main.md`(`18_19_33` INFO 9) | 코드 조치 불필요. 필요시 해당 기간 운영 로그에서 실제 트리거 여부만 확인 |
| 8 | Scope | 이 작업과 무관한 다른 stale 체크박스("전역 raw-query 소비 지점 감사")도 같은 diff/커밋에서 함께 완료 처리됨. 커밋 메시지가 사유를 투명하게 설명해 실질 위험은 낮음 | `plan/in-progress/backend-lint-gate-broken-on-main.md:1295` | 문제 삼지 않아도 됨. 향후 유사 상황에서는 무관한 plan 그루밍을 별도 커밋으로 분리하는 편이 diff 최소성에 부합 |
| 9 | Maintainability | `updateExecutionStatus` 함수가 이번 diff 로 더 길어짐(현재 약 168줄) — 두 분기 모두 "트랜잭션 열기→내부 로직→epilogue" 대칭 구조가 되며 단일 함수의 책임이 계속 누적 | `execution-engine.service.ts:8566-8734` | WARNING #2 의 헬퍼 추출과 함께 처리하면 자연히 완화됨. 즉시 조치 불필요 |
| 10 | Maintainability | 테스트 mock 의 `/UPDATE execution/` 정규식 매칭이 파일 전역 22곳에 산재(이번 diff 는 기존 관용구를 따른 것으로 신규 중복 아님) — SQL prefix 변경 시 22곳 전수 grep 필요 | `execution-engine.service.spec.ts:289, 4831, 4855` | 이번 diff 범위 밖. 공유 상수(`UPDATE_EXECUTION_SQL_RE`) 도입은 별도 작업으로 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | SPEC-DRIFT(원자성 보장 문단 미반영) + 17일 노출 창 INFO. 코드 자체는 형제 분기와 패턴 일치, 회귀 테스트·뮤테이션 실측 확인 |
| testing | LOW | 뮤테이션 검증(트랜잭션 제거·throw 삼킴 뮤턴트)으로 신규 테스트 2건이 비어있지 않음 확인, 456/456 회귀 없음. 테스트 이름 과대주장·e2e 부재·describe 배치 등 INFO 4건 |
| concurrency | LOW | 커넥션 풀 점유 증가, 중첩 트랜잭션 self-deadlock 잠재 위험(현재 미트리거) — 둘 다 INFO |
| database | NONE | 트랜잭션 래핑이 정합성 결함(고아 terminal 상태)을 정확히 고침. SQL 인젝션 없음 확인, 라운드트립 증가만 INFO |
| documentation | LOW | CHANGELOG 미갱신 WARNING, spec_impact 파일 미갱신(SPEC-DRIFT 와 동일 지점) + 테스트 제목 과대주장 INFO |
| scope | NONE | 리뷰 대상 4개 파일 전부 단일 의도(트랜잭션화)에 수렴, 스코프 이탈 없음. 무관 체크박스 동반 INFO 1건 |
| security | NONE | SQL 인젝션·시크릿·인증/인가·입력검증·암호화·의존성 전 항목 이상 없음. 오히려 에러 처리(롤백 보장) 개선으로 판정 |
| side_effect | LOW | 전역/환경/API 시그니처 변경 없음, 중첩 트랜잭션 전수 대조로 self-deadlock 미확인. 커넥션 풀 리소스 사용 패턴 변화만 INFO |
| maintainability | LOW | 두 분기 epilogue 코드 중복 WARNING(구조적 drift 위험), 함수 길이 증가·regex 산재는 INFO |

## 발견 없는 에이전트

문자 그대로 "발견 0건"인 에이전트는 없음(전원 최소 INFO 이상 기록). 다만 **실질 결함이 전혀 없다고 명시적으로 결론 낸 에이전트**는 `security`(취약점 0, 오히려 개선으로 판정)와 `scope`(스코프 이탈 없음) — 둘 다 위험도 NONE, 동반된 INFO 는 확인용 기록일 뿐 조치 대상 아님.

## 권장 조치사항

1. **[WARNING]** `updateExecutionStatus` 의 `linkedNodeExec`/else 두 분기가 공유하는 트랜잭션 epilogue(4줄, 세그먼트 기록+메트릭 발행+return)를 private 헬퍼로 추출해 형제 분기 drift 재발을 구조적으로 차단 (`execution-engine.service.ts:8647-8652`, `:8728-8733`).
2. **[WARNING]** `CHANGELOG.md` 의 "`UPDATE … RETURNING` 결과 오인" 섹션(항목 5)에 이번 트랜잭션화 완료(②) 소급 정정 addendum 추가 — 이 저장소가 스스로 세운 관례 준수.
3. **[SPEC-DRIFT]** `project-planner` 경로로 `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 문단 + 2026-08-30 소급 각주를 이번 트랜잭션 래핑과 그 이전 무기한 대기 창 사실을 반영하도록 갱신.
4. (선택, 저비용) 신규 테스트 2건의 `it()` 명을 JSDoc 이 이미 명시한 mock 경계(트랜잭션 경유+throw 전파)에 맞게 좁히고, `updateExecutionStatus` JSDoc 에 "트랜잭션 콜백 밖에서만 호출" 경고를 추가해 향후 중첩-트랜잭션 회귀를 예방.

## 라우터 결정

- **실행**: `requirement, testing, concurrency, database, documentation, scope, security, side_effect, maintainability` (9명, 전원 success)
- **제외**: 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |

- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 화이트리스트 전원 결과 확보됨(누락 없음). 라우팅 근거는 `routing=fallback-distrusted-decision`(router 결정을 신뢰하지 않고 강제 화이트리스트 + 추가로 `concurrency`, `database` 도 함께 실행됨) — 결과적으로 후보 9종 전원이 실행·성공했다.