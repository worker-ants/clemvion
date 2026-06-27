# Plan 정합성 검토 — spec/7-channel-web-chat/4-security.md

검토 시각: 2026-06-27  
검토 모드: spec draft (--spec)  
대상: `spec/7-channel-web-chat/4-security.md` (worktree: webchat-followups-complete)

---

## 발견사항

### [INFO] webchat-eager-start.md 보안 하드닝 backlog 가 보안 spec 에 미반영

- **target 위치**: `4-security.md` §1 정책 요약표 "토큰 노출" 행
- **관련 plan**: `plan/in-progress/webchat-eager-start.md` "비차단 backlog" — "보안 하드닝: start() 에러 메시지 UI 일반화(W1), localStorage→sessionStorage 토큰"
- **상세**: eager-start 비차단 backlog 에 "localStorage→sessionStorage 토큰" 보안 하드닝 항목이 있다. 현재 보안 spec §1 표는 "per_execution 단일 → 클라이언트에 장기 비밀 없음" 이라고만 기술하며, 토큰 저장 위치(localStorage/sessionStorage)를 명시하지 않는다. 이 항목이 구현되면 spec 갱신 대상이 된다. 단, eager-start plan 이 이 항목을 명시적 비차단 backlog 로 분류해 뒀으므로 현 시점 활성 "결정 필요" 항목이 아니며, 공식 결정 충돌은 없다. eager-start 의 `spec_impact` 목록에 `4-security.md` 가 빠져 있어, 해당 항목 구현 시 security spec 갱신이 누락될 가능성이 있다.
- **제안**: 해당 보안 하드닝이 구현 단계로 격상될 때 `webchat-eager-start.md` `spec_impact` 에 `spec/7-channel-web-chat/4-security.md` 를 추가하거나, security spec §1 표 "토큰 노출" 행에 저장 위치 정책을 명시(구현 후). 현 단계에서는 차단 불필요.

---

## 요약

`channel-web-chat-followups.md` 는 이 워크트리에서 `plan/complete/` 로 이동 완료되었고, spec/7 전체 파일(`0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `4-security`)에서 해당 plan의 `pending_plans` 참조가 일관되게 제거되었다. target 보안 spec 의 §4 비목표 선언(동시 ≤3 캡 · 워크플로우 비용 가드 · hard frame-ancestors opt-in)은 모두 followups plan 의 명시적 사용자 결정(2026-06-03 ⏸ 보류 확정)과 `channel-web-chat-impl.md` 비목표 절에 의해 뒷받침되어 있어 일방적 결정이 아니다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 범주에도 해당하는 충돌은 없다. 유일한 지적 사항은 `webchat-eager-start.md` 의 비차단 backlog 항목(토큰 스토리지 이전)이 보안 spec 에 미반영된 INFO 수준 관찰이며, 활성 결정 충돌을 만들지 않는다.

## 위험도

NONE
