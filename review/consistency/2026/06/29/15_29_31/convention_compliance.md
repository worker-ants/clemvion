# 정식 규약 준수 검토 결과

**Target**: `spec/conventions/user-guide-evidence.md` (검토 모드: spec draft — `--spec`)
**기준**: `spec/conventions/` 정식 규약 전체 + `CLAUDE.md` 명명 컨벤션

---

## 발견사항

### [WARNING] §5 — i18n-userguide.md 교차 링크 선언이 미완료 TODO 상태

- **target 위치**: `spec/conventions/user-guide-evidence.md` §5 마지막 단락
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` 문서는 약속한 연결(cross-link)이 실제로 완료된 상태여야 한다. 또한 `CLAUDE.md §정보 저장 위치` — 단일 진실 원칙상 문서 간 교차 링크는 양방향으로 완결돼야 한다.
- **상세**: §5 의 마지막 문장이 "후속으로 `i18n-userguide.md §Principle 7` 본문에 본 가드의 부분 커버 범위를 명시한다." 로 끝난다. 이는 미래 시제 TODO 선언이다. 그런데 실제 `spec/conventions/i18n-userguide.md` §Principle 7 "자동 검출 — 부분 커버" 절에는 이미 `<ImplAnchor>` 3개 가드와 본 문서(`user-guide-evidence.md`)를 SoT 로 가리키는 링크가 존재한다(`i18n-userguide.md:172` 확인). 즉 대상 변경은 이미 완료됐으나 target 문서 본문이 그 완료 사실을 반영하지 않고 있다. `status: implemented` 문서가 "아직 완료하지 않은 후속 작업"을 TODO 로 기술하는 것은 해당 필드 값과 모순된다.
- **제안**: §5 마지막 단락을 아래와 같이 갱신한다.
  ```
  본 가드의 부분 커버 범위는 [`i18n-userguide.md §Principle 7`](./i18n-userguide.md) "자동 검출 — 부분 커버" 절에 이미 반영돼 있다 (GUI 흐름 절 → `<ImplAnchor>` 3개 가드, 본 문서를 SoT 로 링크).
  ```

---

### [INFO] Rationale 절 — R-4·R-5 항목 누락

- **target 위치**: `spec/conventions/user-guide-evidence.md` `## Rationale` 섹션 (R-1, R-2, R-3 만 존재)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거"는 해당 spec 문서 끝의 `## Rationale` 에 보존한다. 설계 결정이 문서 본문에서 암시되나 Rationale 에 명시되지 않으면 나중에 규약 개정 시 근거 추적이 어렵다.
- **상세**: target 문서의 Rationale 은 R-1(non-render), R-2(symbol grep), R-3(kind enum) 만 보유한다. 그러나 §2 에서 선택된 "integrations + triggers 두 카테고리만 coverage 가드 대상" 결정(R-4)과 "본문 안 컴포넌트 vs frontmatter anchors" 결정(R-5)에 대한 Rationale 항목이 없다. 이 두 항목은 `spec/conventions/i18n-userguide.md` 와의 관계를 포함해 규약의 scope 결정·배치 근거를 설명하는 중요한 설계 판단이다.
- **제안**: Rationale 에 아래 두 항목을 추가한다.
  - **R-4. integrations + triggers 만 신규 coverage 가드 대상**: 전체 가이드 페이지가 아닌 두 카테고리만 우선 가드 — 텔레그램 같은 외부 provider 통합 + 트리거 노드 provider 가 GUI 흐름 약속 vs 코드 부재의 실제 발생 사례 두 곳. 다른 카테고리는 GUI 흐름 절 비중이 낮거나 enumerable 가드(`nodes-coverage`)로 이미 보호됨.
  - **R-5. `<ImplAnchor>` 가 본문 안 vs frontmatter**: 가이드 문맥(어느 절의 어느 단락 옆)에 anchor 가 붙어야 의미가 있고, 본문 안 컴포넌트는 가이드 작성자가 자연스럽게 위치를 인지하며, 미래 dev mode 시각화도 가능하기 때문.

---

### [INFO] 문서 구조 — `## 2.1 다른 가드와의 관계` 절의 `spec-code-paths.test.ts` 참조 방향 설명 중 `nodes-coverage` 방향 기술 오류 가능성

- **target 위치**: `spec/conventions/user-guide-evidence.md` §2.1 — `nodes-coverage.test.ts` 와의 관계 항목
- **위반 규약**: 정확한 방향 기술은 `spec/conventions/spec-impl-evidence.md §4.1` 에 "nodes-coverage 는 노드 enumeration → 가이드, 본 가드는 spec 약속 → 구현 코드"로 정의됨.
- **상세**: target §2.1 에서 `nodes-coverage.test.ts` 와의 관계를 "방향이 동일 (가이드 ← 등록부)" 로 기술한다. 그런데 직전 bullet 에서 `integrations-coverage` / `triggers-coverage` 방향을 "가이드 GUI 흐름 절 → 코드 entry symbol" 로 표현하므로, `nodes-coverage` 를 "방향이 동일" 이라고 쓰면 `nodes-coverage` 역시 "가이드 → 코드" 방향인 것처럼 읽힐 수 있다. 실제 `nodes-coverage` 는 "backend 노드 등록부 → 가이드에 항목 등장" (코드→가이드) 이므로, "방향이 동일" 하나 "enumeration vs free-form" 구도를 부연하는 설명이 맞다. 현재 기술 자체가 틀리지는 않으나 "방향이 동일" 이라는 단어가 직전 방향 화살표와 충돌하는 인상을 줄 수 있다.
- **제안**: "방향이 동일" → "방향이 같은 계열 (등록부→가이드 vs 가이드→코드entry 는 다르나, 가이드 내 약속 강제라는 측면에서 보완 관계)" 정도로 명확화하거나, 현행 설명 그대로 유지하되 Rationale 에서 이 관계를 명시하는 것이 좋다. 이 항목은 INFO 수준이며 채택 여부는 작성자 재량이다.

---

## 요약

target 문서(`spec/conventions/user-guide-evidence.md`) 는 frontmatter(`id`, `status: implemented`, `code:` 경로 목록), 문서 제목 명명, Overview / 본문 / Rationale 3섹션 구조, 내부 교차 링크 문법 등 대부분의 정식 규약을 준수한다. 단, `status: implemented` 를 선언하면서 §5 마지막 단락에 "후속으로 ... 본문에 명시한다"는 미완료 TODO가 잔존한다. 실제 `i18n-userguide.md §Principle 7` 에는 이미 해당 내용이 반영돼 있으므로, target 문서의 §5가 사실과 다른 상태를 기술하고 있다. 이를 "이미 반영됐다"는 현재완료 기술로 교정해야 `status: implemented` 선언과 정합된다. 추가로 Rationale 에 R-4·R-5 근거 항목을 보완하면 문서 완결성이 높아진다.

---

## 위험도

LOW
