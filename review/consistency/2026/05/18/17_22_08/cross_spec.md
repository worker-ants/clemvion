# Cross-Spec 일관성 검토 — `spec/0-overview.md`

검토 모드: `--spec`
검토 시각: 2026-05-18 17:22

---

## 발견사항

### [WARNING] Inline Alert 패턴이 spec/0-overview.md §3.4 에 미정의 상태이며, 동일 패턴에 대한 명칭이 영역별 spec 간 불일치

- **target 위치**: `spec/0-overview.md §3.4 상태 표시 패턴` — Badge/Tag · Toast · Skeleton 3종만 정의. Inline Alert 항목 없음.
- **충돌 대상**:
  - `spec/2-navigation/4-integration.md §4.4` (라인 301): "**inline alert (영구 표시, amber 톤)**" 으로 직접 사용
  - `spec/2-navigation/4-integration.md §3.2` (라인 159): 동일 패턴을 "영구 amber 경고 배너" 로 칭함
  - `spec/2-navigation/4-integration.md` Rationale (라인 1116): "inline alert + info 토스트" 로 기술
- **상세**: `spec/0-overview.md §3.4` 는 공통 UI 패턴 카탈로그를 정의하는 자리이다. `spec/2-navigation/4-integration.md` 는 동일한 inline-on-page-alert 패턴을 두 개 섹션에서 서로 다른 이름("영구 amber 경고 배너" vs "inline alert")으로 기술하고 있다. `spec/0-overview.md §3.4` 에 정의가 없어 표준 명칭이 없는 상태이므로 영역별 spec 이 각자 용어를 만들어 쓰고 있는 구조다. 본 worktree 의 plan 이 이 항목을 추가하려는 목적임을 감안하면 추가 작업이 완료되지 않은 상태에서 consistency-check 가 실행된 것으로 보인다.
- **제안**:
  1. `spec/0-overview.md §3.4` 에 `Inline Alert` 항목 추가 (plan 에 이미 명세됨 — `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` §작업범위 참조).
  2. 추가 후 `spec/2-navigation/4-integration.md §3.2` 의 "영구 amber 경고 배너" 표현을 "inline alert (warning, amber 톤 — §3.4 참조)" 로 정합화.

---

### [WARNING] `spec/1-data-model.md` Node.type 전체 목록에 `filter` 타입 누락

- **target 위치**: `spec/0-overview.md §6.1` — 노드 시스템 구현 완료 목록에 `Filter` 포함 (`Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod)`).
- **충돌 대상**: `spec/1-data-model.md §2.6 Node.type 전체 목록` — `logic` 카테고리의 타입 열거에 `filter` 없음. `split`, `map`, `foreach`, `parallel`, `merge`, `background` 는 모두 있으나 `filter` 만 빠져있음.
- **보조 확인**: `spec/4-nodes/0-overview.md` (라인 148): `filter` 노드가 logic 카테고리로 정의됨. `spec/4-nodes/1-logic/8-filter.md` 파일 존재. `spec/4-nodes/_product-overview.md` §4.x 섹션 목록에도 Filter 섹션 없음 (§4.6 Split → §4.7 Map → §4.8 ForEach 로 바로 건너뜀).
- **상세**: `spec/0-overview.md`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/1-logic/8-filter.md` 세 곳에서 `filter` 노드를 구현된 logic 노드로 취급하는 반면, `spec/1-data-model.md` 의 Node.type 전체 목록과 `spec/4-nodes/_product-overview.md` 의 §4.x 설명 섹션에서 누락되어 있다. 데이터 모델 목록은 DB Node.type 컬럼의 허용 Enum 값을 정의하는 자리이므로 `filter` 가 실제 구현되어 있다면 이 목록에 없는 것은 직접 모순이다.
- **제안**:
  1. `spec/1-data-model.md §2.6 Node.type 전체 목록`의 `split` 행 다음에 `filter | 배열 필터링` 행 추가.
  2. `spec/4-nodes/_product-overview.md` 에 §4.6.5 또는 §4.6 과 §4.7 사이에 Filter 섹션 추가 (split과 map 사이 논리적 위치).

---

### [INFO] `spec/0-overview.md §6.2` 섹션 분류 레이블과 Cafe24 본문 서술 간 혼동

- **target 위치**: `spec/0-overview.md §6.2` — 섹션 제목 "백엔드만 존재 / 부분 구현 (🚧)".
- **충돌 대상**: 동일 섹션 내 Cafe24 통합 행 — "모두 구현 완료 (PR #20-#67)"로 서술하며 남은 작업을 §6.3 로드맵으로 넘김.
- **상세**: §6.2 는 "백엔드만 존재 / 부분 구현" 섹션이나 Cafe24 통합 항목은 "모두 구현 완료"라고 명시한다. Cafe24 항목은 §6.1(완료)에 있어야 하거나, §6.2 에 두되 "남은 작업이 §6.3 로드맵으로 분리된 완료 항목"임을 레이블 또는 주석으로 명시해야 한다. 직접적 타 영역 spec 충돌은 없으나 개요 문서의 구분 기준이 흐려져 독자 혼동을 유발한다.
- **제안**: Cafe24 통합 항목을 §6.1 완료 테이블로 이동시키거나, §6.2 에 남길 경우 "구현 완료 — 남은 확장 작업은 §6.3 참조" 형태의 상태 컬럼을 추가해 섹션 분류와 일치시킴.

---

### [INFO] `spec/0-overview.md §3.4` 상태 표시 패턴과 `spec/2-navigation/11-error-empty-states.md` 의 에러 페이지 패턴 간 참조 관계 미정립

- **target 위치**: `spec/0-overview.md §3.4` — 상태 표시 패턴으로 Badge/Tag·Toast·Skeleton 정의.
- **충돌 대상**: `spec/2-navigation/11-error-empty-states.md §1` — 시스템 수준 에러 페이지 (전체화면 교체), `§2` — 빈 상태(Empty State) 패턴. 두 패턴 모두 §3.4 에 언급되지 않음.
- **상세**: `spec/0-overview.md §3.4` 는 공통 UI 패턴 카탈로그를 자처하지만, 에러 페이지 전환·빈 상태 UI 같은 주요 공통 패턴이 `spec/2-navigation/11-error-empty-states.md` 에 별도 정의되어 있고 §3.4 에는 참조조차 없다. 모순은 아니나 §3.4 가 불완전한 카탈로그로 보일 수 있어 다른 영역에서 패턴을 추가할 때 `11-error-empty-states.md` 가 canonical 임을 찾기 어렵다.
- **제안**: `spec/0-overview.md §3.4` 에 에러 페이지·빈 상태 패턴의 canonical 위치(`spec/2-navigation/11-error-empty-states.md`)를 참조 링크로 명시 (Inline Alert 항목 추가 시 함께 정비 권장).

---

## 요약

`spec/0-overview.md` 는 전반적으로 다른 spec 영역과 큰 충돌 없이 일관성을 유지하고 있다. 다만 두 가지 명시적 불일치가 존재한다. 첫째, 본 worktree 의 목적인 Inline Alert 패턴이 §3.4 에 아직 추가되지 않아 `spec/2-navigation/4-integration.md` 가 동일 패턴을 두 가지 명칭으로 혼용하는 상황이 유지되고 있다 — 계획된 §3.4 추가 작업이 완료되면 해소된다. 둘째, `spec/1-data-model.md` 의 Node.type 전체 목록에서 `filter` 타입이 누락되어 있어, `spec/0-overview.md §6.1` 및 `spec/4-nodes/0-overview.md` 와 직접 모순된다. 이 누락은 DB schema 와 ORM enum 정의에 실질적 영향을 줄 수 있으므로 별도 수정이 필요하다.

---

## 위험도

**MEDIUM**
