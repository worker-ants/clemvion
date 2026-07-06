# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 지연 해석(lazy DI resolution) 패턴을 기존 확립된 관례와 일관되게 재사용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:678-710` (`getNotificationsService`), 참조 대상 `codebase/backend/src/modules/notifications/notifications.service.ts:23-38` (`getWebsocket`)
  - 상세: `ExecutionEngineService` 가 forwardRef 순환 그래프상 `NotificationsModule` 보다 먼저 인스턴스화되어 생성자 `@Optional NotificationsService` 가 undefined 로 고정되는 문제를, `ModuleRef.get(NotificationsService, { strict: false })` 로 런타임 지연 해석 + 캐시하는 방식으로 해소했다. 이는 `NotificationsService` 자신이 `WebsocketService` 를 지연 해석하는 기존 패턴(`getWebsocket`)과 동일한 형태이며, `null` sentinel 로 "해석 시도했으나 실패"와 "아직 해석 안 함"을 구분하는 캐시 로직(`resolvedNotificationsService`)도 방어적이다. 새로운 추상화를 도입하지 않고 기존 관용구를 재사용한 점이 일관성 측면에서 긍정적.
  - 제안: 없음. 다만 동일 패턴이 이번까지 두 곳(`NotificationsService→WebsocketService`, `ExecutionEngineService→NotificationsService`)에 등장했으므로, 세 번째 사례가 생기면 `ModuleRef` 지연 해석용 공용 헬퍼(mixin 또는 base class)로 추출을 고려할 신호로 기록해 둘 만하다.

- **[WARNING]** DI 순환/인스턴스화 순서 문제를 구조적으로 해소하지 않고 서비스 레이어에서 우회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:678-710`
  - 상세: 근본 원인은 `ExecutionEngineService` 가 속한 forwardRef 순환 그래프(WebsocketModule 등)가 `NotificationsModule` 보다 먼저 인스턴스화되어 생성자 `@Optional` 주입이 항상 실패하는 모듈 조립(composition) 레벨 결함이다. 이번 수정은 이 문제를 모듈 그래프 재설계(예: `NotificationsModule` 을 순환 그래프 밖으로 분리하거나 인스턴스화 순서를 제어)로 풀지 않고, 개별 서비스가 `ModuleRef` 로 우회하는 방식을 택했다. 같은 근본 원인(순환 그래프의 선행 인스턴스화)을 가진 향후 신규 의존성(예: 다른 optional 서비스)도 동일 버그를 반복할 잠재적 함정으로 남는다 — 이번처럼 e2e 가 우연히 적발하지 않으면 조용히 no-op 되는 실패 모드다.
  - 제안: 단기적으로는 현재 fix 가 실용적이나, `notif-hardening-followups.md` 류 트래커에 "ExecutionEngineService constructor 의 향후 신규 @Optional 의존성은 동일 순환 인스턴스화 함정에 노출됨"을 아키텍처 부채로 명시해 두거나, 장기적으로 순환 그래프 자체를 줄이는 리팩터링(예: 이벤트/emitter 기반 디커플링으로 알림 발사를 서비스 직접 호출에서 분리)을 검토 대상으로 남길 것.

- **[INFO]** 종결 경로(초기 세그먼트 vs 재개 세그먼트) 간 알림 발사 로직 중복 없이 공용 헬퍼로 통합
  - 위치: `execution-engine.service.ts:2507` (`finalizeResumedExecutionOutcome`), `execution-engine.service.ts:4438` 부근 (초기 세그먼트 catch)
  - 상세: 버그 A 수정이 재개 세그먼트 종결 핸들러에 로직을 복제하지 않고 기존 `dispatchExecutionFailedNotification` private 헬퍼를 그대로 재호출하는 방식으로 이루어졌다. 두 종결 경로(초기/재개)가 동일한 알림 발사 책임을 공유하는 구조가 유지되어 DRY 원칙에 부합하며, 향후 세 번째 종결 경로가 추가되더라도 동일 헬�러 재사용으로 일관성을 보장하기 쉽다.
  - 제안: 없음.

- **[INFO]** 엔티티 레벨 방어(`select: false`)로 프레젠테이션 계층 누출을 인프라적으로 강제
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:264-271`
  - 상세: 이전 리뷰(SUMMARY 21_23_13 #1)에서 지적된 "REST 미노출 의도가 주석에만 있고 실제 직렬화 계층이 없어 노출 가능"이라는 문서-구현 괴리를, DTO 매핑 계층을 신설하는 대신 TypeORM `@Column({ select: false })` 로 엔티티 레벨에서 원천 차단했다. 이는 "컨트롤러/DTO 가 실수로 필드를 빠뜨리지 않는 한 안전"이라는 취약한 계약 대신, 데이터 소스 계층에서 기본 SELECT 자체를 배제해 상위 계층(서비스/컨트롤러) 구현 실수에 대한 방어를 한 단계 낮은 레이어로 이동시킨 결정으로, 레이어 책임 분리 관점에서 합리적인 절충이다(속성 소비가 필요한 `findByBackgroundRun` 은 WHERE 절만 사용하므로 `select: false` 와 무관하게 정상 동작).
  - 제안: 없음. 다만 이 패턴(`select: false` 로 내부 전용 컬럼 방어)이 반복될 컬럼이 늘어나면, 엔티티 주석에 산발적으로 남기기보다 "REST 비노출 컬럼" 컨벤션 문서화를 `spec/conventions/` 에 남기는 것을 고려.

- **[INFO]** 순환 의존 신규 도입 없음 — 기존 forwardRef 그래프에 `ModuleRef` 를 얹은 것으로 국한
  - 위치: `execution-engine.service.ts:669` (`@Inject(forwardRef(...))` 기존 3곳 불변), `execution-engine.service.ts:685-686` (신규 `@Optional() moduleRef`)
  - 상세: `ModuleRef` 는 Nest 전역 유틸리티로서 특정 모듈에 대한 명시적 의존을 선언하지 않으므로, 이번 변경이 모듈 그래프에 새로운 엣지(edge)를 추가하지는 않는다. 기존 forwardRef 3곳(AiTurnOrchestrator, FormInteractionService, ButtonInteractionService)도 그대로 유지된다.
  - 제안: 없음.

## 요약

이번 변경은 두 개의 선존 결함(재개 세그먼트 종결 시 알림 dispatch 누락, 순환 DI 인스턴스화 순서로 인한 `@Optional` 주입 실패)을 각각 "기존 헬퍼 재사용"과 "이미 확립된 지연 해석 관용구 재적용"으로 해소해, 새로운 아키텍처 패턴을 도입하지 않으면서 일관성을 지켰다. 특히 `ModuleRef` 지연 해석은 `NotificationsService→WebsocketService` 에서 이미 검증된 패턴을 그대로 재사용한 점이 바람직하다. 다만 이 fix 자체는 순환 DI 그래프의 인스턴스화 순서 문제라는 근본 원인을 해소한 것이 아니라 서비스 레벨에서 증상을 우회한 것이므로, 향후 `ExecutionEngineService` 에 추가되는 신규 optional 의존성이 동일한 실패 모드(조용한 no-op)를 재현할 잠재적 아키텍처 부채로 남는다는 점은 주지할 필요가 있다. `select: false` 를 통한 엔티티 레벨 노출 차단은 이전 리뷰의 documentation-implementation 괴리를 레이어 경계에 맞게 근본적으로 해소한 개선이다. 전체적으로 SOLID·결합도/응집도·모듈 경계 관점에서 이번 diff 자체는 건전하다.

## 위험도

LOW
