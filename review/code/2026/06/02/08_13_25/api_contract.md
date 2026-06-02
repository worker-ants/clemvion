# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] 신규 엔드포인트 fail-open degrade 정책이 Swagger 에러 계약에 미반영
- 위치: `/codebase/backend/src/modules/hooks/hooks.controller.ts` — `getEmbedConfig()`, `@ApiOkWrappedResponse(EmbedConfigDto)`
- 상세: 성공 응답은 `ApiOkWrappedResponse` 로 `{ data: EmbedConfigDto }` 래핑이 문서화되어 있고 프론트엔드 테스트(`widget-app.test.tsx`)도 이 형태를 stub하여 계약 일관성이 유지된다. 그러나 `EmbedConfigService.resolve` 는 trigger 미존재·DB 오류 등 모든 실패 경로를 `{ allowlist: [], enforce: false }` allow-all로 degrade하면서 HTTP 200을 반환하는데, 이 fail-open 정책이 `@ApiOperation` description 이나 Swagger 응답 명세 어디에도 명시되지 않았다. API 문서만으로는 "trigger가 없으면 404", "오류 시 500" 등의 직관적 예측과 실제 동작이 다름을 알 수 없다. 또한 NestJS 파이프라인 예외(라우팅 오류 등)가 GlobalExceptionFilter 를 거칠 경우의 에러 응답 형식도 문서화가 없다.
- 제안: `@ApiOperation` description 에 "trigger 미존재 또는 조회 실패 시 `{ allowlist: [], enforce: false }` (allow-all, fail-open — 위젯 비파손 정책)" 을 명시한다. `@ApiInternalServerErrorResponse` 또는 `@ApiResponse({ status: 500, description: '서버 오류 시 allow-all 로 degrade' })` 를 추가해 에러 경로 계약을 문서화한다.

### [WARNING] Cache-Control 응답 헤더가 Swagger API 계약에 미반영
- 위치: `/codebase/backend/src/modules/hooks/hooks.controller.ts` — `res.set('Cache-Control', 'public, max-age=300')`
- 상세: `GET /api/hooks/:endpointPath/embed-config` 는 `Cache-Control: public, max-age=300` 을 설정해 5분 공유 캐시를 의도한다. 이 헤더는 위젯 반복 부팅 시 네트워크 요청 절감의 핵심 계약이나 Swagger 데코레이터(`@ApiHeader` 또는 응답 headers 옵션)에 전혀 명시되지 않았다. 추가로, CDN/리버스 프록시 개입 시 `Vary` 헤더 미설정으로 인해 응답이 origin 별로 달라질 경우 캐시 오염이 발생할 수 있다. 현재 응답 내용은 origin 별로 다르지 않으므로 실질 위험은 낮으나 계약 문서화 측면에서 불완전하다.
- 제안: `@ApiResponse` 에 `headers: { 'Cache-Control': { description: 'public, max-age=300', schema: { type: 'string' } } }` 를 추가해 캐싱 계약을 문서화한다. 응답 내용이 origin 별로 달라질 가능성이 생기면 `Vary: Origin` 추가를 검토한다.

### [INFO] `endpointPath` 파라미터 입력 유효성 검증 없음
- 위치: `/codebase/backend/src/modules/hooks/hooks.controller.ts` — `@Param('endpointPath') endpointPath: string`
- 상세: `endpointPath` 에 길이 제한, 패턴 검증이 없다. TypeORM 파라미터화 쿼리로 SQL injection 위험은 없고, 존재하지 않는 값이면 allow-all을 반환하므로 실질 피해는 없다. 그러나 API 계약 관점에서 허용 입력 범위가 `@ApiParam` description 에만 예시로 기재되어 있을 뿐 공식 제약이 없다.
- 제안: `@ApiParam` description 에 "트리거 등록 시 발급된 고유 식별자(영숫자·하이픈, 최대 128자)" 등 형식을 명시하고, 필요 시 `@Matches(/^[a-zA-Z0-9_-]{1,128}$/)` 를 적용한다. 현재 fail-open 정책상 실질 위험 낮아 INFO 수준.

### [INFO] `EmbedConfigDto` 불변식(allowlist 비어 있으면 enforce=false) Swagger 계약에 미명시
- 위치: `/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` — `EmbedConfigDto`
- 상세: `enforce` 는 "allowlist 가 1개 이상일 때 true" 파생 계산값이나, DTO `@ApiProperty` description 에는 두 필드가 독립적으로 설명되어 있어 "allowlist=[] 이면 enforce=false 임이 보장된다" 는 불변식이 명시되지 않았다. 위젯이 `allowlist=[]` + `enforce=true` 를 수신할 경우 동작 정의가 없다.
- 제안: `enforce` 필드의 `@ApiProperty` description 에 "allowlist.length > 0 일 때만 true — 두 필드는 항상 일관됨" 을 보강한다. 코드 변경 없이 문서 보강만으로 해소 가능.

### [INFO] 이전 리뷰 W9 (에러 포맷 일관성 resolved-as-consistent) — 신규 엔드포인트 적용 확인 필요
- 위치: `/review/code/2026/06/02/01_32_03/RESOLUTION.md` W9 항목 + 신규 `getEmbedConfig`
- 상세: 이전 리뷰에서 GlobalExceptionFilter 가 `{ error:{code,message} }` 형태로 언래핑하여 에러 포맷이 일관성 있다고 resolved-as-consistent 처리됐다. 신규 엔드포인트는 서비스가 fail-open 으로 200을 반환하므로 필터를 거치는 경우가 드물지만, NestJS 라우팅·바인딩 예외 시 GlobalExceptionFilter 가 동일하게 적용되는지 확인이 필요하다.
- 제안: GlobalExceptionFilter 가 신규 public 엔드포인트에도 동일 적용됨을 확인 후 추가 조치 불필요.

## 요약

이번 변경의 신규 API 표면은 `GET /api/hooks/:endpointPath/embed-config` 단일 엔드포인트다. `@Public()` 으로 명시적으로 공개 처리되어 인증/인가 설계가 명확하고, 기존 `POST` 엔드포인트와 독립된 경로로 하위 호환성 파괴가 없으며, RESTful 서브리소스 패턴(`/embed-config`)도 일관성 있다. 성공 응답은 전역 TransformInterceptor 의 `{ data: ... }` 래핑이 `ApiOkWrappedResponse` 로 문서화되고 프론트엔드 테스트에서도 동일 형태를 검증하여 응답 형식 계약이 유지된다. 주요 WARNING 사항은 두 가지다: (1) fail-open degrade 정책(`{ allowlist: [], enforce: false }` + HTTP 200)과 에러 경로가 Swagger 에 전혀 문서화되지 않아 에러 처리 계약이 불완전하고, (2) `Cache-Control: public, max-age=300` 응답 헤더가 Swagger API 계약에 누락되어 캐싱 동작이 클라이언트 계약으로 명시되지 않았다. 나머지 발견사항(입력 검증 명시 부재, DTO 불변식 미기재, 이전 에러 포맷 결정 적용 확인)은 INFO 수준이다. 프론트엔드 위젯 측 변경(`presentations`, `BLOCKED` phase, 임베드 소프트 검증)은 백엔드 HTTP API 계약과 직접 무관한 클라이언트 내부 상태 변경이다.

## 위험도

LOW

---

STATUS=success ISSUES=7
