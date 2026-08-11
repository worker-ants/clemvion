# Cross-Spec 일관성 검토 — `spec/conventions` (node-cancellation.md 등) + 51-route 403 문서화

## 검토 범위 확인

target diff(`origin/main...HEAD`)는 다음 3곳에만 "`POST /executions/:id/stop` = Editor+" 서술을
추가했다:

- `spec/conventions/node-cancellation.md` §2.3 (사용자 cancel 버튼 항목)
- `spec/3-workflow-editor/3-execution.md` §4 표 ("권한" 행 신설)
- `spec/3-workflow-editor/3-execution.md` §9 API 표 (`/executions/:id/stop` 행에 "Editor+" 추가)

그리고 `codebase/backend` 전역 15개 controller · 51개 route 에 `@ApiForbiddenResponse` 를
신설(swagger 403 문서화, `spec/conventions/swagger.md` §5-4 규약 반영분)했다.

## 발견사항

- **[INFO]** `1-auth §3.2` 인용이 따옴표를 두른 직접인용처럼 보이지만 실제로는 표+체크마크의 paraphrase
  - target 위치: `spec/conventions/node-cancellation.md` §2.3 ("...근거는 [1-auth §3.2](../5-system/1-auth.md) 'Workflow 실행'..." — 인용부호 없이 명사만), `spec/3-workflow-editor/3-execution.md` §4 표 ("근거는 [1-auth §3.2](../5-system/1-auth.md) 의 "Workflow 실행 = Owner/Admin/Editor" 이며...")
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스, 373행 — `| Workflow 실행 | ✅ | ✅ | ✅ | — |` (컬럼 헤더: Owner/Admin/Editor/Viewer, 366행)
  - 상세: `1-auth.md` §3.2 본문에는 `"Workflow 실행 = Owner/Admin/Editor"` 라는 문자열이 그대로 존재하지 않는다 (`grep` 확인). 표의 체크마크 조합(Owner ✅ / Admin ✅ / Editor ✅ / Viewer —)을 그대로 읽으면 의미는 정확히 일치하므로 **내용 자체는 틀리지 않았다** — 모순이 아니라 "표를 문장으로 요약해 따옴표 안에 넣은" 표기 스타일 문제다. 다만 이 문자열을 그대로 `1-auth.md` 에서 검색하면 못 찾으므로, 향후 누군가 §3.2 를 grep 으로 재검증하려 하면 "인용이 틀렸다"는 오판을 유발할 소지가 있다.
  - 제안: 굳이 수정할 필요는 낮지만, 원한다면 따옴표를 제거하고 "표(§3.2)의 Workflow 실행 행 — Owner/Admin/Editor 만 ✅" 처럼 표를 가리키는 서술로 바꾸면 인용 정확도가 더 명확해진다. 차단 사유는 아니다.

## 점검 관점별 확인 결과 (발견 없음)

1. **1-auth §3.2 재확인** — `spec/5-system/1-auth.md` 를 직접 읽어 §3.2 "리소스별 권한 매트릭스" 373행이 "Workflow 실행" 행에 Owner/Admin/Editor 만 ✅ 이고 Viewer 는 `—` 임을 확인했다. target 의 "Editor+" 주장과 의미가 일치한다. 코드도 `codebase/backend/src/modules/executions/executions.controller.ts:121-137` 에서 `@Post(':id/stop')` 에 `@Roles('editor')` + `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 를 실제로 걸고 있음을 확인했다(이번 diff 대상이 아니라 기존 코드 — target 문서의 "신규 결정이 아니다" 주장과 부합).

2. **같은 사실을 말하는 다른 자리 탐색** — `spec/`, `data-flow/`, `5-system/`, `3-workflow-editor/` 전역에서 "Stop 버튼"·"실행 중단"·`/executions/:id/stop` 를 뜻 단위로 훑었다. 다음은 표면상 비슷해 보이지만 **다른 개념**이라 충돌 후보에서 제외했다:
   - `spec/3-workflow-editor/1-node-common.md` §"Stop Workflow" — 노드 `errorPolicy` 옵션 이름(에러 발생 시 워크플로우를 `failed` 로 종결), 사용자 Stop 버튼과 무관.
   - `spec/3-workflow-editor/4-ai-assistant.md`, `spec/data-flow/11-workflow.md` §3.3, `spec/5-system/7-llm-client.md` 의 "Stop 버튼"/`AbortController.abort()` — AI Assistant 채팅 스트리밍 중단(`workflow_assistant_message`), 워크플로우 실행 엔진의 Stop 과 별개 기능·별개 엔드포인트.
   - `spec/5-system/14-external-interaction-api.md` (`POST /api/external/executions/:id/cancel`), `spec/5-system/6-websocket-protocol.md` (`execution.stop` WS 명령, won't-do) — 실행 중단이라는 **개념**은 공유하지만 인증 모델이 다르다(외부 토큰/`per_execution` vs 내부 RBAC). 두 문서 모두 Editor+ 권한을 서술하지 않으므로 모순 소지 없음.
   - `spec/5-system/4-execution-engine.md` — `cancelled` 상태·DB 관측 가드 서술은 있으나 권한(RBAC)은 서술하지 않는다(SoT 분리가 이미 되어 있음 — 상태머신은 execution-engine, 권한은 1-auth, 동작 계약은 node-cancellation).
   - `spec/2-navigation/14-execution-history.md` — Cancelled 필터·Re-run 버튼만 있고 자체 Stop 액션이 없다.

   결론: "Editor+ 전용" 이라는 사실을 서술하는 자리는 target 이 갱신한 3곳(node-cancellation §2.3, 3-execution §4, 3-execution §9)뿐이며, 그 외 어디에도 다른/모순되는 권한 서술이 없다.

3. **51-route 403 문서화와 error-handling/api-convention 정합성**:
   - `spec/5-system/2-api-convention.md` §6 — `403 | Forbidden | 권한 없음` (generic, HTTP 상태 코드표 수준). 충돌 없음.
   - `spec/5-system/3-error-handling.md` §1 — `FORBIDDEN`(권한 없음, "역할 권한 부족(generic)"), `NOT_A_MEMBER`(워크스페이스 비멤버, 403), §"X-Workspace-Id 3분기" — "(3) 헤더 형식 유효하나 비멤버 → `RolesGuard` 의 **코드 없는 403**" 서술과 diff 의 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })`(코드 미명시, 순수 설명 문자열)가 정확히 대응한다.
   - diff 51곳을 코드 레벨로 대조: `@Roles()` 가 걸린 라우트(예: `alerts.controller.ts` 의 `@Roles('admin')` create/update/remove)는 이번 diff 대상이 아니고 이미 role-specific 설명(`'관리자 권한 필요'` 등)을 갖고 있었다. 이번 diff 는 `@Roles()` 없이 `@WorkspaceId()` 만 쓰는 조회성 라우트에만 `'워크스페이스 멤버가 아님'` 을 추가했다 — `swagger.md` §5-4 체크리스트("`@Roles()` 없이 `@WorkspaceId()` 만 쓰면 …") 및 그 Rationale(`RolesGuard` 가 `@Roles()` 유무와 무관하게 항상 멤버십을 검증 — `data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서")과 정확히 일치한다.
   - `/executions/:id/stop` 자체의 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 는 이번 diff 범위 밖(기존 코드)이며 role-specific 설명이 이미 붙어 있어, "51-route 문서화"(멤버십 전용 일반 403)와 "`/stop` 의 role 기반 403"이 서로 다른 성격의 403 임을 코드 스스로도 구분하고 있다. 모순 없음.

## 요약

Target diff 는 `POST /executions/:id/stop` 이 Editor+ 전용이라는 **기존** 사실(코드에 이미 구현된 `@Roles('editor')`, `1-auth.md §3.2` 매트릭스)을 `node-cancellation.md` §2.3 과 `3-execution.md` §4·§9 세 자리에 새로 반영했을 뿐이며, 그 세 자리 모두 `1-auth.md §3.2` 의 실제 표 내용(Owner/Admin/Editor ✅, Viewer —)과 일치한다. 저장소 전역(3-workflow-editor/, 5-system/, data-flow/)을 뜻 단위로 훑었으나 같은 사실을 다르게 서술하는 추가 자리나 모순되는 자리는 발견되지 않았다 — AI Assistant "Stop 버튼", `errorPolicy: 'Stop Workflow'`, EIA/WS 의 `cancel`/`execution.stop` 은 표면 유사어일 뿐 별개 기능·별개 인증모델이라 충돌 후보가 아니다. 51-route 403 Swagger 문서화 역시 `error-handling.md`/`api-convention.md` 의 generic 403·코드 없는 멤버십 403 서술과 정확히 부합하며, role-guarded 라우트와 member-only 라우트의 설명 문구도 diff 내에서 스스로 구분되어 있다. 유일한 지적은 인용부호를 두른 "Workflow 실행 = Owner/Admin/Editor" 문구가 `1-auth.md` 원문의 verbatim 텍스트가 아니라 표를 요약한 paraphrase라는 표기 스타일 수준의 INFO 뿐이다.

## 위험도

LOW

BLOCK: NO
STATUS: OK
