# Rationale 연속성 검토 — spec/data-flow/ (--impl-prep)

## 검토 범위·방법

target 은 `spec/data-flow/` 전체(15개 도메인 문서 + `0-overview.md`)이며, diff 가 아니라 **현재
커밋 상태 그대로**다(번들 내용을 실제 파일과 `diff` 로 대조해 확인). 프롬프트에 컨텍스트 예산으로
생략된 8개 파일(`5-integration.md`·`6-knowledge-base.md`·`8-notifications.md`·
`9-observability.md`·`10-triggers.md`·`13-agent-memory.md`·`14-chat-channel.md`·
`15-external-interaction.md`)은 `Read` 로 직접 열어 확인했다. 워크트리 이름(`audit-logging`)과
`plan/in-progress/spec-sync-auth-gaps.md`("§4.1 감사 로깅 커버리지 갭 — `workflow.*`/`trigger.*`/
`schedule.*`/`model_config.*` 미구현")로 미루어 이번 구현은 감사 로깅 커버리지 확장으로 판단해
`1-audit.md`와 그 cross-reference 망(`5-system/1-auth.md §4.1`·`conventions/audit-actions.md`·
`1-data-model.md §2.18`)을 중점 대조했고, 핵심 사실 주장은 실제 코드(`grep` 대상: `AuditLogsService`
호출부, V001 마이그레이션의 `audit_log` FK 정의)로도 교차검증했다.

## 발견사항

- **[INFO]** `5-integration.md §4` 의 audit 액션 요약이 SoT 대비 1건 누락
  - target 위치: `spec/data-flow/5-integration.md` `## 4. 외부 의존` 표의 `Audit` 행
    (`integration.created/updated/deleted/rotated/reauthorized` 5건 나열)
  - 과거 결정 출처: `spec/data-flow/1-audit.md §1.1` 의 표와 그 아래 문장("이 표가 현재 코드에서
    실제로 기록되는 action 의 SoT 다") — 동일 표는 `integration.scope_changed`(OAuth scope 변경)를
    6번째 액션으로 포함한다.
  - 상세: 코드 확인 결과 `integrations.service.ts` 는 `AUDIT_ACTIONS.INTEGRATION_SCOPE_CHANGED`
    (`integration.scope_changed`)를 실제로 기록한다(`integrations.service.ts:1228`,
    `audit-action.const.ts:41`) — 즉 `1-audit.md` 쪽이 맞고 `5-integration.md §4` 의 요약이
    누락이다. 이 자체는 "기각된 대안 재도입"·"원칙 위반"·"무근거 번복" 은 아니지만, 이 프로젝트가
    바로 전 라운드(`0-overview.md` §3.6 신설, 2026-07-31)에서 "요약표가 SoT 사본이 되어 drift 하는
    것"을 명시적으로 경계했던 패턴과 같은 종류의 사소한 재발이다 — `1-audit.md` 가 스스로를 SoT 로
    선언한 표와, 그 표를 요약해 인용하는 형제 문서(`5-integration.md`)가 사소하게 어긋난 상태.
  - 제안: `5-integration.md §4` Audit 행에 `integration.scope_changed` 추가(6건으로). 감사 로깅
    커버리지 확장 작업(추정 대상)에서 `5-integration.md` 를 함께 손대지 않는다면, 이번 PR 범위 밖
    사소 정정으로 별도 처리해도 무방 — CRITICAL/WARNING 은 아니다.

## 검증했으나 문제 없음으로 판단한 항목 (참고)

- **`1-audit.md` Rationale 4건**(두 테이블 분리·action union 강제/event DB CHECK·swallow+await·
  "cross-cutting concern" 서술 폐기) 모두 본문과 정합하고, "8개 위치(5 service + 3 controller)"
  writer 주장은 실 코드 `grep`(`AuditLogsService` 참조 파일 8개: `workspace-invitations.service.ts`·
  `integrations.service.ts`·`workspaces.service.ts`·`auth-configs.service.ts`·`executions.service.ts`
  ·`webauthn.controller.ts`·`auth.controller.ts`·`users.controller.ts`)와 정확히 일치했다.
  `workflows`/`triggers`/`schedules`/`model-config` 모듈에 `AuditLogsService` 참조 0건도 확인해
  "커버리지 갭 = 미구현" 주장이 사실임을 검증했다 — 이번에 착수할 구현의 출발점(spec 사실관계)이
  왜곡되어 있지 않다.
- **`workspace.deleted` 감사 제외 (구조적 제약) Rationale**: `audit_log.workspace_id` 만
  `REFERENCES workspace(id) ON DELETE CASCADE`(V001 실제 SQL로 확인)이고 `resource_id` 는 FK가
  아닌 순수 UUID 컬럼임을 확인했다 — 이 구조적 제약은 workspace 삭제에만 특유하며, 이번 구현이
  다룰 `workflow.deleted`/`trigger.deleted`/`schedule.deleted` 류 액션에는 동일 문제가 **전이되지
  않는다**(오해하기 쉬운 지점이라 명시 확인함).
- **`audit-actions.md`(명명·시제 3분류 SoT)·`1-auth.md §4.1`/`§Rationale 4.1.A·4.1.B`·
  `1-audit.md`** 삼자가 Planned 액션(`workflow.*`/`trigger.*`/`schedule.*`=과거분사,
  `model_config.*`=현재형 CRUD 예외) 표기·귀속 방식에서 완전히 일치했다 — 세 문서 중 어느 하나가
  다른 명명 규칙을 암시하지 않는다.
- **`12-workspace.md §4` RBAC 요약 vs `1-auth.md §3.2` SoT**: 방금 정정된 6개 열(워크스페이스
  설정/멤버 관리/워크플로우/실행/Model Config/Integration) 전부 대조 결과 일치. 직전 커밋들
  (`9fa06cd4c`·`f9fd3eb54`)이 고친 Critical(viewer 실행 `✓`→`—`)·Warning(LLM/Integration 열
  분리)이 실제로 반영돼 있고, `0-overview.md §3.6`·`3-execution.md` SIGTERM 각주·"명칭 통일 범위"
  Rationale 도 직전 라운드(`review/.../00_17_36/rationale_continuity.md`)가 지적한 INFO(§3.6 근거가
  본문에 산재)까지 해소된 상태로 반영돼 있었다.
- **`9-observability.md` "liveness/readiness probe 분리 (결정 번복)"**: 새 Rationale 을 갖추고
  있을 뿐 아니라, 구 결정을 인용했던 `5-system/3-error-handling.md` 쪽도 함께 갱신되어
  ("구 'liveness probe 용' 결정 번복" 각주 + `data-flow/9-observability.md §1.1` 을 SoT 로 명시)
  양쪽 문서가 어긋나지 않는다.
- `6-knowledge-base.md`·`5-integration.md`·`8-notifications.md`·`9-observability.md` 의 나머지
  "번복/기각/폐기/하향" 표기 지점(HNSW wide 회수, OAuth callback 즉시 insert 폐기, 초대 이메일
  channel 하향 등)도 각각 새 근거를 동반하고 있어 criterion 3("무근거 번복")에 해당하지 않는다.

## 요약

`spec/data-flow/` 는 최근 3개 커밋(`9fa06cd4c`·`f9fd3eb54`·`0d20a9cc9`)에 걸쳐 RBAC 표·SIGTERM
분류·명칭 통일을 이미 집중 정비했고, 이번 검토에서 그 결과물이 실제로 안정화됐음을 재확인했다 —
과거 Rationale 에서 명시적으로 기각된 대안의 재도입, 합의된 설계 원칙(action union 강제·event DB
CHECK·swallow+await·workspace-scoped audit 구조 등) 위반, 새 근거 없는 결정 번복, 기록된 invariant
우회는 발견되지 않았다. 이번에 착수할 감사 로깅 커버리지 확장(workflow/trigger/schedule/
model_config)의 근거가 되는 `1-audit.md`·`1-auth.md §4.1`·`conventions/audit-actions.md` 삼각
축은 서로 정합하며 코드 실측과도 일치해, 이 spec 을 기반으로 구현에 착수해도 안전하다. 유일한
결함은 형제 문서(`5-integration.md §4`)가 `1-audit.md` 가 스스로 SoT 로 선언한 액션 목록을 요약
인용하면서 1건(`integration.scope_changed`)을 누락한 것으로, Rationale 위반이라기보다 SoT 사본
drift 의 소규모 재발이라 INFO 로만 남긴다.

## 위험도

LOW
