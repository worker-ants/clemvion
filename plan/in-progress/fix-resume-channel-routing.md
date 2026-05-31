---
name: fix-resume-channel-routing
worktree: fix-resume-channel-routing
status: in-progress
created: 2026-05-31
spec_refs:
  - spec/5-system/4-execution-engine.md §7.5 (line 858 — 채널 어댑터 graceful 안내 의무)
  - spec/5-system/15-chat-channel.md §3.1 CCH-AD-05 (routing context)
---

# 재개(resume) 실패 시 외부 채널 graceful 안내 미도달 버그 수정

## 문제 (사용자 보고)

텔레그램 등 외부 채널 발화로 시작된 execution 이 재개(rehydration) 중 내부 오류
(`RESUME_INCOMPATIBLE_STATE` 등)로 실패하면, 채널에 아무 안내도 도착하지 않는다.
spec §7.5 line 858 은 "채널 어댑터는 raw 에러가 아닌 graceful '대화 세션 만료 —
새로 시작' 안내로 사용자에게 표시" 를 의무화하나, 실제로 메시지가 도달하지 않음.

## 근본 원인

- routing context(`{triggerId, workflowId, chatChannel.conversationKey}`)는
  `WebsocketService.executionRouting` 이라는 **in-memory per-process Map** 이며
  최초 `execute()` 진입 시 1회만 `registerExecutionRouting` 으로 등록된다.
- `rehydrateAndResume`(재개 slow path)는 이를 **재등록하지 않는다**.
- `RESUME_INCOMPATIBLE_STATE` 는 코드 주석(WARN #6) / spec §7.5 line 858 대로
  "multi-turn AI in-memory 상태가 보안상 DB 미저장 → **인스턴스 재시작** 후 재개
  불가" 일 때 발생 — 즉 이 오류가 나는 순간 in-memory routing context 도 항상
  함께 소실돼 있다.
- 따라서 `markExecutionCancelled` 가 emit 하는 `EXECUTION_CANCELLED` 가
  `conversationKey` 없이 나가고 → `ChatChannelDispatcher.readConversationKey`
  null → "outbound skip" → 사용자에게 무음.
- (부수 효과) 재시작 후 *정상* 재개의 outbound(ai_message 등)도 같은 이유로 누락.

## 결정 (사용자 확인 2026-05-31)

- 메시지 내용: **큐레이션 안내문구** (CCH-ERR-03 준수, error.message 원문 미전송).
  → 기존 graceful 메시지가 **실제 도달**하도록 전달 버그만 수정. spec 변경 없음.
- 범위: **재개(resume) 오류 중심**. 일반 execution.failed 는 이미 generic 안내 동작.

## 수정

`ExecutionEngineService.rehydrateAndResume` 에서 execution row 를 fetch·검증한
직후, 영속된 `execution.triggerId` / `execution.workflowId` /
`extractChatChannelFromInput(execution.inputData)` 로 routing context 를 재등록.
`execute()` 의 등록 로직(line 1953-1963)과 동일 형태 — 이후 모든 emit(특히
markExecutionCancelled 의 graceful 안내, 정상 재개의 ai_message 등)이 fanout
envelope 에 routing 을 실어 채널 어댑터가 사용자에게 표시.

## 일관성 검토 (impl-prep) 위험 평가

- spec 변경 0, 신규 식별자 0, API/데이터모델 변경 0.
- 구현은 기존 spec §7.5 line 858 / CCH-AD-05 가 이미 요구하는 동작을 강제할 뿐.
- → cross-spec / naming / rationale 충돌 가능성 없음. 본 fix 는 §858 정합 강화.

## 체크리스트

- [ ] TDD 테스트 선작성 (재개 시 routing 재등록 + chatChannel 동봉 / triggerId-only / 미등록)
- [ ] 구현 (rehydrateAndResume 재등록)
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + SUMMARY + Critical/Warning fix
- [ ] plan complete
