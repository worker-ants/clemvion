# 신규 식별자 충돌 검토 결과

**검토 범위**: `spec/4-nodes/` (구현 착수 전 --impl-prep)
**검토 일시**: 2026-05-23

---

## 발견사항

### 1. 요구사항 ID 충돌

**[INFO]** ND-AG-26 중복 선언 — 이미 두 파일에 존재, 내용 일치
- target 신규 식별자: `ND-AG-26` (`spec/4-nodes/_product-overview.md` §6.1)
- 기존 사용처: `spec/4-nodes/3-ai/_product-overview.md` §3.2
- 상세: target 의 plan 문서(`plan/in-progress/ai-presentation-tools.md`)가 ND-AG-26 을 양쪽에 추가하도록 명시하고 있으며, 실제 두 파일 모두 동일 내용으로 등록되어 있다. 내용이 일치하므로 의미 충돌은 없다. 다만 `_product-overview.md` 에 ID 가 두 곳에 분산된 구조 자체는 의도된 설계임을 확인.
- 제안: ID 는 단일 파일(`spec/4-nodes/_product-overview.md`)에만 두고 AI 전용 파일은 cross-ref 로만 참조하는 방식을 장기적으로 검토.

---

### 2. 엔티티/타입명 충돌

**[INFO]** `INVALID_LIMIT` 에러 코드 — 다른 컨텍스트에서 동일 코드 사용 중
- target 신규 식별자: `INVALID_LIMIT` (Background 노드 모니터링 API `§8.7`)
- 기존 사용처: `codebase/backend/src/modules/knowledge-base/graph.controller.ts:266` — KB Graph 시각화 엔드포인트가 `limit` 범위 위반 시 `code: 'INVALID_LIMIT'` 을 이미 반환
- 상세: 두 사용처 모두 `limit` 파라미터 범위 위반에 대한 400 에러 코드로 의미가 동일하다. 하지만 api-convention 상 에러 코드 레지스트리가 없어 두 곳이 독립적으로 동일 문자열을 사용 중이다. 충돌이 아닌 우연한 일치이며, 실제로는 같은 의미이기 때문에 의미 혼선은 없다.
- 제안: `INVALID_LIMIT` 을 공통 에러 코드로 공식화하거나, Background API 에서는 `BACKGROUND_INVALID_LIMIT` 처럼 namespace 구분을 고려할 수 있으나 현재 구조상 강제 변경은 불필요.

**[INFO]** `dynamicPorts.kind` 값 `'parallel-branches'` — 기존 DynamicPortsSpec 종류와의 관계
- target 신규 식별자: `dynamicPorts.kind = 'parallel-branches'` (`spec/4-nodes/1-logic/10-parallel.md §3.2`)
- 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md:978` — `DynamicPortsSpec` 6종 목록에 `parallel-branches` 이미 포함
- 상세: target 이 도입한 것이 아니라 이미 기존 스펙에 정의된 값이 target 에서 참조되는 구조. 충돌 없음. 일관성 확인됨.
- 제안: 없음.

---

### 3. API endpoint 충돌

**[INFO]** `GET /api/executions/:executionId/background-runs/:backgroundRunId` — 신규 중첩 경로 추가
- target 신규 식별자: `GET /api/executions/:executionId/background-runs/:backgroundRunId` (`spec/4-nodes/1-logic/12-background.md §8.1`)
- 기존 사용처: `spec/3-workflow-editor/3-execution.md:643-645` — 클라이언트 참조만 있고 실제 endpoint 정의는 이곳이 유일
- 상세: 기존 `/api/executions/:id` 계열에 하위 리소스로 신설. 기존 엔드포인트(`GET /api/executions/:id`, `POST /api/executions/:id/stop`, `POST /api/executions/:id/re-run`, `GET /api/executions/:id/chain`)와 path segment 충돌 없음.
- 제안: 없음.

---

### 4. 이벤트/메시지명 충돌

**[INFO]** `execution.background_run.started` / `execution.background_run.completed` — WS spec 에 미등록
- target 신규 식별자: 이벤트 `execution.background_run.started`, `execution.background_run.completed` (`spec/4-nodes/1-logic/12-background.md §8.5`)
- 기존 사용처: `spec/3-workflow-editor/3-execution.md:645` 에서 클라이언트가 이 이벤트를 구독한다고 서술되어 있고, `spec/5-system/6-websocket-protocol.md` 의 이벤트 표(§4.3)에는 해당 이벤트가 **등록되어 있지 않다**.
- 상세: WS 프로토콜 스펙 이벤트 목록(§4.3)에 `execution.background_run.*` 이 누락되어 있다. 이름 충돌은 없지만, 공식 이벤트 카탈로그와 불일치가 있어 구현 시 혼선 위험이 있다. Background 노드 스펙은 별도 채널(`background:run:<id>`)을 사용한다고 명시하지만 WS 스펙에는 이 채널 정의 자체가 없다.
- 제안: `spec/5-system/6-websocket-protocol.md` §4.3 이벤트 표에 `execution.background_run.started` / `execution.background_run.completed` 를 추가하고, 채널 `background:run:<backgroundRunId>` 를 공식 채널로 문서화. 구현 전 WS 스펙 갱신 권장.

**[INFO]** `background:run:<backgroundRunId>` 채널 — WS 스펙 미등록
- target 신규 식별자: 채널 `background:run:<backgroundRunId>` (`spec/4-nodes/1-logic/12-background.md §8.5`)
- 기존 사용처: `spec/5-system/6-websocket-protocol.md` 는 `execution:<id>` 채널 패턴만 정의하며 `background:run:*` 채널은 정의되어 있지 않다.
- 상세: 이름 충돌은 없다. 다만 프로토콜 스펙 비대칭이 구현 혼선의 원인이 될 수 있다.
- 제안: WS spec §채널 섹션에 `background:run:<backgroundRunId>` 채널 추가 및 구독 방법 명시.

---

### 5. 환경변수·설정키 충돌

**[INFO]** `PARALLEL_ENGINE` 환경변수 — 기존 overview 참조와 target spec 이 일관되게 사용
- target 신규 식별자: `PARALLEL_ENGINE=v1` 환경변수 (`spec/4-nodes/1-logic/10-parallel.md §1 비고`)
- 기존 사용처: `spec/0-overview.md:89`, `spec/4-nodes/_product-overview.md:135` — 동일 변수명으로 이미 정의됨
- 상세: 충돌 없음. 동일 환경변수를 동일 의미로 사용.
- 제안: 없음.

---

### 6. 파일 경로 충돌

충돌 없음. `spec/4-nodes/` 내 모든 파일은 기존 명명 컨벤션(`<number>-<kebab-name>.md`, `0-common.md`, `_product-overview.md`)을 준수한다. 신규 파일 생성 없이 기존 파일을 갱신하는 구조.

---

### 7. 기타 관찰 사항

**[INFO]** `requiredWhen` DSL `notEquals` 형태 — 스펙-코드 불일치 위험 (스위치 노드)
- target 신규 식별자: `ui.requiredWhen: { field, equals: T | readonly T[] }` 단일 shape 정준화 (`spec/4-nodes/1-logic/2-switch.md §8`)
- 기존 사용처: `codebase/frontend/src/lib/node-definitions/types.ts:58` — `visibleWhen` 은 아직 `notEquals` 형태를 유지함. `requiredWhen` 은 이미 `equals` 단일 shape 으로 정비됨.
- 상세: target spec 은 `requiredWhen` 의 `notEquals` 형태를 폐기했다고 명시하고, 코드도 `requiredWhen` 에서는 이미 `equals` 단일 shape 으로 정비되어 있다. `visibleWhen` 은 한시적으로 `notEquals` 를 유지하고 있어 스펙이 이 점을 명시하고 있다. 충돌 없음.
- 제안: 없음.

**[INFO]** `meta.backgroundRunId` 와 `meta.forkedAt` — 신규 필드로 기존 Background 관련 필드와 충돌 없음
- target 신규 식별자: `meta.backgroundRunId`, `meta.forkedAt`, `meta.jobId?` (`spec/4-nodes/1-logic/12-background.md §5.1`)
- 기존 사용처: 동일 파일 내 정의. 다른 노드의 `meta.*` 필드와 이름 중복 없음.
- 제안: 없음.

---

## 요약

`spec/4-nodes/` target 영역이 도입하는 신규 식별자들은 대부분 기존 사용처와 의미 충돌 없이 명확히 구분된다. `INVALID_LIMIT` 에러 코드가 KB 도메인과 동일 문자열을 사용 중이나 의미가 동일하여 실제 혼선 위험은 낮다. 가장 주의할 지점은 Background 노드가 정의하는 `background:run:<id>` WebSocket 채널과 `execution.background_run.*` 이벤트가 `spec/5-system/6-websocket-protocol.md` 공식 이벤트 카탈로그에 등록되지 않은 것으로, 구현 전 WS 스펙 갱신이 필요하다. CRITICAL 또는 WARNING 등급의 의미 충돌은 발견되지 않았다.

---

## 위험도

LOW
