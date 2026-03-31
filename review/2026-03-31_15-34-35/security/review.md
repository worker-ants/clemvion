## 보안 코드 리뷰 결과

### 발견사항

---

#### 1. **[WARNING]** OAuth State Token 미검증 — CSRF 취약점

- **위치**: `integrations.service.ts` — `reauthorize()` 메서드
- **상세**: `state` 토큰을 생성하지만 서버 어디에도 저장하거나 검증하지 않습니다. OAuth 콜백 시 state를 검증하지 않으면 CSRF 공격에 노출됩니다. 생성한 state가 단순히 반환만 되고 세션/DB에 저장되지 않아 콜백에서 검증이 불가능합니다.
- **제안**: Redis 또는 DB에 `state → {userId, integrationId, expiry}` 형태로 저장하고, OAuth 콜백 핸들러에서 반드시 검증하세요.

---

#### 2. **[WARNING]** `window.open()` 으로 전달되는 OAuth URL 미검증 — Open Redirect 위험

- **위치**: `integrations/page.tsx` — `reauthorizeMutation.onSuccess`
- **상세**: 서버에서 반환된 `data.authUrl`을 검증 없이 `window.open()`에 직접 전달합니다. 서버가 침해되거나 API 응답이 조작되면 임의 URL로 사용자를 리다이렉트할 수 있습니다.
- **제안**: 클라이언트에서 `authUrl`이 허용된 도메인(`slack.com`, `accounts.google.com`, `github.com`)으로 시작하는지 화이트리스트 검증 후 `window.open()` 호출하세요.

```ts
const ALLOWED_AUTH_DOMAINS = [
  'https://slack.com/',
  'https://accounts.google.com/',
  'https://github.com/',
];
if (!ALLOWED_AUTH_DOMAINS.some(d => data.authUrl.startsWith(d))) {
  toast.error('Invalid authorization URL');
  return;
}
```

---

#### 3. **[WARNING]** 환경변수 미설정 시 빈 문자열로 Client ID 노출

- **위치**: `integrations.service.ts:128`
- **상세**: `process.env[...] || ''` 패턴으로 Client ID 환경변수가 없을 때 빈 문자열로 URL을 생성합니다. 이는 OAuth URL이 잘못된 파라미터로 생성되어도 오류 없이 반환되어 디버깅이 어렵고, 운영 환경에서 설정 누락을 감지하지 못합니다.
- **제안**: 환경변수 미설정 시 명시적 예외를 던지세요.

```ts
const clientId = process.env[`${integration.serviceType.toUpperCase()}_CLIENT_ID`];
if (!clientId) {
  throw new BadRequestException(`OAuth client not configured for ${integration.serviceType}`);
}
```

---

#### 4. **[WARNING]** 워크플로우 임포트 시 노드 타입/카테고리 미검증 — 악의적 페이로드 주입 가능

- **위치**: `workflows.service.ts` — `importWorkflow()`, `import-workflow.dto.ts`
- **상세**: `ImportNodeDto`의 `type`, `category` 필드가 `@IsString()`만 검증하며 허용된 값의 화이트리스트 검증이 없습니다. 공격자가 존재하지 않는 노드 타입이나 내부 시스템 노드 타입을 임포트하여 실행 엔진에 예상치 못한 동작을 유발할 수 있습니다.
- **제안**: `@IsIn(ALLOWED_NODE_TYPES)` 또는 `@IsEnum(NodeType)` 데코레이터를 추가하세요.

---

#### 5. **[WARNING]** 통계 Export API에 사용자 입력이 파일명에 직접 사용 — Path Traversal 잠재 위험

- **위치**: `statistics.service.ts:238`, `statistics.controller.ts`
- **상세**: `period` 값이 검증 없이 파일명(`statistics-${period}.csv`)에 삽입됩니다. `Content-Disposition` 헤더의 filename에 `../` 등이 포함될 경우 일부 클라이언트에서 path traversal이 발생할 수 있습니다.
- **제안**: `QueryStatisticsDto`에서 `period` 필드를 `@IsIn(['7d', '30d', '90d'])` 등 허용 값으로 제한하거나, 파일명에서 영숫자/하이픈만 허용하는 새니타이징을 적용하세요.

---

#### 6. **[WARNING]** Cron Expression을 사용자 입력에서 직접 파싱 — ReDoS 가능성

- **위치**: `schedules.service.ts` — `getPreviewFromExpression()`, `POST /schedules/preview`
- **상세**: `schedules.controller.ts`의 `previewExpression` 엔드포인트는 인증된 사용자라도 임의의 cron expression을 본문에 담아 서버에서 파싱하게 합니다. 악의적으로 구성된 cron 표현식이 파서에 과부하를 유발할 수 있습니다. 또한 `count` 파라미터에 상한선이 없어 매우 큰 값으로 서버 부하를 유발할 수 있습니다.
- **제안**: `count`에 최대값을 적용하고 입력을 DTO로 검증하세요.

```ts
// schedules.controller.ts
@Post('preview')
async previewExpression(@Body() body: PreviewExpressionDto) { ... }

// dto
class PreviewExpressionDto {
  @IsString() @MaxLength(100) cronExpression: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) count?: number;
}
```

---

#### 7. **[INFO]** `run-now` 엔드포인트에 Rate Limiting 없음

- **위치**: `schedules.controller.ts` — `POST /schedules/:id/run-now`
- **상세**: 인증된 사용자가 스케줄을 반복 호출하여 의도치 않은 다수의 워크플로우 실행을 유발할 수 있습니다. 현재 Rate Limiting 가드 적용이 보이지 않습니다.
- **제안**: NestJS `@Throttle()` 데코레이터 또는 Redis 기반 rate limiter를 적용하세요.

---

#### 8. **[INFO]** `previewExpression` 엔드포인트의 인증 적용 여부 확인 필요

- **위치**: `schedules.controller.ts` — `POST /schedules/preview`
- **상세**: 컨트롤러 레벨에 `JwtAuthGuard`가 적용되어 있다면 문제없지만, 해당 엔드포인트가 공개되어 있을 경우 인증 없이 서버 리소스를 소비할 수 있습니다. `WorkspaceId` 데코레이터를 사용하지 않는 점으로 보아 인증 컨텍스트를 활용하지 않습니다.
- **제안**: 컨트롤러/모듈 레벨의 글로벌 가드 적용 여부를 확인하고, 필요시 명시적 `@UseGuards(JwtAuthGuard)`를 추가하세요.

---

#### 9. **[INFO]** 워크플로우 Export JSON에 민감 설정 포함 가능성

- **위치**: `workflows.service.ts` — `exportWorkflow()`
- **상세**: `settings` 필드 전체가 Export에 포함됩니다. 만약 settings에 API 키, 비밀번호, 내부 엔드포인트 등 민감 정보가 저장된 경우 다른 워크스페이스로 임포트 시 노출될 수 있습니다.
- **제안**: Export 시 민감 설정 키를 마스킹하거나, 임포트 시 settings를 신뢰하지 않고 재설정을 유도하세요.

---

#### 10. **[INFO]** `@colordx/core` 신규 패키지 무결성 확인 권고

- **위치**: `backend/package-lock.json` — `node_modules/@colordx/core`
- **상세**: 기존 `colord` 패키지가 `@colordx/core`로 교체되었습니다. 이는 `postcss-colormin` 의존성 변경에 의한 것이지만, 신규 패키지이므로 npmjs.com에서 다운로드 수, 유지관리 상태, 알려진 취약점을 확인하는 것이 권장됩니다. `optional: true`로 마킹되어 있어 프로덕션 영향은 낮습니다.
- **제안**: `npm audit` 실행 및 패키지 신뢰도 확인.

---

### 요약

전반적으로 인증/인가 구조(workspaceId 기반 격리)와 UUID 파이프 적용, class-validator 기반 DTO 검증은 잘 구성되어 있습니다. 그러나 OAuth 재인증 플로우에서 CSRF state 토큰 검증이 누락되어 있고, 사용자 입력이 OAuth URL 생성, 파일명, cron 파싱에 직접 사용되는 부분에서 보완이 필요합니다. 특히 `window.open(authUrl)` 전 URL 화이트리스트 검증과 OAuth state 서버 저장/검증은 운영 환경 배포 전 반드시 해결해야 할 WARNING 수준 이슈입니다.

### 위험도

**MEDIUM**