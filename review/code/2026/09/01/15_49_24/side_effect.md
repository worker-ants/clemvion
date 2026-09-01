# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `AuditLogsService` 생성자 시그니처 변경 — 하위 호환 실측 확인됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (constructor, `@Optional() private readonly metrics?: BusinessMetricsService` 추가)
  - 상세: 기존 유일한 파라미터(`auditLogRepository`) 뒤에 `@Optional()` + `?:`로 추가되어 하위 호환이다. `new AuditLogsService(` 전수 검색 결과 직접 인스턴스화하는 곳은 `audit-logs.spec.ts`·`executions-rerun.service.spec.ts` 두 테스트 파일뿐이며 전부 metrics 생략 또는 명시 전달 형태로 대응돼 있다. DI 경로는 `MetricsModule`이 `@Global()`이고 `app.module.ts`에 등록돼 있어(직접 확인) `AuditLogsModule`이 별도 import 없이도 주입받는다.
  - 제안: 없음 — 확인 목적.

- **[INFO]** `AuthConfigsService.recordAudit`의 `action` 파라미터 타입 좁힘(`AuditAction` → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`) — `private` 메서드라 외부 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (`private recordAudit`, 5개 내부 호출부 — `create/update/regenerate/remove/reveal`)
  - 상세: `grep`으로 확인한 결과 `recordAudit`는 이 클래스 내부 5곳에서만 호출되며 전부 `AUDIT_ACTIONS.AUTH_CONFIG_*`만 전달한다. 외부 참조·export 없음. 컴파일 타임 전용 변경으로 런타임 동작 변화 없음.
  - 제안: 없음.

- **[INFO]** catch 블록 안 관측 호출(`metrics?.recordAuditWriteFailed`)이 자체 `try`/`catch`로 보호돼 있음 — 이전 라운드에서 지적된 "관측이 새 실패 경로가 된다" WARNING 이 최종 diff에서 해소됨을 실측 확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`record()` catch 블록 내부, 이중 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`)
  - 상세: swallow 계약의 단일 chokepoint(`AuditLogsService.record()`)에서, 관측 호출이 던지더라도 그 예외가 12개+ 특권 CRUD producer로 전파되지 않도록 자체 방어돼 있다. `audit-logs.spec.ts`의 `'metrics 호출이 던져도 삼킨다 — 관측이 새 실패 경로가 되면 안 된다'` 테스트가 `recordAuditWriteFailed`가 throw 하는 mock을 넣고도 `record()`가 resolve 함을 직접 단언한다. RESOLUTION.md 기록상 뮤테이션(해당 try 제거)이 RED 를 낸다는 축도 확보돼 있다.
  - 제안: 없음 — 이미 해소됨. 다만 동일 패턴(`this.metrics?.recordRedisFailOpen(...)`)이 무방비로 남아 있는 `idempotency.interceptor.ts`는 이번 diff 범위 밖이며, 별도 chokepoint(캐시 fail-open 강등)라 파급 반경이 이 PR 이 다루는 특권 CRUD 만큼 넓지 않다.

- **[INFO]** 신규 정적 가드 3파일(`audit-action-binding-guard.ts`/`-fixture.ts`/`.spec.ts`)은 파일시스템 읽기 전용 — 쓰기·삭제 없음, 스캔 범위는 `codebase/backend/src/modules`로 유계
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:38-57` (`collectSourceFiles`)
  - 상세: `fs.readdirSync`/`fs.readFileSync`만 사용하며 `fs.writeFileSync`/`unlink`/`mkdir` 등 쓰기 계열 API 호출은 없다(직접 grep 확인). `REPO_ROOT = path.resolve(__dirname, '../../../../..')` 산출을 수동 검산(`__tests__ → repo-guards → src → backend → codebase → repo-root`, 5단계)해 저장소 루트로 정확히 귀결됨을 재확인했다. 매 jest 실행마다 `codebase/backend/src/modules` 전체를 재귀 스캔하지만, 이는 기존 자매 가드(`engine-error-code-anchor-guard.ts`)와 동일한 기존 패턴이며 스캔 범위 밖으로의 이탈은 없다.
  - 제안: 없음.

- **[INFO]** 신규 OTel Counter(`clemvion.audit.write_failed`) 도입은 새로운 종류의 네트워크 부작용이 아니라 기존 계측 파이프라인의 확장이다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:106-110`(생성), `:180-182`(`recordAuditWriteFailed`)
  - 상세: `OTEL_ENABLED=true`인 환경에서 MeterProvider가 활성화되면 이 카운터도 기존 5개(`clemvion.execution.*` 등)와 동일한 경로로 OTel exporter를 거쳐 외부(Prometheus/Collector)로 전송된다. `OTEL_ENABLED` 미설정 시 no-op meter가 반환된다는 클래스 JSDoc(`business-metrics.service.ts:66-68`)은 이번 diff로 변경되지 않았다 — 즉 비활성 환경에서는 이 신규 counter 도 안전한 무동작이다.
  - 제안: 없음 — 기존 패턴과 동일한 확장.

- **[INFO]** `resourceType` 라벨은 여전히 컴파일 타임에 닫히지 않은 `string`이며 런타임 `substring(0, 64)` 클램핑에만 의존한다 — 이전 라운드에서 이미 지적·수용된 트레이드오프의 재확인
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:180-182`, `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`record()` 시그니처의 `resourceType: string`)
  - 상세: 실측 12종 producer만 현재 존재하지만(코드 주석의 "실측 12종" 주장 자체는 유지), `record()` 시그니처가 열려 있어 향후 새 producer가 검증되지 않은 값을 `resourceType`으로 넘기면 라벨 cardinality가 늘 수 있다. 새로운 결함은 아니며, 클래스 JSDoc이 "닫힌 유니온이 아니라 클램핑을 쓰는 이유"를 명시적으로 설명하고 있다.
  - 제안: 없음(이미 문서화·수용된 트레이드오프, 확인 목적).

- **[INFO]** 저장소 트리에 이번 리뷰 세션 산출물 외 예기치 않은 뮤테이션 없음
  - 위치: `git status --short` (본 리뷰 시점 기준 `review/code/2026/09/01/15_49_24/` 1건만 untracked)
  - 상세/제안: 문제 없음, 확인 목적. 병렬 리뷰어에 의한 오염이나 잔여 뮤테이션은 관측되지 않았다.

## 요약

이번 changeset(감사 로깅 관측성 강화 + `auth_config` 액션 타입 바인딩 좁힘 + 정적 가드 신설)에서 실질적인 부작용 위험은 이미 앞선 라운드에서 식별·수정됐음을 이번 라운드에서 직접 소스를 열어 재확인했다. 유일하게 우려됐던 신규 실패 경로 — swallow 계약의 단일 chokepoint(`AuditLogsService.record()`) catch 블록 안 무방비 metrics 호출 — 는 현재 코드에 이중 `try`/`catch`로 닫혀 있고, 전용 테스트와 뮤테이션 검증(RESOLUTION.md 기록)으로 회귀가 고정돼 있다. 생성자·메서드 시그니처 변경(`AuditLogsService` constructor, `AuthConfigsService.recordAudit`)은 모두 `@Optional()`/`private` 범위라 기존 호출자에게 영향이 없음을 grep·DI 등록(`@Global() MetricsModule`이 `app.module.ts`에 등록됨)으로 실측 확인했다. 신규 정적 가드 3파일은 `codebase/backend/src/modules`로 유계된 읽기 전용 스캔이며 파일 쓰기·삭제·환경변수 접근이 없다. 신규 OTel 카운터는 기존 계측 파이프라인의 정상적 확장이고, `resourceType` 열린-string 라벨은 이미 문서화되고 수용된 트레이드오프다. 저장소 트리에는 이번 리뷰 세션 산출물 외 예기치 않은 뮤테이션이 없다. 남은 항목은 전부 이미 완화됐거나 의도적으로 수용된 저위험 관찰 사항(INFO)이다.

## 위험도

LOW
