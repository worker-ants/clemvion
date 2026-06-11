# Convention Compliance Review — `spec/2-navigation/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

실제 diff: `spec/2-navigation/4-integration.md` 1개 파일만 변경. 전체 디렉터리 파일은 컨텍스트로 포함됨.

---

## 발견사항

### [INFO] `14-execution-history.md` — Rationale 섹션 없음 (3섹션 권장 미이행)
- target 위치: `spec/2-navigation/14-execution-history.md` 전체 — `## 7. 라우팅` 이후 문서 끝
- 위반 규약: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — "Overview / 본문 / Rationale" 3섹션 권장; CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: 이 파일은 `status: implemented` 이며 복잡한 비즈니스 규칙(Trigger 출처 분류, Preview 탭 분기, Re-run chain 모델 등)을 정의함에도 `## Rationale` 섹션이 없다. `## Overview (제품 정의)` 섹션은 존재하나 Rationale 는 누락. 동 디렉터리 내 `0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md` 등은 Rationale 를 보유하고 있어 형식 불일치가 두드러짐.
- 제안: 문서 끝에 `## Rationale` 섹션을 추가하고 Trigger 출처 분류 5종 결정 배경, Preview 탭 기본 선택 로직 등 결정 근거를 기재한다. 권장 사항이므로 강제 위반은 아님.

### [INFO] `0-dashboard.md` — `## 1. 개요` 로 시작, `## Overview` 섹션 없음
- target 위치: `spec/2-navigation/0-dashboard.md` 전체
- 위반 규약: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — 단일 파일 spec 은 `## Overview (제품 정의)` 섹션으로 개요를 표현
- 상세: `14-execution-history.md` 는 `## Overview (제품 정의)` 를 명시적으로 갖고 있으나 `0-dashboard.md` 는 `## 1. 개요` 로 시작한다. 내용적으로는 같은 역할이지만 컨벤션에서 정의한 표준 헤딩(`## Overview (제품 정의)`) 을 따르지 않아 형식 불일치가 있다. 이미 `Rationale` 은 갖추고 있어 3섹션 구조의 나머지 부분은 충족됨.
- 제안: `## 1. 개요` 를 `## Overview (제품 정의)` 로 변경하고 아래 번호 섹션들과 구분한다. 혹은 "1. 개요"를 Overview 내 소절로 유지하는 현 패턴을 수용하도록 컨벤션이 갱신되어야 함.

### [INFO] `spec/2-navigation/4-integration.md` diff — Rationale 설명 문구 변경이 내부 일관성은 유지함
- target 위치: `spec/2-navigation/4-integration.md` § `api_label` / `api_method` / `api_path` 필드 표, Rationale "왜 catalog endpoint 를 신설했나" / "왜 초기엔 cafe24 만 응답하나"
- 위반 규약: 없음
- 상세: 이번 diff 는 makeshop 의 `api_label` catalog key 지원을 제거하는 spec 범위 축소다. 변경된 텍스트는 내부적으로 일관된다 ("나머지 3종은 NULL", "cafe24 만 catalog 라벨", "cafe24 만 응답"). 에러 코드 명명, 출력 포맷, 문서 구조 규약과의 충돌 없음. `id: integration`, `status: implemented` 로 frontmatter 충족. `code:` 경로도 glob 포함으로 유지.
- 제안: 해당 없음.

---

## 요약

`spec/2-navigation/` 디렉터리는 전반적으로 정식 규약을 잘 따르고 있다. 이번 diff(`4-integration.md`)는 makeshop `api_label` catalog key 지원 제거로, 명명·출력포맷·에러코드·API 문서 규약 모두 위반 없이 내부 일관성을 유지한다. 두 건의 INFO 는 diff 와 무관한 기존 파일에서 발견된 문서 구조 권장 사항 미이행으로, `14-execution-history.md` 의 `## Rationale` 누락과 `0-dashboard.md` 의 `## Overview` 헤딩 비표준 표기가 해당된다. 두 건 모두 컨벤션상 "권장" 수준으로, 다른 시스템이 가정한 invariant 를 깨지 않는다.

---

## 위험도

NONE
