# 정식 규약 준수 검토 — `spec/data-flow/`

## 검토 방법

`spec/data-flow/` 16개 파일(`0-overview.md` ~ `15-external-interaction.md`) 전문을 HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/review-info-followups`)에서 직접 Read 하고,
prompt 에서 컨텍스트 예산 초과로 생략된 `spec/conventions/**` 8개 파일
(`error-codes.md`, `audit-actions.md`, `swagger.md`, `secret-store.md`, `node-output.md`,
`node-cancellation.md`, `cross-node-warning-rules.md`, `conversation-thread.md`,
`chat-channel-adapter.md`, `migrations.md`, `spec-impl-evidence.md`)도 별도로 Read 했다. 각 규약 문서가
data-flow 문서를 인용하는 지점(명명·출력 포맷·에러 코드·DTO 패턴)을 상호 대조했고, 의심 지점은
`codebase/backend/src/**` 실제 코드(controller/DTO/constants)까지 절대경로로 열어 사실관계를 재검증했다
(예: notification dismiss DTO 위치·이름, workflow duplicate 컨트롤러의 `@ApiCreatedWrappedResponse`,
`system-status.constants.ts` 의 `MONITORED_QUEUES`).

## 발견사항

- **[INFO]** 응답 envelope(`{ data: ... }`) 표기가 시퀀스 다이어그램 전반에서 비일관
  - target 위치: `spec/data-flow/12-workspace.md` §1.7 (`Svc-->>C: 200 { data: workspace }`)
  - 위반 규약: 없음 (직접 위반 아님) — `spec/conventions/swagger.md` §2-5 의 `TransformInterceptor`
    래핑 서술과 비교했을 때의 **표기 일관성** 이슈
  - 상세: `spec/conventions/swagger.md` §2-5 에 따르면 모든 성공 응답은 전역
    `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다. data-flow 문서의 시퀀스 다이어그램은
    16개 파일 전체에서 이 wrapper 를 생략하고 논리적 payload 만 표기하는 것이 일관된 스타일이다
    (`2-auth.md`: `{ accessToken }`, `3-execution.md`: `executionId`, `10-triggers.md`:
    `202 { executionId }`, `11-workflow.md`: `201 { workflow }` 등 — 전부 wrapper 미표기).
    유일하게 `12-workspace.md` §1.7 한 곳만 `{ data: workspace }` 로 wrapper 를 포함해 표기한다.
    실제 wire-format 은 두 표기 모두 결과적으로 `{ data: {...} }` 이므로 **기능적 오류는 아니다**
    — 다만 같은 문서 세트 안에서 표기 관례가 갈린다.
  - 제안: `12-workspace.md` §1.7 다이어그램에서도 다른 15개 파일과 동일하게 wrapper 를 생략하거나
    (`200 { workspace }`), 반대로 전 파일에 wrapper 를 명시하는 쪽으로 통일한다. 어느 쪽이든 기능
    영향은 없으므로 우선순위는 낮다.

- **[INFO]** (비-위반, 참고용) BullMQ 큐 개수 표기 차이는 실제로는 정합
  - target 위치: `spec/data-flow/0-overview.md` §1.2 ("현재 등록된 큐 (18개)") vs
    `spec/data-flow/9-observability.md` §1.4 ("17개 BullMQ 큐")
  - 위반 규약: 없음 — 조사 결과 **위반이 아님을 확인**
  - 상세: 두 수치가 다른 이유는 모집단이 다르기 때문이다. `0-overview.md` §1.2/§4 는 앱 전체에
    등록된 BullMQ 큐 **전수**(18개, `agent-memory-extraction` 포함)를 나열하고, `9-observability.md`
    §1.4 는 `SystemStatusService.MONITORED_QUEUES` 가 **실제로 모니터링하는** 큐 수(17개)를
    가리킨다. `agent-memory-extraction` 큐가 아직 `MONITORED_QUEUES`
    (`codebase/backend/src/modules/system-status/system-status.constants.ts`, 코드 확인 완료 — 17개
    엔트리, `agent-memory-extraction` 부재)에 미등재된 것은 **이미 문서화되고 추적 중인 기존 갭**이다
    — `spec/5-system/16-system-status-api.md` §1 이 "⚠ 구현 갭 ... 2026-06-10 감사 보고 V-15 추적"으로
    명시하고, `.claude/config/doc-sync-matrix.json` 의 "신규 BullMQ 큐 추가" 행이 동반 갱신 대상
    (`MONITORED_QUEUES` / e2e `EXPECTED_QUEUE_NAMES` / `spec/5-system/16-system-status-api.md` §1 /
    `spec/data-flow/0-overview.md` §3-4)으로 이미 등재되어 있다. 즉 두 data-flow 파일의 표기는
    각자의 관측 대상 기준으로 **둘 다 사실과 일치**하며 규약 위반이 아니다. (재확인 과정에서 처음엔
    불일치로 의심했으나 실제 코드·타 spec 대조 후 오탐으로 판정했다 — 참고용으로만 남김.)

## 점검한 주요 정합 항목 (위반 없음 확인)

아래는 명시적 규약과 대조해 **정합을 확인**한 항목이다 (누락 방지를 위해 기록):

1. **명명 규약**
   - `spec/conventions/audit-actions.md` §3 레지스트리(resource·verb·시제 3분류)와
     `data-flow/1-audit.md` §1.1 writer 표가 일치 (`integration.*` 과거분사, `auth_config.*` 현재형,
     `execution.re_run`/`workspace.transfer_ownership` 도메인 동사 등).
   - `spec/conventions/migrations.md` (V번호 단조증가·gap 금지)는 data-flow 문서가 인용만 하고
     신규 마이그레이션을 도입하지 않으므로 저촉 없음.
   - BullMQ 큐 이름(`0-overview.md` §4)은 전부 kebab-case 로 내부 일관.

2. **출력 포맷 규약**
   - `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리(`workspace_type_mismatch`
     / `already_a_member` / `invitation_already_pending` / `invitation_already_accepted` 의
     lower_snake_case 예외)와 `data-flow/12-workspace.md` §1.2/§1.8/§1.9 의 서술이 정확히 대응.
   - `spec/conventions/secret-store.md` 의 URI scheme(`secret://<scope>/<resourceId>/<name>`,
     `.v2` grace 접미사)과 `data-flow/14-chat-channel.md`/`0-overview.md` 의 secret ref 표기가 일치.
   - `spec/conventions/node-output.md` Principle 3(에러 컨트랙트)·`node-cancellation.md`
     (`AbortError` vs `ExecutionCancelledError` 두 sentinel)과 `data-flow/3-execution.md` §3.1-3.2
     의 상태 전이 서술이 정합.

3. **문서 구조 규약**
   - 16개 파일 전부 `## Overview`(`### System role`) → 본문(`## 1..4`) → `## Rationale` 3섹션
     구조를 따름 (CLAUDE.md/SKILL.md 의 3섹션 권장 준수).
   - `0-overview.md` 는 `spec/4-nodes/0-overview.md` 와 동형의 "영역 진입 문서" 패턴 —
     `spec/conventions/spec-impl-evidence.md` §1 이 `basename 0-overview.md` 를 frontmatter 의무에서
     명시적으로 면제하고, 같은 문서 §1 각주가 `spec/data-flow/**` 자체를 frontmatter 비대상으로
     명시(구현 lifecycle 을 추적할 product surface 아님) — 16개 파일 모두 frontmatter 가 없는 현재
     상태가 정확히 이 규약을 따른 것.
   - `spec-area-index` 요건(영역 폴더 index 존재 + 전 sibling 링크)도 `0-overview.md` §2 가 15개
     sibling 전부를 링크해 충족.

4. **API 문서 규약**
   - `spec/conventions/swagger.md` §5(응답 DTO 규약)와 `data-flow/8-notifications.md` §4.2 의
     `DismissNotificationResponseDto`/`DismissAllNotificationsResponseDto` 서술을 실제 코드
     (`codebase/backend/src/modules/notifications/dto/responses/*.ts`,
     `notifications.controller.ts` 의 `@ApiOkWrappedResponse(...)`)와 대조 — 정확히 일치.
   - `workflows.controller.ts` 의 `duplicate` 엔드포인트(`@ApiCreatedWrappedResponse(WorkflowDto, ...)`,
     `dto/responses/workflow-response.dto.ts`)도 swagger.md §5-1/§5-2 패턴 그대로 — 이번 PR 이 다룬
     "캔버스 전체 복제" 서술(`11-workflow.md` §1.5 · Rationale)과 실제 컨트롤러 `@ApiOperation`
     설명이 일치.

5. **금지 항목**
   - `spec/conventions/node-output.md` Principle 1.1.4/7/8 이 금지하는 패턴
     (`output.view` 판별자, config spread echo, `output.output.*` 이중 중첩)을 data-flow 문서가
     현재 관행으로 서술한 곳 없음.
   - Mermaid 사용 규약(`0-overview.md` Rationale — custom theme 금지) 위반 없음
     (`%%{init...}%%` 사용 0건), 상태 다이어그램은 전부 `stateDiagram-v2` (구형 `stateDiagram` 0건).

- 링크 무결성: `spec/data-flow/**.md` 가 참조하는 `../conventions/*.md` · `../5-system/*.md` ·
  `../2-navigation/*.md` · `../4-nodes/**/*.md` 상대경로 전량(약 90개 고유 링크) 파일 존재를 확인했고,
  `#anchor` 가 포함된 표본(약 15개, 한국어 heading slug 포함)도 대상 파일의 실제 heading 과 대조해
  전부 해소됨을 확인했다(`spec-link-integrity.test.ts` 가 요구하는 것과 동일한 검증).

## 요약

`spec/data-flow/` 16개 파일은 명명·출력 포맷·문서 구조·API 문서 규약·금지 패턴의 5개 관점 모두에서
`spec/conventions/**` 의 정식 규약과 매우 높은 수준으로 정합했다. 특히 audit-actions/error-codes/
secret-store/swagger/node-output/node-cancellation/chat-channel-adapter/conversation-thread 등
직접 인용되는 규약 문서와의 상호 참조가 정확했고, 코드(`system-status.constants.ts`, notifications/
workflows DTO·controller)와 대조한 표본 검증에서도 불일치가 발견되지 않았다. 유일한 특기사항은
`12-workspace.md` 한 곳의 시퀀스 다이어그램이 나머지 15개 파일과 달리 응답 wrapper(`{ data: ... }`)를
표기해 스타일이 갈린다는 점(INFO, 기능 영향 없음)이며, 최초 의심했던 BullMQ 큐 개수 불일치(18 vs 17)는
코드·타 spec(`5-system/16-system-status-api.md`) 대조 결과 이미 추적 중인 알려진 갭에 대한 정확한
서술로 확인되어 위반이 아니다. CRITICAL/WARNING 급 발견은 없다.

## 위험도

NONE
