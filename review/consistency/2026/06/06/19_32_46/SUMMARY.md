# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 대상: `spec/5-system/4-execution-engine.md` (exec-park B-1 follow-up)
구현 범위: `resume-turn-dispatch.ts` (신규), `process-turn-result.ts` (신규), `execution-engine.service.ts` 리팩터링
검토 일시: 2026-06-06

---

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 2건(spec 서술 동기화 미완, interaction-type-registry 매트릭스 stale). INFO 7건(문서화 공백·plan 추적·명명 참고).

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Convention Compliance | spec §7.5 / §6.2 다이어그램이 신규 `dispatchResumeTurn` + `resumeTurnRegistry` 레이어를 미반영 — 직접 if/else 분기로 서술된 채 구현과 어긋남 | `spec/5-system/4-execution-engine.md` L905 영역(§7.5 다이어그램), L922 영역(§6.2 최내 frame 설명) | SDD 원칙 (코드 변경 → spec 동기화); CLAUDE.md "기술 명세는 spec/*.md 본문" | `§7.5` 다이어그램과 `§6.2` 최내 frame 서술에 `dispatchResumeTurn`(→ `resumeTurnRegistry` first-match-wins: form/buttons/ai_conversation) 역할 한 줄 추가. project-planner 도메인(spec write) — 현 PR 또는 후속 spec-sync plan 으로 추적 |
| W2 | Convention Compliance | `interaction-type-registry.md` §1.1 SoT 표 / §1.2 처리 분기 매트릭스에 `resume-turn-dispatch.ts` 미등재 — enum 값 라우팅 경로 변경이 SoT 에 반영되지 않아 향후 blocking 노드 타입 추가 시 매트릭스 stale 위험 | `spec/conventions/interaction-type-registry.md` §1.1 Backend 행, §1.2 `Backend emit 위치` 컬럼 | `interaction-type-registry.md §1.2` 규칙 1 "표의 모든 위치를 한 PR 안에서 동시 갱신" | §1.1 Backend 행에 `resume-turn-dispatch.ts`(또는 glob `execution-engine/**`) 추가, §1.2 매트릭스 비고에 "resumeTurnRegistry dispatch (resume-turn-dispatch.ts)" 부기. enum 값 신규 추가 아님 → CRITICAL 아님 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | spec §7.5 rehydration 다이어그램이 `dispatchResumeTurn` 레이어를 명시하지 않음 (W1과 동일 현상, 기능 모순 없음) | `spec/5-system/4-execution-engine.md` §7.5 L903~906 | §7.5 주석에 `dispatchResumeTurn`(registry 기반 라우팅) + AI 경로 `handleAiResumeTurn` 경유 명시 권장 (선택) |
| I2 | Cross-Spec | `PARK_RELEASED` / `ProcessTurnResult` 이관 — spec frontmatter `code:` 범위 내 변경, 별도 갱신 불요 | `spec/5-system/4-execution-engine.md` frontmatter | 추가 조치 없음 |
| I3 | Cross-Spec | `resume-turn-dispatch.ts` JSDoc 내 `§6.2(중첩 재개)` 레이블이 실제 spec §6.2(영속화 정책)와 약간 불일치 | `resume-turn-dispatch.ts` JSDoc | `§7.5(rehydration) · §7.5 중첩 sub-workflow 재개`로 교정 권장 (낮은 우선순위) |
| I4 | Rationale Continuity | `PARK_RELEASED` shared 모듈 이관 근거가 spec Rationale 에 미기록 — 코드 주석이 보완 중 | `spec/5-system/4-execution-engine.md §Rationale` | spec Rationale `"park 즉시 해제"` 항에 "B-1 follow-up 으로 sentinel 을 `shared/execution-resume/process-turn-result.ts`로 이관" 한 문장 추가 권장 (필수 아님) |
| I5 | Rationale Continuity | `resumeTurnRegistry` 지연 초기화(lazy `??=`) — 기각 대안과 정합하나 spec Rationale 에 미기술 | `execution-engine.service.ts` `private _resumeTurnRegistry` getter | 현 상태 유지. `afterEach` 리셋 패턴(ai-review W4 도입) 유지. |
| I6 | Plan Coherence | `exec-park-polish.md` 및 `exec-park-durable-resume.md` plan complete 이동 미완; W11 umbrella 항목과 target 추적 연결 부재 | `plan/in-progress/exec-park-polish.md`, `plan/in-progress/exec-park-durable-resume.md` | `exec-park-polish.md` → `plan/complete/` 이동. `exec-park-durable-resume.md` W11 에 "exec-park-followup-272c4f 에서 완료" 표기. stale worktree `impl-exec-concurrency-cap` 정리 권장 |
| I7 | Naming Collision | `ResumeTurnDispatch.kind`(string: form/buttons/ai_conversation)와 `NodeTypeMetadata.kind`(discriminant union) 가 같은 필드명으로 코드베이스 내 공존 — 타입 시스템으로 이미 분리, 실질 혼동 위험 낮음 | `resume-turn-dispatch.ts`, `NodeTypeMetadata` 인터페이스 | 향후 registry 항목 추가 시 두 `kind` 개념 혼용 주의 (타입 안전성 확보됨) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec §7.5 기술과 구현 계층 명명 동기화 권장(INFO) 3건. 기능 충돌 없음 |
| Rationale Continuity | NONE | shared 모듈 이관 Rationale 기록 공백(INFO) 2건. 기각 대안 재도입 없음 |
| Convention Compliance | MEDIUM | spec §7.5/§6.2 서술 미갱신(W1), interaction-type-registry §1.2 stale(W2). 명명·에러코드·frontmatter glob 정상 |
| Plan Coherence | NONE | plan complete 이동 미완(INFO) 2건. active worktree 충돌 없음(충돌 후보 1건 stale 확정) |
| Naming Collision | NONE | 신규 식별자 전원 충돌 없음. `kind` 필드 공존 INFO 1건 |

---

## 권장 조치사항

1. **(W1 — spec 서술 동기화)** `spec/5-system/4-execution-engine.md` §7.5 다이어그램(L905 영역)과 §6.2 최내 frame 설명(L922 영역)에 `dispatchResumeTurn` + `resumeTurnRegistry` first-match-wins 라우팅 한 줄 추가. project-planner 도메인 — 후속 spec-sync plan 으로 추적하거나 현 세션 내 처리.
2. **(W2 — interaction-type-registry 동기화)** `spec/conventions/interaction-type-registry.md` §1.1 Backend 행 및 §1.2 매트릭스에 `resume-turn-dispatch.ts` 등재. enum 값 신규 추가 없으므로 즉각 차단은 아니나, 다음 blocking 노드 타입 추가 전에 반드시 완료.
3. **(I6 — plan 정리)** `plan/in-progress/exec-park-polish.md` → `plan/complete/` 이동. `exec-park-durable-resume.md` W11 완료 표기. stale worktree `impl-exec-concurrency-cap` 정리(`cleanup-worktree-all.sh`).
4. **(I3 — JSDoc 교정)** `resume-turn-dispatch.ts` JSDoc `§6.2(중첩 재개)` → `§7.5 중첩 sub-workflow 재개`로 교정 (낮은 우선순위).
5. **(I4 — Rationale 보강)** spec Rationale 에 sentinel shared 이관 경위 한 문장 추가 (선택).