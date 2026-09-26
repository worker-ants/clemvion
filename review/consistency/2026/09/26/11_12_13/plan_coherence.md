# Plan 정합성 검토 — `plan/in-progress/spec-draft-swagger-forbidden-codes.md`

## 검토 범위

- target: `plan/in-progress/spec-draft-swagger-forbidden-codes.md` (spec draft, `--spec`)
- 대조: `plan/in-progress/forbidden-desc-codes.md`(구현 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커),
  `spec/data-flow/12-workspace.md` §Rationale, `codebase/backend/src/common/constants/workspace-roles.ts`,
  `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `plan/complete/workspace-guard-followups.md`,
  `plan/in-progress/integration-personal-owner-followup.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`

## 핵심 확인 — 충돌 없음

- data-flow §Rationale "가드 거부의 오류 코드 (2026-09-25)" 는 **채택안 확정**(안 (나): 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`)이지
  "결정 필요" 로 남은 항목이 아니다. target 의 §5-4 문구 변경은 이 채택안을 그대로 옮긴 것이라 미해결 결정을 우회하지 않는다.
- `workspaces.controller.ts` 의 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 가 실제로
  `NOT_A_MEMBER.code`/`ROLE_REQUIRED.*.code` 를 보간하고 있음을 실측 확인 — target 의 "이미 코드를 싣는 28곳" 서술과 일치한다.
  이 보간 패턴은 `plan/complete/workspace-guard-followups.md`(#1400)가 막 세운 선례이고, 구현 plan의 "공용 헬퍼로 옮긴다" 방향은 그
  선례의 연장이지 새로운 결정이 아니다.
- target 이 `forbidden-response-codes` 가드를 `swagger.md` 의 frontmatter `code:` 에 등재하는 것은, 같은 트래커의 다른 항목("신규
  repo-guard 가 spec `code:` 에 미등재…")이 2026-09-26 자로 이미 기록한 선례 — "`http-status-advertised` 는 `swagger.md` 가 자기
  조항을 세는 가드를 `code:` 에 올려 온 문서라 그 선례를 따랐다" — 를 그대로 따른 것이다. repo-guard 등재를 규약으로 세울지(그 트래커
  항목의 열린 질문 (b))를 target 이 선점하거나 우회하지 않는다.

## 발견사항

- **[WARNING]** 트래커의 repo-guard `code:` census 가 target 의 등재로 즉시 stale
  - target 위치: `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (1) — `forbidden-response-codes*.ts` 를
    `swagger.md` 의 `code:` 에 추가
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "신규 repo-guard 가 spec `code:` 에 미등재 —
    다만 «관례» 라 부를 만큼 일관되지 않다" 항목(약 4006행). 이 항목은 "대상 가드 14 / 등재 5 / 미등재 9" 라는 전수 census 를 들고
    두 열린 질문 — (a) 개별 가드를 등재할지, (b) repo-guard 등재 자체를 규약으로 세울지 — 를 유지하며, **바로 하루 전**
    `http-status-advertised` 가드가 등재됐을 때 "(2026-09-26 보탬)" 각주로 새 선례를 기록해 두었다(그 표는 "2026-09-14 시점
    모집단이라 이 가드를 세지 않는다" 는 캐버트와 함께).
  - 상세: `forbidden-response-codes` 가드는 `http-status-advertised` 와 같은 방식(swagger.md 자기-등재 선례)으로 두 번째
    카운트 대상이 되는데, 이 draft/구현 plan 어디에도 그 트래커 항목에 각주를 보태는 작업이 없다. 이 트래커 항목이 바로 전날
    같은 패턴에 각주를 남긴 선례가 있는 만큼, 이번에도 남기지 않으면 "14/5/9" census 가 착지 직후 다시 틀린 채로 남고, (b) 를
    판단할 다음 사람이 두 번째 선례(같은 문서가 반복해서 자기 가드를 등재)를 놓치게 된다.
  - 제안: 구현 plan(`forbidden-desc-codes.md`) 체크리스트의 "트래커 항목 닫기" 단계에서, 위 두 트래커 항목 — «120곳» 항목(닫는
    대상)과 «신규 repo-guard 미등재» 항목(각주 대상) — 을 모두 건드릴 것. 후자는 닫지 않고 `http-status-advertised` 때와 같은
    한 줄 각주만 보탠다.

- **[INFO]** integrations 4곳의 403 설명 처방이 별도 plan 의 열린 RBAC 결정과 같은 라우트를 겨눈다
  - target 위치: `plan/in-progress/forbidden-desc-codes.md` §실측 표 — "integrations «editor … 또는 Organization 통합의 변경에
    Admin …» 4곳" 행 (target spec draft 는 이 처방을 그대로 반영해 §5-4 본문·헬퍼 이름을 결정)
  - 관련 plan: `plan/in-progress/integration-personal-owner-followup.md` "Viewer 가 자기 personal 을 만들고 · 이름을 바꾸고 ·
    rotate · 삭제하지 못한다" 항목 — `@Roles('editor')` 를 그대로 둘지 내릴지가 **아직 planner 결정 대기**다.
  - 상세: 두 plan 이 같은 라우트(통합 create/update/rotate/remove)를 다른 축에서 건드린다 — 이쪽은 "설명 문구가 실제 코드를
    반영하는가", 저쪽은 "그 실제 코드(요구 역할)가 맞는가". target 의 처방은 실제 결정을 내리지 않고 현재 `@Roles()` 값을 그대로
    문서화할 뿐이고, 신설 가드도 reflection 기반이라 나중에 그 역할 요구가 바뀌면(Viewer 로 완화되거나 표가 Editor 로 확정되거나)
    가드가 설명-코드 불일치를 자동으로 RED 로 잡아 후속 수정을 강제한다 — 구조적으로 자기-교정된다.
  - 제안: 차단 사유는 아니다. 다만 `integration-personal-owner-followup.md` 의 그 항목이 나중에 착수될 때, 담당자가 "가드가
    이미 있으니 설명 갱신은 가드가 알려준다" 는 것을 알도록 그 항목에 한 줄 포인터를 남기면 다음 사람의 탐색 비용이 준다.

- **[INFO]** NestJS 업그레이드 reflection 회귀 체크리스트가 새 reflection 표면을 아직 모른다
  - target 위치: `plan/in-progress/forbidden-desc-codes.md` §방향 — 저장소 가드가 `@ApiForbiddenResponse` 의
    `swagger/apiResponse` 메타데이터(reflection)를 읽어 판정한다는 설계
  - 관련 plan: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C "착수 시 반드시 검증할 것 — reflection 보안 회귀" —
    `RolesGuard`/`@WorkspaceId()` 가 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에 의존한다는 이유로 업그레이드 재개 시 기존 3
    스위트(`workspace.decorator.spec` · `workspace-reflection-canary.spec` · `roles.guard.spec`)의 회귀만 명시 추적한다.
  - 상세: 신설 가드는 `@nestjs/swagger` 자신의 메타데이터 저장 형식에 기대는 **네 번째** reflection 소비처가 된다(대상은
    다르지만 "Nest 내부 표현이 바뀌면 조용히 깨질 수 있다" 는 같은 위험군). nestjs-v12 plan 은 현재 상류 미대응으로 보류 중이라
    당장 반영이 급하지 않지만, 그 plan 의 §C 목록에 이 가드가 없다는 사실 자체는 실측이다.
  - 제안: 급하지 않음 — nestjs-v12 plan 재개 시점에 §C 목록에 `forbidden-response-codes` 계열 스위트를 추가하는 것으로 충분.
    지금 target/구현 plan 을 고칠 필요는 없다.

## 요약

target spec draft 는 `spec/data-flow/12-workspace.md` 의 이미 확정된 채택안(비멤버는 항상 `NOT_A_MEMBER`)을 그대로 옮기고,
`swagger.md` 가 자기 조항을 세는 가드를 `code:` 에 올려 온 최근 선례(`http-status-advertised`, #1400 계열)를 그대로 따른다 — 미해결
결정을 일방적으로 내리거나 우회하는 지점은 찾지 못했다. 유일한 실질적 갭은 같은 트래커 파일 안의 별도 항목(repo-guard `code:` 등재
census)이 이번 등재로 즉시 stale 해지는데 그 각주가 반영되지 않은 것 — 바로 전날 같은 트래커가 같은 패턴에 각주를 남긴 선례가 있어
누락이 눈에 띈다. 나머지 둘(integrations RBAC 열린 결정, nestjs-v12 reflection census)은 구조적으로 자기-교정되거나 시급하지 않은
참고 사항이다.

## 위험도

LOW
