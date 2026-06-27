# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/7-channel-web-chat/`
활성 plan: `plan/in-progress/webchat-usewidget-split.md` (B1: useWidget God hook 분리)

---

## 발견사항

### [INFO] localStorage vs sessionStorage 구현 드리프트 — 기존 추적 중인 항목, 현 plan 과 무관

- target 위치: `spec/7-channel-web-chat/3-auth-session.md §R6`, `spec/7-channel-web-chat/4-security.md §1 (토큰 노출 행)`
- 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §A` — "per_execution 토큰 localStorage → sessionStorage" (미완료 체크박스)
- 상세: spec 은 per_execution 토큰 저장소를 `sessionStorage`(탭 종료 시 자동 소거, defense-in-depth)로 기술하나, 품질 백로그 §A 는 실제 구현이 아직 `localStorage` 를 쓰고 있다고 명시한다. 이 드리프트는 `web-chat-quality-backlog.md §A` 에서 추적 중이며 구현 격상 시 `spec_impact` 에 관련 spec 파일 3건(`4-security.md`, `2-sdk.md §3`, `3-auth-session.md`)을 포함하도록 안내되어 있다. 현재 착수하는 B1 plan(`webchat-usewidget-split.md`, `spec_impact: []`)은 이 항목을 건드리지 않는다.
- 제안: 현 plan 에서는 조치 불필요. 향후 §A 착수 시 `spec_impact` 3건을 plan frontmatter 에 반드시 포함하고 일관성 검토 후 구현.

---

## 요약

`spec/7-channel-web-chat/` 의 6개 spec 문서(`status: implemented`)와 현재 진행 중인 `webchat-usewidget-split.md`(B1 behavior-preserving 리팩터, `spec_impact: []`) 사이에 **미해결 결정 우회·선행 plan 미해소·후속 항목 누락에 해당하는 CRITICAL/WARNING 충돌은 없다.** spec 내에 "결정 필요" 로 남겨진 개방 항목이 없으며, B1 plan 이 일방적으로 결정을 내리는 항목도 없다. 유일한 주의 사항은 spec 과 구현 간 `sessionStorage` vs `localStorage` 드리프트이나, 이는 이미 `web-chat-quality-backlog.md §A`에서 추적 중이고 현 plan 범위 밖이다.

---

## 위험도

NONE
