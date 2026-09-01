# 테스트(Testing) 리뷰 — audit-record-factory

## 검증 방법

`codebase/backend/src/modules/audit-logs/{audit-logs.service.ts,audit-logs.spec.ts}`,
`codebase/backend/src/modules/metrics/{business-metrics.service.ts,business-metrics.service.spec.ts}`,
`codebase/backend/src/modules/auth-configs/auth-configs.service.ts`,
`codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`,
`audit-action-binding.spec.ts` 를 `Read` 로 전체 대조했다. 두 가설은 실제로 **뮤테이션해서
재현**했다 — 저장소 밖 scratch 사본을 먼저 떠 두고, 원본을 고쳐 `jest`/`ts-node` 로 실행한
뒤 `cp` 로 원복하고 `git status --short` 로 클린 상태를 확인했다(원복 후 diff 없음 확인).

## 발견사항

- **[WARNING]** `@Optional()` 제거를 검증한다고 주장하는 테스트가, 실제로는 그 결정 요인을
  검사하지 않는다 — RED 는 무관한 다른 테스트의 부수효과다 (실측 검증 완료)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:223-233`
    (테스트명 `'metrics 없이 조립해도 감사 기록은 동작한다 (@Optional)'`), 대상 코드
    `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19`
    (`@Optional() private readonly metrics?: BusinessMetricsService,`)
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md` 는 "뮤테이션 4축(예측/실측 전부 RED)"
    중 하나로 "`@Optional` 제거" 를 적고 있다. 실제로 `@Optional()` 데코레이터만 제거하고
    (`?:` 는 유지) 전체 스위트를 돌려 **확인했다**:
    ```
    Tests: 2 failed, 8 passed, 10 total
    ● AuditLogsService.findAll — 필터 (Spec Auth §4.2) › userId 쿼리 전달 시 …
      Nest can't resolve dependencies of the AuditLogsService (AuditLogRepository, ?).
      Please make sure that the argument BusinessMetricsService at index [1] is available …
    ● AuditLogsService.findAll — 필터 (Spec Auth §4.2) › userId 미전달 시 …
      (동일 에러)
    ```
    RED 는 나지만 **실패한 두 테스트는 `findAll — 필터` describe 블록**(게이트 28-80, 이번
    diff 이전부터 있던 기존 테스트)이다. 원인은 그 블록이 `Test.createTestingModule()` 로
    NestJS DI 컨테이너를 통해 `AuditLogsService` 를 조립하는데 `BusinessMetricsService`
    provider 를 등록하지 않아서다 — `@Optional()` 이 없으면 Nest 가 그 자리에서
    `UnknownDependenciesException` 을 던진다.
    정작 "@Optional" 이라고 이름 붙은 테스트(게이트 223-233)는 `new AuditLogsService(repo)`
    로 **NestJS DI 를 거치지 않고 직접** 생성자를 호출한다. `@Optional()` 은 Nest 의 DI
    해석에만 영향을 주는 데코레이터라, plain `new` 호출에는 애초에 아무 효과가 없다 —
    `metrics?: BusinessMetricsService` 의 `?` (TS 옵셔널 파라미터) 만으로 이미 인자 없이
    호출 가능하므로, 이 테스트는 데코레이터 유무와 **무관하게** 항상 통과한다(직접 확인:
    "8 passed" 안에 이 테스트가 포함돼 있고 `findAll` 두 건만 실패).
    즉 plan 이 주장하는 "이 뮤테이션 축을 테스트가 잡는다" 는 사실이지만, **잡는 주체가
    plan 이 지목한 그 테스트가 아니라 우연히 같은 파일에 있던 무관한 DI 스위트**다. 그
    `findAll` 블록이 나중에 다른 조립 방식으로 리팩터되거나 삭제되면, `@Optional()` 회귀는
    조용히 아무 테스트도 통과시키지 못한 채 넘어간다 — 지금은 GREEN 인데 그 GREEN 이 가리키는
    보장이 실제로는 없는 상태다.
  - 제안: `Test.createTestingModule({ providers: [AuditLogsService, { provide:
    getRepositoryToken(AuditLog), useValue: {...} }] }).compile()` 을
    `BusinessMetricsService` provider **없이** 호출하고 reject 하지 않음을 직접 단언하는
    테스트를 `@Optional` 전용으로 추가할 것. 그래야 `findAll` 스위트의 존재/형태와
    독립적으로 이 계약이 고정된다.

- **[WARNING]** 감사 액션 바인딩 가드에 **화살표 함수 필드로 선언된 `recordAudit`** 를 완전히
  놓치는 실측된 blind spot 이 있고, 이 사실이 fixture 로 커버되지 않은 채 두 리뷰 라운드의
  RESOLUTION.md 가 "이미 가드 헤더에 문서화됨" 이라고 잘못 주장한다 (실측 검증 완료)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:78-96`
    (`findAuditHelpers` 의 `visit`, `ts.isMethodDeclaration(node)` 만 검사 — 게이트 80),
    fixture 파일 `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`
    전체(6개 export 중 화살표 함수 필드 케이스 없음).
    잘못된 claim 의 출처: `review/code/2026/09/01/14_31_12/RESOLUTION.md:66-71`,
    `review/code/2026/09/01/15_10_38/RESOLUTION.md:45-47`
  - 상세: 스캔 저장소 밖(`/private/tmp/.../scratchpad`) 에서 `findAuditHelpers` 를 직접
    import 해 다음 소스로 호출했다(저장소 파일은 건드리지 않음):
    ```ts
    class G {
      private recordAudit = (params: {
        workspaceId: string;
        action: AuditAction;
        resourceId: string;
      }): Promise<void> => { return this.x.record(params); };
    }
    ```
    결과: `sites found: []` — **0건**. `ts.isMethodDeclaration` 은 클래식 메서드 문법만
    매칭하고, 클래스 필드에 화살표 함수를 대입한 형태(`recordAudit = (params) => {...}`,
    `this` 바인딩이 필요할 때 NestJS 서비스에서 흔히 쓰는 패턴)는 `PropertyDeclaration`
    이라 아예 순회 대상에서 빠진다. 즉 이 형태로 `recordAudit` 를 작성하면 "묶이지 않음
    (unbound)" 으로도 잡히지 않고, **애초에 존재하지 않는 것처럼** 통과한다 — 이 PR 이
    고친 것과 정확히 같은 클래스의 결함(리소스에 안 묶인 `action`)이 미래에 이 스타일로
    재도입되면 이 가드는 무력하다.
    두 RESOLUTION.md 는 이 정확한 항목("화살표 함수 필드 미인식")을 "가드 헤더에 트레이드
    오프로 이미 적혀 있고" 라고 명시적으로 적어 두었다. 그러나 `audit-action-binding-guard.ts`
    ·`-fixture.ts`·`.spec.ts` 세 파일 전체를 `grep -n "화살표\|arrow\|트레이드오프\|한계\|제약"`
    로 뒤졌을 때 **일치 0건**이다 — 그런 문서화는 실제로 존재하지 않는다. RESOLUTION.md 의
    "이미 기록됐다" 는 주장을 믿으면 이 갭은 영구히 재점검 대상에서 빠진다(과거 실패 패턴:
    "미조치 항목의 근거가 실은 틀렸다").
  - 제안: (a) `audit-action-binding-fixture.ts` 에 화살표 필드 케이스를 추가하고, 현재
    동작(무시됨)을 의도라면 가드 헤더에 그 트레이드오프를 실제로 적을 것 — 또는 (b)
    `findAuditHelpers` 의 `visit` 에 `ts.isPropertyDeclaration(node) &&
    node.initializer && ts.isArrowFunction(node.initializer)` 분기를 추가해 이 형태도
    "묶이지 않음" 판정 대상에 포함시킬 것. 후자가 이 가드의 존재 이유(감사 바인딩 누락을
    앞으로도 잡는 것)에 더 부합한다. 어느 쪽이든 두 RESOLUTION.md 의 "이미 문서화됨" 서술은
    사실이 아니므로 정정이 필요하다.

- **[INFO]** `record()` catch 블록의 `err instanceof Error ? err.message : String(err)`
  분기 중 `false` 쪽(Error 가 아닌 값이 throw 된 경우)이 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:118`
  - 상세: 이 삼항 자체는 이번 diff 가 새로 만든 게 아니라(로그 포맷만 확장됐고 조건식은
    그대로) 기존 패턴이지만, 새 관측 테스트 스위트(`audit-logs.spec.ts:145-234`)가 전부
    `save` 를 `new Error(...)` 로만 reject 시킨다. TypeORM 에러가 항상 `Error` 인스턴스라
    실무 위험은 낮지만, `String(err)` 분기가 한 번도 실행되지 않은 채로 남아 있다.
  - 제안: 급하지 않음. 다음에 이 catch 블록을 건드릴 계기가 있으면
    `save.mockRejectedValue('plain string reject')` 케이스를 추가해 두 분기를 모두 고정할
    가치가 있다.

## 잘된 점 (참고)

- `audit-logs.spec.ts` 의 새 스위트(게이트 145-234)는 "정상 경로에서는 카운터를 올리지
  않는다" 테스트로 "항상 올린다" 가 통과하는 vacuous 함정을 스스로 막고, 로그 메시지 단언도
  4개 필드를 **개별** `toContain` 으로 쪼개 "하나만 있어도 통과" 를 방지한다 — 이 저장소가
  반복 강조하는 "GREEN 이 증거가 아니다" 원칙을 잘 따른다.
- `business-metrics.service.spec.ts` 의 클램핑 경계 테스트는 65자를 넣는다 — 64자를 넣으면
  자르든 안 자르든 결과가 같아 분기를 못 가르는 fixture 가 됐을 것이다. 경계값을 정확히
  겨눈 드문 사례다.
- `audit-action-binding.spec.ts` 는 `[전제]` 테스트(`sites.length >= 5`,
  `AUDIT_HELPER_NAMES.size > 0`)로 "0건 검사인데 통과처럼 보이는" 상태를 스스로 차단한다.
  판정 fixture 6종도 형태(맨 union / property 부재 / positional / lookalike 타입 / 무관한
  메서드)를 골고루 커버한다 — 화살표 필드 케이스만 빠진 것이 유일한 구멍이다(위 WARNING).
- `AuditLogsService.record()` catch 안의 metrics 호출을 자체 `try/catch` 로 한 번 더 감싼
  설계와, 그 계약이 실제로 지켜지는지 확인하는 "metrics 호출이 던져도 삼킨다" 테스트는
  swallow 계약의 핵심을 정확히 겨눈다.

## 요약

핵심 기능 변경(카운터 신설, 로그 필드 확장, `@Optional` 조립, 클램핑, 타입 바인딩 가드) 각각에
대해 새 테스트가 추가돼 있고 개별 품질(경계값 선정, 개별 필드 단언, `[전제]` vacuity 가드)은
평균 이상이다. 다만 실측으로 뮤테이션을 재현한 결과 두 군데에서 "테스트/가드가 실제로 잡는 것"
과 "plan·RESOLUTION 이 잡는다고 적은 것" 사이에 간극이 있었다 — (1) `@Optional` 회귀는 이름
붙은 전용 테스트가 아니라 무관한 기존 `findAll` DI 스위트의 부수효과로만 잡히고, (2)
`recordAudit` 를 화살표 함수 필드로 쓰면 신설 가드가 그 존재조차 인식하지 못하는데, 두 차례
RESOLUTION.md 가 이 사실을 "가드 헤더에 이미 문서화됨" 이라 잘못 기록했다(grep 0건으로 확인).
둘 다 지금 당장 살아있는 프로덕션 버그는 아니지만, 회귀 검출력이 실제보다 강하다고 잘못 믿게
만드는 기록이라 정정이 필요하다.

## 위험도

MEDIUM
