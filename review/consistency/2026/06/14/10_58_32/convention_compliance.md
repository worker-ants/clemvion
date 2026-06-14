# 정식 규약 준수 검토 결과

**Target**: `spec/5-system/4-execution-engine.md`
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] 섹션 번호 순서 오류 — §1.3 이 §1.2 보다 먼저 등장

- **target 위치**: 문서 본문 §1 내 섹션 배치 순서. `### 1.1 Execution 상태` (L26) → `### 1.3 블로킹/재개 컨트랙트` (L80) → `### 1.2 NodeExecution 상태` (L153) 순으로 배치됨.
- **위반 규약**: CLAUDE.md "정보 저장 위치" — 기술 명세는 `spec/<영역>/*.md` 본문에 둔다는 원칙 내 문서 구조 일관성. 번호 체계는 독자 탐색과 cross-reference(`§1.2`, `§1.3` 링크)의 정합성 전제이며, `spec/conventions/` 전반의 섹션 참조 패턴은 번호 순서 = 읽기 순서로 암묵 약속한다.
- **상세**: §1.3("블로킹/재개 컨트랙트")은 §1.2("NodeExecution 상태")보다 앞에 배치돼 있어, 번호와 읽기 순서가 역전됐다. 동일 문제가 §3에도 반복된다: `### 3.0` (L251) → `### 3.1` (L261) → `### 3.2` (L278) → `### 3.4` (L305) → `### 3.3` (L336) 순으로, §3.3 Background 실행이 §3.4 중첩 컨테이너 스코프보다 늦게 등장한다. 독자가 §3.4를 읽을 때 §3.3이 아직 정의되지 않은 상태이며, cross-spec 링크(`§3.3 참조` 식)도 번호로 위치를 암시하는 경우 혼선이 생긴다.
- **제안**: §1에서 §1.3과 §1.2의 위치를 교환해 `1.1 → 1.2 → 1.3` 순서로 정렬한다. §3에서 §3.3 Background 실행을 §3.4 앞으로 이동해 `3.0 → 3.1 → 3.2 → 3.3 → 3.4` 순서로 정렬한다. 번호 재부여 없이 물리적 이동만으로 해결된다.

---

### [WARNING] `## Overview` 섹션 부재 — 문서 3섹션 구성 미준수

- **target 위치**: 문서 전체 구조. `# Spec: 실행 엔진 상세` 표제 직후 곧바로 `---`(구분선)과 `## 1. 실행 상태 머신`으로 진입한다. `## Overview` 섹션이 없다.
- **위반 규약**: CLAUDE.md "정보 저장 위치" 표의 "제품 정의·요구사항" 항목 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`. 또한 CLAUDE.md의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 사항. `spec/conventions/` 내 구현된 규약 문서(예: `error-codes.md`, `node-output.md`, `execution-context.md`, `spec-impl-evidence.md`)는 모두 `## Overview` 섹션을 두어 문서 목적·책임 경계·관련 SoT를 요약한다.
- **상세**: 본 문서는 `## Rationale`(L1201)은 갖추고 있으나 Overview가 없다. 문서의 목적·범위·관련 문서와의 책임 경계가 서두 없이 본문으로 직입해 신규 독자의 진입점이 불명확하다. 관련 문서 링크(`> 관련 문서: ...`)는 있으나 이는 Overview가 아니라 단순 교차 참조다.
- **제안**: 본문 `## 1.` 앞에 `## Overview` 섹션을 추가해 (1) 본 문서가 다루는 범위(실행 상태 머신·그래프 순회·장애 복구 등 목차 요약), (2) 관련 SoT와의 책임 경계(`3-error-handling.md`·`node-output.md`·`execution-context.md`), (3) 구현 상태 요약(`status: partial` 이유)을 기술한다. 단, `spec/5-system/` 하위 다른 파일들도 유사하게 Overview를 갖추지 않은 경우가 있다면, 본 규약 자체를 "권장"에서 "의무"로 상향하는 것이 규약 갱신의 적절한 대안이 될 수 있다.

---

### [INFO] `NodeHandlerOutput.status` 타입 선언이 `string`으로 과도하게 느슨함

- **target 위치**: §5.1 `NodeHandler` 인터페이스 코드 블록 (L494-496): `status?: string;` (JSDoc 주석: `'waiting_for_input' | 'requires_integration' | 'requires_playwright' 등`).
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 — `status` 필드의 의미("흐름 제어 상태 `waiting_for_input`, `resumed`, `ended` 등")와 §1.3(본 문서)에서 열거한 확정 enum 값(`waiting_for_input` / `resumed` / `ended` / `requires_integration` / `requires_playwright` / `undefined`)의 완전한 집합.
- **상세**: 코드 스니펫의 `status?: string` 타입 선언은 런타임 계약을 나타내기 위한 예시이지만, JSDoc 주석에서 '등'으로 얼버무려 폐쇄 enum이 실제로 열린 집합인 것처럼 보인다. spec 문서 §1.3에 명시된 값들은 사실상 닫힌 집합이며, `node-output.md` Principle 0의 주석도 동일 열거값을 예시로만 나열한다. 이것은 구현 관련 정밀도 문제이고 기능적 규약 위반은 아니나, spec이 규약 문서로서의 정확성을 갖추려면 알려진 enum 값 전체를 명시적으로 열거해야 한다.
- **제안**: JSDoc 주석을 `'waiting_for_input' | 'resumed' | 'ended' | 'requires_integration' | 'requires_playwright'` 로 완전 열거하거나, 타입 선언을 `status?: NodeHandlerStatus` 별칭 형태로 문서화해 "§1.3의 닫힌 enum" 임을 명시한다.

---

### [INFO] `interaction.data` payload 규격 표와 `node-output.md §4.5` 규약 간 미묘한 불일치

- **target 위치**: §1.3 `interaction.data` payload 규격 표 (L164-170), `form_submitted` 행의 `data` 형태가 `{ [fieldName]: value }` 로만 기재됨.
- **위반 규약**: `spec/conventions/node-output.md §4.5` — `form_submitted`의 `data` shape 정의: `{ [fieldName]: value, via?: 'ai_render' }` (제출된 필드 값, `via: 'ai_render'` sentinel 포함).
- **상세**: 본 문서 §1.3 표에서 `form_submitted`의 `data` 형태는 `{ [fieldName]: value }` 로만 기재되어 있고 `via?: 'ai_render'` sentinel 필드가 누락됐다. `node-output.md §4.5`에는 이 선택 필드("AI Agent의 `render_form` 도구 응답일 때만")가 명시돼 있다.
- **제안**: `spec/5-system/4-execution-engine.md` §1.3 표의 `form_submitted` 행의 `data` 열을 `node-output.md §4.5`와 동기화해 `{ [fieldName]: value, via?: 'ai_render' }` 로 갱신한다. 단, 본 표가 요약본으로 의도됐다면 "상세: node-output §4.5 참조" 주석으로 의도를 명시하면 충분하다.

---

### [INFO] 에러 코드 `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의 후 `error-codes.md §3` 미등재

- **target 위치**: §7.1 표 "attempts 소진 (terminal)" 행 및 §9.2 키 정의 표 (L806): `error.code='WORKER_HEARTBEAT_TIMEOUT'` (기존 코드 **유지·의미 재정의**: "절대 30분 stale" → "stalled 재배달 소진").
- **위반 규약**: `spec/conventions/error-codes.md §1` — "에러 코드 이름은 조건의 의미(무엇이 잘못되었는가)를 기술한다." 및 §3 — "원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다."
- **상세**: §7.1은 `WORKER_HEARTBEAT_TIMEOUT`의 의미를 "절대 30분 stale 기반 판정"에서 "BullMQ stalled-job 재배달 attempts 소진"으로 재정의했음을 문서화하고 있다. §7.1은 또한 "별도 heartbeat 채널을 신설하지 않는다"고 명시한다. 따라서 현재 코드명의 `HEARTBEAT` 토큰은 더 이상 실제 의미를 반영하지 않는다. `error-codes.md §2`에 따라 rename은 breaking change이므로 유지해야 하지만, `§3 Historical-artifact 예외 레지스트리`에 등재되어야 한다. 현재 `error-codes.md §3`에 이 코드가 없다.
- **제안**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`에 `WORKER_HEARTBEAT_TIMEOUT`을 등록하여 "이름이 부정확한 이유(heartbeat 인프라 제거), 진실(stalled 재배달 소진), 근거(4-execution-engine.md §7.1 의미 재정의)"를 명시한다.

---

## 요약

`spec/5-system/4-execution-engine.md`는 frontmatter(`id`, `status`, `code`, `pending_plans`)와 `## Rationale` 섹션을 갖추고 있어 기본 구조 요건을 대체로 준수한다. 에러 코드는 `UPPER_SNAKE_CASE`를 따르며, `NodeHandlerOutput` 5필드 원칙·interaction.type enum·`_resumeState`/`_resumeCheckpoint`/`_retryState` 보존 예외 등 `node-output.md` 규약 참조가 적절히 이루어져 있다. 그러나 섹션 번호 순서 역전(§1.3이 §1.2 앞, §3.3이 §3.4 뒤)과 `## Overview` 섹션 부재는 문서 구조 규약 대비 개선이 권장되는 WARNING 수준 사항이다. `WORKER_HEARTBEAT_TIMEOUT` 코드는 의미가 재정의됐으나 `error-codes.md §3` 예외 레지스트리에 미등재 상태여서 추가가 필요하다. 전체적으로 기능적 규약 파괴는 없고 형식·일관성 수준의 개선 사항들이다.

## 위험도

LOW
