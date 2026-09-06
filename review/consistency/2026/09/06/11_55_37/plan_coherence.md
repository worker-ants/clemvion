# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 배경

이 브랜치의 `spec/5-system/` scope 델타는 이번 라운드도 0(spec 미변경)이다. 실질 변경은
`User` 엔티티 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`) 노출을
잡는 신규 검출 가드 2종(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts`
이름 축) + `WorkflowVersionsService` 투영 수정이다. 같은 세션에서 이미 세 차례
(`10_13_23`·`10_53_50`·`11_27_54`) plan_coherence 를 포함한 5-checker 검토가 돌았고 매번
BLOCK:NO 로 동일한 두 WARNING 을 보고했다.

이번(`11_55_37`) 라운드의 신규 diff 는 커밋 `01b078379` 하나뿐이다 — `11_27_53` 코드 리뷰
WARNING 4건(가드가 `select:{creator:true}` 같은 "겉보기 투영 · 실은 전체 노출" 을 통과시킨
결함, eager relation 스캔 공백, stale 숫자 제목, 반환 타입이 여전히 `User` 전체를 약속하는
문제)을 처분한 것이다. 커밋 메시지 자신이 명시하듯 `11_27_54` consistency WARNING 2건은
"3차 재확인된 planner 항목이라 코드 변경 없음" — 실측으로 확인: 이 커밋은
`codebase/backend/.../workflow-versions.service.ts` ·
`.../fixtures/user-relation-load.fixture.ts` ·
`.../__tests__/user-entity-exposure-guard.ts` ·
`.../__tests__/user-entity-exposure.spec.ts` 4개 코드 파일과 `review/consistency/2026/09/06/11_27_54/**` 산출물만 건드렸고, `plan/**`·`spec/**` 는 변경하지 않았다
(`git show --stat 01b078379` 로 확인). 따라서 아래 두 WARNING 은 **4차 재확인**이며 새로운
정합성 문제는 없다.

## 발견사항

- **[WARNING]** §5.4 "두 검증자" 서술이 실측을 앞질렀다 — 이미 plan 에 등재된 재발 패턴 (4차 재확인)
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층" 소절 — *"그 자리를
    **두 검증자**가 나눠 맡는다"*. 자매 문서 `spec/conventions/swagger.md` §5-1 *"두 검증자의
    경계는 … 이 소유한다"* 도 동일 문제.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "후속" 섹션의
    미완료 항목 `[ ] 신규 검출 2축을 §5.4 「검증 층」과 code: 에 등재` (planner, 2026-09-06
    등재, 출처 `review/consistency/2026/09/06/10_13_23` W1).
  - 상세: 이 PR 이 도입한 `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`
    (이름 축)까지 합치면 §5.4 노출 검증을 실제로 시행하는 축은 **넷**인데 target 은 여전히
    "둘"이라고 못 박혀 있다. 두 신규 파일은 어느 spec 의 `code:` glob 에도 걸리지 않는다
    (재확인: `grep -n "user-entity-exposure\|user-secret-absence" spec/5-system/2-api-convention.md spec/conventions/swagger.md` → 0건). `review_guard._spec_linked_changes()` 관점에서 이
    4개 신규 파일은 spec-linked 가 아니므로, 후속 PR 이 이 가드를 약화·삭제해도
    `--impl-done` SPEC-CONSISTENCY 게이트가 걸리지 않는 사각지대가 이미 존재한다. **이 갭은
    developer 가 스스로 실측하고 plan 에 정확히 등재해 둔 것**이라 "일방적 결정 우회"는
    아니다 — `spec/` 쓰기 권한이 없는 developer 가 planner 턴 대기 상태를 정상적으로
    추적하고 있다. 이번 라운드에 추가된 커밋(`01b078379`)은 가드 내부 판정 로직만
    강화했을 뿐(`isObjectLiteralExpression`→"불리언이 아닌가" 술어 반전, eager relation
    스캔 신설) 두 신규 파일의 이름·경로를 바꾸지 않았으므로 이 WARNING 의 범위·근거는
    그대로다.
  - 제안: `project-planner` 턴에서 `spec/5-system/2-api-convention.md` §5.4 표에 구조 축·
    이름 축 두 행을 추가하고 두 문서(`2-api-convention.md`, `swagger.md`) frontmatter `code:`
    에 신규 파일 패턴을 등재. "두 검증자" 같은 개수 서술은 plan 이 이미 지적한 대로 새
    숫자로 교체하지 말고 표 나열 형태로 바꿀 것(개수 명시는 축이 늘 때마다 매번 낡았다 —
    지금까지 세 번).

- **[WARNING]** `User` 민감 7컬럼 노출 금지가 spec 규범 문장으로 아직 없음 — 이미 plan 에 등재됨 (4차 재확인)
  - target 위치: 이 항목의 자연스러운 배치 후보인 `spec/1-data-model.md §2.1`(User) ·
    `spec/conventions/secret-store.md §1.1` 은 이번 리뷰의 `spec/5-system/` scope **밖**이라
    직접 검사 대상은 아니지만, `spec/5-system/1-auth.md` §1.1(비밀번호 저장)·§4(감사 로그)가
    `password_hash` 등 일부 컬럼을 언급하면서도 "응답에 노출되면 안 된다"는 명시적 금지
    문장은 5-system 어디에도 없다(재확인: `spec/1-data-model.md §2.1` User 표에도 노출 금지
    문구 부재).
  - 관련 plan: 같은 파일의 미완료 항목 `[ ] User 민감 7컬럼의 응답 노출 금지를 규약 문장으로`
    (planner, 2026-09-06 등재, 출처 `10_13_23` W2).
  - 상세: 이 불변식의 단일 진실은 현재 `USER_SECRET_KEYS` 상수(코드)뿐이다. `Trigger`/
    `AuthConfig` 계열은 `secret-store.md §1.1`이 대칭 규범("비대상 필드도 응답 바디에는
    나가지 않는다")을 이미 갖췄는데 `User` 축만 대응 절이 없다 — scope 밖 문서 간 비대칭이라
    본 checker scope 안에서 직접 판정할 대상은 아니지만, 결정 근거(전수 열거 수치·기각한
    두 대안 `select:false`/전역 `ClassSerializerInterceptor`·채택 이유)가 지금
    `plan/in-progress/**`·`CHANGELOG.md` 에만 있어 SoT 배치 규약과 어긋난다는 점은 plan 자체가
    이미 자인하고 있다. 이번 라운드 diff 는 이 항목에 영향을 주지 않았다.
  - 제안: 상동 — planner 턴에서 `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 문장을
    추가하고 `## Rationale` 로 근거를 옮길 것. `spec/5-system/` 범위에서는 조치 불요(대상
    문서가 scope 밖).

- **[INFO]** 신규 커밋(`01b078379`)은 plan-coherence 관점에서 중립
  - target 위치: 해당 없음(코드 전용 변경, `plan/**`·`spec/**` 미터치).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "완료
    (2026-09-06)" 블록.
  - 상세: 이 커밋은 직전 코드 리뷰(`11_27_53`) WARNING 4건의 처분이다 — 투영 판정 술어를
    "객체 리터럴인가"에서 "불리언이 아닌가"로 반전(래칫이 놓친 `select:{creator:true}` 형태
    차단), eager relation(`@ManyToOne(..., {eager:true})`) 을 엔티티 데코레이터 레벨에서
    스캔하는 축 신설, 반환 타입을 `ProjectedCreator` 로 좁혀 컴파일 타임에 `User` 전체
    접근을 차단. 세 조치 모두 **기존에 등재된 "구조 축" 가드 파일 내부**의 정밀도 개선이라
    spec `code:` 등재 대상 파일 집합(경로)이 늘지 않았고, 위 두 WARNING 이 요구하는 등재
    범위도 바뀌지 않았다. `git show --stat 01b078379` 로 `plan/**`·`spec/**` 무변경을 재확인.
  - 제안: 조치 불요 — 다음 planner 턴에서 §5.4 표에 두 행을 추가할 때, eager-relation 축이
    같은 "구조 축" 파일(`user-entity-exposure-guard.ts`) 안의 세부 판정 방식이지 별도
    행/축은 아님을 참고(파일 단위로 `code:` 등재하므로 세부 판정 로직 변경은 재등재를
    요구하지 않는다).

## 요약

이번 라운드의 유일한 신규 diff(`01b078379`)는 직전 코드 리뷰 WARNING 처분이며 `plan/**`·
`spec/**` 를 건드리지 않았다. 세 차례 앞선 라운드(`10_13_23`·`10_53_50`·`11_27_54`)가 이미
정확히 짚은 두 WARNING — §5.4 "두 검증자" 서술의 실측 초과, `User` 7컬럼 노출 금지 규범의
부재 — 은 여전히 유효하지만 **새로운 미반영이 아니라**
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대기 항목으로
정확히 등재돼 있다. developer 는 "`User` 컬럼 수준 방어를 둘지" 결정을 전수 열거로 매듭짓고
(사용자 결정 2026-09-06, 구조 축 + 이름 축 채택), spec 변경이 필요한 부분은 스스로 판단해
커밋하지 않고 plan 항목으로 넘겼다 — 미해결 결정 우회나 선행 plan 무시는 없다. 4회 연속
같은 두 WARNING 이 재확인되는 것은 우선순위 신호로 남겨 둘 가치가 있지만, developer 권한
밖의 `spec/` 쓰기가 원인이므로 이 라운드에서 추가로 집행할 조치는 없다.

## 위험도

LOW
