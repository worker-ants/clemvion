# 테스트(Testing) 리뷰 — audit-record-factory (2026-09-01 17:06:30, 7라운드)

## 검토 방법

이 changeset 은 이미 6라운드의 리뷰·수정을 거쳤고(1R MEDIUM/W5 → 6R LOW/W1 수렴), 각 라운드
RESOLUTION 에 뮤테이션 예측/실측이 상세히 기록돼 있다. 문서 서술을 그대로 믿는 대신, 테스트
관점에서 가장 핵심적인 두 계약을 **독립적으로 재현**했다(저장소 파일을 `cp` 로 스크래치에
백업 후 수정 → 테스트 실행 → `cp` 로 원복 → `diff`/`git status --short` 로 원복 확인):

1. `AuditLogsService.record()` catch 블록의 관측 호출을 감싼 내부 `try`/`catch` 를 제거
   (X5/M 계열 뮤턴트 재현) → `metrics 호출이 던져도 삼킨다` 테스트가 **RED** (`Rejected to
   value: [Error: meter exploded]`) — RESOLUTION W2 의 주장과 일치.
2. 생성자의 `@Optional()` 데코레이터를 제거 (Y2 뮤턴트 재현) → `metrics provider 없이 DI
   조립이 성공한다 (@Optional)` 테스트가 **RED** (Nest DI 해석 실패), 동시에 무관한
   `findAll` 스위트 2건도 함께 RED — 3라운드 RESOLUTION 이 "이름은 계약을 말하는데 예전엔
   무관한 스위트만 잡았다" 고 적은 것과 정확히 일치. 원복 후 `diff` 로 바이트 동일 확인,
   `git status --short` 로 잔여물 없음 확인(`review/code/2026/09/01/17_06_30/` 신규 산출물
   외 변경 없음).

대상 테스트 스위트(`audit-logs.spec.ts`, `audit-action-binding.spec.ts`,
`business-metrics.service.spec.ts`)를 직접 실행 — **3 suites / 40 passed**.

## 발견사항

- **[INFO]** `recordExecutionError` 에 `clampLabel` 대칭 테스트가 여전히 없다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:54-56`
    (`recordExecutionError → execution.errors{error_code} += 1` 테스트에 클램핑 케이스 부재).
    대조: `recordAuditWriteFailed` 는 `:68-83` 에 이름·클램핑 두 테스트를 모두 가짐.
  - 상세: `clampLabel()` 공유 헬퍼가 두 카운터에 쓰이는데 클램핑 자체를 문는 테스트는
    `recordAuditWriteFailed` 쪽에만 있다. `recordExecutionError` 의 `.substring` 을
    `clampLabel()` 호출로 바꾼 리팩터(`business-metrics.service.ts:130-133`)가 클램핑 동작을
    실제로 보존했는지는 `X4`(상한 64→128) 뮤턴트가 간접적으로만 문다. 4라운드 RESOLUTION 이
    이미 이 갭을 실증(뮤턴트로 GREEN 생존 확인)했고 `plan/in-progress/spec-sync-auth-gaps.md:154`
    에 이월 항목으로 등재돼 있다 — **신규 발견 아님, 재확인**.
  - 제안: 이미 plan 에 등재됐고 우선순위 판단으로 미조치 처분됨. 추가 조치 불요(재확인 목적
    기록).

- **[INFO]** `findMisboundHelpers`/`findUnboundHelpers` 가 `action` 이 유니온 타입으로
  선언된 경우를 검증하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    (`extractBoundResourceText`, 단일 `ts.isTypeReferenceNode` 만 처리하고 `ts.UnionTypeNode`
    는 처리 안 함)
  - 상세: `action: AuditActionFor<typeof A> | AuditActionFor<typeof B>` 형태로 선언되면
    `extractActionType` 이 반환하는 텍스트가 `AuditActionFor<` 로 시작하므로
    `findUnboundHelpers` 는 "묶임" 으로 통과시키지만, `extractBoundResourceText` 는
    `TypeReferenceNode` 매칭에 실패해 `null` 을 반환하므로 `findMisboundHelpers` 는 이 helper 를
    **판정하지 않고 건너뛴다**(`boundResource !== null` 조건에서 걸러짐 — 코드 주석이 명시하는
    "모르는 것을 위반으로 세지 않는다" 설계 그대로). 즉 유니온으로 선언하고
    `resourceType` 을 A·B 어느 쪽도 아닌 값으로 기록해도 이 가드는 잡지 못한다. 현재 저장소의
    5개 helper 는 전부 단일 타입 참조라 이 경로가 실제로 발동하지는 않고, `fixture.ts`/
    `audit-action-binding.spec.ts` 에도 유니온 형태 케이스가 없다 — 형태 커버리지가
    "메서드/화살표 필드" 축은 촘촘하지만 "단일 타입 vs 유니온 타입" 축은 비어 있다.
  - 제안: 현재 코드베이스에 발동 사례가 없어 차단 사유는 아니다. 이 가드를 다음에 손댈 때
    유니온 케이스에 대한 fixture(`UNION_BOUND_SOURCE` 류)를 추가해 "모르는 것으로 취급함" 이
    의도인지 "잡아야 하는데 놓침" 인지를 테스트로 명시하면 향후 재발(5R 의 `_NoCrossDomain`
    유예 근거 오판과 같은 패턴 — "간접 방어가 있다" 는 검증 없이 넘어가는 것)을 막을 수 있다.

- **[INFO]** `audit-logs.spec.ts` 신설 3개 테스트가 바로 위 `build()` 헬퍼를 재사용하지 않고
  `repo`/`service` 조립을 인라인 반복
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:202`, `:223`, `:239`
    (헬퍼 정의는 `:154`)
  - 상세: 각 테스트가 `metrics` mock 의 동작(예외를 던지는 mock · provider 자체 부재 · 인자
    생략)이 서로 달라 `build(saveRejects: boolean)` 시그니처를 그대로 재사용할 수 없다.
    가독성에는 영향이 크지 않고(테스트당 5~8줄), 이미 이전 라운드 `maintainability.md`
    (16_29_11)가 같은 지적을 INFO 로 남겼다.
  - 제안: 조치 불요 — 각 테스트가 검증하려는 계약(어떤 mock 형태가 필요한가)이 서로 다르므로
    강제 통합은 오히려 테스트 의도를 흐릴 수 있다.

## 확인된 강점 (회귀 없음)

- **전제(vacuity) 방어**: `audit-action-binding.spec.ts` 가 "helper 를 실제로 찾았다(≥5)",
  "바인딩 대상이 해석됐다(≥5)" 를 별도 `it` 으로 먼저 고정해, 스캔 경로 실수나 정규화 실패가
  "위반 0건" 으로 위장하는 것을 막는다 — 이 세션의 반복 교훈("GREEN 은 증거가 아니다")을 잘
  반영했다.
- **대조군 fixture**: `MATCHED_RESOURCE_SOURCE`(정상 바인딩) vs `WRONG_RESOURCE_BOUND_SOURCE`
  (오귀속), `MIXED_NOTATION_SOURCE`(표기만 다르고 값 동일)로 정규화 로직의 양방향(과탐/누락)을
  모두 문다.
- **경계값**: `business-metrics.service.spec.ts` 의 클램핑 테스트가 65자를 쓰고 64자를 쓰지
  않는 이유를 주석으로 명시(64자는 분기를 못 가르는 fixture) — 뮤테이션 유효성을 미리
  설계했다.
- **DI 계약을 실제로 태움**: `Test.createTestingModule` 로 `BusinessMetricsService` provider
  없이 조립해 `@Optional()` 을 검증 — `new AuditLogsService(repo)` 직접 생성자 호출로는
  DI 데코레이터가 검증되지 않는다는 3라운드의 교훈을 반영. 본 리뷰가 뮤테이션으로 재확인함
  (위 "검토 방법" 참조).
- **swallow 계약의 양방향**: "실패 시 카운터 증가" 뿐 아니라 "정상 경로에서는 카운터를 올리지
  않는다" 를 별도로 단언 — 이 단언이 없으면 "항상 올린다" 는 구현도 첫 테스트를 통과한다는
  점을 주석으로 명시.
- **격리**: 모든 신규 테스트가 로컬 `jest.fn()` mock + `new AuditLogsService(...)` 또는
  독립 `Test.createTestingModule` 로 조립되어 테스트 간 공유 상태가 없다. `describe` 블록
  최상위에서 실행되는 `audit-action-binding.spec.ts` 의 파일시스템 스캔도 읽기 전용이라
  다른 테스트를 오염시키지 않는다(side_effect.md 16_53_16 라운드가 이미 확인).

## 요약

핵심 계약 두 가지(관측 호출의 swallow-격리, `@Optional()` DI 배선)를 리뷰 산출물 서술에
의존하지 않고 직접 뮤테이션·복원으로 재현해 확인했으며, 두 경우 모두 문서의 주장과 일치하는
RED 를 관측했다(원복 후 `diff` 바이트 동일·`git status --short` 잔여물 없음 확인). 대상 테스트
스위트 40건은 모두 통과한다. `audit-action-binding.spec.ts`/`fixture.ts` 는 전제 테스트·대조군
fixture·정규화 검증을 갖춘 높은 완성도의 정적 가드 테스트다. 새로 발견한 갭은 하나뿐이다 —
`action` 이 유니온 타입으로 선언되는 경우 `findMisboundHelpers` 가 판정을 건너뛰는 사각지대(현재
발동 사례 없음). 나머지 두 항목(`recordExecutionError` 클램핑 대칭 테스트 부재,
`build()` 헬퍼 미재사용)은 이전 라운드에서 이미 지적·처분된 항목의 재확인이며 plan 에 등재돼
있다. Critical/Warning 급 신규 결함은 없다.

## 위험도
NONE
