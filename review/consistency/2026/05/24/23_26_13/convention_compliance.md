# 정식 규약 준수 검토 — Spec Draft: Durable Continuation & Graceful Shutdown

**검토 대상**: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
**검토 모드**: spec draft (--spec)
**검토 일자**: 2026-05-24

---

## 발견사항

### [WARNING] plan frontmatter 의 `worktree` 값이 plan-lifecycle 스키마와 불일치

- **target 위치**: frontmatter 2행 — `worktree: workflow-resumable-execution`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  ```
  worktree: <task_name>-<slug>   # 이 plan 이 살아있는 worktree 디렉토리 이름
  ```
- **상세**: 규약은 worktree 값이 실제 worktree 디렉토리 이름 (`<task_name>-<slug>`) 과 일치해야 한다고 명시한다. 실제 worktree 디렉토리명은 `workflow-resumable-execution-6b105e` 이지만 frontmatter 에 기재된 값은 `workflow-resumable-execution` 으로 hex slug 가 누락됐다. `consistency-checker` 의 `plan_coherence` 가 worktree 충돌 검출에 이 값을 사용하므로 오탐이 발생할 수 있다.
- **제안**: `worktree: workflow-resumable-execution-6b105e` 로 수정.

---

### [WARNING] plan frontmatter 에 비표준 `status` 필드 사용

- **target 위치**: frontmatter 5행 — `status: draft (pre-consistency-check)`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- **상세**: plan-lifecycle 규약의 frontmatter 스키마는 `worktree`, `started`, `owner` 3개 필드만 정의한다. `status` 는 plan 문서에 대한 정식 frontmatter 필드가 아니다. 또한 이 값은 `spec/conventions/spec-impl-evidence.md §3` 의 `status` enum (`backlog` / `spec-only` / `partial` / `implemented` / `archived`) 과도 무관한 자유 문자열이다. plan 문서에서 draft 상태를 표현해야 한다면 본문의 h2 절이나 인라인 주석으로 처리하는 것이 규약에 부합한다.
- **제안**: frontmatter 에서 `status: draft (pre-consistency-check)` 행을 제거하고, 필요하다면 본문 첫 단락에 `> 상태: pre-consistency-check draft` 형태로 표기. 규약 자체에 plan draft 상태를 위한 필드 정의가 필요하다면 plan-lifecycle.md 갱신이 적절하다.

---

### [WARNING] `RESUME_QUEUED` 를 에러 코드 표에 "성공 변형"으로 혼용

- **target 위치**: `변경 2 — §2.1 §4.2 ack 의 에러 코드 추가` — 에러 코드 표 첫 행
  ```
  | `RESUME_QUEUED` | (성공 변형) Continuation 이 다른 인스턴스의 메모리에서 처리 불가능해 영속 큐로 enqueue 되었음. `resumed: true` 와 동행. ...
  ```
- **위반 규약**: `spec/5-system/6-websocket-protocol.md` 의 기존 ack 에러 코드 표 패턴. 기존 코드들(`INVALID_BUTTON_ID`, `INVALID_EXECUTION_STATE`, `RETRY_STATE_NOT_FOUND` 등)은 모두 실패 케이스를 나타낸다. `RESUME_QUEUED` 는 "성공 변형"으로 설명하면서도 에러 코드 표에 배치하여 에러 코드 표가 "성공 신호 코드" 까지 포함하는 혼합 표가 되었다.
- **상세**: WebSocket ack 의 `error` 객체는 실패 응답에만 실린다 (`resumed: false` 와 동행). `RESUME_QUEUED` 는 `resumed: true` 와 동행한다고 명시하여 성공 응답임에도 에러 코드 표에 배치됐다. 이는 기존 ack payload 스키마 (`resumed: boolean`, `error?: { code, message }`) 와 의미적으로 충돌한다. 클라이언트 구현자가 성공 ack 에 `error` 객체 유무를 체크하는 기존 패턴을 사용하면 혼란이 발생한다.
- **제안**: `RESUME_QUEUED` 를 에러 코드 표에서 분리하고, ack payload 에 별도 필드(`queued: boolean`)를 추가하는 방식으로 성공 변형을 표현. 또는 `execution.submit_form` 등의 ack payload 스키마에 `resumeStrategy: 'direct' | 'queued'` 필드를 추가해 구분하는 것이 기존 패턴과 일관된 방법이다. 현재 표현대로 에러 코드 표에 남길 경우 규약 자체를 "에러 코드 표는 실패 전용"에서 "상태 코드 표"로 갱신해야 한다.

---

### [INFO] `§2.1` 이 지칭하는 에러 코드 표의 대상 명령 목록이 `execution.retry_last_turn` 을 포함

- **target 위치**: `변경 2 — §2.1` — "공통 에러 코드 표에 행 1개씩 추가" 대상으로 `execution.retry_last_turn` 명시
- **위반 규약**: `spec/5-system/6-websocket-protocol.md` 기존 `execution.retry_last_turn` 에러 코드 표
- **상세**: 기존 WebSocket spec 에 `execution.retry_last_turn` 에는 이미 `RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY` 라는 전용 에러 코드 표가 존재한다. `RESUME_QUEUED`, `RESUME_CHECKPOINT_MISSING` 등을 `execution.retry_last_turn` 의 공통 표에도 추가하는 것은 의미적으로 부적합하다 — `retry_last_turn` 은 rehydration 경로를 타지 않고 새 NodeExecution row 를 spawn 하는 별도 경로이기 때문이다. 적용 범위 기술의 정밀도가 낮다.
- **제안**: 신규 에러 코드를 추가할 대상 명령 목록을 재검토하여 `execution.retry_last_turn` 을 제외하거나, `execution.retry_last_turn` 에 한해 어떤 코드가 추가되는지를 명시적으로 특정할 것.

---

### [INFO] Rationale 섹션에 기록된 결정이 plan draft 문서 본문에 직접 포함

- **target 위치**: `변경 1 — §1.8 변경: Rationale 섹션에 새 결정 기록` — Rationale 본문 전체가 plan draft 에 인라인 포함됨
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: Rationale 은 spec 문서(`spec/5-system/4-execution-engine.md`) 안에 귀속되는 정보이다. plan draft 는 "무엇을 어떻게 바꿀 것인가"를 기술하는 문서로, Rationale 내용의 draft 를 담는 것 자체는 자연스럽다. 단, 이 내용이 spec 에 반영되지 않은 채 plan 에만 존재하면 단일 진실 원칙에 어긋날 수 있다. 본 항목은 draft 의 특성상 주의 수준 INFO로 분류하며, spec 반영 시 plan 본문의 해당 내용은 삭제 또는 spec 참조로 교체하는 것이 바람직하다.
- **제안**: spec 에 반영 후 plan 의 `§1.8` 내용을 `spec/5-system/4-execution-engine.md#rationale` 링크로 대체할 것.

---

### [INFO] `plan/in-progress/workflow-resumable-execution.md` 파일이 참조되나 아직 미생성

- **target 위치**: `§1.8 Rationale` 의 `**Refs**` 및 `## 다음 단계` 3번 항목
  ```
  plan/in-progress/workflow-resumable-execution.md
  ```
- **위반 규약**: 직접 위반은 아니나 `spec/conventions/spec-impl-evidence.md §4` 의 `spec-pending-plan-existence.test.ts` 가드 정신 — `pending_plans:` 에 등록된 경로는 실존해야 한다.
- **상세**: 현재 해당 파일은 `plan/in-progress/` 에 존재하지 않는다. Rationale 의 `Refs` 에 미생성 plan 을 참조하는 것은 draft 단계에서 허용되나, spec 에 Rationale 이 반영되는 시점에 해당 plan 파일도 함께 생성되어야 한다.
- **제안**: `다음 단계 3번` 의 plan 파일 생성을 spec 반영 전 단계로 명시적으로 앞당길 것. spec 반영 후 Rationale 의 `Refs: plan/in-progress/workflow-resumable-execution.md` 가 실존 파일을 가리키도록 한다.

---

## 요약

target 문서는 정식 규약의 핵심 영역을 대체로 준수하고 있다. 에러 코드 명명은 `UPPER_SNAKE_CASE` 규약을 따르며, `spec/conventions/node-output.md §3.2` 의 에러 코드 패턴과 일관된다. 상태 enum 비확장 결정과 BullMQ 기반 idempotency key 설계도 기존 spec 과 정합하다. 주요 위반은 두 가지다. 첫째, plan frontmatter 의 `worktree` 값이 실제 worktree 디렉토리명 (`workflow-resumable-execution-6b105e`) 과 불일치하여 `plan_coherence` 검출 신뢰성에 영향을 준다. 둘째, `RESUME_QUEUED` 를 성공 변형임에도 에러 코드 표에 배치하여 기존 WebSocket ack 스키마의 `error` 객체 = 실패 전용 invariant 를 위반한다. 나머지 발견사항은 INFO 수준으로 채택을 차단할 수준이 아니다.

---

## 위험도

**LOW**

frontmatter worktree 불일치는 자동 가드 오탐을 유발할 수 있으나 human 검토로 보완 가능하다. `RESUME_QUEUED` 의 에러 코드 표 배치는 클라이언트 구현 시 혼란을 유발할 수 있는 WARNING 이나, spec 반영 전 단계(draft)이므로 수정 여지가 충분하다. 전체적으로 blocking CRITICAL 발견사항 없음.
