# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 머지 차단 불필요.

## 전체 위험도
**LOW** — Warning 2건(plan 파일 갱신 누락) + INFO 다수. 기능 정확성·spec 모순 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | P0 spec 갱신 체크박스 미갱신 — `spec/conventions/rag-evaluation.md` 신규 생성 및 `9-rag-search.md` 링크 추가가 완료됐음에도 상위 plan 항목이 `[ ]` 로 남음 | `plan/in-progress/rag-quality-improvement.md` §P0 line 92 | `plan/in-progress/rag-eval-harness.md` (Phase A+B 완료 기록) | line 92 를 `[x]` 로 갱신하고 rag-eval-harness.md 참조 주석 추가 |
| 2 | Plan Coherence | "매 PR 게이트" 원문 기대 vs 수동 CLI 구현 gap 미명시 — 체크박스 `[x]` 로 완료 표시되나 CI yaml 자동화는 미착수 | `plan/in-progress/rag-quality-improvement.md` §P0 line 88 | `codebase/backend/eval/README.md` (수동 --fail-under 설명) | 해당 항목에 "(CI yaml 자동 게이트는 미착수 — 수동 --fail-under CLI 제공, PR 자동화는 후속)" 주석 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `cli-utils.ts` 가 `rag-evaluation.md` `code:` 배열에 미등재 — 빌드 가드는 통과하나 선언 불완전 | `spec/conventions/rag-evaluation.md` frontmatter `code:` | `codebase/backend/src/scripts/cli-utils.ts` 추가 또는 glob 으로 대체 |
| 2 | Convention Compliance | plan 완료 이동 시 Gate C(`spec_impact`) 미선언으로 빌드 차단 예비 위험 | `plan/in-progress/rag-eval-harness.md` frontmatter | `plan/complete/` 이동 전 `spec_impact: ["spec/conventions/rag-evaluation.md", "spec/5-system/9-rag-search.md"]` 추가 |
| 3 | Convention Compliance | `spec/conventions/rag-evaluation.md` §5 에 `❌`/`✅` 이모지 잔류 | `spec/conventions/rag-evaluation.md` §5 lines 123-127 | `❌` → `금지:` / `✅` → `허용:` 등 이모지 없는 표현으로 교체 |
| 4 | Cross-Spec | `9-rag-search.md` frontmatter `pending_plans` 에 `rag-eval-harness.md` 잔존 — plan 완료 이동 후 dead link 위험 | `spec/5-system/9-rag-search.md` frontmatter `pending_plans` | plan 파일이 `plan/complete/` 로 이동될 때 해당 행 제거 |
| 5 | Rationale Continuity | `macroAverage` 분모가 총 entry 수로 고정 — spec 의 "NaN → 평균 제외" 보장을 함수 레벨에서 명시적으로 표현하지 않음 (현재 호출 경로에서 실제 오류 없음) | `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` `macroAverage()` | 함수 내 유효 entry 카운트를 분모로 쓰거나, 구조적 불변 보장을 주석으로 명시 |
| 6 | Rationale Continuity | `eval/README.md` 의 `--threshold` 항목에 rerank_mode 분기 해석 설명 누락 | `codebase/backend/eval/README.md` `--threshold` 항목 | "KB rerank_mode 가 off 이면 cosine 임계, cross_encoder 이면 rerank 점수 임계로 해석됨(spec §3.3 / Rationale I4)" 1줄 추가 |
| 7 | Plan Coherence | 평가셋 규모·합성 비율 결정(open)이 --sample CLI 위임으로 처리됐으나 상위 plan §6 미참조 | `plan/in-progress/rag-eval-harness.md §4`, `src/scripts/generate-golden-set.ts` | `rag-eval-harness.md §4` 미해결 포인트에 추적 1줄 추가 |
| 8 | Plan Coherence | `9-rag-search.md` pending_plans 에 rag-eval-harness 추가로 rag-rerank-followup 의 spec 승격 조건 복잡화 | `plan/in-progress/rag-rerank-followup.md` 비고 | "implemented 승격은 rag-eval-harness plan 완료도 필요" 1줄 추가 권장 |
| 9 | Naming Collision | `ROOT_ENTITIES` 정의가 `app.module` → `src/database/root-entities.ts` 로 이동, re-export 로 하위 호환 유지 | `src/database/root-entities.ts`, `src/app.module.ts` | 충돌 없음 (정상 이동) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 간 모순 없음. plan 완료 이동 시 frontmatter dead link 예방 필요(INFO) |
| Rationale Continuity | NONE | D-E1~E6 모두 준수. macroAverage 분모 명시성 미비(INFO) |
| Convention Compliance | LOW | cli-utils.ts code: 미등재, Gate C spec_impact 누락 예비, 이모지 잔류(모두 INFO) |
| Plan Coherence | LOW | Warning 2건: P0 체크박스 미갱신, PR gate gap 미명시 |
| Naming Collision | NONE | 충돌 식별자 0건 |

## 권장 조치사항

1. **(WARNING 해소 우선)** `plan/in-progress/rag-quality-improvement.md` line 92 를 `[x]` 로 갱신하고, line 88 항목에 "CI yaml 자동 게이트 미착수 — --fail-under CLI 제공, PR 자동화 후속" 주석 추가.
2. **(plan 완료 이동 전 필수)** `plan/in-progress/rag-eval-harness.md` frontmatter 에 `spec_impact: ["spec/conventions/rag-evaluation.md", "spec/5-system/9-rag-search.md"]` 추가 (Gate C 빌드 차단 예방).
3. `spec/conventions/rag-evaluation.md` frontmatter `code:` 배열에 `codebase/backend/src/scripts/cli-utils.ts` 추가.
4. `spec/conventions/rag-evaluation.md` §5 의 `❌`/`✅` 이모지를 텍스트로 교체.
5. `9-rag-search.md` frontmatter `pending_plans` 에서 `rag-eval-harness.md` 제거 (plan 완료 이동 시점에 함께 처리).
6. `retrieval-metrics.ts` `macroAverage()` 에 NaN 제외 보장 주석 추가 또는 분모를 유효 entry 카운트로 변경.