# API 계약(API Contract) 리뷰

## 발견사항

### **[INFO]** `AuthConfigUsageDto.lastUsedAt` 데코레이터 변경 — breaking 아님
- 위치: `/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` line 563
- 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })`로 변경됨. 런타임 직렬화 동작은 동일하고 Swagger 스펙 상 `required` 플래그가 추가되지만 실제 필드는 `?` optional이 유지되어 클라이언트에 breaking이 되지 않는다. 단, Swagger UI에서 해당 필드를 required로 표시하게 되어 API 문서와 실제 동작 사이의 불일치가 생긴다.
- 제안: `lastUsedAt`이 null이 될 수 있고 optional이기도 하다면 `@ApiProperty({ nullable: true, required: false })`를 명시하거나, TypeScript 타입이 `string | null`(non-optional)이라면 `?`를 제거해 선언과 문서를 일치시킨다.

### **[INFO]** `AuthConfigUsageCallDto.responseCode` — 의미 혼합(HTTP 코드 vs status enum) 계약
- 위치: `/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` lines 549-554
- 상세: `responseCode`는 webhook 호출 시 HTTP 코드 문자열(`'202'`)이고 비-HTTP 트리거에는 `status` enum 값(`'completed'`, `'failed'`)이 폴백으로 채워진다. 두 의미가 동일 필드에 섞이는 계약이다. 현재 description에 이 폴백 동작이 명시되어 있어 클라이언트가 인지 가능하지만, 타입이 `string`으로만 선언되어 있어 API 소비자가 어느 경우에 어떤 값이 오는지 추론하기 어렵다.
- 제안: `@ApiProperty({ enum: ['202', 'completed', 'failed', 'cancelled', 'running', 'pending', 'waiting_for_input'], ... })`를 추가하거나, `sourceIp`가 `null`이면 HTTP 코드가 없음을 의미하므로 `responseCode`도 nullable로 선언하고 폴백 변환을 프론트엔드 레이어로 이동하는 방안을 고려한다. INFO 수준으로 blocking하지 않으나 향후 소비자 혼란 가능성이 있다.

### **[INFO]** `periodCounts` — API 버전 미포함 신규 필드 추가
- 위치: `/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` lines 519-528, 566-567
- 상세: `AuthConfigUsageDto`에 `periodCounts` 필드가 추가되었다. 기존 클라이언트가 이 필드를 무시하면 문제없으나, 응답 스키마가 변경된다. API 버전(`/v1/` 등)이 경로에 포함되어 있지 않아 버전 관리 없이 스키마가 확장되는 패턴이다. `periodCounts`와 `recentCalls[].sourceIp`/`recentCalls[].responseCode` 모두 기존 클라이언트가 소비하던 필드가 아닌 **추가** 필드이므로 backwards-compatible additive change에 해당한다. Breaking change 아님.
- 제안: 현재 additive이므로 blocking 없음. 다만 이 프로젝트가 API 버전 관리 정책을 확립한다면 `/api/v1/auth-configs/...` 같은 접두사를 도입하는 것을 권장한다.

### **[INFO]** `GET /api/auth-configs/:id/usage` 경로 설계 — RESTful 적절
- 위치: hooks.service.ts, auth-configs.service.ts
- 상세: `/api/auth-configs/:id/usage` 경로는 RESTful 컨벤션상 sub-resource로 적절하다. `GET` 메서드 사용, 경로 파라미터 `:id`로 리소스 식별, 문제 없음.

### **[INFO]** `recentCalls` 고정 20건 제한 — 페이지네이션 부재
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` line 351 (`USAGE_RECENT_CALLS_LIMIT = 20`)
- 상세: 목록 API가 아닌 usage 통계 API의 `recentCalls` 부분이 하드코딩된 20건으로 제한된다. 현재 spec(`§A.3`)이 "최근 N건" 방식으로 정의하므로 이는 의도된 설계다. 단, API 계약상 페이지네이션 파라미터(`page`, `limit`, `cursor`)가 없어 클라이언트가 더 많은 이력을 조회할 방법이 없다.
- 제안: 현재 spec 범위(`§A.3 최근 20건`)를 벗어나지 않으므로 blocking 없음. 향후 이력 조회 확장 시 별도 paginated endpoint(`GET /api/auth-configs/:id/calls?page=...`) 도입을 권장한다.

### **[INFO]** 에러 응답 — 기존 패턴과 일관성 유지
- 위치: hooks.service.ts (GoneException, NotFoundException, BadRequestException 등)
- 상세: 이번 변경은 기존 에러 핸들링 코드를 수정하지 않으며 신규 에러 경로를 추가하지 않는다. 에러 응답 형식의 일관성은 유지된다.

### **[INFO]** 인증/인가 — 기존 엔드포인트 접근 제어 영향 없음
- 위치: auth-configs.service.ts `getUsage()` 메서드
- 상세: `getUsage`는 `findById(id, workspaceId)` 호출로 workspace 소속 검증을 수행한다. 신규 필드(`periodCounts`, `sourceIp`, `responseCode`)는 기존 authorization 체크 아래 반환된다. 별도 권한 레벨이 필요한 민감 데이터(`sourceIp`는 클라이언트 IP이므로 PII 가능성 있음)에 대해 추가 접근 제어가 없다.
- 제안: `sourceIp`는 클라이언트 IP 주소로 PII 취급 가능성이 있다. 현재 workspace-level 인가로 접근을 제한하고 있어 공개 노출은 아니지만, 향후 GDPR 등 개인정보 규정 준수 여부를 검토하는 것을 권장한다. 현재 리뷰 범위에서는 INFO 수준.

---

## 요약

이번 변경은 `GET /api/auth-configs/:id/usage` 엔드포인트 응답에 `periodCounts`(롤링 윈도 3종 호출 건수)와 `recentCalls[].sourceIp`/`recentCalls[].responseCode` 필드를 추가하고, DB migration(`V096`)으로 `execution` 테이블에 두 컬럼을 nullable 추가하는 것이다. 모든 변경이 additive(기존 필드 제거·재명명 없음)이므로 기존 API 클라이언트에 대한 breaking change가 없다. `lastUsedAt` 데코레이터 변경(`@ApiPropertyOptional` → `@ApiProperty`)은 Swagger 문서 수준의 불일치를 유발하지만 런타임 동작에 영향이 없다. `responseCode` 필드가 HTTP 코드와 status enum 폴백을 혼용하는 의미론적 계약은 문서화되어 있으나 소비자 혼란 소지가 있다. API 버전 관리 정책 없이 스키마가 확장되는 패턴이 반복되고 있으나 현재 additive이므로 즉각적인 위험은 없다.

### 위험도
LOW
