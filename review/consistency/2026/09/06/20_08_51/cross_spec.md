# Cross-Spec 일관성 검토 — cross_spec

- 검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`)
- target spec 영역(`spec/2-navigation/`) 자체의 파일 델타: **0** — 이 브랜치는 해당 spec 영역 문서를 직접 고치지 않았다. 실제 코드 변경(23파일 / 2769줄, `git diff origin/main...HEAD --stat` 실측)은 대부분 `spec/2-navigation/` 밖(`triggers.controller.ts`/`triggers.service.ts`, `workflow-versions.service.ts`, `workspace-response.dto.ts`, `pg-error.ts`, `User` 엔티티 노출 방지 정적 가드·테스트 신설)에 있고, 그중 트리거 변경만 `spec/2-navigation/2-trigger-list.md` 가 이미 문서화해 둔 계약을 뒤늦게 실현하는 성격이다.
- 최신 커밋(`592d0c7b6`, 2026-09-06 20:08:27)까지 확인 — 직전 라운드(`review/consistency/2026/09/06/19_31_06`) 이후 추가된 변경은 `pg-error-fixtures.ts` 의 순수 타입 캐스팅 정정 하나뿐이며 `spec/2-navigation/` 관련 코드·계약에는 영향 없음.
- 코드 존재·내용 확인은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)에서 `git diff origin/main...HEAD -- <path>` 절대경로 실측으로 수행했다 (prompt 예산 절단으로 diff 본문이 안 보이는 부분은 이 방식으로 직접 조회).

## 발견사항

- **[WARNING]** 409 `RESOURCE_CONFLICT` 세부 코드 표현이 두 관례로 갈렸다 (`details.code` 신설 vs 기존 top-level `code` 치환)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (`PATCH /api/triggers/:id` 하단 note — `"(workspace_id, endpoint_path) UNIQUE 위반 시 409 RESOURCE_CONFLICT (세부 코드 TRIGGER_ENDPOINT_PATH_CONFLICT, details.field='endpoint_path')"`). 이 브랜치가 이를 실제로 구현했다 — `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rethrowEndpointPathConflict()` 가 `{ code: 'RESOURCE_CONFLICT', details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' } }` 를 던진다 (실측: `triggers.service.ts:1591-1631`).
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3 (`RESOURCE_CONFLICT` 의 도메인 특화는 `DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·`ALERT_RULE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND` 등 **top-level `code` 자체를 특화 코드로 치환**하는 패턴 7건 이상으로 등재돼 있다). `spec/5-system/2-api-convention.md` §5.3 은 `details` 를 검증 실패 항목 배열(`{ field, message, code }[]`)로만 정의하며, 이번에 쓰인 "`details` 가 단일 object 이고 그 안에 `code` 키가 또 있는" 형태는 어디에도 명문화돼 있지 않다 (`error-handling.md`/`api-convention.md` 전체에서 `details.code` 문자열 grep 0건, `TRIGGER_ENDPOINT_PATH_CONFLICT` 도 §1.3 공용 카탈로그에 미등재).
  - 상세: 같은 "409 + 도메인 세부 사유" 상황에 대해 저장소가 두 개의 서로 다른 응답 envelope 관례를 갖게 됐다 — (a) top-level `code` 를 특화값으로 교체(다수 선례), (b) top-level `code` 는 generic 값을 유지하고 세부는 `details.code`(단일 object)에 얹는 신설 방식. 클라이언트/SDK 가 `error.details` 를 항상 배열로 가정해 파싱한다면 이 신설 형태에서 오동작할 수 있고, 다음 구현자가 어느 쪽을 따라야 할지 문서가 답하지 않는다.
  - 이 항목은 **개발자 자신이 이미 인지·등재**한 사안이다 — `rethrowEndpointPathConflict()` 의 인라인 주석이 "표현 방식의 정식화는 planner 항목으로 등재했다" 고 명시하고, 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md:664-681`("도메인 세부 에러 코드의 표현 방식을 정식화한다", 2026-09-06 등재, `review/consistency/2026/09/06/14_59_49` W1 근거)에 미결 항목으로 존재함을 확인했다. 새로 발견된 미인지 충돌이 아니라 추적 중인 알려진 이원화다.
  - 제안: 위 planner 항목에서 (a)/(b) 중 하나로 `2-api-convention.md §5.3`(또는 `conventions/error-codes.md §4`)에 택일 기준을 명문화하고, `3-error-handling.md §1` 카탈로그에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 등재. 결정 전까지 신규 사례를 이 신설 형태로 더 늘리지 말 것.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 응답 필드가 navigation 문서에 아직 반영 안 됨 (doc-sync 지연, 모순 아님)
  - target 위치: (target 영역 밖) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceMemberDto` 에 `joinedAt: string | null`(항상 키 존재, nullable) 신설. `WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 으로 무조건 채운다.
  - 충돌 대상: `spec/1-data-model.md §2.3 WorkspaceMember`(`joined_at Timestamp?`) — **타입은 정합**(nullable timestamp). `spec/2-navigation/9-user-profile.md` §4 멤버 목록 서술은 이 신규 응답 필드의 UI 노출 여부·위치를 아직 언급하지 않는다(해당 파일은 이번 번들에서 컨텍스트 예산 초과로 절단됐으나, `codebase/backend/.../workspace-response.dto.ts` diff 와 대조 시 언급 부재를 확인할 수 있는 근거는 데이터 모델 §2.3 뿐이고 신규 API 노출 자체는 §2.3 범위 밖).
  - 상세: 데이터 모델 충돌은 없으나, API 응답 표면이 넓어졌는데 화면 spec 이 아직 이를 따라가지 못한 전형적 doc-sync 지연. 위험도는 낮음(추가 필드 노출은 기존 계약을 깨지 않는 하위호환 확장).
  - 제안: 다음 `9-user-profile.md` 편집 turn 에서 멤버 목록 표/카드에 `joinedAt` 노출 여부·형식을 추가.

- **[INFO]** `2-trigger-list.md §2.3.1` `botToken` 행의 자기모순 — 다른 spec(`15-chat-channel.md`)과 충돌 (선재 결함, 이번 PR 무관, 이미 tracked)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `Chat Channel | botToken` 행 — 한 문장이 "응답에는 `hasBotToken: boolean` 만 노출" 과 "마스킹 placeholder (`•••• <last4>`)" 를 동시에 서술한다.
  - 충돌 대상: `spec/5-system/15-chat-channel.md §5.4.2`(응답 DTO derived 필드는 `hasBotToken` 뿐 — ref·plaintext 모두 응답 미포함) 및 `spec/conventions/secret-store.md`(마스킹 `***<last4>` 패턴은 AuthConfig 처럼 값을 일부 노출하는 자원 전용, botToken 은 write-only).
  - 상세: boolean 만 응답에 실리면 서버가 `<last4>` 를 보낼 방법이 없어 §2.3.1 행 자체가 §5.4.2 와 모순된다. 이 브랜치의 diff 가 만든 결함이 아니며 이번 코드 변경(`triggers.service.ts` 등)도 이 행을 건드리지 않았다 — `plan/in-progress/spec-draft-nullable-notation-followups.md:686-696`(2026-09-06 등재, `review/consistency/2026/09/06/14_59_49` W2)에 이미 이월돼 있음을 확인했다.
  - 제안: 조치 불요(이번 PR 스코프 밖). 다음 `2-trigger-list.md` 편집 turn 에서 AuthConfig 마스킹 패턴 오적용을 걷어내고 §5.4.2 서술로 통일.

## 요약

이 브랜치는 `spec/2-navigation/` 문서 자체를 변경하지 않았고(스코프 델타 0), 코드 변경은 크게 두 갈래다 — ① `2-trigger-list.md §3` 이 이미 문서화해 둔 `(workspace_id, endpoint_path)` UNIQUE 충돌 409 계약을 뒤늦게 구현(내용은 정합), ② `User` 엔티티 컬럼 유출 방지를 위한 `WorkflowVersion.creator`/`WorkspaceMemberDto` 응답 투영 강화 + 정적 가드·e2e 신설(`spec/1-data-model.md`·`conventions/secret-store.md` 의 기존 `select:false` fail-silent 결정과 정합, 오히려 그 결정을 실전 방어로 보강). 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축에서도 이번 diff 가 새로 만든 CRITICAL 모순은 없다. 다만 트리거 구현이 택한 에러 응답 세부 코드 표현(`details.code`, 단일 object)이 저장소 다수 선례(top-level `code` 치환) 및 `api-convention.md §5.3` 의 `details` 배열 정의와 형태가 달라 잠재적 계약 모호성이 남아 있고, 이는 이미 팀이 planner 후속 항목으로 등재해 추적 중인 사안이다. `WorkspaceMemberDto.joinedAt` 필드와 `botToken` 행 자기모순은 각각 doc-sync 지연·선재 결함으로 모두 tracked 상태이며 이번 PR 이 우회·은폐하지 않았다.

## 위험도

LOW
