# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. PATCH 43필드 null 처리 결함(500/409/조용한 200 삭제)을 `IsOptionalNonNull()` 로 400 조기 거부하도록 고친 순수 방어적 변경으로, 9개 reviewer(강제 7 + router 선정 2) 전원이 결과를 확보했고 forced 화이트리스트 미이행 항목은 없다. 실질 조치가 필요한 것은 WARNING 2건(테스트 커버리지 갭 1건, 문서 갱신 1건)과 이미 트래커에 등재된 SPEC-DRIFT 1건뿐이다.

## Critical 발견사항

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/2-api-convention.md` §5.4 블록쿼트("PATCH 부분 업데이트는 키 생략·`null`·값의 tri-state 가 각각 의미를 갖는 별개 계약")를 글자 그대로 읽으면 "모든 PATCH 필드"에 적용되는 것으로 보이나, 이번 43필드는 전부 OpenAPI `nullable` 미선언 필드이고 실제 tri-state 대상(`authConfigId`·`llmConfigId`·`parentId`·`folderId` 등)은 이 PR 이 건드리지 않아 실질 충돌은 없다. requirement·documentation·api_contract 3개 reviewer가 독립적으로 동일 결론에 도달. | `spec/5-system/2-api-convention.md` §5.4 (블록쿼트); 코드측 대응 `codebase/backend/src/common/utils/optional-non-null.ts` JSDoc | 코드는 유지. 이미 `--impl-prep` consistency-check(WARNING #2)가 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 항목 (10)에 등재됨 — 다음 planner 턴에서 §5.4에 "tri-state 의 null=초기화 분기는 `nullable: true` 선언 필드에만 적용" 한 문장만 추가하면 해소. 신규 조치 불요, 병합을 막을 사유 아님 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `PATCH /api/model-configs/:id` (`UpdateModelConfigDto` 4필드)는 이번에 `@IsOptional()`→`@IsOptionalNonNull()`로 바뀌는데, **유효한(non-null) 값으로 PATCH 해 200을 확인하는 e2e/통합 테스트가 저장소 어디에도 없다** — happy path 회귀를 잡을 안전망이 없음(다른 12개 라우트는 각각 별도 e2e가 이미 커버) | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:91-99,219-238`(null 케이스 4건뿐); `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:44`; `model-config.controller.spec.ts:196-216`(서비스 mock, validation pipe 미경유) | `patch-null-rejection.e2e-spec.ts` 또는 별도 파일에 `{ name, defaultModel, defaultParams }` 등 유효 값 PATCH → 200 케이스 1건 추가 |
| 2 | Documentation | `endpointPath` 필드의 JSDoc/Swagger `description`이 이번 PR 이 CHANGELOG 에 콕 집어 명시한 핵심 동작 변화("null 전송 시 과거엔 200으로 경로가 조용히 삭제 → 이제 400")를 전혀 반영하지 않음. 이미 상세히 관리되는 docblock(v4 UUID·404·squatting 차단 등)이라 다음 사람이 CHANGELOG 없이 이 파일만 읽으면 이 계약을 알 수 없다 | `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:49-68` | JSDoc/Swagger description 에 "`null`은 400 `VALIDATION_ERROR`로 거부한다(과거엔 웹훅 수신 경로가 조용히 삭제됐다 — `IsOptionalNonNull`)" 한 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Architecture / Security | "43필드" 회귀 방지 표(`TABLE`/`CASES`)가 실제 DTO 데코레이터와 별도로 손으로 유지되는 SoT — 새 NOT NULL 필드에 실수로 `@IsOptional()`을 쓰거나 표에 추가를 잊어도 이 assert(길이=43)만으로는 잡지 못함. 파일 자체 JSDoc이 이미 이 한계를 명시 | `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:20-31,82-84` | 조치 불요(문서화된 기지의 한계). 후속으로 `@IsOptionalNonNull()` 사용처를 리플렉션/AST로 전수 스캔해 `TABLE`과 대조하는 카나리아 고려 |
| 2 | Testing | 다중 필드가 동시에 `null`인 요청에서 `details[]`가 전부 담기는지는 unit·e2e 어디서도 검증되지 않음(항상 단일 필드만 테스트) | `patch-null-rejection.spec.ts:70-79`(`constraintsFor`); `patch-null-rejection.e2e-spec.ts:246-260` | 우선순위 낮음. 매핑 계층이 다른 다중-필드 400 시나리오에서 이미 검증돼 있다면 생략 가능 |
| 3 | Maintainability | `IsOptionalNonNull()`이 `validationOptions`를 `ValidateIf`·`IsDefined` 양쪽에 그대로 전달 — 호출자가 향후 `message`를 넘기면 고정 안내 메시지를 조용히 덮어쓸 수 있음(현재 전 호출부 인자 없음이라 미현실화) | `codebase/backend/src/common/utils/optional-non-null.ts:19-27` | JSDoc에 우선순위 명시하거나 스프레드 순서 조정 |
| 4 | Maintainability | `propertyKey`를 런타임 검증 없이 `as string`으로 캐스트 — 같은 폴더의 기존 validator(`is-ip-or-cidr.validator.ts`)는 시그니처 자체를 `string`으로 좁혀 캐스트가 불필요 | `codebase/backend/src/common/utils/optional-non-null.ts:17-18` | 반환 함수 시그니처를 `(target: object, propertyKey: string) => void`로 좁혀 캐스트 제거(일관성) |
| 5 | Maintainability | e2e `cases` 테이블에서 동일 라우트의 `url` 람다가 필드 수만큼(최대 4회) 반복 — 자매 unit 테스트는 `flatMap`으로 라우트당 1줄 | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` | `{label,url,fields:[...]}.flatMap(...)` 형태로 축약 고려(기능 결함 아님) |
| 6 | Documentation | 43개 필드의 `@ApiPropertyOptional` description이 "null 거부(생략만 값 유지)"를 명시하지 않음 — nullable 필드는 "null이면 지운다"를 적는 기존 관행과 비대칭 | 예: `codebase/backend/src/modules/nodes/dto/update-node.dto.ts` (`label`·`config`·`isDisabled` 등) | 필수 아님. 자주 쓰이는 필드부터 description 템플릿 표준화 고려 |
| 7 | Architecture | 신규 class-validator 프로퍼티 데코레이터가 `common/utils/`에 위치 — 저장소의 `common/decorators/`(NestJS 프레임워크 데코레이터 전용)와 경계가 우연인지 의도인지 불명확(단, `omit-undefined.ts` 선례를 따른 것이라 결함 아님) | `codebase/backend/src/common/utils/optional-non-null.ts` | 조치 불요. 검증 데코레이터가 하나 더 생기면 `common/decorators/`(or `common/validators/`) 통합 고려 |
| 8 | Documentation | 신규 공용 헬퍼 `optional-non-null.ts`가 spec `code:` 목록에 미등재(`omit-undefined.ts` 선례와 동일 패턴) | `codebase/backend/src/common/utils/optional-non-null.ts` | 조치 불요 — 이미 `spec-draft-nullable-notation-followups.md` §(6)에 등재됨 |
| 9 | Security | developer 자신이 조사 중 발견해 백로그에만 남긴 별건 의심 지점 — `workflows.folderId`·`nodes.containerId`/`toolOwnerId`·assistant `llmConfigId`의 PATCH 갱신 경로가 워크스페이스 소속 검사 없이 보이는 IDOR 가능성(이 PR diff 밖, 미검증) | `plan/in-progress/patch-null-validation.md:84` | 이번 PR 범위 밖. 이미 `spec-draft-nullable-notation-followups.md` "PATCH null 후속" 항목에 등재돼 신규 조치 불요 — 존재만 명시(다음 세션이 "코드 리뷰가 이미 봤다"며 건너뛰지 않도록) |
| 10 | Requirement | 신규 테스트 2개 파일 주석이 `plan/complete/patch-null-validation.md`를 인용하나 현재 plan은 `plan/in-progress/`에 있음(아직 `--impl-done` 전) | `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:28` | 코드 로직에 영향 없음(주석뿐). plan을 `complete/`로 옮기는 마무리 커밋에서 경로 일치 재확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 공격 표면 없음, 오히려 500→400 전환으로 정보 노출 축소. 범위 밖 IDOR 의심 지점 1건 기록(이미 등재) |
| architecture | LOW | 핵심 데코레이터 설계는 SOLID/DRY 부합. golden-list SoT 중복(문서화된 한계)만 지적 |
| requirement | LOW | 43필드 전수·뮤턴트·e2e 실측 정확히 일치 확인. SPEC-DRIFT 1건(이미 트래커) |
| scope | NONE | 선언된 범위(43필드+공용 데코레이터+테스트/문서 산출물) 밖 변경 없음 |
| side_effect | NONE | 순수 함수형 변경, 전역상태/네트워크/FS 부작용 없음. 응답 계약 변화는 의도된 것 |
| maintainability | LOW | 헬퍼 옵션 스프레드 순서·타입 캐스트 스타일·e2e 반복 등 사소한 INFO 다수 |
| testing | LOW | model-configs happy-path 테스트 갭(WARNING) 외엔 3-layer(unit/e2e/mutation) 검증 견고 |
| documentation | LOW | CHANGELOG/JSDoc 전반 우수. `endpointPath` docblock 갱신 누락(WARNING) |
| api_contract | LOW | breaking change 없음, 에러코드 개선(500/409/200→400). SPEC-DRIFT 독립 재확인 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상(대부분 INFO)을 기록했으나, Critical/실질 차단 사유는 없음.

## 권장 조치사항

1. `model-configs` PATCH 라우트에 유효 값 200 케이스 추가 (WARNING #1, 테스트 안전망 공백 해소)
2. `update-trigger.dto.ts`의 `endpointPath` JSDoc/Swagger description에 null-거부 동작 명시 (WARNING #2)
3. (planner 턴, 이미 대기 중) `spec/5-system/2-api-convention.md` §5.4에 tri-state null 분기가 `nullable: true` 선언 필드에만 적용됨을 명시 (SPEC-DRIFT #1, item (10))
4. 그 외 INFO 10건은 즉시 조치 불요 — 다음 관련 작업 시 참고

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(미이행 없음)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 변경은 성능 영향 없는 검증 로직 추가 |
  | dependency | router 판단 — 신규 외부 의존성 없음(기존 class-validator API만 사용) |
  | database | router 판단 — 스키마/쿼리 변경 없음(DTO 검증 계층만) |
  | concurrency | router 판단 — 동시성 관련 상태/락 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 동기화 대상 아님(API 에러 코드 변경, CHANGELOG로 커버) |