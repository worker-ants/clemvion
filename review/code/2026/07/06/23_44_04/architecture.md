# 아키텍처(Architecture) Review

대상 delta: `656fc7cce..HEAD` (커밋 04386bdd4·512137812·fe5fe17c0·12495bfa0)

코드 변경 실체는 5개 파일(execution-engine.service.ts, execution-engine.service.spec.ts,
background-execution.processor.ts, sanitize-error-message.ts[신규], background-monitoring.e2e-spec.ts)
+ 3개 plan/review 문서. 이전 리뷰(21_23_13, 22_42_32) WARNING 반영분 위주로, 신규 아키텍처
관심사는 제한적이나 아래를 확인했다.

## 발견사항

- **[INFO]** 새니타이저 util 추출 — 응집도 개선, 다만 유사 명칭 util 이 동일 모듈에 이미 2종 존재
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규),
    비교 대상 `codebase/backend/src/shared/utils/sanitize-error-message.ts` (기존, `sanitizeLastErrorMessage`)
  - 상세: 이번 변경은 `background-execution.processor.ts` 에 로컬로 있던 `sanitizeErrorMessage`
    (stack trace·connection string 패턴 제거, 500자 캡)를 `execution-engine.service.ts` 와 공유하도록
    같은 모듈 루트로 끌어올렸다. 응집도 측면에서 올바른 방향 — "한쪽만 적용돼 방어 심도가 갈리는" 문제를
    실제로 해소한다. 다만 같은 백엔드 코드베이스에는 이미 `shared/utils/sanitize-error-message.ts` 가 있고
    `ai-turn-orchestrator.service.ts`(같은 execution-engine 모듈 내부!)와 `integration-oauth.service.ts` 가
    `sanitizeLastErrorMessage` 를 import 한다. 두 함수는 위협모델이 달라(신규: stack trace/connection
    string 제거 500자 캡, 기존: OAuth 토큰/secret 마스킹 200자 캡) 순수 중복은 아니지만, 이름이
    `sanitize-error-message.ts` / `sanitizeErrorMessage` vs `sanitizeLastErrorMessage` 로 매우 유사해
    같은 execution-engine 디렉터리 안에서 동명이인 모듈 파일이 병존하게 됐다. 향후 개발자가 실행 실패
    메시지 새니타이징이 필요할 때 두 util 중 무엇을 써야 하는지, 왜 둘로 나뉘었는지 식별하기 어렵다.
  - 제안: 파일 상단 JSDoc(이미 있음)에 "왜 `shared/utils/sanitize-error-message.ts` 와 다른가"를
    한 줄 교차 참조로 추가하거나, 장기적으로는 두 정규식 세트(secret 마스킹 + stack/connection-string
    제거)를 `shared/utils` 쪽에 옵션으로 합성해 단일 진입점으로 통합하는 것을 backlog 후보로 고려.
    지금 당장 차단할 사안은 아님(위협모델이 실제로 다르고 이번 변경 스코프가 아님).

- **[INFO]** DI 순환 그래프 + `@Optional` + `ModuleRef` 지연 해석 패턴의 재사용 — 선례 정합
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:682-713`
    (`getNotificationsService`), 비교 대상 `background-execution.processor.ts` 의 `getWebsocket()`
    (기존 패턴)
  - 상세: `ExecutionEngineService` 가 `AiTurnOrchestrator`/`FormInteractionService`/
    `ButtonInteractionService` 와 `forwardRef` 순환 그래프에 속해 `NotificationsModule` 보다 먼저
    인스턴스화될 수 있다는 근본 원인은 그대로 두고, `@Optional` 생성자 주입 실패를 런타임
    `ModuleRef(strict:false)` 지연 해석 + 캐시로 우회했다. 이는 이미 같은 파일군의
    `background-execution.processor.ts` 가 `WebsocketService` 에 쓰던 패턴과 동일해 코드베이스
    내부적으로는 일관적이다. 다만 근본 해법(이벤트 기반 디커플링으로 순환 자체를 제거)이 아니라
    우회이므로, 신규 `@Optional` 의존성이 이 서비스에 추가될 때마다 동일 undefined 함정이 반복될
    구조적 위험이 남는다 — 이는 plan(`notif-hardening-followups.md` §후속)에 아키텍처 부채로 이미
    명시적으로 기록되어 있어 이번 리뷰에서 추가로 지적할 것은 없다(추적 확인됨, 조치 불요).
  - 제안: (이미 followup 기록됨) `spec/5-system/4-execution-engine.md §4.4` 에 "forwardRef vs
    ModuleRef 지연해석 각 적용 기준"을 문서화하는 planner 후속 작업이 유효하며 그대로 유지 권장.

- **[INFO]** `getNotificationsService` 캐시 필드의 3-state(undefined/null/value) 인코딩
  - 위치: `execution-engine.service.ts:693, 700-713`
  - 상세: `resolvedNotificationsService?: NotificationsService | null` 필드가 "아직 시도 안 함"(undefined),
    "시도했으나 실패"(null), "해석 성공"(value) 세 상태를 하나의 optional 필드로 인코딩한다. 정확하지만
    타입 시그니처만으로는 상태 기계 의도가 드러나지 않아 가독성 비용이 있다. 유닛 테스트(4분기: 주입/
    지연해석/throw/캐시)가 이 상태 전이를 잘 커버하고 있어 회귀 위험은 낮다.
  - 제안: 우선순위 낮음. 필요 시 `'unresolved' | 'missing' | NotificationsService` 같은 명시적
    유니온으로 리팩터링해 상태 의도를 타입으로 드러낼 수 있으나, 현재 스코프에서는 과설계.

- **[INFO]** 테스트가 `as unknown as Svc` 로 private 필드에 직접 접근 — 화이트박스 결합
  - 위치: `execution-engine.service.spec.ts` 신규 `describe('getNotificationsService — ModuleRef 지연 해석 ...')`
  - 상세: private 필드(`notificationsService`, `moduleRef`, `resolvedNotificationsService`)를
    타입 단언으로 직접 조작해 검증한다. 캡슐화를 깨는 화이트박스 테스트지만, 이는 DI 컨테이너 없이
    순수 클래스 인스턴스로 도는 기존 스펙 스타일(파일 전체가 이미 이 패턴)과 일관되며, 4분기(주입 우선/
    지연해석/throw 시 안전 undefined/캐시)라는 내부 상태 기계를 다른 방법으로 검증하기 어렵다는 점에서
    합리적인 트레이드오프다. 문제 삼을 수준은 아님.

## 순환 의존/레이어 경계 확인
- `sanitize-error-message.ts` 는 외부 의존이 없는 순수 함수 모듈로, `execution-engine.service.ts`
  (top-level 실행 실패 경로)와 `queues/background-execution.processor.ts`(백그라운드 실행 실패 경로)
  양쪽에서 단방향으로 import 한다. 새 순환 의존은 발생하지 않았다.
- `execution-engine.service.spec.ts` / `background-monitoring.e2e-spec.ts` 변경은 테스트 레이어에
  국한되어 프로덕션 레이어 경계에 영향 없음.
- plan/review 문서(`notif-hardening-followups.md`, `spec-update-notifications-background-run-id.md`,
  RESOLUTION/SUMMARY.md)는 추적용 산출물이며 아키텍처 관점 코드 평가 대상 아님. 다만 plan 문서 내
  developer 의 SPEC-DRIFT reverse-flow(§2.1/§1.1/§2.19/Rationale/12-background 직접 반영)와 잔여
  planner 위임(§4.4 ModuleRef 문서화)이 명확히 구분되어 있어 역할 경계(SKILL 규약) 준수가 확인된다.

## 요약
이번 delta 는 순수 리팩터링/하드닝 성격으로 새로운 구조적 결함을 도입하지 않았다. 핵심 개선인
새니타이저 단일화(`sanitize-error-message.ts` 추출)는 "한쪽만 새니타이징되는" 방어 심도 불균형을
실제로 제거해 응집도를 높였고, 순환 의존이나 레이어 위반도 발생하지 않았다. 다만 같은
`execution-engine` 모듈 안에 이름이 거의 같은 새니타이저 유틸이 두 벌(`sanitize-error-message.ts`
vs `shared/utils/sanitize-error-message.ts`) 존재하게 되어 향후 개발자의 혼동 여지가 있다는 점,
그리고 DI 순환 인스턴스화 순서 문제를 `ModuleRef` 지연 해석으로 "해결"이 아닌 "우회"한 구조적 부채가
남아있다는 점은 이미 plan 트래커(`notif-hardening-followups.md`)에 followup 으로 정확히 포착되어
있어 별도 조치를 요구하지 않는다. 전반적으로 SOLID·레이어 분리·모듈 경계 관점에서 문제되는 지점은
없다.

## 위험도
NONE
