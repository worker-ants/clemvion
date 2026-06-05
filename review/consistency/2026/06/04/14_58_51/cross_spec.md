# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-update-pr2a-timeout.md`
**검토일**: 2026-06-04

---

## 발견사항

### [CRITICAL] `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` — 에러 코드 이중 정의 위험

- **target 위치**: draft §제안 변경 1 (execution-engine.md §8 After) — "누적 active-running 시간 초과 → `EXECUTION_TIME_LIMIT_EXCEEDED` 에러"
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md §1.4` line 59: `EXECUTION_TIMEOUT` 이 "워크플로우 또는 노드 실행 타임아웃" 으로 등재되어 있는 엔진 수준 에러 코드의 단일 진실(SoT).
  - `spec/5-system/14-external-interaction-api.md` line 532: `execution.failed` 페이로드 `error.code` 예시에 `EXECUTION_TIMEOUT` 이 명시되어 있고, 정본은 `3-error-handling.md §엔진 수준 에러` 를 가리키는 주석이 있음.
  - `spec/conventions/chat-channel-adapter.md` line 387: `EXECUTION_TIMEOUT (engine)` 이 Chat Channel 어댑터 실패 분류 표에서 `executionFailedTimeout` 케이스로 등재.
  - `spec/4-nodes/5-data/2-code.md` line 246/286: Code 노드에서 `EXECUTION_TIMEOUT` 이 `CODE_TIMEOUT` 으로 대응되는 legacyCode 매핑.
  - `spec/1-data-model.md §2.13 Execution.error`: `EXECUTION_TIME_LIMIT_EXCEEDED` 가 엔진 인프라 에러 코드 중 하나로 이미 inline 열거되어 있음 (line 992).
- **상세**: draft 는 새 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신설해 EIA §6.4 에 추가하자고 제안하지만, `3-error-handling.md §1.4` 에는 기존 `EXECUTION_TIMEOUT` 이 동일 의미("워크플로우 실행 타임아웃")로 이미 등재되어 있다. 두 코드가 동시에 공식 카탈로그에 공존하면, Chat Channel 어댑터 분류 표·Code 노드 legacyCode 매핑·EIA 페이로드 예시가 서로 다른 코드를 참조하는 split-brain 상태가 된다. 단, `spec/1-data-model.md §2.13` 에서는 이미 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 엔진 인프라 에러로 열거되어 있어, 두 코드의 의미가 명시적으로 분리("Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT`과 의미가 달라 코드 분리 — §3-error-handling §1.4" 라는 설명이 draft 본문에 있음)된 상태이므로, 기존 `EXECUTION_TIMEOUT` 의 정의를 "노드 수준(Code 노드 스크립트) 타임아웃"으로 좁히고 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 "엔진 레벨 누적 active-running 타임아웃" 신규 코드로 `3-error-handling.md §1.4` 에 추가 등재하는 작업이 함께 수행되어야 한다. 이 갱신 없이 EIA §6.4 만 수정하면 3-error-handling 은 여전히 `EXECUTION_TIMEOUT` 만을 엔진 수준 에러로 열거한 채로 남아, 실제 구현 코드(`d4271ed9`)와 spec 이 모순된다.
- **제안**: draft 적용 시 `spec/5-system/3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신규 행으로 추가하고, `EXECUTION_TIMEOUT` 의 설명을 "Code 노드 스크립트 타임아웃(노드 수준)" 으로 좁혀야 한다. `spec/conventions/chat-channel-adapter.md` 분류 표도 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 `EXECUTION_TIMEOUT (engine)` 행과 분리하거나 통합해 갱신해야 한다.

---

### [WARNING] `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 — `execution-run` 행 형식이 기존 표 컬럼과 부분 불일치

- **target 위치**: draft §제안 변경 2, After (§4 표, 첫 행에 추가)
- **충돌 대상**: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 표 (line 166–181) — 기존 표 컬럼: `큐 이름 | 등록 모듈 | Producer | Consumer | 작업 단위`
- **상세**: draft 가 제안하는 `execution-run` 행은 5개 컬럼을 모두 채우고 있어 형식 자체는 맞다. 다만 `작업 단위` 컬럼에 기존 행들이 사용하지 않는 외부 링크(`[실행 엔진 §4](../5-system/4-execution-engine.md#4-실행-큐intake)`) 를 포함하고 있는데, 이는 기존 행들의 스타일과 다르지 않고 오히려 `execution-continuation` 행에도 링크가 있으므로 실제 불일치는 없다. 단, draft 가 제안하는 삽입 위치("첫 행에 추가")를 정렬 기준 없이 명세하고 있어 적용자가 어느 위치에 삽입해야 하는지 불명확하다. 기존 표는 특별한 정렬 기준 없이 기능 묶음 순서로 나열되므로, `background-execution` 바로 앞(intake 큐 → 재개 큐 순서)에 두는 것이 기존 맥락과 정합적이다. 이 점은 구현 충돌이 아닌 적용 명확성 이슈다.
- **제안**: draft 를 적용할 때 "첫 행" 대신 "`background-execution` 행 바로 앞" 으로 위치를 명확히 지정할 것을 권장한다.

---

### [WARNING] `spec/data-flow/0-overview.md §1.2 핵심 사실` Queue 인라인 목록도 갱신 필요

- **target 위치**: draft §제안 변경 2 After — `§4` 표와 `line 93` 인라인 텍스트 두 곳을 명시
- **충돌 대상**: `spec/0-overview.md §2.6 Data Layer` — Redis 설명에서 `execution-continuation` / `background-execution` 만 언급하고 `execution-run` 은 누락 (line 243: "BullMQ 큐 백엔드 (실행 태스크 / `execution-continuation` / `background-execution`)")
- **상세**: draft 는 `spec/data-flow/0-overview.md` §4 표와 §1.2 인라인 텍스트(line 93) 두 곳에 `execution-run` 을 추가하도록 제안하지만, `spec/0-overview.md §2.6` 의 Redis 큐 목록은 별개 문서이므로 draft 가 커버하지 않는 세 번째 누락처가 된다. 이 항목은 "실행 태스크" 라는 일반적 표현으로 intake 큐를 암시하고 있으나 큐 이름을 명시하지 않아 SPEC-DRIFT 관점에서는 INFO 수준이지만, 독자 입장에서 실제 큐 이름을 탐색해야 하는 경우 혼란을 줄 수 있다.
- **제안**: draft 와 함께 `spec/0-overview.md §2.6` 의 Redis 큐 목록 (`execution-continuation` 옆에 `execution-run` 추가, 또는 "실행 태스크" 설명을 `` `execution-run` (intake) `` 로 명시화)도 갱신하도록 범위를 확장한다.

---

### [INFO] `spec/5-system/4-execution-engine.md §9.3` BullMQ 큐 목록에도 `execution-run` 누락

- **target 위치**: draft 에서 다루지 않음
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.3 BullMQ 큐 목록` (line 980–999) — `execution-continuation` / `background-execution` 두 항목만 등재, `execution-run` 누락.
- **상세**: PR1(`impl-exec-intake-queue`) 로 도입된 `execution-run` 큐가 같은 §9.3 표에서 누락되어 있다. draft 는 `spec/data-flow/0-overview.md §4` 만 수정 대상으로 명시하고 실행 엔진 자체의 §9.3 은 범위 밖으로 두고 있다. 이 누락은 직접 모순은 아니지만 동일 도메인 내 두 카탈로그(`data-flow` 와 `execution-engine §9.3`)가 서로 다른 큐 목록을 보유하는 sync 문제다.
- **제안**: draft 적용 시 `spec/5-system/4-execution-engine.md §9.3` 에도 `execution-run` 행을 추가한다 (`execution-continuation` 행 위에 intake 큐로 추가). `data-flow/0-overview.md §4` 표에서 정의한 Producer/Consumer 와 동일한 내용을 간략 기재.

---

### [INFO] `spec/5-system/4-execution-engine.md §8` 기존 `EXECUTION_TIMEOUT` 코드 — 갱신 범위 불완전

- **target 위치**: draft §제안 변경 1 After — "누적 active-running 시간 초과 → `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 (엔진 레벨 누적 타임아웃 전용 신규 코드. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 의미가 달라 코드 분리 — §3-error-handling §1.4)"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §8` line 937 (현재): "최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러 → Execution.status = `failed`"
- **상세**: draft 의 After 안에서 §8 "제한 초과 시 동작" 항목을 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 바꾸는 것은 맞지만, 현재 §8 표에 있는 `설명` 열("active-running 누적 시간 기준")은 이미 올바른 내용을 담고 있다. 충돌이라기보다 draft 가 기술하는 §8 Before/After 텍스트가 현행 spec 파일의 실제 내용(`aspirational` → draft 가 `목표 정책(aspirational)` 대신 `목표 정책(Planned)` 으로 기술)과 미묘하게 다르므로 적용자가 실제 라인을 직접 확인해야 한다. 이는 draft 자체의 정밀도 문제이며 모순은 아니다.
- **제안**: draft 적용 시 현행 spec 의 실제 텍스트(`aspirational` 표현 포함)와 대조해 Before 내용을 정확히 맞춰 diff 를 적용한다.

---

## 요약

Draft 의 핵심 위험은 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 EIA §6.4 에만 추가하고 에러 코드 SoT 인 `spec/5-system/3-error-handling.md §1.4` 및 `spec/conventions/chat-channel-adapter.md` 분류 표를 갱신하지 않는 경우 발생하는 split-brain 이다. 기존 `EXECUTION_TIMEOUT` 은 여전히 "엔진 수준 실행 타임아웃" 으로 §1.4 에 등재된 채로 남아, 두 코드가 동시에 별도 spec 에서 "엔진 레벨" 타임아웃을 가리키는 충돌이 생긴다. draft 가 `1-data-model.md §2.13` 에서 두 코드를 "Code 노드 스크립트 타임아웃 vs 엔진 누적 active-running" 으로 명시적으로 분리했다는 점은 올바른 방향이나, 그 분리를 `3-error-handling.md §1.4` 에 반영하는 것이 필수 수반 작업이다. 큐 카탈로그 누락(`execution-run`)은 `data-flow/0-overview.md §4`, `spec/5-system/4-execution-engine.md §9.3`, `spec/0-overview.md §2.6` 세 곳 모두 갱신 대상이며, draft 는 이 중 첫 번째만 커버하고 있다.

## 위험도

MEDIUM
