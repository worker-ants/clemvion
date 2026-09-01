# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO]** `AuditLogsService` → `BusinessMetricsService` 모듈 간 신규 결합
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:8, 19, 104`
  - 상세: audit-logs 모듈(감사 영속화 책임)이 metrics 모듈(관측 인프라)에 대한 의존을
    새로 갖게 됐다. 순환 의존은 없음을 확인했다(`metrics/` 하위 어디에도 `audit-logs`
    참조 0건, `AuditLogsModule` 도 `MetricsModule` 을 import 하지 않음 — `MetricsModule`
    이 `@Global()` 이라 명시 import 없이도 DI 가 해석된다). `@Optional()` 로 부재
    시 안전하게 no-op 되므로 audit-logs 의 핵심 책임(영속화)이 metrics 가용성에
    종속되지는 않는다. `idempotency.interceptor.ts` 가 동일 패턴(`@Optional() metrics?`)
    으로 선례를 남겨 결합 방식 자체는 저장소 관례와 일치한다.
  - 제안: 없음(설계상 수용 가능). 다만 metrics 의존이 향후 audit-logs 외 다른 도메인
    서비스로 계속 번지면, "누가 무엇을 관측하는가" 는 `BusinessMetricsService` 쪽
    docstring(현재 `recordAuditWriteFailed`/`recordRedisFailOpen` 각각에 준수)으로
    계속 SoT 를 유지할 것.

- **[INFO]** swallow 경계 내부에 무보증 side-effect 호출 — 기존 패턴을 그대로 계승
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:104-105` (`catch (err) { this.metrics?.recordAuditWriteFailed(...); this.logger.warn(...); }`)
  - 상세: `record()` 의 존재 이유는 "감사 실패가 절대 본 요청을 깨뜨리지 않는다" 는
    무조건적 swallow 계약이다(docstring 명시). 이번 변경으로 그 catch 블록 안에
    `this.metrics?.recordAuditWriteFailed()` 호출이 추가됐는데, 이 호출 자체가
    (예: OTel Counter 내부 오류로) 동기적으로 throw 하면 더는 감쌀 catch 가 없어
    swallow 계약이 깨진다 — 계약의 강건성이 이제 "OTel API 는 절대 throw 하지
    않는다" 는 전이적 가정에 의존하게 된다. 다만 `idempotency.interceptor.ts` 의
    `recordRedisFailOpen` 호출 4곳도 동일하게 무보호로 fail-open 경로 내부에서
    호출되고 있어(`grep` 확인), 이는 이 PR 이 만든 새 패턴이 아니라 저장소 전역의
    기존 컨벤션을 그대로 계승한 것이다. plan 의 뮤테이션 4축(원상태 복원·성공경로
    카운터 증가·resourceId 제거·`@Optional` 제거)에도 "metrics 호출 자체가 던지는"
    경로는 포함되지 않았다.
  - 제안: 우선순위 낮음(계승된 기존 패턴이라 이 PR 단독 회귀 아님). 근본적으로
    닫으려면 `BusinessMetricsService` 의 각 `record*` 메서드 내부에서 자체적으로
    try/catch 하여 "관측 실패가 관측 대상 실패보다 우선하지 않는다" 는 불변식을
    호출부가 아니라 메트릭 서비스 자신이 구조적으로 보장하도록 하는 편이 두
    선례(redis-fail-open, audit-write-failed) 모두를 한 번에 닫는다.

- **[INFO, 설계 긍정]** `AuditActionFor<T>` 팬텀 타입 + repo-guard 조합으로 팩토리
  추출을 대체 — 과도한 추상화를 피하면서 회귀를 구조적으로 방지
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:82-86`,
    `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
  - 상세: plan 문서(`plan/in-progress/spec-sync-auth-gaps.md` W4 항목)가 기록한 대로,
    5개 `recordAudit` helper 는 `details` 계약이 전부 달라 공통 팩토리로 뽑으면
    억지 추상화(강제된 얇은 공통분모)가 된다. 대신 (a) 각 helper 의 `action` 파라미터
    타입을 `AuditActionFor<typeof RESOURCE_TYPE>` (Extract 기반 판별 유니온)로
    묶고, (b) `codebase/backend/src/modules` 전체를 AST(ts-compiler) 로 스캔해
    바인딩되지 않은 `recordAudit` 형태를 검출하는 fitness-function 가드를 추가했다.
    이는 OCP 관점에서 바람직하다 — 새 리소스가 추가돼도 가드 자체를 고칠 필요
    없이 동일 검사가 계속 적용된다. `{name}-guard.ts` / `{name}-fixture.ts` /
    `{name}.spec.ts` 3분할은 `engine-error-code-anchor-guard.ts` 등 기존 5개
    가드와 동일한 구조를 그대로 따른다(`ls repo-guards/__tests__/` 로 확인).
  - 제안: 없음. 좋은 설계 판단으로 평가.

- **[INFO]** 가드의 탐지 범위는 메서드 **이름**(`recordAudit`) 기반 — 호출부의
  실제 위임 대상(`AuditLogsService.record`)까지는 검증하지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:21` (`AUDIT_HELPER_NAMES`), `:66-96` (`findAuditHelpers`)
  - 상세: 가드는 `codebase/backend/src/modules` 하위에서 이름이 `recordAudit` 인
    메서드를 찾아 그 첫 파라미터 객체의 `action` 프로퍼티 타입이
    `AuditActionFor<...>` 로 시작하는지만 검사한다. 즉 (1) 이름이 다른 helper
    (예: `logAudit`)는 실제로 `AuditLogsService.record()` 를 호출해도 스캔
    대상에서 빠진다(false negative), (2) `action` 타입은 바인딩돼 있어도
    그 helper 가 넘기는 `resourceType` 문자열 리터럴이 그 바인딩과 실제로
    일치하는지는 `record()` 자체의 시그니처가 `resourceType: string`(열림)
    이라 이 가드도, 컴파일러도 확인하지 못한다 — 원 결함과 다른 종류의
    실수(타입은 묶였지만 `resourceType` 상수만 오기재)는 여전히 통과한다.
    이는 설계 문서(`audit-action-binding.spec.ts` 헤더 주석)가 스스로 명시한
    트레이드오프이고, 실제 발견된 결함(맨 union)을 정확히 잡는 판별 프로브(tsc
    0-에러 vs TS2322 대조군)로 검증됐으므로 의도된 범위 축소이지 은폐된 결함은
    아니다.
  - 제안: 우선순위 낮음. `AUDIT_HELPER_NAMES` 는 이미 `Set` 으로 확장 가능하게
    설계돼 있어 명명 컨벤션이 늘어나면 대응 가능하다. `resourceType` 정합까지
    닫으려면 `AuditLogsService.record()` 의 `resourceType` 자체를 리소스별
    닫힌 유니온으로 좁히는 별도 트랙이 필요하며, 이는 `BusinessMetricsService.
    recordAuditWriteFailed` docstring 이 이미 "record() 가 닫힌 유니온을 받게
    되면 그때 좁힌다" 고 스스로 예고하고 있다(§계약 계층화가 일관됨).

- **[INFO]** `record()` 자체는 여전히 열린 계약, 바인딩은 파사드(facade) 계층에서만
  강제 — 계층 분리가 의도적이고 일관됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:76-84` (`record()` 시그니처: `action: AuditAction`, `resourceType: string`)
  - 상세: 낮은 레벨의 범용 `AuditLogsService.record()` 는 어떤 producer 든 호출
    가능하도록 여전히 넓은 타입(`AuditAction` 전체 union, `resourceType: string`)
    을 받는다. 리소스별 바인딩은 각 도메인 서비스의 private `recordAudit()`
    파사드에서만 강제된다(`AuthConfigsService.recordAudit`, `TriggersService.
    recordAudit` 등). 이는 "범용 인프라 서비스는 개방적으로, 도메인 파사드는
    좁게" 라는 합리적인 레이어 책임 분리이며, 가드도 정확히 이 파사드 계층만
    스캔하도록 스코프가 맞춰져 있다(`MODULES_DIR` = 서비스 소스, `audit-logs/`
    자신은 스캔 대상에서 자연히 제외됨 — `record()` 자체는 바인딩 대상이 아니므로
    옳은 경계다).
  - 제안: 없음. 의도된 계층 구조로 판단.

## 요약

핵심 변경은 두 갈래다. (1) `AuditLogsService.record()` 의 swallow(삼킴) 계약에 관측
가능성(메트릭 카운터 + 유실 대상 식별 가능한 경고 로그)을 추가했고, `@Optional()`
+ `@Global` MetricsModule 조합으로 audit-logs 모듈의 핵심 책임(영속화)이 metrics
가용성에 종속되지 않도록 결합도를 낮춰 뒀다. (2) `auth-configs.service.ts` 의
`recordAudit` 헬퍼가 다른 4개 자매 헬퍼와 달리 맨 `AuditAction` union 을 쓰던 타입
경계 구멍을 `AuditActionFor<T>` 로 닫고, 공통 팩토리 추출(과도한 추상화가 될 수
있었던 선택지) 대신 AST 기반 repo-guard 로 "리소스에 묶이지 않은 감사 헬퍼" 라는
구조적 불변식을 강제하는 fitness function 을 신설했다 — 기존 5개 가드와 동일한
`{name}-guard/{name}-fixture/{name}.spec` 3분할 컨벤션을 그대로 따른다. 순환
의존성은 없으며(metrics → audit-logs 참조 0건), 레이어 경계(범용 `record()` vs
리소스별 파사드)도 일관되게 유지된다. 지적한 항목은 전부 INFO 수준으로, swallow
경계 내부의 무보호 metrics 호출은 이 PR 이 새로 만든 패턴이 아니라
`idempotency.interceptor.ts` 의 기존 관례를 그대로 계승한 것이고, 가드의 이름
기반 탐지 범위 축소도 설계 문서가 스스로 인지하고 있는 트레이드오프다. 전반적으로
과도한 추상화를 피하면서 타입 시스템 + 정적 가드로 회귀를 구조적으로 방지하는
설계 판단이 돋보인다.

## 위험도
LOW


---

## ⚠️ 사후 정정 (2026-09-01, 리뷰 4라운드에서 발견)

**원문은 기록이므로 손대지 않고 아래에 정정만 덧붙인다.** 이 문서의 두 서술이 사실과 다르다.

### 1. "가드의 한계가 설계 문서에 이미 트레이드오프로 명시됨" — **거짓**

대상 3파일(`audit-action-binding-{guard,fixture}.ts`, `audit-action-binding.spec.ts`)을
`화살표|arrow|트레이드오프|한계|제약` 으로 grep 한 결과 **0건**. 그런 명시는 존재한 적이 없다.

이 문장이 1·2라운드 RESOLUTION 에 그대로 인용돼 **화살표 함수 클래스 필드 미인식을 "의도적
경계" 로 분류하고 조치를 건너뛰는 근거**가 됐다. 실측하니 그 형태는 탐지 **0건**이었고, 즉
이 PR 이 막으려는 결함이 문법만 바꾸면 재도입될 수 있었다. 3라운드에서 가드에
`PropertyDeclaration` + 화살표 분기를 추가해 닫았다(뮤턴트 Y1 → RED).

두 RESOLUTION 의 해당 문단에도 같은 정정을 달았다.

### 2. "`audit-logs/` 는 스캔 대상에서 자연히 제외됨" — **부정확**

가드는 `MODULES_DIR`(`codebase/backend/src/modules`) **전체를 재귀 스캔**한다.
`audit-logs/` 도 스캔은 되고, 다만 그 안에 `recordAudit` 이라는 이름의 helper 가 없어
`AUDIT_HELPER_NAMES` 필터에서 걸러질 뿐이다. "경로에서 제외" 와 "이름 필터에서 제외" 는
다르다 — 전자로 읽으면 `audit-logs/` 에 helper 를 추가해도 안 잡힌다고 오해하게 된다.

### 왜 남겨 두는가

지우면 "왜 그때 그렇게 판단했는가" 의 기록이 사라진다. 이 문서의 잘못된 인용이 두 라운드에
걸쳐 조치를 미루게 한 경로 자체가 남길 가치가 있다 — **리뷰 산출물의 주장도 검증 대상**이라는
사례다.
