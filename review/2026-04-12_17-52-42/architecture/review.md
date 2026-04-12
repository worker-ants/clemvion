### 발견사항

---

**[WARNING]** 컨트롤러 레이어에서 비즈니스 로직(권한 조회) 수행
- 위치: `integrations.controller.ts` — `create`, `rotate`, `requestScopes`, `updateScope` 엔드포인트
- 상세: `resolveRole`을 컨트롤러에서 직접 호출하여 결과를 서비스에 전달한다. 권한 해석은 서비스 내부의 비즈니스 규칙이며, 컨트롤러는 사용자 ID만 전달하면 충분하다. 현재 구조는 컨트롤러와 권한 모델 사이에 불필요한 결합을 만든다.
- 제안: `resolveRole` 호출을 각 서비스 메서드 내부로 이동하고, 컨트롤러는 `user.sub`만 전달

---

**[WARNING]** 모듈 경계 침범 — 타 모듈 엔티티 직접 주입
- 위치: `integrations.module.ts` — `TypeOrmModule.forFeature([Node, WorkspaceMember, Notification])`
- 상세: `Node`, `WorkspaceMember`, `Notification`은 각각 `NodesModule`, `WorkspacesModule`, `NotificationsModule`의 소유 엔티티다. 해당 엔티티를 직접 주입하면 모듈 경계가 무너지고, 각 모듈이 자체 리포지토리 구현을 교체할 때 파급 범위가 예측 불가해진다.
- 제안: `WorkspacesModule`처럼 관련 모듈을 `imports`에 추가하고 `WorkspacesService.getMemberRole()`처럼 공개된 서비스 인터페이스를 사용. `NotificationsService`를 통해 알림 생성

---

**[WARNING]** `IntegrationExpiryScannerService`가 `Notification` 엔티티를 직접 생성
- 위치: `integration-expiry-scanner.service.ts` — `run()` 메서드 내 `notificationRepository.create/save`
- 상세: 알림 생성 로직(채널, `isRead` 초기값, `resourceType` 등)이 스캐너 서비스에 하드코딩되어 있다. `NotificationsService`가 존재함에도 이를 우회하여 알림 비즈니스 로직이 두 곳에 분산될 위험이 있다.
- 제안: `NotificationsService.create(...)` 호출로 위임. 도메인 이벤트 패턴(`EventEmitter2`)을 사용하면 스캐너와 알림 시스템 간 결합도를 더 낮출 수 있다.

---

**[WARNING]** OAuth 토큰 교환이 스텁(stub) 구현으로 서비스 계층에 노출됨
- 위치: `integration-oauth.service.ts` — `handleCallback()` 내 `syntheticCredentials`
- 상세: 실제 provider HTTP 토큰 교환 없이 `stub-*` 토큰을 저장하는 구조다. 현재 코드는 스텁이지만, `IntegrationsService`, `IntegrationOAuthService`, DB 엔티티가 이 데이터 형태에 의존하고 있어 실제 구현으로 교체 시 연쇄 변경이 필요하다. 또한 `authorizeUrls` 맵이 서비스 내에 하드코딩되어 있어 신규 provider 추가 시 서비스 코드를 수정해야 한다.
- 제안: `authorizeUrls`를 `ServiceDefinition`(서비스 레지스트리)에 `authorizeUrl` 필드로 이동. 실제 토큰 교환은 provider별 전략 인터페이스(`OAuthTokenExchanger`)로 추상화하여 `ServiceRegistry`와 연동

---

**[WARNING]** `ActivityQueryDto`에서 숫자 파라미터를 문자열로 선언 후 컨트롤러에서 수동 변환
- 위치: `integration.dto.ts` — `ActivityQueryDto`; `integrations.controller.ts` — `activity()` 핸들러
- 상세: `limit`, `days`가 `string?`으로 선언되어 있어 컨트롤러에서 `Number()` 변환과 `Number.isFinite()` 검증을 직접 수행한다. DTO 레이어의 역할은 입력 데이터의 파싱과 유효성 검사까지 포함해야 한다.
- 제안: `@Type(() => Number)` (class-transformer) + `@IsInt()` + `@Min(1)` 데코레이터를 DTO에 적용하여 컨트롤러를 단순화

---

**[WARNING]** `renderCallbackHtml` 함수가 컨트롤러 파일 내에 위치 (프레젠테이션 관심사 혼재)
- 위치: `integrations.controller.ts` 하단 229~277행
- 상세: HTML 렌더링 함수는 컨트롤러의 라우팅 책임과 무관한 프레젠테이션 로직이다. 컨트롤러 파일이 HTTP 처리와 HTML 템플릿 두 가지 책임을 지게 된다.
- 제안: `oauth-callback.template.ts` 같은 별도 파일로 분리

---

**[WARNING]** React 렌더 단계에서 상태 변이 (anti-pattern)
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `syncedVariant` 패턴
- 상세: `if (variant !== syncedVariant) { setSyncedVariant(variant); setCredentials(...); }` 구문이 렌더 함수 본문에서 직접 상태를 변이시킨다. React 공식 문서에서 허용하는 "이전 렌더의 props/state를 기반으로 state 조정"과 유사하지만, 여러 `setState` 호출이 동시에 발생하면서 중간 렌더를 유발할 수 있다.
- 제안: `useEffect(() => { ... }, [variant])` 또는 `useMemo`로 파생 상태 계산으로 리팩터링

---

**[INFO]** `IntegrationOAuthService.purgeExpired()`가 매 `begin()` 호출마다 동기적으로 실행
- 위치: `integration-oauth.service.ts` — `begin()` 메서드
- 상세: 만료 레코드 정리가 OAuth 시작 요청 경로에 포함되어 있다. 대량 요청 시 불필요한 DB 부하 발생 가능. 현재는 `fire-and-forget` 주석이 있으나 실제로는 `await`로 호출됨.
- 제안: 주석대로 실제 fire-and-forget(`void this.purgeExpired()`)으로 변경하거나, 별도 스케줄러 큐로 분리

---

**[INFO]** `ServiceDefinition.scopes`가 선택적(`?`)이지 않음에도 빈 배열 방어 코드 필요
- 위치: `service-registry.ts` — `ServiceDefinition` 인터페이스; `new/page.tsx` — `service.scopes.filter(...)`
- 상세: `ServiceDefinition.scopes`는 인터페이스에서 `ScopeOption[]`(non-nullable)이나, `http`, `database`, `email` 서비스는 이 필드가 없다. 프론트엔드에서 `service.scopes.length`로 접근하면 런타임 오류 발생 가능.
- 제안: 인터페이스에서 `scopes?: ScopeOption[]`으로 변경하거나 레지스트리에서 모든 서비스에 빈 배열 기본값 명시

---

**[INFO]** `useCallback` 없이 `updateParam` 인라인 함수 — 의존성 배열 불안정
- 위치: `frontend/src/app/(main)/integrations/page.tsx` — `updateParam` 함수
- 상세: 현재 코드에서는 자식 컴포넌트에 전달되지 않아 성능 문제는 없으나, 향후 자식 컴포넌트에 prop으로 내려갈 경우 매 렌더마다 새 참조 생성.
- 제안: `useCallback`으로 감싸기

---

### 요약

전체적으로 서비스 레지스트리 패턴, DTO 계층 분리, BullMQ 기반 스캐너 설계 등 아키텍처의 큰 골격은 잘 잡혀 있다. 주요 위험 요소는 **모듈 경계 침범**(타 모듈 엔티티 직접 주입)과 **레이어 책임 혼재**(컨트롤러의 권한 해석, 컨트롤러 파일 내 HTML 렌더러, 스캐너의 직접 알림 생성)에 집중된다. OAuth 토큰 교환의 스텁 구현은 현재 단계에서 의도적이나, 교체 시 연쇄 변경 범위를 최소화할 수 있도록 `OAuthTokenExchanger` 인터페이스 추상화를 미리 도입하는 것이 권장된다. 프론트엔드에서는 렌더 단계의 상태 변이 패턴이 React 동시성 모드에서 예기치 않은 동작을 유발할 수 있어 조기 정리가 필요하다.

### 위험도

**MEDIUM**