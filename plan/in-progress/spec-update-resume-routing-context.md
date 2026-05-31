---
worktree: fix-resume-channel-routing
started: 2026-05-31
owner: resolution-applier
---
# Spec Fix Draft — execution-engine §7.5 routing context 재등록 단계 명시

## 원본 발견사항

SUMMARY#1 (Critical — Spec Fidelity): spec §7.5 rehydration 시퀀스 다이어그램에 "routing context 재등록" 단계가 명시되어 있지 않다. 구현은 버그를 올바르게 수정하고 있지만, spec 이 해당 동작을 명시하지 않아 향후 다른 개발자가 spec 을 보고 동일 단계를 다시 제거할 위험이 있다.

위치: `spec/5-system/4-execution-engine.md §7.5` (line 832-841)

## 제안 변경

`spec/5-system/4-execution-engine.md` 의 §7.5 rehydration 시퀀스에 다음 단계를 추가:

**삽입 위치**: §7.5 의 "1. execution row 조회·상태 검증" 과 "2. nodeExecution 조회·상태 검증" 사이 (또는 조회 직후, nodeExecution 검증 이전).

**추가할 항목**:

```
1-b. routing context 재등록 (triggerId && workflowId 있는 경우)
     - 영속된 execution row 의 triggerId / workflowId / inputData.chatChannel 로
       WebsocketService.executionRouting Map 에 재등록.
     - 등록 형태는 execute() §3 단계(routing context 최초 등록)와 동일.
     - best-effort: 등록 실패 시 warn 로그만 남기고 rehydration 은 계속 진행.
     - terminal event (EXECUTION_CANCELLED / COMPLETED) emit 시 WebsocketService 가
       자동 release (기존 동작과 동일).
     - 이 단계가 없으면, 이후 emit (특히 markExecutionCancelled 의 graceful
       "세션 만료" 안내) 이 conversationKey 없이 나가 ChatChannelDispatcher 가
       outbound skip → 사용자 무음.
     - 참조: CCH-AD-05, spec/3-channel/chat-channel.md §3.1
```

**Rationale 에 추가**:

- slow-path 재개는 다른 프로세스/재시작 후 worker 가 pick up 하므로 in-memory routing context 가 항상 소실돼 있다.
- RESUME_INCOMPATIBLE_STATE 는 특히 "인스턴스 재시작으로 multi-turn in-memory 상태 소실" 케이스이므로, routing context 재등록 없이 markExecutionCancelled 를 호출하면 graceful 안내가 전달되지 않는다 (silent failure).
- spec 에 명시함으로써 향후 개발자가 "불필요한 코드"로 오인해 제거하는 회귀를 방지.
