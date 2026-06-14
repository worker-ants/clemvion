# Convention Compliance Review

**Target**: `spec/conventions/audit-actions.md`
**Reviewer**: convention-compliance sub-agent
**Mode**: spec draft (--spec)

---

## 발견사항

### [WARNING] `## Rationale` 섹션 부재 — 3섹션 권장 구조 미충족
- **target 위치**: 파일 전체 (종단 섹션 없음)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — "Overview / 본문 / Rationale"
- **상세**: `spec/conventions/` 내 19개 파일 중 14개가 `## Rationale` 섹션을 보유한다. `audit-actions.md` 는 Overview 에서 "명명·시제 결정의 배경·기각 대안·역사"를 `5-system/1-auth.md §Rationale 4.1.A` 로 위임한다고 명시하지만, 규약 SoT 문서 내에 자체 Rationale 섹션이 없다. 이 위임은 (a) 규약 독자가 본 문서 내에서 결정 근거를 찾을 수 없게 하고, (b) `1-auth.md §4.1.A` 가 이동·재구조화될 경우 규약의 설계 배경이 소실될 수 있다.
- **제안**: `## Rationale` 섹션을 추가하고 최소한 ① `<resource>.<verb>` 점(dot) 구분자 채택 이유, ② verb 시제 3분류 taxonomy 결정 근거를 기술한다. `1-auth.md §4.1.A` 의 `user.*` dot-prefix 결정은 해당 위치에 그대로 두되, 본 문서 Rationale 에서 인용 링크로 교차 참조하는 방식으로 구성할 수 있다.

---

### [WARNING] `set-default` verb 토큰에 하이픈 사용 — 기존 관례(언더스코어)와 불일치
- **target 위치**: §3 도메인별 분류 레지스트리 표 — `model_config` 행 (`set-default`)
- **위반 규약**: `spec/conventions/audit-actions.md §1` 자체 규약. 본 문서는 `<resource>.<verb>` 구조만 명시하고 verb 토큰 내부 구분자를 규정하지 않는다. 그러나 현재 구현된 모든 다중 어절 verb 토큰은 언더스코어를 사용한다: `scope_changed`, `re_run`, `transfer_ownership`, `role_changed`, `password_changed`. `set-default` 만 하이픈을 사용해 **사실상 관례와 불일치**한다.
- **상세**: `spec/5-system/1-auth.md §4.1` 에서 `set-default` 는 의도적으로 기록됐고 이를 정정한 근거는 보이지 않는다. 문제는 이 결정이 본 규약 문서(§1)에 명시되지 않아, `AUDIT_ACTIONS` 에 `model_config.set-default` 를 추가하는 시점에 혼선이 발생할 수 있다는 점이다. verb 토큰 구분자 정책이 `audit-actions.md §1` 에 없어 개발자가 `re_run`(언더스코어)을 참고해 `set_default` 로 구현할 수 있다.
- **제안**: (a) 언더스코어로 통일(`set_default`)하거나, (b) 하이픈 사용을 의도로 유지할 경우 §1 에 "verb 토큰 내 구분자는 언더스코어를 기본으로 하되, `set-default` 처럼 관용 표현으로 굳은 경우는 예외" 같은 명시적 규칙을 추가해야 한다. (a) 가 단순하고 일관성 측면에서 권장된다. 단 `1-auth.md §4.1` 와 동기 갱신 필요.

---

### [WARNING] `## Rationale` 위임이 규약 문서의 단일 책임 원칙 약화
- **target 위치**: `## Overview` 세 번째 bullet ("명명·시제 결정의 배경·기각 대안·역사": `5-system/1-auth.md §Rationale 4.1.A` (SoT))
- **위반 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 본 문서가 "유일하게 소유"한다고 선언한 ① 구조 규칙 ② verb 시제 3분류 ③ 도메인 레지스트리의 결정 근거가 타 spec 문서(`1-auth.md`) 에 위치한다. `1-auth.md §Rationale 4.1.A` 는 `user.*` dot-prefix 통일 결정에 국한된 근거이지, verb 시제 3분류 taxonomy 전체의 설계 근거를 포함하지 않는다. 규약 문서의 핵심 설계 배경이 파편화되어 있다.
- **제안**: 본 문서 내에 `## Rationale` 를 신설하여 taxonomy 설계 근거를 소유한다. `1-auth.md §4.1.A` 는 해당 케이스의 근거 SoT 로 유지하되, 본 Rationale 에서 인용한다(중복 기술 불필요).

---

### [INFO] 레지스트리 표 `상태` 컬럼에 한국어·영어 혼용
- **target 위치**: §3 도메인별 분류 레지스트리 표 — `상태` 컬럼 값 "구현" vs "Planned"
- **위반 규약**: 명시적 금지 규약 없음. 단 `spec/5-system/1-auth.md §4.1` 의 동일 레지스트리도 "구현됨" / "Planned" 혼용을 답습하고 있어 불일치가 상위 문서에서 파생됐다.
- **상세**: "구현" 과 "Planned" 는 한국어·영어 혼용이다. 표의 일관성이 떨어지며, 한국어 독자에게 "미구현 예정" 정도로 통일하는 것이 가독성에 유리하다.
- **제안**: "Planned" → "예정" 또는 "미구현" 으로 통일. `1-auth.md §4.1` 와 동기 갱신 권장.

---

### [INFO] `## Overview` 섹션 헤딩이 "## Overview (제품 정의)" 표준과 상이
- **target 위치**: 파일 9번 줄 — `## Overview`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조` — "Overview (제품 정의)" 헤딩 표준 권장
- **상세**: `spec/conventions/spec-impl-evidence.md` 와 `user-guide-evidence.md` 는 `## Overview (제품 정의)` 를 사용하고, `execution-context.md` 는 `## Overview (목적)` 를 사용한다. `error-codes.md` 와 `cafe24-restricted-scopes.md` 는 `## Overview` 만 쓰는 등 관례가 혼재한다. 경고 수준은 낮으나 불일치.
- **제안**: `## Overview` 그대로 유지해도 가드 위반은 아니지만, 표준에 맞추려면 `## Overview (목적)` 또는 `## Overview (명명 규약 범위)` 로 보완할 수 있다. 기존 혼재 상태를 고려하면 낮은 우선순위.

---

## 요약

`spec/conventions/audit-actions.md` 는 frontmatter(`id`, `status`, `code:` 경로 실존), `<resource>.<verb>` 구조 규칙, verb 시제 3분류 taxonomy, 도메인 레지스트리의 본문 구성 측면에서 conventions 정식 규약의 핵심 요구사항을 대체로 준수한다. 그러나 두 가지 WARNING 이 존재한다: (1) `## Rationale` 섹션이 없고 설계 근거를 타 문서에 위임한 것이 CLAUDE.md 의 "결정 배경 → 해당 spec 문서 끝 Rationale" 원칙과 어긋나며, (2) `model_config.set-default` 의 하이픈 구분자가 §1 에 명시된 규칙이 없는 상태에서 기존 모든 다중 어절 verb 의 언더스코어 관례와 불일치하여 구현 시 혼선을 일으킬 수 있다. 이 두 문제를 해소하려면 `## Rationale` 신설과 verb 토큰 내부 구분자 정책의 §1 명시(또는 `set-default` → `set_default` 통일)가 필요하다.

## 위험도

MEDIUM
