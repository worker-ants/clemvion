# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
검토 대상: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md` — RAG 평가 하베스 구현 완료 후 spec-impl 정합
구현 범위: `codebase/backend/src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `src/database/root-entities.ts`

---

## 발견사항

### [INFO] `spec/5-system/9-rag-search.md` frontmatter — `pending_plans` 의 eval plan 완료 시 status 전이 필요
- target 위치: `spec/5-system/9-rag-search.md` frontmatter, `pending_plans:` 필드
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 인 경우 pending_plans 에 미구현 surface 를 책임지는 모든 plan 경로를 의무 등재. 모든 pending_plans 가 `complete/` 로 이동하면 `implemented` 로 승격 의무 (가드 §4)
- 상세: `9-rag-search.md` frontmatter 에는 `pending_plans: [plan/in-progress/rag-rerank-followup.md, plan/in-progress/rag-eval-harness.md]` 가 있다. 본 구현 PR 로 `rag-eval-harness` plan 이 완료되었다면, 해당 plan 파일을 `plan/complete/` 로 이동하고 `pending_plans` 에서 제거해야 한다. `rag-rerank-followup.md` 가 여전히 in-progress 이면 status 는 `partial` 유지가 맞고, 둘 다 완료되면 `implemented` 로 승격해야 한다. 갱신이 누락되면 `spec-plan-completion.test.ts` 가드가 경보를 낸다.
- 제안: `plan/in-progress/rag-eval-harness.md` 를 `plan/complete/` 로 이동하고 `9-rag-search.md` 의 `pending_plans` 에서 제거. 나머지 plan 상태에 따라 status 전이 여부 판단.

---

### [WARNING] `eval-retrieval.ts` 및 `eval/README.md` — 이모지 사용 (CLAUDE.md 이모지 미사용 원칙)
- target 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (lines ~1483: `❌ 게이트 실패`, ~1487: `✅ 게이트 통과`), `codebase/backend/eval/README.md` (line 53: `⚠️`)
- 위반 규약: CLAUDE.md "Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked."
- 상세: CI 게이트 출력 메시지에 `❌`/`✅` 이모지, README 에 `⚠️` 이모지가 포함되어 있다. CLAUDE.md 는 명시적 요청 없이 이모지를 파일에 쓰는 것을 금지한다. 이 이모지들은 사용자가 명시적으로 요청한 것이 아니라면 규약 위반이다.
- 제안: `❌` → `[FAIL]`, `✅` → `[PASS]`, `⚠️` → `[WARNING]` 등 ASCII 텍스트로 교체. 또는 CI 스크립트 출력 이모지를 프로젝트 규약 예외로 문서화한다면 CLAUDE.md 또는 관련 규약을 갱신.

---

### [WARNING] `generate-golden-set.ts` — 바이너리 diff 로 표시되어 LLM 호출 경로 직접 검증 불가
- target 위치: `codebase/backend/src/scripts/generate-golden-set.ts` (diff: Binary files)
- 위반 규약: CLAUDE.md 외부 LLM 호출 정책 — `subprocess.run(["claude", "-p", ...])` 와 Anthropic SDK 직접 호출은 별도 과금/미터링을 우회하므로 금지. 허용 경로는 `Agent` tool / `Workflow` tool 또는 제품 내 `LlmService`
- 상세: diff 가 바이너리로만 표시되어 소스를 직접 확인할 수 없다. `spec/conventions/rag-evaluation.md §Rationale D-E3` 에서 "제품 자체 `LlmService.chat()`(graph-extraction 과 동일 패턴)을 쓴다"고 명시하므로 spec 수준에서는 의도가 명확하지만, 실제 구현이 SDK 직접 호출을 하지 않는지 코드 리뷰 시 별도로 확인해야 한다.
- 제안: 코드 리뷰 시 `generate-golden-set.ts` 내부에서 `@anthropic-ai/sdk` 직접 import 가 없는지, `LlmService.chat()` 또는 제품 동일 경로를 경유하는지 확인 필요.

---

### [INFO] `spec/conventions/rag-evaluation.md` frontmatter `status: implemented` — 구현 파일 목록 완전 일치
- target 위치: `spec/conventions/rag-evaluation.md` frontmatter `code:` 목록
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 일 때 `code:` 에 ≥1 실존 경로 매치 의무
- 상세: frontmatter `code:` 에 diff 에서 추가된 모든 구현 파일(`golden-set.types.ts`, `retrieval-metrics.ts`, `retrieval-metrics.spec.ts`, `lang-detect.ts`, `eval-cli.module.ts`, `generate-golden-set.ts`, `eval-retrieval.ts`, `golden.example.json`, `eval/README.md`)이 등재되어 있고 diff 와 일치한다. 규약을 올바르게 준수하고 있다.
- 제안: 없음. 현재 상태 유지.

---

### [INFO] `rag-evaluation.md` 문서 구조 — Overview / 본문 / Rationale 3섹션 규약 준수
- target 위치: `spec/conventions/rag-evaluation.md` 전체 구조
- 위반 규약: 해당 없음 (준수 확인)
- 상세: `## Overview`, `## 1. 골든셋 스키마` ~ `## 5. 해석 가이드` (본문), `## Rationale` 의 3섹션 구조를 갖추고 있다. CLAUDE.md 가 권장하는 Overview / 본문 / Rationale 패턴을 준수한다. `spec/5-system/9-rag-search.md` 도 동일하게 준수한다.
- 제안: 없음.

---

### [INFO] `src/database/root-entities.ts` 신규 분리 파일 — 명명 규약 및 위치 적정
- target 위치: `codebase/backend/src/database/root-entities.ts`
- 위반 규약: 해당 없음
- 상세: `ROOT_ENTITIES` 를 `app.module.ts` 에서 `src/database/root-entities.ts` 로 분리하며 `app.module.ts` 에서 re-export 로 하위 호환을 유지한다. 파일명 `root-entities.ts` 는 kebab-case 로 프로젝트 백엔드 관례와 일치하며, `src/database/` 위치는 DB 관련 유틸리티 파일로서 적절하다.
- 제안: 없음.

---

### [INFO] `.gitignore` 커밋 정책 — `spec/conventions/rag-evaluation.md §4` 과 일치
- target 위치: `codebase/backend/.gitignore` (추가된 `eval/golden.json`, `eval/*.report.json`)
- 위반 규약: 해당 없음 (준수 확인)
- 상세: 실 골든셋(`eval/golden.json`)과 리포트(`eval/*.report.json`)를 gitignore 하고 예시(`eval/golden.example.json`)만 커밋하는 정책이 `rag-evaluation.md §4` 의 커밋 정책과 정확히 일치한다.
- 제안: 없음.

---

## 요약

`spec/conventions/rag-evaluation.md` 와 `spec/5-system/9-rag-search.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`)의 frontmatter 의무(id/status/code 3필드), Overview/본문/Rationale 3섹션 권장 구조를 모두 충족한다. 구현 파일 명명(kebab-case), gitignore 커밋 정책, EvalCliModule 의 경량 DI 격리 설계 모두 spec 정의와 정합하다. 주요 지적은 두 가지다: (1) `eval-retrieval.ts` 와 `eval/README.md` 의 이모지 사용이 CLAUDE.md 이모지 미사용 원칙과 충돌하며, (2) `generate-golden-set.ts` 가 바이너리 diff 로만 표시되어 LLM 호출 경로(제품 LlmService vs SDK 직접 호출) 준수를 직접 검증할 수 없다. 또한 `9-rag-search.md` 의 `pending_plans` 에서 완료된 eval plan 을 제거하고 status 를 갱신하는 작업이 이번 PR 에 포함되지 않았다면 spec-impl-evidence 가드가 경보를 낼 수 있다.

---

## 위험도

LOW
