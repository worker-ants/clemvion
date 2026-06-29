# 정식 규약 준수 검토 결과

**검토 대상**: `spec/conventions/i18n-userguide.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-29

---

## 발견사항

### [INFO] 문서 구조 — Overview 섹션 명시 부재
- **target 위치**: 파일 전체 구조 (H2 heading 목록)
- **위반 규약**: CLAUDE.md §정보 저장 위치 및 각 SKILL.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 는 spec 문서가 Overview / 본문 / Rationale 3섹션 구성을 권장한다고 명시한다. `i18n-userguide.md` 는 `## Rationale` 섹션은 있으나 명시적 `## Overview` 섹션이 없고, 대신 문서 상단 인트로 문단이 그 역할을 대체하고 있다. `spec-impl-evidence.md` 같은 인접 conventions 문서는 `## Overview (제품 정의)` 를 명시적으로 두고 있다.
- **제안**: 현행 인트로 문단(`UI 다국어 문자열·...`)을 `## Overview` heading 아래에 배치. 기능상 변경 없이 구조 일관성 확보. 단, `spec/conventions/` 소속 문서들이 일관적으로 Overview 를 생략하고 있다면 conventions 군 내 표준이라 볼 수 있어 이 경우 INFO 수준에서 유지.

---

### [INFO] 자동 가드 요약 표 — Principle 번호 레이블 내 코드 표기 불일치
- **target 위치**: `## 자동 가드 요약` 표, 행 1 (`Principle 1 (TSX 하드코딩)`)
- **위반 규약**: 본 문서 내 일관성 (conventions 자체 내부 정합)
- **상세**: Principle 1 본문에서 P2-b 가드(`hardcoded-korean-ratchet.test.ts`)를 "P2-b" 로 칭하고 있으나, 자동 가드 요약 표에서는 같은 가드를 "Principle 1 (TSX 하드코딩)" 행에 "(P2-b, `hardcoded-korean-baseline.json`)" 로 괄호 표기한다. P2-b 라는 코드는 본문 어디에도 "Principle 2-b" 라는 표제로 정의된 절이 없어, 독자가 P2-b 의 출처 절을 추적하기 어렵다. (Principle 1 의 ratchet 가드인데 왜 P2-b 인지 설명이 없음.)
- **제안**: 자동 가드 요약 표의 해당 행에 P2-b 코드 대신 혼동 없는 가드명만 표시하거나, Rationale 에 P2-b 코드 유래를 한 줄 추가. 또는 본문 Principle 1 에 ratchet 가드를 "(P1-ratchet / 구 P2-b)" 로 명시적으로 정의.

---

### [INFO] `spec/conventions/i18n-userguide.md` frontmatter `id` 값과 파일명 일관성 — 이상 없음 (확인)
- `id: i18n-userguide`, 파일 basename `i18n-userguide.md` — `spec-impl-evidence.md §2.1` 의 "파일 basename 기반 권장" 을 준수. 이상 없음.

---

### [INFO] frontmatter `status: implemented` 와 `code:` 글로브 실존 — 검토 범위 내 이상 없음
- **target 위치**: frontmatter lines 1-15
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` (`implemented` 시 `code:` ≥1 매치 의무)
- **상세**: `code:` 에 10개 경로가 등재되어 있고 이 중 `codebase/frontend/src/lib/i18n/backend-labels.ts` 등은 실존하는 파일이다. 글로브(`dict/**`, `__tests__/**`) 는 검토 시점 기준 구현 완료된 파일들을 가리킨다. `status: implemented` 로 선언하는 것은 `spec-impl-evidence.md §3` 과 정합한다. 실제 파일 실존은 `spec-code-paths.test.ts` 가 빌드 시점에 강제하므로 별도 위반 없음.

---

### [INFO] HTML 주석으로 중복된 status 선언
- **target 위치**: 라인 17-18 (`<!-- status: implemented — ... -->`)
- **위반 규약**: 명시적 금지 조항은 없으나, `spec-impl-evidence.md §2` 의 frontmatter 가 status 의 단일 진실이며 주석은 중복 관리 대상
- **상세**: frontmatter 에 `status: implemented` 가 이미 있음에도 HTML 주석으로 동일 내용을 반복 서술한다. 주석이 stale 되면 두 표현이 불일치할 수 있다 (예: 추후 `status` 변경 시 주석만 업데이트 누락). 다른 convention 문서들은 이런 이중 선언 패턴을 쓰지 않는다.
- **제안**: HTML 주석 제거 후 Rationale 또는 Overview 에 구현 완료 맥락을 서술하는 방식으로 통합. 또는 주석이 검토 히스토리 목적이라면 해당 의도를 명시.

---

## 요약

`spec/conventions/i18n-userguide.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`) 이 요구하는 frontmatter 스키마(`id` · `status: implemented` · `code:` ≥1 항목)를 완전히 준수하고 있다. 명명 규약(kebab-case `id`, 파일명 일치)·출력 포맷 규약(자동 가드 표·Principle 번호 체계)·API 문서 관련 사항(해당 없음)에서도 정식 위반은 발견되지 않는다. conventions 에서 금지한 패턴(내부 SoT 참조, `_product-overview.md` 남용 등)도 없다. 발견된 사항은 모두 INFO 등급으로, 문서 구조 권장 패턴(`## Overview` heading 명시)과 내부 주석 이중화·코드 표기 불일치 등 사소한 형식 일관성 제안에 그친다. CRITICAL·WARNING 등급 위반은 없다.

---

## 위험도

NONE
