# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

이번 라운드는 `spec/5-system/` 자체의 델타가 0개 파일이라 (코드 전용 PR), 검토는
"코드 변경이 이미 존재하는 여러 spec 영역(auth / data-model / api-convention /
swagger 규약 / secret-store 규약)이 서로 맞물려 요구하는 것과 충돌하는가" 관점으로
수행했다. 프롬프트에 포함된 diff 는 예산 초과로 생략돼 있어, 지시에 따라 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`,
HEAD)를 `git diff origin/main...HEAD` 로 직접 열어 실제 변경분(12개 파일,
`codebase/` + `plan/`)을 확인했다.

## 발견사항

- **[WARNING]** 신규 `User` 노출 방어 가드 2벌이 관련 spec 어디의 `code:` 에도 등재되지 않음
  - target 위치: (코드) `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `.../user-entity-exposure.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`,
    `.../user-secret-absence.spec.ts` — 이번 diff 로 신규 추가
  - 충돌 대상: `spec/5-system/2-api-convention.md` frontmatter `code:` (§5.4 "검증 층"
    소절이 `response-contract*.ts`/`swagger-dto-contract*.ts` 를 이 정확한 역할로 설명),
    `spec/conventions/swagger.md` frontmatter `code:` (§5-1 "엔티티 패스스루 금지"),
    `spec/1-data-model.md` frontmatter `code:` (User 엔티티 자체)
  - 상세: 새 가드 2벌(`user-entity-exposure-guard.ts`=구조 축, `user-secret-absence.ts`=값
    축)은 `2-api-convention.md` §5.4 「검증 층」이 이미 이름 붙여 설명하는 것과 같은
    역할 — "선언 ↔ 선언" 및 "값 ↔ 선언" 대조 — 을 `User` 엔티티 노출이라는 구체 사례에
    대해 수행한다. 그런데 §5.4 「검증 층」 표와 `swagger.md` §5-1 은 여전히 기존 두
    검증자(`swagger-dto-contract-guard.ts`, `response-contract.ts`)만 나열하고, 세 spec
    문서(`1-data-model.md`, `2-api-convention.md`, `swagger.md`) 어디의 `code:` glob 도
    `user-entity-exposure*`/`user-secret-absence*` 를 포함하지 않는다 (`grep -rn
    "user-entity-exposure\|user-secret-absence" spec/` → 0건, 프론트매터 직접 확인 완료).
    이 저장소는 정확히 같은 패턴의 실패를 하루 전에 겪었다 — `response-contract.ts` 를
    두 문서 중 한쪽에만 등재했다가 사각지대가 생긴 것을 실측으로 확인하고 양쪽에
    등재했다(§5.4 본문 "그 검증자는 **양쪽 문서의 `code:` 에 모두 등재**돼 있다" 문구가
    그 결정의 흔적). 지금 신규 가드 2벌은 그 교훈이 적용되기 **전** 상태로 다시 남아 있다
    — `review_guard._spec_linked_changes()` 관점에서 이 4개 신규 파일은 spec-linked 가
    아니므로, 이후 이 가드들이 약화·삭제돼도 `--impl-done` 게이트가 그 변경을 spec
    재검토 대상으로 못 잡는다.
  - 제안: `1-data-model.md`(User 엔티티 절) 또는 `2-api-convention.md`/`swagger.md`
    frontmatter `code:` 에 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts`
    · `codebase/backend/src/shared/testing/user-secret-absence*.ts` 를 추가하고, §5.4
    「검증 층」 표에 두 행(구조 축/이름 축)을 보탠다. **이 항목은 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당으로
    등재돼 있다** (2026-09-06, `review/consistency/2026/09/06/10_13_23` W1 인용) — 새
    발견이 아니라 아직 미해소 상태의 재확인.

- **[WARNING]** `User` 민감 7컬럼의 "응답 비노출" 불변식이 spec 문장이 아니라 코드에만 존재 — 대칭 도메인과 비교해 비대칭
  - target 위치: (코드) `codebase/backend/src/shared/testing/user-secret-absence.ts` 의
    `USER_SECRET_KEYS` (passwordHash·twoFactorSecret·totpRecoveryCodes·
    webauthnRecoveryCodes·emailVerifyToken·passwordResetToken·emailChangeToken)
  - 충돌 대상: `spec/1-data-model.md §2.1 User` (동일 7컬럼을 `password_hash` 등으로
    문서화하지만 노출 금지 문장 없음) vs `spec/conventions/secret-store.md §1.1
    "비대상 필드도 응답 바디에는 나가지 않는다"` (Trigger/AuthConfig 인접 필드에 대해
    정확히 이 규범을 2026-09-05 에 신설)
  - 상세: `secret-store.md §1.1` 은 "이 컬럼들이 응답에 나가면 안 된다"는 요구가 이전에는
    `spec/**` 어디에도 정규 문장으로 없었고 실제로 두 엔드포인트에서 샜다는 것을 근거로
    신설된 절이며, 시행 축을 "API 규약 §5.4 응답-계약 검증 + Swagger 규약 §5-1 엔티티
    패스스루 금지" 두 개로 명시한다. 그런데 지금 이번 diff 가 고친 유출
    (`WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 `GET
    /api/workflows/:wfId/versions/:versionId` 에 실어 보낸 것, `review/code/2026/09/06/10_13_22`
    Critical 1)은 `secret-store.md §1.1` 이 다루는 도메인(Trigger·AuthConfig)이 아니라
    `User` 엔티티 자체다. `User` 는 `1-auth.md`·`1-data-model.md` 어디에도 이 절과
    대응하는 문장이 없다 (grep 확인: "응답 바디"·"응답에 나가" 류 문구 부재). 같은
    엔티티가 같은 실패 패턴(투영 누락 → 엔티티 통째 반환)으로 이미 한 번 샌 뒤인데도,
    그 불변식의 SoT 는 여전히 코드(`USER_SECRET_KEYS` 상수)뿐이다 — `select:false`
    0건·`@Exclude()` 0건·전역 `ClassSerializerInterceptor` 0건(diff 에 동봉된 plan 실측).
  - 제안: `1-data-model.md §2.1` (또는 `secret-store.md` 와 나란히 새 절)에 "User 의
    이 7컬럼은 응답 DTO 에 선언되어서도, 응답 바디에 실려서도 안 된다" 는 규범 문장을
    `secret-store.md §1.1` 과 같은 형태로 추가하고, 두 가드를 그 절의 근거로 링크한다.
    **이 항목도 이미 같은 plan 파일에 W2 로 planner 담당 등재돼 있다**
    (`review/consistency/2026/09/06/10_13_23` W2 인용) — 새 발견이 아니라 미해소 재확인.

## 검토했으나 충돌 없음으로 판정한 항목 (참고용)

- `WorkspaceMemberDto.joinedAt: string | null` 신규 필드 — `1-data-model.md §2.3
  WorkspaceMember` 의 `joined_at Timestamp?` 와 타입 일치, `@ApiProperty({nullable:true})`
  선언도 `2-api-convention.md §5.4` "기본형"(상시 존재 + null) 규칙과 정확히 부합. 충돌 없음.
- `WorkflowVersionsService.findOne` 이 `relations: ['creator']` → `select` 투영으로 좁아진
  것 — `spec/3-workflow-editor/5-version-history.md §7.2` 는 상세 응답에 `creator` 포함을
  요구할 뿐 전체 컬럼을 요구하지 않으므로, 이번 수정은 기존 DTO 계약
  (`WorkflowVersionCreatorDto` = id/name/email)에 실제 쿼리를 맞춘 정합화다. 충돌 없음.
- `WorkflowVersionCreatorDto`/`WorkflowVersionListItemDto.creator` 가 `field?: T | null`
  (optional **+** nullable 동시) 로 선언된 것은 `2-api-convention.md §5.4` 의 "DTO 선언
  형태" 규칙(생략형은 `?`만, 상시형은 `| null`만)과 문자 그대로는 어긋나 보이지만, 이번
  diff 가 그 선언을 새로 쓰거나 변경하지 않았고(기존 코드), §5.4 자체가 "본 규칙은 …
  **앞으로 도입·변경되는 필드**에 적용한다(소급 적용 대상 아님)" 라고 명시하므로 이번
  round 의 target 은 아니다.

## 요약

이번 diff 자체(투영 누락 수정·`joinedAt` 필드 노출·이름/구조 이중 방어 가드 신설)는
관련된 모든 spec 영역(`1-data-model.md`, `3-workflow-editor/5-version-history.md`,
`5-system/1-auth.md`, `5-system/2-api-convention.md`)의 기존 계약과 직접 모순되지
않으며, 오히려 문서화된 계약(`WorkflowVersionCreatorDto` 3필드·`joined_at` nullable)에
구현을 정합시키는 방향이다. 다만 이 작업이 낳은 새 검출 코드 2벌이 어느 spec 의
`code:` 에도 걸리지 않는 점, 그리고 `User` 민감 컬럼 비노출이라는 불변식이
대칭적인 `secret-store.md §1.1` 과 달리 `User`/`1-data-model.md` 쪽에는 규범 문장으로
없는 점은 실질적인 cross-spec 정합성 공백이다. 두 항목 모두 새로 발견한 것이 아니라
같은 브랜치의 선행 라운드(`review/consistency/2026/09/06/10_13_23`)에서 이미 W1/W2 로
식별돼 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당으로
등재돼 있으며, 이번 라운드 기준으로도 아직 해소되지 않았음을 재확인했다.

## 위험도

MEDIUM — 활성 모순(CRITICAL)은 없다. 다만 두 WARNING 은 "보안 경계를 검출하는 코드가
spec 게이트 사각지대에 있다"는 같은 성격의 반복(§5.4 검증 층이 하루 전 겪은 실패
패턴의 재현)이라, 방치 기간이 길어질수록 다음 유출이 같은 방식(가드가 조용히
약화돼도 아무 게이트도 안 걺)으로 재발할 여지가 쌓인다. 이미 plan 에 추적 중이므로
즉시 차단할 사안은 아니나, 다음 planner 턴에서 우선 처리 권고.
