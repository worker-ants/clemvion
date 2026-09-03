# Cross-Spec 일관성 검토 — `spec-draft-change-password-code-alignment.md`

검토 대상: `plan/in-progress/spec-draft-change-password-code-alignment.md`
검토 방식: bundle 이 예산 초과로 `1-auth.md`·`3-error-handling.md`·`9-user-profile.md`·
`data-flow/2-auth.md` 본문을 절단했으므로(`feedback_consistency_spec_mode_budget` 기지 결함과
동일 패턴), 위 4개 파일 + `conventions/error-codes.md` + `1-data-model.md` + 코드베이스
발행 지점을 저장소에서 직접 읽어 검증했다. 모든 라인 앵커(`1-auth.md:337/339/521/750`,
`3-error-handling.md:50/66/67/70`, `9-user-profile.md:147`)는 실제 파일과 **정확히 일치**했고,
발행 지점 실측(`PASSWORD_INVALID` 2 · `PASSWORD_REQUIRED` 1 · `REAUTH_REQUIRED` 1 ·
`INVALID_PASSWORD` 2)도 코드와 **정확히 일치**했다.

## 발견사항

- **[WARNING]** §1.2.1 "2FA/WebAuthn/재인증 흐름 전용" 선언과 `changePassword` 발행처 추가가 충돌
  - target 위치: 변경안 #5·#6 (`3-error-handling.md:66`·`:67`, `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 행에
    "발행처에 `changePassword` 추가")
  - 충돌 대상: `spec/5-system/3-error-handling.md:52,54` — `#### 1.2.1 2FA / WebAuthn / 재인증 코드`
    소제목과 그 직후 문장 *"다음 코드는 2FA(TOTP·WebAuthn/Passkey)·재인증 흐름 **전용**이다."*
  - 상세: target 은 §1.2.1 표의 **행**(66·67행)만 편집 대상으로 잡았지만, 그 표를 여는 헤더 문장(52·54행)은
    "전용"(exclusive) 이라고 명시적으로 스코프를 못박는다. `changePassword` 는 2FA 도 WebAuthn 도
    §2.3 `verifyReauth` 도 아닌 **별개 흐름**이므로, 변경안이 반영되면 §1.2.1 소제목·헤더 문장은
    자신이 담은 표 내용과 즉시 모순된다(표에는 2FA/재인증이 아닌 발행처가 등장). 더 나아가 target 자신이
    §90-91 에서 인용하는 근거 — *"§1 이 구현 세부·전이적 맥락을 이름에 박지 않는다 고 하므로
    `PASSWORD_REQUIRED` 를 `verifyPasswordForUser` 전용으로 묶어 둘 이유가 없다"* — 는 논리적으로
    §1.2.1 헤더의 "전용" 선언에도 **동일하게 적용돼야** 하는데, 변경안 목록에 그 헤더 수정이 빠져 있다.
    또한 이 모순은 파일 하나 안에 갇히지 않는다 — target 이 함께 편집하는 `1-auth.md` (§0/1/2/3, 337·339·521·750행)
    는 이제 `changePassword` 를 "형제와 코드를 공유하는" 흐름으로 서술하게 되므로, `1-auth.md` 의
    새 서술과 `3-error-handling.md` §1.2.1 의 옛 "전용" 서술이 서로 다른 그림을 그린다.
  - 제안: 변경안 표에 항목 추가 — `3-error-handling.md:52` 소제목(예: "2FA / WebAuthn / 재인증 /
    비밀번호 변경 코드") 및 `:54` 문장("...전용이다" → "...및 비밀번호 변경(`changePassword`) 흐름이
    공유한다" 류)을 함께 정정. 기존 item 7 이 `:70` 주석에 이미 준 것과 같은 종류의 caveat 을
    헤더에도 적용하면 된다.

- **[WARNING]** 은퇴 후 남는 감사값의 "출처"가 `changePassword` 가 아니라 **로그인 실패**임이
  §5 캐비어트 문안에 명시되지 않음
  - target 위치: 결정② "§5 전제 하나가 이 행에서는 성립하지 않는다" 절 (120-127행), 변경안 #4·#11b
  - 충돌 대상: `codebase/backend/src/modules/auth/auth.service.ts:347`(`failureReason: 'INVALID_PASSWORD'`,
    로그인 실패 시 기록) vs `codebase/backend/src/modules/users/users.service.ts`(`changePassword` 는
    `login_history` 에 **아무 것도 기록하지 않음** — 실측: 해당 메서드 전체에 `loginHistory`/`record` 호출 없음)
  - 상세: target 은 *"`INVALID_PASSWORD` 문자열은 `login_history.failure_reason` 의 감사 사유값으로
    계속 살아 있다... wire 코드와 레이어가 다르다"* 라고만 적는다. 그런데 이 감사값은 **`changePassword`
    의 흔적이 아니라 완전히 별개인 `AuthService.login` 의 로그인 실패 감사값**이다(코드 실측으로 확인 —
    `changePassword` 는 `login_history` 에 쓰지 않는다). 기존 `error-codes.md §3` 행(82행)은 이미
    *"(c) `login_history.failure_reason = 'INVALID_PASSWORD'` — **로그인 실패**의 감사 사유값"* 이라고
    정확히 적어 두었는데, target 의 새 문안(결정②·item 11b)은 이 "로그인 실패" 라는 한정어를 빠뜨린 채
    "감사값이 살아있다"고만 적어 §3 이 이미 갖고 있던 정밀도보다 **후퇴**한다. 이대로 §5 에 반영되면
    다음 사람이 "`changePassword` 실패도 `login_history` 에서 추적된다" 는 잘못된 lineage 를 갖게 되고,
    두 개의 무관한 `INVALID_PASSWORD` 발행 지점(로그인 실패 vs 은퇴한 changePassword wire 코드)을 하나의
    사건으로 오인할 위험이 있다. 이 오인은 `1-data-model.md:710`·`data-flow/2-auth.md:76`(둘 다
    spec_impact 밖) 의 서술과 직접 맞닿아 있어 cross-spec 범위다.
  - 제안: §5 신규 행 또는 §1.2.1 caveat 에 "이 감사값은 **로그인 실패**(`AuthService.login`) 전용이며
    `changePassword` 는 `login_history` 를 쓰지 않는다"는 한 구절을 명시. §3 의 기존 (c) 서술 정밀도를
    유지하는 방향으로 정렬.

- **[INFO]** `9-user-profile.md` 내 `/profile/change-password` 서술 3곳 중 1곳만 OAuth-only 안내 반영
  - target 위치: 변경안 #12 (`9-user-profile.md:147` 만 편집 대상)
  - 충돌 대상: 같은 문서 `9-user-profile.md:94`("전용 페이지(sub-route)" 표) · `:141`(§2.1 편집 필드 표) —
    둘 다 `/profile/change-password` 를 "현재 비밀번호 확인 → 새 비밀번호 입력" 으로 서술하되 OAuth-only
    분기는 언급하지 않는다
  - 상세: 세 곳 모두 같은 페이지를 설명하는 근접 중복 서술인데, target 은 §2.2 보안 설정 표(147행) 한
    곳만 "OAuth-only 진입 시 안내 분기" 를 추가한다. 나머지 두 표는 그대로 남아 화면 흐름을 부분적으로만
    아는 상태가 된다 — 치명적이지 않지만(147행이 상세 SoT 로 남는 구조는 합리적) 다음 사람이 94/141행만
    읽으면 OAuth-only 분기 존재를 놓칠 수 있다.
  - 제안: 94·141행에 "(OAuth-only 안내는 §2.2 참조)" 류의 포인터 한 줄만 추가하거나, 현행 유지가
    의도적이라면(§2.2 가 유일 SoT) 그 사실을 Rationale 에 한 줄 남긴다.

## 요약

target 의 라인 앵커·발행처 카운트는 저장소 실측과 전부 일치했고(허수 없음), `error-codes.md` §3/§5
구조·grade-B 선례·rename 정책과의 정합도 이미 스스로 촘촘히 점검돼 있다. 다만 target 이 **자기 파일
안에서** 두 군데 미봉합을 남긴다 — (1) §1.2.1 을 여는 "2FA/재인증 흐름 **전용**" 선언을 그대로 두고
표 행에만 `changePassword` 를 추가해 헤더-표가 직접 모순되고, 이 모순은 함께 편집되는 `1-auth.md` 의
새 서술과도 어긋난다. (2) 은퇴 후 남는 `INVALID_PASSWORD` 감사값이 사실은 **로그인 실패**
(`AuthService.login`) 전용이고 `changePassword` 자체는 `login_history` 를 쓰지 않는다는, 기존 §3 행이
이미 갖고 있던 정밀도를 §5 캐비어트 문안이 계승하지 않는다. 두 건 모두 한 줄 수준의 문구 보강으로
해소 가능하며 구현·계약을 깨지 않는다. `9-user-profile.md` 근접 중복 서술 비동기화는 INFO 수준이다.

## 위험도

MEDIUM
