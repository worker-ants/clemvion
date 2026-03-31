## 발견사항

### **[WARNING]** `GET :id/history` vs `GET :id/usage` 엔드포인트 — 페이지네이션 미적용
- **위치**: `triggers.controller.ts`, `auth-configs.controller.ts`
- **상세**: `getHistory`는 하드코딩된 `.limit(10)`, `getUsage`는 `.limit(20)`으로 고정. 클라이언트(`trigger-detail-drawer.tsx`)에서 `?limit=10` 쿼리 파라미터를 전송하지만 서버에서 무시됨. 목록이 증가하면 응답이 잘리고 클라이언트가 더 많은 데이터를 요청할 수 없음.
- **제안**: `PaginationQueryDto` 또는 별도 `limit` 파라미터를 `@Query()`로 받아 적용. 또는 `PaginatedResponseDto`로 래핑하여 일관성 확보.

---

### **[WARNING]** `POST /integrations/:id/reauthorize` — 응답 형식 불일관
- **위치**: `integrations.service.ts:119-143`
- **상세**: OAuth 연동이 없는 경우 `{ authUrl: '', state: '' }`를 반환. 클라이언트는 `authUrl`이 truthy인지로 분기하지만, 빈 문자열도 OAuth URL이 없음을 의미한다는 계약이 암묵적. 또한 non-OAuth의 경우 실제로 "reauthorize"가 아닌 상태를 `connected`로 강제 업데이트하는데, 이는 의미론적으로 부정확.
- **제안**: 응답 타입을 명시적으로 구분: `{ type: 'oauth', authUrl: string, state: string }` | `{ type: 'reset', message: string }`. 또는 non-OAuth는 별도 엔드포인트로 분리.

---

### **[WARNING]** `POST /schedules/preview` — 인증 Guard 누락 가능성
- **위치**: `schedules.controller.ts:52-61`
- **상세**: `@Body()` 검증 없이 `cronExpression`을 직접 `cron-parser`에 전달. DTO 없이 raw body를 사용하므로 class-validator 검증이 적용되지 않음. 악의적인 입력으로 파서 예외가 발생할 수 있음.
- **제안**: `PreviewExpressionDto` 클래스를 생성하여 `@IsString()`, `@Matches(/^[0-9* \/,-]+$/)` 등으로 입력 검증 추가. try-catch로 파서 예외를 400 BadRequest로 변환.

---

### **[WARNING]** `GET /schedules/:id/preview` — `count` 파라미터 검증 없음
- **위치**: `schedules.controller.ts:43-51`
- **상세**: `count` 쿼리 파라미터를 `parseInt`로만 변환하고 범위 검증 없음. `count=9999` 전달 시 서버 리소스 낭비 가능.
- **제안**: `count = Math.min(Math.max(count ?? 5, 1), 20)` 등으로 서버에서 범위 제한. 또는 `@Min(1) @Max(20) @IsOptional() @IsInt()` 데코레이터 적용.

---

### **[WARNING]** `POST /workflows/import` — 경로 충돌 위험
- **위치**: `workflows.controller.ts:118-128`
- **상세**: `POST /workflows/import`는 `POST /workflows/:id` 패턴과 충돌할 수 있음. NestJS는 정적 경로를 동적 경로보다 우선하므로 현재는 동작하지만, 미래에 `POST /workflows/:id` 엔드포인트가 추가되면 문제 발생. 또한 `GET /workflows/:id/export`가 이미 존재하는데 import는 리소스 컬렉션에 직접 `POST`하는 것이 REST 관점에서 비일관적.
- **제안**: 현재 패턴은 동작하나, 컨트롤러에서 `import` 라우트가 `:id` 라우트보다 **앞에** 위치하는지 확인 필요. 또는 `POST /workflows/actions/import` 패턴 고려.

---

### **[INFO]** `GET /statistics/export` — `format` 파라미터 이중 바인딩
- **위치**: `statistics.controller.ts:47-68`
- **상세**: `@Query() query: QueryStatisticsDto`와 `@Query('format') format: string`을 함께 사용. `format`이 `QueryStatisticsDto`에 포함되어 있지 않다면 이중 바인딩은 문제없으나, 만약 나중에 DTO에 추가되면 혼란 발생.
- **제안**: `format`을 `QueryStatisticsDto`에 선택적 필드로 추가하여 단일 DTO로 통합.

---

### **[INFO]** `GET /auth-configs/:id/usage` — `lastUsedAt` 필드 중복 계산
- **위치**: `auth-configs.service.ts:104-161`
- **상세**: `lastUsedAt`은 `AuthConfig` 엔티티에서 직접 가져오는데, 이는 최근 실행 시간과 다를 수 있음 (별도 업데이트 로직에 따라 다름). 클라이언트는 이 차이를 알 수 없음.
- **제안**: API 문서(또는 주석)에 `lastUsedAt`의 출처가 auth config 엔티티의 마지막 업데이트 시간임을 명시.

---

### **[INFO]** `DashboardSummary` 인터페이스 확장 — 하위 호환성 유지됨
- **위치**: `dashboard.service.ts`, `dashboard/page.tsx`
- **상세**: `runs7dPrevious`, `runs7dChangePercent` 필드 추가는 기존 클라이언트에 영향 없음 (새 필드 추가는 비파괴적). 프론트엔드도 `?? null`로 안전하게 처리.

---

### **[INFO]** `TriggerHistoryEntry.triggeredAt` — 필드명 불일관
- **위치**: `trigger-detail-drawer.tsx:20`, `triggers.service.ts` getHistory 응답
- **상세**: 서버 응답은 `startedAt` 필드명을 사용하지만(`triggers.service.ts`의 return 매핑), 클라이언트 인터페이스는 `triggeredAt`으로 정의. 실제 데이터가 바인딩되지 않아 날짜가 렌더링되지 않음.
- **제안**: 서버 응답 필드명을 `startedAt`에서 `triggeredAt`으로 변경하거나, 클라이언트 인터페이스를 `startedAt`으로 수정하여 일치시킴.

---

## 요약

전반적으로 이번 변경은 기존 API에 새 엔드포인트를 추가하는 방식으로 하위 호환성을 잘 유지하고 있습니다. 그러나 몇 가지 계약 품질 이슈가 존재합니다: `GET /triggers/:id/history`와 `GET /auth-configs/:id/usage`에 페이지네이션이 없어 데이터 증가 시 확장성이 부족하고, `POST /schedules/preview`는 DTO 없이 raw body를 받아 입력 검증이 취약합니다. 가장 즉각적인 버그는 `TriggerHistoryEntry`의 필드명 불일치(`triggeredAt` vs `startedAt`)로 인해 트리거 히스토리 날짜가 실제로 표시되지 않을 가능성이 있습니다. OAuth reauthorize 응답의 암묵적 타입 구분도 명시적 계약으로 개선이 필요합니다.

## 위험도

**MEDIUM**