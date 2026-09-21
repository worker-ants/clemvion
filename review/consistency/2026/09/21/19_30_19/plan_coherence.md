# Plan 정합성 검토 — `spec/5-system` (webauthn-dup-delete, --impl-done)

## 발견사항

- **[INFO]** CHANGELOG 의 "계열 종료" 선언이 트래커 체크박스 해소보다 먼저 적힘
  - target 위치: 해당 없음 (target 은 `spec/5-system`, 이 항목은 `CHANGELOG.md` 와
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 사이의 순서 문제)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4944번째 줄
    (`- [ ] WebAuthn credential 삭제도 동시 요청에서 … 아홉 번째`, 아직 미체크)
  - 상세: `CHANGELOG.md` 의 신규 Unreleased 항목은 "**이 결함 클래스는 이 자리로 아홉 자리
    전부 종료됐다**" 라고 이미 선언하는데, 그 항목이 닫는 트래커 체크박스(4944번째 줄)는
    이 시점에 아직 `- [ ]` 로 남아 있다. `webauthn-dup-delete.md` 자신의 체크리스트 마지막
    항목("트래커 항목 해소 + … + 이 계열 종료 선언")도 미체크라 **발산은 아니다** — 개발자가
    `/ai-review`·`/consistency-check --impl-done` 수렴 후 트래커를 닫기로 계획한
    정상적인 작업 순서이며, 두 문서가 서로 다른 사실을 주장하는 것은 아니다.
  - 제안: 이 PR 이 최종 커밋으로 수렴할 때 `spec-draft-nullable-notation-followups.md`
    4944번째 줄 체크박스를 함께 닫는 것으로 충분 — 별도 plan 갱신 불요.

검토한 세 관점(미해결 결정과의 충돌 · 선행 plan 미해소 · 후속 항목 누락) 각각에 대한 실측:

1. **미해결 결정과의 충돌** — 없음. 트래커(`spec-draft-nullable-notation-followups.md`
   4954~4969번째 줄)가 착수 게이트로 요구한 두 결정(e2e 헬퍼 추출은 별도 PR로 / `affected`
   판별자 유틸은 추출하지 않음)을 `webauthn-dup-delete.md` §0 이 실측과 함께 그대로 기록했고,
   실제 diff(`webauthn.service.ts`)도 그 결정과 일치한다 — `affected === 0` 명시 비교를
   인라인으로 두고 헬퍼로 감싸지 않았으며, e2e 동시성 헬퍼 추출은 이 PR 에 섞지 않았다
   (별도 항목으로 5007번째 줄에 등재됨, 아직 실행 전).
2. **선행 plan 미해소** — `spec-sync-auth-gaps.md` (target `1-auth.md` 의 `pending_plans`)
   는 §1.3 LDAP/SAML 미구현만 다루고, WebAuthn 동시 삭제 항목의 완료 판정 권한은 명시적으로
   `spec-draft-nullable-notation-followups.md` 에 위임돼 있다(중복 소유 방지, 221번째 줄)
   — 두 트래커의 소유 경계가 정합한다. `--impl-prep`(`review/consistency/2026/09/21/17_39_06`)
   가 발견한 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 카탈로그 미등재·401/404 이중 발행 문제는
   developer 가 spec 권한 밖으로 판단해 planner 항목(트래커 4975번째 줄)으로 등재했을 뿐,
   `deleteCredential`/`renameCredential` 의 404 판정 자체는 건드리지 않아 결정을 우회하지
   않았다 — 코드 diff 확인 결과 `throwCredentialNotFound()` 는 두 404 자리를 DRY 추출한
   것뿐이고 `verifyAuthentication()` 의 401 자리는 그대로 분리돼 있다.
3. **후속 항목 누락** — 이 PR 이 구현을 완료해 이 결함 클래스(아홉 자리)를 전부 닫았지만,
   `1-auth.md §5` 의 `DELETE /api/auth/2fa/webauthn/credentials/:id` 행에는 아직 "동시 삭제
   중 진 쪽은 404" 계약이 반영돼 있지 않다. 그러나 이는 **누락이 아니라 이미 등재된 대기
   항목**이다 — 트래커 5066~5108번째 줄이 이 자리를 "아홉 번째이자 계열의 마지막 자리"로
   명시하고, 집행 시점(코드 경로가 모두 해소된 지금)에 재열거하도록 스스로 규정해 뒀다.
   같은 패턴이 7번째(auth-configs)·8번째(model-config) PR 에서도 `spec_impact: none` +
   트래커 위임으로 반복돼 온 선례(`plan/complete/modelconfig-dup-delete.md`,
   `plan/complete/authconfig-dup-delete.md`)와 일치한다.

## 요약

`webauthn-dup-delete.md` 는 트래커가 착수 게이트로 건 두 결정(e2e 헬퍼 추출 유예·`affected`
판별자 유틸 미추출)을 실측과 함께 정확히 이행했고, `--impl-prep` 에서 발견한 spec 오류
(`3-error-handling.md §1.11` "유일한 예외" 서술의 반증)를 developer 권한 밖으로 정확히
분리해 planner 항목으로만 등재했다(코드 자체는 그 결정을 앞지르지 않음). `spec/5-system`
델타 0(코드 전용 PR)에 대해 이 결함 클래스의 spec 계약 갱신(`1-auth.md §5`·
`2-api-convention.md §3` 각주)을 이 PR 에서 하지 않은 것도, 트래커가 "아홉 자리 전부 해소된
시점에 한 번에 재열거" 하도록 미리 정해 둔 규칙과 선행 두 PR 의 선례에 정확히 부합한다.
다른 in-progress plan(`update-returning-tuple-shape.md` 등) 중 이 diff 범위(webauthn
credential 삭제)와 충돌하거나 이를 전제로 깨지는 항목은 없었다. 유일하게 눈에 띈 것은
CHANGELOG 의 "계열 종료" 선언이 트래커 체크박스보다 먼저 적혔다는 순서상의 사소한 점인데,
plan 자신의 체크리스트가 이미 그 순서(리뷰 수렴 → 트래커 해소)를 계획하고 있어 실제
불일치는 아니다.

## 위험도
NONE
