# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO, 설계 긍정]** `AuditActionFor<T>` + `_NoCrossDomain` 캐너리 + AST fitness-function 가드(`audit-action-binding-guard.ts`) 3중 방어 구조는 OCP 를 지키며 "리소스 바인딩" 불변식을 회귀 없이 강제한다. 이전 라운드(16_29_11 architecture.md)가 지적한 "엉뚱한 리소스에 묶인 action은 못 잡는다"는 갭이 `findMisboundHelpers` 로 이미 닫혀 있음을 직접 소스를 열어 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`findMisboundHelpers`, `normalizeResource`), `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts` (`WRONG_RESOURCE_BOUND_SOURCE`/`MATCHED_RESOURCE_SOURCE`/`MIXED_NOTATION_SOURCE`)
  - 상세: `findUnboundHelpers`(접두 검사, "묶였는가")와 `findMisboundHelpers`(값 비교, "자기 리소스에 묶였는가")가 분리된 두 술어로 구현돼 있고, 후자는 `typeof X` / `'literal'` / 로컬 상수 세 표기를 `normalizeResource`로 정규화한 뒤 비교한다 — 표기만 다르고 값이 같은 경우(`MIXED_NOTATION_SOURCE`)의 거짓 양성과, 실제로 다른 리소스에 묶인 경우(`WRONG_RESOURCE_BOUND_SOURCE`)의 거짓 음성을 fixture 로 모두 고정해 뒀다. `git log`로 확인한 결과 이 함수는 3라운드(`86bd4bd90`)에 추가되고 5라운드(`4b15f0393`)에 근거 문구가 재검증됐다 — 현재 HEAD가 그 최종 상태다.
  - 제안: 없음(추가 조치 불필요, 확인 목적 기록).

- **[INFO]** 5개 리소스 도메인(`workflows`/`triggers`/`schedules`/`model-config`/`auth-configs`)의 `recordAudit` 파사드가 전부 `AuditActionFor<typeof X_RESOURCE_TYPE>` 형태로 통일됐다 — 이번 diff 전에는 `auth-configs` 만 맨 `AuditAction` union이라 리스코프 치환(형제 helper와 같은 계약을 전제로 호출하는 코드가 이 한 곳에서만 깨질 수 있는 상태)이 어긋나 있었는데, 이제 5곳 모두 같은 구조적 계약을 따른다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (`recordAudit`), 대조: `codebase/backend/src/modules/{workflows,triggers,schedules,model-config}/*.service.ts` 의 동일 이름 helper
  - 제안: 없음.

- **[INFO]** `AuditLogsService` → `BusinessMetricsService` 의존은 순환 없이 단방향이며 레이어 경계가 명확하다. `MetricsModule`이 `@Global()`(`metrics.module.ts`)이고 `AuditLogsModule`은 이를 참조하지 않으며, `@Optional()` 주입이라 metrics 모듈 부재(테스트 조립 포함) 시에도 `record()`의 핵심 책임(영속화 + swallow 계약)이 깨지지 않는다. 같은 패턴이 `idempotency.interceptor.ts`(`@Optional() private readonly metrics?: BusinessMetricsService`)에 선례로 이미 있어 신규 관용구가 아니다. `catch` 블록 안에서 metrics 호출을 별도 `try`/`catch`로 한 번 더 감싼 것도 "관측 실패가 swallow 계약의 새 실패 경로가 되면 안 된다"는 chokepoint 특성에 맞는 올바른 방어적 계층화다(단일 catch에 여러 책임을 욱여넣은 것이 아니라, 책임별로 실패 격리 경계를 하나씩 둔 것).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:1,8,19,109-113`, `codebase/backend/src/modules/audit-logs/audit-logs.module.ts`, `codebase/backend/src/modules/metrics/metrics.module.ts`
  - 제안: 없음.

- **[INFO]** `PROMETHEUS_LABEL_MAX_LEN` + `clampLabel()` 추출은 정당한 DRY 리팩터다 — 종전에 `64`가 `recordExecutionError`/`recordAuditWriteFailed` 두 메서드에 매직넘버로 중복돼 있었고(값 자체가 cardinality 방어 계약), 한쪽만 바뀌면 두 메트릭의 방어 강도가 조용히 갈릴 수 있었던 결합도 문제를 단일 상수·단일 함수로 해소했다. 현재 저장소 전체에서 `substring(0, 64)` 형태의 잔존 중복이 없음을 grep으로 확인했다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:55-60,133,184`
  - 제안: 없음.

- **[INFO]** 팩토리 추출 대신 AST 가드를 택한 설계 판단(`CHANGELOG.md`)은 과잉 추상화를 피한 적절한 선택이다. 5개 `recordAudit` helper의 `details` 계약(필드 유무·모양)이 서로 다르다는 사실을 실제로 5곳 다 읽어 확인한 뒤, 억지로 공통 시그니처를 뽑는 대신 "공통분모(리소스 바인딩)가 지켜지는지"만 정적으로 검사하는 방향으로 갔다 — 팩토리 추출이었다면 그 팩토리를 쓰는 곳만 안전해지고 향후 신설 서비스는 그물 밖이었을 것이나, 가드는 `MODULES_DIR` 전체를 스캔하므로 확장성(향후 신설 리소스) 관점에서 더 넓게 유효하다.
  - 위치: `CHANGELOG.md:63-81`, `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:1-30`
  - 제안: 없음.

- **[INFO, 확장성 관점 — 낮은 우선순위]** 가드의 helper 인식은 **메서드/필드 이름이 정확히 `recordAudit`인지**로만 판정한다(`AUDIT_HELPER_NAMES = new Set(['recordAudit'])`). 향후 새 리소스 도메인이 관례를 따르지 않고 다른 이름(예: `logAudit`, `auditRecord`)으로 helper를 만들면 이 가드는 그 존재 자체를 인지하지 못해 조용히 "위반 0건"이 된다 — 이는 코드 주석(`audit-action-binding-guard.ts:16-19`)이 이미 명시적으로 인지하고 받아들인 트레이드오프이고("이름을 상수로 두는 이유: 오탈자가 조용히 0건을 만들면...spec이 이 상수로 최소 개수를 함께 단언"), `sites.length >= 5` 전제 테스트가 오탈자 회귀는 잡아 준다. 다만 "새 이름의 신규 helper"까지는 그 전제 테스트도 못 잡는다(개수가 그대로 5+α여도 이름이 다르면 안 잡힘). 값이 아니라 호출부 형태(`this.auditLogsService.record(...)`를 감싸는 private 메서드)로 판정을 넓히는 것도 대안이 될 수 있으나, 현재의 명명 규약 기반 방식도 이미 문서화된 의도적 설계이므로 우선순위는 낮다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:16-21`
  - 제안: 조치 불필요(설계상 인지된 트레이드오프). 향후 새 리소스 도메인 추가 시 리뷰어 체크리스트에 "가드가 이 helper를 실제로 카운트했는가"를 한 줄 추가하는 정도로 충분.

## 요약

핵심 변경 두 갈래 — (1) 감사 적재 실패를 OTel 카운터 + 상세 로그로 관측 가능하게 한 것, (2) `auth-configs`의 `recordAudit` 타입 바인딩 구멍을 `AuditActionFor<T>` + AST 가드로 봉합한 것 — 은 이미 5차례 이상의 리뷰 라운드를 거치며 레이어 분리·결합도·순환 의존·OCP·LSP 관점에서 견고한 상태에 도달해 있다. 이번 라운드에서 소스를 직접 열어 재확인한 결과, 직전 라운드(16_29_11)가 지적한 "엉뚱한 리소스 오귀속을 못 잡는다"는 갭은 `findMisboundHelpers` 추가로 이미 닫혔고, `git log`로 그 수정 이력(3R→5R)까지 대조했다. `AuditLogsService`↔`BusinessMetricsService` 의존은 `@Global` 모듈 + `@Optional` 주입으로 순환 없이 단방향이며 기존 `idempotency.interceptor.ts` 관례를 그대로 따른다. `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 추출은 흩어져 있던 방어 계약을 단일화한 정당한 DRY이며, 팩토리 추출 대신 가드를 택한 설계 판단도 5개 helper의 `details` 계약 차이라는 실측에 근거해 과잉 추상화를 피했다. 새로 발견한 것은 가드의 이름 기반 helper 인식이라는, 이미 코드 주석이 명시적으로 인지·수용한 낮은 우선순위의 확장성 트레이드오프 하나뿐이다. 뮤테이션·저장소 파일 변경은 수행하지 않았다(읽기 전용 검증만 진행).

## 위험도
NONE
