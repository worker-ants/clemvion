# 문서화(Documentation) Review — audit-logging (workflow/trigger/schedule/model_config CRUD 감사)

## 발견사항

### [CRITICAL] SoT spec 4곳이 "미구현"이라 서술 — 실제로는 이번 PR로 구현 완료됨 (spec drift)

- 위치:
  - `spec/5-system/1-auth.md:414-438` (§4.1 "현재 구현된 액션" 표에 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 가 없고, 436-438행은 "Planned (미구현)" 표·"설정 CRUD 감사 로깅 자체는 현재 미구현이다" 로 명시)
  - `spec/5-system/1-auth.md:765-786` (§4.1.A — "모두 미구현이라 코드 의존이 없어" 서술, 시제만 확정하고 구현 여부는 갱신 안 됨)
  - `spec/data-flow/1-audit.md:82-88` (§1.1 — "여전히 미구현이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다")
  - `spec/conventions/audit-actions.md:56-59` (workflow/trigger/schedule/model_config 행이 상태 컬럼 "미구현")
  - `spec/2-navigation/2-trigger-list.md:182,252` (`trigger.delete`/`trigger.update` — 액션명도 실제 구현(`trigger.deleted`/`trigger.updated`, 과거분사)과 다름)
  - 대비되는 코드 측 근거: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-36`("workflow/trigger/schedule/model_config 의 **CRUD** 액션은 spec-sync-auth-gaps §4.1 로 구현됐다 (2026-08-01)"), `codebase/backend/src/modules/model-config/model-config.module.ts:11`, `codebase/backend/src/modules/schedules/schedules.module.ts:23`, `codebase/backend/src/modules/triggers/triggers.module.ts:27`, `codebase/backend/src/modules/workflows/workflows.module.ts:23` (모두 "AuditLogsModule: `<resource>`.\* CRUD 감사 기록 (1-auth §4.1)." 주석으로 §4.1 을 근거로 인용)
- 상세: 이번 PR 은 `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.create/update/delete/set_default` 13개 감사 액션을 실제로 구현했고(`AUDIT_ACTIONS` 추가 + 4개 서비스의 `recordAudit` 호출), 코드 주석들은 하나같이 "1-auth §4.1" 을 근거로 인용한다. 그런데 정작 `spec/5-system/1-auth.md` §4.1 자체는 여전히 이 4개 리소스군을 "Planned(미구현)" 표에 두고 있고, `model_config.service.ts 는 AuditLogsService 를 호출하지 않는다` 같은 지금은 **거짓**이 된 문장이 그대로 남아 있다. `spec/data-flow/1-audit.md` §1.1 도 "4개 모듈에 AuditLogsService import 가 전혀 없다"고 단정하는데 이 역시 사실이 아니게 됐다. 게다가 `AuditLogDto`(Swagger 공개 응답 스키마, `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:28-40`)의 `action` 필드 설명이 "(spec/5-system/1-auth.md §4.1)" 을 참조 링크로 명시하므로, API 문서(Swagger UI)를 통해 §4.1 을 따라간 외부 소비자는 "이 액션들은 아직 없다"는 잘못된 인상을 받는다. 즉 이번 diff 는 spec/ 을 건드리지 않았지만(개발자 권한상 정당 — `spec/` read-only), 그 결과 SoT 문서 4곳이 병합 즉시 사실과 어긋난 상태가 된다.
  - 완화 요인: `plan/in-progress/spec-sync-auth-gaps.md:15-22` 에 "§4.1 감사 로깅 커버리지 갭" 이 "CRUD 13개 구현 완료 (2026-08-01)" 로 체크되어 있고, 곧바로 "spec SoT 4곳 동기화 — planner 턴 필요 (`developer` 는 `spec/` read-only)" 항목이 정확히 이 4개 파일·줄번호를 지목하며 남아 있다. `CHANGELOG.md` 신규 항목도 "SoT: spec/5-system/1-auth.md §4.1, spec/data-flow/1-audit.md §1.1. 추적: plan/in-progress/spec-sync-auth-gaps.md §4.1." 로 이 갭을 명시적으로 인지하고 있다. 즉 프로세스는 올바르게(개발자 스코프 밖 → planner 턴으로 위임) 진행되고 있으나, **그 planner 턴이 실행되기 전까지는 SoT 가 코드보다 뒤처진 상태로 merge 된다.**
- 제안: 이 PR 이 merge 되는 시점(또는 직후)에 `project-planner` 턴으로 위 4개 위치를 한 커밋에서 동시에 갱신할 것 — `1-auth.md` §4.1 Planned→구현 표 이동(+ §4.1.A 미구현 서술 정정), `data-flow/1-audit.md` §1.1 커버리지 갭 문단·표 갱신, `conventions/audit-actions.md` 상태 컬럼 갱신, `2-navigation/2-trigger-list.md` L182/L252 액션명 오기(`trigger.delete`→`trigger.deleted`, `trigger.update`→`trigger.updated`) 정정. `plan/in-progress/spec-sync-auth-gaps.md` 의 해당 체크리스트 항목이 이미 정확한 작업 목록이므로 그대로 실행하면 된다. 이 항목이 실행되기 전까지 spec-coverage 류 자동 감사가 "여전히 갭"으로 오탐할 수 있음도 참고.

### [WARNING] `model-config.controller.spec.ts` 최상단 주석 — "parseKind 가 여러 핸들러에서 쓰인다"는 서술이 사실과 다름 (이번 diff 이전부터 존재, 이번 PR 은 미수정)

- 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts:7-8` ("since parseKind is an internal helper used by multiple handlers")
- 상세: `parseKind` 는 `model-config.controller.ts` 에서 `findAll` 한 곳(`codebase/backend/src/modules/model-config/model-config.controller.ts:85`)에서만 호출된다. `create`/`update` 는 `dto.kind` 를 그대로 쓴다(DTO 자체 검증). "여러 핸들러가 쓴다"는 서술은 부정확 — 아마 과거 리팩터 이전 상태의 잔재로 보인다. 이번 diff 는 이 블록의 `update`/`remove` 테스트에 `userId` 인자만 추가했을 뿐 해당 주석 자체는 건드리지 않았으므로 이번 PR 이 만든 결함은 아니지만, 리뷰 중 발견되어 함께 기록한다.
- 제안: "used by multiple handlers" → "used by the `findAll` handler (kept module-private; not re-exported)" 정도로 정정하거나, 다른 핸들러가 실제로 늘어날 계획이 없다면 문장 자체를 제거.

### [INFO] `ModelConfigService.create()` 는 다른 3개 메서드와 달리 "커밋 직후 기록" 순서 근거 주석이 없음

- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`create()` 내 `await this.recordAudit(...)` 직전, 프롬프트 게이트 기준 284행 부근)
- 상세: 같은 파일의 `update`/`setDefault`/`remove` 는 각각 "config 변경 → 의존 캐시... 통지", "트랜잭션 **커밋 뒤**에 기록한다 — 안에서 남기면 롤백 시...", "kind 를 remove 전에 읽어둔다..." 처럼 기록 시점·순서를 설명하는 주석이 있다. `create()` 만 그런 설명 없이 `recordAudit` 을 바로 호출한다. 실제로는 `create()` 이후 외부 호출이 없어(순수 `maskApiKey` 뿐) 순서 위험이 없지만, 같은 파일 안에서 패턴이 비일관적이라 "왜 create 만 설명이 없지?"라는 의문을 남긴다.
- 제안: 한 줄로 "create 는 이후 실패 가능한 외부 호출이 없어 순서 무관" 정도만 덧붙이면 파일 전체의 W6 패턴 설명이 완결된다 (선택 사항, 낮은 우선순위).

### [INFO] `saveCanvas`/`restoreVersion` 감사 미기록 사유가 호출부(1곳)에만 있고 정의부에는 없음

- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:592`(`saveCanvas`), `:656`(`restoreVersion`) — 정의부에 audit 관련 코멘트 없음. 관련 설명은 `importWorkflow()` 감사 기록 지점(:576-581, "saveCanvas 와 묶어 미뤘는데... 카디널리티 논거는 캔버스 편집마다 발동하는 saveCanvas 에만 해당")에만 존재.
- 상세: `workflow.updated` 가 `saveCanvas`/`restoreVersion`(캔버스 저장·버전 복원) 경로에서는 기록되지 않는다는 사실은 `plan/in-progress/spec-sync-auth-gaps.md:26-27` 에도 별도 항목("`saveCanvas`/`importWorkflow` 감사 기록 — 리뷰 W3... 이번 PR 범위 밖")으로 추적되고 있어 의도적 스코프 제외임은 분명하다. 다만 `saveCanvas`/`restoreVersion` 함수 자체를 읽는 사람은 "왜 여기엔 recordAudit 이 없지"를 `importWorkflow` 주석까지 찾아가야 알 수 있다.
- 제안: `saveCanvas` 정의부에 1줄("캔버스 편집마다 발동 — 카디널리티상 감사 제외, 별도 결정 필요. 추적: spec-sync-auth-gaps.md")을 추가하면 국지적 탐색성이 개선된다 (선택 사항).

## 요약

이번 PR 은 `workflow`/`trigger`/`schedule`/`model_config` 4개 리소스에 대한 감사 로깅 13개 액션을 추가하면서, `AUDIT_ACTIONS` 상수 헤더 독스트링·각 서비스의 `recordAudit` 헬퍼 JSDoc·커밋 순서(W6) 인라인 주석·`CHANGELOG.md` 항목까지 코드 레벨 문서화 품질은 전반적으로 매우 높다(동일 패턴을 4개 모듈에 일관되게 반복하고, "왜 이 순서인가"·"왜 1:1 결합 리소스는 한쪽만 기록하는가"·"왜 workflow.executed 는 제외했는가" 등 근거를 빠짐없이 남겼다). 다만 핵심 결함 하나는 코드가 아니라 **spec SoT 와의 정합성**이다 — `spec/5-system/1-auth.md` §4.1/§4.1.A, `spec/data-flow/1-audit.md` §1.1, `spec/conventions/audit-actions.md`, `spec/2-navigation/2-trigger-list.md` 4곳이 여전히 이 13개 액션을 "미구현/Planned" 으로 서술하고 있어, 이번 merge 직후 SoT 가 코드보다 뒤처진 상태(그리고 `AuditLogDto` Swagger 설명이 그 stale 한 §4.1 을 직접 인용)가 된다. 다행히 이 갭은 `plan/in-progress/spec-sync-auth-gaps.md` 에 정확한 4곳·줄번호로 이미 추적되어 있고 개발자 권한(spec/ read-only) 상 정당하게 planner 턴으로 위임된 것이라, "누락"이 아니라 "다음 턴에서 반드시 닫아야 할 명시적 후속 작업"으로 봐야 한다. 그 외에는 pre-existing stale 주석 1건(이번 diff 미유발)과 사소한 인라인 설명 비일관성 2건뿐이다.

## 위험도

HIGH
