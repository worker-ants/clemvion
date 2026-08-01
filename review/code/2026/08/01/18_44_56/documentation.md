# 문서화(Documentation) 리뷰 — audit-logging (8차 라운드)

본 라운드 diff 의 실체는 7차 리뷰 조치 커밋(`c4eddd918`) — `AuditActionFor<P>` 리소스별 액션
타입 도입 + `duplicate`/`importWorkflow` 롤백·순서 대칭 테스트 3건 추가다. 문서화 관점에서
검토한 5개 파일(`audit-action.const.ts`, `model-config.service.ts`, `schedules.service.ts`,
`triggers.service.ts`, `workflows.service.ts`, `workflows.service.spec.ts`) 전체를 다시 훑었다.

## 발견사항

- **[INFO]** (7차 리뷰에서 이미 지적, 여전히 미조치) `ModelConfigService.create()` 의
  `recordAudit` 호출에 "커밋 후 기록" 근거 주석 부재
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `create()`,
    `saved = ...` 대입(gate 282-286) 직후 `await this.recordAudit({...})` 호출부(gate 287-293)
  - 상세: 같은 파일의 `setDefault()`(gate 387 `// 트랜잭션 **커밋 뒤**에 기록한다 — 안에서
    남기면 롤백 시 일어나지 않은 일이 감사에 남는다.`)와 `schedules.service.ts`/
    `triggers.service.ts`/`workflows.service.ts` 의 대응 `create`/`update`/`remove` 는 전부
    동일한 "커밋 직후 기록" 주석을 갖고 있다. `create()` 는 `dto.isDefault` 분기에서
    `saveWithDefaultSwap`(내부적으로 `this.repo.manager.transaction` 사용)을 타므로 동일한
    롤백-안전성 논거가 적용되는데도 주석이 없다. 기능 결함은 아니다 — 코드 배치 자체는 이미
    트랜잭션 커밋 뒤(gate 282-286→287)이므로 동작은 올바르다. 순수 문서 일관성 갭이며, 이번
    8차 라운드(`c4eddd918`)에서도 손대지 않아 그대로 남아 있다.
  - 제안: `setDefault()`/`remove()` 와 동일한 1줄 주석을 `create()` 의 `recordAudit` 호출
    앞에 추가.

- **[WARNING]** (7차 리뷰에서 이미 지적·추적 중, 여전히 유효) spec SoT 가 이번 구현 완료
  이후에도 "미구현/Planned" 로 서술 — developer 권한 밖(spec/ read-only), 조치 경로는 이미
  문서화됨
  - 위치: `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" 표(workflow/trigger/schedule/
    model_config 미포함) + 같은 절 "Planned (미구현)" 표(위 4개 리소스가 여전히 등재) /
    `spec/data-flow/1-audit.md` §1.1
  - 상세: `workflows.service.ts`·`triggers.service.ts`·`schedules.service.ts`·
    `model-config.service.ts` 4개 서비스가 이미 `AuditLogsService` 를 주입하고 13개 액션을
    CRUD 경로에 배선했음을 재확인했다(각 파일 `recordAudit` 헬퍼 + `AUDIT_ACTIONS.*` 호출부).
    `plan/in-progress/spec-sync-auth-gaps.md` 에서 "§4.1 감사 로깅 커버리지 갭" 항목은
    `[x]` 로 완료 체크됐지만, 바로 아래 "spec SoT 4곳 동기화 — planner 턴 필요" 항목은
    여전히 `[ ]` 미체크로 정확히 이 gap 을 추적하고 있다 — 즉 drift 는 실재하지만 원인·
    해소 경로가 CHANGELOG·plan·코드 주석 세 군데에서 이미 명시적으로 인지·기록돼 있다.
  - 제안: 이 라운드에서 developer 가 직접 조치할 항목은 아니다. 다음 project-planner 턴에서
    `spec-sync-auth-gaps.md` 의 "spec SoT 4곳 동기화" 체크박스를 실행해 `1-auth.md §4.1`·
    `data-flow/1-audit.md §1.1`·`conventions/audit-actions.md §3`·
    `2-navigation/2-trigger-list.md`(L182/L252 액션명 오기 포함) 4개 문서를 한 커밋에서
    동시 갱신할 것.

## 확인된 양호 사항 (참고)

- `AuditActionFor<P>` (신규 타입, gate 93-106 of `audit-action.const.ts`) 에 도입 배경 —
  "resourceType 이 서비스마다 고정인데 action 을 전체 합집합으로 받으면 교차-리소스 오기록이
  컴파일을 통과한다" — 이 정확한 JSDoc 이 붙어 있고, "(7차 리뷰 architecture — 정합성이
  주석으로만 보장되던 것을 타입으로 옮겼다.)" 로 변경 경위까지 추적 가능하게 남겼다. 4개
  서비스의 `recordAudit` 시그니처(`AuditActionFor<'model_config'>` 등)도 일관되게 적용됐다.
- `workflows.service.spec.ts` 에 새로 추가된 3개 테스트(`duplicate`/`importWorkflow` 롤백·
  순서 대칭)는 각각 "(7차 리뷰 testing — create 에만 있던 대칭을 duplicate 에도 맞춘다.)"
  처럼 어떤 리뷰 라운드가 왜 이 테스트를 요구했는지 인라인 주석으로 남겨, 테스트 자체가
  회귀 방지 근거 문서로 기능한다.
  - 다만 이 3개 테스트 자체는 신규 JSDoc/모듈 문서가 필요한 공개 API 가 아니라 내부 spec
    파일이라 별도 문서화 요건은 없음 — 인라인 주석 수준으로 충분.
- `CHANGELOG.md` "Unreleased — 감사 로깅 커버리지 확장" 항목은 13개 액션 전체·시제 규약·
  타이밍 정책(커밋 직후)·`workflow.executed` 제외 사유·SoT 링크를 모두 포함해 이번
  `AuditActionFor` 타입 정제(내부 구현 세부사항, 동작/계약 변경 없음)까지 별도 항목을 만들
  필요는 없다 — 기존 항목의 범위 안에 자연히 포함된다.
- README 업데이트 필요성: 없음 — 이전 라운드와 동일하게 백엔드/루트 README 어디에도 감사
  액션 목록을 나열하지 않아 갱신 대상 아님. 이번 diff(`AuditActionFor` 타입 + 테스트)도
  README 서술 대상 표면을 만들지 않는다.
- API 문서(Swagger): 이번 diff 는 타입 정제 + 테스트뿐이라 컨트롤러 계약(`@ApiOperation`/
  `@ApiResponse`) 변경이 전혀 없고, 실제로도 손대지 않았다 — 적절.
- `spec/conventions/audit-actions.md` 는 액션 **명명 규약**(문자열 형식)의 SoT 이고
  `AuditActionFor<P>` 는 순수 TS 타입-레벨 유틸리티(런타임/명명에 영향 없음)라 이 규약
  문서에 별도 언급이 없어도 갭이 아니다.

## 요약

이번 8차 라운드 diff(`c4eddd918`, 7차 리뷰 조치)는 문서화 수준이 높다 — 신규
`AuditActionFor<P>` 타입에 도입 배경이 정확히 기록됐고, 추가된 3개 테스트도 어떤 리뷰
라운드의 어떤 지적을 조치한 것인지 인라인으로 추적 가능하다. CHANGELOG·README·API 문서
모두 갱신 불요 판정이 유지된다. 새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다. 다만
이전 라운드에서 이미 지적된 두 항목이 여전히 남아 있다 — (1) `ModelConfigService.create()`
의 "커밋 후 기록" 주석 누락(INFO, 순수 문서 일관성), (2) `spec/5-system/1-auth.md` §4.1 ·
`spec/data-flow/1-audit.md` §1.1 이 이미 구현된 4개 리소스를 여전히 "미구현/Planned" 로
서술하는 spec drift(WARNING, developer 권한 밖·planner 턴에 이미 인계됨). 둘 다 이번
라운드가 새로 만든 문제가 아니며 조치 경로가 이미 문서(plan/in-progress/
spec-sync-auth-gaps.md, CHANGELOG.md)에 명시돼 있다.

## 위험도

LOW
