# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 (rationale_continuity)

대상: `plan/in-progress/spec-draft-c2-atomic-claim.md` (spec draft, `--spec`)

## Critical
1. **rationale_continuity** — draft 의 `waiting_for_input → running → (completed|failed)` 2단계 전이(변경 3/4)가 `4-execution-engine.md` Rationale L1246–1254(특히 L1252)가 명시 기각한 대안("WFI→running 후 running→failed 는 두 트랜잭션 분리로 원자성 약화")과 구조적으로 일치. draft 는 "최종 상태 불변" 표면 논거만 들고 실질 기각 근거(트랜잭션 분리 원자성 약화)를 다루지 않음.
   - 해소: claim 을 재개 진입(race-safety gate)에만 적용하고, 기존 직접 WFI→failed/completed 전이를 재서술하지 말 것. 신규 Rationale 에서 L1252 를 정면 인용해 "2026-06 기각은 실패 finalization 의 무익한 running hop 회피였고, 2026-07 는 concurrency race-safety 라는 새 편익 + 원자성 우려(단일 조건부 UPDATE·RESUME_* 롤백·running-row recovery)로 부분 수정"임을 논증.

## Warning
1. rationale_continuity — §1.1 원자성 노트(Execution↔NodeExecution 전이쌍 단일 tx)와 claim UPDATE(NodeExecution 단독으로 보임) 정합 불명확 → claim 이 두 status 를 동일 tx 로 갱신함을 명시.
2. cross_spec — `data-flow/3-execution.md §1.4` 병행 다이어그램(L142–172, "running 전이는 최종 커밋 단계") 미동기 → side-effect 대상 추가.

## INFO
1. §7.4 Rationale L1376 "재검증 가드" 문구 갱신 필요.
2. plan `06-concurrency.md` C-2 체크박스 "결정 대기" → 승인 반영(별 브랜치 #790 에서 반영됨).
3. `1-data-model.md §3` V095 partial index 가 이 UPDATE 핫경로를 이미 커버 — 인용 추가(선택).
4. SQL 코드펜스 → 기존 TS 의사코드 관례로 통일 검토(국소 스타일).

## Checker별
- cross_spec: LOW · rationale_continuity: HIGH(Critical) · convention_compliance: NONE · plan_coherence: success · naming_collision: success
