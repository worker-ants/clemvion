# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[WARNING]** `review/code/2026/09/01/14_31_12/architecture.md` (이번 changeset 이 신설한 리뷰 산출물) 에 **검증되지 않은 "설계 문서가 스스로 명시한 트레이드오프" 인용** 및 **가드 스캔 범위에 대한 부정확한 서술**이 남아 있다 — 같은 PR 안에서 이미 3회 재발한 "허위 근거 인용" 결함 클래스와 동일하다.
  - 위치: `review/code/2026/09/01/14_31_12/architecture.md:54-75` (항목 "가드의 탐지 범위는 메서드 이름 기반…" 및 "record() 자체는 여전히 열린 계약…")
  - 상세:
    1. 해당 항목은 "가드가 `resourceType` 상수와 `AuditActionFor` 제네릭 인자의 일치까지는 검사하지 않는다"는 한계를 지적한 뒤 **"이는 설계 문서(`audit-action-binding.spec.ts` 헤더 주석)가 스스로 명시한 트레이드오프이고… 은폐된 결함은 아니다"** 라고 결론짓는다. 직접 확인했다: `audit-action-binding-guard.ts`·`audit-action-binding.spec.ts`·`audit-action-binding-fixture.ts` 세 파일을 `제네릭|generic|resourceType.*일치` 로 grep 하면 **0건**이다. 세 파일의 헤더 주석은 "판정은 값이 아니라 형태로 한다"만 서술할 뿐, "제네릭 인자와 resourceType 상수의 일치는 검사 범위 밖"이라는 문장은 어디에도 없다. 즉 이 인용은 사실이 아니다.
    2. 바로 다음 항목은 "가드도 정확히 이 파사드 계층만 스캔하도록 스코프가 맞춰져 있다(`MODULES_DIR` = 서비스 소스, `audit-logs/` 자신은 스캔 대상에서 자연히 제외됨…)"이라고 적는다. 그러나 `collectSourceFiles()`(`audit-action-binding-guard.ts:38-57`)는 `MODULES_DIR` 하위를 **재귀적으로 전부** 훑고 `audit-logs.service.ts` 도 예외 없이 포함된다 — `record()` 가 가드에 안 걸리는 이유는 디렉터리 스코핑이 아니라 **메서드 이름이 `AUDIT_HELPER_NAMES`(`recordAudit`)와 일치하지 않기 때문**이다. "audit-logs/ 자신은 스캔 대상에서 자연히 제외됨" 이라는 서술은 메커니즘을 틀리게 지목한다.
    3. 이 파일은 같은 PR 안에서 **정확히 같은 결함 클래스**가 이미 두 차례 자기-발견·자기-정정된 사례(`review/code/2026/09/01/15_10_38/RESOLUTION.md`, `15_25_56/RESOLUTION.md` — 둘 다 "화살표 함수 필드가 가드 헤더에 트레이드오프로 이미 문서화돼 있다"는 문장이 grep 0건으로 반증되어 블록쿼트로 정정됨)와 나란히 존재한다. 그 정정 작업이 `RESOLUTION.md` 두 파일에는 적용됐지만, **같은 성격의 허위 인용이 담긴 `architecture.md` 자신은 한 번도 손대지 않았다**(`git log --oneline -- review/code/2026/09/01/14_31_12/architecture.md` → 생성 커밋 1개뿐, 수정 이력 없음). 리뷰 산출물이 SoT 는 아니지만, 이미 병합될 changeset 의 일부로 커밋되며 다음 사람이 "가드의 알려진 한계는 문서화돼 있다"고 믿고 넘어갈 근거로 재사용될 수 있다 — 이번 라운드에서 실제로 그 위험이 현실화됐다(같은 PR 의 RESOLUTION 이 두 번 반복 인용했다).
  - 제안: `architecture.md` 는 과거 라운드의 스냅샷이라 소급 수정이 관례는 아니지만(`RESOLUTION.md` 처럼 별도 파일이 사후 정정을 명시한 선례를 따름), 적어도 이번 라운드(`15_49_24`)의 SUMMARY 나 최종 아카이브 지점에서 "1라운드 `architecture.md` 의 두 항목이 사실과 다르다"는 정정을 남길 것. 근본적으로는 리뷰 산출물에서 "설계 문서가 이미 명시한다"류의 주장을 쓸 때 인용 대상을 grep 으로 먼저 확인하는 습관을 굳힐 필요가 있다(이번 PR 자체가 그 필요성을 두 번 증명했다).

- **[INFO, 설계 긍정 — 재확인]** `AuditActionFor<T>` (Extract 기반 판별 유니온) + `_NoCrossDomain` 컴파일 타임 불변식 + AST 기반 repo-guard(fitness function) 3중 방어가 OCP 를 지키면서 회귀를 구조적으로 막는다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:111-142` (`AuditActionFor`, `_NoCrossDomain`), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:82-88`, `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
  - 상세: 직접 확인했다 — `_NoCrossDomain` 은 `'trigger.created' extends AuditActionFor<'workflow'> ? never : true` 형태로 **다른 도메인 액션이 좁혀진 타입에 들어오면 빌드가 깨지도록** 고정하고, `tsconfig.build.json` exclude 를 피해 소스 파일에 위치해 `nest build` 가 항상 검증한다. repo-guard(`audit-action-binding-guard.ts`)는 메서드 선언과 화살표 함수 클래스 필드 양쪽을 정규화해 인식하며(`auditHelperParams()`), fixture 9종으로 형태 커버리지를 fixture 파일에 고정해 자기반증 테스트 함정을 피한다. `{name}-guard.ts`/`{name}-fixture.ts`/`{name}.spec.ts` 3분할 구조는 `ls codebase/backend/src/repo-guards/__tests__/` 로 확인한 결과 기존 `engine-error-code-anchor-*` 와 동일한 컨벤션이다. 공통 팩토리 추출(강제된 얇은 공통분모) 대신 "지켜지는지 검사하는 가드"를 택한 처방은 5개 helper 의 `details` 계약이 전부 다르다는 실측(plan 문서 표)에 부합하는 합리적 트레이드오프다.
  - 제안: 없음. 좋은 설계 판단.

- **[INFO — 재확인]** `AuditLogsService` → `BusinessMetricsService` 모듈 간 결합, 순환 의존 없음.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:1,8,19,110`, `codebase/backend/src/modules/metrics/metrics.module.ts`, `codebase/backend/src/modules/audit-logs/audit-logs.module.ts`
  - 상세: `MetricsModule` 은 `@Global()` 이고 `providers`/`exports` 에 `BusinessMetricsService` 만 있을 뿐 `audit-logs` 를 import 하지 않는다(파일 직접 확인). `AuditLogsModule` 도 `MetricsModule` 을 import 하지 않는다(전역이라 불필요). `@Optional()` 주입이라 metrics 부재 시에도 `AuditLogsService` 의 핵심 책임(영속화)이 깨지지 않는다 — 이는 `idempotency.interceptor.ts` 의 기존 관례(`@Optional() metrics?: BusinessMetricsService`)를 그대로 따른 것으로, 저장소 전역에서 "관측은 선택적 의존"이라는 일관된 결합 방식이 유지된다. 순환 참조 없음을 직접 확인했다.
  - 제안: 없음.

- **[INFO]** `record()` catch 블록이 영속화 실패 처리 · 관측(metrics) · 로깅 세 책임을 한 메서드 안에서 순차 수행 — SRP 관점에서 경계가 다소 두껍지만, 규모·선례 양쪽에서 아직 분리를 요구할 정도는 아니다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:96-120` (`record()` 의 `catch (err) { … }`)
  - 상세: `try { this.metrics?.recordAuditWriteFailed(...) } catch { }` 로 관측 실패를 이중 격리한 것은 "swallow 계약이 관측 때문에 깨지면 안 된다"는 이 메서드의 존재 이유를 정확히 지킨 설계이지만, 결과적으로 한 catch 블록이 (1) 카운터 증가 (2) 그 실패의 재삼킴 (3) 구조화되지 않은 문자열 로그 조립까지 담당한다. 현재는 6줄 남짓이라 과도한 응집도 훼손은 아니며, `idempotency.interceptor.ts` 에도 유사한 패턴이 선례로 있어 저장소 관례와 일관된다.
  - 제안: 조치 불필요. 다만 향후 세 번째 관측 채널(예: 알림·이벤트 발행)이 추가되면 "swallow + observe" 를 캡슐화하는 작은 헬퍼(`safeObserve(fn)`)로 추출해 두 곳(redis-fail-open, audit-write-failed)이 같은 안전장치를 공유하게 하는 편이 스케일한다 — 이는 1라운드 `architecture.md` 가 이미 지적한 방향과 같다(그 항목 자체는 허위 인용이 아니라 유효한 제안이었다).

- **[INFO — 재확인]** 레이어 분리: 범용 `AuditLogsService.record()` 는 여전히 열린 타입(`action: AuditAction`, `resourceType: string`)을 받고, 리소스 바인딩은 도메인 파사드(`AuthConfigsService.recordAudit` 등)에서만 강제된다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:76-84`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:81-97`
  - 상세: "범용 인프라 서비스는 개방적으로, 도메인 파사드는 좁게"라는 레이어 책임 분리가 일관되게 유지된다. repo-guard 의 `AUDIT_HELPER_NAMES = {'recordAudit'}` 필터는 이 파사드 계층의 메서드만 골라내므로, `record()` 자체가 검사 대상에서 빠지는 것은 (위 WARNING 에서 정정했듯) 디렉터리 스코핑이 아니라 이름 필터에 의한 것이지만, 그 결과 자체(= `record()` 는 바인딩 대상이 아니다)는 여전히 옳은 경계 판단이다.
  - 제안: 없음.

## 요약

핵심 변경은 두 갈래다 — (1) `AuditLogsService.record()` 의 swallow 계약에 카운터·상세 로그로 관측 가능성을 더했고 `@Optional()` + `@Global` MetricsModule 로 결합도를 낮게 유지했다. (2) `auth-configs.service.ts` 의 `recordAudit` 이 자매 helper 4개와 달리 맨 `AuditAction` union 을 쓰던 타입 구멍을 `AuditActionFor<T>` + `_NoCrossDomain` 컴파일 불변식 + AST fitness-function 가드 3중으로 닫았다. 순환 의존 없음, 레이어 경계(범용 `record()` vs 리소스별 파사드) 유지, 새 repo-guard 는 기존 5개 가드와 동일한 `{name}-guard/{name}-fixture/{name}.spec` 컨벤션을 따른다 — 코드 자체의 아키텍처 품질은 양호하다. 다만 이번 changeset 이 함께 커밋하는 **리뷰 산출물 `review/code/2026/09/01/14_31_12/architecture.md`(1라운드 architecture 리뷰, 즉 이 리뷰어의 과거 출력물)에 두 건의 검증되지 않은/부정확한 서술**이 남아 있다 — "가드의 한계가 설계 문서에 이미 명시돼 있다"는 인용은 grep 0건으로 반증되고, "audit-logs/ 는 스캔 대상에서 제외된다"는 서술은 실제 스캔 메커니즘(디렉터리 전수 스캔 + 이름 필터)과 다르다. 이 정확히 같은 실패 패턴("설계 문서가 스스로 명시한 트레이드오프"라는 미검증 인용)이 같은 PR 안에서 `RESOLUTION.md` 두 파일에 걸쳐 이미 두 번 자기-발견·정정됐는데도, 그 정정이 `architecture.md` 자신에는 적용되지 않았다는 점이 이번 리뷰의 유일한 신규 WARNING 이다.

## 위험도
LOW
