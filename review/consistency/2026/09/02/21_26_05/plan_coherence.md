# Plan 정합성 검토 — `spec-draft-change-password-code-alignment.md`

## 발견사항

- **[WARNING]** 결정①③가 근거로 삼는 원본 plan 에 `9-user-profile.md` 후속이 반영되지 않음
  - target 위치: `plan/in-progress/spec-draft-change-password-code-alignment.md` — `## 결정 ③` (OAuth-only
    안내 문구) 및 `## 변경안` 표 `#12` (`9-user-profile.md:147`), frontmatter `spec_impact`
  - 관련 plan: `plan/in-progress/auth-change-password-oauth-only-code-split.md` — frontmatter
    `spec_impact:` (`1-auth.md`·`3-error-handling.md`·`error-codes.md` 세 개뿐) 및 `## 할 일`
    체크리스트(동일 세 파일 + developer 턴만 나열)
  - 상세: target 은 이 draft 가 "착수 근거" 로 인용하는 `auth-change-password-oauth-only-code-split.md`
    의 **결정 기록**(2026-09-02, D 채택)을 그대로 실행에 옮기는 문서다. 그런데 target 의
    **결정③**("OAuth-only 사용자에게 되는 경로를 알려준다" — `9-user-profile.md:147` 안내 분기
    추가)은 원본 plan 의 "결정 기록" 절에도, `spec_impact` 목록에도, `## 할 일` 체크리스트에도
    **전혀 등장하지 않는 완전히 새로운 항목**이다. `error-codes.md:82` 의 현재 §3 등재 행도
    "미설정 조건을 별도 코드로 분리할지는 미결" 이라며 오직 이 plan 을 결정처로 지목할 뿐, UI
    안내 문구까지 그 범위에 넣지 않는다.
    target 의 `## 변경안` `#13` 은 그 plan 문서를 "옵션 표 재작성 + 결정 기록 신설 + 체크박스
    전환" 범위로만 갱신하도록 지시하며, `9-user-profile.md` 를 그 plan 의 `spec_impact`/체크리스트에
    추가하라는 지시가 없다. 이 상태로 `auth-change-password-oauth-only-code-split.md` 의 남은
    체크박스 3개(`1-auth.md`·`3-error-handling.md`·`error-codes.md`)가 전부 `[x]` 로 바뀌면, 그
    plan 은 "완료" 로 보여 `complete/` 이동 후보가 되지만 실제로는 `9-user-profile.md` 변경이
    그 어느 plan 의 체크리스트에도 매인 적이 없어 추적에서 누락될 위험이 있다(이 저장소가
    `feedback_stale_plan_claims_and_checklist_sync.md`·`feedback_review_fix_stale_loop.md` 에서
    반복 지적한 "미룬 항목이 plan 에 안 적혀 유실" 패턴과 동형).
  - 제안: `auth-change-password-oauth-only-code-split.md` 의 `spec_impact` 에
    `spec/2-navigation/9-user-profile.md` 를 추가하고 `## 할 일` 에 해당 변경 항목을 별도
    체크박스로 신설한다 (target `## 변경안` `#13` 지시에 이 한 줄을 보태면 됨). 또는 target 문서
    자체의 `#13` 서술에 "9-user-profile.md 항목도 함께 등재" 를 명시해 다음 실행자가 놓치지
    않도록 한다.

- **[INFO]** 완전히 실행된 자매 draft 가 `in-progress/` 에 계속 남아 있음
  - target 위치: `plan/in-progress/spec-draft-change-password-code-alignment.md` 헤더 —
    "`#1268` 이 `INVALID_PASSWORD` 를 `error-codes.md §3` 에 ... 등재했다" 인용부
  - 관련 plan: `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md`
  - 상세: 실측 결과 이 draft 의 결정①②③ 이 **전부** 이미 spec 에 반영돼 있다
    (`spec/5-system/2-api-convention.md:205,212,172` 에 `202`/`410`/§5.3 기본값 부재 서술 존재,
    `spec/conventions/error-codes.md:82` 에 `INVALID_PASSWORD` §3 행 존재) 그리고 plan-side
    후속 항목(`ws-token-expired-socket-lifetime-impl.md:65,72`)도 이미 `[x]` 로 "해소" 표시돼
    있다. 즉 이 draft 는 사실상 완료 상태인데 `plan/in-progress/` 에 그대로 남아 있다. target
    의 `#9`("`error-codes.md §3` — `INVALID_PASSWORD` 행 제거")는 바로 이 draft 의 결정③ 산출물을
    되돌리는 편집이라, 이 draft 를 참조하는 다음 사람이 "왜 §3 등재가 다시 빠졌지" 하고 헷갈릴
    여지가 있다(target 자신이 이유는 이미 충분히 설명하고 있어 CRITICAL 은 아님).
  - 제안: target 실행(§3 행 제거) 시점에 `spec-draft-api-convention-status-and-password-codes.md`
    도 함께 `plan/complete/` 로 옮기거나, 최소한 그 문서 상단에 "결정③의 §3 등재는
    `auth-change-password-oauth-only-code-split.md` 의 후속 결정으로 은퇴함" 한 줄을 남겨
    이력 단절을 막는다.

## 요약

target 문서는 자신이 명시적으로 인용하는 선행 plan(`auth-change-password-oauth-only-code-split.md`)의
"결정 기록 — D. 형제와 완전 정렬"을 충실히 따르고 있고, §3→§5 이관·grade B 처분·감사값 존속
caveat 등 핵심 결정 축에서 미해결 결정을 우회하거나 다른 in-progress plan 과 정면으로 충돌하는
지점은 발견되지 않았다. 다만 target 이 새로 도입한 "결정③"(`9-user-profile.md` UI 안내 문구)이
원본 결정-plan 의 `spec_impact`/체크리스트 범위 밖에 있어, 그 plan 이 나머지 체크박스를 채우고
`complete/` 로 이동할 때 이 항목이 추적에서 누락될 구조적 위험이 있다. 부수적으로, target 이
근거로 인용하는 자매 draft(`spec-draft-api-convention-status-and-password-codes.md`)는 실측상
이미 전부 실행 완료 상태인데도 `in-progress/` 에 남아 있어 이력 정리가 필요하다.

## 위험도

LOW
