# Consistency Check 통합 보고서 (M-4 impl-prep)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 비차단.

> **Developer 보강 노트**: WARNING 3건은 전부 **spec-sync deferral**(park-entry 의 spec 기술이 본 developer 구현 PR 이 아닌 **후속 planner spec-sync PR**) 관련이다. spec frontmatter `code:`·§1.2 노트·Rationale 은 spec/ 영역이라 developer 가 본 PR 에서 수정 불가(role 분리) → 후속 planner PR 이 일괄 처리. W3(plan 선행 조건) 도 그 PR 에서 "impl-first(doc-guard: frontmatter `code:` 는 파일 존재 후 등재 가능) → spec-sync 후속" 으로 갱신. behavior-preserving 리팩터라 impl-first 가 spec 계약 위반 0.

## 전체 위험도
**LOW** — Critical 0. WARNING 3(spec-sync deferral), INFO 3. 구현 진행 비차단.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING) — 처리

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W1 | Cross-Spec/Convention | `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 미등재 | **후속 planner spec-sync PR** (spec/ = planner 영역; spec-code-paths 가드는 forward-only 라 미등재가 guard fail 아님) |
| W2 | Convention/Cross-Spec | §1.2 park-entry 진입점(`buildParkEntryRegistry`/`dispatchParkEntry`) 기술 누락 | **후속 spec-sync PR** — §1.2 끝에 park-entry 라우팅 대칭 노트(§54 resume 노트와 대칭) |
| W3 | Plan-Coherence | plan M-4 "spec 선행 조건" vs 실제 "impl-first" 순서 역전 | **후속 spec-sync PR** 에서 plan M-4 노트를 impl-first 로 갱신(doc-guard 사유). behavior-preserving 이라 impl 이 spec 계약 미위반 |

## 참고 (INFO)

| # | 항목 | 처리 |
|---|------|------|
| I1 | `4-execution-engine.md` Rationale 에 park-entry registry 추출 기록 부재(resume 측 #507 은 기록됨) | 후속 spec-sync PR 에 "park-entry dispatch registry 추출 (M-4)" 추가 |
| I2 | `WaitingInteractionType` 정의 위치 §1.1 SoT 정합 — 이동·변경 없음 | ✅ 불요 |
| I3 | §1.2 park-entry emit 미기재 = 식별자 충돌 아닌 spec-sync 위임 | 후속 PR |
| I4 | `spec-sync-resume-dispatch-registry.md` 완료 후 park-entry spec 추적 plan 항목 부재 | 후속 spec-sync PR 에서 plan 등재/갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | frontmatter `code:` 미등재(spec-sync deferral). Critical 없음 |
| Rationale-Continuity | NONE | M-4 설계가 기존 Rationale 결정과 정합 |
| Convention-Compliance | LOW | frontmatter + §1.2 기술 누락(spec-sync deferral) |
| Plan-Coherence | LOW | plan 선행 조건 vs impl-first 순서(spec-sync PR 에서 갱신) |
| Naming-Collision | NONE | 신규 식별자 유일, resume 대칭 패턴 준수 |

## 권장 조치사항 (처리 반영)
1. 본 developer 구현 PR: codebase-only(park-entry-dispatch.ts + 3 사이트 위임 + unit). behavior-preserving, e2e 214 PASS.
2. 후속 planner spec-sync PR: frontmatter `code:` 등재 + §1.2 park-entry 대칭 노트 + `4-execution-engine.md` Rationale 기록 + plan M-4 노트 impl-first 갱신.
