# 테스트(Testing) 리뷰 — audit-record-factory

## 검증 방법

저장소를 뮤테이션하지 않고, 대상 파일들을 `Read`/`Grep`으로 확인하고 기존(원본) 테스트를
그대로 실행해 GREEN 을 확인했다(저장소에 어떤 쓰기도 하지 않았으므로 원복 불요):

```
npx jest src/modules/audit-logs/audit-logs.spec.ts \
         src/modules/metrics/business-metrics.service.spec.ts \
         src/repo-guards/__tests__/audit-action-binding.spec.ts
→ Test Suites: 3 passed, 3 total / Tests: 28 passed, 28 total

npx jest src/modules/auth-configs/auth-configs.service.spec.ts
→ Test Suites: 1 passed, 1 total / Tests: 46 passed, 46 total
```

## 발견사항

- **[WARNING]** `BusinessMetricsService.recordAuditWriteFailed` 자체가 어느 테스트에서도 실행되지 않는다 — 카운터 이름·라벨 키·클램핑(64자)이 전부 무검증
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:168` (`recordAuditWriteFailed`) — 대응하는 테스트는 `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` (전체 파일, `describe('BusinessMetricsService (NF-OB-07)')`)
  - 상세: `grep -rn recordAuditWriteFailed codebase/backend/src`로 확인한 결과 이 메서드를 실제로 호출하는 테스트는 `audit-logs.spec.ts`의 `metrics = { recordAuditWriteFailed: jest.fn() }` 뿐이다 — 이는 **mock 스텁**이라 `AuditLogsService`가 이 메서드를 "호출했는지"만 검증하고, `business-metrics.service.ts` 안의 **실제 구현**(카운터 이름 `clemvion.audit.write_failed`, `resource_type` 라벨 키, `resourceType.substring(0, 64)` 클램핑)은 어떤 테스트로도 exercise 되지 않는다. 같은 파일의 형제 메서드 `recordExecutionError`·`recordRedisFailOpen`은 `business-metrics.service.spec.ts`에 직접 호출-단언 테스트가 있고, `recordRedisFailOpen` 테스트 바로 위 주석은 "이 구현 자체는 어느 테스트도 실행하지 않았다... 형제 `record*` 메서드가 모두 여기 테스트를 갖는 이유와 같다"라고 이 패턴의 필요성을 스스로 명문화하고 있다 — `recordAuditWriteFailed`가 바로 그 불변식을 깬 첫 예외다. 특히 이 PR의 doc 주석(§ "왜 클램핑인가")이 카디널리티 방어를 설계 근거로 강하게 내세우는데, `.substring(0, 64)`를 지워도(또는 카운터 이름에 오탈자를 내도) 이 PR 안의 어떤 테스트도 RED 로 바뀌지 않는다 — 관측 자체를 관측할 수 없는 상태다. `plan/in-progress/spec-sync-auth-gaps.md`가 적은 "뮤테이션 4축(예측/실측 전부 RED)"은 `AuditLogsService.record()` 쪽(로그 문구·`@Optional`·카운터 *호출* 여부)만 커버하고, `BusinessMetricsService` 쪽 구현 자체는 그 축에 없다.
  - 제안: `business-metrics.service.spec.ts`에 `recordRedisFailOpen` 테스트와 같은 패턴으로 `it('recordAuditWriteFailed → audit.write_failed{resource_type} += 1', ...)` 를 추가하고, 65자 이상 `resourceType`을 넣어 정확히 64자로 잘리는지(`toHaveBeenCalledWith(1, { resource_type: 'a'.repeat(64) })`) 별도로 단언한다.

- **[INFO]** `audit-action-binding-guard.ts`의 `findAuditHelpers`가 `ts.isMethodDeclaration` 형태만 인식 — 화살표 함수 클래스 필드로 선언된 `recordAudit`는 조용히 스캔에서 빠진다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:79` (`findAuditHelpers` 내 `ts.isMethodDeclaration(node) && ...`)
  - 상세: 현재 5개 helper(`auth-configs`/`model-config`/`schedules`/`triggers`/`workflows`)는 모두 `private recordAudit(params: {...})` 형태(MethodDeclaration)라 가드가 정확히 잡는다(실행 확인: `sites.length` ≥ 5, unbound 0건). 그런데 미래에 새 서비스가 `private recordAudit = (params: {...}) => {...}` (PropertyDeclaration + ArrowFunction, 클래스 필드 문법)로 정의하면 `ts.isMethodDeclaration`이 false 라 그 사이트를 아예 수집하지 못한다. `[전제] helper 를 실제로 찾았다` 테스트는 `toBeGreaterThanOrEqual(5)`라 기존 5개가 그대로 있는 한 새 서비스 1개가 누락돼도 카운트가 줄지 않아(6개 중 5개만 잡혀도 여전히 ≥5) 이 전제 단언도 그 누락을 못 잡는다. 이 가드의 존재 이유가 "앞으로 생길 서비스도 잡는다"(spec-sync-auth-gaps.md, `audit-action-binding.spec.ts` 헤더)인 만큼, 이 형태 하나가 fixture 목록(`BOUND_SOURCE`/`BARE_UNION_SOURCE`/...)에서 빠져 있는 것은 그 약속의 사각지대다.
  - 제안: fixture 에 화살표 함수 형태의 `recordAudit` 를 추가하고, 가드가 이를 (a) 잡아내도록 `visit`에 `ts.isPropertyDeclaration` + 화살표 함수 이니셜라이저 분기를 추가하거나, (b) 최소한 "현재는 못 잡는다"는 사실을 알고 있는 xfail/문서화 fixture 로 남긴다.

- **[INFO]** `audit-logs.spec.ts` 안에 거의 동일한 서비스 조립 헬퍼가 두 벌(`makeService` / `build`) 존재
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — `describe('AuditLogsService.record — best-effort (swallow)')` 안의 `makeService`(원본 파일 89행 부근) vs `describe('AuditLogsService.record — 삼킨 실패의 관측')` 안의 `build`(신규, 154행 부근, unified diff 기준 신규 게이트 154행)
  - 상세: 두 헬퍼 모두 `repo.create`/`repo.save` 를 jest mock 으로 만들어 `AuditLogsService` 를 생성한다는 점에서 사실상 같은 역할이고, `entry` 상수도 두 describe 블록에서 동일한 리터럴로 각각 다시 선언돼 있다(파일 전체에 총 3벌: `AuditLogsService.record — best-effort`, `AuditLogsService.record — 삼킨 실패의 관측` 두 곳 + `AuditLogsService.findAll` 은 별개). 기능 결함은 아니고 각 describe 가 독립적으로 읽히는 장점은 있지만, 향후 `entry`/repo mock shape 가 바뀌면 세 곳을 함께 고쳐야 하는 drift 위험이 있다.
  - 제안: 파일 최상단에 공유 `entry` 상수와 repo-mock 팩토리를 한 번만 선언해 재사용해도 가독성 손실 없이 중복을 줄일 수 있다(단, 리뷰 우선순위는 낮음 — 현재 세 사본이 서로 어긋나 있지 않음을 확인했다).

## 강점 (참고)

- `AuditLogsService.record`의 신규 스위트(파일 2)는 "성공 경로에서 카운터 미증가"를 별도로 단언해 "항상 증가"라는 거짓 구현이 통과하지 않도록 mutation-proof 하게 짜여 있고, 로그 문구 4개 필드를 각각 개별 `toContain`으로 단언해 "하나만 보면 통과"하는 취약점을 스스로 방지한다.
- `Logger.prototype.warn` spy 는 `try/finally`로 확실히 `mockRestore()` 되어 테스트 간 오염이 없다. 실행해 확인한 결과 실제로 GREEN.
- `audit-action-binding.spec.ts`는 "helper 0건 발견 시 vacuous"를 막는 전제 단언(`sites.length >= 5`)과 "검사 이름 집합 비어있지 않음" 전제를 명시적으로 두고 있어, 가드가 조용히 무력화되는 것을 스스로 감시한다. fixture 를 라이브 소스가 아닌 별도 파일에 문자열로 박아 self-defeating 테스트를 피한 설계도 타당하다(가드가 목표를 달성하면 라이브 소스에서 그 형태가 사라지므로, 라이브 소스에 형태 존재를 단언하면 성공이 곧 실패가 된다).
- `auth-configs.service.ts`의 `AuditAction → AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 타입 변경은 순수 컴파일타임 변경이라 기존 46개 `auth-configs.service.spec.ts` 테스트가 수정 없이 그대로 GREEN(재실행 확인) — 회귀 없음.

## 요약

핵심 동작(`AuditLogsService.record`의 swallow 계약, 카운터 *호출* 여부, 로그 문구 4필드, `@Optional` 생성자, `auth-configs`의 타입 바인딩 회귀 방지 가드)은 촘촘하고 mutation-aware 하게 테스트돼 있고 전부 실행 확인상 GREEN 이며 기존 스위트에 회귀도 없다. 다만 이 PR의 관측성 개선 절반 — `BusinessMetricsService.recordAuditWriteFailed`의 실제 구현(카운터 이름·라벨 키·64자 클램핑) — 은 mock 뒤에 완전히 가려져 어떤 테스트도 그 코드를 실행하지 않는다. 같은 파일의 형제 메서드들이 모두 갖고 있는 직접 테스트 패턴에서 이 메서드만 예외이고, 그 메서드의 doc 주석이 정당화하는 설계 결정(클램핑) 자체가 무검증이라는 점이 가장 눈에 띄는 갭이다. 그 외에는 가드의 화살표 함수 형태 블라인드 스팟과 spec 파일 내 헬퍼 중복이 경미한 개선 여지로 남는다.

## 위험도

LOW
