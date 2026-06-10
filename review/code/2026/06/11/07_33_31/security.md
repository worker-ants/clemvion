### 발견사항

- **[INFO]** `previewTest` 엔드포인트에서 serviceType/authType 조합을 에러 메시지에 그대로 반영
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` 라인 226-229
  - 상세: `Unsupported service/auth combination: ${body.serviceType}/${body.authType}` — 사용자가 제공한 값이 에러 메시지에 그대로 포함된다. 이 값들은 서비스 타입 식별자에 해당하므로 민감도는 낮지만, 임의 문자열이 에러 응답에 반사(reflection)되는 패턴이다. 현재는 findVariant 검증 이후 값이 그대로 노출되므로 저위험이나, 향후 이 패턴이 다른 필드로 확장될 경우 reflected 응답 노출의 선례가 될 수 있다.
  - 제안: 에러 메시지를 고정 문자열로 대체하거나, serviceType/authType을 whitelist에서 검증된 값임을 명시적으로 보장한 후에만 포함할 것.

- **[INFO]** 테스트 파일에 Google OAuth 토큰 패턴과 유사한 평문 자격 증명 리터럴 사용
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (예: `access_token: 'ya29-secret'`, `client_secret: 'csec'`, `password: 'app-password'`)
  - 상세: 테스트용 픽스처이므로 실제 운영 시크릿은 아니다. 그러나 `ya29-` prefix는 Google OAuth 액세스 토큰 형식과 동일한 패턴이어서 gitleaks/truffleHog 등 자동 시크릿 스캐너가 실제 노출로 false positive를 일으킬 수 있다.
  - 제안: 픽스처 값을 `fake-access-token`, `test-client-secret` 등 시크릿 스캐너가 오탐하지 않는 명시적 더미 형식으로 교체를 권장한다.

- **[INFO]** `getServiceCatalog` — `type` 경로 파라미터에 대한 whitelist 검증 부재
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` 라인 196-198 / `codebase/backend/src/modules/integrations/integrations.service.ts` 신규 makeshop 분기
  - 상세: `@Param('type') type: string`에 별도의 길이 제한이나 포맷 검증이 없다. 현재 구현은 `=== 'cafe24'` / `=== 'makeshop'` 두 개의 엄격한 문자열 비교로 분기하며 그 외에는 빈 배열을 반환하므로 실질적 위험은 없다. 그러나 이 값이 향후 DB 쿼리나 파일 시스템 경로에 사용될 경우 인젝션 취약점이 생길 수 있다.
  - 제안: `type` 파라미터에 `@IsIn(['cafe24', 'makeshop'])` 또는 whitelist 기반 validation pipe를 추가할 것.

- **[INFO]** 프론트엔드 `tryTranslateLabel` — catalogKey가 i18n 키에 직접 조립됨
  - 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 라인 3537-3548 (`tryTranslateLabel` 함수)
  - 상세: `catalog.get(apiLabel)` 에서 가져온 `labelKey` 또는 `apiLabel` 자체가 `${namespace}.${catalogKey}` 형태의 i18n 키로 직접 조립된다. 이 값은 서버 카탈로그 API 응답에서 오고 카탈로그는 정적 메타데이터에서 빌드되므로 공격자가 제어하기 어렵다. 다만 서버 측 `key`/`labelKey` 패턴 검증 (`/^[a-z0-9_.]+$/i` 수준)이 없을 경우 조작된 값이 i18n 키 공간을 오염시킬 수 있다.
  - 제안: 서버에서 카탈로그 `key` / `labelKey` 필드에 대한 포맷 검증을 확인하고, 필요시 프론트엔드에서도 `catalogKey`를 i18n 키로 조립하기 전 안전한 형식(알파벳·숫자·점·언더스코어)인지 검증할 것.

- **[INFO]** `oauthBegin` — MakeShop `clientSecret`이 `providerMeta`로 전달될 때 audit log 마스킹 여부
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` 라인 267-274
  - 상세: MakeShop 흐름에서 `body.clientSecret`이 `providerMeta.client_secret`으로 내부 서비스에 전달된다. 의도된 설계이나, `oauthService.begin()` 내부에서 audit log 기록 시 `client_secret` 필드가 마스킹 처리되는지 확인이 필요하다.
  - 제안: `oauthService.begin()` 및 하위 audit 기록 경로에서 `providerMeta.client_secret` 가 마스킹(`********`) 처리됨을 코드 레벨에서 검증할 것.

### 요약

이번 변경은 MakeShop 서비스 카탈로그 지원 추가(`getServiceCatalog` makeshop 분기)와 Activity 탭 i18n 라벨 namespace 일반화(`tryTranslateLabel` provider-prefix 분기)가 주된 내용으로, 보안 관점에서 CRITICAL 또는 HIGH 등급의 신규 취약점은 도입되지 않았다. 인증/인가 구조(JWT Bearer, `@Roles`, `ParseUUIDPipe`, workspaceId 격리)는 기존과 동일하게 유지되며, 신규 `getServiceCatalog` makeshop 분기는 하드코딩된 문자열 동등 비교로 처리되어 임의 입력에 안전하다. 다만 테스트 픽스처의 `ya29-secret` 패턴이 자동 시크릿 스캐너의 false positive를 유발할 수 있고, `previewTest` 에러 메시지의 입력 반사 패턴, `getServiceCatalog`의 `type` 파라미터 whitelist 미적용, 프론트엔드 catalogKey의 i18n 키 직접 조립 등 낮은 수준의 개선 포인트가 존재한다.

### 위험도

LOW
