# 정식 규약 준수 검토 — `spec/2-navigation/`

## 검토 범위 및 제약

- 모드: `--impl-prep`, scope = `spec/2-navigation/`
- 번들 예산 초과로 대상 문서 18개 중 3개(`1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`)만 프롬프트에 전문 포함되고 나머지 15개(`4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`, `_product-overview.md`, `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`)는 절단됐다. 절단된 파일은 `Read` 로 frontmatter·구조만 직접 열어 표본 확인했고(`0-dashboard.md`, `16-agent-memory.md`, `_product-overview.md`), 전수 본문 검토는 하지 못했다 — **여기 없다는 사실을 "위반 없음" 의 근거로 삼지 않는다.**
- `spec/conventions/**` 역시 대부분 절단되어(`audit-actions.md` 등 소수만 전문 포함), 관련성이 높은 `swagger.md`·`error-codes.md`·`secret-store.md`·`chat-channel-adapter.md`·`spec/5-system/2-api-convention.md §5.2-5.4`는 저장소에서 직접 읽어 대조했다.

## 발견사항

- **[INFO]** Folder 목록 API 의 응답 포맷 규약 인용 누락
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 `GET /api/folders` 행
  - 위반 규약: `spec/5-system/2-api-convention.md §5.2` (목록 응답 — 페이징 vs 비-페이징 고정 컬렉션)
  - 상세: 같은 §3 표의 `GET /api/workflows`·`GET /api/triggers`·`GET /api/schedules` 는 모두 "페이지네이션 응답 형식은 API 규약 §5.2 준수" 를 명시하거나 필터 파라미터(`page`/`limit`)를 갖는다. 반면 `GET /api/folders` 는 `page`/`limit` 파라미터가 없고(계층 구조를 `parentId` 로 클라이언트가 구성하는 방식이라 전량 반환으로 보인다) §5.2 를 인용하지도, "비-페이징 고정 컬렉션(`{ data: { items } }`)" 형태임을 명시하지도 않는다. 응답 shape 이 배열 `{ data: [...] }` 인지 `{ data: { items: [...] } }` 인지 spec 만으로는 판별 불가.
  - 제안: 실제 컨트롤러 응답 shape 을 확인해 `GET /api/folders` 행에 "페이지네이션 없음 — `{ data: [...] }` 전량 반환" 또는 해당하는 §5.2 문구를 명시한다.

- **[INFO]** Folder API 4xx 에러의 `details` 형태 미명시 — 같은 문서 내 Trigger 절과 서술 정밀도 비대칭
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 `POST /api/folders`·`PATCH /api/folders/:id` 행 (400 `VALIDATION_ERROR`, 409 `RESOURCE_CONFLICT` 서술)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` "`field` 를 실으면 `code` 도 싣는다" 절 — 강제 규정은 아니나, 이 규약이 요구하는 `details.field`/`details.code` 짝을 문서화하는 관례가 같은 target 문서 §2.3.1·§3(트리거)에서는 위반 케이스마다 `details.field='...'`, `details.code='...'` 를 전부 명시하는 반면, 폴더 섹션은 어떤 필드가 400 을 유발했는지(`parentId`? `name`? `depth`?) 코드 수준 정보를 전혀 적지 않는다.
  - 상세: 같은 영역(spec/2-navigation) 안에서 API 문서의 정밀도가 화면마다 크게 다르다 — 트리거 절은 "정당화" 수준까지 상세히 코드값을 박아 두는데 폴더 절은 상태코드+top-level 코드만 있다. `--impl-prep` 검토 관점에서, 구현자가 400 응답의 `details` 형태를 트리거 절과 동일한 세밀도로 맞춰야 하는지 spec 만으로 판단할 근거가 부족하다.
  - 제안: 폴더 API 400 행에도 위반 필드(`parentId`/`name`) 를 `details.field`/`details.code`(`INVALID_FIELD` 등)로 명시하거나, 명시하지 않는 것이 의도(예: 필드 단일이라 top-level 코드만으로 충분)라면 그 판단을 한 줄로 남긴다.

- **[INFO]** 최근 머지된 응답 DTO(`ExportedNodeDto`/`ExportedEdgeDto`, PR #1412)가 대상 spec 절에 이름으로 등장하지 않음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 (Export/Import JSON 포맷)
  - 위반 규약: 직접적인 conventions 위반은 아니며 `spec/conventions/swagger.md §5-1`(응답 DTO 는 SoT 로 명시) 관점의 참고 사항
  - 상세: 현재 세션 git log(`daff47a6b feat(api): 워크플로우 export 응답의 nodes/edges 를 응답 전용 DTO 로 광고한다 — ExportedNodeDto · ExportedEdgeDto`)가 이미 merge 됐는데, §3.2 는 여전히 "SoT: `import-workflow.dto.ts` / `ExportWorkflowDto`" 만 언급하고 신설된 두 응답 전용 DTO 이름은 등장하지 않는다. `ExportWorkflowDto` 가 nodes/edges 를 `ExportedNodeDto[]`/`ExportedEdgeDto[]` 로 광고한다는 사실이 spec 에 없으면, swagger.md §5-1 이 요구하는 "입력 DTO 와 출력 DTO 이름을 다르게 두는" 설계 의도가 spec 독자에게 드러나지 않는다.
  - 제안: 후속 spec 갱신 시(project-planner 턴) §3.2 에 `ExportedNodeDto`/`ExportedEdgeDto` 명칭을 반영. 단, 이는 `--impl-prep` 차단 사유는 아니고 spec-coverage 성격의 후속 항목으로 남겨도 무방.

## 확인했으나 위반 없음 (양성 확인, 참고용)

- 에러 코드 표기: 전문 확인된 3개 파일(workflow-list/trigger-list/schedule) 안의 모든 코드(`VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `DUPLICATE_NODE_LABEL`, `BOT_TOKEN_INVALID`, `INTERNAL_ERROR`, `AUTH_CONFIG_NOT_FOUND`, `TRIGGER_ENDPOINT_PATH_CONFLICT`, `INVALID_FIELD`)이 `UPPER_SNAKE_CASE` 이고 `error-codes.md` §1/§3 의 명명·prefix 정책(공용 코드는 prefix 없음)과 일치.
- DTO 명명: `UpdateWorkflowDto`/`UpdateTriggerDto` 는 top-level 요청 바디 → `Update` 접두(swagger.md §1-7) 준수. `WorkflowSettingsDto` 는 nested 필드 DTO 로 `Update` 접두를 걸지 않아 §1-7 의 "접두 규칙을 nested 로 넓히지 않는다" 원칙과 일치. `PatchXxxDto` 형태의 금지 패턴은 대상 문서 어디에도 없음(`Patch` 접두 미검출).
- Secret / Chat Channel 서술: `botTokenRef`/`inboundSigningRef` 를 응답에 노출하지 않고 `hasBotToken: boolean` 파생값만 노출한다는 서술(§2.3.1)은 `secret-store.md §1.1`(ref 도 응답 바디에 실으면 안 됨) 및 `chat-channel-adapter.md`·`swagger.md §1-5`(writeOnly/readOnly) 와 일치.
- 응답 부재 표현(`TriggerDto.workflow`, `ScheduleDto.trigger.workflow`): `api-convention.md §5.4` 의 null-vs-키-생략 구분을 정확히 인용하고 근거(소비자가 부재를 정상 경로로 다룸)까지 §5.4 판정 기준 (b)에 맞춰 서술 — 준수.
- API 라우트 설계: `PATCH /api/triggers/:id`·`PATCH /api/schedules/:id` 모두 별도 `/toggle` 서브경로를 두지 않는다고 명시 — 단일 PATCH 경로 원칙과 일치(자체 Rationale R-4 도 이를 근거로 설명).
- Frontmatter 표본 점검: `spec/2-navigation/0-dashboard.md`(`id: dashboard`), `spec/2-navigation/16-agent-memory.md`(`id: nav-agent-memory` — `spec-impl-evidence.md §2.1` 이 명시한 basename 충돌 회피 규칙의 실제 사례와 정확히 일치)는 `spec-impl-evidence.md` 스키마(`id`/`status`/`code`) 를 충족.
- 문서 구조: 다중 파일 영역(`2-navigation`)이므로 개별 `N-name.md` 파일에 `## Overview` 섹션이 없고 대신 상단에 `_product-overview.md` 링크 + 말미 `## Rationale` 구조를 취하는 것은 `project-planner/SKILL.md` §Spec 문서 구조("다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일")와 일치 — 위반 아님.

## 요약

전문 확인이 가능했던 3개 파일(워크플로우 목록·트리거 목록·스케줄) 은 에러 코드 표기, 응답 DTO/`Update` 접두 명명, null-vs-키-생략 부재 표현, secret ref 비노출, 단일 PATCH 경로 원칙 등 핵심 정식 규약을 정밀하게 준수하고 있으며 CRITICAL/WARNING 급 위반은 발견되지 않았다. 발견된 것은 모두 INFO 수준으로, 같은 target 문서 안에서도 화면별로 API 에러 상세(`details.field`/`code`) 서술 정밀도가 갈리는 점과 신설 Folder API 의 응답 포맷 규약 인용 누락, 최근 merge 된 export 응답 DTO 이름이 아직 spec 문구에 반영되지 않은 점이다. 다만 프롬프트 번들이 컨텍스트 예산 초과로 대상 파일 18개 중 15개(약 83%)와 conventions 대부분을 절단해, 이번 검토는 사실상 `2-navigation/` 전체가 아니라 그 하위 세 화면(workflow-list/trigger-list/schedule)에 대한 정밀 검토에 가깝다 — 절단된 15개 파일에 대한 규약 위반 유무는 이번 검토로 확정할 수 없다.

## 위험도

LOW
