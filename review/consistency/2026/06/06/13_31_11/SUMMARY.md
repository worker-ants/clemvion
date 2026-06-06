# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

검토 모드: `--impl-prep`
Target: `spec/5-system/4-execution-engine.md`
구현 범위: `fix-carousel-waiting-status` — Carousel blocking `waiting_for_input` UI stuck 회귀 fix
- 백엔드: `executions.service.ts findById` read-only snapshot 정규화
- 프론트: `apply-execution-snapshot.ts` waiting-node 판정 보강

---

## 전체 위험도

**LOW** — Critical·BLOCK 사유 없음. Warning 1건(error-codes 명명 긴장)은 구현 착수를 막지 않으며 spec 보완으로 해소 가능. 나머지는 모두 INFO 수준 문서 gap.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `INVALID_EXECUTION_STATE`(WS)와 `INVALID_STATE`(REST)가 동일 조건에 다른 코드명을 사용 — `error-codes.md §1` 의미 기반 단일 코드 원칙과 긴장. §7.5.1 Rationale 에 설계 의도 명시돼 있어 Critical 아님 | `spec/5-system/4-execution-engine.md §7.5.1` | `spec/conventions/error-codes.md §1` (의미 기반 명명), §3 historical-artifact 레지스트리 | `INVALID_EXECUTION_STATE` 를 `error-codes.md §3` historical-artifact 레지스트리에 등재하고 의도적 분리 이유를 기록. 또는 §7.5.1 Rationale 에 `error-codes.md §1` 와의 관계("의도적 예외, 레지스트리 등재 예정")를 명시 |
| 2 | Plan Coherence | `spec/5-system/4-execution-engine.md` 에 4개의 active pending_plan 이 추적 중 — 착수 시 §1.1·§1.3 절 병합 충돌 위험 | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` | `exec-park-b2b-04a2f8` (PR-B2b active), `impl-concurrency-cap-pr2b` (PR2b active) | 착수 전 두 active 브랜치 HEAD 의 §1.1·§1.3 수정 범위 확인. 해당 절 수정 필요 시 최신 main rebase 후 진행 |

> **본 작업과의 관련성**: 두 Warning 모두 **본 코드-only 변경에는 적용되지 않는다**. (1)은 기존 §7.5.1 error-code 로 본 fix 가 건드리지 않음. (2)는 spec 본문 수정 시에만 충돌 — 본 fix 는 `spec/` 을 일절 수정하지 않는다 (코드 2파일 + 테스트만).

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `findById` read-only 정규화 계약이 `4-execution-engine.md` 에 미명시 — `6-websocket-protocol.md §3.1`("스냅샷 payload = findById 반환값") 소비자가 "findById status = DB status"를 전제할 위험 | `spec/5-system/4-execution-engine.md §7.4 / §4` | 구현 후 §7.4 또는 신규 §4.y 에 "read-only 정규화 계약" 명시. WS spec §3.1 에 "스냅샷 status 는 findById 정규화 포함" 주석 추가 (impl-done 단계 spec 동기화) |
| 2 | Cross-Spec | `apply-execution-snapshot.ts` 의 `outputData.status` 보조 신호 사용이 `data-hydration-surfaces.md §1.2` 매트릭스에 미반영 | `spec/5-system/4-execution-engine.md §1.1` (Presentation 노드 waiting 전이) | 구현 후 `spec/conventions/data-hydration-surfaces.md §1.2` 에 `output.status = 'waiting_for_input'` (비-terminal blocking 신호) 행을 추가하고 applyExecutionSnapshot waiting 분기의 보조 판정임을 명시 |
| 3 | Rationale Continuity | `§1.2` NodeExecution 상태 설명에 plan 전제의 intra-row 불일치 케이스(중간 상태 노출 윈도우) 기술 없음 | `spec/5-system/4-execution-engine.md §1.2`, §1.1 원자성 보장 비고 | 구현 후 §1.1 원자성 비고 또는 §6.2 에 "read-path normalization: outputData.status==='waiting_for_input' + 비terminal row 는 스냅샷 서비스가 status 를 surfacing (intra-row window 보정)" 주석 추가 |
| 4 | Rationale Continuity | park-release 이후 frontend 의 event-before-snapshot 레이스 처리 요구가 spec 에 미기술 | `spec/5-system/4-execution-engine.md §7.5`, §4.x (park) | 구현 후 §7.5 rehydration 또는 §4.x 에 "apply-execution-snapshot 은 WS event 선행 도착 시 waiting 상태를 snapshot 이 되돌리지 않도록 방어" 기술 |
| 5 | Convention Compliance | §3.3 Background 실행 절이 §3.4 뒤에 위치 — 번호-순서 역전 편집 오류 | `spec/5-system/4-execution-engine.md §3` | §3.3 을 §3.2 뒤, §3.4 앞으로 이동해 번호-위치 일치 복원 |
| 6 | Convention Compliance | §1.3 의 `(CONVENTIONS Principle 4)` 참조가 `node-output.md` 내 실존하지 않는 Principle 번호를 가리킬 가능성 | `spec/5-system/4-execution-engine.md §1.3` | `node-output.md` 실제 Principle 번호 확인 후 §1.3 참조 수정 |
| 7 | Convention Compliance | `id: execution-engine` 이 파일 basename `4-execution-engine` 과 완전 일치하지 않음 — `spec-impl-evidence.md §2.1` 은 "basename 기반 권장"(강제 아님) | `spec/5-system/4-execution-engine.md` frontmatter | 동 영역 다른 spec 파일의 id 패턴 확인 후 일관성 맞춤. 현행 유지도 허용 |
| 8 | Convention Compliance | §6.2 `실행 중` 행 "TTL: 실행 타임아웃 × 2" 문구가 §8 `waiting_for_input` 무기한 보존과 혼동 가능(실질 위반 아님 — Redis 캐시 TTL vs DB row 별개) | `spec/5-system/4-execution-engine.md §6.2` | 해당 행에 "(Redis ExecutionContext 캐시 — DB Execution row 는 별도 무기한 보존)" 주석 추가 |
| 9 | Plan Coherence | 현재 worktree 미착수(main 동일 커밋) — spec 실질 변경 없어 정합성 점검 대상 없음. 정상 시점 검토 | `fix-carousel-waiting-status-4d4ed3` worktree | 조치 불필요 |
| 10 | Plan Coherence | stale worktree 4건 정리 권장 | `.claude/worktrees/` | cleanup 실행 |
| 11 | Naming Collision | 이번 작업은 신규 식별자를 일체 도입하지 않음 — 충돌 해당 없음 | — | 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | findById 정규화 계약 미명시(INFO), outputData.status 신호 hydration 매트릭스 미반영(INFO). 직접 모순 없음 |
| Rationale Continuity | NONE | 기존 결정(원자성·park-release) 번복 없음. 파생 구현 결정의 spec 기술 gap 2건(INFO) |
| Convention Compliance | LOW | INVALID_EXECUTION_STATE vs INVALID_STATE 명명 긴장(WARNING 1건). 나머지는 편집 오류·out-of-date 참조(INFO) |
| Plan Coherence | LOW | 4개 active pending_plan 과의 §1.1·§1.3 병합 충돌 위험(WARNING 1건). 실제 spec 수정은 미착수 |
| Naming Collision | NONE | 신규 식별자 없음 |

---

## 권장 조치사항 (후속 — 본 PR 비차단)

1. **(구현 후 spec 동기화 — impl-done 단계, project-planner 위임 후보)** `findById` read-only 정규화 계약 + frontend snapshot 방어 결정을 spec 에 기록. 본 fix 는 spec 본문을 수정하지 않으므로 별도 `spec-update-execution-engine` draft 로 분리.
2. data-hydration-surfaces.md §1.2 보조 신호 행 추가.
3. (low-priority) error-codes 레지스트리 등재, §3.3 순서 복원 등 — 본 fix 와 무관한 기존 spec 편집 정리.
</content>
