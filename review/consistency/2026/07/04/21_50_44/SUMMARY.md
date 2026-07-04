# consistency-check --impl-prep SUMMARY — orphan pending backstop

- 모드: `--impl-prep` scope=`spec/5-system/` · 세션: `review/consistency/2026/07/04/21_50_44`
- 계획: `recoverStuckExecutions` backstop 이 stale RUNNING 외에 **orphan pending**(queue-wait 초과, job 소실)도 `markQueueWaitTimeout` cancel 로 회수.

## BLOCK: NO (착수 승인) — 5/5 checker

| checker | 결과 | 핵심 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | 에러코드 재사용·`pending→cancelled`(§1.1 허용 전이)·admission gate vs backstop 비중첩(공유 lock·상호배타 status) 정합. |
| rationale_continuity | BLOCK: NO | **CANCEL(≠re-admit) 정합**(§8 "재큐 대신 cancelled" 일반화)·boot-only 트리거 재사용 정합·RUNNING re-drive vs PENDING cancel 비충돌(상태별 근거 상이). |
| convention_compliance | BLOCK: NO | 메서드명 계열 정합·에러코드 의미기반 재사용·구현완료 배너 패턴 준수 필요. |
| plan_coherence | BLOCK: NO | followups 항목·§7.1/§7.4/§8 정합. |
| naming_collision | BLOCK: NO | `recoverOrphanPendingExecutions` 유일. 신규 에러코드/env/migration 없음. |

## 설계 확정

- 액션 = **wait-timeout cancel**(re-enqueue 아님) — `queued_at < now - resolveQueueWaitTimeoutMs()` 초과 pending 만 대상, 기존 `markQueueWaitTimeout` 재사용(멱등 조건부 UPDATE).
- `recoverStuckExecutions` 안에서 running 회수 뒤 호출(early-return 제거) — 같은 lock·boot+테스트훅 트리거 재사용.

## 착수 전 반영 필수 (문서 완결성 — rationale WARNING + cross_spec INFO)

구현과 함께 아래 spec 갱신을 **본 PR 에 포함**한다:
- `4-execution-engine.md` §8(line 1088 "후속/스코프 아님" → 구현 완료), §7.1(line 815·822 boot backstop 서술 + orphan pending), §7.4 "running 대상 한정" 문구, **Rationale 서브섹션 신설**(같은 함수/트리거 재사용 근거 + PENDING 은 cancel/RUNNING 은 re-drive 인 이유).
- `data-flow/3-execution.md` §3.1 mermaid(line 249 pending→cancelled backstop)·§3.3 recovery-source 표(line 298 running-only)·line 69 서술.
- citation nit: `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 §3-error-handling **§1.4**(§1.5 아님).
