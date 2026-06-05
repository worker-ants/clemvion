# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/Warning 없음. Plan Coherence 에서 머지 후 상위 plan 체크박스 갱신 필요 항목이 LOW 위험도로 식별됨. 나머지 4개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 경고 (WARNING)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Plan Coherence | `rag-quality-improvement.md §P0` 체크박스 미갱신 — 구현 완료 항목 2개가 아직 `[ ]` 상태 | `plan/in-progress/rag-quality-improvement.md §P0` | PR 머지 또는 완료 이동 시 해당 2항목(`검색 지표(순수 TS)`, `골든셋 generator/runner`)을 `[x]` 처리 |
| 2 | Plan Coherence | `--sample` 기본값(30) 과 상위 plan "수동 50+합성 확장" 논의 간 soft gap | `generate-golden-set.ts` 기본값 / `rag-quality-improvement.md §6` | 상위 plan 미결 항목에 "현재 기본값 30, CLI 제어" 주석 추가 (필수 아님) |
| 3 | Plan Coherence | `9-rag-search.md` `pending_plans:`에 추가된 파일이 main 에는 아직 미존재 (worktree 신규 생성 파일) | `spec/5-system/9-rag-search.md` frontmatter | PR 에 spec 과 plan 파일이 함께 포함되어 있는지 최종 확인 |
| 4 | Convention Compliance | `cli-utils.spec.ts` 가 `rag-evaluation.md` frontmatter `code:` 목록에 미등재 | `spec/conventions/rag-evaluation.md` frontmatter | `codebase/backend/src/scripts/cli-utils.spec.ts` 를 `code:` 에 추가하거나 glob 패턴(`src/scripts/cli-utils*`)으로 통합 |
| 5 | Convention Compliance | `eval/README.md` 를 `code:` 에 등재하는 것은 느슨한 관례 (운영 문서) | `spec/conventions/rag-evaluation.md` frontmatter 9번째 항목 | 낮은 중요도. 타 spec 과 일관성 있어 현 상태 유지 가능 |
| 6 | Rationale Continuity | `root-entities.ts` 분리 결정에 대한 Rationale 항 누락 | `spec/conventions/rag-evaluation.md ## Rationale` | D-E7 항으로 추가하면 추적성 향상. 현 시점 위반 아님 |
| 7 | Naming Collision | `parseCliFlag` 함수가 기존 마이그레이션 스크립트 2개에 로컬 복사본으로 중복 존재 | `src/scripts/migrate-button-ids.ts`, `src/scripts/migrate-node-output-refs.ts` | 기존 스크립트의 로컬 정의를 `cli-utils` import 로 교체. 이번 PR 범위 밖이면 TODO 주석 표시 |
| 8 | Naming Collision | `ROOT_ENTITIES` 이중 export 경로 (`app.module.ts` re-export + `root-entities.ts` 직접 export) | `codebase/backend/src/app.module.ts`, `src/database/root-entities.ts` | 의도적 호환 re-export. 신규 import 사이트는 `src/database/root-entities` 직접 참조 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 6가지 점검 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 모두 충돌 없음 |
| Rationale Continuity | NONE | D-E1~D-E6 전 설계 원칙이 구현에 올바르게 반영. `root-entities.ts` 분리 Rationale 항 미등재가 INFO 수준으로 존재 |
| Convention Compliance | NONE | 명명·출력 포맷·문서 구조·금지 항목 모두 적합. `cli-utils.spec.ts` 미등재 및 README `code:` 등재가 INFO 수준 |
| Plan Coherence | LOW | 상위 `rag-quality-improvement.md §P0` 체크박스 2항목 미갱신. active worktree 충돌 후보 0건 |
| Naming Collision | NONE | 신규 식별자 전체 충돌 없음. `parseCliFlag` 로컬 복사 중복과 `ROOT_ENTITIES` 이중 경로가 INFO 수준 |

## 권장 조치사항

1. **(머지 시 필수)** PR 머지 또는 `rag-eval-harness.md` 를 `plan/complete/` 로 이동하기 전에 `plan/in-progress/rag-quality-improvement.md §P0` 의 `[ ] 검색 지표(순수 TS)` 와 `[ ] 골든셋 generator/runner` 항목을 `[x]` 로 갱신.
2. **(PR 포함 확인)** `spec/5-system/9-rag-search.md` 와 `plan/in-progress/rag-eval-harness.md` 가 동일 PR 커밋에 함께 포함되어 dangling pending_plans 링크가 되지 않는지 확인.
3. **(선택 — 추적성)** `spec/conventions/rag-evaluation.md` Rationale 에 D-E7 항(`root-entities.ts` 분리 결정 배경)을 추가.
4. **(선택 — 코드 정리)** `spec/conventions/rag-evaluation.md` frontmatter `code:` 에 `codebase/backend/src/scripts/cli-utils.spec.ts` 추가 또는 glob 패턴 통합.
5. **(후속 PR — 낮은 우선순위)** `migrate-button-ids.ts`, `migrate-node-output-refs.ts` 의 로컬 `parseCliFlag` 복사본을 `cli-utils` import 로 교체.