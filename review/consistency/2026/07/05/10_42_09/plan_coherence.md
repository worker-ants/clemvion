# Plan 정합성 검토 — spec-draft-auth-webauthn-list-format.md

## 검토 범위

- Target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md` (spec draft, `--spec` 모드)
- 대조: `plan/in-progress/**` 전체 (68개 문서) — 특히 auth/WebAuthn/session/api-convention/swagger 관련
  (`spec-sync-auth-gaps.md`, `spec-sync-user-profile-gaps.md`, `exec-intake-followups.md`,
  `http-ssrf-all-auth-followups.md`, `spec-code-cross-audit-2026-06-10.md`)

## 발견사항

- **[INFO]** 후속 close 대상이 파일명으로 명시되지 않음
  - target 위치: target 문서 `## 체크리스트` 마지막 행 — `followups auth Critical 2건 close 반영 + webauthn-response.dto.ts follow-up 등록 + memory`
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` §`exec-engine 무관 (별도 트랙)` — `- [ ] (분리·무관) auth Critical 2건 — spec/5-system/1-auth.md(초대 에러코드 casing·WebAuthn 응답 포맷). … project-planner 트랙으로 위임`
  - 상세: target 의 배경 섹션이 서술하는 "exec-intake 후속에서 분리된 auth Critical 2건"의 출처가 정확히 이 plan 의 미체크(`[ ]`) 항목이다. target 은 이를 인지하고 체크리스트에 "close 반영"을 예고했지만, 어느 plan 파일의 어느 체크박스를 갱신해야 하는지 구체적 경로를 적시하지 않았다. 실제 스킬 실행(commit 단계)에서 이 항목을 빠뜨릴 위험이 있다 — 특히 "초대 에러코드 casing" 은 이미 별도로 해소된 것으로 target 배경에 기록돼 있어(2026-06-28 historical-artifact 예외 명문화), 두 하위 항목 모두를 하나의 체크박스로 닫으려면 두 근거를 함께 인용해야 정확하다.
  - 제안: target 체크리스트 항목을 `exec-intake-followups.md §exec-engine 무관 (별도 트랙)` 의 "auth Critical 2건" 체크박스를 `[x]` 로 갱신하고, "Issue 1 은 기해결(2026-06-28)/Issue 2 는 본 spec-draft PR 로 해소" 두 근거를 명시하도록 구체화 권장. CRITICAL/WARNING 은 아니며 실행 시 스스로 해소 가능한 낮은 위험.

- **[INFO]** `webauthn-response.dto.ts` stale 주석 follow-up 의 등록처 미지정
  - target 위치: target 문서 `## 범위 밖 (follow-up, developer 트랙)` — "코드 주석이라 본 spec-only PR 범위 밖. developer 가 해당 파일 편집 시 정정 권고 (별도 follow-up 등록)."
  - 관련 plan: 없음 (신규 등록 대상 부재) — 기존 auth 관련 in-progress plan 은 `spec-sync-auth-gaps.md`(LDAP/SAML 미구현 추적, 무관)뿐이라 이 developer follow-up 을 걸어둘 자연스러운 기존 문서가 없다.
  - 상세: target 체크리스트의 "follow-up 등록"이 실행될 때 신규 plan 파일(예: `plan/in-progress/webauthn-response-dto-comment-fix.md`) 생성이 필요한지, 아니면 기존 개발 백로그에 항목 추가로 충분한지 정해지지 않았다. 사소한 코드 주석 정정이라 CRITICAL/WARNING 급은 아니다.
  - 제안: 신규 파일 생성 대신 developer 가 다음에 `webauthn-response.dto.ts` 를 편집할 때 인라인으로 처리하거나, 기존 `spec-code-cross-audit-2026-06-10.md`(코드측 문서 문자열 정정 이력을 이미 담고 있는 문서) 말미에 한 줄 추가하는 방식을 검토.

## 정합성 확인 (충돌 없음)

- **미해결 결정과의 충돌 없음**: target 이 다루는 "비-페이징 고정 컬렉션 응답 포맷"에 대해 다른 in-progress plan 이 상충하는 결정을 내리고 있지 않다. `spec-sync-auth-gaps.md`(LDAP/SAML), `spec-sync-user-profile-gaps.md`(아바타 업로드/알림 설정/슬러그 라우팅)는 응답 포맷과 무관한 별개 미구현 항목만 추적 중이며, sessions 엔드포인트 관련 유일한 언급(`§6.1 세션 단건 종료 DELETE→POST 정정`)도 본 target 의 변경 범위(응답 shape)와 겹치지 않는다.
- **선행 plan 미해소 없음**: target 이 가정하는 전제(webauthn·sessions 컨트롤러가 이미 `{data:{items}}` 로 동작 중, TransformInterceptor pass-through 분기 기존 동작)는 모두 현재 merge 된 코드 상태에 대한 서술이며, 별도 in-progress plan 이 이 전제를 흔들 진행 중 변경을 하고 있지 않다. `http-ssrf-all-auth-followups.md` 는 무관한 SSRF 에러코드 후속이다.
- **swagger.md / api-convention.md 대상 동시 진행 plan 없음**: `plan/in-progress/**` 전체를 grep 했을 때 `swagger.md`·`2-api-convention.md` 를 spec_impact 로 갖는 다른 in-progress 문서가 없어, target 의 변경 4(swagger.md "유일한 예외" 정정)가 다른 진행 중 작업과 동시에 같은 문서를 건드릴 충돌 우려는 없다.
- **후속 항목 무효화 없음**: target 은 spec 문서만 정정하고 코드/DTO 를 변경하지 않으므로(Option A, non-breaking), 다른 plan 이 이 코드 경로에 의존해 세운 가정을 무효화하지 않는다.

## 요약

Target draft 는 exec-intake 후속에서 분리된 "auth Critical 2건" 중 WebAuthn 응답 포맷 이슈를 다루며, 그 출처인 `plan/in-progress/exec-intake-followups.md` 의 미체크 항목과 정확히 대응한다. target 자체의 체크리스트가 이미 이 후속 반영을 계획해두고 있어 구조적 충돌이나 누락은 발견되지 않았다. 다만 (1) 어느 plan 파일의 어느 체크박스를 닫아야 하는지 구체적 경로 미명시, (2) `webauthn-response.dto.ts` 주석 정정 follow-up 의 등록처 미지정이라는 두 가지 추적성 공백이 있어 INFO 로 기록한다. 다른 in-progress plan(auth-gaps, user-profile-gaps, ssrf-followups) 과는 스코프가 명확히 분리되어 있어 미해결 결정 우회나 선행 조건 미해소는 없다.

## 위험도

LOW
