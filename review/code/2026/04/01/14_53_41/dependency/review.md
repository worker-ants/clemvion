### 발견사항

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 위치: 전체 변경사항 (`package.json` 미수정)
  - 상세: 모든 변경이 기존 의존성(`@nestjs/common`, `class-validator`, `axios`, `vitest`, `@testing-library/react`) 범위 내에서 이루어짐.
  - 제안: 해당 없음

- **[INFO]** `UnauthorizedException` — `@nestjs/common` 추가 활용
  - 위치: `auth.controller.ts:7`
  - 상세: 이미 `@nestjs/common`을 import 중인 파일에서 동일 패키지의 named export를 추가. 새 의존성 없음.
  - 제안: 해당 없음

- **[INFO]** `IsOptional` — `class-validator` 추가 활용
  - 위치: `refresh-token.dto.ts:1`
  - 상세: 기존 `IsString`과 함께 `IsOptional`을 추가 import. 새 의존성 없음. 단, 데코레이터 선언 순서(`@IsString()` → `@IsOptional()`)가 class-validator 관례와 역순임. 관례상 `@IsOptional()`이 먼저 선언되어야 값 부재 시 이후 검증자를 올바르게 건너뜀.
  - 제안: `@IsOptional()` → `@IsString()` 순서로 변경

- **[INFO]** `setSessionRestoreInProgress` — 내부 모듈 의존성 확장
  - 위치: `auth-provider.tsx:7`
  - 상세: `@/lib/api/client`에서 `setAccessToken`에 더해 `setSessionRestoreInProgress`를 추가 import. 단방향 의존 관계 유지. 프레젠테이션 레이어가 인프라 레이어 내부 상태 제어 함수를 직접 참조하는 레이어 경계 위반 소지는 architecture 관점 이슈이며, 의존성 관점에서는 cohesion 있는 변경으로 적절함.
  - 제안: 해당 없음 (레이어 분리는 별도 리팩토링 과제)

- **[INFO]** `doRefresh()` — `apiClient` 자기 참조 구조
  - 위치: `client.ts:43-50`
  - 상세: `doRefresh()`가 `apiClient.post("/auth/refresh", {})`를 호출하고, 이 호출이 response interceptor 내부에서 트리거됨. 이론적으로 `interceptor → doRefresh() → apiClient → interceptor` 재진입 경로가 존재하나, `!originalRequest.url?.includes("/auth/")` 가드로 `/auth/refresh` 요청은 interceptor 재진입이 방지되어 실질적 순환 없음.
  - 제안: 현재 구현으로 충분. 가드 조건이 향후 변경될 경우 순환 위험이 생기므로 해당 조건에 주석 추가 권장:
    ```ts
    // Guard against re-entry: /auth/ requests skip the refresh interceptor
    !originalRequest.url?.includes("/auth/")
    ```

- **[INFO]** 브라우저 Web API 의존성 (`sessionStorage`) 제거 확인
  - 위치: `client.ts` 전체
  - 상세: 이전 버전에서 추가되었던 `sessionStorage` 의존성이 현재 변경사항에서 완전히 제거됨. `client.ts`는 순수 메모리 변수(`let accessToken`)만 사용하므로 SSR 환경에서의 브라우저 Web API 의존성 없음.
  - 제안: 해당 없음

---

### 요약

이번 변경사항은 새로운 외부 패키지 의존성을 전혀 추가하지 않으며, 모든 변경이 기존 의존성(`@nestjs/common`, `class-validator`, `axios`)의 이미 사용 중인 export 범위 내에서 이루어졌다. 내부 모듈 간 의존 관계는 단방향으로 유지되고, 이전 버전에서 지적된 `sessionStorage` Web API 의존성도 제거되어 번들 크기, 라이선스, 버전 호환성, 취약점 관점에서 새로 도입된 위험 요소가 없다. 실질적 개선 사항은 `refresh-token.dto.ts`의 `@IsOptional()` / `@IsString()` 데코레이터 선언 순서로, class-validator 관례에 맞게 `@IsOptional()`을 먼저 선언하는 것이 권장된다.

### 위험도
**NONE**