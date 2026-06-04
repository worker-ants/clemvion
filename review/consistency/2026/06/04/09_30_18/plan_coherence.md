# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target 문서: `spec/5-system/` (rag-rerank-impl.md 기준 구현 범위)

---

## 발견사항

### [CRITICAL] V072 마이그레이션 버전 충돌
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` 13행 — `"RerankConfig 엔티티 + 마이그레이션(V072)"`
- **관련 plan**: `plan/in-progress/integration-index-unify.md` (worktree `integration-index-unify-2c7973`, active no-PR)
- **상세**: `integration-index-unify-2c7973` 워크트리가 이미 `codebase/backend/migrations/V072__integration_unify_store_identifier_index.sql` 을 생성했다. `rag-rerank-impl` 이 동일 버전 번호 V072 로 `RerankConfig` 마이그레이션을 생성하면 Flyway/마이그레이션 도구의 버전 충돌 오류가 발생한다. 같은 이유로 `rag-rerank-impl` 이 V073 으로 예정한 KB rerank 컬럼 마이그레이션도, `integration-index-unify` 가 V072 를 사용하면 실제 next 번호는 V073 이 되어야 하므로 연쇄적으로 번호 재조정이 필요하다.
- **제안**: `integration-index-unify` 가 머지되거나 버전 번호가 확정될 때까지 `rag-rerank-impl` 의 마이그레이션 번호를 확정하지 않는다. `integration-index-unify` 가 V072 를 사용하면 `rag-rerank-impl` 의 RerankConfig 마이그레이션은 V073, KB rerank 마이그레이션은 V074 로 변경해야 한다. 직렬화(integration-index-unify 머지 선행) 또는 양 plan 간 번호 사전 협의 필요.

---

### [CRITICAL] `spec/5-system/9-rag-search.md` 동시 편집 — 결정 내용 상충
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` — `spec/5-system/9-rag-search.md §3.3` 을 구현 근거로 참조
- **관련 plan (1)**: `plan/in-progress/spec-draft-rag-reranking.md` (worktree `rag-quality-proposal-0c618c`, active no-PR) — 동일 파일 편집 중
- **관련 plan (2)**: `ai-context-memory-9c7e6e` (PR #459 OPEN) — 동일 파일 편집 중
- **상세**: `rag-quality-proposal-0c618c` 와 `ai-context-memory-9c7e6e` 두 브랜치 모두 `spec/5-system/9-rag-search.md` 의 §3.3.1 `cross_encoder_llm` 정의를 변경한다:
  - 현재 `rag-rerank-impl` 이 참조하는 버전(로컬 main 기준): `"항상 listwise LLM grading 1콜 추가"` + `"v1 결정: 항상"` 주석 포함
  - 두 active 브랜치가 변경하는 버전: `"escalate 조건 충족 시 listwise LLM grading"` (conditional escalate, `v1 결정` 주석 삭제)
  - `rag-rerank-impl` 의 결정 출처인 `rag-rerank-decisions-dd1d68` 는 "항상 grading(v1)" 을 확정했으나, `rag-quality-proposal-0c618c` 는 이와 반대로 conditional escalate 를 spec 에 적용했다.
  - `rag-rerank-impl` 이 `rag-rerank-decisions-dd1d68` 를 따라 구현하면, 머지 직후 두 active 브랜치의 spec 변경이 적용될 때 구현-spec 불일치가 발생한다.
- **제안**: (a) `rag-rerank-decisions-dd1d68` 를 먼저 머지해 spec 결정을 main 에 반영한 뒤 `rag-quality-proposal-0c618c` 가 rebase 또는 (b) `rag-quality-proposal-0c618c` 의 `cross_encoder_llm` 변경이 `rag-rerank-decisions-dd1d68` 의 결정과 어느 쪽이 사용자가 최종 승인한 결정인지 명확히 한 뒤, 하나를 폐기하거나 통합. 세 plan 의 spec 동시 편집을 직렬화하지 않으면 머지 충돌 또는 구현-spec 역행이 발생한다.

---

### [CRITICAL] `spec/5-system/7-llm-client.md` 동시 편집 — provider 범위 상충
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` 15행 — `"RerankClient 인터페이스 + RerankClientFactory(tei, cohere)"`
- **관련 plan**: `plan/in-progress/spec-draft-rag-reranking.md` (worktree `rag-quality-proposal-0c618c`, active no-PR) — `spec/5-system/7-llm-client.md` 동시 편집
- **상세**: `rag-rerank-decisions-dd1d68` (target plan 의 결정 출처, "#1 provider 1차 = tei + cohere. jina/voyage/local Planned") 는 tei+cohere 를 1차로 결정했다. 그러나 `rag-quality-proposal-0c618c` 가 `spec/5-system/7-llm-client.md §2.1 / §4.1 / §5.6` 을 변경해 cohere·jina·voyage·tei·local 을 모두 "1차" 표기로 동등화하고 `builtin` 을 제거했다. `rag-rerank-impl` 이 tei+cohere 만 구현한 후 PR 을 열면, `rag-quality-proposal-0c618c` 가 머지될 경우 spec 에는 5종 provider 가 모두 구현된 것으로 기록되지만 실제 코드는 2종만 존재하는 spec-impl gap 이 발생한다.
- **제안**: `rag-quality-proposal-0c618c` 의 `7-llm-client.md` provider 범위 확대 변경과 `rag-rerank-decisions-dd1d68` 의 "1차 = tei+cohere" 결정 중 어느 것이 최종 합의인지 명확히 해야 한다. 두 브랜치가 같은 파일의 같은 섹션을 편집 중이므로 직렬화 필요.

---

### [CRITICAL] `spec/1-data-model.md` 동시 편집
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` 13행 — `"spec/1-data-model.md §2.16.1"` 참조
- **관련 plan (1)**: `plan/in-progress/spec-draft-rag-reranking.md` (worktree `rag-quality-proposal-0c618c`) — `spec/1-data-model.md` 편집 중
- **관련 plan (2)**: `plan/in-progress/integration-index-unify.md` (worktree `integration-index-unify-2c7973`) — `spec/1-data-model.md` 편집 중 (spec diff 에서 확인)
- **상세**: `rag-rerank-impl` 은 `spec/1-data-model.md §2.16.1 RerankConfig` 를 구현 근거로 사용한다. 동일 파일을 `rag-quality-proposal-0c618c` 와 `integration-index-unify-2c7973` 두 active 워크트리가 편집 중이다. `rag-rerank-decisions-dd1d68` 의 커밋 메시지도 "1-data-model §2.16.1 동시편집 절차적 경합, merge 전 rebase" 를 CRITICAL 로 명시했다.
- **제안**: `rag-rerank-decisions-dd1d68` 를 먼저 머지해 `spec/1-data-model.md` 의 RerankConfig 정의를 main 에 안착시킨 뒤, `rag-rerank-impl` 착수. `integration-index-unify` 의 `spec/1-data-model.md` 변경도 rebase 처리 필요.

---

### [WARNING] `rag-quality-improvement.md` §6 미해결 결정과의 잠재적 충돌
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` 전반 — `spec-draft-rag-reranking.md` 를 확정된 결정 출처로 사용
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md` §6 "남은 결정 (착수 전 확정 필요)"
- **상세**: `rag-quality-improvement.md §6` 은 다음 항목을 "착수 전 확정 필요" 로 열거한다:
  - P1 cross-encoder 호스팅(self-host ONNX vs rerank API) 결정 미확정 (P0 A/B 후)
  - escalate 조건 정량 임계 미확정 (P0 평가셋으로 튜닝)
  - "정책 판단 KB" 표시 방법 (플래그 vs 휴리스틱)
  - 평가셋 규모·합성 비율 미확정
  `rag-rerank-impl` 은 이 중 "cross-encoder 호스팅" 을 `tei` + `cohere` 로, "정책 판단 KB" 를 `rerank_mode = cross_encoder_llm` 자체 표시자로, "grading" 을 항상 수행(v1)으로 `rag-rerank-decisions-dd1d68` 에서 결정된 것으로 간주한다. 그러나 `rag-quality-improvement.md` 의 §6 미해결 결정 목록에 이 항목들이 여전히 열거되어 있어 plan 문서 자체가 "아직 미확정" 상태를 유지하고 있다. `rag-rerank-decisions-dd1d68` 가 main 에 머지되지 않은 한 공식적으로는 미결 상태다.
- **제안**: `rag-rerank-decisions-dd1d68` 가 main 에 머지된 직후, `rag-quality-improvement.md §6` 의 해당 미결 항목을 ✅ 처리하거나 제거해 plan 상태를 동기화. 구현 착수는 결정 PR 머지 이후.

---

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` 동시 편집 — `ragTopK`/`ragThreshold` 의미 보강 항목
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` (이번 PR 범위 밖이나 검색 시점 해석 변경에 영향)
- **관련 plan**: `kb-quality-fba2f2` (PR #457 OPEN) + `ai-context-memory-9c7e6e` (PR #459 OPEN) — `spec/4-nodes/3-ai/1-ai-agent.md` 동시 편집
- **상세**: `spec-draft-rag-reranking.md §10` 의 반영 주석이 `"spec/4-nodes/3-ai/1-ai-agent.md 를 kb-quality-fba2f2(PR #457)·ai-context-memory-9c7e6e(PR OPEN) 이 편집 중 — 직렬화 필요(W5)"` 를 명시했다. `rag-rerank-impl` 의 이번 PR 범위는 `ai-agent.md` 를 직접 편집하지 않지만, `ragThreshold` 의 이중 해석(`rerank_mode≠off` 시 rerank 점수 임계)이 이미 `ai-agent.md` 에 Planned 표기로 반영되어 있다. 두 active PR 이 `ai-agent.md §1` 을 편집하면서 해당 표기를 덮어쓸 위험이 있다.
- **제안**: `rag-rerank-impl` PR 오픈 전에 #457·#459 의 `ai-agent.md §1` 변경 사항을 검토해 `ragTopK`/`ragThreshold` 의미 보강 표기가 유지되는지 확인. 두 PR 이 머지된 후 `rag-rerank-impl` PR 을 오픈하는 것이 안전.

---

### [WARNING] 후속 plan 파일 누락 — `rag-rerank-followup.md`
- **target 위치**: `plan/in-progress/rag-rerank-impl.md` 31행 — `"rag-rerank-followup.md 로 분리"` 언급
- **관련 plan**: (없음 — 파일 미존재)
- **상세**: `rag-rerank-impl.md` 의 "후속 분리" 절이 `cross_encoder_llm` / frontend UI / provider 확장 / conditional escalate 임계를 `rag-rerank-followup.md` 에 위임한다고 명시하지만, 해당 파일이 아직 생성되지 않았다. 이번 PR 의 partial-implementation 표기 + spec frontmatter `pending_plans` 등록을 위해 후속 plan 파일 사전 생성이 필요하다.
- **제안**: `rag-rerank-impl` 착수 전 또는 첫 커밋 시점에 `plan/in-progress/rag-rerank-followup.md` 를 생성하고, 구현 완료된 spec 파일의 frontmatter 에 `pending_plans` 로 등록.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 7건 검사:

| worktree | branch | Step 1 결과 | Step 2 결과 | 판정 |
|---|---|---|---|---|
| `rag-quality-proposal-0c618c` | `rag-quality-proposal-0c618c` | ACTIVE (non-ancestor) | PR 없음 (empty) | **ACTIVE** — Step 3 fallback. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장 |
| `rag-rerank-decisions-dd1d68` | `rag-rerank-decisions-dd1d68` | ACTIVE (non-ancestor) | PR 없음 (empty) | **ACTIVE** — Step 3 fallback |
| `integration-index-unify-2c7973` | `integration-index-unify-2c7973` | ACTIVE (non-ancestor) | PR 없음 (empty) | **ACTIVE** — Step 3 fallback |
| `kb-quality-fba2f2` | `kb-quality-fba2f2` | ACTIVE | PR #457 OPEN | **ACTIVE** (PR OPEN) |
| `ai-context-memory-9c7e6e` | `claude/ai-context-memory-9c7e6e` | ACTIVE | PR #459 OPEN | **ACTIVE** (PR OPEN) |

stale 으로 skip 된 항목: **0건**. 총 5개 충돌 후보 모두 active 로 분석.

---

## 요약

`plan/in-progress/rag-rerank-impl.md` 의 구현 착수에는 4건의 CRITICAL 차단 요인이 있다. 가장 심각한 것은 (1) V072 마이그레이션 번호가 `integration-index-unify-2c7973` 에 이미 선점되어 번호 충돌이 확실하고, (2) `spec/5-system/9-rag-search.md` · `spec/5-system/7-llm-client.md` · `spec/1-data-model.md` 세 파일을 `rag-quality-proposal-0c618c`(no-PR) 와 `ai-context-memory-9c7e6e`(PR #459) 가 동시 편집 중이며 그 변경 내용이 `rag-rerank-impl` 이 채택한 `rag-rerank-decisions-dd1d68` 의 결정과 직접 상충한다. 안전한 착수 순서는: ① `rag-rerank-decisions-dd1d68` 및 `integration-index-unify-2c7973` PR 생성 후 머지 → ② `rag-quality-proposal-0c618c` rebase/결정 통합 → ③ `rag-rerank-impl` 마이그레이션 번호 재확정 후 구현 착수. worktree 충돌 후보 5건 모두 active 로 분석(stale skip 0건).

---

## 위험도

**CRITICAL**
