# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 점검 배경

target(`spec/5-system/`) 자체의 diff 는 **0개 파일**이다 (이 브랜치는 `spec/5-system/` 을 건드리지
않는다). 실제 구현 diff 는 `User` 엔티티 컬럼 노출 방어(검출 2축) 관련 12개 파일/1562줄이며,
`plan/in-progress/spec-draft-nullable-notation-followups.md` 자체도 이 브랜치에서 130줄
갱신됐다(완료 기록 + 후속 항목 2건 신규 등재). 따라서 본 검토는 "target 이 0-delta 인 것이
plan 의 미해결 결정·후속 항목과 여전히 정합한가" 를 확인하는 데 집중했다.

## 발견사항

- **[INFO]** 신규 검출 2축이 `spec/5-system/2-api-convention.md` §5.4 「검증 층」/`code:` 에 아직 미등재 — 이미 plan 에 정확히 추적 중
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층" (frontmatter `code:` 9항목,
    §5.4 "검증 층" 표 2행 — `swagger-dto-contract-guard.ts` / `response-contract.ts` 만 등재)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 이 브랜치가 신설한
    항목 "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재" (planner, 2026-09-06 등재)
  - 상세: 이 브랜치가 새로 만든 `user-entity-exposure-guard.ts`(구조 축, `repo-guards/__tests__/`)와
    `user-secret-absence.ts`(이름 축, `shared/testing/`)는 직접 실측(`git -C <worktree> show
    HEAD:spec/5-system/2-api-convention.md` 프런트매터 확인)으로도 어느 `code:` glob 에도
    걸리지 않는다. plan 항목이 스스로 `review_guard._spec_linked_changes()` 조회로 "0건"을
    확인해 둔 그대로다 — 즉 이 두 파일을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가
    `2-api-convention.md` 재검토를 트리거하지 않는다. 다만 이것은 **새로 발견한 갭이 아니라
    이 브랜치 자신이 이미 정확히 등록해 둔 항목**이다 — planner 소유, 다음 단계(§5.4 표에 두
    행 추가 + 두 문서 `code:` 동시 등재 — 하루 전 자매 항목(#1289)의 "한쪽만 등재하면 사각지대"
    교훈을 스스로 인용)까지 명시돼 있다. developer 가 이번 브랜치에서 `spec/` 을 직접 고치지
    않은 것도 규약대로다(spec 변경은 planner 턴, 자기-반증형 소정정 예외에도 해당 없음 — 이
    두 파일은 developer 가 spec 에 쓴 예고 문장이 아니라 순수 신규 코드).
  - 제안: 별도 조치 불요 — plan 이 이미 정확한 갱신 대상(§5.4 표 + 2문서 `code:`)과 순서를
    적어 뒀다. 다음 planner 턴에서 이 항목을 우선순위 있게 집행할 것을 권장(보안 인접
    게이트 사각지대이므로).

- **[INFO]** `User` 민감 7컬럼 노출 금지 불변식의 SoT 가 spec 이 아니라 코드뿐 — 이미 plan 에 추적 중
  - target 위치: `spec/1-data-model.md` §2.1(User) — target scope(`spec/5-system/`) 밖이지만
    plan 항목이 지목한 목적지
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 신설 항목 "`User`
    민감 7컬럼의 응답 노출 금지를 규약 문장으로" (planner, 2026-09-06 등재)
  - 상세: `Trigger`/`AuthConfig` 계열은 `spec/conventions/secret-store.md §1.1` 이 "비대상
    필드도 응답 바디에는 나가지 않는다" 는 규범을 명문화해 뒀는데, `User` 의 동일 불변식은
    코드(`USER_SECRET_KEYS` 배열)에만 있고 대응하는 spec 절이 없다. plan 항목이 목적지
    (`1-data-model.md §2.1` 또는 `secret-store.md §1.1`)와 근거 이관 대상(현재 plan·CHANGELOG
    에만 있는 전수 열거 수치·기각한 대안·채택 이유를 해당 문서 `## Rationale` 로)까지 이미
    적어 뒀다.
  - 제안: 별도 조치 불요 — 위 항목과 함께 다음 planner 턴에서 집행.

## 확인했으나 충돌 없음으로 판정한 항목 (참고)

- **미해결 결정 우회 여부**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  "`User` 엔티티에 컬럼 수준 방어를 둘지 결정" 항목이 이 브랜치에서 `[x]` 로 닫혔다. 두 원안
  (`select:false` / 전역 `ClassSerializerInterceptor`) 대신 제3의 길(검출 2축, 방어 아님)을
  택했지만, 완료 기록이 "**사용자 결정** 2026-09-06" 으로 명시돼 있어 developer 의 일방적
  override 가 아니다. 두 원안을 기각한 근거(공유 로더 46곳 재배선 비용 / 응답 직렬화 최초
  도입 리스크)도 실측 수치와 함께 적혀 있다. CRITICAL 아님.
- **선행 plan 미해소 여부**: `plan/in-progress/spec-sync-user-profile-gaps.md` 의 아바타 TOCTOU
  유예 항목이 "`User` 스냅샷 전체 `save()` 가 새로 생기면 전제가 무너진다" 고 명시하는데,
  이 브랜치의 diff 는 `.save(` 호출을 전혀 추가하지 않는다(순수 조회 경로 프로젝션 방어) —
  그 유예의 전제는 이 브랜치로 훼손되지 않는다.
  - 신규 `WorkspaceMemberDto.joinedAt` 필드는 §5.4 "기본형"(상시 존재 + `null`) 규칙과
    `@ApiProperty({ nullable: true })` + `field: T | null` 선언 형태를 그대로 따른다 — 새
    필드가 target 이 정한 표현 규칙과 충돌하지 않는다.
- **후속 항목 누락 여부(다른 plan)**: `workflow-versions`·`user-entity-exposure`·
  `user-secret-absence`·`USER_SECRET_KEYS` 문자열로 `plan/in-progress/` 전체를 훑었을 때
  이 브랜치를 참조하거나 이 브랜치로 무효화되는 다른 plan 파일은 없다(유일하게 걸리는 파일이
  이 브랜치가 직접 갱신한 `spec-draft-nullable-notation-followups.md` 자신).

## 요약

target(`spec/5-system/`)에는 이번 브랜치로 인한 직접 변경이 없고, 구현이 만든 두 개의
실질적인 spec-code 갭(§5.4 검증 층 미등재, `User` 노출 금지 규범 부재)은 모두 이 브랜치가
스스로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유·구체적
실행 계획과 함께 정확히 등재해 뒀다. 미해결 결정을 우회한 사례, 선행 plan 의 전제를 무너뜨린
사례, 다른 plan 의 후속 항목을 무효화한 사례는 발견되지 않았다. Plan 정합성 관점에서는 이
브랜치를 차단할 사유가 없으며, 등재된 두 planner 항목의 신속한 집행만 권장된다.

## 위험도

LOW
