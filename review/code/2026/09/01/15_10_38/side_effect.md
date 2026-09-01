# 부작용(Side Effect) 리뷰 — audit-record-factory (2026-09-01 15:10:38, 2라운드)

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Grep`으로 실제 소스를 대조 확인했다 (`audit-logs.service.ts`,
`business-metrics.service.ts`, `auth-configs.service.ts`, `audit-action.const.ts`,
`audit-action-binding-guard.ts`, `metrics.module.ts`, `audit-logs.module.ts`, `app.module.ts`).
쓰기는 하지 않았으므로 원복 대상 없음 (`git status --short` 확인 불요 — 세션 내내 Read만 사용).

이번 diff 는 1라운드 리뷰(`review/code/2026/09/01/14_31_12/`)의 RESOLUTION 을 포함한다. 1라운드
`side_effect.md` 가 WARNING 으로 지적한 "catch 블록 안 무방비 metrics 호출"은 이번 diff 에서
`try { this.metrics?.recordAuditWriteFailed(...) } catch { … }` 이중 try/catch 로 이미 해소됐다
(`audit-logs.service.ts:109-113`, 실측 확인). 아래는 그 위에서 신규로 관측한 것과, 기존 판단을
재확인한 것이다.

## 발견사항

- **[INFO]** `AuditLogsService` 생성자 시그니처 변경 — 하위 호환 확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19`
    (`@Optional() private readonly metrics?: BusinessMetricsService,`)
  - 상세: 기존 유일한 파라미터(`auditLogRepository`) 뒤에 `@Optional()` + `?:` 로 추가돼
    하위 호환이다. `grep -rn "new AuditLogsService(" codebase/backend/src` 로 직접 인스턴스화
    지점을 전수 확인했다 — `audit-logs.spec.ts` 4곳, `executions-rerun.service.spec.ts` 1곳,
    총 5곳 전부 metrics 인자 생략(1곳) 또는 명시 전달(4곳)로 이미 대응돼 있어 컴파일·런타임
    양쪽에서 깨지는 호출부가 없다. DI 경로는 `MetricsModule` 이 `@Global()`(`metrics.module.ts:8`)
    이고 `app.module.ts:163` 에 루트 등록돼 있어, `AuditLogsModule` 이 명시 import 하지 않아도
    해석된다(`audit-logs.module.ts` 실측 — `MetricsModule` import 없음, 정상).
  - 제안: 없음 — 문제 아님, 확인 목적 기재.

- **[INFO]** `AuditLogsService` → `BusinessMetricsService` 신규 모듈 결합, 순환 의존 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:8` (import),
    `business-metrics.service.ts` 전체(역참조 없음 실측)
  - 상세: `business-metrics.service.ts` 를 전체 열람해 `audit-logs` 관련 import/참조가
    0건임을 확인했다 — 순환 의존 없음. `@Optional()` 이라 metrics 부재 시 `record()` 는
    `this.metrics?.recordAuditWriteFailed(...)` 가 no-op 이 되어 감사 영속화 책임(핵심 경로)이
    metrics 가용성에 종속되지 않는다.
  - 제안: 없음.

- **[INFO]** `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입 좁힘 — 컴파일 타임
  전용, 런타임 영향 없음 (실측 재확인)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:82-86`
  - 상세: `recordAudit` 는 `private` 메서드이고 같은 파일 내 5개 호출부만 사용한다. 실제
    파일을 열어 확인한 결과 `AUTH_CONFIG_RESOURCE_TYPE = 'auth_config'` 상수는 이번 diff 로
    새로 도입된 것이 아니라 이미 파일 상단(모듈 스코프 `const`)에 있던 기존 식별자이고,
    이번 diff 는 그 상수를 타입 레벨(`typeof AUTH_CONFIG_RESOURCE_TYPE`)에서 재사용해
    `action` 타입만 좁혔다. 런타임에 넘어가는 값·쿼리·저장 로직은 변경 없음.
  - 제안: 없음.

- **[INFO]** `BusinessMetricsService.recordExecutionError` 리팩터링 — 동작 동일성 확인
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:66-71`
    (`PROMETHEUS_LABEL_MAX_LEN`, `clampLabel`), `:132-134` (`recordExecutionError`)
  - 상세: 기존 `errorCode.substring(0, 64)` 인라인 로직이 `clampLabel(errorCode)` (내부적으로
    `value.substring(0, PROMETHEUS_LABEL_MAX_LEN)`, `PROMETHEUS_LABEL_MAX_LEN = 64`)로
    치환됐다. 상수 값이 동일(`64`)해 기존 `recordExecutionError` 호출부의 동작에 변화가 없다
    — 순수 중복 제거 리팩터링이지 시그니처·동작 변경이 아니다. (1라운드 RESOLUTION 이 언급한
    "상수를 `@Injectable()` 과 클래스 사이에 잘못 놓아 데코레이터가 `const` 에 붙었던" 결함은
    현재 파일에서 재확인 결과 이미 정정된 위치 — `const` 선언(:66)이 `@Injectable()`(:73) 앞에
    있어 데코레이터 오적용 없음.)
  - 제안: 없음.

- **[INFO]** 신설 repo-guard (`audit-action-binding-guard.ts`/`-fixture.ts`/`.spec.ts`)는
  파일시스템 부작용 없음 — 읽기 전용 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:38-57`
    (`collectSourceFiles`, `fs.readdirSync` 만 사용), `audit-action-binding.spec.ts:32,54-57`
    (`fs.readFileSync` 로 소스 읽기)
  - 상세: `grep -n "fs\." audit-action-binding-guard.ts` 로 확인한 결과 `fs.readdirSync` 1곳
    뿐이고, `fs.writeFileSync`/`fs.rmSync`/`fs.mkdirSync` 등 쓰기·삭제 API 는 두 파일 어디에도
    없다. `REPO_ROOT = path.resolve(__dirname, '../../../../..')` 는
    `__tests__ → repo-guards → src → backend → codebase → repo-root` 5단계로 저장소 루트에
    정확히 귀결된다(경로 세그먼트 수동 검산). 스캔 대상은 `MODULES_DIR =
    'codebase/backend/src/modules'` 로 고정돼 있어 스캔 범위 이탈 없음.
  - 제안: 없음 — 문제 아님, 확인 목적 기재.

- **[INFO]** `AuditLogsService.record()` catch 블록 내부 metrics 호출의 이중 try/catch —
  1라운드 WARNING 해소 확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
  - 상세: 1라운드 `side_effect.md` WARNING("catch 블록 안 metrics 호출이 무방비라 swallow
    계약을 이 diff 자신이 깰 수 있는 새 실패 경로")이 이번 diff 에서 자체 `try { … } catch { }`
    로 해소됐다. `RESOLUTION.md` 가 적은 "뮤턴트 X5(try 제거) 예측 GREEN → 실측 GREEN, 축 추가
    후 RED" 서술과 실제 코드가 일치한다 — `metrics?.recordAuditWriteFailed()` 가 던져도
    바깥 `catch (err)` 블록의 나머지(로그 기록)는 계속 실행되고 `record()` 는 여전히 resolve
    한다. 새로 던지는 값(예: OTel Counter 내부 오류)이 있어도 swallow 계약이 유지된다.
  - 제안: 없음(이미 해소).

## 요약

핵심 변경은 (1) `AuditLogsService.record()` 의 swallow 계약에 관측 가능성(OTel 카운터 +
유실 대상을 담은 경고 로그)을 추가한 것과 (2) `auth-configs.service.ts` 의 `recordAudit`
`action` 파라미터를 `AuditActionFor<T>` 로 좁혀 리소스 오귀속을 컴파일 타임에 차단한 것,
그리고 그 바인딩을 강제하는 읽기 전용 AST 가드 신설이다. 시그니처 변경(`AuditLogsService`
생성자에 `@Optional()` 파라미터 추가, `recordAudit` 의 `action` 타입 좁힘)은 전부 하위
호환이거나 `private`/컴파일 타임 전용이며, 직접 인스턴스화 지점 5곳을 전수 확인해 깨지는
호출부가 없음을 검증했다. 신설 모듈 결합(`AuditLogsService` → `BusinessMetricsService`)은
순환 의존이 없고 `@Optional()` 로 핵심 책임(감사 영속화)이 metrics 가용성에 종속되지
않는다. 신설 repo-guard 는 파일시스템을 읽기만 하며 쓰기·삭제 API 사용이 없다. 가장 중요한
부작용 후보였던 "catch 블록 안 무방비 metrics 호출로 swallow 계약이 스스로 깨질 수 있다"는
1라운드 WARNING이 이번 diff 의 이중 try/catch 로 실측 해소됐다 — 재발 항목 없음. 환경 변수·
네트워크 호출·이벤트/콜백 관점에서 새로 도입된 부작용은 발견하지 못했다.

## 위험도
NONE
