# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 기능 결함은 발견되지 않았으며(모든 reviewer 가 코드 자체는 spec/fail-open 요구와 일치한다고 확인), WARNING 3건은 전부 "문서/테스트 완성도가 코드 변경을 완전히 따라잡지 못함" 성격(클래스 docstring stale, CHANGELOG 누락, 형제 테스트 대비 얕은 단언)이다. router forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Side-effect | payload 손상 방어의 "에러 재현 분기(409)" 테스트가 형제 테스트(:559)보다 단언이 얕다 — `discardCorruptEntry` 호출을 증명하는 `warnSpy`(`cache payload 손상` 메시지) 및 `redis.set` 재적재 단언이 빠져 있어, 테스트 이름의 "같은 방어를 받는다" 주장을 스스로 증명하지 못한다. 동시에 `Logger.prototype.warn` 을 mock 하지 않아 테스트 실행 중 실제 로그가 콘솔로 샌다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:629` | `warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 추가 후 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache payload 손상'))` 와 `expect(redis.set).toHaveBeenCalledTimes(1)` 을 형제 테스트(:559)와 동형으로 부여 |
| 2 | Documentation | 클래스 docstring 의 "fail-open 은 세 경로에 걸린다"(생성자 null·GET 실패·SET 실패) 목록이 이번 diff 가 신설한 두 경로(엔트리 손상·payload 손상, `discardCorruptEntry` 경유)를 반영하지 않는다. 기존에 이미 누락돼 있던 "직렬화 실패" 경로까지 합치면 실제로는 5경로인데 문서는 3경로라고 말해 개수·항목이 모두 어긋난다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:62-64` | "다섯 경로(생성자 null·GET 실패·SET 실패·직렬화 실패·캐시 엔트리/payload 손상)" 로 갱신하거나, `discardCorruptEntry()`/`storeEntry()` 자체 JSDoc 을 가리키는 참조로 전환 |
| 3 | Documentation | 이 인터셉터를 고친 직전 3개 커밋(캐시 키 스코프, §R8 409/410, Redis 런타임 fail-open)은 모두 `CHANGELOG.md` 에 `## Unreleased` 항목을 남겼는데, 이번 client-observable 동작 변화(손상된 `responseJson` 캐시 엔트리 발견 시 종전 500 → 지금 fail-open+warn)는 CHANGELOG 에 반영되지 않았다. | `CHANGELOG.md` (신규 항목 없음, 비교: `CHANGELOG.md:3`, `:34`, `:62`) | 같은 톤으로 `## Unreleased — 캐시 엔트리 내부 responseJson 손상 시 500 대신 fail-open` 섹션 추가(증상·원인·클라이언트 영향·파싱 순서 계약화 이유 포함) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 손상 캐시 처리 시 원본 예외 메시지를 로그에 그대로 삽입(이론적 log-injection). Redis 직접 쓰기 권한이라는 높은 전제가 필요해 실효 위험 낮음, 이 파일 기존 관례의 확장일 뿐 | `idempotency.interceptor.ts:207-209` 등 | 조치 불요(원한다면 구조화 로깅으로 전환) |
| 2 | Security | `JSON.parse` 결과에 런타임 스키마 검증 없이 캐스팅(`as IdempotencyEntry` 등). 이 서비스 자신이 쓴 Redis 값만 읽으므로 신뢰 경계 미확장 | `idempotency.interceptor.ts:147,171,183` | 조치 불요, 필요 시 바깥 JSON 포함 전체를 별도 후속으로 |
| 3 | Security | 안쪽 payload 파싱 실패가 이제 500 마스킹 대신 fail-open 처리됨 — 보안 관점에서 정보 노출 표면 축소(개선) | `idempotency.interceptor.ts:145-174` | 없음 |
| 4 | Requirement | 신규 방어 로직·테스트가 spec §R8/EIA-RL-02 의 fail-open 요구와 line-level 일치 확인, 33개 테스트 GREEN, `tsc` 무오류 | `idempotency.interceptor.ts:145-174, 202-211` | 없음 |
| 5 | Requirement | `bodyHash` 판정을 payload 파싱보다 먼저 두는 순서가 코드 주석·회귀 테스트(순서 캐너리)·plan 기록 세 곳에서 일관 | `idempotency.interceptor.ts:152-174`, `spec.ts:596-627` | 없음 |
| 6 | Requirement | 에러(409 재현)/성공 두 채널 모두 payload 손상 방어가 적용됨을 자매 테스트로 확인 | `spec.ts:629-653` | 없음 |
| 7 | Requirement | `discardCorruptEntry<T>` 반환 타입이 두 호출부와 일치, `switchMap` 콜백 전 분기가 값/예외 반환(누락 경로 없음); `what` 파라미터가 리터럴 유니온이라 임의 문자열 차단 | `idempotency.interceptor.ts:143-190, 202-211` | 없음 |
| 8 | Requirement | plan 체크박스·완료 기록(`backend-lint-gate-broken-on-main.md`)이 실제 커밋(`22e68459d`) 변경 내용과 부합, 과장/미이행 없음 | `plan/in-progress/backend-lint-gate-broken-on-main.md:619-631` | 없음 |
| 9 | Scope | 바깥(엔트리) JSON 손상 경로에도 이번에 warn 이 신규로 추가됨 — PR 표제("내부 responseJson 손상")보다 한 칸 넓은 변경이나, 같은 파일 내 명시적 근거 기록 있고 클래스의 다른 3개 fail-open 경로와의 일관성 목적이라 결함 클래스가 동일함 | `idempotency.interceptor.ts:149` | 향후 plan 항목 제목을 "손상 처리 전체"로 넓게 적어 재확인 비용 절감 |
| 10 | Side-effect(긍정적) | `res.status()` 호출이 payload 파싱 성공 이후로 이동해, 파싱 실패 시 응답 객체의 부분 mutate 가 사라짐(개선) | `idempotency.interceptor.ts` (`res.status(cached.statusCode)` 호출 지점) | 없음 |
| 11 | Maintainability | `discardCorruptEntry` 공유 docstring 이 두 호출부의 "종전 동작" 차이(엔트리=조용히 무시 vs payload=방어 없는 파싱이 그대로 500 으로 새어나감)를 뭉개 표현 | `idempotency.interceptor.ts:194-201` | 두 시나리오를 분리 서술하거나 "조용히"를 "가시성 없이"로 완화 |
| 12 | Maintainability / Testing / Documentation | 테스트 파일의 모듈·블록 docstring(`:11-13`, `:236-243`)이 이번에 추가된 4건 테스트(엔트리/payload 손상 warn, bodyHash 순서 캐너리, 에러채널 자매)를 반영하지 않음 | `idempotency.interceptor.spec.ts:11-13, 236-243` | 블록 docstring 에 신규 서브케이스 1~2문장 보강 |
| 13 | Maintainability | `discardCorruptEntry<T>` 제네릭이 현재 단일 구체 타입(`Observable<unknown>`)에만 쓰임 — 잘못된 코드는 아님 | `idempotency.interceptor.ts:202-206` | 조치 불요, 세 번째 호출부 생기면 재평가 |
| 14 | Testing | payload 손상 신규 2건 테스트가 재적재된 캐시 값 내용을 깊이 단언하지 않음(기존 엔트리-손상 테스트만큼 촘촘하지 않음). 공유 코드 경로라 실질 위험은 낮음 | `spec.ts:559, 629` | 여유 있으면 `:559` 에 `stored.bodyHash`/`stored.statusCode` 값 단언 추가(낮은 우선순위) |
| 15 | Concurrency | GET→SET 비원자성(TOCTOU)에 의한 멱등성 best-effort 특성 — 이번 diff 이전부터 클래스 docstring 이 명시한 accepted trade-off, 이번 변경으로 확대/축소되지 않음 | `idempotency.interceptor.ts:68-73` | 조치 불요(범위 밖). 향후 강한 멱등성 필요 시 `SET NX` 기반 claim-then-execute 검토 |
| 16 | Concurrency | `catchError`→`switchMap` 순서가 유지되어 캐시 충돌(409/410) 예외가 GET 실패 fail-open 에 삼켜지지 않음을 기존 캐너리 테스트로 재확인. `discardCorruptEntry` 신설/파싱 순서 재배치는 전 분기 동기적이라 새 경쟁 조건 없음 | `idempotency.interceptor.ts:131-137, 143-190, 202-211` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 손상 캐시/payload 처리 경로에 새 취약점 없음, 500→fail-open 이 오히려 정보 노출 감소 |
| requirement | NONE | 신규 방어·순서 계약이 spec §R8/fail-open 요구·테스트와 완전 일치 확인 |
| scope | NONE | 엔트리 손상 경로에도 warn 확장된 점 외 범위 이탈 없음(문서화된 근거 있음) |
| side_effect | LOW | 테스트 2곳 warn mock 누락으로 로그 노이즈, res.status() mutate 시점 개선(긍정적) |
| maintainability | LOW | discardCorruptEntry 공유 docstring 이 두 호출부 차이를 뭉갬, 테스트 docstring 미갱신 |
| testing | LOW | 에러 재현 분기 테스트 단언 부족(WARNING), 문서·저장값 단언 깊이 사소한 비대칭 |
| documentation | MEDIUM | 클래스 docstring "세 경로" stale, CHANGELOG.md Unreleased 항목 누락 |
| concurrency | LOW | 신규 경쟁 조건 없음, 기존 TOCTOU trade-off 그대로 유지 |

## 발견 없는 에이전트

없음 — forced 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 및 concurrency 전원이 INFO 이상 발견사항을 최소 1건 이상 제출함(security/requirement/scope 는 위험도 NONE 이나 INFO 관찰 기록 있음).

## 권장 조치사항
1. (WARNING #1) `idempotency.interceptor.spec.ts:629` 에 `warnSpy`(`cache payload 손상` 메시지 확인)와 `redis.set` 호출 단언을 형제 테스트(`:559`)와 동형으로 추가 — 테스트 자체 주장("같은 방어를 받는다")을 독립적으로 증명하고 로그 노이즈도 동시에 제거.
2. (WARNING #2) 클래스 docstring 의 "fail-open 세 경로" 목록을 실제 5경로(생성자 null·GET·SET·직렬화·엔트리/payload 손상)로 갱신.
3. (WARNING #3) `CHANGELOG.md` 에 이번 fix 의 `## Unreleased` 항목 추가 — 같은 인터셉터의 직전 3개 커밋과 일관된 관례 유지.
4. (INFO, 선택) 테스트 파일 모듈/블록 docstring 에 신규 4건 테스트 요약 1~2문장 보강, `discardCorruptEntry` 자체 docstring 의 "종전 동작" 서술을 엔트리/payload 두 케이스로 분리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(범위 밖으로 제외) |
  | architecture | router 판단(범위 밖으로 제외) |
  | dependency | router 판단(범위 밖으로 제외) |
  | database | router 판단(범위 밖으로 제외) |
  | api_contract | router 판단(범위 밖으로 제외) |
  | user_guide_sync | router 판단(범위 밖으로 제외) |

  (제외 사유의 세부 텍스트는 prompt manifest 에 개별 제공되지 않음 — router 가 이번 diff 를 idempotency 캐시 파싱 방어 리팩터로 분류해 성능/아키텍처/의존성/DB/API 계약/사용자 가이드 영역과 무관하다고 판단한 것으로 추정)
