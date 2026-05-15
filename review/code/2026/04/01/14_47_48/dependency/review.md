### 발견사항

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 위치: 전체 변경사항 (`package.json` 미수정)
  - 상세: 모든 변경이 기존 의존성 범위 내에서 이루어짐. `@nestjs/common`의 `UnauthorizedException`, `class-validator`의 `IsOptional` 모두 이미 사용 중인 패키지의 추가 export 활용.
  - 제안: 해당 없음

- **[INFO]** `setSessionRestoreInProgress` — 내부 모듈 의존성 확장
  - 위치: `auth-provider.tsx:7`
  - 상세: `@/lib/api/client`에서 `setAccessToken`에 더해 `setSessionRestoreInProgress`를 추가 import. 단방향 의존 관계 유지. 단, 프레젠테이션 레이어(`AuthProvider`)가 API 인프라 레이어(`client.ts`)의 내부 상태 제어 함수를 직접 참조하는 레이어 경계 위반 소지가 있음 (architecture 리뷰에서도 동일하게 지적됨).
  - 제안: 현재 규모에서는 허용 가능. 향후 `sessionService` 추상화 레이어로 분리 시 이 의존성도 제거 가능.

- **[INFO]** `doRefresh()` — `apiClient` 자기 참조 구조
  - 위치: `client.ts:43-50`
  - 상세: `doRefresh()`가 `apiClient.post("/auth/refresh", {})`를 호출하고, 이 호출이 response interceptor 내부에서 사용되어 `interceptor → doRefresh() → apiClient → interceptor` 경로가 이론적으로 존재. 단, `!originalRequest.url?.includes("/auth/")` 가드로 재진입이 방지되어 실질적 순환은 없음.
  - 제안: 현재 구현으로 충분. 가드 조건 변경 시 순환 위험이 생기므로 해당 조건에 주석으로 의도 명시 권장.

- **[INFO]** `IsOptional` 데코레이터 순서
  - 위치: `refresh-token.dto.ts:3-4`
  - 상세: `@IsString()`이 `@IsOptional()` 위에 선언됨. class-validator 관례상 `@IsOptional()`이 상단에 위치해야 값 부재 시 하위 검증자를 올바르게 건너뜀. 현재 `class-validator` 버전에서는 대부분 정상 동작하나 라이브러리 버전에 따라 동작이 달라질 수 있음.
  - 제안: `@IsOptional()` → `@IsString()` 순서로 변경.

---

### 요약

이번 변경사항은 새로운 외부 패키지 의존성을 전혀 추가하지 않으며, 번들 크기·라이선스·취약점·버전 충돌 관점에서 새로 도입된 위험 요소가 없다. 내부 모듈 간 의존 관계는 단방향으로 유지되고, `doRefresh()`와 interceptor 간의 자기 참조 구조는 URL 가드로 안전하게 처리되어 있다. 유일한 실질적 개선 사항은 `RefreshTokenDto`의 데코레이터 선언 순서(`@IsString`이 `@IsOptional` 앞에 위치)로, class-validator 관례에 맞게 순서를 바꾸는 것이 권장된다.

### 위험도
**NONE**