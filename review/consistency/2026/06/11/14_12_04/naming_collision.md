# 신규 식별자 충돌 검토 — spec/2-navigation/14-execution-history.md

검토 일시: 2026-06-11
대상: `spec/2-navigation/14-execution-history.md`

---

## 발견사항

### 요구사항 ID 충돌

요구사항 ID 그룹 `EH-LIST`, `EH-DETAIL`, `EH-NAV` 를 전체 spec 에서 검색한 결과, 해당 ID들은 오직 `spec/2-navigation/14-execution-history.md` 에서만 사용된다. 다른 파일들은 `EH-DETAIL-06`, `EH-NAV-04` 등을 cross-reference 로만 인용하며, ID 의 의미를 재정의하거나 충돌하지 않는다.

→ 충돌 없음.

---

### 엔티티/타입명 충돌

#### `triggerSource` 필드명 — INFO

- target 신규 식별자: `ExecutionDto.triggerSource` (5종 enum: `subworkflow`/`manual`/`schedule`/`webhook`/`unknown`)
- 기존 사용처: `spec/4-nodes/7-trigger/0-common.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/data-flow/10-triggers.md` 의 `__triggerSource` (3종: `manual`/`webhook`/`schedule`) — 엔진 내부 마커
- 상세: target 문서 Rationale R-2 에서 이미 "응답 DTO 의 `triggerSource`(5종)는 엔진 내부 마커 `__triggerSource`(3종)와 **별개의 식별자**"임을 명시하고 있어 잠재적 혼동을 직접 해소하고 있다. 값 집합도 다르고(5종 vs 3종), 레이어도 다르다(API DTO vs 엔진 입력 페이로드). 그러나 이름이 유사해 코드 리뷰·구현 시 혼동 가능성이 존재한다.
- 제안: Rationale R-2 의 명시가 충분하므로 충돌 수준은 아니다. 구현 단계에서 TypeScript 타입명을 `TriggerSourceDto` 등으로 명확히 분리해 컴파일 타임 혼용을 방지하는 것을 권장한다.

---

### API Endpoint 충돌

#### `GET /api/executions/workflow/:workflowId` — INFO

- target 신규 식별자: 목록 API `GET /api/executions/workflow/:workflowId`
- 기존 사용처: `spec/5-system/2-api-convention.md` §8 에서 `GET /api/executions/workflow/:workflowId` 를 cursor 미적용(offset 기반) 예시로 언급함. `spec/3-workflow-editor/3-execution.md` §9 에서도 동일 경로 언급.
- 상세: 실제 충돌이 아니라 기존 cross-reference 가 이미 존재하는 확립된 endpoint. target 이 그것을 동일 의미로 정의하므로 충돌 없음.
- 제안: 해당 없음.

#### `POST /api/executions/:executionId/re-run` — INFO

- target 신규 식별자: EH-DETAIL-10에서 언급
- 기존 사용처: `spec/5-system/13-replay-rerun.md` §8.1 이 SoT로 정의되어 있음. target은 모달 명세를 해당 spec으로 위임하고 있어 정상적인 cross-reference.
- 상세: 충돌 없음.

#### `GET /api/executions/:executionId/chain` — INFO

- target 신규 식별자: EH-DETAIL-11에서 언급
- 기존 사용처: `spec/5-system/13-replay-rerun.md` §8.2, `spec/1-data-model.md` §3 인덱스 표
- 상세: 충돌 없음. target은 Spec Re-run으로 정의를 위임하고 있음.

---

### 이벤트/메시지명 충돌

해당 없음 — target은 webhook, queue, SSE 이벤트 이름을 신규 도입하지 않는다.

---

### 환경변수·설정키 충돌

해당 없음 — target은 신규 ENV var 또는 config key를 도입하지 않는다.

---

### 파일 경로 충돌

- target 파일: `spec/2-navigation/14-execution-history.md`
- 기존 파일 목록: `spec/2-navigation/` 내 기존 파일들은 `_layout.md`, `_product-overview.md`, `0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`, `4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `7-statistics.md`, `8-marketplace.md`, `9-user-profile.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md`
- 상세: 숫자 prefix `14` 가 기존 파일과 중복되지 않는다. `spec/0-overview.md` §8 문서 맵에도 `14-execution-history.md` 가 이미 등재되어 있어 파일명은 확립된 상태.
- 제안: 해당 없음.

---

### 기타 — `i18n 키 workflows.executionHistory`

- target 신규 식별자: `workflows.executionHistory` (Workflow List 컨텍스트 메뉴 항목)
- 기존 사용처: `codebase/frontend/src/app/(main)/workflows/page.tsx:527` 에서 `t("workflows.executionHistory")` 를 이미 사용 중. `spec/2-navigation/1-workflow-list.md` §2.6 에도 동일 라벨 언급.
- 상세: target §4.2 가 "i18n `workflows.executionHistory` (ko/en), [워크플로우 목록 §2.6](./1-workflow-list.md)과 동일 라벨"이라고 명시함. 이는 기존 식별자를 재사용·정렬한 것이며 충돌이 아니다.
- 제안: 해당 없음.

---

## 요약

target 문서 `spec/2-navigation/14-execution-history.md` 가 도입하는 식별자(`EH-LIST-*`, `EH-DETAIL-*`, `EH-NAV-*`, `triggerSource`/`triggerLabel` DTO 필드, 3개 API endpoint, `workflows.executionHistory` i18n 키) 중 기존 사용처와 실질적으로 충돌하는 항목은 발견되지 않았다. `triggerSource` 필드는 엔진 내부 마커 `__triggerSource`(3종)와 이름이 유사하나, target 문서 Rationale R-2 가 레이어·값 집합 차이를 명시적으로 설명하고 있어 충돌 수준에 해당하지 않는다. 나머지 cross-reference 항목들은 모두 기존 spec과 정렬된 재사용이며 독립 식별 가능하다. API endpoint 3건 모두 기존 spec에서 확립된 것이며 target은 적절한 SoT 위임을 수행하고 있다.

## 위험도

NONE
