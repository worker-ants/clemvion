# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 6개 WARNING 발견 (실제 동작 모순 없음, 문서 완전성 및 구현 시 주의 이슈)

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | §3.2 body 서브그래프 제약이 Parallel 을 명시하지 않아 선형 스택 불변식 전제를 §3.2 만으로 검증 불가 (incomplete cross-reference) | `spec/5-system/4-execution-engine.md` 행 217 (§3.2), 행 928 (선형 스택 불변식) | `spec/4-nodes/1-logic/10-parallel.md §168` (`PARALLEL_INVALID_CHILD`) | 행 217 의 `컨테이너 body(Loop / ForEach / Map)` 를 `(Loop / ForEach / Map / Parallel 분기)` 로 수정하거나, 선형 스택 불변식(행 928)에 dual cross-ref 추가 |
| W2 | Cross-Spec | `resume_call_stack.frames[].invokerNodeId` 의미가 spec 에 불충분 기술 | `spec/5-system/4-execution-engine.md §6.2(e)`, `§7.5` | `spec/1-data-model.md §2.13 Execution` 행 467 | §7.5 또는 §6.2(e) 에 invokerNodeId 의미 한 줄 명시 |
| W3 | Convention Compliance | 초대 에러 코드 lower_snake_case 예외가 `auth.md §1.5.4` 본문에서 "신규 추가 금지" 경고 미명시 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §1`+§3 | auth.md §1.5.4 에 UPPER_SNAKE_CASE 강제 경고 추가 |
| W4 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 동일 `execution-engine.service.ts` 병렬 수정 중 | `exec-park-resume-dispatch-registry.md §S3·S4` | `exec-intake-queue-impl.md` PR2b | target plan 완료·머지 후 PR2b rebase 순서 확정 (즉시 차단 필요성 낮음) |
| W5 | Naming Collision | `park-signal.ts`(신규) 와 기존 `park-release-signal.ts` 파일명 유사 — import 오기입 위험 | `shared/execution-resume/park-signal.ts`(신규 S1) | `shared/execution-resume/park-release-signal.ts` | 신규 파일을 구분되는 이름으로 변경 |
| W6 | Naming Collision | `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` shared 이관 후 service 로컬 선언 미제거 시 이중 정의 | `shared/execution-resume`(신규 S1) + `execution-engine.service.ts` L275–285 | service 로컬 선언 | S1·S4 동일 커밋에 로컬 선언 삭제 + import 교체 포함 |

## 참고 (INFO)

I1~I9: 무관 spec 영역(auth/mcp-client/graph-rag/cafe24 등) 문서 완전성·낮은 우선순위 — 본 PR 범위 밖.
I10: 머지 완료 stale worktree 물리 정리 권장(운영). I11: exec-intake-queue PR2b 에 registry 구조 인식 메모(후속).
I12: 신규 식별자(`ResumeTurnDispatch`/`ResumeTurnSelector`/`ResumeTurnContext`/`resumeTurnRegistry`/`dispatchResumeTurn`) 기존 충돌 없음 — 진행 가능.
I13: 신규 파일 2종 모두 기존 frontmatter 글롭(`modules/execution-engine/**`·`shared/execution-resume/**`)에 자동 포함.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §3.2 Parallel 미명시 cross-ref, invokerNodeId 불충분 기술 (동작 모순 아님) |
| Rationale Continuity | NONE | 기각 대안·합의 원칙·invariant 정합. 번복 없음 |
| Convention Compliance | LOW | lower_snake_case 예외 절차 준수. auth.md 경고 미명시 등 경미 |
| Plan Coherence | LOW | impl-concurrency-cap-pr2b 파일 경합 가능(즉시 차단 불요). stale worktree |
| Naming Collision | LOW | 이관 심볼 이중 정의 리스크(동일 커밋 해소), park-signal 유사 파일명 |

## 본 PR disposition

- **W5 → 반영**: 신규 파일을 `process-turn-result.ts` 로 명명(주 export 타입명, `park-release-signal.ts` 와 명확 구분).
- **W6 → 반영**: service L275–285 로컬 선언 삭제 + import 교체를 구현 커밋에 포함.
- **W4 → deferred(범위 밖)**: cross-worktree(`impl-concurrency-cap-pr2b`), umbrella W4 로 기추적. 본 plan 단독 해소 불가.
- **W1/W2 → deferred(범위 밖)**: PR-B2b(#501)가 랜딩한 resume_call_stack/§3.2 spec 의 doc 완전성 — 본 refactor 무관, planner 후속.
- **W3·I1~I9 → 범위 밖**: 무관 spec 영역.

---

*생성일시: 2026-06-06 18:51:56 KST*
*검토 모드: --impl-prep, scope=spec/5-system/*
*대상 Plan: plan/in-progress/exec-park-resume-dispatch-registry.md (worktree: exec-park-followup-272c4f)*
