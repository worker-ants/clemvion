# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

검토 컨텍스트: 진행 중 plan `plan/in-progress/patch-body-followups.md` (워크플로/노드/인증설정 PATCH nullable 요청 필드
선언 + NOT NULL→500 백로그 등재 + executions `findById` 관계 유출 조사)를 착수하기 전 `spec/2-navigation/`
영역의 cross-spec 일관성을 점검했다.

## 방법론 노트 (판정 아님)

전달된 target 번들 18개 파일 중 3개(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)만 본문이
포함되고 나머지 15개(`4-integration.md`·`6-config.md`·`14-execution-history.md`·`_layout.md` 등)는
컨텍스트 예산 초과로 절단됐다. "관련 spec 본문" 섹션도 `0-overview.md` 하나만 포함되고
`1-data-model.md`·`5-system/**`·`3-workflow-editor/**` 등은 전부 절단됐다. 아래 발견사항은 절단된 파일을
저장소에서 직접 Read/Grep 해 보강했지만, 절단 자체가 실제 충돌을 가릴 수 있다는 전제는 남는다 — 과거
세션에서도 동일한 `--spec` 기본 예산 이슈가 관찰된 바 있고, 이번 세션에서도 재현됐다(`_prompts/cross_spec.md`
조립 결과에 절단 경고 15건).

## 발견사항

### [WARNING] Trigger PATCH `name` 검증 실패 = 400 이라는 target 의 주장이 새로 발견된 NOT NULL→500 결함군과 미검증 상태로 상충

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API, 197번째 줄 —
  "길이/이름 검증 실패는 400 `VALIDATION_ERROR` ([Spec 에러 처리](../5-system/3-error-handling.md))."
- 충돌 대상: `spec/1-data-model.md` §2.8 Trigger (`name` 컬럼 = `String`, nullable 아님 — NOT NULL) +
  같은 세션의 `plan/in-progress/patch-body-followups.md` "프로브" 표(고치기 전 코드 실측).
- 상세: 이번에 리뷰 대상인 plan 의 실측이 **동일한 형태(구조)** 의 결함을 이미 넷 확인했다 — NOT NULL 컬럼에
  매핑된 요청 필드에 `null` 을 보내면 `@IsOptional()` 이 null 을 "값 없음" 으로 통과시키고, 병합된 엔티티가
  저장 시 Postgres NOT NULL 위반(23502)을 내며, 전역 예외 필터가 23505(unique)만 409 로 매핑하고 나머지는
  500 `INTERNAL_ERROR` 로 떨어뜨린다: `PATCH /folders/:id { name: null }` → 500, `PATCH /workflows/:id
  { name·tags·isActive: null }` → 500(셋 다), `PATCH /auth-configs/:id { name·isActive: null }` → 500(둘 다).
  `Trigger.name` 도 데이터 모델상 정확히 같은 모양(NOT NULL `String`, `UpdateTriggerDto.name?: string` 로
  optional 매핑 추정)인데, 이번 프로브 표에는 `PATCH /triggers/:id { name: null }` 케이스가 **없다** — 검증되지
  않았을 뿐 배제된 것이 아니다. 만약 같은 결함이 재현되면, target 문서가 명시적으로 약속한 "이름 검증 실패
  400" 이 null 값 케이스에서는 거짓이 되어 **target 자신의 API 계약과 실제 동작이 어긋난다.**
- 제안: 이번 plan 이 이미 열기로 한 백로그 항목("PATCH NOT NULL 필드의 null 이 500")의 실측 표에
  `PATCH /triggers/:id { name: null }` (그리고 `schedules`/`isActive` 등 Trigger·Schedule 의 다른 NOT NULL
  필드)도 추가해 등재하거나, target 문서의 "이름 검증 실패는 400" 문구에 "단 명시적 `null` 은 제외 — 별도
  트래킹" 각주를 달아 문서-동작 불일치를 명시할 것.

### [WARNING] Execution 상세 `nodeExecutions[].node` 의 문서화된 응답 shape 가 spec 파일 사이에서 다르게 서술됨

- target 위치: `spec/2-navigation/14-execution-history.md` §5 (414번째 줄 부근) — 상세 API 샘플이
  `nodeExecutions[].node` 를 `{ id, type, label }` 세 필드로 **좁혀** 예시한다("실행 상세 (노드 실행 포함)",
  346번째 줄).
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` §6.2 (224번째 줄) — 같은 데이터 소스
  (`ExecutionsService.findById`)를 두고 "`execution` 은 **Execution 전체 객체**(그 안에 `nodeExecutions[]`
  등이 nest)" 라고 명시적으로 서술한다.
- 상세: 두 문서가 **같은 백엔드 메서드의 같은 필드**를 서로 다른 폭으로 계약한다 — REST 쪽 문서는 "좁은 참조"
  를 계약처럼 제시하고, WS 쪽 문서는 "findById 가 반환하는 대로 통째" 라고 명시한다. 이번 plan 의 조사가 그
  실제 답을 준다: `executions.service.ts` 의 `findById` 는 `trigger`/`executor` 관계만 떼고 `workflow` 전체와
  `nodeExecutions[].node` 전체(Node 전 컬럼, `config` 원문 포함)를 그대로 남긴다 — 즉 **WS 문서 쪽 서술
  ("findById 그대로") 이 현재 진실에 가깝고, REST 문서(14-execution-history.md §5)의 narrow 샘플이 실제
  계약을 반영하지 못한다.** `ExecutionDetailDto` 라는 이름의 응답 전용 직렬화 계층이 없다는 것이 이번 plan
  조사의 결론이므로, 두 spec 문서 중 어느 쪽도 지금 코드가 실제로 하는 일을 정확히 반영하지 못하는 상태로
  나란히 존재한다.
- 제안: plan 이 이미 "이 PR 의 크기가 아니다" 로 좁혀 트래커에 남긴 항목(executions `findById` 한 자리)에
  "`14-execution-history.md §5` 샘플과 `6-websocket-protocol.md §6.2` 서술 중 어느 쪽이 목표 계약인지" 를
  명시적으로 결정하는 하위 작업을 추가할 것. `ExecutionDetailDto` 를 신설해 `node` 를 좁히는 방향으로 가면
  §5 샘플이 맞고, 현행 유지로 가면 6-websocket-protocol.md §6.2 문구가 맞으므로 REST §5 샘플을 갱신해야 한다
  — 지금처럼 둘 다 손대지 않으면 다음 사람이 어느 문서를 SoT 로 믿어야 할지 알 수 없다.

### [INFO] Folder 리소스 RBAC(`editor+`)가 중앙 권한 매트릭스에 미등재

- target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (POST/PATCH/DELETE `/api/folders` 모두
  `editor+` 로 게이트).
- 충돌 대상: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (368번째 줄) — Workflow·Trigger·
  Schedule·Integration·Knowledge Base·Auth Config·Model Config 는 행으로 등재돼 있으나 **Folder 행이 없다**.
- 상세: 매트릭스가 스스로 "리소스별 권한 매트릭스" 라 칭하며 이 문서 안의 다른 RBAC 결정들(예: trigger-list.md
  §2.3.1 "+ 새 인증 설정 만들기" 항목이 Admin+ 인 근거로 이 §3.2 를 SoT 로 직접 인용)이 이 표를 최종 근거로
  삼는 관례가 있는데, Folder 는 같은 방식으로 인용할 행이 없다. 실질 동작(§3.1 이 서술하는 editor+ CRUD,
  Viewer 는 암묵적 R)은 Workflow 행과 동일해 보이지만, Node·Version 등 다른 워크플로 하위 리소스도 별도
  행이 없는 것으로 보아 "하위 리소스는 부모 리소스 행에 암묵 포함" 이 기존 관례일 가능성이 높다 — 그렇다면
  이는 결함이라기보다 명명 관례상의 공백이라 CRITICAL/WARNING 이 아니라 INFO 로 낮춘다.
- 제안: Folder 가 독립 CRUD 엔드포인트·독립 깊이/순환 무결성 규칙(§3.1 Rationale 3, DoS 이력 있음)을 가진
  만큼, §3.2 에 "Folder | CRUD | CRUD | CRUD | R (Workflow 와 동일)" 행을 추가하거나, 최소한 "하위 리소스는
  부모 리소스 행을 따른다" 는 각주를 §3.2 상단에 명시해 다음 신규 리소스 추가 시 같은 질문이 반복되지 않게
  할 것.

## 요약

target(`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)의 API·RBAC·상태 전이
서술 자체는 매우 촘촘히 상호 인용돼 있어(R-1~R-17, NAV-WF-07 등 요구사항 ID 재사용 없음, Trigger/Schedule
RBAC 은 §5-system/1-auth.md §3.2 와 정합) 데이터 모델·API 계약 차원의 직접적 CRITICAL 모순은 발견되지 않았다.
다만 (1) 이번에 검토 대상인 plan 이 실측으로 확인한 "NOT NULL 컬럼에 null PATCH → 500" 결함 패턴이 target
문서가 명시적으로 400 을 약속하는 Trigger `name` 검증 실패 케이스까지 번질 위험이 검증되지 않은 채 남아
있고, (2) Execution 상세 `nodeExecutions[].node` 의 응답 폭에 대해 REST 문서와 WS 문서가 서로 다른 계약을
서술하는 진짜 spec-간 불일치가 있다. 두 건 모두 이번 plan 이 이미 "이 PR 의 크기가 아니다" 로 미루기로 한
백로그 항목과 겹치므로, 그 백로그 항목의 범위 서술에 위 두 세부사항을 명시적으로 편입하는 것을 권한다.
Folder RBAC 미등재는 명명 관례 공백 수준의 INFO 다. 컨텍스트 예산 절단으로 15개 target 파일과 대부분의
관련 spec 파일 본문을 이 세션이 직접 보지 못했다는 방법론적 한계가 있다.

## 위험도

MEDIUM
