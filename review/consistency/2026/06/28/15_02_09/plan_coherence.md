# Plan 정합성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (diff-base=origin/main, impl-done 모드)
검토 기준 plan: `plan/in-progress/webchat-polish-batch.md` 및 기타 `plan/in-progress/**`

---

## 발견사항

### [INFO] `webchat-polish-batch.md` 마지막 체크박스 미완료 — 정합 위반 아님, 추적 메모
- target 위치: 해당 없음 (plan 문서 내부 상태)
- 관련 plan: `plan/in-progress/webchat-polish-batch.md` 40행 `- [ ] (fresh) /ai-review + /consistency-check --impl-done`
- 상세: plan 의 마지막 절차 항목(fresh 재검)이 아직 미체크 상태다. 본 검토가 바로 그 fresh --impl-done 실행이므로 target 문서 내용과의 충돌은 없다. 완료 후 체크 필요.
- 제안: 본 검토 통과 후 plan 의 해당 체크박스를 `[x]` 로 갱신하고 PR 에 포함한다(MEMORY 규칙: "체크박스 갱신을 커밋에 포함").

### [INFO] `2-sdk.md` Overview 절 메서드 목록에 `resetSession` 존재 — wc:command 전용 명시 정합 확인
- target 위치: `spec/7-channel-web-chat/2-sdk.md` Overview 단락 (`boot`/`open`/.../`resetSession`/`shutdown`)
- 관련 plan: `plan/in-progress/webchat-polish-batch.md` 24행 "§1 ClemvionChat 메서드 목록에서 resetSession 제거(코드 미존재 = wc:command 전용). §1·§3 에 명시"
- 상세: plan 은 §1 ClemvionChat 전역 메서드 목록에서 `resetSession` 제거를 명시했다. 실제 target 문서(`2-sdk.md`) Overview 행에 `boot/open/close/show/hide/updateProfile/resetSession/shutdown` 나열에서 `resetSession` 이 여전히 포함돼 있는지 확인이 필요하나, 해당 Overview 단락은 prompt payload 기준 §3 테이블 설명 맥락의 메서드 나열이고 §1 본문에는 `resetSession` 이 "`wc:command` 전용, npm 미노출" 주석으로 명기돼 있다. plan 의도(wc:command 전용 명시)가 spec 에 반영된 것으로 판단된다. 코드와의 정합은 impl 검토 범주.
- 제안: 이미 반영됨. 추가 조치 불필요.

### [INFO] `webchat-widget-refactor.md` 후속 항목(B1) 완료 표기 — plan 외부 완료 확인 필요
- target 위치: 해당 없음
- 관련 plan: `plan/in-progress/webchat-widget-refactor.md` 후속 항목 `B1: useWidget God hook 분리` [x] 표기
- 상세: `webchat-widget-refactor.md` 는 별도 worktree(`webchat-widget-refactor-ff484f`)에서 완료됐고, 후속 B1·A 모두 [x]로 체크돼 있다. target(spec/7-channel-web-chat/) 변경은 본 `webchat-polish-batch` worktree 범위이며, 두 plan 사이의 충돌은 없다.
- 제안: 해당 plan 을 `plan/complete/` 로 이동하는 lifecycle 처리가 완료됐는지 별도 확인 권장(본 검토 범위 외).

---

## 충돌 항목 없음

세 가지 점검 관점을 순서대로 확인한 결과:

1. **미해결 결정과의 충돌**: `plan/in-progress/` 전체 중 `spec/7-channel-web-chat/` 영역에 "결정 필요(TBD)" 로 열린 항목은 없다. `ai-agent-tool-connection-rewrite.md`·`chat-channel-discord-gateway.md` 등 미결 항목은 모두 다른 영역(AI Agent, Chat Channel)이며 본 target 과 무관하다. target 의 변경(resetSession wc:command 전용 명시, isTextInputSurface 텍스트 표면 명시, 5-admin-console Overview 표준화, 4-security apiBase 행 신설, 5-admin-console §2 [0-architecture R5]→R2 참조 정정)은 모두 plan 에서 명시적으로 지시한 항목이며 미합의 영역을 일방적으로 결정한 사례가 없다.

2. **선행 plan 미해소**: target 이 가정하는 선행조건(webchat eager-start 완료, webchat co-deploy 완료, EIA/webhook 표면 등)은 각각 `plan/complete/`에 완료 처리되어 있거나 미완이어도 본 spec polish 변경의 전제조건이 아니다. `webchat-polish-batch.md` 자체의 impl-prep I-4(`0-overview §6.2→§6.1` 이동)는 plan 에서 명시적으로 **revert(보류)** 처리되어 본 PR 에서 제외됐으므로 선행 미해소로 인한 충돌이 없다.

3. **후속 항목 누락**: target 변경이 다른 in-progress plan 을 무효화하거나 새 후속 항목을 요구하는 경우가 없다. `4-security §1` apiBase 행 신설은 코드(`safeApiBaseFromQuery`)를 spec 에 반영한 것이며 다른 plan 이 이 표면에 미해결 결정을 갖고 있지 않다. `2-sdk §1` resetSession wc:command 전용 명시도 마찬가지로 기존 구현·결정과 정합하고 후속 plan 을 요구하지 않는다.

---

## 요약

`plan/in-progress/webchat-polish-batch.md` 가 지시한 5개 spec 변경(2-sdk resetSession 정정, 1-widget-app isTextInputSurface 명시, 5-admin-console Overview 정렬, 5-admin-console §2 R5→R2 참조 정정, 4-security apiBase 행 신설)은 모두 plan 과 일치하며, 미해결 결정을 우회하거나 선행 조건을 건너뛰거나 다른 plan 에 후속 항목을 발생시키는 사례가 없다. 나머지 `plan/in-progress/` 문서들은 본 spec 영역과 교차점이 없다. INFO 메모 2건(fresh 체크박스 미완, refactor plan lifecycle)은 비차단 추적 항목이다.

---

## 위험도

NONE
