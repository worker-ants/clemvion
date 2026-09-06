# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 배경

이 브랜치의 `spec/5-system/` scope 델타는 0(spec 미변경)이고, 실질 변경은 `User` 엔티티
민감 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)의 응답 노출을 잡는 신규 검출
가드 2종(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축) 도입 +
`WorkflowVersionsService.findOne` 의 실유출(투영 누락) 수정 + `WorkspaceMemberDto.joinedAt`
필드 추가다. 같은 세션에서 이미 두 차례(`review/consistency/2026/09/06/10_13_23`,
`10_53_50`) plan_coherence 를 포함한 5-checker 검토가 돌았고 둘 다 BLOCK:NO·MEDIUM 으로
동일한 두 WARNING 을 보고했다. 이번(11_27_54) 라운드의 추가 diff(`4d49aa575`→Critical 처분,
`9a186fa31`→투영 리터럴 통합)는 코드 리뷰 지적 처분이며 plan-coherence 성격의 변화는 없다.
아래는 그 상태를 재확인하고, 새 커밋이 새로운 정합성 이슈를 만들지 않았는지 검증한 결과다.

## 발견사항

- **[WARNING]** §5.4 "두 검증자" 서술이 실측을 앞질렀다 — 이미 plan 에 등재된 재발 패턴
  - target 위치: `spec/5-system/2-api-convention.md:227` (§5.4 "검증 층" 소절) — *"그 자리를
    **두 검증자**가 나눠 맡는다"*. 자매 문서 `spec/conventions/swagger.md:371` *"두 검증자의
    경계는 … 이 소유한다"* 도 동일 문제.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "후속" 섹션의
    미완료 항목 `[ ] 신규 검출 2축을 §5.4 「검증 층」과 code: 에 등재` (planner, 2026-09-06
    등재, 출처 `review/consistency/2026/09/06/10_13_23` W1).
  - 상세: 이번 PR 이 도입한 `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`
    (이름 축)까지 합치면 §5.4 노출 검증을 실제로 시행하는 축은 **넷**인데 target 은 여전히
    "둘"이라고 못 박혀 있다. 두 신규 파일은 어느 spec 의 `code:` glob 에도 걸리지 않는다
    (실측 재확인: `grep -n "user-entity-exposure\|user-secret-absence" spec/5-system/2-api-convention.md spec/conventions/swagger.md` → 0건). `review_guard._spec_linked_changes()` 관점에서
    이 4개 신규 파일은 spec-linked 가 아니므로, 후속 PR 이 이 가드를 약화·삭제해도
    `--impl-done` SPEC-CONSISTENCY 게이트가 걸리지 않는 사각지대가 이미 존재한다. **다만
    이 갭은 developer 가 이번 PR 에서 스스로 실측하고 plan 에 정확히 등재해 둔 것**이라
    "일방적 결정 우회"는 아니다 — planner 턴 대기 상태가 정상적으로 추적되고 있다.
  - 제안: `project-planner` 턴에서 `spec/5-system/2-api-convention.md` §5.4 표에 구조 축·
    이름 축 두 행을 추가하고 두 문서(`2-api-convention.md`, `swagger.md`) frontmatter `code:`
    에 신규 파일 패턴을 등재. "두 검증자" 같은 개수 서술은 plan 이 이미 지적한 대로 새
    숫자로 교체하지 말고 표 나열 형태로 바꿀 것(개수 명시는 축이 늘 때마다 매번 낡았다 —
    이번이 세 번째).

- **[WARNING]** `User` 민감 7컬럼 노출 금지가 spec 규범 문장으로 아직 없음 — 이미 plan 에 등재됨
  - target 위치: 이 항목의 자연스러운 배치 후보인 `spec/1-data-model.md §2.1`(User) ·
    `spec/conventions/secret-store.md §1.1` 은 이번 리뷰의 `spec/5-system/` scope **밖**이라
    직접 검사 대상은 아니지만, `spec/5-system/1-auth.md` §1.1(비밀번호 저장)·§4(감사 로그)가
    `password_hash` 등 일부 컬럼을 언급하면서도 "응답에 노출되면 안 된다"는 명시적 금지
    문장은 5-system 어디에도 없다.
  - 관련 plan: 같은 파일의 미완료 항목 `[ ] User 민감 7컬럼의 응답 노출 금지를 규약 문장으로`
    (planner, 2026-09-06 등재, 출처 `10_13_23` W2).
  - 상세: 이 불변식의 단일 진실은 현재 `USER_SECRET_KEYS` 상수(코드)뿐이다. `Trigger`/
    `AuthConfig` 계열은 `secret-store.md §1.1`이 대칭 규범("비대상 필드도 응답 바디에는
    나가지 않는다")을 이미 갖췄는데 `User` 축만 대응 절이 없다 — scope 밖 문서 간 비대칭이라
    본 checker scope 안에서 직접 판정할 대상은 아니지만, 결정 근거(전수 열거 수치·기각한
    두 대안 `select:false`/전역 `ClassSerializerInterceptor`·채택 이유)가 지금
    `plan/in-progress/**`·`CHANGELOG.md` 에만 있어 SoT 배치 규약과 어긋난다는 점은 plan 자체가
    이미 자인하고 있다.
  - 제안: 상동 — planner 턴에서 `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 문장을
    추가하고 `## Rationale` 로 근거를 옮길 것. `spec/5-system/` 범위에서는 조치 불필요(대상
    문서가 scope 밖).

- **[INFO]** 신규 커밋(`4d49aa575`, `9a186fa31`)은 plan-coherence 관점에서 중립
  - target 위치: 해당 없음(코드 전용 변경).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "완료
    (2026-09-06)" 블록.
  - 상세: 두 커밋은 각각 직전 코드 리뷰(`10_13_22` Critical 1, `10_53_48` W1)의 처분이다 —
    관계 매칭을 이름 기반에서 타입 기반으로 넓혀 `WorkflowVersion.creator` 유출을 닫았고,
    투영 리터럴 `{id,name,email}` 을 `CREATOR_PROJECTION` 상수로 통합해 DTO 스키마와의 일치를
    테스트로 강제했다. 이 과정에서 plan 이 이미 등재한 두 미해결 항목(위 WARNING 둘)의
    범위나 내용은 바뀌지 않았고, 새로운 미등재·미해소 항목도 생기지 않았다. `plan` 의
    "완료" 서술 자체는 두 커밋 이후에도 여전히 정확하다(전수 열거 수치·선택 근거 불변).
  - 제안: 조치 불요 — 다음 planner 턴에서 위 두 WARNING 을 처리할 때 이 통합
    (`CREATOR_PROJECTION`)을 근거 예시로 함께 인용하면 좋다(선택).

- **[INFO]** §5.4 drift 스윕 2단계 카운트가 이번 라운드로 다시 한 칸 늘었을 수 있음
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift
    배치 — 2단계" 항목(수치 미표시, 별도 섹션).
  - 관련 plan: 동일 파일, 이미 `10_13_23` INFO#3 이 "18→19(`WorkspaceMemberDto`)" 로 지적,
    본 파일도 "다음에 그 시점 실측치로 다시 센다" 라고 스스로 못 박아 둠.
  - 상세: 이번 라운드에서 `WorkflowVersionDto`(workflow-crud e2e `H.` 케이스)가
    `assertMatchesContract` 로 새로 배선됐다 — plan 문서에 이미 "WorkspaceMemberDto ·
    WorkflowVersionDto 둘" 로 반영되어 있어 실측 자체는 최신이다. 다만 "2단계" 섹션 본문의
    숫자(스윕 대상 DTO 개수)는 그 항목을 실제로 열 때 다시 세라고 plan 이 명시했으므로 현재
    상태로 불일치는 아니다.
  - 제안: 조치 불요 — 스윕 2차 착수 시점에 자연 해소.

## 요약

이번 라운드의 코드 변경(신규 `User` 노출 검출 가드 2종 + `WorkflowVersionsService.findOne`
투영 수정 + `joinedAt` 필드)은 `spec/5-system/` 을 직접 건드리지 않았고, 이전 두 라운드
(`10_13_23`, `10_53_50`)가 이미 정확히 짚은 두 개의 WARNING — §5.4 "두 검증자" 서술의 실측
초과, `User` 7컬럼 노출 금지 규범의 부재 — 은 여전히 유효하지만 **새로운 미반영이 아니라
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대기 항목으로
이미 정확히 등재돼 있다.** developer 는 이번 PR 에서 이전에 열려 있던 "`User` 컬럼 수준
방어를 둘지" 결정을 전수 열거로 매듭짓고, spec 변경이 필요한 부분은 스스로 판단해 커밋하지
않고 plan 항목으로 넘겼다 — 미해결 결정 우회나 선행 plan 무시는 없다. 이번 라운드에 새로
추가된 두 커밋(Critical 처분·투영 리터럴 통합)도 plan 이 추적하는 항목의 범위·수치를 바꾸지
않아 추가로 갱신할 곳이 없다. 유일한 실질 조치는 두 WARNING 을 처리할 project-planner 턴이며,
이는 이미 최우선 항목으로 plan 에 못 박혀 있다.

## 위험도

LOW
