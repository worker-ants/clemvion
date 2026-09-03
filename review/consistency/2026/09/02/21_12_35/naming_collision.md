# 신규 식별자 충돌 검토 — `spec-draft-change-password-code-alignment.md`

## 검토 요약

이 target 은 **신규 식별자를 0개** 도입하는 것이 설계 그 자체의 핵심이다 (결정 ①: "새 코드를
만들지 않는다"). `changePassword` 의 두 실패 조건을 신규 코드로 분리하는 대신, 이미
`AuthService.verifyPasswordForUser` 가 쓰는 기존 코드 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
로 흡수시키고, 폐기되는 `INVALID_PASSWORD` 를 `error-codes.md §3` → `§5`(Rename 이력)로
이관한다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 어느
축에서도 새 식별자가 생기지 않으므로, 통상적 의미의 "신규 식별자 vs 기존 사용처" 충돌은
근본적으로 발생할 여지가 좁다. 아래는 그럼에도 확인한 항목과, 재사용 확장·폐기 이관이
기존 문서·코드와 실제로 정합하는지 실측한 결과다.

## 실측 확인 (충돌 없음)

- `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 참조처는 저장소 전체에서
  `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`
  3개 파일뿐(grep 확인) — 전부 target 의 `spec_impact` 범위 안이라, "발행처에 `changePassword`
  추가" 로 넓히는 것이 범위 밖 문서와 충돌할 여지가 없다.
- `spec/1-data-model.md:710`(§2.18.2 LoginHistory `failure_reason`) 과
  `spec/data-flow/2-auth.md:76` 의 `INVALID_PASSWORD` 감사값 서술은 target 이 인용하는 그대로
  이미 존재 — target 이 근거로 삼는 "감사값은 레이어가 달라 존속한다" 주장은 실측과 일치한다.
- `error-codes.md §5` 기존 3행(`LLM_CONFIG_NOT_FOUND`·`LLM_CONFIG_INVALID`·`INVALID_INPUT`·
  `WORKSPACE_REQUIRED`)을 확인 — "두 번째 B 등급" 주장(`INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`,
  `#1193` 가 유일한 기존 B)도 실측과 일치한다.
- `error-codes.md §3` `INVALID_PASSWORD` 행에 대한 외부 앵커 참조는 `3-error-handling.md:50`
  뿐(grep 전수) — 그 파일도 target 의 변경안 #4 가 같이 갱신하므로, §3 행 제거가 dangling
  reference 를 남기지 않는다.
- `plan/in-progress/spec-draft-change-password-code-alignment.md` 파일명은 기존
  `spec-draft-*` 명명 컨벤션(예: `spec-draft-api-convention-status-and-password-codes.md`)을
  따르고, `plan/in-progress/` 안에 동일·근접 파일명 없음(디렉토리 리스팅 확인) — 파일 경로
  충돌 없음.
- `codebase/frontend/src` 전수 grep — `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD`
  0건. FE 가 코드 기반 분기를 하지 않는다는 target 의 실측 주장과 일치하며, 재사용 확장이
  숨은 FE 분기와 충돌할 여지도 없다.

## 발견사항

- **[INFO]** 폐기한 대안 `PASSWORD_NOT_SET` 이 이미 다른 레이어에서 실사용 중 — target 의
  "3종→4종" 근거를 더 강하게 뒷받침할 수 있는 사실이 문서화되지 않음
  - target 신규 식별자: (도입되지 않음 — 결정 ①에서 폐기된 후보 `PASSWORD_NOT_SET`)
  - 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:330` —
    `AuthService.login` 이 OAuth-only 계정으로 **로그인**을 시도할 때
    `login_history.failure_reason = 'PASSWORD_NOT_SET'` 로 기록한다(wire 코드는 `LOGIN_FAILED`
    그대로, 감사값만 이 이름). `spec/1-data-model.md:710` 의 `failure_reason` 열거값
    목록에는 이 값이 **등재돼 있지 않다**(target 범위 밖의 기존 spec 갭, 여기서는 참고만).
  - 상세: target 의 Rationale 은 `PASSWORD_NOT_SET` 신설을 기각한 이유로 "`PASSWORD_*`
    근접 명명이 3종에서 4종으로 늘어난다"만 든다. 그런데 실제로는 그보다 구체적인 위험이
    있다 — `PASSWORD_NOT_SET` 이라는 문자열은 **이미 다른 흐름(로그인)의 감사 사유값으로
    존재**한다. 만약 원안대로 `changePassword` 의 wire 에러 코드로 `PASSWORD_NOT_SET` 을
    신설했다면, "같은 이름이 wire 코드와 감사값 양쪽에서 다른 조건을 가리키는" — 이 draft가
    `INVALID_PASSWORD` 에서 없애려는 것과 **완전히 같은 패턴의 충돌**을 새로 하나 더
    만들었을 것이다(로그인 시도 "비밀번호 없음" vs 비밀번호 변경 시도 "비밀번호 없음" —
    조건은 유사하지만 트리거 흐름이 다르다). 결과적으로 이 draft 는 그 충돌을 (의도했든
    아니든) 정확히 회피했지만, 그 사실 자체가 근거로 기록되지 않았다.
  - 제안: 채택된 결정 자체를 바꿀 필요는 없다(형제 코드 재사용이 이미 최선). 다만
    `plan/in-progress/auth-change-password-oauth-only-code-split.md` 의
    "원안(`PASSWORD_NOT_SET` 신설)을 폐기한 이유" 문단 또는 target 의 결정 ① Rationale에
    한 줄을 보태 두면, 다음에 이 대안이 재검토될 때(예: B 등급 재논의) 근거가 "이름이
    붐빈다"가 아니라 "실제로 감사 레이어에 동명 값이 이미 있어 재도입 시 wire/audit 동명
    충돌을 재생산한다"로 더 구체화된다. Blocking 사유는 아니다.

## 요약

target 은 설계상 신규 식별자를 만들지 않고 기존 카탈로그의 `PASSWORD_REQUIRED`/
`PASSWORD_INVALID` 재사용과 `INVALID_PASSWORD` 의 §3→§5 이관만으로 정렬을 달성한다. 재사용·
이관 대상 코드의 모든 참조처를 전수 확인한 결과 target 의 `spec_impact` 범위(3개 spec 파일)
밖에서 이 코드들을 다른 의미로 쓰는 곳은 없고, §3 행 제거로 끊어지는 외부 앵커도 없으며,
plan 파일명도 기존 컨벤션과 충돌하지 않는다. 유일한 발견은 폐기된 대안 `PASSWORD_NOT_SET`
이 이미 로그인 흐름의 감사값으로 존재한다는 점인데, 이는 target 이 그 대안을 기각한 결정을
오히려 강화하는 사실이라 INFO 수준의 문서 보강 제안에 그친다.

## 위험도

NONE
