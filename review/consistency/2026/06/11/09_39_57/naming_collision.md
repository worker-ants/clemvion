# 신규 식별자 충돌 검토 결과

대상 문서: `spec/2-navigation/14-execution-history.md`

---

## 발견사항

### 요구사항 ID

- **[INFO]** EH-LIST-*, EH-DETAIL-*, EH-NAV-* 식별자 체계 — 신규 도입, 충돌 없음
  - target 신규 식별자: `EH-LIST-01~08`, `EH-DETAIL-01~11`, `EH-NAV-01~04`
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` 및 `spec/conventions/conversation-thread.md`, `spec/conventions/data-hydration-surfaces.md` 에서 `EH-DETAIL-06` 을 cross-reference 로만 사용. 다른 어떤 spec 파일도 `EH-` prefix 의 ID를 독립적으로 정의하지 않는다.
  - 상세: cross-reference 가 이미 존재하는 것은 target 문서가 기존에 구현됐고 다른 spec이 이를 참조하고 있음을 의미한다. ID 자체가 다른 의미로 정의된 곳은 없다.
  - 제안: 충돌 없음. 기존 cross-reference와 정합.

---

### 엔티티·타입명

- **[WARNING]** `triggerSource` DTO 필드명 — 내부 마커 `__triggerSource` 와 네임스페이스 혼동 가능성
  - target 신규 식별자: `triggerSource` (ExecutionDto 응답 필드, enum: `subworkflow`/`manual`/`schedule`/`webhook`/`unknown`)
  - 기존 사용처: `spec/4-nodes/7-trigger/0-common.md:34, 75, 81`, `spec/4-nodes/7-trigger/1-manual-trigger.md:65, 77, 80, 81, 115`, `spec/data-flow/10-triggers.md:49, 54, 90, 120, 157` 에서 `__triggerSource` 가 엔진 내부 마커로 사용된다. `spec/5-system/13-replay-rerun.md:454` 에서 `triggerSource` 를 target spec 의 정의로 역참조한다.
  - 상세: `__triggerSource`('manual'|'webhook'|'schedule' 3종 enum, 내부 마커)와 target 이 정의하는 `triggerSource`(5종 enum `subworkflow`/`manual`/`schedule`/`webhook`/`unknown`, 응답 DTO) 는 이름이 유사하고 값 집합이 부분 중복한다. 이미 `spec/5-system/13-replay-rerun.md` 가 `triggerSource` 를 target spec 으로 참조하고 있어 실제 충돌은 없지만, 두 식별자가 다른 계층·의미임을 명시하지 않으면 구현자가 `__triggerSource` 3종으로 충분하다고 오해할 수 있다.
  - 제안: target 문서 §2.4 또는 Rationale(R-2)에 "내부 엔진 마커 `__triggerSource`(3종)와 별개 — 응답 DTO `triggerSource`는 `parent_execution_id` 판정을 포함한 5종 정규화 결과" 임을 한 줄 명시 권장.

- **[INFO]** `triggerLabel` DTO 필드 — 신규, 충돌 없음
  - target 신규 식별자: `triggerLabel` (ExecutionDto, 보조 라벨 string|null)
  - 기존 사용처: 없음. 다른 spec 파일에 `triggerLabel` 정의 없음.
  - 상세: 충돌 없음.

- **[INFO]** frontmatter `id: execution-history` — 신규, 충돌 없음
  - target 신규 식별자: `execution-history` (spec frontmatter id)
  - 기존 사용처: `spec/2-navigation/` 내 다른 파일들의 frontmatter id — `dashboard`, `workflow-list`, `schedule`, `integration`, `knowledge-base`, `config`, `statistics`, `marketplace`, `user-profile`, `auth-flow`, `error-empty-states`, `user-guide`, `system-status`, `nav-agent-memory`, `trigger-list`, `layout`. `execution-history` 는 중복 없음.
  - 상세: 충돌 없음.

---

### API Endpoint

- **[INFO]** `GET /api/executions/workflow/:workflowId`, `GET /api/executions/:id`, `POST /api/executions/:executionId/re-run`, `GET /api/executions/:executionId/chain` — 기존 spec 참조와 일치
  - target 신규 식별자: 위 4개 endpoint
  - 기존 사용처:
    - `GET /api/executions/workflow/:workflowId` — `spec/3-workflow-editor/3-execution.md:704` 에서 이미 언급됨. `spec/5-system/2-api-convention.md:227` 에서 offset 기반 페이지네이션 패턴으로 참조됨.
    - `GET /api/executions/:id` — `spec/5-system/14-external-interaction-api.md:962` 에서 충돌 회피 분리 논의 내 언급됨.
    - `POST /api/executions/:executionId/re-run` — `spec/5-system/13-replay-rerun.md §8.1` 이 SoT. target 이 인용만 함.
    - `GET /api/executions/:executionId/chain` — `spec/5-system/13-replay-rerun.md §8.2` 이 SoT. target 이 인용만 함.
  - 상세: 모두 기존 정의와 일치하거나 기존 SoT 를 인용하는 형태. 새로 독립 정의하는 endpoint 없음.
  - 제안: 충돌 없음.

---

### 이벤트·메시지명

- **[INFO]** target 문서가 새로 도입하는 webhook·queue·SSE 이벤트명 없음 — 해당 없음.

---

### 환경변수·설정키

- **[INFO]** target 문서가 새로 도입하는 ENV var 또는 config key 없음 — 해당 없음.

---

### 파일 경로

- **[INFO]** `spec/2-navigation/14-execution-history.md` 파일 경로 — 기존 컨벤션 준수
  - target 신규 식별자: 파일 경로 `spec/2-navigation/14-execution-history.md`
  - 기존 사용처: `spec/0-overview.md:341`, `spec/2-navigation/_product-overview.md:5`, `spec/2-navigation/0-dashboard.md:13`, `spec/5-system/13-replay-rerun.md:524` 등 다수 spec 파일에서 이미 이 경로로 참조됨.
  - 상세: 파일이 이미 존재하며, 다른 spec 파일들이 이 경로로 참조하고 있어 충돌 없음. `N-name.md` 패턴(정수 prefix + kebab-case) 준수.

---

## 요약

`spec/2-navigation/14-execution-history.md` 가 도입하는 신규 식별자 가운데 다른 도메인에서 다른 의미로 이미 사용 중인 것은 없다. 유일하게 주목할 점은 `triggerSource` DTO 필드명이 엔진 내부 마커 `__triggerSource` 와 이름이 유사하면서 enum 값 집합이 부분 중복(manual/webhook/schedule)한다는 것으로, 실제 코드 혼란 가능성이 있어 WARNING 으로 분류했다. 나머지 요구사항 ID(`EH-*`), 파일 경로, API endpoint 는 기존 정의와 일치하거나 이미 다른 spec 에서 이 문서를 SoT 로 cross-reference 하고 있어 충돌이 없다.

---

## 위험도

LOW
