### 발견사항

---

**[WARNING] `integrations.controller.ts`: `resolveRole` 반복 호출 중복**
- 위치: `create`, `rotate`, `requestScopes`, `updateScope` 핸들러 (각각 별도 호출)
- 상세: 4개의 컨트롤러 메서드가 동일한 `resolveRole(workspaceId, user.sub)` 패턴을 반복. 컨트롤러 레이어에서 공통 선처리로 추출하거나 NestJS Guard/Interceptor로 처리해야 함.
- 제안: `@UseGuards(WorkspaceRoleGuard)` + `@CurrentRole()` 데코레이터 패턴으로 중앙화. 또는 서비스 메서드 내부로 이동.

---

**[WARNING] `integrations.controller.ts`: `renderCallbackHtml` 함수가 컨트롤러 파일에 위치**
- 위치: 파일 하단 `renderCallbackHtml` 함수
- 상세: HTML 렌더링 로직이 컨트롤러와 같은 파일에 혼재. 관심사 분리 원칙 위반이며 테스트가 불가능.
- 제안: `oauth-callback.html.ts` 또는 `templates/` 디렉터리로 분리.

---

**[WARNING] `integration-oauth.service.ts`: `authorizeUrls` 매직 맵이 하드코딩**
- 위치: `begin()` 메서드 내부 `authorizeUrls` 객체
- 상세: `slack`, `google`, `github`의 OAuth 엔드포인트 URL이 서비스 함수 내에 인라인으로 하드코딩됨. `service-registry.ts`에 `ServiceDefinition`이 이미 있으므로 `authorizeUrl` 필드로 이동해야 함.
- 제안: `ServiceDefinition`에 `authorizeUrl?: string` 추가, 레지스트리에 정의.

---

**[WARNING] `integration-oauth.service.ts`: 토큰 교환 로직이 stub으로 처리되고 주석으로만 표시**
- 위치: `handleCallback()` 내 `syntheticCredentials` 블록
- 상세: "Phase C: token exchange is stubbed" 주석과 함께 가짜 토큰을 생성하는 코드가 프로덕션 파일에 잔존. 추후 실제 구현 시 누락될 위험이 높음.
- 제안: `TODO(phase-c)` 트래킹 이슈를 생성하고, stub임을 명시적으로 `throw`나 `NotImplementedException`으로 처리하거나, 적어도 `FIXME` 형태로 경고 수준을 높일 것.

---

**[WARNING] `ActivityQueryDto`: 숫자 파라미터를 문자열로 받아 컨트롤러에서 변환**
- 위치: `dto/integration.dto.ts` `ActivityQueryDto`, `integrations.controller.ts` `activity()` 메서드
- 상세: `limit`, `days`를 `string`으로 선언하고 컨트롤러에서 `Number()` + `Number.isFinite()` 검증을 직접 수행. `@Type(() => Number)` + `@IsInt()` + `@Min(1)` 을 DTO에서 처리해야 함.
- 제안:
  ```ts
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
  ```

---

**[INFO] `integration-expiry-scanner.service.ts`: `run()` 메서드 내 알림 생성 루프가 순차 실행**
- 위치: `run()` 메서드, `for...of` + `await save` 패턴
- 상세: 여러 수신자에게 알림을 하나씩 순차 저장. 통합 수가 많을 경우 성능 병목. 현재 구조에서 유지보수성 문제는 아니지만 의도가 불분명.
- 제안: `Promise.all(recipients.map(...))` 또는 bulk insert 사용.

---

**[INFO] `integrations.service.spec.ts`: `makeQueryBuilder` 헬퍼가 모든 메서드를 항상 노출**
- 위치: `makeQueryBuilder` 함수
- 상세: 15개 이상의 메서드를 항상 포함하는 단일 팩토리. 테스트가 어떤 메서드를 실제로 사용하는지 파악하기 어려움. 부분적으로 좋은 패턴이나 `select`, `addSelect`, `groupBy` 등 사용되지 않는 메서드가 혼재해 노이즈가 큼.
- 제안: 허용 범위 내이나, 실제 사용 메서드만 포함하는 오버로드 버전 추가 검토.

---

**[INFO] `service-registry.ts`: `HTTP_COMMON` 상수가 `api_key`, `bearer_token`, `basic` 세 변형에 스프레드됨**
- 위치: `SERVICE_REGISTRY`, `http` 서비스 정의
- 상세: 공유 필드 추출은 좋은 패턴이나, 현재 `base_url` 하나만 포함해 과도한 추상화처럼 보임. 향후 공통 필드가 추가되면 타당해지므로 낮은 우선순위.
- 제안: 현 상태 유지 허용, 단 주석으로 의도 표시.

---

**[INFO] `frontend/integrations/page.tsx`: `updateParam` 함수가 URL 상태를 직접 조작**
- 위치: `updateParam` 함수
- 상세: 유사한 패턴이 여러 필터 파라미터에 반복 적용됨. 컴포넌트가 커질 경우 관리 복잡도 증가. 현재 규모에서는 허용 가능.
- 제안: `useFilterParams` 커스텀 훅으로 추출 검토.

---

### 요약

전체적으로 통합(Integration) 모듈은 명확한 책임 분리, 강한 타입, 잘 구조화된 서비스 레지스트리, 충분한 테스트 커버리지를 갖추고 있어 유지보수성이 양호하다. 주요 개선 포인트는 두 가지다: (1) 컨트롤러에서 `resolveRole` 반복 호출을 가드/인터셉터로 중앙화, (2) OAuth stub 코드가 프로덕션 파일에 잔존하여 실제 구현 시 누락될 위험이 있는 점. `renderCallbackHtml`의 컨트롤러 혼재, `ActivityQueryDto`의 수동 숫자 변환도 정리가 필요하다. 포맷 전용 변경(줄바꿈 정규화)은 리뷰 노이즈를 줄이기 위해 자동화 도구 도입을 권장한다.

---

### 위험도

**MEDIUM**