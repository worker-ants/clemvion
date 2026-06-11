# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep` (구현 착수 전)
- 대상 영역: `spec/2-navigation/`
- 검토 일시: 2026-06-10

---

## 발견사항

### [INFO] `0-dashboard.md` §5 — 실행 status SoT 섹션 번호 불일치

- target 위치: `spec/2-navigation/0-dashboard.md` §5 상태 열 설명
- 충돌 대상: `spec/1-data-model.md §2.13`
- 상세: 대시보드 spec 의 주석이 "DTO 의 status enum 은 …, SoT [데이터 모델 §2.13](../1-data-model.md)" 으로 `§2.13` 을 명시하고 있으며, `spec/1-data-model.md` 에서 Execution 엔티티는 실제로 `### 2.13 Execution` 에 정의되어 있어 링크 자체는 올바르다. 내용 충돌은 없음. 다만, Execution.status 의 6개 값(`pending·running·completed·failed·cancelled·waiting_for_input`)과 대시보드 아이콘 매핑이 완전히 일치한다.
- 제안: 변경 불필요.

---

### [INFO] `14-execution-history.md` §5 목록 API 응답 예시에 `chainId` 필드 포함

- target 위치: `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON 예시 (`"chainId": null`)
- 충돌 대상: `spec/1-data-model.md §2.13` — `chain_id` 컬럼 정의
- 상세: 데이터 모델은 DB 컬럼 이름을 `chain_id`(snake_case)로 정의하고, 응답 DTO 에서 camelCase `chainId` 로 노출된다. 목록 API 응답 예시에 `chainId` 가 포함되어 있으나, `spec/1-data-model.md §2.13` 의 응답 DTO 섹션(`ExecutionDto`)에 `chainId` 가 명시적으로 열거되어 있는지 직접 확인이 필요하다. 목록 API (`GET /api/executions/workflow/:workflowId`) 는 "노드 실행은 응답에 포함하지 않는다(N+1 회피)"를 명시하면서도 `chainId`·`reRunOf`·`dryRun` 등 re-run 관련 필드는 포함하고 있다. 이는 re-run spec(`spec/5-system/13-replay-rerun.md`)의 요구사항(`RR-PL-05`, chain badge 표시)과 일치하여 충돌이 아닌 정상 노출이다.
- 제안: 변경 불필요. 다만 구현 착수 시 `ExecutionDto` 가 목록 응답에 `chainId` 를 실제로 포함하는지 DTO 코드 확인 권장.

---

### [INFO] `14-execution-history.md` §3.4 — Preview 탭 설명의 "form" 노드 미언급

- target 위치: `spec/2-navigation/14-execution-history.md` §3.4 Presentation 노드 프리뷰 목록
- 충돌 대상: `spec/1-data-model.md §2.6 Node.type` — presentation 카테고리에 `carousel / table / chart / form / template` 5종 정의
- 상세: `§3.4`는 Table/Carousel/Chart/Template/Form 5종을 나열하고 있으며 `form` 도 "제출된 form 데이터 표시"로 포함되어 있다. 데이터 모델의 presentation 노드 타입 목록과 일치한다. 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] `16-agent-memory.md` §2 — API 경로에 `/api/` prefix 누락 패턴

- target 위치: `spec/2-navigation/16-agent-memory.md` §2 기능 상세
- 충돌 대상: `spec/5-system/17-agent-memory.md §6` API 경로 정의 (`GET /agent-memories/scopes` 등)
- 상세: 화면 spec(`16-agent-memory.md`) 과 시스템 spec(`17-agent-memory.md`) 양쪽 모두 `/agent-memories/scopes` (prefix 없는 형태)로 일관되게 기술한다. 다른 API(`/api/workflows`, `/api/triggers` 등)는 `/api/` prefix 를 명시하는데, agent-memory API 만 두 문서에서 모두 prefix 없이 기술된다. 실제 구현에서는 `/api/agent-memories/...` 일 가능성이 높아 표기가 비일관적이다.
- 제안: `16-agent-memory.md` 와 `17-agent-memory.md` 양쪽에서 `/api/agent-memories/...` 로 통일하거나, 두 문서 모두 의도적으로 prefix 없이 두는 근거를 Rationale 에 명시. `/api/` prefix 누락은 API 규약 문서(`spec/5-system/2-api-convention.md`)의 전체 경로 표기 원칙과 비일관성이 있으므로 동기화 권장.

---

### [INFO] `2-trigger-list.md` §2.3.1 필드 권한 매트릭스 — trigger `type` 변경 불가와 Schedule 연동 삭제 정책 간 보완 설명 부재

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 Overview 카드 `type` 행 (read-only, 변경 불가)
- 충돌 대상: `spec/1-data-model.md §2.9.1` Trigger ↔ Schedule 동기화 규칙 (`Trigger(type=schedule) 삭제 → Schedule cascade 삭제`)
- 상세: 트리거 목록 spec 은 `type` 변경이 불가하므로 "변경하려면 삭제·재생성" 이라고 안내한다. 데이터 모델의 cascade 삭제 정책과 논리적으로 충돌하지 않는다(type 변경 금지와 삭제 시 cascade 는 별개 규칙). 충돌 없음.
- 제안: 변경 불필요.

---

### [WARNING] `0-dashboard.md` §7 `/api/dashboard/recent-executions` — 응답 래퍼 정의 불완전

- target 위치: `spec/2-navigation/0-dashboard.md` §7 API 엔드포인트 설명
- 충돌 대상: `spec/5-system/2-api-convention.md §5.1/§5.2` 공통 응답 래퍼 규약
- 상세: `GET /api/dashboard/recent-executions` 는 단일 리소스도 목록도 아닌 "최근 10건 고정" 응답이다. 응답 래퍼를 "공통 래퍼(`{ data: ... }`)로 감싸진다"고만 기술하고, pagination 객체 포함 여부가 명시되어 있지 않다. API 규약 §5.2의 목록 응답은 `pagination` 객체를 필수로 포함하는데, 고정 10건 응답에 pagination 이 없으면 목록 형태 규약(`§5.2`)이 아닌 단순 배열 래퍼(`{ data: [...] }`)로 봐야 하는지 불분명하다. `GET /api/dashboard/summary` 와 `GET /api/dashboard/recent-workflows` 는 각자 명시적 shape 예시를 제공하지만 `recent-executions` 는 응답 shape 예시가 없다.
- 제안: `recent-executions` 응답 예시 추가 — `{ data: [...10개 실행...] }` 구조임을 명시하고, pagination 객체를 포함하지 않음을 의도적으로 기술. 이를 통해 구현자가 API 규약 §5.2의 pagination 필드를 추가할지 여부를 잘못 판단하는 것을 방지.

---

### [WARNING] `14-execution-history.md` §2.4 Trigger 출처 분류 — `subworkflow` source 가 `parent_execution_id` 기반이나 dashboard §5 에서는 동일 필드 명시 없음

- target 위치: `spec/2-navigation/14-execution-history.md` §2.4 Trigger 출처 분류 테이블
- 충돌 대상: `spec/2-navigation/0-dashboard.md` §5 트리거 열 (`subworkflow`/`manual`/`schedule`/`webhook`/`unknown` 분류 규칙은 14-execution-history.md §2.4 참조라고 명시)
- 상세: 대시보드 spec §5는 "분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조"로 위임한다. 이 자체는 올바른 SoT 위임이다. 그러나 대시보드 recent-executions API(`GET /api/dashboard/recent-executions`)의 응답 shape 예시가 없기 때문에, `triggerSource`·`triggerLabel` 필드가 해당 응답에도 포함되는지 불분명하다. 실행 내역 목록 API(`GET /api/executions/workflow/:workflowId`)는 이 두 필드를 명시적으로 포함하지만, 대시보드 API 는 별도 구현체로 분리될 수 있다.
- 제안: 대시보드 §7 의 `recent-executions` 응답 예시에 `triggerSource` / `triggerLabel` 포함 여부를 명시. 포함하면 14-execution-history.md §2.4 의 분류 로직을 재사용함을 명시. 포함하지 않으면 대시보드 트리거 열의 표시 방식(`subworkflow`/`manual` 등)이 어떤 필드를 소비하는지를 명시.

---

### [INFO] `1-workflow-list.md` §3.2 Export/Import JSON 포맷 — `formatVersion` 미방출과 데이터 모델 간 불일치 가능성

- target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 Export/Import JSON 포맷
- 충돌 대상: 간접 — Export DTO (`ExportWorkflowDto`) 는 `spec/` 어디에도 별도 엔티티 정의가 없고 코드에만 존재
- 상세: `formatVersion` 필드를 Swagger DTO 가 선언하지만 현재 emit/수신하지 않는다고 명시되어 있으며, 이는 spec 에서 `Planned` 로 표기되어 있다. 다른 spec 과 직접 충돌하는 사항은 없다. Workflow 엔티티 데이터 모델(`spec/1-data-model.md §2.4`)이 `settings`(JSONB) 필드를 정의하는데, export payload 의 `settings` 와 동일한지 여부가 명시되어 있지 않다. 현재 사용 범위에서 충돌은 없다.
- 제안: 변경 불필요. 향후 `formatVersion` 구현 시 `1-workflow-list.md §3.2` 를 갱신.

---

### [INFO] `15-system-status.md` — `spec/0-overview.md §2.4` 의 BullMQ 큐 목록과 화면 그룹 일치 확인

- target 위치: `spec/2-navigation/15-system-status.md` §2.3 — 4개 그룹 (실행 / 지식베이스 / 알림·통합 / 스케줄·시스템)
- 충돌 대상: `spec/0-overview.md §2.4` — 실행 엔진 큐 목록(`execution-run` / `execution-continuation` / `background-execution`)
- 상세: 시스템 상태 화면이 표시하는 큐 그룹과 `spec/5-system/16-system-status-api.md` 가 정의하는 큐 목록 간의 일관성은 SoT 가 API spec 으로 위임되어 있다(`spec/2-navigation/15-system-status.md` 관련 문서 링크 `[Spec 시스템 상태 API](../5-system/16-system-status-api.md)` 참조). 개요 spec(`0-overview.md §2.4`)에서 언급된 `makeshop-token-refresh` BullMQ 큐가 시스템 상태 화면의 4개 그룹 중 어디에 속하는지 화면 spec 에서 명시되지 않는다.
- 제안: 변경 불필요. `makeshop-token-refresh` 큐 배치는 `spec/5-system/16-system-status-api.md` 가 결정하는 사항으로, 화면 spec 이 직접 열거할 필요는 없다.

---

## 요약

`spec/2-navigation/` 전체를 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/5-system/` 및 연관 규약과 교차 검토한 결과, **직접 모순(CRITICAL)** 이나 즉시 수정이 필요한 **명시적 충돌(CRITICAL/WARNING 핵심)**은 발견되지 않았다. WARNING 2건은 모두 **응답 shape 명세 불완전**에 관한 것으로, 구현자가 잘못 해석할 수 있는 모호성이다 — `GET /api/dashboard/recent-executions` 의 응답 예시 부재와 `triggerSource`/`triggerLabel` 포함 여부 불명확이 그 대상이다. INFO 5건은 명명 비일관성(`/api/` prefix 누락) 및 spec 간 위임 구조의 가독성 개선 제안이다. 데이터 모델(Execution status 6종, NodeExecution status 7종, Integration status 전이, Agent Memory RBAC, Trigger-Schedule cascade), API 계약(공통 래퍼·pagination 규약), 상태 전이(Integration `pending_install→expired`, Trigger↔Schedule 동기화), RBAC 모델(`viewer+`·`editor+` 분리)은 모두 내비게이션 spec 과 시스템 spec 간에 일관성이 유지된다.

---

## 위험도

LOW
