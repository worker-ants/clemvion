# Plan 정합성 검토 결과

검토 모드: `--impl-done`  
Scope: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md` (NUL fix·이모지 수정 후 재검증)  
diff-base: `origin/main`  
검토 시각: 2026-06-06

---

## 발견사항

### [WARNING] P0 spec 갱신 체크박스 미갱신 — rag-quality-improvement.md P0 마지막 항목

- target 위치: `plan/in-progress/rag-quality-improvement.md` §P0 line 92
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` §P0
- 상세: 이번 worktree(rag-eval-harness-b8cc46)는 골든셋 항목(line 87)과 검색 지표 항목(line 88)을 `[x]`로 갱신했으나, 바로 아래 P0 spec 갱신 항목 `- [ ] **spec 갱신**: 신규 spec/conventions/rag-evaluation.md 또는 spec/5-system/9-rag-search.md` 은 여전히 `[ ]`로 남아 있다. 실제로는 `spec/conventions/rag-evaluation.md` 가 신규 생성되고 `9-rag-search.md` 에 링크가 추가됐으므로 이 항목도 완료 상태여야 한다.
- 제안: `plan/in-progress/rag-quality-improvement.md` line 92 를 `[x]` 로 갱신하고 rag-eval-harness.md 참조 주석 추가.

---

### [WARNING] "매 PR 게이트" 원문 기대와 실제 구현(수동 CLI) 간 gap 미명시

- target 위치: `plan/in-progress/rag-eval-harness.md §0`, `codebase/backend/eval/README.md`
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` §P0 line 88 원문 — "**매 PR** 게이트"
- 상세: 상위 plan 의 P0 검색 지표 항목은 "매 PR 게이트화"를 명시하고 있다. 구현은 `--fail-under` 플래그를 제공하는 수동 CLI 러너이며, CI yaml 연결은 이번 범위 밖이다. 체크박스가 `[x]`로 갱신되어 완료로 보이지만, "매 PR 자동 게이트" 측면은 충족되지 않았다. 후속 작업자가 CI 통합이 완료됐다고 오해할 수 있다.
- 제안: `plan/in-progress/rag-quality-improvement.md` line 88 의 [x] 항목 설명에 "(CI yaml 자동 게이트는 미착수 — 수동 --fail-under CLI 제공, PR 자동화는 후속)" 주석 추가.

---

### [INFO] 평가셋 규모·합성 비율 결정 — open 상태이나 CLI 위임으로 간접 처리됨

- target 위치: `src/scripts/generate-golden-set.ts` (기본값 `--sample 30`), `codebase/backend/eval/README.md` (예시 100건)
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` §6 line 172:  `- [ ] 평가셋 규모·합성 비율(수동 50 + 합성 확장) 확정.`
- 상세: §6 의 해당 결정은 여전히 열려 있다. 구현이 `--sample` CLI 인자로 규모 결정을 런타임에 위임한 것은 일방적 결정 우회가 아니나, 상위 plan 의 열린 결정을 명시적으로 참조하지 않아 추적이 단절될 수 있다.
- 제안: `rag-eval-harness.md §4` 미해결 포인트에 "평가셋 규모 결정(rag-quality-improvement §6)은 실 KB 운영 시 --sample 인자로 사용자가 확정" 을 1줄 추가하면 추적 단절 해소.

---

### [INFO] 9-rag-search.md pending_plans 중첩 등재 — rag-rerank-followup 완료 시점 지연 가능

- target 위치: `spec/5-system/9-rag-search.md` frontmatter `pending_plans`
- 관련 plan: `plan/in-progress/rag-rerank-followup.md` (동일 spec 을 pending_plans 참조)
- 상세: `rag-rerank-followup` 의 비고에 "모든 surface 구현 시 9-rag-search.md status: implemented 승격" 이라고 되어 있다. 이번에 `rag-eval-harness.md` 가 pending_plans 에 추가되어 양쪽 plan 이 모두 완료돼야 승격 가능해진다. 기능 충돌은 없으나 rag-rerank-followup 에서 이 사실을 인지해야 한다.
- 제안: `rag-rerank-followup.md` 비고 절에 "9-rag-search.md pending_plans 에 rag-eval-harness 가 추가됨 — implemented 승격은 양쪽 plan 완료 후" 1줄 추가 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 대상: `exec-park-durable-resume`, `fix-webchat-envelope-unwrap-9519af`, `impl-exec-concurrency-cap` 세 branch.

- 세 branch 모두 `spec/conventions/` 및 `spec/5-system/9-rag-search.md` 를 수정하지 않음 (diff 결과 공집합). worktree 충돌 후보 0건.
- stale 판정 cascade 수행 대상 없음 — 0건 skip.

---

## 요약

`spec/conventions/rag-evaluation.md` 신규 생성 및 `spec/5-system/9-rag-search.md` 링크 추가는 `rag-quality-improvement.md §P0` 와 `rag-eval-harness.md` 의 계획 범위 내이며, 미해결 결정을 일방 우회하는 항목은 없다. 다른 active worktree 와의 spec 파일 경합도 없다. WARNING 2건 — P0 spec 갱신 체크박스 미갱신, "매 PR 게이트" 원문 기대 대비 수동 CLI 구현의 gap 미명시 — 이 plan 갱신 없이 머지되면 후속 추적이 흐려지므로 plan 파일 보완이 필요하다. INFO 2건은 추적 메모 권장 수준. worktree 충돌 후보 0건, stale skip 0건.

---

## 위험도

LOW
