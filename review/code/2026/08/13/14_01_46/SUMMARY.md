# Code Review 통합 보고서

## 전체 위험도
**LOW** — 대부분 테스트 보강(LRU 캐시 경계값, 로그 레벨 분기, admission fail-closed 회귀)이며, 신규 프로덕션 코드는 `Array.isArray` fail-closed 가드 1건과 상수 `export` 전환 1건뿐. Critical 없음, WARNING 3건(트랜잭션 커밋 경계 변경 1건, 테스트 fixture 중복 1건, 주석 stale 1건)은 모두 즉시 위험이 아닌 견고성/추적성 개선 항목. forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `Array.isArray(rows)` fail-closed 분기가 이전에는 `TypeError` 전파 → 트랜잭션 자동 롤백이던 것을, `logger.warn` + 정상 반환(`return false`)으로 바꿔 콜백이 예외 없이 완료되게 한다. `rows` 가 배열이 아닌데도 실제 UPDATE 가 행을 갱신했다면(pg 드라이버 계약 위반 시에만 가능) 그 변경이 **커밋된 채로** 애플리케이션은 `admitted=false`(defer) 로 처리 — 예외=항상 롤백이라는 기존 불변식이 이 분기에서만 깨진다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2926-2932` | 도달 가능성이 극히 낮다는 전제를 명시 문서화("이 분기는 롤백을 보장하지 않음")하거나, 안전을 위해 `return false` 대신 예외를 재던져 기존 롤백-보장 불변식을 유지하는 방안 고려 |
| 2 | maintainability | 신규 `buildDispatcherForNull()` 이 기존 `buildDispatcher()` 와 setup(어댑터 shape, `listenerRegistry`, `triggerRepository.findOne` 고정 fixture, 생성자 호출)을 ~80% 문자 그대로 중복. `ChatChannelDispatcher` 생성자 시그니처나 fixture shape 변경 시 두 곳을 함께 고쳐야 하며 한쪽만 고치는 패턴이 이 프로젝트에서 반복 관측됨 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:715` (신규) vs `:822` (기존) | `buildDispatcher()` 를 옵션 인자로 확장하거나 공통 fixture 를 모듈 상단 헬퍼로 추출해 재사용 |
| 3 | documentation | `admitExecutionOrDefer` 의 `'deferred'` 반환 의미를 설명하는 함수 docstring·`(d)` 분기 인라인 주석·호출부 주석 3곳이 이번 diff 로 새로 생긴 두 번째 `deferred` 경로(non-array 방어적 fail-closed)를 반영하지 못해 stale. 가드 자체 인라인 주석(2922행)만 정확하고, 세 요약 지점은 여전히 "cap 초과" 만 서술 — 운영 디버깅 시 원인 추적이 어려움 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (docstring ~2852-2869, `(d)` 분기 ~2949-2950, 호출부 `runExecutionFromQueue` 부근 ~3662-3664) | 세 지점의 `'deferred'` 서술에 "cap 초과 또는 admission UPDATE 결과가 배열 아님(방어적 fail-closed)" 를 추가. 특히 함수 docstring 우선 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / testing / documentation | `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `const` → `export const` 로 가시성 확대(값 불변, 테스트 전용 목적). 자매 상수 `MAX_EXECUTION_PATH_ROWS` 는 export 이유를 주석으로 명시하는데 이 상수는 없어 문서화 패턴이 갈림. 현재 소비처는 정의부·내부 사용·신규 테스트뿐이라 실질 위험은 낮음 | `codebase/backend/src/modules/executions/executions.service.ts:63` | JSDoc 에 "테스트에서 상한 값·LRU 경계 회귀를 고정하기 위해 export" 한 줄 추가(선택) |
| 2 | maintainability / testing | 신규 admission 가드 테스트에서 `warnSpy.mockRestore()` 는 `finally` 로 보호되지만 `emitSpy`(`spy`) 의 `mockRestore()` 는 `try` 블록 끝에만 있어 단언 실패 시 스킵됨. `beforeEach` 로 매 테스트 인스턴스 재생성되어 실질 오염 위험은 낮고 파일 내 기존 관례와도 동일 | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4491-4520` | 두 spy 모두 같은 `finally` 로 통일(선택, 강제 아님) |
| 3 | maintainability | `dispatcher as unknown as { handle: ... }` 인라인 타입 캐스트가 파일 내 4곳(이번 diff 로 2곳 추가)에 반복 | `chat-channel.dispatcher.spec.ts:774, 802 (신규), 898, 916 (기존)` | 로컬 타입 별칭(`type DispatcherWithHandle`)으로 통합 |
| 4 | testing | `admitExecutionOrDefer` non-array fail-closed 테스트가 인접 테스트와 달리 `executionRunQueue.add`(delayed 재큐) 호출을 단언하지 않음 — 재큐 배선 자체는 인접 테스트가 이미 커버해 실질 갭은 아님 | `execution-engine.service.spec.ts:4491` | 자기완결성을 위해 `mockExecutionRunQueue.add` 단언 추가 고려(선택) |
| 5 | scope | ③번(Array.isArray 가드) 완료 메모가 관련 체크리스트 항목 바로 아래가 아니라 문서 맨 끝에 붙어, ①번(snapshotCache evict) 완료 메모와 배치 패턴이 다름 | `plan/in-progress/backend-lint-gate-broken-on-main.md:1098-1111` (완료 메모) vs `:1072` (체크리스트 항목) | 완료 메모를 체크박스 바로 아래로 이동(선택) |
| 6 | documentation | plan 문서의 두 번째 "완료" 주석 삽입부에 빈 줄이 2줄 연속 — 첫 번째 완료 주석의 빈 줄 1줄 관례와 다름 | `plan/in-progress/backend-lint-gate-broken-on-main.md` (`@@ -1079,3 +1095,17 @@` 훅 부근) | 빈 줄 1개로 정리(선택) |
| 7 | documentation | `Array.isArray` fail-closed 가드가 크래시→명시적 defer 로 바꾸는 동작 변경이지만 CHANGELOG 항목 없음. 실제 관측된 결함이 아닌 순수 방어 코드라 필수는 아님 | `CHANGELOG.md` (미등재), 코드: `execution-engine.service.ts:2926-2932` | 선택 — 필요 시 한 줄 추가 |
| 8 | side_effect | 신규 테스트가 `Logger.prototype.debug`/`warn` 을 전역 patch — 모두 `try/finally` 로 복원 보장, Jest 파일별 격리로 교차 오염 위험 낮음 | `chat-channel.dispatcher.spec.ts:769-770, 797-798`, `execution-engine.service.spec.ts:4492` | 현행 유지 가능. `it.concurrent` 전환 시 이 패턴이 깨질 수 있음을 인지 |
| 9 | requirement | `snapshotCache` 상한·dispatcher 로그 레벨 분기는 spec 문서에 별도 요구사항으로 명시돼 있지 않음 — 순수 내부 성능/운영 세부사항이라 spec 문서화 대상은 아니라고 판단. 관련 원자성 로직 자체는 `spec/5-system/4-execution-engine.md` 에 이미 문서화돼 있고 이번 diff 는 이를 훼손하지 않음 | `executions.service.ts` (`SNAPSHOT_CACHE_MAX_ENTRIES` 선언부, `reconcilePreParkWaitingStatus`) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·입력검증 등 전 관점 이상 없음. `Array.isArray` 가드는 오히려 견고성 강화 방향 |
| requirement | NONE | 3개 백로그 항목(로그 레벨 분기, LRU 상한/방향, admission fail-closed) 모두 line-level 로 소스와 정합 확인. plan 체크박스 갱신도 실제 변경과 일치 |
| scope | NONE | diff 전체가 커밋 메시지가 명시한 3개 백로그 항목과 1:1 대응. 불필요한 리팩토링/무관 파일 변경 없음. 완료 메모 배치 nit 만 INFO |
| side_effect | LOW | admission fail-closed 가드가 트랜잭션 롤백 불변식을 특정 분기에서 깨는 잠재적 상태 다이버전스 (WARNING). 나머지는 export 확대·전역 spy 패치 등 INFO |
| maintainability | LOW | 신규 테스트 fixture(`buildDispatcherForNull`)가 기존 빌더와 대폭 중복 (WARNING). 타입 캐스트 반복·spy 복원 비일관성은 INFO |
| testing | NONE | 신규 테스트 3세트 모두 실제 조건/로그 문구/캐시 키 규약과 정확히 일치, 방향성 있는 단언(양방향 로그 레벨, LRU evict 방향) 확인. 사소한 커버리지 완결성 아이템만 INFO |
| documentation | LOW | `admitExecutionOrDefer` 의 `'deferred'` 반환 설명 3곳이 새 방어적 경로를 반영 못해 stale (WARNING). export 문서화 비대칭·plan 서식·CHANGELOG 판단은 INFO |

## 발견 없는 에이전트

security, requirement, scope, testing — CRITICAL/WARNING 없음(INFO 또는 전무).

## 권장 조치사항

1. `execution-engine.service.ts` 의 `admitExecutionOrDefer` docstring/인라인/호출부 주석 3곳에 non-array 방어 경로("cap 초과 **또는** admission 결과 shape 이상")를 반영해 stale 주석을 해소한다 (documentation WARNING).
2. `Array.isArray(rows)` fail-closed 분기가 트랜잭션 롤백 불변식을 깨는 트레이드오프를 코드 주석에 명시하거나, 안전이 우선이면 `return false` 대신 예외 재던짐으로 기존 롤백-보장을 유지하는 방향을 검토한다 (side_effect WARNING).
3. `chat-channel.dispatcher.spec.ts` 의 `buildDispatcherForNull()` 을 기존 `buildDispatcher()` 재사용/공통 헬퍼 추출로 리팩토링해 fixture 이중 유지보수 표면을 줄인다 (maintainability WARNING).
4. (선택) INFO 항목 중 export 문서화 비대칭, spy `finally` 통일, 타입 캐스트 별칭화, plan 문서 서식/배치 정리는 우선순위가 낮으므로 후속 정리 시점에 일괄 처리해도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (테스트 추가 + 소품 가드, 성능 영향 없음) |
  | architecture | router 판단상 이번 diff 와 무관 (구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관 (의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관 (스키마/쿼리 구조 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 (공개 API 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 문서 대상 아님) |

---

> 조치 내역·유예 근거는 같은 디렉터리의 [`RESOLUTION.md`](./RESOLUTION.md).
