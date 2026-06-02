---
title: "@Cron 3개 작업을 BullMQ repeatable scheduler 로 이관 (멀티 인스턴스 중복 실행 제거)"
status: in-progress
worktree: .claude/worktrees/refactor-cron-to-bullmq
created: 2026-06-02
owner: developer
---

## 배경 / 동기

백엔드는 k8s `replicas: 2` 로 멀티 인스턴스 운영 (`k8s/base/backend-deployment.yaml:9`).
NestJS `@Cron` 은 각 프로세스의 인메모리 타이머라 replica 수만큼 중복 발화한다.
현존 `@Cron` 작업 3개:

| 서비스 | 모듈 | cron | 중복 시 |
| --- | --- | --- | --- |
| `LoginHistoryPrunerService` | AuthModule | `0 3 * * *` (Asia/Seoul) | 분산 락 없음 — 코드 코멘트가 "단일 인스턴스 가정" 인데 실제 replica 2개라 전제 깨짐 |
| `ChatChannelTokenRotatorService` | ChatChannelModule | `EVERY_HOUR` | 멱등(no-op 가드)이라 무해하나 일관성 위해 통일 |
| `NotificationSecretRotatorService` | TriggersModule | `EVERY_HOUR` | 멱등이라 무해하나 통일 |

이미 통합 만료/알림/사용자 스케줄은 BullMQ `upsertJobScheduler` (Redis 중앙 스케줄러 + 워커 락 → 전역 1회)
를 쓰므로, 이 3개를 BullMQ 로 옮겨 **모든 스케줄 작업을 단일 메커니즘으로 통일**한다.

레퍼런스 패턴: `src/modules/integrations/integration-expiry-scanner.service.ts`
(`@Processor` + `extends WorkerHost implements OnModuleInit` + `onModuleInit` 에서 `upsertJobScheduler`).

## 결정

- **BullMQ 채택** (Redis 수동 분산 락 대신). 근거: 코드베이스 표준 일치, 중복 방지가 구조적 보장,
  재시도/이력/관측 내장, TTL 튜닝 함정 회피.
- 큐는 **작업별 1개** (서비스가 서로 다른 모듈에 있어 단일 큐 공유보다 자연스러움):
  `login-history-pruner`, `chat-channel-token-rotator`, `notification-secret-rotator`.
- 비즈니스 로직 메서드(`prune`/`handleHourly`)는 보존하고 `process(job)` 가 위임 — 기존 단위 테스트 churn 최소화.
- 레거시 정리: `@Cron` 은 인메모리라 Redis 잔존물이 없으므로 `removeJobScheduler` 불필요.
- `ScheduleModule.forRoot()` (app.module.ts:213) 제거 + `@nestjs/schedule` 사용처 0 → package.json 의존성 제거.

## Spec 영향

mechanism 만 바뀌고 동작(24h grace·시간 주기·멱등·180일 retention)은 불변.
spec 본문이 "매시간 cron" / "cron 모니터링" 으로 기술 — BullMQ repeatable 도 cron pattern(`0 * * * *`,
`0 3 * * *`) 을 쓰므로 "cron" 표현은 여전히 유효(드리프트 미미). 정밀 표현 갱신은 follow-up 후보.
관련 spec: `spec/5-system/15-chat-channel.md:89`, `spec/5-system/14-external-interaction-api.md:61`,
`spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/conventions/secret-store.md`.

## consistency-check --impl-prep 결과 (2026-06-02 22:51:44)

**BLOCK: NO** (Critical 0). 산출물: `review/consistency/2026/06/02/22_51_44/SUMMARY.md`.
WARNING 4건은 모두 **spec 본문에 박힌 mechanism 표현(`@Cron`/"매시간 cron")이 이관 후 stale** 해지는
spec-impl 드리프트. 차단 사유 아님 → 진행하되 **spec 갱신을 동반 phase 로 처리** (아래 phase B).
- BullMQ 채택은 기각 이력 없음 (I-3: `spec/0-overview.md` Rationale·`AlertsEvaluatorService` 패턴과 일치).
- 큐 이름 3개 충돌 없음 (I-2).
- 병행 worktree `redis-client-factory-5dae24` 가 `app.module.ts` 동시 수정 — merge 시 경미 충돌, 자동 해소 가능 (I-5).

## 체크리스트

### Phase A — 코드 이관 (developer)
- [x] 3. consistency-check --impl-prep (BLOCK: NO)
- [x] 5. 테스트 선작성/갱신 (3 unit spec: 기존 2 갱신 + 신규 notification-secret-rotator)
- [x] 6. 구현 (3 서비스 BullMQ 이관 + 3 모듈 registerQueue + app.module/package.json 정리)
- [x] 7. 테스트 보강 (onModuleInit→upsertJobScheduler, process→delegate)
- [x] 8. TEST WORKFLOW — lint 0 errors / backend unit 5530 pass / build clean / e2e 140 pass ✅
- [x] 9. /ai-review (RISK LOW, Crit 0, Warn 6) + fix — `review/code/2026/06/02/23_09_02/` (SUMMARY+RESOLUTION)
      - Warn 6(테스트)·INFO 6/7/9/13 수정. Warn 1(JWT)→`security-jwt-secret-fallback.md` 보류. Warn 2~4→Phase B.
      - fix 후 재테스트 통과 (unit 5530 / e2e 140)

### Phase B — spec 갱신 (project-planner, 동반 PR) — WARNING 해소 ✅
- [x] W-1: `1-auth.md §4.3` `@Cron('0 3 * * *')` → `BullMQ repeatable scheduler, 0 3 * * * Asia/Seoul`
- [x] W-2: `1-auth.md` §1.4.G "cron 모니터링(`login_history_pruner_service`)" → "스케줄 job 모니터링(`login-history-pruner` 큐)" (+ "cron 만 DELETE"→"정기 배치만 DELETE")
- [x] W-3: `15-chat-channel.md CCH-SE-04-C` "매시간 cron" → "매시간 BullMQ repeatable scheduler" (+ "필수 (v2 cron)"→"필수 (v2 정리 스케줄)")
- [x] W-4/I-1/I-7: 큐 레지스트리 정확화 — `data-flow/0-overview.md` §1.2 요약 + §4 카탈로그를 코드 실제 12개 큐로 전수 동기화 (`integration-expiry`→`integration-expiry-scanner` 오타 정정 포함). §9.3(execution-engine 전용)에는 미추가 — 책임 경계.
- [x] I-4: `spec/conventions/secret-store.md:229` 주석 cron→정기 배치
- 사전 일관성: `--impl-prep`(review/consistency/2026/06/02/22_51_44, BLOCK:NO)이 동일 변경을 컨텍스트 주입 상태로 이미 검토 → W-1~W-4를 해소 대상으로 명시. 중복 `--spec` fan-out 생략 (proportionality).
