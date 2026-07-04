# Rationale 연속성 Check 결과

## 대상

- target: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` (spec draft, `--spec` 모드)
- spec_impact: `spec/data-flow/3-execution.md` §1.1 mermaid `alt` 블록을 2-way → 3-way 로 갱신
- 대조 소스: `spec/data-flow/3-execution.md` (§1.1 prose 라인 65, §3.3 표, `## Rationale`), `spec/5-system/4-execution-engine.md` (§7.1, §7.2, §7.3, `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3)", "PR4 — BullMQ stalled 자동 재배달")

## 검토 결과

### 발견사항

없음. Critical/Warning 대상 없음.

- **[INFO] 3-way 전환의 근거 출처가 이미 확정 Rationale 에 존재 — target 은 그 반영일 뿐**
  - target 위치: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` §"변경 (§1.1 mermaid `alt` 블록)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "PR4 — BullMQ stalled 자동 재배달 (2026-07-04)" 1번째 항목 — "`runExecutionFromQueue` 는 재처리된 job 의 Execution 이 이미 `RUNNING` 임을 감지해 §7.5 case B 재구동으로 분기한다(PENDING=최초 실행, terminal=ack-discard 와 함께 **3-way switch**)." 및 같은 문서 §7.1/§7.2 본문, `spec/data-flow/3-execution.md` §1.1 라인 65 prose·§3.3 표.
  - 상세: target 이 제안하는 mermaid 변경(PENDING/RUNNING-stalled-redrive/terminal 3-way) 은 이미 커밋된 PR4(`b3344e54b`, #798)·PR3(`75d9e7de7`, #795) 로 본문·Rationale 양쪽에 확정된 결정과 정확히 일치한다. `spec/data-flow/3-execution.md` §1.1 의 prose(라인 65)와 §3.3 표는 이미 3-way 를 문장으로 기술하고 있었고, mermaid 다이어그램만 PR1~PR3 시절 2-way 로 뒤처져 있었다 — target 배경 설명(§"배경 (실제 갭)")과 실제 spec 상태가 정확히 일치한다.
  - 제안: 없음 — 새 결정이 아니라 이미 확정된 결정을 다이어그램에 소급 반영하는 순수 정합화이므로 신규 Rationale 작성 의무가 없다. target 이 자체적으로 "신규 설계 아님" 이라고 명시한 것도 적절하다.

## 점검 관점별 결론

1. **기각된 대안의 재도입** — 해당 없음. target 이 재도입하는 대안 없음. 오히려 PR4/PR3 Rationale 이 기각한 대안(신규 owner/heartbeat 컬럼, per-node task queue 재도입, `<executionId>:run:<seq>` re-enqueue 등)과 무관한 순수 다이어그램 표기 정합화다.
2. **합의된 원칙 위반** — 해당 없음. `maxStalledCount:1` bounded blast radius, `recoverStuckExecutions` backstop 병존, at-least-once/exactly-once 경계 등 확정 원칙을 target 의 3-way 표현이 그대로 존중한다 (Note 문구 "recordRunningSegmentStart + redriveStuckExecution(executionId)" 및 "§7.5 case B 재구동 (완료 노드 skip)" 은 §7.1/§7.3 서술과 일치).
3. **결정의 무근거 번복** — 해당 없음. target 은 결정을 뒤집는 것이 아니라 이미 내려진 결정(PR4)을 다이어그램에 뒤늦게 반영하는 것이며, target 자신의 Rationale 절("신규 설계 아님")도 이를 정확히 밝히고 있다.
4. **암묵적 가정 충돌** — 해당 없음. target 의 `else status ∉ {pending, running}` 분기는 §3.3 표의 "WAITING_FOR_INPUT 은 절대 건드리지 않는다" invariant, §7.1 표의 "waiting_for_input — 대상 아님 (job 이 없으므로 stalled/재큐/만료에 절대 걸리지 않음)" invariant 와 충돌하지 않는다 (terminal/waiting_for_input 모두 ack-discard 로 묶는 것은 §1.1 원 코드 `runExecutionFromQueue` 의 실제 3-way 판정과 일치).

## 요약

target 은 이미 병합된 PR3(#795)·PR4(#798) 커밋으로 `spec/data-flow/3-execution.md`(§1.1 prose, §3.3 표)와 `spec/5-system/4-execution-engine.md`(§7.1/§7.2/§7.3, `## Rationale`)에 확정·기술된 3-way switch(PENDING 최초 실행 / RUNNING stalled 재배달 재구동 / terminal·waiting_for_input ack-discard) 결정을 §1.1 mermaid 다이어그램에 뒤늦게 정합화하는 순수 문서 drift cleanup이다. 새로운 설계 결정이나 대안 재도입이 없으며, 기각된 대안 재채택·합의 원칙 위반·무근거 번복·invariant 우회 중 어느 것에도 해당하지 않는다. target 의 자체 Rationale 절("신규 설계 아님 — PR4 로 이미 구현·spec 반영된 3-way 를 §1.1 다이어그램에만 뒤늦게 정합화")도 이 판단과 정확히 부합하며 별도 갱신이 필요 없다.

## 위험도

NONE

BLOCK: NO

- Critical: 없음
- Warning: 없음
- (참고, 비차단) INFO 1건 — 3-way 전환 근거가 이미 `spec/5-system/4-execution-engine.md` Rationale "PR4 — BullMQ stalled 자동 재배달"에 명시돼 있음을 확인. target 의 "신규 설계 아님" Rationale 문구는 정확하며 수정 불필요.

STATUS: SUCCESS
