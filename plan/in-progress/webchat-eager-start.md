---
worktree: webchat-eager-start-2a7b86
started: 2026-06-06
owner: developer
spec_impact:
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/3-auth-session.md
---

# 웹챗 위젯 eager start-on-open (lazy 시작 → open 시작 전환)

> 작성일: 2026-06-06 · 사용자 결정: open 시 항상 시작(eager)

## 배경 / 결정

현재 스펙은 **lazy 시작**(첫 텍스트 입력 시 execution 시작 + webhook `firstMessage`).
이는 **AI-텍스트-first 봇 전용** 가정이라 두 문제 발생:
1. **캐러셀/버튼/폼-first 워크플로우 미지원** — 첫 표면(캐러셀 등)을 보여주려면 execution 을 시작해
   첫 `waiting_for_input` 을 받아야 하는데, 위젯은 시작 전 첫 노드 타입을 알 수 없음. lazy 로는 구조적 불가.
2. **firstMessage 유실 버그** — AI multi_turn 은 webhook/trigger 입력을 첫 턴으로 소비 안 함
   (설계상 "첫 턴은 채팅 UI 입력"). 위젯이 firstMessage 를 webhook 에만 싣고 submit 안 해 첫 메시지 증발.

**결정(사용자, 2026-06-06): eager start-on-open.**
- 패널 open 시 execution 시작(`POST /hooks {profile}`, firstMessage 제거).
- 첫 `waiting_for_input` 타입대로 첫 표면 렌더(ai_conversation→입력창+welcome / buttons·carousel→즉시 / form→폼).
- 첫 사용자 텍스트도 일반 `submit_message` → firstMessage 유실 해소.
- AI LLM 은 첫 사용자 메시지까지 지연(multi_turn waits) → **토큰 비용 0**, 늘어나는 건 execution row 뿐.
- 정적 welcome 은 open 즉시 표시 유지.

## 체크리스트

- [x] (spec) 1-widget-app §2 state machine + §3 시작시점 + §R6(lazy→eager 전환 근거), 3-auth-session §3 시퀀스(open 시작·firstMessage 제거), 0-architecture/_product-overview 정합(pending_plans·nav)
- [x] consistency-check (--impl-prep, rationale-continuity 결정번복 검토 포함) — `review/consistency/2026/06/06/11_57_11/` **BLOCK: NO** (R6 전환근거 완전기록 인정)
- [ ] (code, developer) use-widget: open 시 start, firstMessage 제거, 첫 waiting 표면 렌더, 재open 시 재시작 금지(세션 복원)
- [ ] 테스트
- [ ] TEST WORKFLOW (lint/unit/build/e2e)
- [ ] /ai-review + SUMMARY
- [ ] consistency-check --impl-done
- [ ] plan complete 이동

## 결정해야 할 세부

- **시작 트리거**: 패널 첫 open(런처 클릭). 재open(close 후)은 세션 복원이면 재시작 X.
- **welcome vs 첫 표면 공존**: welcome(정적)은 항상 상단, 첫 waiting 표면은 그 아래.
- **방치 execution**: 토큰 TTL/idle 만료에 위임(신규 정리 로직 없음).
- **proactive 비목표 유지**: AI-first 는 여전히 입력창만(봇 선발화 아님). 첫 노드가 캐러셀이면 "메뉴 표시"는 proactive 아님(노드 출력).
