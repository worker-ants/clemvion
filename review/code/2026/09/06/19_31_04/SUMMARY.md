# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 기능적 결함은 없으나(`User` 엔티티 민감 컬럼 노출 방어 2축 신설 + 실유출 1건 수정은 완전하고 테스트로 두텁게 보강됨), `scope` 리뷰어가 지적한 **하나의 브랜치에 인과적으로 연결되었지만 주제상 별개인 관심사가 다수 실린 구조적 문제**(WARNING)와 `api_contract` 리뷰어가 지적한 **도메인 세부 에러 코드 표현 방식의 저장소 전반 비일관성**(WARNING) 두 건이 전체 위험도를 MEDIUM 으로 끌어올린다. 강제(forced) 화이트리스트 7개(`documentation`,`maintainability`,`requirement`,`scope`,`security`,`side_effect`,`testing`) 전원의 결과가 확보되어 있고 **forced 미이행 항목은 없다** — 이 판정은 그 전원을 반영한 것이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 주 목적("User 컬럼 방어")과 인과적으로 연결되었지만 주제상 별개인 관심사(harness YAML frontmatter 파서 버그 수정 → 게이트 범위 확대 → 트리거 `endpoint_path` UNIQUE 충돌 409 계약 신규 구현 → `pg-error.ts` 공용 SoT 추출)가 같은 브랜치/커밋 세트에 함께 실려 리뷰·롤백 단위가 흐려짐. 전부 CHANGELOG·plan·커밋 메시지에 투명하게 disclose 되어 은폐는 아님 | `.claude/hooks/_lib/review_guard.py`(`_parse_frontmatter_code`/`_strip_comment`), `codebase/backend/src/modules/triggers/triggers.controller.ts`(`@ApiConflictResponse`), `triggers.service.ts`(`isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`), `codebase/backend/src/common/db/pg-error.ts`(`pgErrorConstraint`) | 조치 불요할 수 있음(근거 충분히 disclose됨). 향후 유사 상황에서는 harness 파서 수정과 그로 인해 드러난 무관 계약 구현을 별도 커밋/PR로 분리 권장 |
| 2 | API Contract | 도메인 세부 에러 코드 표현 방식이 API 전체에서 두 관례로 공존 — 이번 PR은 `details.code` 방식을 신규 채택했으나, 저장소의 다른 7건 선례는 top-level `code` 자체를 특화 코드로 교체하는 방식. `spec/5-system/2-api-convention.md §5.3`이 어느 쪽이 기본인지 명문화하지 않아 클라이언트가 `error.code`/`error.details.code` 중 무엇을 봐야 하는지가 엔드포인트마다 달라짐 | `codebase/backend/src/modules/triggers/triggers.service.ts:1607-1631`(`rethrowEndpointPathConflict`) vs `spec/5-system/3-error-handling.md:88,90`(`DUPLICATE_NODE_LABEL`/`WORKFLOW_VERSION_CONFLICT`) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:631-649`에 planner 항목("도메인 세부 에러 코드 표현 방식 정식화")으로 등재됨. 신규 조치 요구 아님 — 다음 planner 턴에서 §5.3 택일 기준 명문화 대기 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/API Contract/Side Effect | `WorkflowVersionsService.findOne`이 `creator: User`를 투영 없이 로드해 비밀번호 해시 등 민감 컬럼을 컨트롤러가 그대로 반환하던 실유출을 `CREATOR_PROJECTION`(`{id,name,email}`) 투영으로 닫음. e2e(`workflow-crud.e2e-spec.ts` H.)가 계약 대조+이름 기반 부재+양성 확인 3축으로 회귀 방지 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(`findOne`, `CREATOR_PROJECTION`) | 조치 불요(수정 완료·검증됨) |
| 2 | Side Effect | `TriggersService.create`/`update`의 unique-violation 에러 전파 경로가 바뀜(`.catch()`로 가로채 `ConflictException` 직접 던짐). 이 서비스의 다른 `save()` 호출 지점(schedule/secret/chatChannel 설정 등)은 이 래핑 대상이 아니라, 향후 그 경로로 `endpointPath` 변경이 흘러들면 같은 위반이 미가공 500으로 노출될 수 있는 비대칭이 생김 | `codebase/backend/src/modules/triggers/triggers.service.ts:426,512,832,1163,1211,1445,1476,1527` | 현재 범위엔 안전. 향후 `endpointPath`를 다루는 새 `save()` 호출 추가 시 `.catch()` 패턴 누락 방지를 팀 관례로 남길 것 |
| 3 | Side Effect | `.claude/hooks/_lib/review_guard.py`의 `_parse_frontmatter_code` 파서 수정은 순수 함수이지만, 그 반환값이 저장소 전역 `--impl-done` 게이트의 spec-linked 판정 범위에 영향 — spec 387개 중 7개 파일에서 41개 `code:` entry가 새로 인식되며 향후 다른 브랜치의 게이트 판정 범위도 넓어짐 | `.claude/hooks/_lib/review_guard.py`(`_strip_comment` 신설) | 조치 불요(의도된 변경, `.claude/tests/test_review_guard.py` 정방향/반대방향 회귀 테스트로 커버). 팀은 이 변경이 in-flight PR들의 게이트 판정을 바꿀 수 있음을 인지 |
| 4 | Testing | 트리거 `endpoint_path` UNIQUE 충돌 409 응답을 실제 Postgres 유니크 제약 경로로 검증하는 e2e가 없음 — unit은 손으로 만든 mock 에러(`makePgUniqueViolation`)로만 4조합(create/update × 2 wrap 표면) 검증. 같은 PR의 다른 두 갈래(`WorkflowVersionsService`/`WorkspaceMemberDto`)는 e2e로 보강됐는데 트리거 갈래만 비어 있어 형평이 어긋남 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts`; 대응 e2e 부재: `webhook-trigger.e2e-spec.ts`, `trigger-expression.e2e-spec.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:541`에 등재된 항목의 재확인. `webhook-trigger.e2e-spec.ts`에 동일 `endpointPath` 중복 생성 → 409 확인 케이스 1건 추가 권장(차단 사유 아님) |
| 5 | Documentation | 트리거 충돌 코드 주석이 인용한 `spec/conventions/error-codes.md §4.2`(`error.details[].code`, 배열 구조)와 실제 채택 형태(`details: {field, code}`, 단수 객체)가 컨테이너 형태에서 차이 — 인용 자체는 사실이나 오독 여지 있음. 구현은 `2-trigger-list.md §3`(단수 객체 계약)과는 정확히 일치 | `codebase/backend/src/modules/triggers/triggers.service.ts`(`rethrowEndpointPathConflict` 주석) | 실질 결함 아님. 여유 있으면 주석에 "컨테이너 형태(배열 vs 단수 객체)는 §4.2와 다르다" 한 줄 추가 권장 |
| 6 | API Contract | `WorkflowVersionListItemDto`/`WorkflowVersionDto`의 `creator` 필드가 §5.4 금지 조합(`@ApiPropertyOptional({nullable:true})` + `creator?: T\|null`)을 그대로 둠 — 이번 PR이 서비스 런타임 타입은 `ProjectedCreator`(항상 존재)로 좁혔지만 DTO 선언은 옵셔널+nullable 이중 표기라 "선언이 런타임보다 넓음". 이번 PR 대상 파일 아님 | `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` | 이미 등재됨(`spec-draft-nullable-notation-followups.md:694-712`, `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫으로 동결). 신규 조치 불요 |
| 7 | API Contract/User Guide Sync | `WorkspaceMemberDto.joinedAt` 필드 추가는 wire 변경이 아니라 기존에 이미 나가던 응답 필드(`WorkspacesService.listMembers`가 이미 실어 보내던 값)의 뒤늦은 OpenAPI 선언 보정. frontend(`workspaces.ts`)는 이미 이 필드를 소비 준비된 상태였음 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` | 조치 불요 |
| 8 | User Guide Sync | 트리거 `endpointPath` 충돌 세부 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)가 `02-nodes/triggers.mdx` 에러 코드 표에 없음 — 다만 409 자체는 이전부터 있었고(사전 존재 UNIQUE 인덱스) 이번 PR은 `details` 페이로드만 정밀화, frontend 소비 코드 없음(grep 0건)이라 신규 사용자 노출 아님 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`.en.mdx` | 조치 불요. 원하면 "동일 endpointPath 중복 불가" 한 줄 저비용 보강 가능 |
| 9 | Maintainability | `_parse_frontmatter_code`가 여러 라운드의 점진적 하드닝을 거치며 함수 하나에 2개 중첩 클로저 + 3-way 분기 + 이중 while 루프가 누적 — 개별 분기는 테스트로 잘 덮였으나 "인라인 리스트/블록 리스트/주석 스트리핑" 세 관심사를 한 함수가 담당 | `.claude/hooks/_lib/review_guard.py`(`_parse_frontmatter_code`, 약 95줄) | 급하지 않음. 다음에 만질 때 `_strip_comment`/`_clean`을 모듈 레벨로 승격하거나 파싱 경로 분리 고려 |
| 10 | Requirement | 전역 `GlobalExceptionFilter.isUniqueViolation`이 `pg-error.ts`의 두 wrap 표면 흡수 SoT를 쓰지 않고 `instanceof QueryFailedError`만 요구 — raw 표면 SQLSTATE 23505가 이론상 500으로 샐 수 있는 구조적 불일치. 이번 PR 변경 범위 밖 | `codebase/backend/src/common/filters/http-exception.filter.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:490-508`에 실측된 blast radius(~0)와 함께 등재됨. 조치 불요 |
| 11 | Requirement | `integration-oauth.service.ts`의 손-작성 constraint 추출 2곳이 신설된 `pgErrorConstraint()`로 치환 가능하나 이번 PR 범위에서 제외(동작은 정상, 중복만 남음) | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1274,1833` | 같은 plan 문서 526-538행에 등재됨. 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 취약점 없음. `WorkflowVersionsService.findOne` 실유출 수정 확인, 하드코딩 시크릿 0건 |
| requirement | NONE | 요구사항 완전 충족(User 컬럼 방어 2축 + 실유출 수정), 잔여 이연 항목 2건은 근거와 함께 등재됨 |
| scope | MEDIUM | 핵심 산출물은 목적에 정확히 대응하나, 파생된 harness 파서 수정 + 트리거 API 계약 구현 + JSDoc 가드 + plan lifecycle 정리까지 한 브랜치에 실려 관심사 수가 이례적으로 많음 |
| side_effect | LOW | 트리거 에러 전파 경로 변경(일부 save() 호출은 미적용), review_guard.py가 전역 게이트 판정 범위에 영향 — 둘 다 검증됨, 위험 낮음 |
| maintainability | NONE | 단일 책임 유지, 상수화 잘 됨. `_parse_frontmatter_code` 비대화만 INFO |
| testing | LOW | 매우 두터운 테스트(양성/음성/반대방향 대조군/카나리아). 트리거 409 e2e 부재만 잔존(이미 등재) |
| documentation | NONE | 예외적으로 높은 문서화 수준. 에러코드 인용 정밀도 INFO 1건만 |
| api_contract | LOW | 신규 계약 3건 모두 하위호환 유지+회귀방지. 에러코드 표현 비일관성(WARNING)과 이연 항목 2건 |
| user_guide_sync | NONE | 매트릭스 20행 대조 결과 유저 가이드 동반 갱신 불요. 트리거 에러코드 표 보강 INFO 1건 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO 수준 관찰 사항을 보고했다(순수 "문제 없음"으로만 종결한 에이전트는 없음).

## 권장 조치사항

1. (선택, 비차단) `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 등재된 "도메인 세부 에러 코드 표현 방식 정식화"(`spec/5-system/2-api-convention.md §5.3`) 항목을 다음 planner 턴에서 처리해, top-level `code` vs `details.code` 두 관례의 공존을 해소한다.
2. (선택, 비차단) 향후 유사 PR에서는 harness 파서 버그 수정(또는 다른 인프라성 변경)과 그로 인해 파생된 무관 기능 구현(이번 PR의 트리거 409 계약)을 별도 커밋/PR로 분리해 리뷰·롤백 단위를 명확히 한다.
3. (선택, 비차단) `webhook-trigger.e2e-spec.ts`에 트리거 `endpointPath` 중복 생성 → 409 + `details.field`/`details.code` 확인 e2e 1건을 추가해, unit mock이 가정한 두 wrap 표면이 실제 Postgres 드라이버와 일치하는지 검증하는 계층을 닫는다(이미 plan에 등재된 항목).
4. 그 외 이연 항목(`integration-oauth.service.ts` 중복 헬퍼, `GlobalExceptionFilter.isUniqueViolation` SoT 미교체, `WorkflowVersion*Dto.creator`의 §5.4 금지 조합)은 모두 근거와 함께 `plan/in-progress/`에 등재되어 있으므로 이번 PR에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨 — forced 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 낮은 관련성 (상세 사유는 `_routing_decision.json` 참고) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |