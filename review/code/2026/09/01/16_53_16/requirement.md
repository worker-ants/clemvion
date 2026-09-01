# 요구사항(Requirement) 리뷰 — 감사 액션 바인딩 구멍 + 삼킨 적재 실패 관측성 (6라운드)

## 검토 방법

`origin/main...HEAD` 누적 diff(102개 프롬프트 항목, 실질 코드는 8개 소스/테스트 파일 +
3개 spec 파일)를 검토했다. 이미 5라운드의 code-review 가 순차로 진행되며 실질 결함
다수(무테스트 구현·화살표 함수 탐지 누락·`findMisboundHelpers` 부재·거짓 유예 근거·주석
귀속 오류)를 잡아 고쳤으므로, 그 RESOLUTION 들의 주장을 **신뢰하지 않고** 저장소의 현재
상태를 직접 다시 실측했다:

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
  `business-metrics.service.ts`, `auth-configs.service.ts`, 세 `.spec.ts`,
  `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` 를 `Read` 로 전문 대조
- `recordAudit` 실사용처 5곳(triggers/workflows/schedules/model-config/auth-configs) 전수
  grep 하여 가드의 `AUDIT_HELPER_NAMES`/형태 커버리지가 실제 호출부와 일치하는지 확인
- `AuditLogsService.record` 실제 호출자 12곳(9 서비스 + 3 컨트롤러)을 정밀 grep 으로 재계수
  → spec/JSDoc 의 "12개 위치" 서술과 **정확히 일치**
- `resourceType` distinct 값을 실제 호출부에서 재추출 → `workspace_invitation` 은
  `workspace-invitations.service.ts` 안에서 `notificationsService.notify()` 에만 전달되고
  `auditLogsService.record()` 에는 전달되지 않음을 코드로 직접 확인 → "distinct 10종" 주장이
  거짓 배제가 아니라 실제로 맞음을 재확인
- `npx jest` 로 대상 3개 spec 파일(40 tests) 재실행 → 전부 GREEN
- `npx tsc --noEmit` 으로 대상 파일 범위에 타입 에러 없음 확인 (남은 에러는 diff 밖
  `auth-configs.service.spec.ts` 의 무관한 기존 결함)

뮤테이션은 걸지 않았다 — 5라운드에 걸쳐 이미 M1~M4/X1~X5/Y1~Y2 등 촘촘한 뮤테이션 매트릭스로
검증된 로직이고, 저장소를 다시 고쳐 재현할 필요가 있는 새 가설을 세우지 못했다. 저장소
파일은 읽기만 했고 뮤테이션·백업 파일을 만들지 않았다 (`git status --short` 로 확인, 이번
세션의 출력 디렉터리만 untracked).

## 발견사항

- **[INFO]** `AuditLogsService.record()` catch 블록의 관측 실패 방어가 이중 스코프(외부
  swallow try + 내부 관측 try)로 나뉘어 있으나, 요구사항(“관측이 새 실패 경로가 되면 안
  된다”)과 정확히 일치하게 구현됨을 코드 레벨에서 재확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
  - 상세: `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 가 던져도 내부
    `try/catch` 로 흡수되고, 바깥 `logger.warn` 은 항상 실행된다. `audit-logs.spec.ts` 의
    `'metrics 호출이 던져도 삼킨다'` 테스트가 이를 실제로 실행 경로에서 검증하고(mock 이
    `throw`), `'metrics provider 없이 DI 조립이 성공한다 (@Optional)'` 테스트는
    `Test.createTestingModule` 로 **실제 DI** 를 태워 `BusinessMetricsService` provider
    부재 시에도 조립되는지 확인한다(3라운드에서 지적된 "생성자 직접 호출이라 `@Optional`
    을 안 문다" 결함이 실제로 고쳐져 있음을 재현 테스트로 확인). 요구사항 충족.
  - 제안: 없음.

- **[INFO]** `AuditActionFor<P>` 타입 바인딩 + `findMisboundHelpers` 가드가 실제 5개
  `recordAudit` helper 전부를 정확히 커버함을 재실측
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:181-220`
    (`findUnboundHelpers`/`findMisboundHelpers`), 호출부
    `triggers.service.ts:215`, `workflows.service.ts:180`, `schedules.service.ts:147`,
    `model-config.service.ts:245`, `auth-configs.service.ts:86`
  - 상세: 5곳 모두 `AuditActionFor<typeof X_RESOURCE_TYPE>` 형태로 일관돼 있고,
    `findMisboundHelpers` 가 `boundResource`/`recordedResource` 를 상수 해석까지 정규화한
    뒤 비교하므로 표기 차이(리터럴 vs `typeof CONST`)로 인한 거짓 경보/누락이 없다.
    `audit-action-binding.spec.ts` 의 `[전제]` 테스트 두 개(`sites.length >= 5`,
    `resolved.length >= 5`)가 이 가드의 vacuous 실행을 사전 차단하고 있어, "위반 0건"이
    "helper 를 못 찾아서 0건"이 아니라 "찾았는데 위반이 없어서 0건"임을 구조적으로 보장한다.
  - 제안: 없음.

- **[INFO]** spec 본문의 정량 서술(“12개 위치”, “distinct 10종”)이 코드 실측과 line-level
  로 정확히 일치함을 독립 재검증
  - 위치: `spec/data-flow/1-audit.md:55-58` (12개 위치), `spec/5-system/_product-overview.md`
    NF-OB-07 카탈로그 행 (distinct 10종)
  - 상세: `grep -rln "auditLogsService\.record(" codebase/backend/src/modules` 결과 정확히
    12개 파일(9 서비스 + 3 컨트롤러)이고, spec 서술과 정확히 일치한다. `resourceType` distinct
    값도 실제 `record()` 호출부에서 재추출한 결과 `user·auth_config·schedule·model_config·
    member·execution·workflow·integration·workspace·trigger` = 10종으로, spec/JSDoc 의 "10종"
    주장과 일치한다. `workspace_invitation`(11번째로 보일 수 있는 값)은 같은 파일 안에서도
    `notificationsService.notify()` 전용이고 `record()` 에는 전달되지 않음을 코드로 직접
    확인했다 — JSDoc 의 "알림 값이라 여기 안 온다" 서술이 정확하다. 이는 4~5라운드에서 이미
    한 차례 정정된 수치(종전 "12종" 오기)라 재발 여부를 특히 의심하며 재검산했으나, 현재
    값은 실제와 일치한다.
  - 제안: 없음.

- **[INFO]** `login_history` 축(카운터 없음)의 의도된 비대칭이 spec·plan·코드 3곳에서
  모순 없이 일관됨
  - 위치: `spec/data-flow/1-audit.md:24-38`, `plan/in-progress/spec-sync-auth-gaps.md`
    (`login_history` 축 — 미결 항목), `codebase/backend/src/modules/auth/jobs/
    login-history-pruner.service.ts` 는 diff 밖(미변경)
  - 상세: `login-history.service.ts` 의 실패 경로는 여전히 `Logger.error` 뿐이고 카운터가
    없다 — 이는 이번 PR 의 누락이 아니라 spec 이 명시적으로 "의도적으로 드러내 둔 비대칭"
    이라고 선언하고 plan 트래커에도 재개 조건과 함께 미결 항목(`[ ]`)으로 등재돼 있다.
    이전 라운드 consistency-check(`15_00_54`)의 WARNING #2("등재 위치 미지정")가 실측상
    이미 해소된 상태(plan 에 구체 항목 존재)임을 확인했다.
  - 제안: 없음 — 조치 불필요, 등재 상태 정상.

- **[INFO]** TODO/FIXME/HACK/XXX 없음
  - 위치: 변경된 8개 소스·테스트 파일 전수 grep
  - 상세: 미완성 작업을 시사하는 마커가 diff 범위 내 어디에도 없다. 유일하게 미조치로
    남은 두 항목(`clampLabel` 대칭 테스트 부재, `record()` JSDoc 관측 동작 미기술)은
    코드 주석이 아니라 `plan/in-progress/spec-sync-auth-gaps.md` 에 명시적으로 "미조치이며
    우선순위 판단"이라고 등재돼 있어 은폐된 미완성이 아니다.
  - 제안: 없음.

## 요약

핵심 요구사항 두 갈래 — (1) `auth_config` 의 `recordAudit` action 타입이 리소스에 묶이지
않아 다른 리소스의 액션을 오기록할 수 있던 구멍을 `AuditActionFor` 타입 좁힘 + AST 기반
`findUnboundHelpers`/`findMisboundHelpers` 가드로 봉쇄, (2) 감사 로그 적재 실패가 조용히
삼켜져 관측 불가능하던 갭을 OTel 카운터(`clemvion.audit.write_failed`) + 로그 메시지 필드
확장으로 보이게 함 — 을 코드 레벨에서 직접 재검증한 결과 모두 의도한 대로 정확히 구현돼
있다. 이미 5라운드의 code-review 가 실질 결함(무테스트 구현, 화살표 함수 클래스 필드
탐지 누락, "묶였는가"와 "자기 리소스에 묶였는가"의 술어 갭, 거짓 유예 근거 2회, 주석 귀속
오류, `@Optional` 을 안 무는 vacuous 테스트, 타입 캐스트 구멍)을 순차로 찾아 고쳤고, 이번
6라운드에서 그 수정들을 신뢰하지 않고 코드·테스트·spec 을 직접 재실측한 결과 전부 유효함을
확인했다. 정량 서술(producer 12곳, resourceType distinct 10종)까지 spec-코드 line-level
일치를 재검산했으며 불일치를 찾지 못했다. 에러 시나리오(swallow 계약, 관측 자체의 실패,
`@Optional` DI 부재)와 엣지 케이스(64/65자 클램핑 경계, 화살표 함수 vs 메서드 선언, 표기만
다른 상수 vs 값이 실제로 다른 경우)가 각각 전용 테스트로 커버돼 있고, 모든 경로에서
`Promise<void>` 반환이 일관된다. TODO/FIXME 류 미완성 마커는 없으며, 남은 두 미조치
항목(클램핑 대칭 테스트, JSDoc 서술 보강)은 plan 에 우선순위 판단으로 명시 등재돼 은폐되지
않았다. 이번 라운드에서 새로 발견된 Critical/Warning 은 없다.

## 위험도
NONE
