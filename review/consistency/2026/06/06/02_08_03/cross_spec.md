# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/rag-eval-harness.md`
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

- **[INFO]** `spec/5-system/9-rag-search.md` pending_plans 미등재
  - target 위치: `rag-eval-harness.md` §0 범위·frontmatter `spec_refs`
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/spec/5-system/9-rag-search.md` frontmatter `pending_plans` 섹션 (현재 `rag-rerank-followup.md` 1건만 등재)
  - 상세: 본 plan 은 Phase B 에서 `spec/5-system/9-rag-search.md` 에 1줄 링크를 추가할 예정이나, 해당 spec 의 frontmatter `pending_plans:` 에 `plan/in-progress/rag-eval-harness.md` 가 아직 등재돼 있지 않다. spec 파일 자체를 수정하는 건 project-planner 작업이지만, 착수 전 SoT 연결 미비 상태임을 명시한다.
  - 제안: Phase B (spec 작성) 시 `spec/5-system/9-rag-search.md` frontmatter 의 `pending_plans:` 에 `plan/in-progress/rag-eval-harness.md` 를 추가하는 것을 Phase B 작업 항목에 포함하거나, 별도 project-planner 위임으로 처리할 것.

- **[INFO]** `rag-quality-improvement.md` P0 정의 vs target 스코프 미세 불일치 — 의식적으로 좁혀진 범위
  - target 위치: `rag-eval-harness.md` §0 OUT 블록 및 §1 결정 D-E1~D-E6
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/plan/in-progress/rag-quality-improvement.md` §P0 — "CS 티켓 마이닝 + RAGAS(Python 1회 export) 합성", "생성 지표(LLM-judge)", "autoevals/phoenix-evals"
  - 상세: 상위 plan 의 P0 는 (a) CS 티켓 마이닝, (b) RAGAS 합성, (c) LLM-judge(autoevals/phoenix), (d) 한국어 judge 앙상블을 포함한다. target 은 의도적으로 "①자동 합성 + ③SME 최소"로 좁혀 (b)~(d) 를 OUT 처리하고 있어 상위 plan 의 완전한 P0 구현은 아니다. target 은 이 사실을 §0 서두와 §4 에서 명시하므로 충돌이 아닌 의식적 부분 구현이나, `rag-quality-improvement.md` 의 P0 체크리스트가 나중에 이 범위 차이를 반영해 갱신되지 않으면 완료 추적이 불명확해진다.
  - 제안: target 완료 시 `rag-quality-improvement.md` P0 체크리스트에서 "자동합성 골든셋 + 순수-TS 검색지표" 항목만 완료 표시하고, LLM-judge/autoevals/phoenix 항목은 Phase 2 미착수 상태로 명확히 분리할 것.

- **[INFO]** `spec/5-system/9-rag-search.md §3.3` conditional escalate 임계 — P0 의존 downstream 추적
  - target 위치: `rag-eval-harness.md` §0 OUT 항목 ("conditional escalate 임계 튜닝(D2) — 본 하베스가 선행조건")
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/spec/5-system/9-rag-search.md` §3.3 v1 결정 — "점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입"
  - 상세: `9-rag-search.md` 는 conditional escalate 임계 도입을 "P0 평가셋 의존"으로 명시하고 있으며, target plan 이 그 P0 평가셋을 생산하는 선행 작업이다. target 이 완료되면 이 의존이 해소되므로, 완료 후 downstream follow-up plan 을 준비해야 함을 사전에 인지해둘 필요가 있다. 모순은 아님.
  - 제안: target 완료 시 `9-rag-search.md` 의 `pending_plans:` 에 conditional escalate 임계 도입 plan 링크를 추가하거나, `rag-quality-improvement.md` P1 followup 항목에 반영할 것.

- **[INFO]** `spec/0-overview.md` 문서 맵 — 신규 `spec/conventions/rag-evaluation.md` 미예고
  - target 위치: `rag-eval-harness.md` Phase B 항목
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/spec/0-overview.md` §8 문서 맵 (정식 규약 = `spec/conventions/` 포인터)
  - 상세: `spec/0-overview.md §8` 은 "구체 파일 목록은 본 문서가 박제하지 않는다"고 명시하므로 신규 `rag-evaluation.md` 생성이 `0-overview.md` 갱신을 강제하지는 않는다. 단 다른 도메인 규약 파일들(node-output, swagger, error-codes 등)이 §4 표에 예시로 언급된 관행을 따른다면 선택적 추가가 자연스럽다.
  - 제안: Phase B 시 `spec/0-overview.md §4` 에 `rag-evaluation.md` 링크 추가 여부는 project-planner 판단. 의무 아님.

---

## 요약

target `rag-eval-harness.md` (RAG 평가 하베스 Phase 0+1 구현 plan) 는 기존 spec(`spec/5-system/9-rag-search.md`, `spec/1-data-model.md`, `spec/0-overview.md`) 과 직접 모순되는 데이터 모델·API 계약·상태 전이·RBAC 충돌이 없다. 계획하는 코드 변경 영역(`src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `codebase/backend/eval/**`) 은 기존 spec 이 다루지 않는 순수 신규 레이어이며, 제품 런타임 `LlmService.chat()` 및 `RagSearchService.searchWithMeta()` 를 read-only 호출하는 하네스 구조이므로 기존 spec 계약을 변경하지 않는다. 신규 `spec/conventions/rag-evaluation.md` 생성은 관련 spec 에 1줄 링크 추가를 수반하나, 기존 정의와의 충돌은 없다. 발견사항은 모두 INFO 등급(pending_plans 연결 미비·상위 plan 완료 추적·downstream 후속 작업 인지)으로, 구현 착수를 차단할 CRITICAL·WARNING 이 없다.

---

## 위험도

NONE

STATUS: OK
