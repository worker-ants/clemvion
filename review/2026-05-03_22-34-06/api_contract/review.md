### 발견사항

- **[INFO]** 쓰기 엔드포인트에 403 응답 추가 — 의도적 Breaking Change
  - 위치: `auth-configs.controller.ts` (POST, PATCH, POST `:id/regenerate`, DELETE), `folders.controller.ts` (POST, PATCH, DELETE)
  - 상세: `@Roles('editor')` 적용 전에는 인증된 Viewer도 해당 엔드포인트를 호출할 수 있었지만, 이후에는 403을 받는다. 이는 의도적 RBAC 강화이고 `@ApiForbiddenResponse`로 Swagger 문서도 동시에 갱신되어 있다.
  - 제안: 기존 클라이언트(외부 통합 등)가 Viewer 토큰으로 쓰기 요청을 보내고 있다면 403으로 전환되므로, 배포 전 클라이언트 사이드 영향 범위 확인 권장.

- **[INFO]** 읽기 엔드포인트는 `@Roles` 미적용으로 하위 호환 유지
  - 위치: `auth-configs.controller.ts` (GET `/`, GET `/:id`, GET `/:id/usage`), `folders.controller.ts` (GET `/`, GET `/:id`)
  - 상세: `@UseGuards(RolesGuard)`가 컨트롤러 레벨에 붙어 있지만 `@Roles()` 메타데이터가 없는 핸들러는 가드를 통과한다. 테스트 스펙(`auth-configs.controller.spec.ts`, `folders.controller.spec.ts`)이 `reflector.get(...) === undefined`로 이를 명시적으로 검증하고 있어 계약이 유지됨을 확인할 수 있다.

- **[INFO]** HTTP 상태 코드 구분 일관성 확인
  - 위치: 두 컨트롤러 전체
  - 상세: 인증 실패(401)와 권한 부족(403)이 `@ApiUnauthorizedResponse` / `@ApiForbiddenResponse`로 명확히 분리되어 REST 관례에 부합한다.

- **[INFO]** `execution-engine.service.ts` 타입 캐스트 제거는 내부 변경, API 계약 무관
  - 위치: `execution-engine.service.ts:1514`
  - 상세: `structured?.config`에서 불필요한 `as Record<string, unknown> | undefined` 캐스트를 제거한 것으로, 외부 API 응답 형식에는 영향 없음.

---

### 요약

이번 변경은 `auth-configs`와 `folders` 두 컨트롤러에 `@Roles('editor')` + `RolesGuard`를 추가하는 RBAC 강화다. 쓰기 엔드포인트에 403 응답이 새로 추가되므로 Viewer 권한으로 호출하던 클라이언트에 대해서는 의도적 Breaking Change이지만, 읽기 엔드포인트는 `@Roles` 미적용으로 하위 호환이 유지된다. `@ApiForbiddenResponse` 데코레이터와 컨트롤러 단위 스펙 테스트가 함께 추가되어 계약 변경이 문서화·검증되었고, 기존 workflows/triggers/schedules 등의 패턴을 일관되게 따르고 있다.

### 위험도

LOW