# Plan 정합성 검토 — `spec/5-system/` (change-password 코드 정렬)

## 검토 범위

- target: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (`origin/main` 대비 델타)
- 구현 diff: `password.util.ts` 신설, `auth.service.ts`·`sessions.service.ts`·`users.service.ts`
  분기 변경, backend 단위/e2e 테스트, 유저 가이드 `password-and-sessions.{mdx,en.mdx}` 정정
- `plan/in-progress/**` 전수 대조 (본문 포함분 + 예산 절단으로 elided 된 `spec-sync-auth-gaps.md`
  등은 `Read` 로 직접 열어 확인)

## 발견사항

없음 — CRITICAL·WARNING 대상 없음.

target 의 모든 변경은 두 governing plan
([`auth-change-password-oauth-only-code-split.md`](../../../../plan/in-progress/auth-change-password-oauth-only-code-split.md),
[`spec-draft-change-password-code-alignment.md`](../../../../plan/in-progress/spec-draft-change-password-code-alignment.md))
이 이미 확정한 **결정 D(형제 코드 재사용, 신규 코드 0)** 를 그대로 반영한다. 두 plan 의
`## 할 일` 체크리스트는 spec 변경 4개 항목(`1-auth.md`·`3-error-handling.md`·
`error-codes.md`·`9-user-profile.md`)이 전부 `[x]`이고, `spec-draft-*` 의 "변경안" 표
(항목 0~12)와 실제 diff 를 줄 단위로 대조한 결과 누락·일탈이 없다:

- `1-auth.md:337`(재인증 코드 note)·`:339`(비밀번호 변경 실패 코드 note)·`:521`(민감 동작
  재확인 note)·`:750`(OAuth-only 정책 note) — 표 항목 0/1/2/3 대로 정확히 반영.
- `3-error-handling.md` §1.2 `INVALID_PASSWORD` 행 제거, §1.2.1 헤더·`PASSWORD_INVALID`/
  `PASSWORD_REQUIRED` 행·근접명명 주석 갱신 — 표 항목 4/4b/5/6/7 대로 반영.
- `error-codes.md` §3 행 제거 + §5 등급 B 행 신설(둘째 B 사례 카운트 갱신 포함) — 표 항목
  9/10/11 대로 반영. `PR` 열이 아직 in-progress plan 링크인 것은 plan 항목 10 이 명시적으로
  예정한 임시 상태다(PR 생성 후 번호로 갱신 예정) — 결함 아님.
- `9-user-profile.md §2.2` 비밀번호 변경 행을 단일 SoT 로 삼고 `:94`·`:141` 은 포인터만 —
  plan 항목 12·12b 대로 반영.
- `password-and-sessions.{mdx,en.mdx}` — 결정③("되는 경로 안내")과 `:80`/`:139` 자기모순
  정정이 diff 에 그대로 나타남.

**미해결 결정과의 충돌**: 없음. 두 plan 모두 옵션 A/B/C/D 검토와 `## 결정 기록`(2026-09-02)이
이미 D 로 닫혀 있고, target 은 그 결정을 그대로 구현한 것이지 새 결정을 일방적으로 내리지 않는다.

**선행 plan 미해소**: 없음. `spec-sync-auth-gaps.md`(예산 절단으로 elided — 직접 `Read`)의
관련 항목("계정 잠금 이메일 알림", `ACCOUNT_LOCKED`/`ALERT_RULE_NOT_FOUND`)은 모두 `[x]` 로
이미 2026-08-31 자 planner 턴에서 닫혔고, target 의 현재 Rationale 서술과 일치한다. §1.3
LDAP/SAML(`status: implemented` 승격 차단 사유)은 이번 diff 와 무관하다.

**후속 항목 누락**: 없음. `ws-token-expired-socket-lifetime-impl.md:72-80` 의 과거 기록
("미설정 조건 분리 여부는 미결 → `auth-change-password-oauth-only-code-split.md` 로 이월")은
그 이월이 실제로 완결됐음을 이번 diff 가 보여주므로 정합적이다(과거 시점 기술이라 갱신 불요).
`spec-sync-external-interaction-api-gaps.md:1661` 의 `3-error-handling.md:80` 라인 인용은
diff 로 인한 ~1줄 shift 대상이지만, 이미 2026-08-22 에 완결·closed 된 이력 항목이라 살아있는
포인터가 아니다 — 실질 영향 없음(WARNING 미달).

**부수 관찰 (INFO 수준, 참고용)**: 두 governing plan 모두 spec·developer 턴 체크박스가 전부
`[x]`이고(`auth-change-password-oauth-only-code-split.md` 는 별개-PR 후속 1건만 미체크,
`User.passwordHash` 타입 폭 문제로 이번 diff 의 spec 정합성과 무관), `auth-change-password-...`
plan 자신의 항목 13 이 "구현까지 끝나면 `complete/` 이동" 을 예정하고 있다. 리뷰가 아직
진행 중(review/code 2026-09-03 10:45/11:05 세션)이라 이동을 미룬 것으로 보이며, 현재는 정상
진행 상태다 — 마무리 커밋에서 두 plan 을 `complete/` 로 옮기고 `error-codes.md §5` 의 `PR` 열을
실제 PR 번호로 갱신하는 절차만 남아 있다.

## 요약

target(`spec/5-system/1-auth.md`, `3-error-handling.md`)의 change-password 코드 정렬 변경은
`plan/in-progress/auth-change-password-oauth-only-code-split.md` 와
`plan/in-progress/spec-draft-change-password-code-alignment.md` 가 2026-09-02 에 확정한 결정
(형제 코드 재사용, `INVALID_PASSWORD` wire 은퇴)을 정확히 구현한 것으로, 두 plan 의 변경안
표·체크리스트와 diff 를 항목별로 대조해도 이탈이 없다. `plan/in-progress/**` 전수(예산 절단
파일 포함, 직접 `Read` 로 확인) 에서 이 변경과 충돌하는 미해결 결정이나 미해소 선행조건,
무효화된 후속 항목을 찾지 못했다. 유일한 잔여는 두 governing plan 자신이 이미 예고한 마무리
하우스키핑(`complete/` 이동·PR 번호 갱신)뿐이며 이는 정합성 결함이 아니다.

## 위험도

NONE
