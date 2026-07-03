# Consistency Check 통합 보고서 — spec-draft-crash-running-redrive.md (--spec)

**BLOCK: NO** — Critical 위배 0건. (5 checker 전원 재실행 완료; 초기 workflow 의 4개 output write 누락을 direct Agent 재실행으로 보완.)

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 4(모두 spec 반영 전 정리로 해소 가능), INFO 다수(문서 동기화·명시성 보완).

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) — 반영 전 조치

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| W1 | rationale_continuity | §4.2 "active-running 직렬화 불변식" 재검증 의무 미이행 — crash re-drive 가 기존 job 종료 없이 새 active 세그먼트를 시작하는 재진입 경로(§4.2 가 "PR2b+ 재검증하라" 명시). zombie 워커(hang/네트워크 단절 후 부활)가 stale 판정으로 이중 구동되는 race 가 BullMQ stalled(PR4) 부재 시 fence 안 됨 | Δ5 Rationale 에 재검증 항목 추가 — (i) 재진입 경로 인정, (ii) boot-only 트리거 + 30분 stale + per-node COMPLETED skip 로 완화하되 zombie fence 는 PR4 BullMQ stalled 로 완결, (iii) 현행 fail-path 도 동일 zombie 노출이라 신규 회귀 아님을 명시 |
| W2 | rationale_continuity | Δ1 내부 불일치 — "재구동 불가/한도 초과"에 `EXECUTION_TIME_LIMIT_EXCEEDED` 와 `WORKER_HEARTBEAT_TIMEOUT` 두 코드 병기 | Δ1 단일화: PR3 기간 실발동 terminal = `EXECUTION_TIME_LIMIT_EXCEEDED`(§8 한도) + `RESUME_CHECKPOINT_MISSING`(rehydrate 불가). `WORKER_HEARTBEAT_TIMEOUT` 은 PR3 동안 **미발동** — PR4 stalled 모델 예약어로만 존치 |
| W3 | cross_spec | `spec/data-flow/3-execution.md` §3.1 mermaid + §3.3 표가 recoverStuckExecutions 를 fail-only 로 canonical 기술 — 미갱신 시 두 SoT 모순 | side-effect 목록에서 "확인" → **같은 PR 갱신 필수** 로 격상. §3.1 running self-loop + §3.3 표 re-claim+rehydrate 정정 |
| W4 | plan_coherence | terminal 경계로 재사용한 §8 `active_running_ms` 가 바로 이 크래시 시나리오에서 under-count(세그먼트 경과분 crash 시 flush 안 됨, 기존 Rationale L1372-1380). 기존 L1378 "PR3 에서 자연 해소" 는 실제 미해소 | Δ1/Δ5 정직화: 무한 re-drive 방지의 1차 bound = **boot-only 트리거(부팅당 최대 1회 재구동)**, §8 은 best-effort 2차(under-count 인정). L1378 "PR3 자연 해소" 문구 정정(미해소, PR4/segment-start 영속으로 이연) |

## 참고 (INFO) — 반영 시 함께 처리
- (cross_spec/naming) 문서 동기화: `spec/1-data-model.md §2.13`·`spec/conventions/error-codes.md`·`spec/5-system/3-error-handling.md §1.4` 의 `WORKER_HEARTBEAT_TIMEOUT` 서술 — PR3 중간상태(re-drive) cross-ref. (코드 문자열 무변경.)
- (rationale INFO#3) `§4.1 PR1 메모` 의 "`<executionId>:run:<seq>` 일반형은 PR3/PR4 에서 활성화" 문구 — PR3 는 re-enqueue 대신 in-process re-claim 으로 landing → 문구 정정(PR4 로 이연) side-effect 목록 추가.
- (rationale INFO#4) `§7.1` 이 인용하는 Rationale 앵커 "§7.1 heartbeat → stalled-job 일원화" 가 dangling(본문 부재) — §7.1 편집 시 항목 신설 또는 앵커 정정.
- (plan INFO) §7.4 Recovery 소절에 "전역 boot-lock 유지 + row-claim 은 그 안 defense-in-depth" 한 줄 명시.
- (plan INFO) `execution-engine-residual-gaps.md` G2 cross-ref 2-hop stale — developer 단계에서 `exec-park-durable-resume.md#pr3` 직접 지시로 정정.
- (naming INFO#2) 구현 시 case B re-claim 함수명은 `claimResumeEntry`(waiting 전용)와 구분되게 `reclaimStuckRunningExecution` 등 채택 권장.

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | MEDIUM | W3(data-flow/3-execution.md 동시 갱신 필수), INFO 3 |
| Rationale Continuity | MEDIUM | W1(§4.2 재검증), W2(error-code 단일화); §7.1 stalled Planned + §7.2 point3 승격 공존은 무모순 확인, at-least-once·full-B3·DB-claim 정합 확인 |
| Convention Compliance | LOW | NONE, INFO 2 |
| Plan Coherence | MEDIUM | W4(active_running_ms under-count), INFO 2. Q1/Q2·G2·마이그레이션 무충돌 확인 |
| Naming Collision | LOW | NONE(신규 식별자 0), INFO 3 |

## 결론
BLOCK: NO. 4 WARNING 은 spec 반영 시 draft 를 다음과 같이 보정해 해소한다: (W2) error-code 단일화, (W1) §4.2 재검증 Rationale, (W3) `data-flow/3-execution.md` 동일 PR 갱신 필수, (W4) terminal bound 정직화(boot-only 1차 + §8 best-effort, L1378 정정). INFO 문서 동기화는 반영 커밋에 함께 처리.
