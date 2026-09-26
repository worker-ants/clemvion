# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `creator`·`changeSummary` 의 OpenAPI 선언 좁힘(optional+nullable → `creator` required / `changeSummary` required+nullable)은 wire 바이트를 바꾸지 않는 하위 호환 정정이다.
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`WorkflowVersionListItemDto.changeSummary`/`.creator`, `WorkflowVersionDto.changeSummary`/`.creator`)
  - 상세: `workflow-versions.service.ts` 에서 두 조회(`findByWorkflow`/`findOne`) 모두 `relations: { creator: true }` + `select: { ...VERSION_METADATA_SELECT, creator: CREATOR_PROJECTION }` 를 이미 쓰고 있고, `workflow_version.created_by` 가 `NOT NULL REFERENCES "user"(id)`(`ON DELETE` 없음)라 관계 로드가 항상 행을 찾는다 — 실측 확인. `changeSummary` 는 두 `select` 모두에 키가 항상 있고 컬럼만 nullable 이다. 따라서 이번 변경은 실제보다 넓게 잘못돼 있던 선언을 실측에 맞춘 것으로, `required` 로 좁아지는 방향은 생성 클라이언트 입장에서 안전하다(반대 방향인 required→optional 이었다면 breaking). `CHANGELOG.md` Unreleased 항목으로 소비자에게 공지된 점도 적절하다.
  - 제안: 없음 — 단위(`workflow-version-response.dto.spec.ts` 캐너리)·e2e(`workflow-crud.e2e-spec.ts` H/I)·뮤테이션(M1~M5 전부 KILLED, plan 기록)으로 뒷받침된 정정.

- **[INFO]** 단일 버전 운영 정책(`spec/5-system/2-api-convention.md` §1, URL 경로에 버전 미포함) 하에서 이번처럼 wire 동작 변화가 없는 스키마 문서 정정에는 버전 범프가 요구되지 않는다 — 규약과 부합.

- **[INFO]** `GET /workflows/:wfId/versions`(목록) 엔드포인트에 없던 계약 대조(schema contract check)가 이번 diff 로 신설됐다 — 기존 커버리지 갭 해소.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (`H` 케이스 — `expectNoUserSecrets(list.body)` + `WorkflowVersionListItemDto` 대조 루프)
  - 상세: `creator` 가 required 로 바뀌면서 부재·`null` 이 계약 위반으로 즉시 잡히고, 중첩 `$ref` 라 `select` 에서 `creator` 투영이 빠져 `User` 전체 컬럼이 실리는 사고(과거 Critical 클래스, `review/code/2026/09/06/10_13_22`)도 미선언으로 검출된다. 뮤턴트 M5(목록 `select` 에서 `creator` 투영 제거)가 실제로 이 검증(`expectNoUserSecrets`)에서 KILLED 됐다는 실측이 plan 에 남아 있다.

- **[INFO]** 1R 리뷰의 WARNING(값이 실제로 `null` 인 `changeSummary` wire 응답을 계약 대조하는 테스트 부재)이 이번 diff 에서 해소됐다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (`I` 케이스 — `expect(versions[0].changeSummary).toBeNull()` 양성 단언 후 `assertMatchesContract(versions[0], await contractForDto(WorkflowVersionListItemDto))`)
  - 상세: `H` 는 `changeSummary: 'v1'`(non-null)만 보고, `I` 는 `changeSummary` 를 생략해 저장한 버전을 목록으로 조회해 `null` 값을 양성으로 먼저 고정한 뒤 대조한다 — 대조만 단독이면 non-null 값도 통과하므로 순서가 맞다.

- **[INFO]** 프런트엔드 미러(`codebase/frontend/src/lib/api/workflows.ts:106` `creator?: { id, name?, email? } | null`)는 백엔드 선언보다 여전히 넓게 유지된다 — 백엔드가 더 좁아졌을 뿐 소비처(`version-history-panel.tsx` 의 `createdBy` 폴백 분기)의 방어 코드가 깨질 방향이 아니라 파괴적 변경이 아니다. 이 결정은 `workflow-versions.service.ts` 의 `WorkflowVersionDetailProjection` JSDoc 에 근거와 함께 남아 있다.

- **[INFO]** 래칫(`swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`)만으로는 "optional+nullable → optional(단독)" 부분 회귀를 못 잡는다(뮤턴트 M2: 래칫 GREEN, 신설 캐너리만 RED — plan 실측). 그 한계를 인지하고 `workflow-version-response.dto.spec.ts` 를 신설해 선언 자체를 직접 고정한 계층화가 적절하다.

- **[INFO]** 목록(`GET /workflows/:wfId/versions`)에 페이지네이션이 없다 — 워크플로당 버전 전량을 반환한다. 이번 diff 가 도입한 변경이 아니고(select 변경 전후로 쿼리 형태 동일), plan/리뷰 이력에서도 별도 이슈로 다루지 않아 이번 PR 스코프 밖이다. 워크플로당 버전 수가 무한 증가할 수 있는 도메인이라면 장기적으로 검토할 여지는 있음(비블로킹).

에러 응답 형식(HTTP 상태 코드), 요청 검증, URL/경로 설계, 인증/인가는 이번 diff 의 변경 범위에 포함되지 않으며 기존 계약을 그대로 유지한다(예: `assertWorkspaceOwnership` 의 `NotFoundException({code: 'RESOURCE_NOT_FOUND', ...})`, `createVersion` 의 `ConflictException({code: 'WORKFLOW_VERSION_CONFLICT', ...})` 불변).

## 요약

본 변경은 워크플로 버전 목록·상세 응답의 `creator`·`changeSummary` 필드를 §5.4 규약이 금지하는 "optional + nullable" 조합에서 실제 런타임과 일치하는 기본형(`creator` required 참조, `changeSummary` required+nullable)으로 정정하는 OpenAPI 계약 정확성 개선이다. DB 제약(FK `NOT NULL`, `ON DELETE` 없음)과 두 조회의 `select`/`relations` 구성으로 실제 값이 항상 존재함이 실측·코드로 확인되며, wire 바이트는 변경되지 않아 하위 호환이고 breaking change 가 아니다. 단일 버전 운영 정책상 버전 범프도 불필요하다. 1R 리뷰의 WARNING(`changeSummary` null 값 wire 검증 갭)이 `69b1afca0` 로 해소됐고, 목록 엔드포인트에 없던 계약 대조 신설, `VERSION_METADATA_SELECT` 상수화를 통한 자매 조회 간 select drift 재발 방지, 신규 DTO 선언 캐너리, 래칫 갱신까지 계층적으로 뒷받침돼 있다. 에러 응답·요청 검증·URL 설계·인증/인가는 변경 범위 밖으로 기존 계약이 유지된다. API 계약 관점에서 이번 diff 는 실제 결함이 없다.

## 위험도

NONE
