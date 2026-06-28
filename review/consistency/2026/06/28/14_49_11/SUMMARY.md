# Consistency Check 통합 보고서 (--impl-done, polish batch)

**BLOCK: NO** — Critical 발견 없음. Warning 1건(비차단, 본 후속 수정).

검토 모드: `--impl-done spec/7-channel-web-chat/`
일시: 2026-06-28 14:49:11

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Naming Collision | `resetSession` 이 spec §1 ClemvionChat 메서드 목록에 추가됐으나 §5 `ChatInstance` 타입·코드(`ClemvionChatMethod`/`ChatInstance`/loader)에 미존재 — npm API 오해 위험 | **본 후속 수정** — §1 목록에서 resetSession 제거(코드 확인: wc:command 전용). §1·§3 에 "wc:command 전용, npm ChatInstance/ClemvionChat 미노출" 명시 |

## 참고 (INFO) — 비차단
- I-1: `5-admin §6` `execution.message` vs EIA 화이트리스트 — pre-existing(본 batch 무관), planner followup.
- I-2: `0-overview §6.2` 웹채팅 🚧 — 본 batch 의 0-overview 이동 revert 로 원상. NAV-WC-06 동기화는 별도.
- I-3~I-7: SSE wire drift cross-ref·EIA §4 중복·sendMessage 비텍스트 동작·frontmatter prefix 주석·§R6 pending=null 근거 — 전부 선택/pre-existing followup.

## Checker별 위험도
Cross-Spec LOW(execution.message 등 INFO) · Rationale NONE · Convention NONE · Plan NONE · Naming LOW(resetSession W-1, 본 후속 수정).

## 권장 조치사항
1. (본 후속) W-1 resetSession §1 제거 + wc:command 전용 명시.
2. (deferred) execution.message·EIA §6.2·embed-config 파일명 등 pre-existing — planner followup.
