---
worktree: webchat-eager-start-2a7b86
started: 2026-06-06
owner: developer
spec_impact:
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/7-channel-web-chat/0-architecture.md
  - spec/7-channel-web-chat/_product-overview.md
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
- [x] (code) use-widget open→start(단일가드)·firstMessage 제거·첫 waiting 표면 렌더·세션복원 시 미시작, widget-state START 무인자, panel composer 게이팅, eia-client payload firstMessage 제거 (commit 4774e096)
- [x] 테스트 — widget-state reducer 갱신 + eager-start hook 테스트(open→start, firstMessage 미포함, 중복 open 단일, 세션복원 미시작) + C1 queue-flush 회귀 + newChat/실패재시도 + panel composer 게이팅. unit 181
- [x] TEST WORKFLOW — lint ✓ / unit ✓(181) / build ✓ / e2e ✓(174)
- [x] /ai-review — `review/code/2026/06/06/12_14_27/` HIGH, Critical 1(C1 런처/추천질문 텍스트 유실)+Warning 10 → resolution-applier 처리(C1 queue-flush + W들), RESOLUTION.md (commit 6a4af359)
- [x] SPEC-DRIFT(W2/I1/I2/I12) — 1-widget-app §2 런처 텍스트·§3 다이어그램 phase명(awaiting_user_message)·§3.2 updateProfile eager 기준 반영. (misplaced draft 정리)
- [x] 후속 라운드 — I1(newChat pendingSendRef 누수) 수정 + W3/I4 주석. unit 181·e2e 174 재통과 (commit fix). 최종 ai-review `review/code/2026/06/06/12_58_00/` LOW, Critical 0, Warning 7(전부 backlog/품질) → RESOLUTION.md 보류 처리.
- [x] consistency-check --impl-done — `review/consistency/2026/06/06/12_58_47/` **BLOCK: NO** (Critical 0, Warning 2 비차단)
- [ ] plan complete 이동 — 비차단 backlog 잔여로 in-progress 유지

## 비차단 backlog (impl-done/ai-review — followup)
- **M2 SDK firstMessage 잔재(impl-done W1)**: `codebase/packages/web-chat-sdk/README.md`·`examples/byo-ui-headless.ts` 가 폐기된 `firstMessage` 참조 — M2 BYO-UI 예제. 별도 패키지/경로라 본 M1 PR 범위 밖. submit_message 패턴 예제로 교체 후속.
- **보안 하드닝**: `start()` 에러 메시지 UI 일반화(W1, 기존 동작), localStorage→sessionStorage 토큰.
- **아키텍처/리팩터**: useWidget God hook 분리(useTokenRefresh/usePendingMessageQueue), `isTextInputSurface()` 헬퍼(텍스트표면 판정 3중 중복), teardownSession 헬퍼, start() check-then-set, composer allowlist 전환, SSE 이벤트명 배열 파생.
- **테스트**: `ended` Composer 미렌더, fake timer 전환, C1 buttons/form 폐기·ended 재open 케이스, ERROR→ended reducer 케이스.
- **spec**: 0-architecture §R6 중복 ID 재번호화, C1 buttons/form 폐기 동작 Rationale 한 줄.

## 결정해야 할 세부

- **시작 트리거**: 패널 첫 open(런처 클릭). 재open(close 후)은 세션 복원이면 재시작 X.
- **welcome vs 첫 표면 공존**: welcome(정적)은 항상 상단, 첫 waiting 표면은 그 아래.
- **방치 execution**: 토큰 TTL/idle 만료에 위임(신규 정리 로직 없음).
- **proactive 비목표 유지**: AI-first 는 여전히 입력창만(봇 선발화 아님). 첫 노드가 캐러셀이면 "메뉴 표시"는 proactive 아님(노드 출력).
