# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 코드 자체의 결함(보안/동시성/DB/API계약/의존성/scope)은 전 항목 NONE~LOW 로 깨끗하나, **SoT spec 문서 4곳이 "미구현/Planned"로 서술한 13개 감사 액션이 실제로는 이번 PR 로 구현 완료**되어 발생한 `[SPEC-DRIFT]`(documentation-reviewer 는 이를 **CRITICAL** 로, requirement-reviewer 는 동일 사실을 `[SPEC-DRIFT]` 태그 WARNING 으로 각각 판정)와, 감사 테스트 커버리지 비대칭(testing-reviewer MEDIUM)이 전체 등급을 끌어올렸다. 이 CRITICAL/SPEC-DRIFT 항목은 **코드 revert 대상이 아니라 다음 `project-planner` 턴에서 spec 4곳을 동기화해야 하는 항목**이며, `plan/in-progress/spec-sync-auth-gaps.md` 에 이미 정확한 파일·줄번호로 추적되어 있다. 이 사실이 낮은 위험도로 오독되지 않도록 상단에 명시한다.

**라우터 강제 화이트리스트(maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.**

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] SoT spec 4곳이 신규 13개 감사 액션(`workflow/trigger/schedule.{created,updated,deleted}`, `model_config.{create,update,delete,set_default}`)을 여전히 "미구현/Planned"로 서술하지만 실제로는 이번 PR 로 구현 완료됨. `trigger-list.md` 는 액션명 자체도 오기(`trigger.delete`/`trigger.update` → 실제는 `trigger.deleted`/`trigger.updated`). `AuditLogDto.action` 의 Swagger `description` 이 이 stale 한 §4.1 을 직접 참조해, API 문서를 보는 외부 소비자가 "아직 없는 기능"으로 오인할 수 있음(documentation-reviewer 가 이 노출 경로를 근거로 CRITICAL 판정) | `spec/5-system/1-auth.md:414-438,765-786` · `spec/data-flow/1-audit.md:82-88` · `spec/conventions/audit-actions.md:56-59` · `spec/2-navigation/2-trigger-list.md:182,252` (대비 코드: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-36`) | 코드 조치 불요. `project-planner` 턴에서 4개 spec 문서를 한 커밋으로 동시 갱신: (1) `1-auth.md` §4.1 Planned→구현 이동 + §4.1.A 서술 정정, (2) `data-flow/1-audit.md` §1.1 커버리지 갭 문단 갱신, (3) `conventions/audit-actions.md` 상태 컬럼 갱신, (4) `2-trigger-list.md` L182/L252 액션명 오기 정정. `plan/in-progress/spec-sync-auth-gaps.md` 에 이미 동일 항목이 체크리스트로 등재됨(planner 턴 대기 중) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `model-config` 의 `isDefault:true` 트랜잭션 경로(create/update, `saveWithDefaultSwap` 재사용)에 감사 순서/존재 테스트가 여전히 0건 — `setDefault` 에만 순서·실패 테스트가 있고 같은 헬퍼를 쓰는 나머지 두 진입점은 미방문 | `codebase/backend/src/modules/model-config/model-config.service.spec.ts:924-1045` (대상 코드: `model-config.service.ts:279-283`(create), `:323-331`(update)) | `setDefault` 의 `order: string[]` 순서/실패 테스트 패턴을 `create(isDefault:true)`·`update(isDefault:true)` 에도 동일 적용 |
| 2 | 테스트 | 컨트롤러→서비스 `userId` 배선(positional 인자 순서 스왑 가드) 을 확인하는 컨트롤러 유닛테스트가 4개 모듈 중 model-config 의 update/remove 2곳에만 존재. schedules 는 controller spec 파일 자체가 없고, triggers/workflows 의 create/update/remove/duplicate 도 미검증 | `triggers.controller.spec.ts`(rotateBotToken 만 존재) · `workflows.controller.spec.ts`(create/update/remove/duplicate describe 없음) · `schedules.controller.spec.ts`(파일 부재) · `model-config.controller.spec.ts:166,190`(update/remove 만 존재) | model-config 의 update/remove 검증 패턴을 나머지 3개 모듈의 create/update/remove(+duplicate)로 확장 |
| 3 | 테스트 | `triggers.service.ts` 의 감사 describe 블록만 "저장 실패 시 감사 미기록" 불변식 테스트가 없음 — 자매 모듈(model-config/schedules/workflows)은 각 1건 이상 보유. 바로 이 파일이 과거 라운드에서 실제 순서 버그(C1, 이번엔 수정됨)가 났던 곳이라 회귀 방지 가치가 큼 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2245-2426` | `triggerRepository.save` 를 `mockRejectedValue` 로 실패시켜 `recordAudit` 미호출을 확인하는 테스트를 create/update(가능하면 remove 도)에 최소 1개씩 추가 |
| 4 | 유지보수성 | `recordAudit` private wrapper(+동일 JSDoc)가 4개 서비스 파일(기존 auth-configs 포함 5곳)에 사실상 동일한 shape 으로 중복 구현됨 — "진짜 동일 보일러플레이트"로 추출 후보 기준에 부합(architecture-reviewer 도 동일 지점을 크로스커팅 관심사 미분리로 별도 지적) | `model-config.service.ts:239` · `schedules.service.ts:141` · `triggers.service.ts:209` · `workflows.service.ts:174` (원본: `auth-configs.service.ts:78`) | `resourceType`(+`details` shape)만 파라미터화한 공용 팩토리(`createAuditRecorder(auditLogsService, resourceType)`)로 추출하고 JSDoc 은 한 곳에만 남김. `RESOLUTION.md`(10_05_53, W4)가 이미 "6번째 리소스 추가 시점 재검토"로 유예 결정한 사안이라 이번 PR 을 막을 사유는 아니나, 5곳으로 늘어난 현 시점에 재검토 가치가 커짐 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `TriggersService` 시크릿/토큰 회전 3개 메서드(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)에 감사 로깅 없음 — PR 스코프(CRUD-only) 밖, 기존 갭 | `triggers.service.ts:899,935,980` | 후속 트랙에서 `trigger.notification_secret_rotated` 류 액션 추가 검토 |
| 2 | 보안 | `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재 — viewer 도 bot token 회전 가능(default-allow). PR 범위 밖 기존 갭 | `triggers.controller.ts:229` | 의도된 설계인지 확인 후 `@Roles('editor')` 추가 검토 |
| 3 | 보안/DB | FK CASCADE·애플리케이션 레벨 연쇄 삭제로 사라지는 자매 리소스(Trigger↔Workflow, Schedule↔Trigger)는 그 삭제 자체가 감사되지 않음 — "1:1 결합 리소스는 주 리소스만 기록" 설계로 문서화된 의도 | `workflows.service.ts:remove()` · `triggers.service.ts:remove()` · `schedules.service.ts:remove()`, 근거: `audit-action.const.ts` 상단 주석 | 조치 불요(이미 문서화됨) |
| 4 | 보안/DB | 동시 DELETE 요청 시 중복 `*.deleted` 감사 행 가능 + `AuditLogsService.record()` 는 실패를 삼키는 fire-and-forget(감사 신뢰도가 이 단일 지점에 더 넓게 의존하게 됨) | 4개 서비스 `remove()` 전체, `audit-logs.service.ts:72-97` | 조치 불요(기존 트레이드오프). 컴플라이언스 요구 강화 시 outbox 패턴 검토 |
| 5 | 성능/DB | CRUD 뮤테이션마다 동기 audit INSERT 왕복 1회 추가(N+1 아님, 루프 밖 단건). `audit_log` 은 보존정책·pruner 없는 무제한 테이블인데 13개 신규 액션으로 활성 INSERT 표면이 늘어남(`workflow.executed` 는 카디널리티 이유로 의도적 제외, 파일 상단 주석에 이미 트래킹) | `audit-action.const.ts:32-51`, 4개 서비스 각 CRUD 메서드 | 이번 범위 조치 불요. 향후 보존 정책 결정 시 신규 13개 액션도 포함 |
| 6 | 아키텍처 | `WorkflowsService` 내부에서 `userId` 파라미터 위치가 형제 메서드 간 비일관(`create`/`importWorkflow` 는 dto 앞, `update`/`remove`/`duplicate` 는 맨 뒤) — 자매 서비스는 전부 "userId 마지막"으로 일관. 활성 버그는 아님(dto 타입이 달라 대부분 스왑은 tsc 가 잡음) | `workflows.service.ts:191,229,254,277,451` | 다음에 시그니처를 만질 기회에 "userId 마지막" 규약으로 통일 |
| 7 | 아키텍처 | `recordAudit` 의 `action` 파라미터가 서비스별로 좁혀지지 않고 `AUDIT_ACTIONS` 전체 유니온을 받음(ISP 관점 여백) | 4개 서비스 `recordAudit` 시그니처 | 템플릿 리터럴 타입으로 서비스별 액션 서브셋 타입 좁히기 검토(팩토리 추출과 함께) |
| 8 | 유지보수성 | `recordAudit` 의 `details` 파라미터 shape 이 파일마다 제각각(workflows=제네릭, triggers/model-config=고정 필드, schedules=없음) | `workflows.service.ts:174` 외 3곳 | 공용 헬퍼 추출 시 workflows 의 제네릭 shape 기준으로 통일 |
| 9 | 유지보수성 | `TriggersService.create`/`update` 에 이른 반환을 미루기 위한 `let result = saved;` 3줄 패턴이 두 메서드에 반복 | `triggers.service.ts:271,357` | 세 번째 필요 시점에 private 헬퍼로 추출 검토(현재는 무방) |
| 10 | 문서화 | `model-config.controller.spec.ts` 최상단 주석 "parseKind 가 여러 핸들러에서 쓰인다"가 사실과 다름(`findAll` 한 곳에서만 호출) — 이번 PR 이 만든 결함 아님(pre-existing) | `model-config.controller.spec.ts:7-8` | "used by the `findAll` handler" 로 정정 |
| 11 | 문서화 | `ModelConfigService.create()` 만 다른 3개 메서드와 달리 "커밋 직후 기록" 순서 근거 주석이 없어 파일 내 패턴 비일관 | `model-config.service.ts` create() 내 recordAudit 직전 | "이후 실패 가능한 외부 호출 없어 순서 무관" 한 줄 추가(선택) |
| 12 | 문서화 | `saveCanvas`/`restoreVersion` 감사 미기록 사유가 `importWorkflow` 주석에만 있고 정의부엔 없음(의도 자체는 plan 에 추적됨) | `workflows.service.ts:592,656` | 정의부에 1줄 참조 코멘트 추가(선택) |
| 13 | 의존성 | 신규 외부 패키지·`package.json`/lockfile 변경 없음. `AuditLogsModule` 은 leaf 모듈로 4개 도메인 모듈에 단방향 import, 순환 의존 없음 | 20개 대상 파일 전체 | 해당 없음 |
| 14 | DB | `SchedulesService.create()`/`remove()` 는 Trigger↔Schedule 2-step 쓰기가 단일 트랜잭션으로 묶여있지 않음(이번 diff 이전부터 존재, 범위 밖) | `schedules.service.ts` create()/remove() | 별도 백로그로 `dataSource.transaction` 리팩터 검토 |
| 15 | 동시성 | `recordAudit` 배치는 전부 트랜잭션 커밋 후·await 순차 실행으로 원자성 보존(정상 확인). `remove()` 의 필드 선-캡처는 TOCTOU 로 오독될 수 있으나 단일 요청 스코프 지역 변수라 안전. `saveWithDefaultSwap` 의 이론적 동시 default 중복 가능성은 DB 파셜 유니크 인덱스 + 409 매핑으로 안전망 보유(이번 diff 비수정 컨텍스트) | 4개 서비스 트랜잭션 경로, `model-config.service.ts:351-364` | 조치 불요(정상 설계 확인) |
| 16 | API계약 | 신규 감사 액션 verb 시제가 리소스군마다 다름(model_config=현재형, workflow/trigger/schedule=과거분사) — `action` 필드가 이미 비-enum(string)이라 breaking 위험 없음, 문서화된 의도 | `audit-action.const.ts:76-88`, `audit-log-response.dto.ts:41` | 조치 불요. 후속 리소스군 추가 시도 동일 문서에 규칙 유지 |
| 17 | API계약 | `AuditLogDto.action` Swagger description 이 여전히 리소스군 이름을 자연어로 하드코딩(향후 리소스군 추가 시 재차 낡을 수 있음) | `audit-log-response.dto.ts:27-40` | 리소스군 열거 자체를 제거하고 `AUDIT_ACTIONS` 참조만 남기는 것 검토(선택) |
| 18 | 요구사항 | `workflow.executed`/`saveCanvas` 감사 미구현은 `audit_log` 보존정책 부재 + 카디널리티 문제로 인한 의도적 범위 제외 — plan 문서에 별도 항목으로 명시, 완전성 문제 아님 | `audit-action.const.ts:46-51`, `plan/in-progress/spec-sync-auth-gaps.md` | 조치 불요 |
| 19 | 요구사항 | 대칭 리소스(Schedule↔Trigger) 이중 감사 회피 설계가 코드·테스트 양쪽에서 일관 적용됨(1:1 결합 리소스는 주 리소스만 기록) | `triggers.service.ts:832-852`, `schedules.service.ts:213-223`, `triggers.service.spec.ts:2344-2373` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음(RBAC/IDOR/SQLi/시크릿 비노출 전 유지, C1 수정 재확인). INFO 4건은 전부 PR 스코프 밖 기존 갭 |
| performance | NONE | 순수 additive, N+1 없음. 동기 INSERT 지연 소폭 증가는 저빈도 CRUD 범위라 리스크 낮음 |
| architecture | LOW | 순환 의존 없음, W6 불변식 구조적 일관. `recordAudit` 보일러플레이트 중복·userId 파라미터 위치 비일관은 INFO |
| requirement | LOW | 기능 완전성 확인(423/424 테스트 통과). 유일 이슈는 코드 아닌 spec 카탈로그 SPEC-DRIFT(WARNING, plan 에 추적됨) |
| scope | NONE | 발견사항 없음 — 직전 라운드 이후 커밋 2건이 지적 항목과 1:1 대응하는 최소 수정임을 확인 |
| side_effect | NONE | C1 순서 위반 해소·duplicate/importWorkflow 커밋-후-기록 확인. userId 시그니처 변경 호출자 전수 확인, 신규 부작용 없음 |
| maintainability | LOW | `recordAudit` 중복 5곳(WARNING, 추출 후보). 그 외 명명·순서 일관성 양호 |
| testing | MEDIUM | 이전 CRITICAL(C1)·WARNING 1건 해소 확인. 잔여 WARNING 2건(부분 조치)+신규 1건(triggers 실패-시-미기록 테스트 부재) |
| documentation | HIGH | spec SoT 4곳이 구현 완료를 미반영(CRITICAL, SPEC-DRIFT). 코드 자체 문서화 품질은 높음. WARNING 1건은 pre-existing |
| dependency | NONE | 신규 외부 의존성 0건, 순환 의존 없음 |
| database | NONE | 스키마/마이그레이션/인덱스 변경 없음, SQL 인젝션 없음, 트랜잭션 원칙 일관 |
| concurrency | LOW | 신규 락/스레딩 이슈 없음. `saveWithDefaultSwap` 이론적 특성은 DB 안전망으로 커버(비수정 컨텍스트) |
| api_contract | NONE | breaking change 없음, 인증/인가 게이트 불변, action 필드는 이미 비-enum |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조, backend-only 변경 + 대응 user-guide 페이지 부재로 갱신 누락 성립 안 함 |

## 발견 없는 에이전트

- scope (발견사항 없음, 위험도 NONE)
- user_guide_sync (발견사항 없음, 위험도 NONE)

## 권장 조치사항

1. **(SPEC-DRIFT, 최우선)** `project-planner` 턴에서 spec 4곳(`spec/5-system/1-auth.md` §4.1/§4.1.A, `spec/data-flow/1-audit.md` §1.1, `spec/conventions/audit-actions.md` §3, `spec/2-navigation/2-trigger-list.md` L182/L252)을 한 커밋으로 동시 갱신 — Planned→구현 이동 + 액션명 오기 정정. 코드 revert 는 불필요. `plan/in-progress/spec-sync-auth-gaps.md` 의 기존 체크리스트를 그대로 실행.
2. **(테스트, WARNING)** `triggers.service.spec.ts` 감사 describe 블록에 "저장 실패 시 감사 미기록" 테스트 추가 — 과거 실제 순서 버그(C1)가 난 파일이라 회귀 방지 가치가 가장 큼.
3. **(테스트, WARNING)** `model-config` 의 `isDefault:true` create/update 트랜잭션 분기에 `setDefault` 와 동일한 순서/실패 감사 테스트 확장.
4. **(테스트, WARNING)** 컨트롤러→서비스 `userId` 배선 검증 유닛테스트를 model-config 의 update/remove 패턴대로 triggers/workflows/schedules 전 경로로 확장(schedules 는 controller spec 파일 신설 필요).
5. **(유지보수성, WARNING)** `recordAudit` 5곳 중복을 공용 팩토리(`createAuditRecorder`)로 추출 검토 — RESOLUTION 에 이미 유예 결정돼 있으나 5곳으로 늘어난 현 시점 재검토 가치 있음. 이번 PR 차단 사유는 아님.
6. (INFO, 선택) `WorkflowsService` 내부 `userId` 파라미터 위치를 자매 서비스와 통일, `AuditLogDto.action` Swagger description 의 리소스군 하드코딩 제거, `model-config.controller.spec.ts` pre-existing 주석 오기 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |