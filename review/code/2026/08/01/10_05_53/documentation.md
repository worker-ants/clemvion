STATUS=success 문서화 리뷰 완료 — WARNING 3건, INFO 1건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — 감사 로깅 커버리지 확장 (workflow/trigger/schedule/model_config)

## 발견사항

- **[WARNING]** 감사 로깅 커버리지 확장이 spec/plan SoT 4곳과 동기화되지 않음 — 방금 구현이 끝난 기능이 spec 상으로는 여전히 "미구현"으로 잘못 서술된 상태로 남음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-44`(신규 헤더 주석 — "workflow/trigger/schedule/model_config 의 **CRUD** 액션은 spec-sync-auth-gaps §4.1 로 구현됐다 (2026-08-01)") ↔ `spec/data-flow/1-audit.md:82-85`, `spec/5-system/1-auth.md:429-438`, `spec/conventions/audit-actions.md:56-59`, `plan/in-progress/spec-sync-auth-gaps.md:15`
  - 상세: 이번 diff 는 `AUDIT_ACTIONS` 에 workflow/trigger/schedule/model_config CRUD 13개 액션을 추가하고 4개 서비스(`workflows.service.ts`/`triggers.service.ts`/`schedules.service.ts`/`model-config.service.ts`)에 실제 `AuditLogsService.record()` 호출을 배선해 구현을 완료했다. 그런데 이 저장소가 "정보 저장 위치 단일 진실 원칙"으로 명시한 spec/plan SoT 4곳은 여전히 예전 상태 그대로다(직접 `Read`/`grep` 으로 diff 후 현재 상태를 확인):
    - `spec/data-flow/1-audit.md:82-85` — "**여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다"는 문장이 그대로 남아 있다(사실과 다름 — 지금은 4개 모듈 모두 import 하고 실제로 기록한다).
    - `spec/5-system/1-auth.md:429-438` — 13개 액션 전부가 "**Planned (미구현 — 목표 커버리지)**" 표에 그대로 있다.
    - `spec/conventions/audit-actions.md:56-59` — workflow/trigger/schedule/model_config 4행의 상태 컬럼이 모두 "미구현".
    - `plan/in-progress/spec-sync-auth-gaps.md:15` — "**§4.1 감사 로깅 커버리지 갭**" 체크박스가 `[ ]` 그대로.

    이 diff 를 만든 developer 는 CLAUDE.md 규약상 `spec/` 이 read-only 라 이 문서들을 직접 고칠 권한이 없다(구현 중 spec 변경 필요 시 project-planner 로 위임하는 것이 정책) — 즉 이 자체가 코드의 결함은 아니다. 하지만 이 위임이 아직 일어나지 않아, 지금 시점 기준으로 spec 은 "실제로 구현된 기능을 미구현이라고" 사실과 다르게 서술하고 있다. 더 나아가 이 정확한 시나리오는 이번 diff 에 함께 포함된 사전 `--impl-prep` consistency-check(`review/consistency/2026/08/01/09_11_58/SUMMARY.md` 권장 조치 4)이 이미 예견해 "구현 완료 시 4개 SoT 를 한 커밋에서 동시 갱신" 하라고 명시적으로 권고한 바로 그 후속 조치인데, 아직 반영되지 않았다.

    덧붙여 이번 구현은 `workflow.executed` 를(보존 정책 미정을 이유로) 의도적으로 범위에서 제외하는 **새로운 설계 결정**을 내렸는데, 그 근거는 오직 `audit-action.const.ts:38-43` 소스 주석에만 있고 spec 어디에도 반영돼 있지 않다 — spec 만 보는 독자·다음 project-planner 세션은 이 결정 자체를 알 도리가 없다.

    마지막으로, 이 4곳을 갱신할 때 `spec/2-navigation/2-trigger-list.md:182`("API 게이트는 ... `trigger.delete` permission 으로 보호되며 audit log 의 `trigger.delete` action 항목으로 기록된다")도 함께 고쳐야 한다 — 이 문서는 이전엔 "미구현을 이미 구현된 것처럼" 서술해 문제였는데(직전 `cross_spec.md` WARNING), 이번 구현으로 "기록된다"는 대전제는 사실이 됐지만 정작 **액션 문자열 자체가 틀렸다**: 실제 구현은 `AUDIT_ACTIONS.TRIGGER_DELETED = 'trigger.deleted'`(과거분사, `-d` 로 끝남)인데 문서는 `trigger.delete`(현재형)라고 쓰고 있다.
  - 제안: (project-planner 턴) 아래를 한 커밋에서 동시 갱신 — (1) `spec/data-flow/1-audit.md` §1.1 "커버리지 갭" 문단을 구현 완료 반영으로 수정하고 `workflow.executed` 제외 사유(보존 정책 미정)를 Rationale 에 남긴다, (2) `spec/5-system/1-auth.md` §4.1 Planned 표에서 13개 액션을 "구현된 액션" 표로 이동(`workflow.executed` 만 Planned 잔류), (3) `spec/conventions/audit-actions.md` §3 상태 컬럼 4행을 "구현"으로, (4) `plan/in-progress/spec-sync-auth-gaps.md:15` 체크. 여유가 되면 `spec/2-navigation/2-trigger-list.md:182,252` 의 `trigger.delete`→`trigger.deleted` 오기와 잔여 표현도 같이 정정.

- **[WARNING]** CHANGELOG.md 미기재 — 이 저장소의 확립된 관행과 어긋남
  - 위치: `CHANGELOG.md`(이번 diff 에 변경 없음) ↔ `codebase/backend/src/modules/audit-logs/audit-action.const.ts`, `.../workflows/workflows.service.ts` 등 4개 모듈 13개 액션 신규 구현
  - 상세: 이 저장소는 사용자 대면 변경에 `CHANGELOG.md` `## Unreleased` 항목을 동반하는 것이 확립된 관행이다 — `git log --oneline -- CHANGELOG.md` 로 확인한 최근 이력이 매 유의미한 fix/feat 마다 상세한 "무엇을/왜" 섹션을 쌓고 있고, 심지어 이 관행을 지키지 않았다가 과거 review 라운드에서 documentation 리뷰어가 직접 지적해("W9(documentation) CHANGELOG 에 이 PR 체인 3개 축 반영(7R 지적 후 3라운드 이월)") 해소된 선례가 있다(커밋 `dc81d21c9`, `9e73595a4` 는 실제로 `docs(changelog)` 서브커밋을 포함). 감사 로그는 `GET /audit-logs` API 로 워크스페이스 admin/owner 가 직접 열람하는 사용자 대면 데이터이므로, 이번 커버리지 확장(4개 모듈 13개 액션, 즉 지금까지 감사 로그에 전혀 안 찍히던 워크플로우·트리거·스케줄·모델설정 변경이 이제 찍히기 시작함)은 이 관행이 요구하는 "사용자 대면 변경"에 해당하는데 diff 에 `CHANGELOG.md` 변경이 없다.
  - 제안: `CHANGELOG.md` 최상단에 "## Unreleased — 감사 로깅 커버리지 확장: workflow/trigger/schedule/model_config CRUD" 섹션을 추가하고, 어떤 액션이 새로 기록되는지·`workflow.executed` 는 왜 제외됐는지(보존 정책 미정) 요약.

- **[WARNING]** 죽은 코드 + 그 코드를 가리키는 주석의 위치 오류 — `triggers.service.spec.ts`
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2166-2170`
  - 상세: `// createBaseProviders 는 모듈 레벨이라 공유 mock 을 못 받는다 — 여기서 override.` 주석 바로 아래에
    ```ts
    const idx = moduleRef as unknown as {
      container?: unknown;
    } as unknown as never;
    void idx;
    ```
    가 있는데, 이 4줄은 `idx` 를 선언 즉시 `void` 로 버릴 뿐 실제로 아무 override 도 수행하지 않는 죽은 코드다(더블 캐스트로 `never` 타입을 만든 뒤 곧바로 discard). 실제 override(진짜 주입된 `AuditLogsService` mock 인스턴스를 가져오는 동작)는 두 줄 뒤 `auditLogs = moduleRef.get(AuditLogsService) as unknown as { record: jest.Mock }` 에서 일어나며, 그 줄에는 별도로 정확한 주석("실제 주입된 인스턴스를 잡아 단언 대상으로 삼는다")이 붙어 있다. 즉 "여기서 override" 주석이 가리키는 지점과 실제 override 가 일어나는 지점이 어긋나 있어, 이 블록을 보는 사람이 `idx` 관련 코드가 override 에 필요하다고 오인해 남겨두거나 다른 파일로 복제해갈 위험이 있다(`grep` 확인 결과 이 패턴은 `codebase/backend/src/modules/` 전체에서 이 파일 한 곳뿐 — 아직 퍼지지 않았다).
  - 제안: `const idx = ...; void idx;` 4줄을 삭제하고, "createBaseProviders 는 모듈 레벨이라 공유 mock 을 못 받는다 — 여기서 override." 주석을 실제 override 가 일어나는 `auditLogs = moduleRef.get(AuditLogsService)...` 줄 바로 위로 옮기거나 그 줄의 기존 주석과 합친다.

- **[INFO]** `recordAudit` 설계 근거 주석이 spec 대신 review 세션 산출물 경로를 인용
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:41-43`
  - 상세: "...정책 결정과 묶여야 하므로 별도 항목으로 분리했다 (impl-prep consistency 2026/08/01 09_11_58 INFO 6 이 같은 결론)." — 인용 자체는 정확하다(해당 세션의 `review/consistency/2026/08/01/09_11_58/SUMMARY.md`·`plan_coherence.md` INFO #6 내용과 대조해 확인됨). 다만 `review/**` 는 이 저장소의 "정보 저장 위치" 표에서 SoT 가 아니라 시점성 감사 산출물이다. 이 근거(workflow.executed 를 보존 정책 미정으로 제외한 이유)가 소스 코드 주석에만 유일하게 남으면, 위 WARNING 1 이 지적한 spec 동기화가 이뤄질 때 함께 spec 의 `## Rationale` 섹션으로 승격되지 않는 한 spec 만 보는 독자는 찾을 수 없다.
  - 제안: 위 WARNING 1 의 spec 동기화 작업 시 이 근거를 `spec/data-flow/1-audit.md` 또는 `spec/5-system/1-auth.md` 의 Rationale 로도 옮겨 적을 것(코드 주석은 그대로 유지해도 무방).

## 요약

새로 추가된 소스 코드 자체의 문서화 품질은 이 저장소 평균을 상회한다 — `audit-action.const.ts` 헤더의 명명·시제 규약 설명, 4개 서비스(model-config/schedules/triggers/workflows)에 반복되는 `recordAudit` 헬퍼의 JSDoc(포지셔널 인자 스왑 위험을 실제 선례 `auth-configs.service.ts` 의 "W-1" 주석과 정확히 대조해 인용 — grep 으로 실재 확인함), 트랜잭션 커밋-후 기록·TypeORM `remove()` 의 PK 소실을 설명하는 인라인 주석, 테스트 파일 전반에 반복되는 "감사 로깅은 부수 효과이므로 mock 한다" 주석까지 모두 근거가 명확하고 구체적이다. Swagger 데코레이터·컨트롤러 문서도 기존 패턴과 일관되게 유지되어 API 문서 자체에는 문제가 없다(`@CurrentUser('sub') userId` 는 요청 바디에 노출되지 않는 파라미터라 Swagger 갱신 불요). 다만 이 diff 는 코드 레벨에서는 완결됐지만, 이 저장소가 명시한 SoT 인 `spec/data-flow/1-audit.md`·`spec/5-system/1-auth.md §4.1`·`spec/conventions/audit-actions.md §3`·`plan/in-progress/spec-sync-auth-gaps.md` 4곳을 전혀 건드리지 않아, 방금 완료한 기능이 spec 상으로는 여전히 "미구현"으로 잘못 서술되는 상태가 됐다 — 사전 consistency-check 가 이미 예견하고 명시적으로 권고했던 후속 조치가 아직 이행되지 않은 것이다. 사용자 대면 신규 감사 커버리지에 대한 `CHANGELOG.md` 항목도 이 저장소의 확립된(과거 리뷰로 강제된 바 있는) 관행과 달리 누락됐다. 이 두 항목은 코드 자체의 결함이라기보다 developer 권한 밖(project-planner 턴 필요)의 후속 조치 누락이지만, 방치 시 spec 이 "구현된 기능을 미구현"이라 오기술하는 상태로 남아 실질적 혼선을 일으킬 수 있어 조속한 처리를 권장한다. 추가로 신규 테스트 파일 한 곳(`triggers.service.spec.ts`)에 죽은 코드와 그 코드를 가리키는 오도적 주석이 남아 있어 함께 정리를 권장한다.

## 위험도

MEDIUM
