# 정식 규약 준수 검토 결과

**검토 대상**: `spec/conventions/spec-impl-evidence.md` (worktree `kb-quality-fba2f2` 버전)
**검토 범위**: 구현 완료 후 (`--impl-done`) — diff 대상 신규 test 파일 5건 + spec 본문 갱신
**기준 규약**: `spec/conventions/spec-impl-evidence.md` 자기참조 (§1~§4), CLAUDE.md 명명 컨벤션

---

## 발견사항

### 발견 1
- **[WARNING]** §4.0 — 표준 문서 구조에서 벗어난 "retroactive zero-th subsection" 패턴
  - target 위치: `## 4. Build-time 가드 — frontmatter-evidence 5건` → `### 4.0 지식저장소 무결성 가드` (§4 표 이후, §4.1 이전에 삽입)
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장". 섹션 번호는 통상 1, 1.1, 1.2, 2, 2.1 순이며 메인 섹션 내에 0번 sub-section 을 나중에 삽입하는 패턴은 본 프로젝트 어떤 spec 에도 선례 없음.
  - 상세: `##4` 의 주요 표와 설명이 나온 뒤 `### 4.0` 이 등장한다. 독자가 섹션을 순차 읽을 때 §4.0 이 §4.1 앞에 배치돼야 한다는 기대와 어긋나며, §4 본문이 끝난 후에 삽입된 내용이 "0번" 으로 표현돼 혼란을 유발한다. §4.0 은 실질적으로 §5 (새로운 독립 섹션) 격의 내용을 담고 있다.
  - 제안: `### 4.0 지식저장소 무결성 가드` 를 `## 4.1 지식저장소 무결성 가드 (별개 family)` 또는 `## 5. 지식저장소 무결성 가드` 로 격상하고, 기존 `### 4.1 가드와 다른 가드의 관계` 를 `### 4.2` / `### 5.1` 로 순차 갱신. 문서 내부 anchor 참조(`§4.0`) 도 함께 갱신.

### 발견 2
- **[WARNING]** `spec-plan-completion.test.ts` (Gate C) 의 가드 분류 범주 혼재
  - target 위치: `## 4. Build-time 가드 — frontmatter-evidence 5건` 표, 마지막 행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — 해당 표 제목이 "frontmatter-evidence" 이며 §1 의 적용 대상 (`spec/**.md` frontmatter)를 검증한다고 명시. 그러나 `spec-plan-completion.test.ts` 는 `plan/complete/*.md` 의 frontmatter `spec_impact` 를 검증하는 가드로, **plan 문서 (not spec 문서)** 의 frontmatter 를 대상으로 한다.
  - 상세: §4 표의 카운트("5건") 와 섹션 제목("frontmatter-evidence") 은 "spec frontmatter 를 검증하는 가드 묶음" 을 의미하나 Gate C 는 plan frontmatter 를 검증한다. Gate C 를 §4 표에 포함시키면 "frontmatter-evidence = spec frontmatter 검증" 이라는 invariant 가 묘하게 깨진다. §4.0 의 "지식저장소 무결성 가드" 와 Gate C 는 모두 plan/spec 의 coherence 를 강제하는 보조 가드이므로, Gate C 를 §4.0 표에 넣는 것이 의미적으로 더 일관된다.
  - 제안: Gate C (`spec-plan-completion.test.ts`) 를 §4 표에서 빼고 §4.0 (또는 격상 후 §5) 표에 추가. §4 카운트를 "4건" 으로 변경, §4.0 카운트를 "build 차단 3건 + Gate C 1건 + advisory Gate D 1건" 으로 갱신. 또는 규약을 "Plan coherence 가드도 spec-impl-evidence.md SoT 하에 집중 관리" 방향으로 갱신하고 섹션 제목을 "Build-time 가드 — spec·plan evidence" 로 표현 변경.

### 발견 3
- **[WARNING]** Gate D (`/spec-coverage --mode reverse`) — 미정의 플래그 선행 참조
  - target 위치: `### 4.0 지식저장소 무결성 가드` 표, Gate D 행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1 — §3` 의 정합성 원칙. spec 은 구현 완료 또는 `spec-only` 상태의 surface 를 약속하며, 미구현 기능을 SoT 에 구체 플래그까지 명기할 경우 다른 시스템이 해당 인터페이스를 구현됐다고 가정할 위험이 있다.
  - 상세: `--mode reverse` 플래그는 `.claude/docs/plan-lifecycle.md §6.2` 의 `/spec-coverage` 정의에도 없고, 기존 spec-coverage slash command spec 에도 없다. "advisory" 표기만으로는 미구현 인터페이스임이 명확하지 않아 호출자가 플래그가 존재한다고 오인할 수 있다.
  - 제안: Gate D 설명에서 `--mode reverse` 플래그를 제거하거나, `(미구현 — 향후 플래그 설계 시 확정)` 등의 괄호 주석으로 명확히 표시. 또는 Gate D 항목 자체를 §4.0 표에서 별도 "향후 계획" 블록으로 분리해 현재 구현된 3건과 명확히 구분.

### 발견 4
- **[INFO]** 신규 §4.0 가드 3건에 대응하는 Rationale 항목 부재
  - target 위치: `## Rationale` — R-1 ~ R-7 만 존재
  - 위반 규약: CLAUDE.md "문서 구조 규약 — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". 본 컨벤션 자체도 R-1 ~ R-7 을 통해 모든 주요 설계 결정에 Rationale 을 제공하는 패턴을 확립했다.
  - 상세: `spec-link-integrity.test.ts` (왜 plan 링크는 scope 밖인가, 왜 rehype-slug 파이프라인을 직접 포팅하는가), `spec-area-index.test.ts` (왜 `spec/conventions/` 를 flat reference 로 예외 처리하는가), `plan-frontmatter.test.ts` (왜 top-level 만 대상인가, subfolder 예외 근거) — 세 가드 모두 비자명한 설계 결정을 담고 있으나 Rationale 에 설명이 없다. Gate C 의 grandfather cutoff (2026-06-04) 선택 근거도 없다.
  - 제안: R-8 (지식저장소 무결성 가드 3건 도입 근거 + spec/conventions/ 예외 근거), R-9 (Gate C grandfather cutoff 선택 근거) 를 Rationale 에 추가. 분량이 부담이면 각 새 가드의 test 파일 주석을 Rationale 대신으로 인용(cross-reference)하는 방식도 허용.

### 발견 5
- **[INFO]** 섹션 제목 카운트 표기 ("4건" vs "5건") 변경이 Overview 단락에 반영됐으나 `## 6. Rollout 정책` §3 항목에는 구체화가 미흡
  - target 위치: `## 6. Rollout 정책` — `3. frontmatter-evidence 가드 테스트 동반 작성 (초기 4건 → 현재 §4 5건; §4.0 지식저장소 무결성 가드 3건은 후속 kb-quality 에서 확장)`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4.1` 과의 일관성 원칙
  - 상세: §4 가드는 이미 5건으로 표기됐고 §4.0 가드도 이미 본 PR 에서 구현됐는데, Rollout §3 항목이 "§4.0 지식저장소 무결성 가드 3건은 후속 kb-quality 에서 확장" 이라고 미래형으로 기술되어 있다. 본 PR 에서 이미 구현 완료됐으므로 이 설명이 부정확한 시제를 가진다.
  - 제안: Rollout §3 항목을 "frontmatter-evidence 가드 5건 + §4.0 지식저장소 무결성 가드 3건(Gate C 포함) 동반 작성" 으로 갱신해 현재 시제와 정합 맞춤.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 worktree 버전은 frontmatter(`id`/`status: implemented`/`code:`) 와 3섹션 구조(Overview / 본문 / Rationale) 를 모두 갖추고 있으며, 신규 테스트 파일 5건이 `code:` 에 올바르게 등재되어 있다. 규약 자기준수 측면에서 큰 위반은 없으나, §4.0 을 메인 섹션 표 이후에 "zero-th subsection" 으로 삽입한 구조가 프로젝트 내 다른 spec 의 섹션 번호 관례와 어긋나고, Gate C (plan frontmatter 검증) 가 "spec frontmatter-evidence" 표에 혼재되어 분류 불일관이 발생하며, Gate D 의 미구현 `--mode reverse` 플래그가 구체 인터페이스처럼 명기되어 오인 위험이 있다. 신규 §4.0 가드 3건에 대한 Rationale 항목도 누락됐다. 전반적으로 구조·분류 수준의 WARNING 이며 기능 자체는 규약에 부합한다.

---

## 위험도

MEDIUM
