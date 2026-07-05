# Plan 정합성 검토 — spec/5-system/ (impl-done, 3차 재검토)

## 검토 대상
- Target: `spec/5-system/` (payload 상 `1-auth.md`·`10-graph-rag.md` 등 포함, 실제 diff 는 `1-auth.md`만 해당)
- diff-base: `origin/main`, 검토 시점 HEAD = `invite-accept-confirm-ui-c51e95` (커밋 `05c589936`까지)
- 실제 누적 코드/문서 diff(`git diff origin/main...HEAD --stat`): `spec/2-navigation/10-auth-flow.md`(+2)·`spec/5-system/1-auth.md`(+5) 및 `review/**` 산출물뿐. 코드 변경은 `codebase/frontend/src/app/(main)/invitations/accept/**`(accept-invitation-content.tsx·테스트) 한정.
- 직전 라운드(15_51_50) plan_coherence 는 위험도 NONE 으로 결론. 이번 라운드에서 추가된 커밋(`05c589936`, "V-09 round2 — handleLogout 이 has_session 쿠키까지 정리")은 **spec/plan 변경이 전혀 없는 순수 코드 수정**임을 확인(`git diff 179e034ec..05c589936 -- spec/ plan/` 결과 없음). 따라서 15_51_50 라운드의 plan 정합성 분석 대상(스펙 diff)은 이번 라운드와 동일하다.

## 발견사항

이번 검토에서도 CRITICAL/WARNING 급 불일치는 발견되지 않았다.

- **[INFO] 최신 커밋은 spec/plan 무변경 — 정합성 재평가 불필요**
  - target 위치: 없음 (코드 전용 변경)
  - 관련 plan: 없음
  - 상세: `05c589936`(handleLogout 정리)은 `accept-invitation-content.tsx`/테스트만 수정했다. `spec/5-system/1-auth.md`·`spec/2-navigation/10-auth-flow.md` 는 이전 커밋(`b477913c2`/`179e034ec`)에서 이미 갱신 완료된 상태 그대로이며 이번 커밋에서 추가 수정이 없다. 따라서 plan 과의 정합성 판단은 전량 이전 라운드(15_51_50)의 결론을 그대로 승계한다.
  - 제안: 없음.

- **[INFO] V-09 구현이 미해결 plan 항목과 정확히 일치 — 결정 우회 없음 (15_51_50 재확인)**
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 (초대 수락 확인 페이지 흐름) + `spec/2-navigation/10-auth-flow.md` §2.6 콜아웃
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-09 항목이 "코드 구현" 옵션을 명시적으로 권장했고, 본 PR 은 그 방향을 그대로 실행했다(이전 라운드에서 plan 자체의 체크박스 `[x]` 갱신도 확인됨).
  - 상세: 새로 변경된 코드가 없으므로 이 결론에 영향을 주는 변화 없음.
  - 제안: 없음.

- **[INFO] `plan/in-progress/spec-sync-auth-gaps.md` (LDAP/SAML 미구현 추적) — 본 PR 과 무관, 재확인**
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` (`spec/5-system/1-auth.md` frontmatter `pending_plans`)
  - 상세: 이 plan 은 §1.3 셀프 호스팅 LDAP/SAML 미구현 갭만 추적하며, 본 PR 이 다루는 §1.5.3(초대 수락 UI)과 완전히 다른 섹션이다. `1-auth.md` frontmatter 의 `pending_plans` 참조는 그대로 유지되고 충돌 없음. `payload` 에 포함된 plan 본문을 확인해도 이 두 항목(LDAP·SAML)만 남아 있고 초대·세션·감사 로그 관련 미해결 결정은 없다.
  - 제안: 없음.

- **[INFO] `payload` 에 포함된 다른 in-progress plan(ai-agent-tool-connection-rewrite, cafe24-backlog-residual, chat-channel-discord-gateway/slack-socket-mode 등)은 본 PR 의 target(`spec/5-system/1-auth.md`, `10-graph-rag.md`)과 도메인이 겹치지 않음**
  - target 위치: 없음
  - 관련 plan: 위 각 plan 문서
  - 상세: 이들은 AI Agent 도구 연결, Cafe24 API 카탈로그, Discord/Slack 실시간 채널 등 인증/초대 흐름과 무관한 영역이라 본 PR 의 변경(초대 수락 확인 UI + has_session 힌트 쿠키 기반 리다이렉트)과 교차하는 미해결 결정이나 선행조건이 없다.
  - 제안: 없음.

## 요약
이번 3차 재검토 대상 커밋(`05c589936`)은 spec/plan 문서를 전혀 건드리지 않는 순수 코드 정리(handleLogout 이 `has_session` 힌트 쿠키까지 일괄 정리)이므로, plan 정합성 관점의 실질 분석 대상은 직전 라운드(15_51_50)와 동일한 스펙 diff(`spec/5-system/1-auth.md` §1.5.3, `spec/2-navigation/10-auth-flow.md` §2.6)다. 해당 diff 는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 가 이미 명시적으로 권장한 V-09 "코드 구현" 옵션을 실행한 것으로, 다른 plan 의 미해결 결정을 우회하거나 선행 조건을 건너뛰거나 후속 항목을 무효화하는 사례가 없다. `spec-sync-auth-gaps.md`(LDAP/SAML) 등 인접 in-progress plan 들과도 도메인이 분리되어 충돌이 없다.

## 위험도
NONE
