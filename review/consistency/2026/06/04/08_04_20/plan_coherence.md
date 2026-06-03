# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/conventions/spec-impl-evidence.md`
Worktree: `kb-quality-fba2f2`
검토일: 2026-06-04

---

## 발견사항

### [WARNING] spec-drift-gates.md §C 가 "보류" 로 열어둔 Gate C 를 kb-quality 가 독립 구현

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §4 표 신규 행 (`spec-plan-completion.test.ts`, Gate C 항목) + §4.0 절
- **관련 plan**: `plan/in-progress/spec-drift-gates.md` §C — "plan 완료 시 spec 정합 결정 강제 (보류)"
- **상세**: `spec-drift-gates.md` 는 Gate C (`spec-plan-completion.test.ts`) 를 `[ ]` 미착수 보류 항목으로 열어두고 있다. 완료 조건도 "C 구현 + 테스트" 가 미달성인 채 plan 이 in-progress 에 유지 중이다. 반면 `knowledge-base-quality-improvements.md` §item 7 은 이 Gate C 를 `[x]` 완료로 마킹하고 동일한 `spec-plan-completion.test.ts` 를 신설하였으며, target `spec-impl-evidence.md` 에도 해당 가드를 §4 표에 추가했다. 이는 spec-drift-gates plan 의 보류 결정과 충돌하지는 않으나(kb-quality 가 Gate C 를 선행 완료한 것으로 볼 수 있음), spec-drift-gates plan 의 §C 미완료 마커(`[ ]`)가 현실과 어긋난 stale 상태가 된다. spec-drift-gates plan 이 완료 조건을 `C 구현 + 테스트` 로 걸고 있으므로, kb-quality PR 머지 후 spec-drift-gates plan 의 §C 를 `[x]` 처리하고 완료 이동 가능 여부를 재판단해야 한다.
- **제안**: kb-quality PR 머지 후 `plan/in-progress/spec-drift-gates.md` §C 항목을 `[x]` 로 갱신하고, 나머지 미완 항목(`§D` 구현·완료 조건) 상태에 따라 plan complete 이동 또는 §C 완료 기록 추가.

---

### [WARNING] spec-drift-gates.md §C 의 Gate C 구현 방식 vs target 구현 방식 경미 불일치

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §4 표 Gate C 행 + `spec-plan-completion.test.ts` 코드 (`started ≥ 2026-06-04` cutoff, `spec_impact` 필드)
- **관련 plan**: `plan/in-progress/spec-drift-gates.md` §C
- **상세**: spec-drift-gates §C 는 Gate C 를 "plan 이 건드린 `code:` 연결 코드가 변경됐다면 spec-update 섹션 또는 변경불필요 명시" 로 정의한다. 그러나 target 구현 (`spec-plan-completion.test.ts`) 은 코드 변경 여부를 검사하지 않고, **시작일(`started ≥ 2026-06-04`)** 과 **frontmatter `spec_impact` 필드 선언** 여부로 검사한다. 즉 spec-drift-gates 가 기술한 설계(코드 변경 연동)와 kb-quality 가 실제 구현한 설계(cutoff + `spec_impact` 필드)가 다르다. 이는 사용자가 kb-quality §item 7 에서 별도 설계 결정을 내린 것으로 보이나, spec-drift-gates §C 에는 해당 설계 변경이 기록되지 않았다.
- **제안**: spec-drift-gates §C 에 "구현은 `spec-plan-completion.test.ts` 로 완료 (kb-quality item 7). 설계가 `code:` 연동 → `spec_impact` 필드 + cutoff date 방식으로 변경됨" 을 주석으로 기록.

---

### [INFO] fix-spec-frontmatter-catalog plan 과 target 의 `spec-impl-evidence.md` §1 편집 중복 — 이미 머지됨(stale 경로)

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §1 제외 규칙 (카탈로그 필드 파일 제외, R-7 Rationale)
- **관련 plan**: `plan/in-progress/fix-spec-frontmatter-catalog.md`
- **상세**: `fix-spec-frontmatter-catalog.md` 는 `spec-impl-evidence.md §1 제외` 와 Rationale R-7 추가를 `[x]` 완료로 기록하고 있다. 이 변경은 PR #453 (`e79956ad fix(docs-guard): cafe24 필드 카탈로그를 spec frontmatter lifecycle guard 에서 제외`)으로 main 에 머지됐다. target worktree(`kb-quality-fba2f2`) 의 `spec-impl-evidence.md` 는 그 위에 Gate C 행과 §4.0 절을 추가하는 형태로 편집하므로, 동일 파일 편집이지만 영역이 겹치지 않는다. 머지 시 충돌 가능성은 낮으나, fix-spec-frontmatter-catalog plan 이 in-progress 에 잔류 중인 이유는 "별 doc 수정·표현 명확화·노트 추가" pre-existing follow-up 4건 때문이므로, target 의 §4.0 cross-link 추가(`plan/in-progress/knowledge-base-quality-improvements.md` 링크)가 그 follow-up 중 "WARNING#2: §1 제외 기술 명확화" 와 관련이 있을 수 있다. 직접 충돌은 없음.
- **제안**: 추적용. kb-quality PR 머지 후 fix-spec-frontmatter-catalog 의 후속 4건 중 "WARNING#2 명확화" 가 target 변경으로 해소됐는지 점검.

---

### [INFO] spec-drift-gates plan 의 완료 조건 재확인 필요 (Gate D 가 kb-quality 에서 advisory 구현 완료)

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §4.0 Gate D 항목
- **관련 plan**: `plan/in-progress/spec-drift-gates.md` §D — "reverse-coverage 탐지 (보류)"
- **상세**: spec-drift-gates §D 는 `[ ]` 보류로 열려 있다. kb-quality §item 7 은 Gate D (spec-coverage `--mode reverse`) 를 `[x]` 완료로 마킹하고 target `spec-impl-evidence.md` §4.0 에 "advisory — build 차단 아님" 으로 추가했다. spec-drift-gates §D 의 의도(`ADVISORY 유지`)와 kb-quality 구현의 방향이 일치하나, spec-drift-gates plan 의 미완료 마커가 현실과 불일치.
- **제안**: Gate C 와 함께 spec-drift-gates plan §D 항목도 `[x]` 로 갱신하고 plan 완료 조건 충족 여부 재판단.

---

### [INFO] `spec-impl-evidence.md` frontmatter `code:` 필드에 신규 4개 테스트 파일 미등재

- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (lines 5-10)
- **상세**: target 의 frontmatter `code:` 에 `spec-plan-completion.test.ts` 가 추가됐으나, `spec-link-integrity.test.ts` / `spec-area-index.test.ts` / `plan-frontmatter.test.ts` / `spec-links.ts` (shared helper) 는 등재되지 않았다. 이 파일들은 §4.0 에 "인접 지식저장소 가드" 로 언급되나, `spec-impl-evidence.md` 의 `code:` 필드가 지목하는 구현 파일과 §4.0 의 가드 파일 간 경계가 의도적으로 분리된 것인지(별도 SoT) 불명확. SoT 가 `knowledge-base-quality-improvements.md` 라고 §4.0 에 명시되어 있으므로 의도된 분리로 보임 — 현재 구현 반영 방식이 문서상 설명과 일치함. 단, `spec-impl-evidence.md` 의 자기 참조 `code:` 와 §4.0 cross-link 를 통해 두 SoT 가 분리돼 있음을 독자가 인지할 수 있도록 설명이 충분한지 점검 권장.
- **제안**: 필요 시 §4.0 에 "각 가드의 SoT 는 `knowledge-base-quality-improvements.md`; `spec-impl-evidence.md` `code:` 는 frontmatter-evidence 가드(§4 표 5건)만 열거" 주석 1줄 추가.

---

## Stale 으로 skip 한 worktree (의무 — 0건)

worktree 충돌 후보 검사 결과:

- `kb-quality-fba2f2` (target worktree): Step 1 ancestor 검사 → ACTIVE. Step 2 PR 조회 → [] (no PR). Step 3 fallback → ACTIVE. 대상에서 제외하지 않음.
- `spec-drift-gates-b26bce` (`spec-drift-gates.md` frontmatter worktree): Step 1 ancestor 검사 → ACTIVE. Step 2 PR 조회 → [] (no PR). Step 3 fallback → ACTIVE. 동일 파일(`spec-impl-evidence.md`) 편집 여부를 확인한 결과, spec-drift-gates worktree 는 `spec-impl-evidence.md` 를 직접 편집하지 않고 test harness(`review_guard.py`)만 편집한 worktree 임. 따라서 §5 worktree 충돌 해당 없음.
- `fix-spec-frontmatter-catalog` (`fix-spec-frontmatter-catalog.md` frontmatter worktree): Step 1 ancestor 검사 → ACTIVE. Step 2 PR 조회 → [] (no PR). Step 3 fallback → ACTIVE. 단, 해당 plan 의 핵심 작업(spec-impl-evidence.md §1 편집)은 PR #453(`e79956ad`)으로 main 에 이미 머지됨. `fix-spec-frontmatter-catalog` branch 자체가 아직 HEAD 로 남아있는지는 확인 불가(PR이 없어 gh 확인 불가). 동일 파일 편집 충돌은 낮음(편집 영역 비중복).

stale skip 0건 (판정된 stale worktree 없음).

---

## 요약

target `spec/conventions/spec-impl-evidence.md` 의 변경은 `knowledge-base-quality-improvements.md` item 7 의 Gate C (`spec-plan-completion.test.ts`) 와 §4.0 인접 가드 cross-link를 공식 등재하는 것으로, 내용상 충돌보다는 **plan 추적 불일치** 가 주요 이슈다. `plan/in-progress/spec-drift-gates.md` 가 Gate C·D 를 "보류" 로 열어두고 있는 상태에서 kb-quality 가 두 항목을 모두 구현 완료했으므로, 머지 후 spec-drift-gates plan §C/§D 를 갱신하고 완료 이동 가능 여부를 재판단하는 후속 작업이 필요하다(WARNING 2건). Gate C 설계(코드 변경 연동 → `spec_impact` 필드 + cutoff date 방식)의 변경도 spec-drift-gates plan 에 미기록 상태다. 능동적 작업 차단(CRITICAL) 은 없다. worktree 충돌 후보 3건 분석, stale 판정 0건.

---

## 위험도

LOW
