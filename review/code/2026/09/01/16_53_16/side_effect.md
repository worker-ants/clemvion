# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `AuditLogsService` 생성자 시그니처에 파라미터 추가 — 하위호환 확인됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:14-20` (constructor)
  - 상세: `@Optional() private readonly metrics?: BusinessMetricsService` 가 두 번째 파라미터로 추가됐다. 기존 호출부 2곳(`codebase/backend/src/modules/audit-logs/audit-logs.spec.ts`, `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:558` — `new AuditLogsService(auditRepo as never)`)을 직접 확인한 결과 전부 단일 인자(positional) 호출이라 새 파라미터는 `undefined` 로 안전하게 폴백한다. `BusinessMetricsService` 는 `metrics.module.ts` 에서 `@Global()` 로 등록돼 있어(`codebase/backend/src/app.module.ts:163`) 실제 DI 조립에서도 `AuditLogsModule` 이 별도 `imports` 없이 자동 주입받는다 — 순환 의존(metrics → audit-logs 역참조)도 없음을 확인했다. 부작용 관점에서 진짜 위험(런타임 조립 실패·순환 의존·기존 호출부 파손)은 없다.
  - 제안: 조치 불필요 — 실측 확인 완료.

- **[INFO]** `record()` catch 블록 내부에 새 관측 호출이 추가되고 그 실패는 완전히 무로깅으로 삼켜짐
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113` (`record()` catch 내부 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`)
  - 상세: `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 호출을 감싼 내부 `catch` 블록이 완전히 비어 있어(주석만 존재), 관측 자체가 실패해도 어떤 로그도 남기지 않는다. 이는 "감사 실패가 본 요청을 깨뜨리면 안 된다" 는 기존 계약을 관측 계층까지 확장하려는 의도된 설계이고(주석·CHANGELOG·`audit-logs.spec.ts` 의 `'metrics 호출이 던져도 삼킨다'` 테스트, RESOLUTION.md 의 뮤테이션 X5 축으로 검증됨), 이번 diff 가 새로 만든 결함은 아니다. 다만 "관측 실패가 완전히 무로깅으로 사라진다"는 점은 향후 메트릭 라이브러리 버그를 디버깅할 때 단서가 전혀 안 남는다는 트레이드오프이므로 부작용 관점에서 기록해 둔다.
  - 제안: 조치 불필요(의도·테스트됨). 다만 향후 디버깅 편의를 원하면 `console.debug` 수준의 최소 흔적만 남기는 것도 고려 가능(선택 사항).

- **[INFO]** `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입 좁힘 — private 메서드, 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:82-86` (`recordAudit` 파라미터 타입)
  - 상세: `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁혔다. `private` 메서드라 클래스 외부 호출자에게 영향이 없고, 컴파일 타임 전용 변경이라 런타임 부작용도 없다. 시그니처 변경의 "호출자 영향" 관점에서 안전.
  - 제안: 조치 불필요.

- **[INFO]** 신규 정적 가드가 테스트 실행 시 `codebase/backend/src/modules` 전체를 재귀적으로 파일시스템 스캔
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`collectSourceFiles()`), 소비처 `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:41-43` (`describe` 블록 최상위, `it` 밖에서 즉시 실행)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 로 `modules/` 하위 `.ts`(비-`.spec.ts`/`.d.ts`) 전체를 읽는다. 쓰기는 없고 읽기 전용이라 파괴적 부작용은 아니지만, ① 이 스캔이 `describe` 블록 로드 시점(모듈 최상위)에 동기적으로 실행되어 매 테스트 러너 기동마다 비용이 들고, ② 테스트의 통과 여부가 저장소의 물리적 디렉토리 구조(향후 `modules/` 하위에 `recordAudit` 라는 이름의 무관한 메서드가 생기면 자동으로 이 가드의 판정 대상에 편입)에 결합된다. 이는 형제 가드(`engine-error-code-anchor-guard.ts`)와 동일한 기존 패턴을 그대로 따른 것이라 신규 리스크는 아니다.
  - 제안: 조치 불필요 — 기존 컨벤션 준수. 단, 이런 전수 스캔형 가드가 늘어나면 unit 스테이지 부팅 비용이 누적될 수 있으므로 장기적으로는 모니터링 관점의 참고 사항.

- **[INFO]** 이번 changeset 이 이전 리뷰 라운드의 산출물(`review/code/2026/09/01/14_31_12/**`, `15_10_38/**` 등)을 신규 파일로 함께 커밋
  - 위치: `review/code/2026/09/01/14_31_12/*.md`, `*.json` 등 (git diff 상 `A` — 신규 추가)
  - 상세: 부작용 관점에서 실행되는 코드가 아니고(전부 markdown/json 산출물), 프로젝트 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 부합하는 의도된 보존이다. 실행 시 파일시스템/네트워크/전역상태에 영향 없음.
  - 제안: 조치 불필요.

## 요약

이번 changeset(감사 기록 실패 관측성 추가 + `auth_config` 감사 액션 타입 바인딩 + 정적 바인딩 가드 신설)에서 CRITICAL/WARNING 급 부작용은 발견되지 않았다. 유일한 실질적 시그니처 변경(`AuditLogsService` 생성자에 `@Optional()` 파라미터 추가)은 기존 호출부 2곳을 직접 확인해 하위호환이 실측으로 확인됐고, `BusinessMetricsService` 가 `@Global()` 모듈이라 DI 배선도 안전하다(순환 의존 없음). `record()` catch 안에 추가된 관측 호출은 자체 `try`/`catch` 로 완전히 격리돼 있어 "관측이 새 실패 경로가 되는" 부작용을 차단했고, 이는 전용 뮤테이션 테스트로 검증됐다. `auth-configs.service.ts` 의 타입 좁힘은 private 메서드의 컴파일 타임 전용 변경이라 런타임 부작용이 없다. 신규 정적 가드는 파일시스템을 읽기만 하며 저장소 구조에 결합되는 정도의 경미한 특성만 있다. 전반적으로 부작용 표면은 좁고, 잠재적 회귀 지점(DI 조립 실패·순환 의존·swallow 계약 역행)은 이미 코드 내 자체 방어(옵셔널 체이닝·이중 try/catch)와 테스트로 커버돼 있다.

## 위험도
LOW
