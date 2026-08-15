# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/신규 회귀 없음. `finalizeCancelledExecution` guarded UPDATE 반환값 확인, retry-turn CANCELLED 재진입 `RETURNING` 되읽기, REST `durationMs` 추가 세 결함이 정확히 닫혔고 문서·테스트·spec 동기화도 확인됨. 남은 항목은 유지보수성 캐비엇 1건(WARNING)과 테스트 커버리지 갭 1건(WARNING)뿐. forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `finalizeFailedExecution` 옆 "형제와 동일한 guarded 경로" 주석이 이번 PR로 표면적 참(둘 다 반환값을 읽는다)이 됐지만, `!persisted` 이후 처리의 실제 비대칭(자매는 무조건 skip, `finalizeCancelledExecution`은 재조회 후 조건부 emit — 극성 반대)에 대한 캐비엇이 `finalizeCancelledExecution` 쪽에만 있고 `finalizeFailedExecution` 쪽엔 없음. 이 저장소는 정확히 이 문구를 원인으로 같은 결함 클래스를 이미 세 번 CRITICAL로 겪었다고 스스로 기록 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4990-4992` (대응 신규 JSDoc: `:4869-4879`) | `finalizeFailedExecution:4990-4992` 주석에 한 줄 캐비엇 추가 — "단, `!persisted` 이후 처리는 극성이 반대다(자매는 재조회 후 조건부 emit, 이쪽은 무조건 skip) — 이 함수를 본떠 새 guarded-path 를 만들 때 무조건 skip 을 기본으로 가정하지 말 것" |
| 2 | testing | `durationMs` 필드가 §5.4 "null 부재 표현" 규약을 문서상 따른다고 명시하면서도, 정확히 그 규약을 검증하는 기존 OpenAPI 스키마 회귀 가드(`result`/`error`를 `it.each`로 고정하는 describe)에는 등재되지 않음 — 향후 `nullable` 옵션 누락·`required` 오변경 회귀를 못 잡음 | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:122-128` (신규 필드: `execution-status-response.dto.ts:130`) | `it.each([['result'], ['error']])` → `it.each([['result'], ['error'], ['durationMs']])`로 확장하거나, `durationMs`의 `type`(`integer`)·`nullable`(`true`)을 별도로 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | REST 신규 필드 `durationMs`는 단순 숫자값이라 별도 마스킹 불요, 기존 인가 경로 그대로 상속 | `execution-status-response.dto.ts:116-130` | 조치 불요 |
| 2 | security | 신규 `logger.warn`은 서버 로그 전용, 사용자 조작 불가 값만 포함해 로그 인젝션 우려 없음 | `execution-engine.service.ts:4919-4923` | 조치 불요 |
| 3 | performance | `finalizeCancelledExecution` 0행 분기 추가 DB 왕복(`findOneBy`)은 레이스 한정·1회성, N+1 아님 | `execution-engine.service.ts:4915` | 조치 불요 |
| 4 | performance | retry-turn `.returning()` 추가는 같은 SQL 문 내 처리라 별도 왕복 없음 | `retry-turn.service.ts:656` | 조치 불요 |
| 5 | performance | `interaction.service.ts` `durationMs` projection 추가는 단건 조회에 컬럼 하나 추가일 뿐 | `interaction.service.ts:78, 434` | 조치 불요 |
| 6 | requirement | ①guarded UPDATE 0행의 두 극성(정상 stop vs 다른 종결자 선점) 정확히 구분 확인 | `execution-engine.service.ts:4869-4929` | 조치 불요 |
| 7 | requirement | ②`.returning()` 되읽기 값이 `resolveTerminalDurationMs` 경유 wire까지 정확히 전달됨을 호출 체인 끝까지 추적 확인 | `retry-turn.service.ts:641-676` → `failRetryExecution:950-1003` | 조치 불요 |
| 8 | requirement | ③REST `durationMs`는 재계산이 아닌 영속 컬럼 그대로 실음, `?? null`로 0 경계값도 보존 | `interaction.service.ts:438` | 조치 불요 |
| 9 | requirement | spec(`14-external-interaction-api.md` EIA-IN-04, §5.3, §6.5) + `node-cancellation.md` §2.4가 구현과 line-level 일치 | `spec/5-system/14-external-interaction-api.md:77,485-488,816-824`; `spec/conventions/node-cancellation.md:198,209-217` | 조치 불요 |
| 10 | scope | `toPersistedDate` 신규 헬퍼는 plan 원 항목 밖이지만 직전 라운드 WARNING에 대한 명시적 opt-in 응답이며 plan에 근거 기록됨 | `codebase/backend/src/shared/utils/terminal-duration.ts` | 조치 불요 |
| 11 | scope | `review/**` 23개 산출물은 강제 게이트(impl-prep consistency-check, ai-review, RESOLUTION)의 정규 증빙, 임의 문서 아님 | `review/code/2026/08/15/13_58_27/**`, `review/consistency/2026/08/15/13_43_10/**` | 조치 불요 |
| 12 | scope | RESOLUTION.md가 주장한 "8건 조치"가 diff와 1:1 대응함을 전수 대조 확인 | 다수 위치 (RESOLUTION.md 참조) | 조치 불요 |
| 13 | side_effect | `finalizeCancelledExecution` emit 조건이 "무조건"→"DB 재확인 후 조건부"로 바뀜(의도된 관측 가능 동작 변경), CHANGELOG·plan에 고지됨 | `execution-engine.service.ts:4899-4934` | 조치 불요 |
| 14 | side_effect | `finalizeGuarded` CANCELLED 분기가 `execution` 파라미터를 in-place mutate — 호출 체인 추적 결과 다른 곳 전파 없음 확인 | `retry-turn.service.ts:658-674` | 조치 불요 |
| 15 | maintainability | `finalizeGuarded` CANCELLED 분기 중첩 4단·mock 팩토리 중복은 이전 라운드 지적·plan에 명시적으로 defer됨 | `retry-turn.service.ts:641-676`; `retry-turn.service.spec.ts:79-87,1319-1338` | 조치 불요(범위 밖) |
| 16 | maintainability | `returningSpy`가 실사용(단일 `it`)보다 훨씬 넓은 `describe` 최상단 스코프에 선언됨 | `retry-turn.service.spec.ts:922` (사용: `:1318,1325,1367`) | `it` 블록 내부로 지역화 (사소, 비긴급) |
| 17 | testing | `finalizeCancelledExecution` 1행 매칭(정상 경로) 직접 명명 테스트 부재, 기존 W15가 간접 확인 | `execution-engine.service.spec.ts:1072-1126` | 여유 있으면 추가 (비긴급) |
| 18 | documentation | CHANGELOG.md 신규 줄이 REST 경로를 `GET /executions/:id`로 축약, 바로 옆/spec/controller는 전체 경로 사용 | `CHANGELOG.md:17` | `GET /api/external/executions/:id`로 통일 (선택적) |
| 19 | database | guarded UPDATE는 단일 SQL 문 내 조건부 갱신+RETURNING이라 TOCTOU 창 없음, 파라미터 바인딩 일관 | `execution-engine.service.ts` `updateExecutionStatus` | 조치 불요 |
| 20 | database | `status IN (...)` SQL 삽입값은 enum 파생 상수, 외부 입력 경로 없음 | `execution-engine.service.ts` `NON_TERMINAL_STATUSES_SQL` | 조치 불요 |
| 21 | concurrency | 0행-fallback 재조회는 `CANCELLED`/`COMPLETED` sink 불변식에 기대어 안전 — 단 `FAILED→RUNNING` retry 재진입 경로에서 emit은 여전히 정확히 skip되나 로그 문구가 "종결자 선점"으로 부정확할 수 있음 | `execution-engine.service.ts:4899-4929` | 조치 불요(오발행 없음), 로그 문구 정확도 개선은 저우선 |
| 22 | concurrency | (a) 분기(`live.status===CANCELLED`) 이중 발행 이론적 가능성은 diff 이전부터 있던 기존 노출면, 이번 diff의 회귀 아님 | `execution-engine.service.ts:4918-4930` | 조치 불요(회귀 아님) |
| 23 | api_contract | EIA-IN-04 필드 목록에 `durationMs` 동기화 — 직전 라운드 WARNING 해소 확인 | `spec/5-system/14-external-interaction-api.md:77` | 조치 불요 |
| 24 | api_contract | `execution.cancelled` push 이벤트가 특정 레이스에서 미발행되는 동작 변경은 계약상 정합화이며 문서화됨 | `execution-engine.service.ts:4899-4930` | (선택) EIA spec webhook 신뢰성 절에도 동일 사실 한 줄 추가 |
| 25 | api_contract | `durationMs` 의미가 종결 경로별로 다름(실행시간 vs 대기시간) — DTO/Swagger/spec 세 곳 일관 문서화, 직전 PR(#1171)이 세운 계약의 확장 | `execution-status-response.dto.ts:116-122`; `spec/5-system/14-external-interaction-api.md:485-488` | 조치 불요(참고, 추후 필드 분리 논의 가능) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가/암호화/의존성 전부 이상 없음, INFO 2건 |
| performance | NONE | 추가 DB 왕복 전부 레이스 한정·1회성, N+1 없음 |
| requirement | NONE | ①②③ 세 결함 모두 정확히 닫힘, spec-코드 line-level 일치 |
| scope | NONE | 39개 파일 전량 plan 항목·게이트 산출물로 설명됨, drive-by 없음 |
| side_effect | LOW | emit 조건 변경 + in-place mutation 둘 다 의도됐고 문서화·추적 확인 |
| maintainability | LOW | 자매 함수 주석 편도 캐비엇(WARNING), 구조적 항목은 defer 확인 |
| testing | LOW | OpenAPI 스키마 회귀 가드에 `durationMs` 미등재(WARNING), 나머지는 강점 다수 |
| documentation | NONE | 직전 라운드 WARNING 2건 해소 확인, CHANGELOG 경로 표기 사소 불일치만 |
| database | NONE | 스키마/마이그레이션 변경 없음, 원자적 SQL로 TOCTOU/인젝션 표면 없음 |
| concurrency | LOW | sink 불변식 기반 안전성 확인, FAILED 재진입 경로 로그 문구만 부정확 가능 |
| api_contract | LOW | additive/nullable 필드, 직전 WARNING 해소, breaking change 없음 |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 보고).

## 권장 조치사항
1. `execution-engine.service.ts:4990-4992` (`finalizeFailedExecution` 주석)에 극성 반대 캐비엇 한 줄 추가 — 이 저장소가 동일 결함 클래스로 이미 세 번 CRITICAL을 겪었다는 점에서 재발 표면을 줄이는 저비용 조치 (WARNING #1).
2. `execution-status-response.dto.spec.ts`의 §5.4 null 부재 표현 회귀 가드 `it.each`에 `durationMs` 추가 (WARNING #2).
3. (선택, 비긴급) `CHANGELOG.md:17` REST 경로 표기를 전체 경로로 통일, `returningSpy` 스코프 지역화, `finalizeCancelledExecution` 1행 매칭 케이스 직접 테스트 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff에 해당 관점 실질 표면 없음 |
  | dependency | 신규 외부 의존성 추가 없음 |
  | user_guide_sync | 사용자 가이드(mdx) 변경은 documentation/scope에서 이미 대칭성 확인됨 |