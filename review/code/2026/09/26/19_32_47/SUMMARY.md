# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건 모두 "새 결함"이 아니라 "테스트/방어 커버리지 갭"(전역 상수 불변성 미보장, 뮤테이션 커버리지 공백)이며, 런타임 요청 처리 로직 자체는 변경되지 않았다.

> **비고 (routing 무결성)**: forced(router_safety) 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 누락 없음. `scope` reviewer 는 STATUS 가 `no_status` 로 보고됐으나 인라인 전문이 온전히 제공되어 정상 반영했고, 누락돼 있던 `scope.md` 파일도 본 세션에서 인라인 전문 그대로 영속화했다. 8명 전원(forced 7 + router 선택 `api_contract`)의 실질 발견사항을 아래에 반영했으므로 "결과 없음으로 인한 거짓 낮은 위험도" 우려는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `toValidate()` 내부 지역 배열이었던 비검증 설계 타입 목록이 모듈 top-level `export const UNVALIDATED_METATYPES`(`readonly Function[]`)로 승격됨 — 타입은 컴파일타임 제약일 뿐 런타임 불변성을 강제하지 않아, 타입 단언으로 `.push()`/`.splice()` 하면 전역 검증-스킵 목록이 영구 오염될 수 있음. 보안/검증 경계를 지배하는 자리에 새 전역 가변 상태가 생김 | `codebase/backend/src/common/pipes/validation.pipe.ts:15` (선언), `:90` (`toValidate` 소비) | `export const UNVALIDATED_METATYPES = Object.freeze([...])` 로 런타임에서도 변형을 차단 |
| 2 | testing | `UNVALIDATED_METATYPES` 의 5개 원소 중 `Number`·`Boolean`·`Array` 는 어느 테스트에서도 개별적으로 관측되지 않음(대조군은 `Object`/`String`/`undefined` 만 커버) — 이 세 원소가 실수로 배열에서 빠져도 어떤 테스트도 RED 로 잡지 못하는 뮤테이션 갭 | `codebase/backend/src/common/pipes/validation.pipe.ts:15-21`, `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:42-47` (소비), 대조군 `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts:91-131` | `BodyFixtureController` 에 `@Body() _n: number` / `@Body() _arr: boolean[]` 자리를 추가해 `Number`/`Array`(선택적으로 `Boolean`) 최소 1개가 위반 목록에서 직접 관측되게 한다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement / api_contract | 신설 가드는 "본문 스키마 광고의 존재"만 강제하고 "광고의 정확성"·"입력 검증 충분성"은 강제하지 않음 — `@Body() body: unknown` + `@ApiBody({schema:{}})` 로 광고되는 웹훅 수신 등 라우트는 본문이 검증 없이 통과한다. spec Rationale 에 이미 의도된 트레이드오프로 명시된 기존(비변경) 설계 결정이며, 이번 PR 은 이를 문서화·가드화했을 뿐 새 취약점을 만들지 않음 | `codebase/backend/src/common/pipes/validation.pipe.ts`(`UNVALIDATED_METATYPES`, `toValidate`), `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`(`advertisesBody`, `scanRequestBodyAdvertised`), `spec/conventions/swagger.md` §5-4 Rationale | 코드 조치 불요(스코프 밖, spec 근거 있음). `@ApiBody({schema:{}})` 로 면제된 라우트들의 다운스트림 처리가 별도로 검증/새니타이즈하는지는 후속 감사 대상으로 남겨둘 만함 |
| 2 | requirement | 한 핸들러에 키 지정 `@Body('a')`/`@Body('b')` 처럼 `@Body()` 자리가 여럿이면 `advertisesBody()` 가 핸들러 단위로만 `@ApiBody` 유무를 보므로, 자리 중 하나만 문서화돼도 나머지 키 자리까지 "광고됨"으로 처리됨 | `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` `advertisesBody`(~59-64행), `scanRequestBodyAdvertised` 92행 | 조치 불요 — 가드 JSDoc·spec Rationale 에 이미 명시된 스코프 경계. 다중 키 패턴 발생 시 라우트별 캐너리가 보완 |
| 3 | requirement / scope | `spec/conventions/swagger.md` §5-4 절 제목("새 엔드포인트 체크리스트")이 기존 라우트에도 소급 적용되는 실제 범위와 괴리 — 이번으로 3번째 누적 발견이며 이미 `review/consistency/2026/09/26/19_09_17/convention_compliance.md` INFO#4 로 추적 중 | `spec/conventions/swagger.md` §5-4 제목, 신규 불릿 | 신규 조치 불요 — 기존 추적 항목 재확인 |
| 4 | scope | `swagger-probe.ts` JSDoc 문구 정정("Nest 메이저 업그레이드" → "`^` 범위 마이너·패치 업그레이드도")이 이번 가드 기능과 무관한 곁가지로 같은 커밋(`1c19eebc7`)에 번들됨 | `codebase/backend/src/shared/testing/swagger-probe.ts:141-142` | plan 에 명시적으로 추적됨(조치 불요). 향후 유사 곁가지는 별도 커밋 권장 |
| 5 | scope / testing | `bodyArgIndexes` 추출로 다중 `@Body()` 자리 선택 순서가 `Object.entries()` 삽입 순서 → 인덱스 오름차순 정렬로 변경(정당한 리팩터로 판단되나 미검증) | `codebase/backend/src/shared/testing/swagger-probe.ts:174-181` | 두 개 이상의 키 지정 `@Body()` 를 가진 라우트로 정렬 결과를 직접 단언하는 테스트 추가 권장(낮은 우선순위) |
| 6 | maintainability | `SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER` 상수가 형제 가드 파일과 문자 그대로 중복(2번째 발생) | `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:17-18` vs `forbidden-response-codes-guard.ts:27-28` | 지금 추출 불요 — 3번째 유사 소비처 발생 시 공유 상수 모듈로 추출 검토 |
| 7 | maintainability | `'design:paramtypes'` 리플렉션 키 문자열이 3곳(`request-body-advertised-guard.ts`, `swagger-probe.ts`, `workflows-execute-body.spec.ts`)에서 반복 | 위 3개 파일 | 조치 불요(각 소비처에 부재 시 throw 하는 안전망 존재). 4번째 소비처 생기면 공유 상수 검토 |
| 8 | maintainability | `isUnschematized` 에서 `(UNVALIDATED_METATYPES as readonly unknown[]).includes(designType)` 캐스팅이 다소 우회적이나, 값이 아닌 컨테이너 타입을 넓히는 안전한 방향이고 JSDoc 으로 설명됨 | `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:42-47` | 조치 불요 |
| 9 | testing | `scanRequestBodyAdvertised` 정렬의 1차 키(`controller.localeCompare`)가 대조군 위반이 전부 한 컨트롤러(`BodyFixtureController`)에서만 나와 실제로 exercising 되지 않음 — 통째로 제거해도 테스트가 실패하지 않음 | `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:101-106`, 검증측 `request-body-advertised.spec.ts:148-157` | 알파벳상 앞서는 두 번째 컨트롤러에 위반 하나를 추가해 1차 키가 실제 순서를 가르게 함 |
| 10 | testing | `designType` 표시 로직이 이름 없는(anonymous) 함수/클래스 케이스를 다루지 않아 위반 메시지가 빈 문자열로 표시될 수 있음(실전 발생 가능성 낮음) | `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:96-98` | 조치 불요(저위험) |
| 11 | documentation | `bodyArgIndexes` JSDoc 이 서술하는 "키 지정 본문이 여럿" 동작을 어느 테스트도 직접 검증하지 않음(대조군은 단일 키만 커버) | `codebase/backend/src/shared/testing/swagger-probe.ts:170` 부근 | 문서 결함은 아님(테스트 커버리지 지적) — 다중 `@Body('a')`/`@Body('b')` 케이스 추가 시 JSDoc·커버리지 정확히 정합 |
| 12 | side_effect | `request-body-advertised.spec.ts` 의 `beforeAll` 이 `src/modules` 하위 컨트롤러 전체를 동적 로드(형제 가드의 기존 패턴 재사용) — 컨트롤러 모듈에 top-level side effect 가 있으면 테스트 시점에 함께 트리거됨 | `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` `beforeAll` | 조치 불요(기존 패턴), 참고용 |
| 13 | security / api_contract | `validation.pipe.ts` 의 `toValidate()` 리팩터(지역 배열 → export 상수)는 원소·순서·비교 방식이 완전히 동일해 런타임 동작·기존 API 클라이언트 계약에 영향 없음(순수 리팩터, breaking change 아님) | `codebase/backend/src/common/pipes/validation.pipe.ts:15,90` | 조치 불요 — 확인용 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임 요청 처리 변경 없음. 새 취약점 표면 없음 — 기존 "문서화만 강제, 검증은 강제 안 함" 설계가 이번 PR 로 명문화됨(INFO) |
| requirement | NONE | spec 과 구현이 line-level 로 일치. 남은 발견은 모두 문서화된 스코프 경계(INFO) |
| scope | NONE | 25개 변경 파일 전부 단일 목적("본문 스키마 광고 가드")에 수렴. 곁가지 1건은 plan 에 추적됨 |
| side_effect | LOW | `UNVALIDATED_METATYPES` 전역 승격에 `Object.freeze` 부재(WARNING). 그 외는 순수 추가(additive) |
| maintainability | NONE | 형제 가드와 상수 리터럴 중복(INFO, 기존 패턴). 함수 분리·네이밍·문서화 전반 양호 |
| testing | LOW | `UNVALIDATED_METATYPES` 개별 원소 커버리지 갭(WARNING), 정렬 로직 미검증(INFO 2건) |
| documentation | NONE | 코드 JSDoc·spec Rationale·CHANGELOG·plan 4계층 정합. `bodyArgIndexes` 다중 키 테스트 갭만 INFO |
| api_contract | LOW | 런타임 계약(라우팅·스키마·에러코드·인증) 변경 없음. "광고 존재만 검사" 스코프는 기존 설계 결정 |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 INFO 이상을 보고했다(단, CRITICAL/WARNING 없이 NONE 위험도로 마무리한 에이전트는 `security`, `requirement`, `scope`, `maintainability`, `documentation` 5곳).

## 권장 조치사항

1. (WARNING #1) `codebase/backend/src/common/pipes/validation.pipe.ts:15` 의 `UNVALIDATED_METATYPES` 를 `Object.freeze([...])` 로 감싸 런타임 변형을 차단한다 — 검증-스킵 목록이 보안 경계를 지배하는 자리이므로 타입 수준 `readonly` 만으로는 부족하다.
2. (WARNING #2) `request-body-advertised.spec.ts` 의 `BodyFixtureController` 에 `Number`/`Array`(선택적으로 `Boolean`) 위반 케이스를 추가해 `UNVALIDATED_METATYPES` 배열 축소 뮤턴트를 이 스펙만으로 KILL 되게 한다.
3. (INFO, 선택) 다중 키 `@Body('a')`/`@Body('b')` 라우트 케이스와 2번째 컨트롤러 fixture 를 추가해 `bodyArgIndexes` 신규 정렬·`scanRequestBodyAdvertised` 1차 정렬 키를 직접 exercising 한다.
4. (트래킹 유지) spec §5-4 제목의 소급 적용 괴리, JSDoc 곁가지 분리 등은 이미 plan/consistency 리포트에 기록되어 있으므로 별도 조치 없이 기존 추적만 유지한다.
5. (후속 감사 후보) `@ApiBody({schema:{}})` 로 면제된 `unknown` 타입 웹훅 수신 라우트들의 다운스트림 처리가 실제로 별도 검증/새니타이즈를 하는지는 이번 diff 범위 밖이므로, 별도 세션에서 확인을 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(`scope` 는 STATUS=`no_status` 였으나 전문 확보·영속화 완료)
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(런타임 성능 영향 없는 정적 가드·문서 변경) |
  | architecture | router 판단상 이번 diff 와 무관(아키텍처 구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관(의존성 추가/변경 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 문서 대상 변경 없음) |
