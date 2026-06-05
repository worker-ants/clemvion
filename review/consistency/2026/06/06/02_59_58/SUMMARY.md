# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 4건(plan 위생 2건, 이모지 규약 1건, 식별자 이중관리 1건), Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | CLAUDE.md 이모지 미사용 원칙 위반 — `❌`/`✅`/`⚠️` 이모지 사용 | `src/scripts/eval-retrieval.ts` (게이트 출력 메시지), `eval/README.md` line 53 | CLAUDE.md "Only use emojis if the user explicitly requests it." | `❌` → `[FAIL]`, `✅` → `[PASS]`, `⚠️` → `[WARNING]` 등 ASCII 텍스트로 교체. 또는 CI 스크립트 출력 예외로 규약 문서화 |
| 2 | Convention Compliance | `generate-golden-set.ts` 가 바이너리 diff — LLM 호출 경로(제품 LlmService vs SDK 직접) 검증 불가 | `src/scripts/generate-golden-set.ts` | CLAUDE.md 외부 LLM 호출 정책 (SDK 직접 호출 금지) | 코드 리뷰 시 `@anthropic-ai/sdk` 직접 import 부재 및 `LlmService.chat()` 경유 여부 확인 필수 |
| 3 | Plan Coherence | `rag-eval-harness.md` Phase A/B 체크박스가 완료 후에도 전부 `[ ]` 미체크 — plan 상태 추적 오염 | `plan/in-progress/rag-eval-harness.md` §2 Phase A/B 체크박스 | plan-stale-audit `DONE?` 플래그 오작동, 후속 진입자 중복 착수 위험 | 완료된 항목 `[x]` 체크. `/ai-review` 등 미완 항목은 `[ ]` 유지 |
| 4 | Plan Coherence | `rag-quality-improvement.md` P0 대응 항목("골든셋", "검색 지표(순수 TS)")이 완료 후에도 `[ ]` 미갱신 | `plan/in-progress/rag-quality-improvement.md` §P0 | `rag-eval-harness.md` 진행 노트에 갱신 약속 있으나 미이행 | 머지 시점 또는 PR 완료 후 두 항목 `[x]` 체크 및 완료 주석 추가 |
| 5 | Naming Collision | `parseCliFlag` 공유 유틸 추출 후 기존 2개 스크립트가 동일 구현 로컬 정의 유지 — 이중 관리 상태 | `src/scripts/migrate-node-output-refs.ts` line 49, `src/scripts/migrate-button-ids.ts` line 50 | `src/scripts/cli-utils.ts` 신규 공유 버전 | 두 파일에서 로컬 `parseCliFlag` 제거 후 `import { parseCliFlag } from './cli-utils'` 로 교체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `spec/5-system/9-rag-search.md` `pending_plans` — eval plan 완료 시 항목 제거 및 status 전이 필요 | `spec/5-system/9-rag-search.md` frontmatter | `rag-eval-harness` plan 을 `plan/complete/` 로 이동 후 `pending_plans` 에서 제거. `rag-rerank-followup` 만 남으면 `status: partial` 유지, 둘 다 완료 시 `implemented` 승격 |
| 2 | Convention Compliance | `spec/conventions/rag-evaluation.md` frontmatter `code:` 목록이 diff 추가 파일과 완전 일치 — 규약 준수 | `spec/conventions/rag-evaluation.md` | 없음 |
| 3 | Convention Compliance | `rag-evaluation.md`, `9-rag-search.md` 모두 Overview/본문/Rationale 3섹션 구조 준수 | 두 파일 전체 | 없음 |
| 4 | Convention Compliance | `src/database/root-entities.ts` 신규 분리 — kebab-case 명명, `src/database/` 위치 적정 | `codebase/backend/src/database/root-entities.ts` | 없음 |
| 5 | Convention Compliance | `.gitignore` 에 `eval/golden.json`, `eval/*.report.json` 추가 — `rag-evaluation.md §4` 커밋 정책과 정합 | `codebase/backend/.gitignore` | 없음 |
| 6 | Rationale Continuity | D-E3(LlmService 경유), D-E4(결정성 tie-break), D-E5(LLM-judge 보류), D-E6(silver 상대비교), KB단위 리랭크, autoLoadEntities 미사용 — 모든 Rationale 결정 준수 확인 | `src/modules/knowledge-base/eval/**`, `src/scripts/eval-retrieval.ts` | 없음 |
| 7 | Plan Coherence | `rag-rerank-followup.md` `conditional escalate 정량 임계` 조건(P0 평가셋 보정 후 도입)이 본 구현으로 충족 | `plan/in-progress/rag-rerank-followup.md` | 해당 항목에 조건 충족 메모 추가 권장 (필수 아님) |
| 8 | Plan Coherence | Active worktree 3개(`exec-park-durable-resume`, `fix-webchat-envelope-unwrap-9519af`, `impl-exec-concurrency-cap`) 모두 target 파일과 충돌 없음 | 각 worktree HEAD | 없음 |
| 9 | Naming Collision | `ROOT_ENTITIES` 이동 — `app.module.ts` re-export 로 기존 import 사이트 호환 보존 | `src/app.module.ts`, `src/database/root-entities.ts` | 없음 |
| 10 | Naming Collision | `EvalCliModule`, `GoldenSet`/`GoldenEntry` 등 타입명, `D-E1`~`D-E6`, npm scripts `eval:*` — 기존 식별자와 충돌 없음 | `src/modules/knowledge-base/eval/` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | 미확인 (output_file 부재) | `cross_spec.md` 파일 없음 — 결과 포함 불가 |
| Rationale Continuity | NONE | Rationale 결정 전항목 준수. 기각 대안 재도입 없음 |
| Convention Compliance | LOW | WARNING 2건(이모지, generate-golden-set 바이너리 diff 미검증), INFO 5건 |
| Plan Coherence | LOW | WARNING 2건(체크박스 미갱신), INFO 3건. worktree 충돌 없음 |
| Naming Collision | LOW | WARNING 1건(parseCliFlag 이중관리), INFO 6건. 런타임 충돌 없음 |

> Cross-Spec checker 의 output_file(`cross_spec.md`)이 존재하지 않아 해당 checker 결과를 포함할 수 없었습니다. 다른 4개 checker 결과는 모두 정상 통합되었습니다.

## 권장 조치사항

1. **(WARNING — 검증 필수)** `generate-golden-set.ts` 코드 리뷰 시 `@anthropic-ai/sdk` 직접 import 부재 및 `LlmService.chat()` 경유 여부를 명시적으로 확인한다. (Convention Compliance W2)
2. **(WARNING — 규약 위반)** `eval-retrieval.ts` 게이트 출력 메시지의 `❌`/`✅` 이모지와 `eval/README.md` 의 `⚠️` 이모지를 ASCII 텍스트(`[FAIL]`/`[PASS]`/`[WARNING]`)로 교체한다. (Convention Compliance W1)
3. **(WARNING — plan 위생)** `plan/in-progress/rag-eval-harness.md` Phase A/B 완료 항목을 `[x]` 체크하고, PR 완료 후 파일을 `plan/complete/` 로 이동한다. (Plan Coherence W1)
4. **(WARNING — plan 위생)** `plan/in-progress/rag-quality-improvement.md` §P0 의 골든셋·검색지표 두 항목을 `[x]` 체크한다. (Plan Coherence W2)
5. **(WARNING — 이중관리)** `migrate-node-output-refs.ts`, `migrate-button-ids.ts` 의 로컬 `parseCliFlag` 를 제거하고 `./cli-utils` import 로 통합한다. (Naming Collision W1)
6. **(INFO)** `9-rag-search.md` frontmatter `pending_plans` 에서 `rag-eval-harness.md` 를 제거하고, 나머지 plan 완료 상태에 따라 `status` 전이 여부를 판단한다.