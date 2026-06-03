# Consistency Check 통합 보고서 (재검증)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 대상: `plan/in-progress/spec-draft-exec-intake-queue.md` · 2026-06-04

## 전체 위험도
**MEDIUM** — Critical 없음. 남은 WARNING 은 전부 "spec 본문 반영 시 에러코드 어휘 동기화"(§2.13·§8·§3-error-handling §1.4) 집중. 반영 커밋에서 동시 갱신하면 해소.

## Critical
해당 없음.

## 경고 (WARNING) — 모두 spec 반영 단계 체크리스트
- **W1/W4** `WORKER_HEARTBEAT_TIMEOUT` 처리 방향(유지·재정의·폐기) draft 미결 → §2.13 동기화 위험.
- **W2** `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` — §8 table·§2.13 미갱신 시 동일 용어가 두 코드 지칭.
- **W3** `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 시 `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 정의 범위 축소 필요.
- **W5** `spec-sync-execution-engine-gaps.md` §4/§7.1/§8 forwarding 메모.
- **W6** `execution-engine-residual-gaps.md G2` 와 stalled-job 관계 메모.

## INFO (반영 시 동시 갱신)
§9.2 seq 키 · §9.3 큐 목록 · §11 ENV · §2.4/§2.6 · §7.2 per-node 어휘 · Rationale 항 3번(heartbeat) 교체.

## Checker별 위험도
Cross-Spec MEDIUM · Rationale LOW · Convention NONE · Plan-Coherence LOW · Naming LOW.

## 결정 (W1/W4 해소)
`WORKER_HEARTBEAT_TIMEOUT` 은 **유지하되 의미 재정의** — 기존 "절대 30분 stale" → "active 세그먼트 job 이 BullMQ stalled 재배달 attempts 를 모두 소진(terminal worker failure)". §2.13·§7.1 동기화. draft 갱신 반영.

> 본 SUMMARY 는 main 이 멱등 persist (workflow terminal write 가 write_blocked 였음).
