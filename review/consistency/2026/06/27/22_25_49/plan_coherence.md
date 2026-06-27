# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)
검토 대상 plan: `plan/in-progress/webchat-widget-refactor.md`, `plan/in-progress/web-chat-quality-backlog.md`

---

## 발견사항

### [INFO] localStorage vs sessionStorage 미결 backlog 와 spec 서술 부분 잔존
- target 위치: `spec/7-channel-web-chat/2-sdk.md §3` — `wc:command resetSession` 설명 中 "저장 세션(localStorage)을 비운 뒤"
- 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §A` — "per_execution 토큰 localStorage → sessionStorage" 항목, "구현 격상 시 `spec/7-channel-web-chat/2-sdk.md §3 (resetSession)` 포함" 명시
- 상세: backlog §A 는 `localStorage → sessionStorage` 전환을 비차단 이연 항목으로 명시하고, 격상 시 `2-sdk.md §3` 의 저장 세션 서술도 함께 갱신해야 한다고 추적하고 있다. 현재 `2-sdk.md §3` 에는 "저장 세션(localStorage)" 라는 구체적 언급이 남아 있어 backlog 와의 drift 가 spec 본문에 고착돼 있다. 본 PR 의 `spec_impact: []` 는 정확하며 충돌은 없으나, 추적 메모를 명확히 두는 것이 권장된다.
- 제안: 현 시점 변경 불요. backlog §A 의 추적 메모("구현 격상 시 `2-sdk.md §3` 포함")가 이미 충분한 trailing ref 역할을 한다. 다만 `2-sdk.md §3` 에 인라인 TODO 주석 한 줄(`<!-- TODO: localStorage → sessionStorage 전환 시 갱신 — web-chat-quality-backlog §A -->`)을 추가하면 spec 열람자가 drift 를 조기에 인식할 수 있다.

### [INFO] SPEC-DRIFT 플래그 `1-widget-app §3.1·§2` — planner 후속 미생성
- target 위치: `spec/7-channel-web-chat/1-widget-app.md §2 (메시지 리스트), §3.1 (재로드 복원 시퀀스)` 참조
- 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §C` — "추가 backlog 메모(ai-review/impl-done INFO): `1-widget-app §3.1·§2` spec 문서화(SPEC-DRIFT, planner) — 전부 비차단."
- 상세: ai-review/impl-done 검토 과정에서 `1-widget-app §3.1·§2` 에 대한 SPEC-DRIFT (구현 상세가 spec 에 미반영)가 비차단 INFO 로 기록됐고, planner 위임이 명시돼 있다. 현재 해당 후속 planner plan 이 생성되지 않았다. 비차단이며 backlog 메모로 추적 중이나, planner 가 인지하지 않으면 방치될 수 있다.
- 제안: `web-chat-quality-backlog.md §C` 에 이미 추적 중이므로 별도 plan 신설은 즉시 필요하지 않다. 다음 플래너 접점에서 spec drift 반영 여부를 결정하면 된다. plan 갱신 불요.

---

## 요약

`plan/in-progress/webchat-widget-refactor.md` 는 `spec_impact: []` (behavior-preserving 리팩터)로 선언되어 있으며, target `spec/7-channel-web-chat/` 6개 문서는 모두 `status: implemented` 상태다. 본 PR 의 구현 변경(isTextInputSurface 헬퍼 추출, TERMINAL_EVENTS 배열 파생, teardownSession 헬퍼, 테스트 보강)은 어떤 spec 문서의 미해결 결정을 일방적으로 내리거나 충돌하지 않는다. `web-chat-quality-backlog.md §A` 의 localStorage→sessionStorage 이연 항목과 spec 본문의 localStorage 언급 간에 알려진 drift 가 존재하지만, 이는 의도적으로 이연된 항목이며 본 PR 이 그 결정을 우회하거나 악화시키지 않는다. 미해결 결정과의 충돌(CRITICAL) 및 선행 plan 미해소(WARNING) 는 발견되지 않았다.

## 위험도

NONE
