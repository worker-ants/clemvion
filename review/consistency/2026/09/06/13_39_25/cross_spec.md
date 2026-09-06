# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 메모

`spec/5-system/**` 자체의 diff 는 0 파일 — 이번 변경은 `codebase/**` 전용(`User` 엔티티
컬럼 노출 방어 3~4축 신설) + `spec/conventions/review-citations.md`·
`spec/conventions/spec-impl-evidence.md` 의 2건 정정뿐이다. 아래는 워킹트리를 절대경로로
직접 열어 확인한 실제 diff(`git diff origin/main...HEAD -- codebase/ spec/`, 17파일)를
근거로, 그 코드 변경이 `spec/**` 다른 영역과 충돌하는지를 점검한 결과다.

## 발견사항

- **[WARNING]** 신규 `User` 노출 방지 검증자 2종이 "무엇이 이 규칙을 강제하는가" 문서화 SoT 에 등재되지 않음
  - target 위치: (코드) `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` — `spec/5-system/**` 자체는 미변경이므로 "target 문서 내 위치"는 해당 없음. 관련 SoT 는 `spec/conventions/swagger.md §5-1`, `spec/5-system/2-api-convention.md §5.4 "검증 층"`
  - 충돌 대상: `spec/conventions/swagger.md` §5-1 의 콜아웃 `"무엇이 이 규칙을 강제하나"` (엔티티를 그대로 노출하지 말 것) 및 `spec/5-system/2-api-convention.md` §5.4 의 표 `"검증 층 — 이 규칙을 무엇이 강제하는가"`
  - 상세: 두 문서는 "엔티티 전체 노출/선언 안 된 키 노출"을 잡는 검증자로 `swagger-dto-contract-guard.ts`(선언↔선언, 정적) 와 `response-contract.ts`(값↔선언, 런타임 e2e) **두 개만** 명시적으로 열거하고, 후자의 "못 보는 것" 을 "배선되지 않은 엔드포인트"라고 적어 둔다. 이번 PR 은 바로 그 갭(`GET /workflows/:wfId/versions/:versionId` 에 e2e 미배선 → `User` 전 컬럼 유출, `CHANGELOG.md` Critical 1)을 메우기 위해 **두 검증자를 새로 추가**했다 — `user-entity-exposure-guard.ts`(ORM 쿼리 구성 단계에서 `User` 관계를 투영 없이 싣는 자리를 AST 로 검출, e2e 배선과 무관하게 항상 작동) 와 `user-secret-absence.ts`(응답 본문을 이름 기준으로 깊이 훑어 DTO 선언 여부와 무관하게 7개 민감 컬럼 부재를 단언). 그런데 이 두 검증자는 `swagger.md §5-1` 콜아웃에도 `api-convention.md §5.4` 표에도 등재되지 않았다. 같은 PR 이 구조적으로 동일한 상황(신규 가드가 기존 규약 문장을 갱신시켜야 하는 경우)인 `dto-jsdoc-citation-guard.ts` 는 `spec/conventions/review-citations.md` 의 `code:` frontmatter 와 본문에 정식으로 등재했다(그 사유가 "developer 가 스스로 쓴 문장을 반증"이 아니라 "planner 턴을 열었다"는 점까지 CHANGELOG 에 명시됨). 동일 PR 내에서 구조적으로 동형인 두 케이스가 다르게 처리된 것이라, 등재 누락이 실수가 아니라 의도적 스코프 축소인지 불명확하다. (참고: 모든 `repo-guards/__tests__/*` 가 항상 spec 에 등재되는 것은 아니다 — 예: `nullable-type-lie-cast-guard.ts` 는 어디에도 없고 `masked-reject-callers-guard.ts` 는 본문 프로즈에만 인용되고 `code:` frontmatter 에는 없다. 그러나 `swagger.md §5-1`/`api-convention.md §5.4` 는 다른 절과 달리 "이 규칙을 무엇이 강제하나"를 **완결된 목록**으로 제시하는 명시적 콜아웃/표 형식이라, 그 두 곳만큼은 완전성이 기대된다)
  - 제안: (a) `swagger.md §5-1` 콜아웃에 두 검증자를 추가하고 "정적 가드는 선언끼리만 대조하므로 엔티티를 그대로 노출했다는 사실 자체는 못 본다"는 문장을 축 단위로 정정(이제 `user-entity-exposure-guard.ts` 가 정확히 그 축의 일부를 정적으로 잡는다), (b) `api-convention.md §5.4` 표에 두 행을 추가하거나 두 검증자가 "§5.4(부재 표현)" 범위 밖(§5-1/엔티티 노출 범위)임을 명시해 표의 스코프를 좁히는 각주를 달 것. 둘 다 원치 않으면 review-citations.md 사례와 다르게 취급하는 근거(예: "이 두 검증자는 §5.4/§5-1 이 다루는 대상이 아니라 더 넓은 방어선이라 특정 절에 귀속시키지 않는다")를 Rationale 로 명시.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드는 §5.4 형식·데이터 모델과 정합 — 참고용 확인 기록
  - target 위치: (코드) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (diff +14줄)
  - 충돌 대상: `spec/1-data-model.md §2.3 WorkspaceMember`(`joined_at | Timestamp?`), `spec/data-flow/12-workspace.md`·`spec/data-flow/2-auth.md` (workspace_member INSERT 시 `joined_at=now` 즉시 채움 서술)
  - 상세: 신규 필드는 `@ApiProperty({ nullable: true }) joinedAt: string | null` 로 선언되어 `spec/5-system/2-api-convention.md §5.4` "기본형(`null`, 키 present)" 규칙을 정확히 따르고, 인라인 `//` 주석(JSDoc 아님)으로 근거를 남겨 §5.4 검증 층 문단이 지적하는 "JSDoc→공개 description 유출" 함정도 피했다. 데이터 모델의 `Timestamp?`(nullable 컬럼)와도 모순되지 않으며, data-flow 문서들이 서술하는 "생성 시 즉시 채움" 실측과도 부합한다. 프런트엔드(`codebase/frontend/src/lib/api/workspaces.ts`)가 이미 `joinedAt: string | null` 을 기대하고 있어 계약 정합성도 확인됨. **충돌 없음 — 검토 완결성을 위해 기록만 남김.**

- **[INFO]** `WorkflowVersionsService.findOne` 투영 수정은 기존 DTO 계약(`WorkflowVersionCreatorDto` 3필드)을 실제로 준수하게 만든 방향 — 확인 기록
  - target 위치: (코드) `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
  - 충돌 대상: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`WorkflowVersionCreatorDto`, 이번 PR 에서 미변경)
  - 상세: 기존 DTO 는 이미 `creator?: WorkflowVersionCreatorDto | null`(id/name/email 3필드)를 선언하고 있었으나 `findOne` 의 실제 쿼리가 투영 없이 `User` 전체를 로드해 선언과 실제가 어긋나 있었다(Critical 유출). 이번 수정은 쿼리를 선언에 맞춰 좁힌 것이라 기존 계약을 변경하지 않고 준수 상태로 되돌린 것 — 신규 충돌 없음. (별개로, 그 DTO 필드가 `?`(optional, 키 생략형)와 `| null`(기본형)을 동시에 쓰는 조합은 §5.4 문언상 "`| null` 금지" 대상처럼 보이지만, 이 필드는 이번 PR 의 diff 밖이라 본 리뷰의 target 이 아니다 — 별도 트래킹 권장.)

## 요약

이번 변경분은 `spec/5-system/**` 문서 자체를 건드리지 않고 코드(`User` 엔티티 컬럼 노출 방어 3~4축 신설 + 관련 convention 문서 2건 정정)만 수정했다. RBAC 매트릭스·상태 전이·엔티티 필드 정의·API 계약 형태(§5.4 null-vs-omission) 등 핵심 축에서는 기존 spec 과의 직접 모순을 찾지 못했으며, 신규 `WorkspaceMemberDto.joinedAt` 필드와 `WorkflowVersionsService.findOne` 투영 수정 모두 기존 데이터 모델·API 규약과 정합적이다. 유일한 실질적 지적은 이번 PR 이 신설한 두 검증자(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`)가, 같은 PR 이 구조적으로 동일한 상황에서 `dto-jsdoc-citation-guard.ts` 에는 적용한 "규약 SoT 등재" 절차를 거치지 않아 `swagger.md §5-1`·`api-convention.md §5.4` 의 "무엇이 이 규칙을 강제하나" 완결형 목록이 이제 실제보다 좁아졌다는 점이다 — 기능적 모순은 아니지만, 이 프로젝트가 반복적으로 지켜온 "검증자는 규약 문서에 등재한다" 관례에 비춰 보면 명시적 결정(등재 또는 의도적 제외 사유 기록)이 필요한 갭이다.

## 위험도
LOW
