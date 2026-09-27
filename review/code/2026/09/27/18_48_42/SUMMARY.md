# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0 · Warning 0 (전 8개 reviewer, forced 7명 전원 결과 확보됨). 남는 것은 이미 트래커에 등재된 SPEC-DRIFT 2건과 비차단 INFO 다수뿐이며, `codebase/` 실질 변경 없이 doc-only 커밋(`634297632`, `27191021c`)만 추가된 3R 재검증이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음 — 8개 reviewer(security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract) 전원 Warning 0.

## SPEC-DRIFT (spec 이 구현보다 낡음 — 코드 revert 아님, planner 의 spec 갱신 대상)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` §5.4 블록쿼트의 PATCH tri-state 서술("`null`=초기화")이 문면상 이번 43필드 null-거부와 글자 그대로 충돌해 보이나, 실제로는 `nullable: true` 선언 필드에만 적용되는 예외 근거를 설명하려던 문장이 그 한정을 명시하지 않은 것. 코드가 옳고 spec 문장이 오독 여지를 남긴 경우. | `spec/5-system/2-api-convention.md:278` | 코드 유지. planner 턴에서 "tri-state 의 `null`=초기화 분기는 `nullable: true` 로 선언된 필드에만 적용된다" 한 문장 추가. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 등재(3회 독립 확인: `--impl-prep` consistency + 1R/2R/3R 코드 리뷰). 신규 조치 불요. |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `endpointPath` PATCH 시 이번 PR 이 도입한 "`null`→400 VALIDATION_ERROR"(종전 200 으로 조용히 경로 삭제)가 spec 필드 권한 매트릭스·§3 註에 아직 미러링되지 않음. 코드(DTO JSDoc/Swagger)는 이미 정확히 반영됨. | `spec/2-navigation/2-trigger-list.md:126`(§2.3.1 `endpointPath` 행), `:194`(§3 註) | 코드 유지. 같은 planner 항목 (10)에서 §5.4 문장과 일괄 처리 예정. 신규 조치 불요. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/API 계약 | PATCH 43필드 `null` 처리 변경은 외부에서 관측 가능한 응답 계약 변경 — 이전 500(NOT NULL 위반)·409(노드 `label` 오분류)·200(트리거 `endpointPath` 조용한 삭제)이 전부 400 `VALIDATION_ERROR` 로 통일됨. 세 경우 모두 이전 상태 자체가 계약 결함이라 이 변경은 고치는 방향. | `codebase/backend/src/common/utils/optional-non-null.ts`, `update-trigger.dto.ts:69` | 조치 불요 — CHANGELOG.md:26-35 에 이미 공지. 1R/2R/3R 동일 결론 (security, side_effect, api_contract 3개 reviewer 공통 확인). |
| 2 | API 계약/문서화 | OpenAPI `description` 텍스트는 43필드 중 `endpointPath` 한 곳만 "null→400" 문구가 추가됐고 나머지 42필드는 데코레이터만 교체돼 정적 문서에 null-거부 사실이 없음(단, 런타임 에러 메시지가 원인을 알려줌). | 예: `update-model-config.dto.ts:18-31`, `update-knowledge-base.dto.ts` 등 | 선택 사항. 공통 문구 템플릿화해 42필드에도 부기 고려 가능. 이전 라운드에서 "결함 아님"으로 합의됨 — 차단 사유 아님. |
| 3 | 유지보수성 | `IsDefined({ message: 고정문구, ...validationOptions })` 순서상 호출자가 `message` 를 넘기면 고정 안내 문구가 조용히 덮어써질 수 있음(현재 14개 DTO 전 호출부가 인자 없이 써서 미실현). | `codebase/backend/src/common/utils/optional-non-null.ts:26-30` | `message` 를 스프레드 뒤에 두거나 `validationOptions.message` 명시적 제거. 우선순위 낮음 — 1R/2R 부터 이월, 변경 불필요. |
| 4 | 유지보수성 | `propertyKey` 를 런타임 검증 없이 `string` 캐스트 — 같은 저장소 다른 커스텀 validator(`is-ip-or-cidr.validator.ts`)는 시그니처를 좁혀 캐스트 불필요. | `codebase/backend/src/common/utils/optional-non-null.ts:20-21` | 반환 함수 시그니처를 `(target, propertyKey: string) => void` 로 좁혀 캐스트 제거. 스타일 개선, 비차단. |
| 5 | 유지보수성/테스트 | "43필드" 불변식이 단일 SoT 없이 DTO 소스·단위 테스트 `TABLE`·plan 문서 세 곳에 손으로 동기화됨. 새 NOT NULL 필드에 데코레이터만 붙이고 `TABLE` 갱신을 잊으면 개수가 우연히 43 그대로일 때 테스트가 조용히 통과해 회귀 보호가 빠질 수 있음(파일 자체 docblock 이 이미 명시한 기지의 한계). | `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:27-30, 82-84` | 즉시 조치 불요(PR 스코프 밖, 문서화된 한계). 후속으로 `@IsOptionalNonNull()` 사용처 AST/리플렉션 전수 스캔 가드 고려. |
| 6 | 테스트 | falsy-but-defined 값(숫자 `0`, 빈 배열 `[]`)이 개별 프로덕션 필드 단위로는 "값 있음"으로 통과하는지 테스트되지 않음 — boolean `false` 만 범용 Probe 로 검증됨. `ValidateIf` 는 엄격한 `!== undefined` 비교라 실제 결함 가능성은 낮음. | `codebase/backend/src/common/utils/optional-non-null.spec.ts`(boolean 만 커버) | 선택적 후속 — 숫자형 필드(`positionX: 0` 등) falsy-값 캐너리 1개 추가 고려. 비차단. |
| 7 | 테스트 | 다중 필드가 동시에 `null` 인 PATCH 요청에서 `details[]` 에 전부 담기는지 unit/e2e 어디서도 검증되지 않음(모든 케이스가 단일 키). | `patch-null-rejection.spec.ts`, `patch-null-rejection.e2e-spec.ts` | 우선순위 낮음 — 2R 부터 이월, 비차단. |
| 8 | 유지보수성 | e2e `cases` 테이블에서 같은 라우트의 `url` 람다가 필드 수만큼(최대 4회) 손으로 반복 — 단위 테스트의 `[DtoClass, fields[]]`+`flatMap` 패턴과 대비됨. | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` | `{label, url, fields[]}.flatMap(...)` 형태로 축약 고려. 비차단. |
| 9 | 유지보수성 | happy-path e2e 에서 "보낸 값"과 "기대값"이 같은 리터럴로 두 번 나열(`send()` vs `expected`) — 나중에 한쪽만 고치면 조용히 어긋날 수 있음. | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:270-282` | `const payload = {...}` 공유 후 `.send(payload)`/`toMatchObject(payload)` 재사용. 비차단. |
| 10 | 요구사항 | `null` 이 `IsDefined`·타입 검증기 양쪽을 동시에 위반하면 `details[]` 에 같은 `field` 값이 두 번 실림 — API 계약 위반은 아니며 이 PR 이전부터 있던 필드 단위 매핑 방식. | `codebase/backend/src/common/pipes/validation.pipe.ts:71-80` | 조치 불요. |
| 11 | 요구사항/부작용 | `Workflow.settings.maxConcurrentExecutions`(워크플로·워크스페이스)가 여전히 `@IsOptional()` 이라 `null` 이 검증을 통과 — 이번 PR 이 만든 회귀가 아니라 처음부터 스코프 밖으로 선언된 기존 gap. | `workflow-settings.dto.ts:28`, `update-workspace-settings.dto.ts:61` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` "PATCH null 후속" 항목에 이미 등재. |
| 12 | 문서화 | 테스트 docblock·트래커가 아직 `plan/in-progress/`에 있는 `patch-null-validation.md`를 `plan/complete/...`로 앞질러 인용. | `patch-null-rejection.spec.ts:28`, `spec-draft-nullable-notation-followups.md:1457,1464` | 조치 불요 — 마무리 커밋(plan 이동)에서 자연 해소 예정으로 1R 부터 명시적으로 유예됨. |
| 13 | 보안 | developer 자신이 발견해 백로그에 남긴 IDOR 의심 지점(폴더/노드/어시스턴트 FK 필드의 워크스페이스 소속 미검증) — `git diff --stat` 확인 결과 이번 diff 가 그 FK 필드들을 건드리지 않아 순수 범위 밖. | `plan/in-progress/patch-null-validation.md` "범위 밖 관찰" 절 | 조치 불요 — 이미 트래커 등재, 이번 PR 을 막을 사유 아님. |
| 14 | 보안 | 신규 NOT NULL 필드 추가 시 `@IsOptional()` 을 잘못 써도(회귀) 자동으로 잡는 정적 가드가 없음 — 파일 자체 주석에 이미 명시된 기지의 한계. | `patch-null-rejection.spec.ts` docblock | 조치 불요. |
| 15 | 문서화 | 신규 JSDoc(`634297632`)의 응답측(`response-contract.ts` §5.4)·요청측 계층 구분 서술을 직접 대조 확인 — 정확함, 새 문제 없음. | `codebase/backend/src/common/utils/optional-non-null.ts:14-15` | 확인용, 조치 없음. |
| 16 | 스코프/문서화 | 3R 신규 두 커밋(`634297632` JSDoc, `27191021c` plan/tracker)은 `--impl-done` consistency-check 항목에 대한 최소 대응으로, 코드 동작을 바꾸지 않고 스코프를 확장하지 않음. | `plan/in-progress/patch-null-validation.md`, `spec-draft-nullable-notation-followups.md` | 조치 불요, 확인용. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/인증/시크릿 새 벡터 없음. IDOR 백로그 항목은 범위 밖 재확인. |
| requirement | LOW | 43필드 정합·에러 분기 전수 재확인. SPEC-DRIFT 2건(§5.4, endpointPath) 발견 — 이미 트래커 등재. |
| scope | NONE | doc-only 2커밋 포함 전체 64파일이 plan 선언 스코프와 정확히 일치, over-engineering 없음. |
| side_effect | NONE | 순수 검증 로직, 전역상태/IO 없음. 응답 계약 변경은 의도되고 CHANGELOG 공지됨. |
| maintainability | LOW | 옵션 스프레드 순서·타입 캐스트·e2e 반복·43필드 이중 SoT·페이로드 중복 — 전부 INFO, 1R/2R 부터 이월. |
| testing | LOW | 98개 테스트 재실행 통과. 신규 커버리지 갭(golden list SoT, falsy 값 캐너리) 2건 — 비차단. |
| documentation | NONE | JSDoc·트래커·CHANGELOG 전부 실측과 정합. plan 미이동 인용만 유예 상태로 재확인. |
| api_contract | LOW | 계약 수정 방향 적절, 에러 봉투/§5.4 범위 정합. OpenAPI 문서 42필드 미보강은 INFO. |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 1건 이상의 INFO/확인 사항을 보고했다(Critical·Warning 은 전원 0).

## 권장 조치사항

1. 이번 PR 은 병합 차단 사유 없음 — Critical 0·Warning 0 이 1R→2R→3R 세 라운드에 걸쳐 일관되게 유지됨.
2. SPEC-DRIFT 2건(§5.4 tri-state 한정 문구, `2-trigger-list.md` endpointPath 서술)은 `project-planner` 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 따라 일괄 반영 — 신규 발견 아니므로 이번 PR 을 막지 않음.
3. (선택, 비차단 후속 백로그) `@IsOptionalNonNull()` 사용처 AST 전수 스캔으로 43필드 golden list 자동 동기화 가드, falsy 값(0/[]) 개별 필드 캐너리, `IsDefined` message 옵션 우선순위 문서화, e2e `cases` 테이블 축약, happy-path payload/expected 리터럴 중복 제거.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨(누락 없음)**
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(검증 로직 데코레이터 치환) 관련성 낮음 |
  | architecture | router 판단상 이번 diff 관련성 낮음(1R architecture 리뷰가 이미 기존 SoT 중복 구조를 별도로 다룸) |
  | dependency | 새 의존성 추가 없음(class-validator 기존 API 재사용) |
  | database | 스키마/마이그레이션 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 영향 없음(내부 API 검증 변경) |