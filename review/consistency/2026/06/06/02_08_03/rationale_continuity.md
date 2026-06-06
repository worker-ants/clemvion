# Rationale 연속성 검토 — rag-eval-harness

**검토 모드**: `--impl-prep` (구현 착수 전)
**Target**: `plan/in-progress/rag-eval-harness.md`
**분석일**: 2026-06-06

---

## 발견사항

### 1. [INFO] 생성 지표(LLM-judge) OUT 선언 — 상위 plan P0 항목과의 의도적 scope 분리, 명시 충분

- **target 위치**: `§0 범위 확정 OUT` — "생성 지표(LLM-judge, autoevals/phoenix) — Phase 2"
- **과거 결정 출처**: `plan/in-progress/rag-quality-improvement.md §3 P0` — `autoevals`(npm) + `@arizeai/phoenix-evals` LLM-judge 를 P0 로 명시. `한국어 judge κ≈0.3 → hard gate 금지` 원칙.
- **상세**: 상위 plan(rag-quality-improvement) 의 P0 는 생성 지표(LLM-judge)를 검색 지표와 함께 P0 묶음으로 열거했다. target plan 은 이를 "Phase 2"로 후속화했다. 명시적으로 `§0 OUT` 에 표기되어 있고, 한국어 judge 한계(κ≈0.3, hard gate 금지)에 대한 인지는 `§1 D-E6 절대 점수 해석 금지 — README 명시`에 간접 반영되어 있다. 상위 plan 의 P0 범위를 "순수-TS 검색지표 먼저"로 좁히는 전략적 분리이며, OUT 절에 명시적으로 기록했다. 기각이 아니라 범위 한정이므로 Rationale 연속성 관점에서 "결정의 무근거 번복"으로 볼 수 없다.
- **제안**: `spec/conventions/rag-evaluation.md`(Phase B 신규 spec) 를 작성할 때, 생성 지표·agentic 지표를 OUT 절 또는 "Planned" 표기로 명시해 두면 향후 Phase 2 spec 작성자가 같은 맥락을 인지할 수 있다.

---

### 2. [INFO] `raw 한국어 judge 점수는 hard gate 금지` 원칙 — target 반영 위치 확인

- **target 위치**: `§1 D-E6` — "절대 점수 해석 금지 — README 명시."
- **과거 결정 출처**: `rag-quality-improvement.md §3 P0` — "한국어 judge κ≈0.3 → retrieval 지표·reference 기반 우선, raw 한국어 judge 점수는 hard gate 금지."
- **상세**: 검색지표(Recall@k 등)는 순수-TS 결정적 지표라 한국어 judge 품질 문제와 무관하다. target 의 `--fail-under` 게이트(`§2 Phase A eval-retrieval.ts`)는 검색 지표에만 적용되므로 원칙 충돌 없음. 단 `D-E6 절대 점수 해석 금지` 규칙이 README 명시로만 남으면 spec 위치에서의 규범성이 약해진다.
- **제안**: `spec/conventions/rag-evaluation.md` 신규 spec 에 "절대 점수 해석 금지, 상대 회귀 비교만 유효"를 silver/gold 정의와 함께 명시하면 Rationale 연속성이 spec 레벨에서 확보된다.

---

### 3. [INFO] D-E3 LLM 경로 — `LlmService.chat()` 사용과 외부 LLM 호출 정책 충돌 없음(명시 충분)

- **target 위치**: `§1 D-E3` — "제품 자체 `LlmService.chat()` (graph-extraction 과 동일 패턴, plan-metered 아님 = 제품 런타임 LLM). 외부 harness LLM 정책과 무관(제품 코드)."
- **과거 결정 출처**: `CLAUDE.md §외부 LLM 호출 정책` — "model 호출은 plan-metered harness 경로로만 한다. subprocess.run([\"claude\", \"-p\", ...]) 와 Anthropic SDK 직접 호출은 금지."
- **상세**: target 이 참조하는 LLM 호출은 제품 런타임 코드(`LlmService.chat()`) 내의 generator script 용도이며, harness/orchestrator 가 직접 LLM 을 호출하는 것이 아니다. target 은 "plan-metered 아님"을 직접 주석으로 달아 두었고, CLAUDE.md 정책이 harness(orchestrator) LLM 호출을 겨냥한 것임을 정확히 구분한다. 충돌 없음.
- **제안**: 현재 명시로 충분. 추가 조치 불필요.

---

### 4. [INFO] `conditional escalate 임계 튜닝(D2)` — Rationale 연속성 정합

- **target 위치**: `§0 OUT` — "conditional escalate 임계 튜닝(D2) — 본 하베스가 선행조건, 별도 작업."
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §Rationale` 및 `plan/complete/spec-draft-rag-reranking.md §Rationale` — "점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입."
- **상세**: spec 에 "P0 평가셋 보정 후 후속 도입"으로 명기된 conditional escalate 임계를 target 이 선행조건 plan 으로 자리매김하는 것은 완전히 일관된다. spec 의 invariant("conditional escalate 는 평가셋 전에 미도입")를 충실히 따른다.
- **제안**: 현재 명시로 충분.

---

### 5. [INFO] `D-E4 결정성` — `chunkId` 사전순 2차 정렬 결정, spec 반영 위치 지정 필요

- **target 위치**: `§1 D-E4` — "지표 함수는 순수·결정적. 동점 score → `chunkId` 사전순 2차 정렬."
- **과거 결정 출처**: `rag-quality-improvement.md §3 P0` — "결정적 tie-break(chunk id 2차 정렬), doc/chunk id 정규화." `spec/5-system/9-rag-search.md` Rationale 에는 없음.
- **상세**: `chunkId` 사전순 정렬이라는 결정성 규칙은 신규 Rationale 사항으로, 현재 spec 어디에도 반영되어 있지 않다. `spec/conventions/rag-evaluation.md` 신규 spec 이 이 규칙을 SoT 로 담아야 한다. target plan 이 Phase B 에서 spec 으로 작성하도록 설계하고 있으므로 흐름은 정합하다. 단 코드(Phase A) 가 spec(Phase B) 보다 먼저 구현되는 구조이므로, 결정이 plan 에만 기록된 상태가 임시 발생한다.
- **제안**: Phase B spec 작성 시 `chunkId` 정렬 결정성 규칙을 `spec/conventions/rag-evaluation.md §지표 정의`에 명시.

---

### 6. [INFO] `eval/golden.json` git 커밋 정책 — PII 처리 유연화, spec 미기록

- **target 위치**: `§4 미해결` — "eval/golden.json 실데이터를 repo 에 커밋할지(민감정보 가능성) — 기본은 example 만 커밋, 실 golden 은 사용자 결정."
- **과거 결정 출처**: `rag-quality-improvement.md §3 P0` — "`eval/golden.json` git 버전관리." (PII/민감정보 처리 정책 별도 언급 없음.)
- **상세**: 상위 plan 이 `eval/golden.json` git 버전관리를 전제했으나, target 이 PII 가능성을 들어 "example 만 커밋, 실 golden 은 사용자 결정"으로 유연화했다. 상위 plan 에서 미처 고려하지 않은 PII 위험을 신중하게 처리한 것으로, Rationale 의 결정을 무근거 번복하는 수준이 아니다. 이 유연화에 대한 Rationale 기록이 target 에 없고 미해결 항목으로만 표기되어 있다.
- **제안**: `spec/conventions/rag-evaluation.md` 신규 spec 의 golden set 스키마 절에 "실 CS 데이터 포함 시 PII 처리 정책" 항을 추가하면 결정이 spec 레벨에서 기록된다.

---

## 요약

target 문서(`plan/in-progress/rag-eval-harness.md`)는 상위 plan(`rag-quality-improvement.md §P0`)과 관련 spec(`spec/5-system/9-rag-search.md Rationale`, `plan/complete/spec-draft-rag-reranking.md Rationale`)의 합의 원칙을 전반적으로 충실히 따른다. 생성 지표(LLM-judge) 후속화는 명시적 OUT 절로 처리되어 무근거 번복이 아닌 범위 한정이고, conditional escalate 임계 튜닝을 선행조건으로 자리매김한 것은 spec 의 "P0 보정 후 도입" invariant 와 완전히 일관된다. LLM 경로 주석("plan-metered 아님 = 제품 런타임 LLM")이 CLAUDE.md 정책과의 혼동을 사전에 차단하고 있다. 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 존재하지 않는다. 유일한 주의 사항들은 모두 INFO 수준으로, `chunkId` 결정성 규칙·PII 처리 정책·절대 점수 해석 금지 원칙이 plan 레벨에만 기록되고 아직 spec 에 부재하는 점인데, 이는 Phase B(spec 작성)가 미착수이기 때문이며 흐름 자체의 결함은 아니다.

---

## 위험도

NONE
