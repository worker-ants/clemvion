# 테스트(Testing) 리뷰

## 사전 확인 (재현·회귀 검증)

이 changeset 은 이미 4라운드의 리뷰-fix 사이클을 거쳤다(`review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24}`). 새 결함을 찾기 전에, 앞선 라운드가 "고쳤다"고 주장한 것이 실제로 코드에 반영되어 있고 회귀 방지가 진짜로 작동하는지부터 확인했다(스크래치 사본으로 뮤테이션 → 원복은 `cp`로, 매 단계 `git status --short`로 무잔여 확인):

- `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts`, `business-metrics.service.spec.ts`, `audit-action-binding.spec.ts` 3파일 **35/35 GREEN** (`npx jest` 직접 실행).
- `AuditLogsService` 생성자의 `@Optional()` 를 제거하는 뮤테이션 → `audit-logs.spec.ts` **3건 RED**(의도한 `'metrics provider 없이 DI 조립이 성공한다 (@Optional)'` 포함, RESOLUTION 이 "무관한 findAll DI 스위트도 같이 잡는다"고 적은 것과 일치) — 원복 후 11/11 GREEN 재확인.
- `audit-action-binding-guard.ts` 의 화살표 함수 클래스 필드 인식 분기(`ts.isPropertyDeclaration` 브랜치)를 제거하는 뮤테이션 → `audit-action-binding.spec.ts` **2건 RED**(3라운드 RESOLUTION 이 주장한 "Y1 → RED 2" 와 일치) — 원복 후 13/13 GREEN 재확인.
- `auth-configs.service.spec.ts` 46/46 GREEN — `recordAudit` 타입 좁힘이 런타임 회귀 없음을 재확인.

세 파일 모두 mutation 후 `cp` 로 원복, `git status --short` 로 잔여 없음을 확인했다(레포 전체 status 는 이 리뷰 세션의 `review/code/2026/09/01/16_29_11/` 신규 디렉터리만 untracked로 남아 있고 그 외 클린).

결론: 4라운드에 걸쳐 주장된 fix·회귀 테스트는 **실측상 진짜**다. 이 기반 위에서 이번 라운드의 신규 발견을 아래에 적는다.

## 발견사항

- **[WARNING]** `audit-action-binding-guard.ts` 의 `findUnboundHelpers` 가 여전히 **`AuditActionFor<` 접두 문자열만** 검사하고 제네릭 인자(어느 리소스에 묶였는지)는 비교하지 않는다 — 3라운드에 걸쳐 논의되었지만, (a) 회귀 방지 fixture 로 고정되지 않았고 (b) `plan/in-progress/spec-sync-auth-gaps.md` 체크리스트에도 등재되지 않아 이번 세션이 끝나면 `review/**`(SoT 아님) 안에만 남는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157`(`findUnboundHelpers` — `s.actionType?.startsWith(\`${BOUND_TYPE_NAME}<\`)` 만 검사), `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`(전체 — "제네릭 인자가 있지만 잘못된 리소스" 케이스 없음), `plan/in-progress/spec-sync-auth-gaps.md`(체크리스트에 미등재 — `clampLabel 대칭 테스트`·`login_history 축` 두 형제 항목은 명시 등재되어 있는 것과 대비)
  - 상세: 직접 프로브로 재확인했다 — 스크래치 디렉터리에 `AuditActionFor`/`_NoCrossDomain` 을 그대로 복제하고, `WorkflowsServiceProbe.recordAudit` 의 `action` 파라미터 타입을 **자기 리소스가 아닌** `AuditActionFor<typeof TRIGGER_RESOURCE_TYPE>` 로 선언한 뒤 내부에서 `record({ action, resourceType: WORKFLOW_RESOURCE_TYPE })` 를 호출하는 코드를 `tsc --noEmit --strict`(격리된 tsconfig, `types: []`)로 컴파일했다 — **EXIT=0, 에러 0건.** 즉 `_NoCrossDomain` 캐너리(`audit-action.const.ts:139-141`)는 "`AuditActionFor<'workflow'>` 에 `'trigger.created'` 를 대입할 수 있는가" 만 검증할 뿐, "이 helper 가 자기 own `resourceType` 상수와 다른 리소스의 `AuditActionFor<X>` 로 정확히·일관되게 잘못 묶인 경우"는 전혀 막지 못한다. 이는 이번 PR 이 auth-configs 에서 고친 것과 **같은 결함 클래스**(리소스에 안 묶인/잘못 묶인 `action`)가 문법을 살짝 바꿔 재도입될 수 있는 자리라는 뜻이다 — 화살표 함수 필드 미인식 갭이 3라운드에서 닫힌 것과 정확히 같은 서사다.
    현재 실제 5개 호출부(triggers/workflows/schedules/model-config/auth-configs)는 전부 자기 리소스에 올바르게 묶여 있어 **지금 당장 살아있는 결함은 아니다** — 하지만 그 사실 자체가 테스트로 고정돼 있지 않다(fixture 에 이 형태가 없다).
    2라운드 testing 리뷰(`review/code/2026/09/01/15_10_38/testing.md:61-83`)가 정확히 이 갭을 지적하고 "`it.skip`/전용 `it` 로 `WRONG_RESOURCE_BOUND_SOURCE` fixture 를 추가해 known-gap 을 명시적으로 고정하라"고 제안했으나, 이후 2라운드가 더 지나도록 반영되지 않았고 plan 체크리스트에도 옮겨지지 않았다.
  - 제안: (1) 최소한 `audit-action-binding-fixture.ts` 에 "제네릭 인자는 있으나 자기 리소스가 아닌" 형태(`WRONG_RESOURCE_BOUND_SOURCE`)를 추가하고, 현재 가드가 이를 **통과시킨다**는 사실을 `it`(스킵이 아니라 실제 단언, "지금은 못 잡는다"를 `toEqual([])`로 고정)로 회귀 방지하면, 나중에 가드가 강화되거나 반대로 더 느슨해질 때 그 변화가 테스트로 드러난다. (2) `plan/in-progress/spec-sync-auth-gaps.md` 의 "미결" 항목 목록에 형제 항목(`clampLabel` 대칭 테스트·`login_history` 축)과 같은 형식으로 등재 — `review/**` 는 SoT 가 아니므로 지금 기록해 두지 않으면 다음 세션이 이 판단(우선순위 낮음, 발생 표면 좁음)을 처음부터 다시 조사하게 된다.

- **[INFO]** `recordExecutionError` 의 클램핑에는 `recordAuditWriteFailed` 와 대칭인 65자 경계 테스트가 없다 — 뮤테이션(클램핑 제거)이 GREEN 으로 생존할 여지가 있다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:54-60`(`recordExecutionError` 테스트 — 짧은 문자열만 사용), 대조군은 같은 파일 `:75-83`(`recordAuditWriteFailed` 의 65자 경계 테스트)
  - 상세: 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 "`clampLabel` 대칭 테스트 + `record()` JSDoc" 항목으로 명시 등재·우선순위 판단(문서화가 아니라)으로 이월되어 있음을 확인했다 — 새 발견이 아니라 기존 추적이 유효함을 재확인한 것이다.
  - 제안: 추적된 대로 다음 세션에서 처리. 지금 차단 사유 아님.

- **[INFO]** `audit-logs.spec.ts` 의 `describe('AuditLogsService.record — 삼킨 실패의 관측', ...)` 블록에 있는 `build(saveRejects)` 헬퍼가 `metrics: BusinessMetricsService` 를 강타입 캐스트(`as unknown as BusinessMetricsService`)로 주입한다 — 실제 클래스가 아니라 `{ recordAuditWriteFailed: jest.fn() }` 형태 mock 이라, `BusinessMetricsService` 에 새 필수 메서드가 추가돼도 이 mock 은 타입 에러 없이 계속 컴파일된다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:154-167`(`build` 헬퍼), 유사 패턴이 `:202-221`(`metrics 호출이 던져도 삼킨다`)에도 반복
  - 상세: 이 자체는 이 저장소 전역의 표준 mocking 관례(`as unknown as X` 캐스트)이고 `AuditLogsService.record()` 가 `this.metrics?.recordAuditWriteFailed(...)` 하나만 호출하므로 실질적 위험은 낮다 — mock 이 실제 인터페이스와 벌어질 수 있는 유일한 지점은 `recordAuditWriteFailed` 시그니처 자체 변경뿐이고, 그건 TS 컴파일 자체가 호출부에서 잡는다(반환 타입 `void` 불일치 등은 예외). 다만 새 필수 파라미터가 `recordAuditWriteFailed(resourceType, extra)` 식으로 추가되면 `jest.fn()` 은 그 인자를 무시하고 계속 통과한다.
  - 제안: 조치 불요. 참고로만 기록.

## 요약

4라운드 fix 가 실제로 반영됐는지 뮤테이션으로 직접 재검증했고(`@Optional` 제거 → RED 3, 화살표 필드 분기 제거 → RED 2, 전부 예측과 일치, 원복 확인 완료), `audit-logs.spec.ts`/`business-metrics.service.spec.ts`/`auth-configs.service.spec.ts` 전부 GREEN 이다 — 이 changeset 의 테스트는 견고하고, swallow 계약·관측 실패 격리·클램핑 경계·DI 선택성 등 핵심 계약을 실제로 무는 뮤테이션 저항성을 갖췄다. 유일한 신규 지적은 `audit-action-binding-guard.ts` 가 제네릭 인자(리소스 바인딩의 정확성)까지는 비교하지 않는다는, 3라운드째 반복 언급된 known limitation이 여전히 fixture 로 고정되지 않고 plan 체크리스트에도 없다는 점이다 — 코드에 살아있는 결함은 없지만(5개 호출부 전부 올바르게 바인딩됨, 직접 확인), 판단 근거가 `review/**`(비-SoT) 에만 남아 다음 세션에서 유실될 위험이 있다.

## 위험도

LOW
