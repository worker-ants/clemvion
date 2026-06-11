# 신규 식별자 충돌 검토 — spec/2-navigation/14-execution-history.md

## 발견사항

### 1. 요구사항 ID

- **[INFO]** EH-LIST / EH-DETAIL / EH-NAV prefix — 기존 사용처와 충돌 없음
  - target 신규 식별자: `EH-LIST-01~08`, `EH-DETAIL-01~11`, `EH-NAV-01~04`
  - 기존 사용처: `EH-DETAIL-06` 이 `/spec/conventions/conversation-thread.md:218`, `/spec/conventions/data-hydration-surfaces.md:72`, `/spec/4-nodes/3-ai/1-ai-agent.md:1142` 에서 참조된다. 이 참조들은 모두 **본 target 문서가 정의한 EH-DETAIL-06** 을 가리키는 외부 참조이며, 다른 맥락에서 동일 ID 를 별도 의미로 재정의한 것이 아니다.
  - 상세: 외부 참조가 먼저 존재하는 형태이지만, target 이 해당 ID 의 SoT 이므로 충돌이 아니라 일치다.
  - 제안: 없음.

### 2. `triggerSource` 식별자 — 내부 마커와 DTO 필드 명칭 중복 (잠재 혼동)

- **[WARNING]** `triggerSource` (DTO 필드 5-variant) vs `__triggerSource` (엔진 내부 마커 3-variant)
  - target 신규 식별자: `ExecutionDto.triggerSource` — `subworkflow | manual | schedule | webhook | unknown` 5종 enum
  - 기존 사용처:
    - `/spec/4-nodes/7-trigger/0-common.md:34` — `__triggerSource: 'manual' | 'webhook' | 'schedule'` 3종 내부 마커
    - `/spec/4-nodes/7-trigger/1-manual-trigger.md:65,77,80` — 동일 내부 마커 사용
    - `/spec/data-flow/10-triggers.md:49,54,90,120` — 동일 내부 마커
    - `/spec/data-flow/14-chat-channel.md:69` — 동일 내부 마커
  - 상세: target 문서의 Rationale §R-2 는 "응답 DTO 의 `triggerSource`(5종)는 엔진 내부 마커 `__triggerSource`(3종)와 **별개의 식별자**다" 고 명시하며 의미 차이를 설명하고 있다. 이름이 `__triggerSource` vs `triggerSource` 로 시각적 구분이 있고 레이어(엔진 내부 vs API 응답 DTO)가 다르다. 그러나 DTO 필드 이름이 내부 마커와 밑줄 2개 차이로만 다르고, 값 집합도 일부 겹치므로 (`manual`/`schedule`/`webhook`) 코드 리뷰나 문서 검색 시 혼동 가능성이 있다.
  - 제안: 현 명명을 유지하되 DTO 필드를 `displayTriggerSource` 나 `resolvedTriggerSource` 로 바꾸는 방안을 검토할 수 있다. 단, Rationale §R-2 가 이미 두 식별자의 차이를 명시적으로 해설하고 있으므로 현재 상태도 수용 가능하다.

### 3. `executionPath` 응답 필드 — 목록 API 샘플에 포함 (의미 일치 확인)

- **[INFO]** `executionPath` 필드가 목록 API 샘플 응답에 포함됨
  - target 신규 식별자: target §5 JSON 샘플의 `"executionPath": []`
  - 기존 사용처: `/spec/1-data-model.md:493,843` — `executionPath: string[]` 은 `findById` 가 `execution_node_log` 조회로 채우는 필드. 목록 응답에서는 N+1 회피를 위해 빈 배열 고정이라고 데이터 모델에 기술되어 있음.
  - 상세: target §R-1 에서 "§5 샘플의 `"executionPath": []` 는 이 고정 동작" 임을 명시하여 일치한다. 충돌 없음.
  - 제안: 없음.

### 4. API endpoint — 기존 정의와 중복 선언 (의미 일치)

- **[INFO]** 4개 endpoint 가 기존 spec 과 중복 선언됨 (의미 일치, 충돌 없음)
  - target 신규 식별자: `GET /api/executions/workflow/:workflowId`, `GET /api/executions/:id`, `POST /api/executions/:executionId/re-run`, `GET /api/executions/:executionId/chain`
  - 기존 사용처:
    - `GET /api/executions/workflow/:workflowId` — `/spec/3-workflow-editor/3-execution.md:320`, `/spec/5-system/2-api-convention.md:227`
    - `GET /api/executions/:id` — `/spec/3-workflow-editor/3-execution.md:321`
    - `POST /api/executions/:executionId/re-run` — `/spec/5-system/13-replay-rerun.md:198`
    - `GET /api/executions/:executionId/chain` — `/spec/5-system/13-replay-rerun.md:245`
  - 상세: target 문서는 "모든 API는 이미 구현되어 있으며, 추가 백엔드 작업은 불필요하다"고 명시하고 있고, re-run/chain endpoint 는 Spec Re-run §8.1/§8.2 를 SoT 로 위임하고 있다. 동일 경로가 다른 의미로 사용되는 충돌은 없다.
  - 제안: 없음.

### 5. 프론트엔드 도구명 `get_workflow_executions` / `get_execution_details` — 기존 정의와 일치

- **[INFO]** 두 AI Assistant 도구명이 기존 spec 에 이미 정의되어 있으며 의미가 일치함
  - target 신규 식별자: `get_workflow_executions`, `get_execution_details` (EH-NAV-04)
  - 기존 사용처: `/spec/3-workflow-editor/4-ai-assistant.md:206,207,551,711,712` — 동일 이름, 동일 의미로 상세 정의됨
  - 상세: target 은 이 도구들을 새로 정의하는 것이 아니라 기존 정의를 참조하는 형태다. 충돌 없음.
  - 제안: 없음.

### 6. 파일 경로 / frontmatter id

- **[INFO]** frontmatter `id: execution-history` 는 `spec/2-navigation/` 안에서 유일
  - target 신규 식별자: `id: execution-history` (frontmatter)
  - 기존 사용처: 동일 id 를 사용하는 다른 파일 없음 (전수 확인)
  - 상세: 파일 번호 `14-` 도 해당 폴더에서 유일. 충돌 없음.
  - 제안: 없음.

---

## 요약

`spec/2-navigation/14-execution-history.md` 가 도입하는 신규 식별자 중 실질적 충돌은 없다. 요구사항 ID(`EH-*`)는 기존 외부 참조들이 모두 본 문서를 가리키는 적법한 순방향 참조이고, API endpoint 4종과 AI Assistant 도구명 2종은 기존 spec 에 이미 정의된 식별자를 재확인·참조하는 형태로 의미가 일치한다. 주의할 점은 응답 DTO 필드 `triggerSource`(5-variant)와 엔진 내부 마커 `__triggerSource`(3-variant) 가 이름이 유사해 혼동 가능성이 있으나, 문서 Rationale §R-2 가 이를 명시적으로 구분·해설하고 있으므로 WARNING 수준으로 분류한다. 나머지 식별자(`executionPath`, frontmatter id, 파일 경로)는 모두 기존 컨벤션과 일치한다.

## 위험도

LOW
