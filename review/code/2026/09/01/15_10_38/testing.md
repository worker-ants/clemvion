# 테스트(Testing) 코드 리뷰 — audit-record-factory (2차, RESOLUTION 반영 후)

## 검증 방법

저장소를 뮤테이션하지 않는 것을 기본으로 하되, W2(관측 호출 무보호) 수정이 실제로 회귀를
잡는지 확인하기 위해 `audit-logs.service.ts` 를 **scratch 디렉터리에 원본을 `cp` 로 백업 후**
저장소 파일을 직접 고쳐 뮤테이션 테스트를 1건 수행하고, 끝난 즉시 `cp` 로 원복했다
(`git checkout`/`restore` 미사용). 원복은 `git status --short` 로 clean 확인했다
(현재 유일한 untracked 항목은 이 리뷰 세션 자신의 출력 디렉터리
`review/code/2026/09/01/15_10_38/` 뿐).

```
npx jest src/modules/audit-logs/audit-logs.spec.ts \
         src/modules/metrics/business-metrics.service.spec.ts \
         src/repo-guards/__tests__/audit-action-binding.spec.ts \
         src/modules/auth-configs/auth-configs.service.spec.ts
→ Test Suites: 4 passed, 4 total / Tests: 77 passed, 77 total
```

뮤테이션 검증(W2 — catch 안 `this.metrics?.recordAuditWriteFailed(...)` 의 자체
`try`/`catch` 제거):

```
- 예측: RED (`metrics 호출이 던져도 삼킨다` 테스트가 reject 를 잡아야 함)
- 실측: RED — `expect(received).resolves.toBeUndefined()` 가
  `Rejected to value: [Error: meter exploded]` 로 실패. 1 failed, 9 passed.
- 원복 후 재실행 불필요(같은 파일 재실행은 위 GREEN 결과로 이미 확인) — `git status --short`
  로 clean 만 재확인.
```

`private recordAudit` 선언을 `codebase/backend/src/modules/` 전체에서 grep 하면 정확히
5건(`triggers`/`workflows`/`schedules`/`model-config`/`auth-configs`)이라
`audit-action-binding.spec.ts` 의 `sites.length >= 5` 전제 단언이 vacuous 하지 않음도
재확인했다.

## 발견사항

- **[INFO, 확인됨 — 전회 WARNING 해소]** `BusinessMetricsService.recordAuditWriteFailed` 구현
  자체가 실행되지 않던 갭(전회 testing.md W1)이 해소됐다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:73-88`
    (신규 테스트 2건 — 카운터 호출 단언, 65자→64자 클램핑 경계 단언)
  - 상세: 직접 `Read` 로 파일을 열어 확인한 결과 카운터 이름·라벨 키(`resource_type`)·클램핑을
    실제로 exercise 하는 테스트가 붙어 있다. 클램핑 테스트는 64자가 아니라 **65자**를
    입력해 분기를 가르는 값을 쓴다(64자면 자르든 안 자르든 같은 값이라 클램핑 제거 뮤턴트도
    통과했을 것) — 좋은 판단.
  - 제안: 없음. 형제 메서드(`recordExecutionError`, `recordRedisFailOpen`)와 동일한 직접
    테스트 패턴에 합류했다.

- **[INFO, 확인됨 — 전회 WARNING(side_effect) 해소]** swallow 계약 내부의 무보호 metrics 호출이
  자체 `try`/`catch` 로 감싸졌고, 그 계약을 실제로 무는 테스트가 있다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
    (자체 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`),
    회귀 테스트는 `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:202-221`
    (`'metrics 호출이 던져도 삼킨다 — 관측이 새 실패 경로가 되면 안 된다'`)
  - 상세: 이 리뷰가 직접 그 `try`/`catch` 를 제거하는 뮤테이션을 수행해 위 테스트가 정확히
    그 회귀를 RED 로 잡는 것을 실측 확인했다(위 "검증 방법" 참조). 이 테스트가 없었다면
    "관측이 새 실패 경로가 되지 않는다" 는 이 PR 의 핵심 계약이 향후 리팩터로 조용히
    깨져도 아무 테스트도 잡지 못했을 것이다.
  - 제안: 없음.

- **[INFO]** repo-guard 의 형태 커버리지 fixture 에 "제네릭 인자가 있지만 **잘못된
  리소스**에 묶인" 경우가 없다 — 가드 자신의 설계 한계이자, 그 한계가 테스트로 명시적으로
  고정되어 있지 않다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`
    (전체 — `BARE_UNION_SOURCE`/`NO_ACTION_SOURCE`/`POSITIONAL_SOURCE`/
    `LOOKALIKE_TYPE_SOURCE`/`UNRELATED_METHOD_SOURCE` 5종은 있으나 "바인딩은 있지만
    다른 리소스" 케이스는 없음), 대응 로직은
    `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125`
    (`findUnboundHelpers` — `actionType?.startsWith('AuditActionFor<')` 만 검사, 제네릭
    인자 값은 비교하지 않음)
  - 상세: 다른 4개(bare union/no-action/positional/lookalike-type)는 전부 fixture 로
    불변 고정되어 "가드가 이 형태를 잡는다" 는 회귀 방지가 걸려 있는데, 정작 이번 PR 이
    고친 실제 결함과 **인접한** 변형(예: `TriggersService.recordAudit` 가
    `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 를 복붙해 자기 리소스가 아닌
    타입에 묶이는 경우)은 fixture 목록에 없다. 이 케이스를 가드가 못 잡는다는 사실 자체는
    설계 문서(`audit-action-binding.spec.ts` 헤더)와 이전 라운드 security.md 가 이미
    text 로 인지하고 있지만, 다른 5형태처럼 **fixture 로 그 사실을 고정**하지 않아서
    "가드가 이 케이스는 통과시킨다(known limitation)" 라는 사실이 향후 가드 로직이
    바뀌었을 때 조용히 달라져도(예: 누군가 실수로 더 좁혀서 오탐이 생기거나, 반대로
    더 느슨해지는 등) 테스트로 감지되지 않는다.
  - 제안: 필수는 아니다. `it.skip`/전용 `it` 로 `WRONG_RESOURCE_BOUND_SOURCE` 를 추가해
    "현재는 통과시킨다(known gap, resourceType 값까지는 안 봄)" 을 명시적으로 고정하면,
    다음에 이 가드를 강화할 때 그 확장이 실제로 동작을 바꿨는지 대조군으로 쓸 수 있다.

- **[INFO, 회귀 없이 유지 — 전회 지적 그대로 미해결]** `audit-action-binding-guard.ts` 의
  `findAuditHelpers` 가 `ts.isMethodDeclaration` 형태만 인식 — 화살표 함수 클래스 필드로
  선언된 `recordAudit` 는 여전히 조용히 스캔에서 빠진다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:79-96`
    (`findAuditHelpers` 내 `ts.isMethodDeclaration(node) && ...`)
  - 상세: 전회 리뷰(`review/code/2026/09/01/14_31_12/testing.md`)가 이미 지적했고,
    `RESOLUTION.md` 는 "INFO 14건 전부 미조치" 라고 명시했다 — 실측(`Read`)으로 이번
    라운드에도 그대로임을 재확인했다. 현재 5개 helper 는 전부 `MethodDeclaration` 형태라
    실질 위험은 낮지만, 이 가드의 존재 이유가 "앞으로 생길 서비스도 잡는다" 인 만큼
    fixture 에 화살표 함수 형태가 없다는 것은 그 약속의 사각지대로 계속 남는다. 새로
    지적하는 결함이 아니라 **carry-over 확인**이다.
  - 제안: 전회와 동일 — fixture 에 화살표 함수 형태 `recordAudit` 를 추가해 (a) 잡도록
    로직을 확장하거나 (b) 최소한 "현재는 못 잡는다" 를 xfail/문서화 fixture 로 남긴다.

- **[INFO]** `audit-logs.spec.ts` 안에 목적이 같은 서비스 조립 헬퍼 두 벌(`makeService`
  vs `build`)과 동일한 `entry` 리터럴이 두 곳에 중복 — carry-over, 미해결.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-94`(`makeService`)
    vs `:154-167`(`build`); `entry` 리터럴은 `:96-102` 와 `:146-152` 에 동일하게 중복.
  - 상세: 전회 maintainability.md 가 이미 지적했고 이번에도 그대로다. `build(true)` /
    `build(false)` 처럼 boolean flag 인자만으로는 "save 가 reject 하는지" 를 호출부에서
    바로 읽기 어렵다(flag argument 냄새) — 가독성 관점에서 낮은 우선순위지만 재확인.
  - 제안: 전회와 동일 — 상단 공유 상수/헬퍼로 통합하거나 named-option 형태로 전환.

## 강점 (재확인)

- `AuditLogsService.record — 삼킨 실패의 관측` 스위트는 "성공 경로에서는 카운터 미증가"를
  별도로 단언해 "항상 증가시킨다" 는 거짓 구현이 통과하지 못하게 막는다
  (`audit-logs.spec.ts:175-180`). "이 단언이 없으면 '항상 올린다' 도 위 테스트를
  통과한다" 는 주석이 이 설계 의도를 정확히 설명한다.
  `business-metrics.service.spec.ts` 의 클램핑 테스트도 64자가 아니라 65자를 넣어
  분기를 실제로 가르는 값을 쓴다 — 두 곳 모두 이 저장소 MEMORY 가 반복 지적해 온
  "분기를 못 가르는 fixture" 함정을 스스로 피했다.
- 로그 문구 단언(`audit-logs.spec.ts:189-196`)이 `action`/`resourceType`/`resourceId`/
  `workspaceId` 4개 필드를 **각각 개별** `toContain` 으로 검사한다 — 하나만 보면
  나머지 누락이 통과하는 취약점을 스스로 방지.
- `Logger.prototype.warn` spy 는 `try/finally` 로 반드시 `mockRestore()` 되어 테스트 간
  오염이 없다(`audit-logs.spec.ts:184-199`) — 격리 양호.
- `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 타입 좁힘은 순수 컴파일타임
  변경이라 기존 `auth-configs.service.spec.ts` 46개 테스트가 무수정으로 그대로
  GREEN(재실행 확인) — 회귀 없음.
- `audit-action-binding.spec.ts` 는 "helper 0건 발견 시 vacuous" 를 막는 전제 단언
  (`sites.length >= 5`)을 두고 있고, 실측(grep)으로 현재 정확히 5건임을 재확인해
  이 전제가 계속 유효함을 확인했다. fixture 를 라이브 소스가 아닌 별도 파일에 문자열로
  박아 둔 것도 self-defeating 테스트(가드가 목표를 달성하면 검사 대상 형태가 사라져
  버리는 문제)를 정확히 피한 설계다.

## 요약

전회 리뷰(14_31_12)가 지적한 테스트 관점 WARNING — `recordAuditWriteFailed` 구현 자체가
무검증이었던 갭, 그리고 (side_effect 관점) swallow 계약을 깰 수 있던 무보호 metrics 호출 —
둘 다 이번 라운드에서 실제로 고쳐졌고, 이 리뷰가 독립적으로 재실행(77/77 GREEN)과 뮤테이션
(try/catch 제거 → RED 확인 후 즉시 원복)으로 재검증했다. 새 코드 경로(관측 카운터, 로그 필드
확장, `@Optional` 조립, `AuditActionFor` 타입 좁힘, 형태 기반 repo-guard)는 모두 mutation-aware
하게 테스트돼 있고 vacuous 판정을 막는 전제 단언(sites.length, 성공경로 미호출 단언, 65자
경계)이 갖춰져 있다. 남은 발견사항은 전부 INFO — 그중 셋은 전회에서 이미 등재됐고 이번에도
의도적으로 미해결(carry-over, `RESOLUTION.md` 가 명시)인 항목의 재확인이며, 하나(fixture 에
"잘못된 리소스에 묶인" 케이스 부재)는 이번 리뷰가 새로 짚은 것이지만 가드의 설계 한계 자체가
이미 문서화돼 있어 확장 요구가 아니라 그 한계를 fixture 로 고정해 두면 더 좋겠다는 낮은
우선순위 제안이다. Critical·Warning 급 테스트 갭은 없다.

## 위험도
LOW
