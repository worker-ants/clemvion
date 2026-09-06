# Cross-Spec 일관성 검토 — `spec/5-system/**` (impl-done)

## 컨텍스트

target scope(`spec/5-system/`)의 `origin/main` 대비 spec 델타는 **0개 파일**이다. 이 브랜치는
spec 문서를 바꾸지 않았고, 대신 `codebase/backend/**`(15개 파일 / ~1900줄)에서 `User` 엔티티
컬럼 유출을 막는 검출 계층을 추가했다(`WorkflowVersionsService.findOne` 이 `creator` 관계를
투영 없이 실어 `passwordHash`·2FA 시크릿·복구 코드·토큰을 노출하던 Critical 을 닫고,
`user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축)·
`dto-jsdoc-citation-guard.ts`(JSDoc 인용 축) 세 검증자를 신설). 아래는 이 diff 가 `spec/**`
다른 영역의 기존 정의와 충돌하는지에 대한 판정이다.

## 발견사항

- **[WARNING]** 신규 검증자 3개가 어느 spec `code:` 에도 등재돼 있지 않다 — 단, **이미 같은
  세션이 스스로 발견해 planner 트래커에 등재**했다
  - target 위치: (target 자체는 미변경) — 근거는 diff 의
    `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 충돌 대상:
    - `spec/5-system/2-api-convention.md` §5.4 "검증 층" — *"그 자리를 **두 검증자**가
      나눠 맡는다"* 라는 문장이 이제 사실과 다르다(검증자가 5개: 기존 2 + 신규 3).
    - `spec/conventions/swagger.md` §5-1 — *"**두 검증자**의 경계는 …"* 도 동일하게 낡았다.
    - `spec/conventions/review-citations.md` Rationale ("`code:` 가 '구현 경로' 가 아니라
      '준수 예시' 를 가리키는 이유") — *"이 규약에는 **시행하는 코드가 없다** — 주석 형태를
      강제하는 가드가 없기 때문"* 이라는 전제가 이 diff 로 **거짓이 됐다**.
      `dto-jsdoc-citation-guard.ts` 가 정확히 그 규약(§3, DTO JSDoc 인용 금지)을 AST 로
      강제한다.
    - `spec/conventions/spec-impl-evidence.md` §2.1 — `review-citations.md` 를
      "시행 코드 없는 순수 문서형 convention" 예외로 설명하는 부분도 같은 전제를 공유한다.
  - 상세: `review_guard._spec_linked_changes()` 로 직접 조회한 결과 신규 4파일(가드 3 +
    관련 실측)이 **0건** spec-linked 로 판정된다 — 즉 이 가드들을 약화·삭제해도
    `--impl-done` SPEC-CONSISTENCY 게이트가 안 잡는다. 다만 이 항목은 필자가 처음 발견한
    것이 아니라, **동일 브랜치의 diff 에 포함된**
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미
    (`review/consistency/2026/09/06/10_13_23` W1, 5개 checker 중 4개 독립 보고) 미해결
    체크박스로 등재해 두었다. developer 는 `spec/` 쓰기 권한이 없어 planner 턴으로 정확히
    이월했다 — 이것은 위반이 아니라 규약대로 동작한 것이다.
  - 제안: 그대로 두면 다음 planner 턴에서 §5.4 "검증 층"·`swagger.md §5-1`·
    `review-citations.md` Rationale 세 곳을 함께 갱신해야 한다(개수를 다시 박지 말고 표로
    나열 — 이미 같은 문서가 "두 검증자" 문구를 두 번 낡힌 전례가 있다고 스스로 적어 둠).
    **이 리뷰 라운드에서 새 조치는 불필요** — 기존 트래커 항목을 그대로 진행하면 된다.

- **[INFO]** `User` 민감 7컬럼 노출 금지가 아직 spec 문장이 아니라 코드 상수뿐이다 — 이미 추적됨
  - target 위치: (target 미변경)
  - 충돌 대상: `spec/1-data-model.md` §2.1 User / `spec/conventions/secret-store.md` §1.1
    (Trigger·AuthConfig 는 "비대상 필드도 응답에 나가지 않는다" 규범이 있는데 `User` 에는
    대응 절이 없다)
  - 상세: 불변식의 SoT 가 `USER_SECRET_KEYS` 배열(코드)에만 있다. 데이터 모델 §2.1 은
    `password_hash`·`two_factor_secret`·`totp_recovery_codes`·`webauthn_recovery_codes` 등을
    컬럼으로는 정의하지만 "응답에 노출 금지" 라는 API 계약 문장은 없다. 이 자체는 이번
    diff 가 새로 만든 모순이 아니라 기존 공백이며, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 (`10_13_23` W2) 이미 후속 항목으로 등재했다.
  - 제안: 별도 조치 불요 — 트래커 항목을 planner 턴에서 처리.

- **[INFO]** `WorkflowVersionsService.findOne` 수정과 다른 spec 영역 간 정합 확인 — 충돌 없음
  - target 위치: (target 미변경)
  - 충돌 대상: `spec/3-workflow-editor/5-version-history.md` §7.1/§7.2,
    `spec/1-data-model.md` §2.15 WorkflowVersion
  - 상세: §7.1 은 목록 응답이 `creator` 를 "포함" 한다고만 적고 하위 필드 집합을 명시하지
    않으며, §7.2 는 "`WorkflowVersion` 단건 + `snapshot` 포함" 이라는 느슨한 문구를 쓴다.
    수정 후 `creator` 는 `{id, name, email}` 로 투영되는데, 이는 §7.1 표(목록·상세 모두
    `creator` "포함")·데이터 모델(§2.15 는 `created_by` FK 만 정의하고 `creator` 서브객체
    shape 를 규정하지 않음) 어느 쪽과도 직접 모순되지 않는다. `WorkflowVersionCreatorDto`
    (id/name/email)는 이 PR 이전부터 존재하던 선언이라 이번 diff 가 새로 만든 계약도 아니다.
    같은 투영을 쓰는 자매 메서드(`findByWorkflow`)와도 이제 대칭이다.
  - 제안: 없음. (단, §7.2 의 "`WorkflowVersion` 단건" 이라는 표현이 "엔티티 그대로" 로
    오독될 여지가 있다는 점은 문서를 다음에 건드릴 때 "`WorkflowVersionDto` 단건" 으로
    다듬을 만하나, 이번 diff 의 범위를 벗어나는 문서 다듬기라 별도 지적 없음.)

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드 — 데이터 모델·§5.4 규약과 정합
  - target 위치: (target 미변경)
  - 충돌 대상: `spec/1-data-model.md` §2.3 WorkspaceMember(`joined_at | Timestamp?`),
    `spec/5-system/2-api-convention.md` §5.4(부재 표현 규칙)
  - 상세: 신규 필드는 `@ApiProperty({ nullable: true })` + `joinedAt: string | null` 로
    선언돼 §5.4 "기본형"(상시 존재 키 + `null`) 규칙을 정확히 따른다. 데이터 모델의
    `Timestamp?`(스키마 nullable)와도 모순되지 않는다 — 코드 주석이 "실측상 4개 생성 경로가
    전부 즉시 채운다" 는 것과 "스키마가 nullable" 이라는 것을 명확히 구분해 적어 두었다.
    리뷰 인용을 필드 JSDoc 이 아니라 `//` 주석에 둔 것도 `review-citations.md §3`
    (DTO JSDoc 인용 금지, 회피처는 `//`)을 정확히 지킨다.
  - 제안: 없음.

- **[INFO]** RBAC e2e 주석의 spec 절 인용 정정 (`§1.3` → `§3`) — 정합 회복, 신규 결함 아님
  - target 위치: (target 미변경)
  - 충돌 대상: `spec/5-system/1-auth.md` §3(인가)
  - 상세: `workspace-rbac.e2e-spec.ts` 헤더 주석이 존재하지 않던 "§1.3" 인용을 실제 절
    번호("§3 인가")로 고쳤다. `1-auth.md` 의 실제 구조(§1 인증/§2 세션/§3 인가/§4 감사/§5
    API)와 대조해 정확하다.
  - 제안: 없음.

## 요약

이번 diff(코드 전용, spec 델타 0)는 실제 보안 결함(`GET /api/workflows/:wfId/versions/:versionId`
가 버전 작성자 `User` 전 컬럼을 노출)을 데이터 모델·API 규약(§5.4, `swagger.md §5-1`)과
어긋나지 않는 방식으로 닫았고, 신규 e2e·DTO 필드(`joinedAt`)도 §5.4 부재 표현 규칙·데이터
모델과 정합한다. 유일한 실질적 cross-spec 간극은 신규 검증자 3종(`user-entity-exposure-guard`·
`user-secret-absence`·`dto-jsdoc-citation-guard`)이 어느 spec `code:` 에도 등재되지 않아
"두 검증자" 라 못 박은 §5.4/`swagger.md` 문장과 "시행 코드 없음" 이라 못 박은
`review-citations.md` 전제를 낡게 만든 것인데, 이는 **이 diff 자신이 포함한 planner
트래커 파일(`spec-draft-nullable-notation-followups.md`)에 이미 두 항목으로 정확히 등재돼
있어** 새로 조치할 필요가 없다. 종합적으로 BLOCK 사유 없음.

## 위험도

LOW
