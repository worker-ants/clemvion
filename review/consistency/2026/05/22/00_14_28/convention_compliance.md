# 정식 규약 준수 검토 — spec/0-overview.md (draft)

검토 대상: prompt_file 에 embedded 된 `spec/0-overview.md` 의 proposed draft 버전 (§2 Cafe24 재분류 + §3 Rationale 신설 적용 후 상태).
기준 규약: `spec/conventions/` 전체 + CLAUDE.md 명명 컨벤션 + project-planner SKILL.md 문서 구조 규약.

---

## 발견사항

### 1. [WARNING] 루트 레벨 파일 naming convention 이 CLAUDE.md / SKILL.md 와 미동기

- **target 위치**: `§8 문서 맵 > 문서 컨벤션` — 신설 bullet
  ```
  **`spec/0-overview.md` / `spec/1-data-model.md` / `spec/6-brand.md` (루트 레벨)** — ... 본문 끝에 `## Rationale` 섹션을 둘 수 있다.
  ```
- **위반 규약**: CLAUDE.md §명명 컨벤션 표 (project-planner `SKILL.md §명명 컨벤션`) — 현재 `spec/<영역>/0-overview.md` 패턴만 정의하고 루트 레벨 파일 패턴이 없음. 단일 진실 원칙에 따르면 naming convention 의 권위 있는 위치는 `spec/conventions/<name>.md` 또는 CLAUDE.md 이며, `spec/0-overview.md §8` 는 spec 본문으로 해당 역할이 아님.
- **상세**: 본 draft 는 `spec/0-overview.md §8` 의 문서 컨벤션 bullet 에 루트 레벨 파일 패턴을 새로 기술하고 있다. 그러나 plan/in-progress/spec-overview-followups-2026-05-18.md §4 는 이 내용을 CLAUDE.md 에 추가하는 별도 작업(I-5)으로 분리해 두었다. 결과적으로 draft 상태에서 루트 레벨 파일 패턴은 `spec/0-overview.md §8` 에만 존재하고 CLAUDE.md / SKILL.md 에는 없어 단일 진실 원칙이 깨진다. spec 문서가 naming convention 의 SoT 가 되면 다른 spec 작성자가 CLAUDE.md 만 보고 `spec/0-overview.md §8` 를 별도로 찾아야 한다.
- **제안**: 두 방향 중 선택.
  - **(권장)** plan §4 (I-5) 를 이 draft 와 함께 진행해 CLAUDE.md §명명 컨벤션 표에 루트 레벨 행을 동시에 추가한다. 그러면 `spec/0-overview.md §8` 의 문서 컨벤션 bullet 은 "CLAUDE.md §명명 컨벤션 참조" 로 요약하거나, 상세 설명을 유지하되 "CLAUDE.md 에도 동일하게 기재" 라고 병기한다.
  - **(차선)** 현 draft 의 `§8` bullet 을 유지하되, `## Rationale` 에 "CLAUDE.md 갱신(I-5)은 후속 PR" 이라는 노트를 명시해 독자가 현재 불완전함을 인지하게 한다.

---

### 2. [INFO] `§3.4 Inline Alert > 위치` bullet 의 설명 내용 일부 이동 — 구 버전 이유 기술 제거 흔적 확인 필요

- **target 위치**: `§3.4 상태 표시 패턴 > Inline Alert > 위치` sub-bullet (prompt 내 line 343)
  ```
  **위치**: 영역별 `_layout.md` 가 아닌 `0-overview.md` 의 cross-cutting 자리에 둔다. 근거·기각된 대안은 [Rationale § Inline Alert 의 위치](#inline-alert-의-위치를-0-overviewmd-cross-cutting-자리로-34) 참조.
  ```
  vs. 현행 파일 (line 320):
  ```
  **위치**: 사용처가 navigation 외부(향후 webhook signing key 회전, notification preference 변경 등) 로 확장될 가능성이 있어 영역별 `_layout.md` 가 아닌 `0-overview.md` 의 cross-cutting 자리에 둔다.
  ```
- **위반 규약**: CLAUDE.md — "본문은 latest-only 사실을 기술하고, '왜 이 선택인가' 는 Rationale 를 참조한다." (project-planner SKILL.md §단일 진실 원칙)
- **상세**: draft 는 이유 설명(`사용처가 navigation 외부 ... 확장될 가능성이 있어`) 를 본문 bullet 에서 제거하고 Rationale 로 이전했다. 이는 3섹션 원칙(본문 = latest-only / Rationale = 결정 근거)에 **부합하는 올바른 방향**이다. 다만 draft Rationale `§ Inline Alert 의 위치` (prompt line 413-418) 는 이 이유를 잘 담고 있어 내용 손실 없음 — INFO 수준.
- **제안**: 현행 draft 처리 방식이 규약에 적합하다. 변경 불필요.

---

### 3. [INFO] `§8 문서 맵 > 문서 컨벤션` — 루트 레벨 bullet 의 위치가 `N-name.md` bullet 앞에 와야 논리적 흐름에 맞음

- **target 위치**: `§8 문서 맵 > 문서 컨벤션` bullet 순서 (prompt lines 166-171)
  현재 순서: `_product-overview.md` → `_layout.md` → **루트 레벨 (신설)** → `0-overview.md / 0-common.md` → `N-name.md`
- **위반 규약**: 명시적 규약 없음.
- **상세**: 루트 레벨(`spec/0-overview.md` 등) bullet 이 `_product-overview.md`, `_layout.md` 다음, `0-overview.md` 앞에 위치한다. 논리적으로는 루트 레벨 파일이 영역 내 파일(`0-overview.md`, `N-name.md`)보다 상위 개념이라 먼저 기술하는 것이 독자 이해에 도움이 된다. 그러나 `_product-overview.md`(영역 진입 파일) 와 `_layout.md`(영역 공통 파일)는 이미 앞에 있으므로 루트 레벨을 추가하기 전에 소개된다. 이 순서는 파일 유형의 계층성(루트 → 영역 → 상세) 보다는 파일 이름 패턴(`_`-prefix → 정수-prefix → `N-prefix`)으로 정렬된 것으로 보임.
- **제안**: 현재 순서로도 이해에 지장 없음. 개선하려면 루트 레벨 bullet 을 맨 앞으로 이동하고 "spec/ 루트에 위치하는 cross-cutting 진입 문서 → 영역 진입 `_product-overview.md` → ..." 순으로 재정렬 가능. 선택 사항.

---

### 4. [INFO] `§8 문서 맵` 표 — `spec/data-flow/` 가 `§4 영역별 진입 문서` 표에는 없음

- **target 위치**: `§8 문서 맵` 표 마지막 행 `| 데이터 흐름 | spec/data-flow/ | ...`
- **위반 규약**: 명시적 규약 없음 — INFO.
- **상세**: `§8 문서 맵` 표에 `spec/data-flow/` 행이 있지만 `§4 영역별 진입 문서` 표에는 없다. 두 표의 대상 범위가 다르다면 (§8 = 폴더 전체 지도, §4 = PRD↔spec 연결 매핑) 이 비대칭은 의도된 것일 수 있다. 이는 현행 파일에서도 동일하게 존재하며 draft 가 변경하지 않은 부분이다.
- **제안**: 의도적 비대칭이라면 §8 에 짧은 주석("§4 영역별 진입 문서 표는 PRD↔spec 연결 중심, data-flow 는 별도 진입 없이 폴더 직접 참조")을 달아 혼동을 예방할 수 있다. 필수 아님.

---

### 5. [INFO] Rationale 각 항목의 날짜/출처 명시 없음

- **target 위치**: `## Rationale` 섹션 전체 (prompt lines 388-426)
- **위반 규약**: 명시적 규약 없음 — INFO.
- **상세**: project-planner SKILL.md 는 Rationale 에 "결정 배경·근거·폐기된 대안"을 담으라 하지만 결정 날짜·출처 PR 번호 명시를 의무화하지는 않는다. 다른 conventions 문서(`cafe24-api-catalog/_overview.md §7 CHANGELOG` 등)는 날짜·PR 번호를 명시하는 패턴을 사용한다. Rationale 항목에 날짜나 관련 PR 번호를 주석으로 달면 추후 결정 변경 시 추적성이 높아진다.
- **제안**: 각 `###` 항목 첫 줄에 `결정 시점: YYYY-MM` 또는 PR 번호를 참조 형태(`(PR #NNN, YYYY-MM)`)로 추가하면 이력 추적이 편해진다. 선택 사항.

---

## 요약

`spec/0-overview.md` draft 는 CLAUDE.md 및 project-planner SKILL.md 가 권장하는 3섹션(Overview / 본문 / Rationale) 구조를 처음으로 갖추었고, Cafe24 분류 정합화(§6.1 이동)·본문-Rationale 분리 원칙 적용(Inline Alert 위치 이유 이전)·루트 레벨 파일 패턴 명시 등 규약 방향에 부합하는 변경이다. 주요 규약 위반은 없으나, 루트 레벨 naming convention 이 CLAUDE.md / SKILL.md 에 미반영된 채 `spec/0-overview.md §8` 에만 존재한다는 점이 단일 진실 원칙과 어긋나는 WARNING 수준 항목이다. plan §4 (I-5) 를 이 draft 와 함께 또는 즉시 후속 PR 로 처리하여 CLAUDE.md 를 동기화하는 것을 권장한다.

## 위험도

LOW
