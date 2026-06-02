---
title: "spec-draft — cron→BullMQ 이관에 따른 spec mechanism 표현·큐 레지스트리 동기화 (Phase B)"
status: applied
worktree: .claude/worktrees/refactor-cron-to-bullmq
created: 2026-06-02
parent_plan: refactor-cron-to-bullmq.md
---

## 목적

cron→BullMQ 이관(Phase A, 커밋 c186278f/bdc9489c) 으로 stale 해진 spec 본문의 mechanism
표현을 실제 구현(BullMQ repeatable scheduler) 에 맞춰 동기화. consistency-check --impl-prep
(review/consistency/2026/06/02/22_51_44, BLOCK:NO) 의 W-1~W-4 + ai-review WARNING-2~4 해소.
요구사항·API·결정 변경 없음 — **mechanism 용어 정정 + 큐 레지스트리 정확화**.

## 변경 목록

### 1. `spec/5-system/1-auth.md`
- (line 360, §4.3) `보존: 180일 경과 row 는 일일 배치(`@Cron('0 3 * * *')`)로 자동 삭제`
  → `... 일일 배치(BullMQ repeatable scheduler, `0 3 * * *` Asia/Seoul)로 자동 삭제`
- (line 476, Rationale §1.4.G) `보존 기간 cron 만 DELETE` → `보존 기간 정기 배치만 DELETE`
- (line 480, Rationale §1.4.G) `cron 모니터링 (`login_history_pruner_service`)`
  → `스케줄 job 모니터링 (`login-history-pruner` 큐)`

### 2. `spec/5-system/15-chat-channel.md`
- (line 89, CCH-SE-04-C) `(매시간 cron — `NotificationSecretRotatorService` 와 동일 패턴)`
  → `(매시간 BullMQ repeatable scheduler — `NotificationSecretRotatorService` 와 동일 패턴)`
- (line 89, 마지막 셀) `필수 (v2 cron)` → `필수 (v2 정리 스케줄)`

### 3. `spec/conventions/secret-store.md`
- (line 229 주석) `// 24h 후 cron 이 v2 → primary 승격 + v2 row 삭제. 구현: ChatChannelTokenRotatorService.`
  → `// 24h 후 정기 배치(ChatChannelTokenRotatorService, BullMQ)가 v2 → primary 승격 + v2 row 삭제.`

### 4. `spec/data-flow/0-overview.md` §1.2 — 큐 레지스트리 정확화 (W-4/I-7)
현재: `background-execution, document-embedding, graph-extraction, schedule-execution, alerts-evaluator, integration-expiry`
→ 코드 실제 등록 큐 전수(12개)로 교체 + `integration-expiry`→`integration-expiry-scanner` 오타 정정:
`alerts-evaluator, background-execution, cafe24-token-refresh, chat-channel-token-rotator,
document-embedding, execution-continuation, graph-extraction, integration-expiry-scanner,
login-history-pruner, notification-secret-rotator, notification-webhook, schedule-execution`

## 비변경 결정 (근거)

- **`spec/5-system/4-execution-engine.md §9.3` 에 신규 큐 미추가**: §9.3 은 execution-engine 전용
  큐(continuation/background) 목록이며 기존에도 integration-expiry·alerts·document-embedding 등
  ~6개 비실행 큐를 의도적으로 미포함. maintenance 스케줄러 3개를 여기 넣으면 책임 경계 오배치 →
  전역 레지스트리는 `data-flow/0-overview §1.2` 에 일원화 (위 4번).
- **`spec/0-overview.md §2.6`**: `실행 태스크 / execution-continuation / background-execution ... 등`
  은 illustrative 예시("등") 라 레지스트리 아님 — 무변경.
- **`schedule trigger cron` (15-chat-channel:486 등)**: 사용자 Schedule 기능의 cron 표현은
  본 이관과 무관 — 무변경.

## Rationale

mechanism 용어(@Cron/cron) 정정은 spec-impl 드리프트 제거이며 신규 설계 결정·기각 대안 없음.
큐 레지스트리는 `data-flow/0-overview §1.2` 가 "현재 등록된 큐" 를 표방하므로 SoT 로 채택해
코드 실제 등록분 전수로 정확화. consistency-check --impl-prep 이 동일 변경(컨텍스트 주입)으로
이미 BLOCK:NO 판정했고 본 draft 는 그 WARNING 들의 해소안.
