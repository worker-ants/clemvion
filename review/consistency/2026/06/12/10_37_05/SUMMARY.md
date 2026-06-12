# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 등급 발견 없음 (naming_collision 의 CRITICAL 은 plan 파일 간 draft 불일치이며, 실제 spec 본문은 target plan 전제와 이미 일치함 — 차단 불필요, 수정 권고)

## 전체 위험도
**MEDIUM** — `spec-update-pr4b-embedding-retire.md` 라인 60 의 stale draft 기술(`MODEL_CONFIG_DEFAULT_MISSING` 발행 경로에 `resolveEmbedding` 포함)이 target plan 결정과 불일치. 실제 커밋된 spec 본문은 target 전제와 일치하므로 spec 자체는 정합하나, plan 파일 간 불일치가 후속 작업자에게 혼란을 줄 수 있음.

## Critical 위배 (BLOCK 사유)

해당 없음 — BLOCK: NO.

(naming_collision checker 가 CRITICAL 로 분류한 항목은 두 plan 파일의 draft 텍스트 불일치이며, 실제 spec(`spec/5-system/3-error-handling.md §1.3` 라인 51)은 target plan 전제와 이미 일치함. spec 본문 수준의 Critical 모순이 아니므로 통합 등급을 BLOCK 사유에서 제외하고 WARNING 으로 격상 처리.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | naming_collision | `spec-update-pr4b-embedding-retire.md` 라인 60 이 `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로로 `resolveEmbedding` 을 포함 — target plan 의 확정 결정(`resolveEmbedding` 은 `MODEL_CONFIG_NOT_FOUND`(404) 전용)과 정반대 기술 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` 라인 60 | `plan/in-progress/spec-fix-error-code-routing.md §1 After` | 라인 60 을 `resolveConfig` 의 ws default 경로만으로 수정하거나 "superseded — resolveEmbedding 분리는 spec-fix-error-code-routing.md 참조" 노트 추가 |
| W-2 | plan_coherence | 동일 stale draft 불일치 — `spec-update-pr4b-embedding-retire.md` §2 After 표가 커밋되지 않은 draft 상태로 in-progress 에 남아 후속 작업자 혼란 유발 가능 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` §2 After 표 | `plan/in-progress/spec-fix-error-code-routing.md §근거` | (a) target 결정 반영 수정 또는 (b) "적용 완료(commit 77f9641f)" 노트 추가 |
| W-3 | convention_compliance | `spec-fix-error-code-routing.md` frontmatter 에 `spec_impact:` 선언 없음 — `started: 2026-06-12`(cutoff 이후)이므로 `complete/` 이동 시 Gate C(`spec-plan-completion.test.ts`)가 차단 | `plan/in-progress/spec-fix-error-code-routing.md` frontmatter | `spec/conventions/spec-impl-evidence.md §4.2` · `.claude/docs/plan-lifecycle.md §4` | frontmatter 에 `spec_impact: [spec/5-system/3-error-handling.md, spec/2-navigation/5-knowledge-base.md]` 미리 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | `3-error-handling.md §1.3` `MODEL_CONFIG_DEFAULT_MISSING` 행이 `resolveEmbedding` 의 `MODEL_CONFIG_NOT_FOUND`(404) 사용을 카탈로그에서 은닉 — target draft 보강이 올바른 방향 | `spec/5-system/3-error-handling.md` §1.3 라인 51 | — | target draft §1 그대로 적용 권장 |
| I-2 | cross_spec | `conventions/error-codes.md §4` rename 이력 비고에 `resolveEmbedding` 경로 언급 부재 | `spec/conventions/error-codes.md` §4 라인 70 | — | 비고에 "resolveEmbedding ws-default 부재도 `MODEL_CONFIG_NOT_FOUND`(404) 유지 — 리소스 부재, 사용자 결정 2026-06-12" 추가 (의무 아님) |
| I-3 | cross_spec | `2-navigation/5-knowledge-base.md` Rationale 단락의 `MODEL_CONFIG_NOT_FOUND` 맥락 주석 미기술 | `spec/2-navigation/5-knowledge-base.md` 라인 239 | — | target draft §3 그대로 적용 권장 |
| I-4 | rationale_continuity | `3-error-handling.md` Rationale 의 "id 미지정 → 400" 일반론이 `resolveEmbedding`(id 미지정 → 404) 예외를 포함하지 않아 충돌처럼 읽힘 | `spec/5-system/3-error-handling.md` §Rationale 라인 395–401 | — | target draft §2 Rationale 추가 문구 그대로 적용 |
| I-5 | rationale_continuity | `error-codes.md §4` rename 이력도 동일 보완 필요 (cross-ref 또는 한 줄 주석) | `spec/conventions/error-codes.md` §4 | — | `3-error-handling.md` Rationale 추가 후 cross-ref 명시 또는 동기화 |
| I-6 | convention_compliance | plan 문서 변경 §2 가 Rationale 을 파일 말미 `## Rationale` 섹션 안에 정확히 배치해야 함을 명시하지 않음 | `plan/in-progress/spec-fix-error-code-routing.md` §제안 변경 §2 | — | "기존 `## Rationale` 섹션 말미에 추가" 한 줄 명시 |
| I-7 | convention_compliance | Before/After 코드 블록 내 셀 줄바꿈 — GFM 표 셀에 직접 붙여넣기 시 표 깨짐 가능 | `plan/in-progress/spec-fix-error-code-routing.md` §1 Before/After | — | After 문구를 단일 줄로 정리 후 적용 |
| I-8 | naming_collision | `resolveEmbedding` 함수명 표기 스타일 — plan 과 spec 본문 모두 동일 명칭 사용 중, 이름 충돌 없음 | 전반 | — | 조치 불필요 |
| I-9 | naming_collision | `spec/5-system/3-error-handling.md §1.3` 을 두 plan 이 모두 편집 대상으로 지정 — 내용은 보완적이나 적용 순서 조율 필요 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` §1.3 | `plan/in-progress/spec-fix-error-code-routing.md §1` | `spec-update-pr4b-embedding-retire.md` §1.3 편집 완료 후 target plan 적용, 최종 텍스트가 두 plan 의도를 모두 반영하는지 검증 |
| I-10 | plan_coherence | merged PR worktree 9건이 `plan/in-progress/` 에 잔존 — spec 충돌 없으나 cleanup 권장 | `plan/in-progress/` 다수 | — | `./cleanup-worktree-all.sh --yes --force` 실행 및 해당 plan → `complete/` 이동 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target draft 세 변경 모두 기존 spec 과 모순 없음. 카탈로그 보강 방향 적절 |
| rationale_continuity | LOW | 기존 Rationale 이 `resolveEmbedding` 예외를 묵시적 누락 — target draft 가 직접 보완, 기각 대안 재도입 없음 |
| convention_compliance | LOW | `spec_impact:` 선언 미리 추가 필요(Gate C 준비). 나머지 규약 준수 |
| plan_coherence | LOW | `spec-update-pr4b-embedding-retire.md` §2 stale draft 불일치, active worktree 충돌 없음 |
| naming_collision | MEDIUM | `spec-update-pr4b-embedding-retire.md` 라인 60 의 `MODEL_CONFIG_DEFAULT_MISSING` 경로 기술이 target 결정과 충돌 — 실제 spec 본문은 정합, plan 텍스트 수정 필요 |

## 권장 조치사항
1. **(W-1·W-2 해소 우선)** `plan/in-progress/spec-update-pr4b-embedding-retire.md` 라인 60 을 `resolveConfig` ws default 경로만으로 수정 또는 superseded 노트 추가 — 후속 작업자의 오적용 방지.
2. **(W-3)** `plan/in-progress/spec-fix-error-code-routing.md` frontmatter 에 `spec_impact: [spec/5-system/3-error-handling.md, spec/2-navigation/5-knowledge-base.md]` 추가 (완료 이동 전 Gate C 차단 예방).
3. **(I-1·I-4)** target draft §1(카탈로그 행 보강) + §2(Rationale 추가) + §3(KB nav 주석) 그대로 적용 — spec 본문 정합성 향상.
4. **(I-2·I-5)** `spec/conventions/error-codes.md §4` rename 이력 비고에 `resolveEmbedding` ws-default 예외 한 줄 추가 (의무 아님, 강력 권장).
5. **(I-9)** 두 plan 의 `§1.3` 편집 순서 조율 — `spec-update-pr4b-embedding-retire.md` 편집 완료 후 `spec-fix-error-code-routing.md` 적용.
6. **(I-10)** merged PR 9건 plan `complete/` 이동 및 worktree cleanup.
