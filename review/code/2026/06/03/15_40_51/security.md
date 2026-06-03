# 보안(Security) 리뷰 결과

리뷰 대상: `interactionAllowedOrigins` 설정 API/UI (워크스페이스 설정 PATCH/GET 엔드포인트 + 프론트엔드 편집 UI)
생성: 2026-06-03

---

## 발견사항

### [WARNING] Origin 정규식 — 와일드카드 서브도메인 및 비표준 scheme 허용 범위 불명확
- **위치**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` L47
  ```
  @Matches(/^https?:\/\/[^/\s?#]+$/i, { each: true })
  ```
- **상세**: 현재 정규식 `[^/\s?#]+` 은 `https://` 뒤에 슬래시·공백·물음표·샵을 제외한 모든 문자를 허용한다. 이 패턴은 다음과 같은 값을 통과시킨다.
  - `https://*.evil.com` — 와일드카드 패턴이 저장될 수 있으나, CORS 판정 함수(`isExternalOriginAllowed`)는 `Set.has(normOrigin(origin))` 로 정확 일치(exact match)만 수행하므로, 실제 CORS에서 와일드카드가 의도치 않게 확장 허용되지는 않는다. 그러나 DB에 와일드카드 문자열이 저장되고 UI에 노출되어 관리자를 혼란하게 할 수 있다.
  - `http://internal-host:8080` — HTTP(비 TLS) origin이 허용 목록에 추가될 수 있다. 외부 임베드 시나리오에서 HTTP origin은 보안상 부적절할 수 있다.
  - 포트 번호 범위 검증 없음: `https://example.com:99999` 처럼 유효하지 않은 포트가 저장 가능하다.
- **제안**:
  1. 와일드카드(`*`) 문자를 명시적으로 차단하는 정규식으로 강화: `/^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?(:\d{1,5})?$/`
  2. HTTP origin에 대해 개발 환경(localhost) 예외 외에는 HTTPS만 허용하도록 경고 또는 제한 추가를 검토한다.
  3. 포트 범위 검증 추가를 고려한다(1–65535).

---

### [WARNING] CORS 레이어 — `interactionAllowedOrigins = []` 시 built-in 위젯 CDN origin 만 허용(의미 혼란 위험)
- **위치**: `codebase/backend/src/common/cors/web-chat-cors.ts` L52–63, `codebase/backend/src/modules/workspaces/workspaces.service.ts` (updateWorkspaceSettings)
- **상세**: `isExternalOriginAllowed()` 는 `allowlist=[]`일 때 `widgetOrigins`만 포함한 집합으로 판정한다. 즉 빈 배열은 CORS 레이어에서 "위젯 CDN 외 모두 차단" 동작이다. 반면 DTO 문서(`update-workspace-settings.dto.ts` L41)와 plan 초기 초안에는 "빈 배열은 모든 origin 차단을 의미합니다"라는 설명이 있고, plan 최종 확정(★ 빈 배열 의미)에서 이를 수정하여 "CDN 추가 허용"이라 정정했다.

  그러나 **DTO의 `@ApiProperty` description 문자열이 여전히 "빈 배열은 모든 origin 차단을 의미합니다"로 남아 있어** 실제 동작(위젯 CDN은 항상 허용)과 Swagger 문서가 불일치한다. 이는 API 소비자가 빈 배열 저장 시 위젯 CDN 요청도 차단된다고 오해하게 만들 수 있다.
- **제안**: DTO의 `@ApiProperty` description을 "빈 배열 = 추가 origin 없음(위젯 CDN은 항상 허용됨, 미설정과 동등)"으로 수정하여 실제 CORS 동작과 일치시킨다.

---

### [INFO] 프론트엔드 클라이언트 사이드 Origin 검증 — 서버 검증의 보완재이므로 우회 가능
- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` L567, L635–645
  ```typescript
  const ORIGIN_PATTERN = /^https?:\/\/[^/\s?#]+$/i;
  // ...
  if (!ORIGIN_PATTERN.test(value)) { toast.error(...); return; }
  ```
- **상세**: 클라이언트 측 검증은 UX 목적이며, 실제 보안 판정은 백엔드 DTO의 `@Matches` 데코레이터가 담당한다. 현재 클라이언트-서버 정규식이 동일(`/^https?:\/\/[^/\s?#]+$/i`)하므로 일관성은 있으나, 클라이언트를 우회한 직접 API 호출 시에도 서버 DTO가 최종 gate 역할을 수행한다. 보안 관점에서 현재 구조는 적절하다.
- **제안**: 없음(현 구조 유지). 다만 향후 서버 측 정규식이 강화되면 클라이언트 정규식도 함께 갱신해야 한다.

---

### [INFO] RBAC 가드 — `useHasRole("admin")` 의 owner 포함 여부
- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — `useHasRole("admin")` 호출
- **상세**: 프론트엔드의 `useHasRole("admin")` 이 실제로 owner 역할도 포함하는지 (ROLE_LEVEL 비교 방식) 코드 레벨에서 확인된다면 보안상 문제없다. 기존 사용 패턴(page.tsx L179, L277)과 동일하여 신규 보안 취약점은 아니다. 단, owner가 편집 불가 상태가 되는 경우(hook이 exact match라면)를 방지하기 위해 hook semantics 문서화가 필요하다. 실제 CORS 검증은 서버 side `assertAdmin()`이 담당하므로 클라이언트 가드 오동작은 UX 문제에 그친다.
- **제안**: 없음(보안 결함 아님). `useHasRole` hook의 semantics를 spec/conventions에 명시하는 것은 일관성 검토 사항으로 분리.

---

### [INFO] 에러 응답 — 민감 정보 노출 없음
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` L366–370, L391–394
- **상세**: `NotFoundException`과 `ForbiddenException` 모두 `{ code, message }` 구조체를 사용하며, 내부 스택 트레이스·DB 정보·사용자 UUID 등 민감 정보를 메시지에 노출하지 않는다. 에러 메시지는 한국어 사용자 안내 문구이다.
- **제안**: 없음.

---

### [INFO] 입력 배열 크기 제한 — DoS 벡터 적절히 차단
- **위치**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` L44–46
  ```typescript
  @ArrayMaxSize(100)
  @MaxLength(2048, { each: true })
  ```
- **상세**: 배열 최대 100개, 각 항목 2048자 제한으로 단일 요청의 페이로드 폭탄(JSON flooding) 위험을 제한한다. 최대 payload 크기는 100 * 2048 = ~200KB로 허용 범위 내이다.
- **제안**: 없음.

---

### [INFO] UUID 파이프 — Path Injection 방지
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` L125
  ```typescript
  @Param('id', new ParseUUIDPipe()) workspaceId: string
  ```
- **상세**: `ParseUUIDPipe`가 workspaceId를 UUID 형식으로 강제 검증하여 경로 탐색 및 SQL injection 벡터를 차단한다. TypeORM의 parameterized query와 결합하여 적절히 보호된다.
- **제안**: 없음.

---

### [INFO] 하드코딩된 시크릿 — 해당 없음
- **위치**: 리뷰 대상 전체 파일
- **상세**: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 리뷰 대상 파일에서 발견되지 않았다.

---

### [INFO] 의존성 보안 — 신규 의존성 없음
- **위치**: 리뷰 대상 전체
- **상세**: 이 변경에서 신규 npm 패키지 의존성이 추가되지 않았다. 기존 `class-validator`, `@nestjs/swagger`, React Query 등은 프로젝트에 이미 존재하는 의존성이다.

---

## 요약

이번 변경(`PATCH/GET /api/workspaces/:id/settings` + 프론트엔드 UI)은 전반적으로 보안 설계가 양호하다. 서버 측에서 UUID 파이프·DTO 검증·assertAdmin RBAC 가드·에러 메시지 정제가 모두 적용되어 있고, 입력 크기 상한도 설정되어 있다. 다만 두 가지 WARNING이 존재한다. 첫째, DTO의 origin 정규식(`[^/\s?#]+`)이 와일드카드(`*`)나 비정상 포트를 허용하여 DB에 의미 없는 값이 저장될 수 있으며, 이는 관리자 혼란의 원인이 될 수 있다(실제 CORS 차단에는 영향 없음). 둘째, DTO의 `@ApiProperty` description이 "빈 배열 = 모든 origin 차단"으로 남아 있어 실제 동작(위젯 CDN은 항상 허용)과 Swagger 문서가 불일치한다. SQL injection·XSS·커맨드 인젝션·경로 탐색·인증 우회·하드코딩 시크릿·취약 암호화 알고리즘은 해당 없음.

---

## 위험도

MEDIUM
