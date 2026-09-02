# Plan 정합성 검토 — `spec/5-system/` (--impl-prep)

## 발견사항

- **[WARNING]** `auth-change-password-oauth-only-code-split.md` 체크리스트가 이미 완료된 스펙 편집을 미완료로 남겨 둠
  - target 위치: `spec/5-system/1-auth.md` §2.3(`:364`·`:351` "비밀번호 변경 실패 코드"/"재인증 에러 코드" note), §5(`:546` "민감 동작 비밀번호 재확인 코드" note), §1.1.A 하단 정책 note(`:775` "OAuth-only 사용자" 문단); `spec/5-system/3-error-handling.md` §1.2.1(`:973`·`:986`·`:989` `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 행·근접명명 주석); `spec/conventions/error-codes.md` §3(구 `INVALID_PASSWORD` 행 부재 확인)·§5(신규 은퇴 행 + "현재 B 등급 행은 2건" 갱신); `spec/2-navigation/9-user-profile.md` §2.2(`:147` 단일 SoT 행) + `:94`·`:141` 포인터
  - 관련 plan: `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 할 일` — 아래 4개 항목이 전부 `- [ ]`(미체크)로 남아 있음
    ```
    - [ ] `spec/5-system/1-auth.md` — `change-password` 실패 코드 서술을 두 조건으로 분리 (§339·§521·§750)
    - [ ] `spec/5-system/3-error-handling.md` — §1.2 `INVALID_PASSWORD` 행 제거 + §1.2.1 두 행에 발행처 추가 + 근접명명 주석 갱신
    - [ ] `spec/2-navigation/9-user-profile.md §2.2` — OAuth-only 안내 분기(단일 SoT) + `:94`·`:141` 포인터
    - [ ] `spec/conventions/error-codes.md` — §3 행 제거 + §5 에 등급 B 은퇴 행 추가 …
    ```
    같은 changeset 을 담은 `plan/in-progress/spec-draft-change-password-code-alignment.md` (변경안 표 항목 0~12) 도 developer 인계 목록(codebase 4건)만 남기고 spec 쪽은 전부 "적용 대상" 서술로만 남아 있어 완료 여부가 plan 문서 어디에도 명시되지 않음
  - 상세: 위 4개 파일을 직접 열어 대조한 결과 draft(`spec-draft-change-password-code-alignment.md`)의 변경안 표(§ 0~12)가 요구하는 문구가 **이미 target 에 전부 반영**돼 있다 — 예를 들어 draft 항목 #1(`1-auth.md:339` 두 조건 분리)은 target `:364`
    `"POST /users/me/change-password 의 현재 비밀번호 재확인 실패는 두 조건을 갈라 반환한다 … 비밀번호 미설정(OAuth-only, passwordHash 부재) → PASSWORD_REQUIRED(401) · 불일치 → PASSWORD_INVALID(401)"`
    와 사실상 동일 문구로 이미 존재하고, draft 항목 #9(`error-codes.md §3` 행 제거)·#10(§5 등재)도 실제로 반영돼 있다(§3 재조회 결과 `INVALID_PASSWORD` 행 없음, §5 "현재 B 등급 행은 2건이다 … `INVALID_PASSWORD`→`PASSWORD_REQUIRED`/`PASSWORD_INVALID`(2026-09-02)" 확인). `git diff`로도 이 세션에서 4개 spec 파일이 모두 수정된 상태(unstaged)임을 확인했다. 즉 **target 은 plan 이 "결정됨(D)"으로 기록한 내용과 충돌 없이 정확히 반영**하고 있지만, 그 사실을 두 plan 문서의 체크리스트가 따라잡지 못했다 — 체크박스만 보고 판단하면 "스펙 편집이 아직 안 됐다"로 오독하게 된다. 이 상태로 커밋되면 (a) 다음 세션이 이미 끝난 스펙 편집을 다시 시도하거나, (b) `auth-change-password-oauth-only-code-split.md` 가 `spec` 항목 미완료로 보여 `plan/complete/` 이동 판단(§13 "구현까지 끝나면 complete/ 이동")이 실제보다 늦게 트리거될 위험이 있다.
  - 제안: `auth-change-password-oauth-only-code-split.md` 의 4개 스펙 체크박스를 `[x]`로 전환(이미 반영된 위치·문구를 근거로 남기고)하고, 남은 것은 `developer 턴` 항목 하나뿐임을 명시. `spec-draft-change-password-code-alignment.md` 도 "spec 쪽 변경안(0~12) 전량 적용 완료, codebase 인계 목록만 잔존"이라는 상태를 절 상단에 덧붙이거나(이미 반영된 완료 draft 는 관례상 `complete/` 이동 대상 — `spec-draft-api-convention-status-and-password-codes.md`/`spec-draft-ws-badge-flip-tracker-close.md` 가 같은 세션에서 그렇게 이동된 선례가 있음) — 다만 이 draft 는 `auth-change-password-oauth-only-code-split.md` 의 developer 턴이 끝나기 전에 옮기면 인계 목록(§codebase)의 추적 지점이 사라지므로, developer 턴 완료 시점까지는 in-progress 유지 + "spec 부분 완료" 라벨만 추가하는 편이 안전.

## 요약

target(`spec/5-system/1-auth.md`·`3-error-handling.md`·`2-api-convention.md`)은 `plan/in-progress/auth-change-password-oauth-only-code-split.md`가 기록한 사용자 결정(D — 형제 코드 재사용, `PASSWORD_REQUIRED`/`PASSWORD_INVALID`로 정렬하고 `INVALID_PASSWORD`를 wire에서 은퇴)을 `error-codes.md`·`9-user-profile.md`까지 포함해 정확하고 일관되게 반영하고 있으며, 그 결정이 다른 plan(`spec-sync-auth-gaps.md` 등)의 미해결 항목과 충돌하지도 않는다. `spec/5-system/` 범위 안에서 다른 진행 중 plan(`spec-update-node-cancellation-shutdown-classification.md`의 `OAUTH_STATE_MISMATCH` 카탈로그화 유예, `spec-conventions-engine-error-code-surface.md`의 §1.4 drift 후속 등)도 target 이 그 유예 상태를 그대로 존중하고 있어 별도 충돌이 없다. 유일한 실질 문제는 **plan 체크리스트가 이미 완료된 spec 편집을 미완료로 표시**하고 있다는 점으로, 결정 내용 자체의 충돌이 아니라 추적 상태의 지연(drift)이다.

## 위험도

LOW
