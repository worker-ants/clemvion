# Consistency Check 통합 보고서

**대상 draft**: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
**검토 모드**: --spec
**검토 일자**: 2026-05-24
**세션**: `review/consistency/2026/05/24/23_26_13`

---

**BLOCK: YES** — Cross-Spec checker 에서 CRITICAL 3건 발견. spec draft 채택 차단.

## 전체 위험도

**HIGH** — CRITICAL 3건 (spec 갱신 대상 절 명시 누락으로 §9.2 Redis 키 표·§4.4 Rationale·§4.6 WS 이벤트 매핑 표가 그대로 채택 시 stale 상태로 잔류) + Rationale Continuity WARNING 2건 (sticky fast-path 가 기존 "항상 bus.publish" 원칙을 번복하나 번복 근거 미작성) + Convention/Plan/Naming WARNING 9건.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Cross-Spec | §9.2 Redis 키 정의 표에서 `execution:continuation (Pub/Sub)` 채널 행 제거 지침이 draft 에 누락. 채택 시 §9.2 가 제거된 채널을 계속 정의하는 불일치 상태 발생 | 변경 1.4 §7.4 Continuation Bus 절 | `spec/5-system/4-execution-engine.md §9.2` (line 825–826) | draft 에 "§9.2 표의 `execution:continuation` 행을 삭제하고, BullMQ `execution-continuation` 큐를 §9.2 또는 신규 §9.3 BullMQ 큐 목록으로 등재" 지침 추가 |
| C-2 | Cross-Spec | `recoverStuckExecutions` 변경에서 §7.4 Recovery 본문 교체 범위가 구체적으로 지정되지 않아 어떤 단락이 교체·보존되는지 모호. `spec/data-flow/3-execution.md` 가 갱신 대상 누락 | 변경 1.5 §7.4 Recovery 절 | `spec/5-system/4-execution-engine.md §7.4 Recovery` (line 767–774), `spec/data-flow/3-execution.md §1.1` | (a) draft 에서 §7.4 Recovery 교체 범위 명시. (b) `spec/data-flow/3-execution.md` 를 갱신 대상 목록에 추가 |
| C-3 | Cross-Spec | §4.4 Rationale 의 continuation bus 설명 및 `spec/5-system/6-websocket-protocol.md §4.6` 매핑 표에 `execution.resumed_after_restart` 행 추가 지침이 draft 에 누락 | 변경 1.4 §7.4 / 변경 2.2 | `spec/5-system/4-execution-engine.md §4.4` (line 355–366), `spec/5-system/6-websocket-protocol.md §4.6` | (a) draft 에 "§4.4 Rationale 의 continuation bus 문장 갱신" 추가. (b) draft 에 "§4.6 매핑 표에 `execution.resumed_after_restart` 행 추가" 명시 |

## 경고 (WARNING)

(전체 12건은 5개 checker 결과 파일 참조)

핵심 W:
- **W-1/W-2** [Rationale Continuity] Sticky fast-path 가 기존 "항상 bus.publish" 원칙 번복 — 제거 또는 §1.8 Rationale 에 번복 근거 추가
- **W-3** [Cross-Spec] §11 503 응답이 api-convention 과 미조율
- **W-4** [Cross-Spec] BullMQ `attempts: 3` 과 §5.7 LLM retry 의 합산 정책 미명시
- **W-5** [Cross-Spec] `Execution.error` 신규 코드 4종의 §2.13 구체 삽입 위치 미명시
- **W-6** [Convention] plan frontmatter `worktree` hex slug 누락
- **W-7** [Convention] 비표준 `status` frontmatter 필드
- **W-8** [Convention] `RESUME_QUEUED` 가 에러 코드 표에 성공 변형으로 혼입 (기존 ack invariant 위반)
- **W-9** [Plan Coherence] `retry-handler-followup` 과 동일 spec 파일 병렬 편집 위험
- **W-10** [Plan Coherence] `self-hosting-deployment.md` cross-link 누락
- **W-11/W-12** [Naming] `execution.resumed_after_restart` ↔ `execution.resumed` 의미 경계, `execution-continuation` ↔ `execution:continuation` 과도기 혼선

## 참고 (INFO)

12건 — 5개 checker 결과 파일 참조. 주요 항목: BullMQ jobId 의 nodeExecutionId DB lookup 절차(I-1), data-flow 다이어그램 갱신(I-2), §1.1 ASCII / §1.2 NodeExecution 동기화(I-3/I-4), §0-overview Rationale 갱신(I-6), workflow-resumable-execution plan 미생성(I-9), 0-unimplemented-overview 목록 갱신(I-10).

---

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | MEDIUM | CRITICAL 3건 — 모두 draft 의 갱신 대상 절 명시 누락. 설계 결정 자체의 모순은 없음 |
| Rationale Continuity | MEDIUM | sticky fast-path 가 기존 원칙 번복하면서 번복 근거 미작성 |
| Convention Compliance | LOW | draft 단계 수정 가능 |
| Plan Coherence | MEDIUM | retry-handler-followup 과 spec 영역 중첩 |
| Naming Collision | LOW | 명문화로 해소 가능 |

---

## 권장 조치 (BLOCK 해소 순서)

1. **C-1** §9.2 Redis 키 표 행 삭제 + BullMQ 큐 등재 지침 draft 에 추가
2. **C-2** §7.4 Recovery 교체 범위 명시 + `spec/data-flow/3-execution.md` 갱신 대상 추가
3. **C-3** §4.4 Rationale + §4.6 매핑 표 갱신 지침 draft 에 추가
4. **W-1/W-2** sticky fast-path 제거 (권장) — 기존 원칙 유지
5. **W-8** `RESUME_QUEUED` 를 ack `queued: boolean` 필드로 분리
6. **W-6/W-7** plan frontmatter 정정
7. **W-5** §2.13 구체 삽입 텍스트 명시
8. **W-9** retry-handler-followup 와의 순서 의존성 양쪽 plan 에 명시
9. **W-3/W-4/W-10/W-11/W-12** 본문 보강
10. **INFO 일괄** spec 반영 단계에서 한꺼번에 처리

## 메모

- `_retry_state.json` 의 agents_success 업데이트는 classifier 정책으로 main Claude 가 직접 처리하지 못함 (orchestrator 정상 호출 시에는 의도된 동작이므로 무시 가능). 5개 checker 결과 파일이 모두 세션 디렉토리에 존재하므로 본 SUMMARY 는 그 결과 통합본.
- BLOCK 해소 후 draft 재호출 (`/consistency-check --spec` 재실행) 또는 보정 사항만 reviewer 가 신뢰할 수 있다고 판단되면 그대로 spec 반영 진행 가능 — main 판단.
