# 신규 식별자 충돌 검토 — naming_collision

검토 대상: `spec/0-overview.md` (inline alert UI 패턴 추가 전 현재 버전)
검토 모드: `--spec` (spec draft 검토)
세션: `review/consistency/2026/05/18/17_22_08/`

---

## 발견사항

### [WARNING] "파랑" 색상 의미가 Badge/Tag(Processing)와 Inline Alert(info) 두 컴포넌트에서 충돌

- **target 신규 식별자**: `info(파랑)` — Inline Alert 의 정보성 톤 매핑으로 `spec/0-overview.md §3.4` 에 추가 예정
- **기존 사용처**: `spec/0-overview.md §3.4 Badge/Tag` 에서 `Processing(파랑 스피너)` 로 이미 정의됨
- **상세**: 두 UI 컴포넌트 모두 "파랑" 을 사용하지만 의미가 다르다. Badge/Tag 의 `Processing(파랑)` 은 "진행 중" 상태를 뜻하고, Inline Alert 의 `info(파랑)` 은 "정보 안내" 를 뜻한다. 같은 문서의 같은 섹션에서 동일 색상이 서로 다른 의미로 정의되면, 화면을 구현하는 개발자 또는 타 spec 을 작성하는 기획자가 "파랑 = Processing 인지, info 인지" 혼동할 수 있다. `spec/2-navigation/4-integration.md:85` 의 "기본 톤은 amber (warning)" 기술처럼 이미 Inline Alert 톤이 외부 spec 에서 먼저 구체화되어 있어 불일치 범위가 넓어질 수 있다.
- **제안**: `§3.4` 에 Inline Alert 를 추가할 때 Badge/Tag 의 색상 의미와 Inline Alert 의 색상 의미를 명시적으로 구분하는 한 줄을 추가한다. 예: "Badge/Tag 색상은 리소스 상태를 나타내고, Inline Alert 색상은 안내 메시지의 긴급도를 나타낸다 — 동일 색상이라도 역할이 다르다." 또는 Inline Alert 의 `info` 톤을 "파랑 (Processing 스피너와 무관)" 처럼 괄호 주석으로 구별한다.

---

### [WARNING] "amber 경고 배너" 와 "Inline Alert (warning, amber 톤)" 두 명칭이 코퍼스에 공존

- **target 신규 식별자**: `Inline Alert` — `spec/0-overview.md §3.4` 에 공식 패턴명으로 추가 예정
- **기존 사용처**:
  - `spec/2-navigation/4-integration.md:159` — "폼 하단에 영구 amber 경고 배너를 띄운다"
  - `spec/2-navigation/4-integration.md:1327` — "amber 경고 배너로 인지를 강제한다"
  - `spec/conventions/cafe24-restricted-scopes.md:83` — "위저드 Step 2 폼 하단에 영구 amber 경고 배너를 띄운다"
  - `spec/conventions/cafe24-restricted-scopes.md:122` — "amber 경고 배너로 인지를 강제한다"
- **상세**: 현재 `spec/0-overview.md §3.4` 에는 `Inline Alert` 라는 명칭이 없다. 공통 패턴명 없이 위 파일들이 "amber 경고 배너" 를 자체 기술하고 있다. `spec/0-overview.md` 에 `Inline Alert` 가 추가된 후에도, 위 사용처가 갱신되지 않으면 "amber 경고 배너" 와 "Inline Alert (warning, amber 톤)" 두 명칭이 다른 문서에서 같은 컴포넌트를 서로 다른 이름으로 부르는 상태가 된다. plan 의 `§3.2` / `§4.4` 갱신 항목이 해소할 예정이지만, `spec/conventions/cafe24-restricted-scopes.md` 갱신은 계획에서 명시되지 않았다.
- **제안**: `spec/0-overview.md §3.4 Inline Alert` 정의 추가와 함께 `spec/conventions/cafe24-restricted-scopes.md:83, 122` 의 "영구 amber 경고 배너" 표현도 "Inline Alert (warning, amber 톤 — `spec/0-overview.md §3.4` 참조)" 로 갱신한다. plan 의 작업 범위에 이 두 줄을 포함시킨다.

---

### [INFO] Inline Alert 의 `error(red)` 톤과 Badge/Tag 의 `Error(빨강)` 표기 언어 불통일

- **target 신규 식별자**: `error(red)` — Inline Alert 톤 매핑 (영문 소문자 + 괄호 영문)
- **기존 사용처**: `spec/0-overview.md §3.4 Badge/Tag` 에서 `Error(빨강)` (영문 대문자 + 괄호 한글) 로 표기됨
- **상세**: 동일 섹션에서 같은 "빨강/red" 색상이 Badge/Tag 에서는 `Error(빨강)`, Inline Alert 에서는 `error(red)` 로 표기 규칙이 다르다. 이는 충돌이 아닌 일관성 부재이지만, `§3.4` 안에서의 색상 표기 기준이 통일되지 않으면 향후 컴포넌트 추가 시 임의 표기가 누적된다.
- **제안**: `§3.4` 내 색상 표기를 한 가지 방식으로 통일한다. 예를 들어 `Error(빨강, red)` 처럼 한글과 영문을 함께 표기하거나, Badge/Tag 를 `Error(red)` 로 맞추는 방식을 채택한다.

---

### [INFO] `spec/conventions/cafe24-restricted-scopes.md` 가 plan 의 갱신 목록에서 누락

- **target 신규 식별자**: `Inline Alert` (공통 UI 패턴명)
- **기존 사용처**: `spec/conventions/cafe24-restricted-scopes.md:83, 122` — "amber 경고 배너" 표현 2건
- **상세**: plan 문서 (`plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md`) 의 갱신 대상은 `spec/2-navigation/4-integration.md §3.2`, `§4.4`, Rationale 3곳이다. `spec/conventions/cafe24-restricted-scopes.md` 는 갱신 대상에 없다. 이 파일도 동일 패턴을 "배너" 라고 기술하고 있어, `0-overview.md §3.4 Inline Alert` 정의 이후 표현 불일치가 남는다.
- **제안**: plan 의 작업 범위에 `spec/conventions/cafe24-restricted-scopes.md:83, 122` 2건 갱신을 추가한다. 변경 규모는 두 줄이고 같은 PR 에서 처리하기에 부담이 없다.

---

## 요약

`spec/0-overview.md` 가 도입하는 신규 식별자(`Inline Alert`, `info(파랑)`, `warning(amber)`, `error(red)` 톤 매핑)는 기존에 **다른 의미로 선점된 식별자와의 직접 충돌은 없다**. 그러나 동일 섹션(`§3.4`) 에서 `Badge/Tag` 의 `Processing(파랑 스피너)` 와 `Inline Alert` 의 `info(파랑)` 이 파랑 색상을 다른 의미로 공유하는 구조적 혼동 가능성이 있으며(WARNING), "amber 경고 배너" 라는 이미 확산된 비공식 명칭이 `spec/conventions/cafe24-restricted-scopes.md` 에도 남아 공식 패턴명(`Inline Alert`) 과 병존하게 된다는 점(WARNING + INFO)이 주요 발견사항이다. 파일 경로 충돌, API endpoint 충돌, 환경변수 충돌, 요구사항 ID 충돌은 없다.

## 위험도

LOW
