# Convention Compliance Review — `plan/in-progress/spec-update-pr4b-embedding-retire.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-12

---

## 발견사항

### [WARNING] §3 historical-artifact 테이블 컬럼 스키마 불일치
- **target 위치**: target 문서 `### 3` 의 "제안 추가" 코드 블록 내 표 — `| 구 코드 | 대체 코드 | PR | 비고 |`
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 의 기존 테이블 컬럼 정의 (`| 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |`)
- **상세**: 기존 `§3` 레지스트리 테이블은 5-컬럼 (`코드 / HTTP / 이름이 부정확한 이유 / 진실(의미) / 근거`) 스키마를 사용하고 있다. draft 에서 제안하는 신규 행들은 4-컬럼 (`구 코드 / 대체 코드 / PR / 비고`) 으로 정의한 **별도 테이블**을 삽입하는 형태이다. 이 경우 동일 섹션에 두 스키마가 혼재하게 되어 레지스트리의 단일-표 일관성이 깨진다. 기존 항목(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, `invitation_not_found` 그룹 등)은 rename 이유·의도·근거를 테이블에 함께 기록하는 컬럼 구조이나, draft 제안 컬럼엔 "이름이 부정확한 이유"와 "진실(의미)" 컬럼이 없다. 특히 `LLM_CONFIG_*` → `MODEL_CONFIG_*` 는 "의미 기반 명명 원칙(§1)" 위반 코드가 아니라 rename 자체가 의미를 개선한 사례이므로, §3 의 "이름이 부정확한 기존 코드를 등록" 취지와 다소 결이 다를 수 있다 — draft 의 목적(retired/rename 추적)과 §3 의 현재 목적(불정확 이름 예외) 간 미스매치를 설명하거나 §3 의 설명과 컬럼을 rename 이력 추적 용도로 확장하는 rationale 이 필요하다.
- **제안**: 제안 추가 행을 기존 5-컬럼 스키마(`| 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |`)에 맞춰 작성하고 기존 테이블에 행으로 추가한다. 만약 "rename 이력 추적" 목적의 별도 서브섹션이 필요하다면, `spec/conventions/error-codes.md` 에 `§3.1 Renamed codes (historical)` 서브섹션을 신설하는 규약 갱신을 명시적으로 제안해야 한다.

---

### [WARNING] 섹션 헤딩 — 신설 서브섹션 표기 혼용
- **target 위치**: target 문서 line 68 — `## §3 Historical Artifacts (Retired Codes)`
- **위반 규약**: `spec/conventions/error-codes.md §3` 섹션 명칭 (`## 3. Historical-artifact 예외 레지스트리`) 및 CLAUDE.md 문서 구조 규약 (Overview / 본문 / Rationale 3-섹션 권장, 넘버링 형식 일관)
- **상세**: 기존 `error-codes.md` 의 헤딩 형식은 `## 3. <한국어 제목>` 패턴이다. draft 에서 제안하는 삽입 블록 헤딩이 `## §3 Historical Artifacts (Retired Codes)` (영어·§ prefix) 로 기존 문서 헤딩 형식과 다르다. 이것은 실제 적용 시 `error-codes.md` 에 삽입될 마크다운 헤딩 예시이므로, 최종 적용 시 기존 문서 스타일을 깨뜨릴 위험이 있다.
- **제안**: 제안 코드 블록 내 헤딩을 기존 문서 형식(`## 3. Historical-artifact 예외 레지스트리` 하위에 행 추가하거나, `## 3.1 Rename 이력 (Retired codes)` 형태의 서브섹션) 으로 교정한다.

---

### [INFO] plan 문서에 체크리스트 항목 없음 — 완료 추적 가드 미비
- **target 위치**: `plan/in-progress/spec-update-pr4b-embedding-retire.md` 전체
- **위반 규약**: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), TODO, 남은 작업 … 항목이 하나라도 있으면 in-progress"
- **상세**: 이 plan 은 제안 변경 목록(§1~§7)과 적용 위치 요약 표를 가지고 있으나 체크박스(`- [ ]`) 형태의 진행 추적 항목이 없다. 라이프사이클상 plan 의 완료 여부를 판단하기 어렵고, `plan-lifecycle §2` 가 정의하는 "미체크 체크박스가 0건" 조건을 충족하는지 기계적으로 확인할 수 없다.
- **제안**: "적용 위치 요약" 표의 각 파일 변경을 `- [ ]` 체크박스 작업 목록으로 전환하면 라이프사이클 가드와 자연스럽게 연동된다. 단 이것은 `plan-lifecycle` 의 정형 의무 사항이 아니라 권고이므로 INFO 등급.

---

### [INFO] `spec/conventions/error-codes.md §3` 적용 목적 설명 — draft vs. 규약 의도 명시 필요
- **target 위치**: target 문서 `### 3` — "변경 목적: 외부 소비자가 rename 배경을 확인할 수 있게 함"
- **위반 규약**: `spec/conventions/error-codes.md §3` Overview 설명 — "§1 원칙을 따르지 않는 기존 코드를 명시적으로 등록한다. 신규 코드는 예외를 선례로 삼지 않는다."
- **상세**: `§3` 의 설계 의도는 "원칙(§1)을 따르지 않는 이름이 부정확한 기존 코드의 예외 레지스트리"이다. `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 는 §1 원칙을 따르지 않아서가 아니라 rename(breaking change) 이 발생했기 때문에 기록이 필요한 케이스이다. 이 목적과 §3 의 기존 목적이 다름에도 draft 는 이를 구별하지 않고 있다. 이 차이를 draft 본문에 명시하거나(`§3 에 별도 서브섹션으로 분리한다` 또는 `§3 의 목적을 rename 이력 포함으로 확장한다`), target spec 적용 시 `error-codes.md §3` 의 Overview 설명을 함께 갱신해야 함을 명시해야 한다.
- **제안**: `### 3` 변경 목적 설명에 "§3 목적 범위 확장 여부" 결정을 명시하거나, `spec/conventions/error-codes.md §3` 의 설명 갱신을 적용 위치 요약 표에 항목으로 추가한다.

---

## 요약

`plan/in-progress/spec-update-pr4b-embedding-retire.md` 는 plan frontmatter(`worktree`·`started`·`owner` 3필드) 를 충족하고, 참조 파일 경로(`spec/data-flow/6-knowledge-base.md`, `spec/conventions/error-codes.md` 등) 는 실존하는 경로와 일치하며, CLAUDE.md 의 정보 저장 위치 규칙도 준수한다. 주요 문제는 `spec/conventions/error-codes.md §3` 에 삽입을 제안하는 테이블의 컬럼 스키마가 기존 5-컬럼 레지스트리 형식과 불일치하고, 제안 헤딩(`## §3 Historical Artifacts (Retired Codes)`)이 기존 문서 헤딩 형식(`## 3. Historical-artifact 예외 레지스트리`)과 다르다는 점이다. 이 두 항목은 실제 spec 적용 시 기존 레지스트리의 표 일관성을 깨뜨릴 수 있어 WARNING 등급으로 분류했다. draft 가 `spec/` 을 직접 변경하는 것이 아니라 변경 제안서 역할임을 고려하면, 실제 spec 적용 PR 에서 해당 내용을 기존 스키마에 맞춰 조정해야 한다.

## 위험도

LOW
