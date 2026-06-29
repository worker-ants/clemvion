# Cross-Spec 일관성 검토 결과

대상: `spec/conventions/user-guide-evidence.md`
검토 일시: 2026-06-29

---

## 발견사항

### [INFO] `i18n-userguide.md §Principle 7` 자동 검출 절의 GUI 신호 기술 불일치

- **target 위치**: `spec/conventions/user-guide-evidence.md §2` 가드 테이블 내 `integrations-coverage.test.ts` 행 — `findGuiFlowSections()` 의 GUI 신호 판별 기준을 "heading 텍스트에 bareword `GUI` 포함, 또는 절 본문에 `GUI` 를 포함한 bold strong 존재" (OR 2신호) 로 기술
- **충돌 대상**: `spec/conventions/i18n-userguide.md §Principle 7` 자동 검출 절 — "가이드 본문이 `**GUI ...**` strong 패턴으로 시작하거나 heading 에 `GUI` 키워드를 가진 절" 로 기술 (OR 동일하나, strong 의 `시작` 한정으로 서술해 target 의 "절 본문 어디든 strong" 보다 좁아 보임)
- **상세**: `i18n-userguide.md §Principle 7` 은 "`**GUI ...**` strong 패턴으로 시작하거나" 라는 표현을 사용해 strong 이 절 본문 선두에 위치하는 경우에 한정하는 것처럼 읽힌다. target 문서는 `**…GUI…**` 가 절 본문 내 어느 위치에 있어도 신호로 인정한다고 기술한다. 실제 가드 구현(`findGuiFlowSections()`)의 SoT 는 target 이므로 i18n-userguide 의 기술이 다소 좁게 축약된 것이 유력하나, 표현 차이가 오해를 유발할 수 있다.
- **제안**: `i18n-userguide.md §Principle 7` 자동 검출 서술을 target 의 `findGuiFlowSections()` 정의 ("heading 텍스트에 `GUI` 포함, 또는 절 본문에 `GUI` 를 포함한 bold strong(`**…GUI…**`/`__…GUI…__`) 존재") 로 동기화. target 은 변경 불필요 (SoT).

---

### [INFO] `spec/2-navigation/13-user-guide.md §8` `<ImplAnchor>` 컴포넌트 표 기술의 신호 기준 미기재

- **target 위치**: `spec/conventions/user-guide-evidence.md §1.1~§2` — `kind` 4값, `findGuiFlowSections()` 2신호, 가드 3건, `api-endpoint` kind 추가 검증 규칙 전체 기술
- **충돌 대상**: `spec/2-navigation/13-user-guide.md §8` 공용 MDX 컴포넌트 표 — `<ImplAnchor>` 를 한 줄로 요약 ("props: `kind` ∈ `{ui-entry, component, api-endpoint, e2e-scenario}` · `file` · `symbol` · `describes`. 사용자 view 에서 hidden 렌더. SoT: `spec/conventions/user-guide-evidence.md`")
- **상세**: 내용 충돌 없음. `13-user-guide.md` 는 요약 설명이고 SoT 를 target 으로 명시하므로 모순은 아니다. 단, `api-endpoint` kind 의 NestJS controller 데코레이터 검증 규칙, `findGuiFlowSections()` 2신호 기준 등 동작 세부가 `13-user-guide.md` 표에 없어 "작성자가 표만 보고 anchor 를 작성할 때 api-endpoint 추가 검증 규칙을 놓칠 수 있다" 는 작성 편의 갭이 있다.
- **제안**: 현 상태 유지해도 기능 충돌 없음. 다만 `13-user-guide.md §8` 표의 `<ImplAnchor>` 행에 "`kind=api-endpoint` 는 NestJS 데코레이터 검증 추가. 상세 SoT 참조" 정도의 주석을 추가하면 작성자 혼란 감소. 선택적 개선.

---

### [INFO] `spec-impl-evidence.md §4.1` 관계 기술 범위가 target 의 새 가드를 미포함

- **target 위치**: `spec/conventions/user-guide-evidence.md §2.1` — "다른 가드와의 관계" 에서 `spec-code-paths.test.ts` (spec-impl-evidence §4) 와의 관계를 명시
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md §4.1` 가드와 다른 가드의 관계 절 — `registry.test.ts`, `nodes-coverage.test.ts` 와의 관계만 기술하고 target 이 도입하는 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 와의 관계가 미기재
- **상세**: 내용 모순 없음. `spec-impl-evidence.md §4.1` 은 target 도입 이전 시점의 기술이 그대로 남아 있어 3개 신규 가드와의 관계가 없는 것처럼 보인다. target(`user-guide-evidence.md §2.1`) 은 이미 `spec-code-paths.test.ts` 와의 관계를 정확히 기술하고 있다.
- **제안**: `spec-impl-evidence.md §4.1` 에 "user-guide-evidence 가드 3건(`impl-anchor-existence` / `integrations-coverage` / `triggers-coverage`) 과의 관계: guide → code 방향 검증이라 spec → code 방향인 본 가드와 직교 — SoT: `spec/conventions/user-guide-evidence.md §2.1`" 주석 추가. 선택적 동기화.

---

### [INFO] `PROJECT.md §자동 가드 표` 와 target 가드 명칭 완전 일치 확인 (충돌 없음)

- **target 위치**: `spec/conventions/user-guide-evidence.md §2` 가드 테이블
- **충돌 대상**: `PROJECT.md §자동 가드` 표, `PROJECT.md §유저 가이드 파일 컨벤션 SoT 인덱스`
- **상세**: `PROJECT.md` 는 3개 가드 파일명(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`)과 SoT 경로(`spec/conventions/user-guide-evidence.md`) 를 target 과 동일하게 기술. 결정 E-5 ("PROJECT.md §유저 가이드 파일 컨벤션 SoT 인덱스 — 본 문서 등재") 도 구현됨. 충돌 없음, 동기화 완료.

---

### [INFO] `spec/conventions/i18n-userguide.md` 자동 가드 요약표와 target 신규 가드 미동기화

- **target 위치**: `spec/conventions/user-guide-evidence.md §2` 가드 3건
- **충돌 대상**: `spec/conventions/i18n-userguide.md §자동 가드 요약` 표 — Principle 7 행에 수동 검토 (`—`) 로 기재. target 의 3개 build-time 가드가 Principle 7 의 GUI 흐름 절을 부분 커버하므로 "hard fail (GUI 흐름 절만)" 으로 갱신이 권장됨
- **상세**: `i18n-userguide.md §Principle 7` 본문은 target 을 SoT 로 링크하고 "자동 검출 — 부분 커버" 를 설명하므로 실질적 내용 충돌은 없다. 그러나 자동 가드 요약표의 Principle 7 행 "가드 종류" 란이 `—`(수동/reviewer) 로만 남아 있어 build-time 가드가 없는 것처럼 읽힌다.
- **제안**: `i18n-userguide.md §자동 가드 요약` 표의 Principle 7 행을 "`impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` (GUI 흐름 절만 hard fail) + 개념 설명 절은 manual" 로 갱신. 선택적 동기화.

---

## 요약

`spec/conventions/user-guide-evidence.md` 는 기존 `spec-impl-evidence.md`, `i18n-userguide.md`, `spec/2-navigation/13-user-guide.md`, `PROJECT.md` 와 **데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, 권한·RBAC 충돌, 계층 책임 충돌 모두 없다**. 발견된 사항은 전부 INFO 등급의 기술 표현 불일치 또는 요약 누락으로, target 이 SoT 로 정확히 선언되어 있고 충돌 대상 spec 들도 target 을 SoT 로 역참조하고 있어 실제 구현 또는 시스템 동작에 모순을 초래하지 않는다. 가장 주의할 항목은 `i18n-userguide.md §Principle 7` 과 target 의 `findGuiFlowSections()` 신호 기준 서술 차이(INFO-1) 로, 가이드 작성자가 두 문서를 동시에 읽을 때 혼란을 줄 수 있으므로 동기화가 권장된다.

---

## 위험도

NONE
