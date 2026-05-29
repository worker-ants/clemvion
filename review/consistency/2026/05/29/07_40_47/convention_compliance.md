# Convention Compliance Review — spec-draft-mail-send-status.md

검토 모드: spec draft (--spec)
대상 파일: `plan/in-progress/spec-draft-mail-send-status.md`
검토 일시: 2026-05-29

---

## 발견사항

### 1. [CRITICAL] plan 문서 frontmatter 전면 누락

- **target 위치**: 파일 최상단 (라인 1)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- **상세**: `plan/in-progress/` 문서는 다음 frontmatter 를 반드시 포함해야 한다.
  ```yaml
  ---
  worktree: <task_name>-<slug>
  started: <ISO 날짜>
  owner: <역할/이름>
  ---
  ```
  본 파일에는 frontmatter 가 전혀 없다. 동일 카테고리의 인접 파일(`spec-draft-auth-config-webhook-wiring.md`)에는 세 필드 모두 올바르게 채워져 있어, 본 파일은 예외가 아닌 누락으로 판단된다. `worktree` 필드는 동시 작업 추적·충돌 검출(`consistency-checker`의 `plan_coherence` checker)에 직접 활용되는 invariant 이므로 비워두면 그 보장이 깨진다.
- **제안**: 파일 상단에 아래 frontmatter 를 추가한다.
  ```yaml
  ---
  worktree: fix-mail-send-status-59d3b3
  started: 2026-05-29
  owner: project-planner
  ---
  ```

---

### 2. [WARNING] 에러 코드 표기 `UPPER_SNAKE_CASE` 준수 — 확인 필요

- **target 위치**: 변경 1 본문 (`결과 코드` 단락) 및 변경 2
- **위반 규약**: `spec/conventions/node-output.md §3.2` — "`code` 는 `UPPER_SNAKE_CASE`"
- **상세**: draft 에 등장하는 신규 코드 `EMAIL_CONNECT_FAILED`, `EMAIL_HOST_BLOCKED`, `EMAIL_SEND_FAILED` 는 형식 자체는 모두 `UPPER_SNAKE_CASE` 로 규약을 만족한다. 다만 draft 가 실제 spec 에 반영될 때 `IntegrationTestResult.code` 라는 별개 타입 필드에 이 코드들이 배치되는지, `output.error.code` 에 배치되는지가 명시되지 않은 부분이 있다. 변경 2 에서는 send_email 노드의 경우 "error 포트로 출력 / 연결 테스트는 result.code 로 반환"으로 경로가 구분된다고 언급하고 있어, 두 경로 모두 `UPPER_SNAKE_CASE` 규약을 지키고 있음은 확인된다. 그러나 spec 본문에 실제로 반영될 때 두 경로 각각의 schema 정의(`output.error` vs `IntegrationTestResult`) 가 `node-output.md §3.2` 의 envelope `{code, message, details}` 를 명시적으로 따르는지 draft 내 증거가 부족하다. 특히 `IntegrationTestResult.code` 경로는 노드 output envelope 과 다른 타입이므로 spec 갱신 시 규약 적용 여부를 명기해야 한다.
- **제안**: 변경 1 또는 변경 2 에 "연결 테스트 결과(`IntegrationTestResult`)의 `code` 필드는 node-output §3.2 envelope 과 **별도 타입**이며, 에러 코드 값 자체는 동일 `UPPER_SNAKE_CASE` 를 따른다"는 한 줄 명기를 추가한다.

---

### 3. [WARNING] 문서 구조 — `## Overview` 섹션 부재

- **target 위치**: 파일 전체 구조
- **위반 규약**: CLAUDE.md 정보 저장 위치 표 — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"; 각 SKILL.md 참고 항목 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 및 각 SKILL.md 는 spec 문서(및 spec 변경 draft)에 Overview / 본문 / Rationale 3섹션 구성을 권장한다. 본 파일은 Rationale 섹션(`## Rationale (draft 자체)`)은 포함하고 있으나 `## Overview` 가 없다. 대신 파일 도입부에 한 줄 요약("구현 완료(브랜치 …)된 동작을 spec 본문에 반영. 신규 기획 아님.")만 존재한다. plan 파일은 spec 파일과 동일한 3섹션 구성 의무가 적용되는 것은 아니나, 이 파일은 `spec-draft-` 접두사를 사용해 spec 변경 draft 로 기능하므로 구조를 갖추는 것이 가독성과 일관성에 이롭다.
- **제안**: 도입부 한 줄 요약을 `## Overview` 섹션으로 승격하거나, plan 파일임을 명시해 spec 3섹션 요건이 여기에 적용되지 않음을 주석으로 표시한다. (규약을 갱신하기보다 문서 내 한 줄 명기로 충분.)

---

### 4. [INFO] side-effect 점검 결과 섹션 — 헤더 레벨 비일관성

- **target 위치**: `## side-effect 점검 결과` (라인 53)
- **위반 규약**: 명시적 규약 위반은 아니나 동일 파일 내 섹션 레벨 일관성
- **상세**: 파일의 다른 섹션 헤더는 `## 변경 N —` 패턴과 `## Rationale (draft 자체)` 로 구성돼 있다. `## side-effect 점검 결과` 만 소문자 시작 + 비표준 명칭이다. 같은 파일 내에서 헤더 명칭 규칙이 혼재한다.
- **제안**: `## Side-effect 점검 결과` 또는 `## 사이드이펙트 점검` 으로 소문자/한글 중 하나로 통일한다. 이는 형식 사항이며 내용에 영향 없음.

---

## 요약

`plan/in-progress/spec-draft-mail-send-status.md` 는 spec 변경 내용(에러 코드 교체·SSRF 가드 문서화·Rationale 추가) 자체는 `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규약, `chat-channel-adapter.md §3.1` 분류표 side-effect 검토 의무를 충실히 인식하고 있다. 그러나 `plan-lifecycle.md §4` 가 명시한 `worktree/started/owner` frontmatter 가 전혀 없어 동시 작업 추적·plan_coherence 가드가 작동할 수 없는 상태다. 이 항목은 인접 spec-draft 파일(`spec-draft-auth-config-webhook-wiring.md`)이 올바르게 준수하고 있는 규약을 본 파일만 누락한 것으로, 즉시 보완이 필요하다. 나머지 발견사항은 WARNING/INFO 수준이며 spec 반영 시 보완 가능하다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건은 plan 추적 인프라에만 영향; spec 내용 자체의 정합성을 깨지는 않음. 그러나 규약상 의무 필드 누락이므로 채택 전 보완 권장.)
