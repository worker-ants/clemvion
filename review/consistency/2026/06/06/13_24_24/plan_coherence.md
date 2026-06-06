# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상 spec: `spec/5-system/9-rag-search.md`
구현 착수 예정 내용: D1(점수 기반 동적 컷) + D2(listwise escalate 정밀화) + ragTopK `.optional()` 변경

---

## 발견사항

### [CRITICAL] D2 — `cross_encoder_llm` 의 conditional escalate 도입이 기존 plan 의 "P0 의존" 결정을 우회

- **target 위치**: target 기술 블록 "**D2 — listwise escalate 메커니즘**" 항목. "cross_encoder_llm 의 항상-LLM-grading(v1)을 conditional escalate(cross-encoder 상위 점수 평탄/모호 시에만 listwise grading)로 정밀화"
- **관련 plan**:
  - `plan/in-progress/rag-rerank-followup.md` 18행: `[ ] **conditional escalate 정량 임계** (점수 평탄/모호) — P0 평가셋 보정 후 도입. cross_encoder_llm 은 현재 "항상 grading"(#478); escalate 는 LLM 콜 절감 최적화로 P0 의존.`
  - `plan/in-progress/rag-quality-improvement.md` §6 남은 결정: "conditional escalate 정량 임계는 P0 보정 후 후속"
  - `spec/5-system/9-rag-search.md §3.3.2` (v1 결정): "`cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입)"
- **상세**: `rag-rerank-followup.md` 는 conditional escalate 정량 임계가 **P0 평가셋 보정이 선행** 되어야 한다는 "결정 필요" 항목을 명시적으로 열어둔 상태(`[ ]`). target 은 이 P0 선행 조건을 충족하지 않고 conditional escalate 를 바로 도입하려 한다. `rag-quality-improvement.md §7.C` 도 동일하게 "D2 conditional escalate 임계 튜닝 — P0 선행조건 충족됨"이라 표기하지만, P0 baseline 실산출(`§7.B`)이 아직 미완(`[ ]` 상태)이므로 임계 수치의 합의 근거가 없다.
- **제안**: (a) P0 baseline(`rag-quality-improvement.md §7.B`)을 먼저 완료해 실 골든셋 기반 임계를 확정한 뒤 D2를 착수하거나, (b) D2 범위를 "spec 및 code에 conditional escalate 진입점만 구조적으로 추가하되, 임계 상수를 TBD/플래그-off 로 남기고 P0 완료 후 수치 결정"으로 제한하는 방식으로 rag-rerank-followup.md 의 미결 항목과 합의해야 한다. 현재 서술("정밀화") 그대로 착수하면 spec §3.3.2 의 v1 결정과 rag-rerank-followup.md 의 pending 항목을 일방 우회하게 된다.

---

### [WARNING] D1 — `rerank_mode = off` 경로의 "byte-identical 하위호환" 약속 변경이 spec 갱신 없이 구현 착수 예정

- **target 위치**: target 기술 블록 "**D1 — 점수 기반 동적 컷**" 항목. "off(vector, rerank_mode='off' 기본) 경로를 wide 회수(내부 상수 ~50, θ 게이트는 SQL 유지) → app-layer 동적 컷으로 교체"
- **관련 plan**:
  - `spec/5-system/9-rag-search.md §3.3.1` 표: `| off (기본) | 후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**.`
  - `spec/5-system/9-rag-search.md §3.1` 주석: "`rerank_mode = 'off'`(기본)이면 위 SQL 그대로 cosine 임계+topK 컷 (현행 동작)."
  - `spec/5-system/9-rag-search.md` Rationale: "`off` 기본은 (a) 하위호환 byte-identical (b) 리랭커 없는 배포에서도 제품 동작"
  - `plan/in-progress/rag-quality-improvement.md §3 P1`: spec 갱신 대상으로 `spec/5-system/9-rag-search.md 흐름·컷 정책` 포함되나, spec 개정이 완료된 상태가 아님
- **상세**: target 의 D1 은 `off` 경로를 `ORDER BY score DESC LIMIT topK(5)` 의 SQL 선차단에서 wide 회수(~50) + app-layer 동적 컷으로 교체한다. 이것은 현재 spec 의 "byte-identical" 약속을 **의도적으로 깨는 결정**이다. spec §3.3.1 과 Rationale 이 명시적으로 "off = byte-identical" 을 보장하고 있으므로, 구현에 앞서 spec §3.1 SQL 설명, §3.3.1 표, Rationale 의 `off` 하위호환 표현을 project-planner 가 개정하고 `--spec` consistency-check 통과가 선행되어야 한다.
- **제안**: `project-planner` 에게 `spec/5-system/9-rag-search.md §3.1`(SQL 설명 및 `rerank_mode='off'` 주석), `§3.3.1`(off 행 표), `§3.3.2`(off 경로 흐름), `Rationale`("byte-identical" 표현) 갱신을 위임한 뒤 `--spec` consistency-check → BLOCK:NO 를 확인하고 구현 착수 순으로 진행한다. rag-quality-improvement.md §3 P1 의 spec 갱신 체크박스를 먼저 완료해야 developer 착수 가능하다.

---

### [WARNING] `ragTopK` `.default(5)` → `.optional()` 변경이 `spec/4-nodes/3-ai/1-ai-agent.md` 의 기본값 표 및 config-echo 정책과 spec 미갱신 상태에서 충돌

- **target 위치**: target 기술 블록 "**ragTopK 의미 변경**": "ai-agent.schema.ts 의 ragTopK zod `.default(5)` 제거 → `.optional()`. 미지정 시 dynamic cut 가 내부 inject-cap(12)까지 지배, LLM top_k 또는 노드 ragTopK 명시 시 그 값이 ceiling override."
- **관련 plan**:
  - `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표: `| ragTopK | Integer | | \`5\` | KB tool 호출 시 반환할 청크 수의 기본값 ...`
  - `spec/4-nodes/3-ai/1-ai-agent.md §7` Config echo 정책: `ragTopK` 가 `default/미설정 값과 일치하면 echo 에서 생략` 대상 필드 목록에는 없고(memory 필드들은 명시), config echo JSON 예시 `§12 근방`에 `"ragTopK": 5` 가 하드코딩됨
  - `spec/5-system/9-rag-search.md §3.1` 파라미터 표: `$4` = 최대 결과 수(topK) | LLM 호출 인자 또는 `5` (기본값 5 명시)
- **상세**: `ragTopK` 기본값이 `5`에서 `optional`(미지정 = inject-cap 12 지배)으로 바뀌면 spec 의 두 문서(1-ai-agent.md §1 표 기본값 열, 9-rag-search.md §3.1 파라미터 표)와 config echo 정책이 모두 맞지 않게 된다. frontend FieldTable + i18n dict 갱신은 target 이 인지하고 있으나, spec 본문 갱신은 "노드 schema 변경이므로 frontend ... 동반 갱신 예정"이라 언급될 뿐 spec 개정 선행 절차가 명시되지 않았다. developer 는 spec read-only 이므로 schema 변경 전 project-planner 위임이 필요하다.
- **제안**: `project-planner` 에게 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표의 ragTopK 기본값 열을 "— (미지정 시 동적 컷 inject-cap 상한 내에서 지배; 명시 시 ceiling override)" 형태로 갱신, `spec/5-system/9-rag-search.md §3.1` $4 파라미터 기본값 설명 갱신, 그리고 `§2.1` KB tool 정의의 `top_k` description `"Default: <ragTopK>"` 표현 갱신을 의뢰한다. spec 갱신 + `--spec` consistency-check 후 구현 착수.

---

### [WARNING] `rag-quality-improvement.md §3 P1` spec 갱신 phase 가 완료되지 않은 채 구현 착수 예정

- **target 위치**: target 전체 (D1+D2 구현 착수 선언)
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md §3 P1`
  ```
  - [ ] **점수 기반 동적 컷**(D1) — 최우선. 회수 폭 30~50, token-budget 상한, 생성 주입 ~8~12.
  ...
  - [ ] **spec 갱신**: `spec/5-system/9-rag-search.md` 흐름·컷 정책, `spec/4-nodes/3-ai/1-ai-agent.md` ragTopK/threshold 의미.
  ```
- **상세**: `rag-quality-improvement.md §3 P1` 은 spec 갱신을 구현과 함께 담당해야 할 항목 중 하나로 포함하고 있으나, 이는 아직 `[ ]` 미완 상태다. CLAUDE.md 의 SDD 방법론은 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무"를 명시하며, 현재 consistency-check(`--impl-prep`)가 진행 중인 것은 이 절차의 일환이다. spec 갱신 없이 구현 코드만 변경되면 spec-impl 괴리가 발생한다.
- **제안**: D1 + ragTopK 변경에 관한 spec 갱신(위 CRITICAL/WARNING 항목들)을 project-planner 가 완료하고, `--spec` consistency-check BLOCK:NO 확인 후 developer 가 구현 착수하도록 순서를 명확히 한다. rag-quality-improvement.md §3 P1 spec 갱신 체크박스를 구현 전 완료로 표시해야 한다.

---

### [INFO] `rag-rerank-followup.md` 의 worktree `rag-rerank-impl` — PR MERGED, stale worktree

- `plan/in-progress/rag-rerank-followup.md` frontmatter `worktree: rag-rerank-impl`이지만, 해당 branch `rag-rerank-impl` 은 GitHub PR MERGED 확인(Step 2). 파일시스템에 해당 worktree 없음. Stale로 skip.

---

### [INFO] `rag-quality-improvement.md` 의 worktree `rag-quality-proposal-0c618c` — PR MERGED, stale worktree

- `plan/in-progress/rag-quality-improvement.md` frontmatter `worktree: rag-quality-proposal-0c618c`이지만, branch `claude/rag-quality-proposal-0c618c` PR MERGED 확인(Step 2). 파일시스템에 해당 worktree 없음. Stale로 skip.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 2 PR MERGED
- `rag-rerank-impl` (branch `rag-rerank-impl` / `claude/rag-rerank-impl`) — Step 2 PR MERGED
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 2 PR MERGED (`plan/in-progress/rag-quality-improvement.md` 만 건드리나 동일 파일의 별개 행, stale 확인)
- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 2 PR MERGED
- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 2 PR MERGED
- `fix-carousel-waiting-status-4d4ed3` (branch `claude/fix-carousel-waiting-status-4d4ed3`) — Step 1 ancestor STALE

위 6개 worktree 는 이미 머지된 branch 의 미정리 worktree 항목이다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

나머지 active 분석 대상:
- `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`) — PR 없음, 변경 파일 exec-engine 전용, rag/ai-agent spec 무접촉 → 충돌 없음
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1/2 모두 ACTIVE, 변경 파일 exec-engine·concurrency 전용, rag/ai-agent spec 무접촉 → 충돌 없음

---

## 요약

target(D1 동적 컷 + D2 listwise escalate + ragTopK optional화)은 `rag-rerank-followup.md` 의 미결 pending 항목("conditional escalate 정량 임계는 P0 보정 후 도입") 및 spec §3.3.2 의 v1 결정("항상 LLM grading")을 우회하는 D2 변경(CRITICAL 1건), spec §3.3.1 `off` 경로의 "byte-identical 하위호환" 약속을 spec 개정 없이 깨는 D1(WARNING 1건), 그리고 ragTopK 기본값 변경이 spec 두 문서에 반영되지 않은 상태에서 구현 착수를 선언하는 문제(WARNING 1건) 를 포함한다. active worktree 충돌 후보 7건 중 stale 6건 skip, active 1건(`impl-exec-concurrency-cap`) 분석 — rag/ai-agent spec 무접촉 확인으로 충돌 없음. D2 는 P0 baseline 합의 전 착수 불가, D1 + ragTopK 는 spec 갱신(`project-planner` + `--spec` consistency-check) 선행 후 착수 가능.

---

## 위험도

**CRITICAL**
