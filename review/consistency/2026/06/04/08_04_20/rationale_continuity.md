# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target: `spec/conventions/spec-impl-evidence.md`
Diff base: origin/main...HEAD

---

### 발견사항

- **[WARNING]** Overview 및 §6 Rollout 의 "4개 가드" 카운트가 갱신되지 않음
  - target 위치: worktree `spec/conventions/spec-impl-evidence.md` L30 (`4개 build-time 가드로 정합성을 강제`), L184 (`4개 가드 테스트 동반 작성`), L185 (`PROJECT.md §자동 가드 표에 4개 row 추가`)
  - 과거 결정 출처: 동 문서 §4 (원 main 기준) — "4개 build-time 가드" 원칙이 문서 전체의 카운트 기준으로 확립돼 있음
  - 상세: 이번 diff 로 `spec-plan-completion.test.ts` (Gate C) 가 5번째 가드로 추가됐고, `§4.0 인접 지식저장소 가드`로 `spec-link-integrity.test.ts` / `spec-area-index.test.ts` / `plan-frontmatter.test.ts` 3건이 build 차단 가드로 추가됐다. §4 헤딩은 "frontmatter-evidence 5건" 으로 갱신됐으나, Overview(L30) 와 §6 Rollout(L184-185)의 "4개" 카운트는 그대로 남아 있어 동 문서 내에서 가드 개수가 불일치한다. 이는 결정 번복이 아니라 문서 내 숫자 정합 누락이나, Rationale 에 기반한 invariant("가드 개수는 단일 진실") 를 위반하는 불일치다.
  - 제안: L30 의 `4개 build-time 가드로` 를 `5개 frontmatter-evidence 가드 + 3개 인접 가드로` (또는 간결하게 `build-time 가드로`) 로 수정. L184-185 의 `4개` 는 변경 이력 설명이므로 삭제하거나 각주 처리 — 해당 §6 Rollout 절은 초기 rollout 절차를 기록한 역사 섹션이므로 "당시 4개" 로 명시하거나 현행 카운트로 갱신.

- **[INFO]** `§4.0 인접 가드` 3건이 frontmatter `code:` 에 누락
  - target 위치: worktree `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 목록 (L5-11) 및 §4.0 (L113-120)
  - 과거 결정 출처: 동 문서 §2.1 — `status: implemented` 인 spec 은 `code:` ≥1 매치 의무; R-6 — spec `.md` 의 `code:` 는 "본 spec 이 *약속한* 구현 surface (책임용)"
  - 상세: `spec-plan-completion.test.ts` 는 frontmatter `code:` 에 등재됐으나 (L11), §4.0 의 인접 가드 3건 (`spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`) 및 공유 헬퍼 `spec-links.ts` 는 `code:` 목록에 없다. 본 문서가 `status: implemented` 인데 `code:` 가 이 파일들을 포함하지 않으면, 본 문서 자신의 가드 (`spec-code-paths.test.ts`) 가 이 surface 를 미커버한 상태로 동작한다. 단, §4.0 가드 SoT 가 별도 (`plan/in-progress/knowledge-base-quality-improvements.md`) 라고 문서에 명시돼 있어, 이를 의도적으로 분리한 것으로 해석할 수 있음 — 그 경우 해당 근거가 Rationale 에 명시되어 있지 않다.
  - 제안: (a) frontmatter `code:` 에 3건 추가 (spec-impl-evidence 가 인접 가드도 책임진다면), 또는 (b) §4.0 의 "별도 SoT" 분리 근거를 Rationale 신규 항 (R-8) 으로 명문화해 의도적 분리임을 기록.

- **[INFO]** §6 Rollout 절이 현재 상태와 불일치 — 역사 기록 vs 현행 절차 혼재
  - target 위치: worktree `spec/conventions/spec-impl-evidence.md` §6 (L174-185)
  - 과거 결정 출처: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙; §2 본문 latest-only 원칙
  - 상세: §6 의 "4개 가드 테스트 동반 작성", "PROJECT.md §자동 가드 표에 4개 row 추가" 는 초기 rollout 당시의 절차로 이미 완료된 역사다. 현재 상태(5건 + 인접 3건)와 맞지 않아 신규 spec 작성자가 가드 수를 오독할 수 있다. 이는 Rationale 에 기록된 invariant 위반은 아니나, §2 서두의 "본문은 latest-only 사실 기술" 원칙과 어긋난다.
  - 제안: §6 을 "초기 rollout 완료 (기록)" 라는 헤딩으로 전환하거나, 현행 절차로 갱신 (가드 추가 시 PROJECT.md 와 frontmatter `code:` 를 동시에 갱신하는 상시 절차로 재작성).

---

### 요약

이번 diff 는 Gate C (`spec-plan-completion.test.ts`) 및 3개 인접 지식저장소 가드를 추가하면서 `spec/conventions/spec-impl-evidence.md` 를 갱신했다. 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 없다 — Gate C 자체는 보류 백로그 (`project_spec_drift_gate_backlog.md`) 에 이미 등재된 결정이며, 인접 가드 3건도 별도 계획에 근거한 신규 확장이다. 다만 문서 내부에서 §4 헤딩이 "5건"으로 갱신된 반면 Overview 및 §6 Rollout 의 "4개" 카운트가 그대로 남아 문서 자체의 숫자 일관성이 깨졌다. 이는 Rationale 에 박힌 "가드 개수 단일 진실" invariant 에 대한 내부 정합 위반이므로 수정이 필요하다. 또한 §4.0 인접 가드 3건이 frontmatter `code:` 에 누락된 것은, 본 문서가 `status: implemented` 인데 해당 surface 를 미커버하는 결과를 낳는다 — 의도적 분리라면 Rationale 에 명시해야 한다.

### 위험도

LOW
