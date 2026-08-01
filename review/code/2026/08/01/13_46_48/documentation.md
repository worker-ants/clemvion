# 문서화(Documentation) 리뷰 — audit-logging (workflow/trigger/schedule/model_config 감사 커버리지)

## 발견사항

- **[WARNING]** spec SoT(`5-system/1-auth.md` §4.1, `data-flow/1-audit.md` §1.1)가 이번 구현으로 이미 사실과 어긋난 상태 — 단, 이미 추적·인지된 항목
  - 위치: `spec/5-system/1-auth.md:414`-`423`(현재 구현된 액션 표 — workflow/trigger/schedule/model_config 미포함), `spec/5-system/1-auth.md:429`-`438`(Planned 표 — 위 4개 리소스가 여전히 "미구현"으로 남아 있음) / `spec/data-flow/1-audit.md:82`-`88`("**여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다"는 서술)
  - 상세: 이번 diff 로 `workflows.service.ts` · `triggers.service.ts` · `schedules.service.ts` · `model-config.service.ts` 4개 서비스 모두 `AuditLogsService` 를 주입하고 `recordAudit()` 를 CRUD 경로에 배선했다(`codebase/backend/src/modules/*/*.service.ts` 각 파일의 `recordAudit` 헬퍼 + `AUDIT_ACTIONS.WORKFLOW_CREATED` 등 13개 액션 호출부). 따라서 위 두 spec 문서의 "여전히 미구현" / "Planned" 서술은 코드와 어긋난 상태다. 다만 이 gap 은 **developer 가 놓친 게 아니라 규약상 의도된 분리**다 — `CLAUDE.md` 는 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이라고 못박고 있고, 실제로 `audit-action.const.ts` 의 새 독스트링(대상 파일 1, gate 32-36)과 `CHANGELOG.md`("SoT: `spec/5-system/1-auth.md` §4.1, `spec/data-flow/1-audit.md` §1.1. 추적: `plan/in-progress/spec-sync-auth-gaps.md` §4.1.") 양쪽에서 이 gap 을 명시적으로 인지·기록하고 있다. `plan/in-progress/spec-sync-auth-gaps.md` 에도 "**spec SoT 4곳 동기화 — planner 턴 필요**"가 미체크 항목으로 남아 있다(`5-system/1-auth.md §4.1` Planned→구현 이동 · `data-flow/1-audit.md §1.1` · `conventions/audit-actions.md §3` · `2-navigation/2-trigger-list.md` L182/L252 오탈자 포함). 즉 실제 drift 는 있으나 원인·해소 경로가 이미 문서화돼 있다.
  - 제안: 이 리뷰 라운드에서 developer 가 직접 조치할 항목은 아니다(spec/ read-only 규약). 다음 project-planner 턴에서 `plan/in-progress/spec-sync-auth-gaps.md` 의 "spec SoT 4곳 동기화" 체크박스를 실행해 4개 문서를 한 커밋에서 동시에 갱신할 것을 권고한다(plan 자체가 "한 커밋에서 동시에 고쳐야 재drift 하지 않는다"고 이미 근거를 남겨둠).

- **[INFO]** `ModelConfigService.create()` 의 `recordAudit` 호출에 다른 3개 메서드(`update`/`setDefault`/`remove`)와 달리 "커밋 후 기록" 근거 주석이 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `create()` 메서드, `saved = ...` 대입(gate 279-283) 직후 `await this.recordAudit({...})` 호출부(gate 284-290)
  - 상세: 같은 파일의 `update()`(gate 334-336, `notifyInvalidated` 관련), `setDefault()`(gate 384 `// 트랜잭션 **커밋 뒤**에 기록한다 — 안에서 남기면 롤백 시 일어나지 않은 일이 감사에 남는다.`)에는 recordAudit 타이밍을 설명하는 주석이 붙어 있고, `schedules.service.ts`/`triggers.service.ts`/`workflows.service.ts` 의 대응 메서드도 전부 동일한 "커밋 직후 기록" 주석을 갖고 있다. 그런데 `create()` 는 `dto.isDefault` 분기에서 `saveWithDefaultSwap`(내부적으로 `this.repo.manager.transaction` 사용)을 타므로 동일한 롤백-안전성 논거가 적용됨에도 주석이 빠져 있다. 기능상 버그는 아니다(코드 배치 자체는 이미 트랜잭션 커밋 뒤다) — 순수 문서 일관성 갭.
  - 제안: `setDefault()`/`remove()` 와 동일한 1줄 주석("트랜잭션 커밋 뒤 기록 — 롤백 시 일어나지 않은 일이 감사에 남지 않도록")을 `create()` 의 `recordAudit` 호출 앞에 추가.

## 확인된 양호 사항 (참고)

- `AUDIT_ACTIONS` 신규 13개 액션에 대해 명명 규약(과거분사 vs CRUD 현재형)·타이밍 정책(커밋 후 기록)·1:1 결합 리소스(Schedule/Trigger) 중복 감사 방지·`workflow.executed` 의도적 제외 사유가 `audit-action.const.ts` 모듈 docstring(gate 32-51)에 상세히 문서화되어 있고, `CHANGELOG.md`("Unreleased — 감사 로깅 커버리지 확장: workflow / trigger / schedule / model_config")에도 동일 내용이 요약돼 있어 변경 이력 요건을 충족한다.
- `audit-log-response.dto.ts` 의 Swagger `description` 이 액션 목록을 하드코딩하던 기존 방식(리소스 늘 때마다 낡던 패턴, 실제로 두 번 낡았다고 자인)에서 "단일 진실은 `AUDIT_ACTIONS`" 로 가리키는 방식으로 개선됐다 — 문서 drift 재발을 구조적으로 줄이는 좋은 변경.
- 4개 서비스(`workflows`/`triggers`/`schedules`/`model-config`) 모두 `recordAudit` private 헬퍼에 "positional 인자면 동일 타입 스왑을 컴파일러가 못 잡는다"는 동일 근거의 JSDoc 을 일관되게 달아뒀고, 각 모듈의 `AuditLogsModule` import 에도 `// AuditLogsModule: <resource>.* CRUD 감사 기록 (1-auth §4.1).` 주석이 통일된 스타일로 붙어 있다.
- 새로 추가된 컨트롤러/서비스 spec 파일들의 인라인 주석(예: `schedules.controller.spec.ts` 상단 독스트링, `triggers.service.ts` update() 의 "처음엔 syncScheduleActivation 뒤에 뒀다가 4차 리뷰가 잡았다" 등)이 "왜 이 순서인가"를 설명해 재발 방지 목적의 회귀 근거로 충분히 기능한다.
- README 업데이트 필요성: 없음 — 백엔드/루트 README 어디에도 감사 액션 목록을 나열하지 않으므로 갱신 대상 아님.
- API 문서(Swagger): 감사 로깅은 API 응답 계약(엔드포인트 시그니처)을 바꾸지 않는 부수 효과이므로 컨트롤러의 `@ApiOperation`/`@ApiResponse` 갱신은 불필요하며 실제로도 손대지 않았다 — 적절.

## 요약

이번 diff 자체의 문서화 수준은 높다 — 신규 `recordAudit` 헬퍼·타이밍 결정·명명 규약·중복 방지 규칙이 각 서비스 파일과 `audit-action.const.ts`, `CHANGELOG.md` 에 걸쳐 일관되고 근거 있게 기록돼 있고, Swagger DTO 설명도 drift 에 강한 형태로 개선됐다. 다만 spec 레벨에서는 `5-system/1-auth.md` §4.1 과 `data-flow/1-audit.md` §1.1 이 아직 "workflow/trigger/schedule/model_config 감사 미구현"이라고 서술해 코드와 어긋나 있다 — 이는 developer 의 문서화 누락이 아니라 `spec/` read-only 규약에 따른 의도된 분리이며, 코드 주석·CHANGELOG·`plan/in-progress/spec-sync-auth-gaps.md` 세 군데 모두에서 명시적으로 추적되고 있으므로 다음 project-planner 턴에서 4개 spec 문서를 동시 갱신하면 해소된다.

## 위험도

LOW
