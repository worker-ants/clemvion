# 보안(Security) 리뷰

## 발견사항

### 인젝션 취약점

변경된 코드 범위 내에서 SQL 인젝션, XSS, 커맨드 인젝션 등의 신규 인젝션 취약점은 발견되지 않았다.

- `getServiceCatalog`의 `serviceType` 파라미터는 `=== 'cafe24'` / `=== 'makeshop'` 엄격 비교로 처리하여 임의 값은 빈 배열 반환 경로로만 진입한다. 별도 DB 쿼리나 파일 시스템 접근이 없다.
- `tryTranslateLabel`의 `catalogKey`는 `startsWith("makeshop.")` / `startsWith("cafe24.")` prefix 검사 후 flat dict 직접 lookup 헬퍼에만 전달된다. DOM 렌더링 전 React의 자동 이스케이핑이 적용되므로 XSS 경로 없음.

### 하드코딩된 시크릿

변경된 diff 범위 내에 API 키, 비밀번호, 토큰 등의 하드코딩된 시크릿은 존재하지 않는다.

테스트 파일(`integrations.service.spec.ts`)에 사용된 `'cid'`, `'csec'`, `'tok'`, `'rtok'` 등은 테스트 픽스처 dummy 값으로 프로덕션 시크릿이 아니다.

### 인증/인가

- **[INFO]** `getServiceCatalog` 엔드포인트(`GET /api/integrations/services/:type/catalog`)는 `@ApiBearerAuth('access-token')` 및 `@ApiUnauthorizedResponse`가 컨트롤러 클래스 레벨에 선언되어 있어 JWT 인증이 적용된다. 추가 role guard(`@Roles(...)`)는 없으나 이 엔드포인트는 읽기 전용 공개 메타데이터(operation 목록)를 반환하므로 적절하다.
  - 위치: `integrations.controller.ts` L180–L198
  - 상세: 반환 데이터는 provider별 API 목록(method, path, labelKey)으로 민감 정보 미포함.
  - 제안: 현재 설계 적절. 변경 불필요.

### 입력 검증

- **[INFO]** `buildOperationCatalog` 헬퍼는 `listAllMakeshopOperations()`/`listAllCafe24Operations()` 에서 반환된 정적 메타데이터를 그대로 투영한다. 외부 사용자 입력이 아닌 컴파일 타임 고정 데이터이므로 별도 검증 불필요.
  - 위치: `integrations.service.ts` L138–L164 (`buildOperationCatalog`)

- **[INFO]** 프론트엔드 `tryTranslateLabel`에서 `catalogKey`가 `"makeshop."` 또는 `"cafe24."` prefix로 시작하지 않는 경우 `null`을 반환하여 unknown key가 UI에 그대로 노출되지 않는다. 방어적 처리 적절.
  - 위치: `page.tsx` L3556–L3566

### OWASP Top 10

- **[INFO]** A03:2021 인젝션 — 해당 없음 (상세 위 참조).
- **[INFO]** A01:2021 접근 제어 — `getServiceCatalog`는 인증 필요이나 role 제한 없음. 반환 데이터가 공개 카탈로그 메타데이터이므로 문제 없음.

### 암호화

변경 범위 내 암호화 관련 신규 코드 없음. 기존 credentials 마스킹(`'********'`) 패턴은 변경되지 않았다.

### 에러 처리

- **[INFO]** `previewTest` 엔드포인트의 오류 메시지:
  - 위치: `integrations.controller.ts` L225–L230
  - 상세: `Unsupported service/auth combination: ${body.serviceType}/${body.authType}` 형태로 사용자가 제출한 `serviceType`/`authType` 값이 그대로 에러 메시지에 포함된다. 이는 기존 코드이며 이번 diff에서 변경되지 않았다. 해당 값은 저장되지 않고 지원 범위 확인용이므로 민감 정보 누출 위험은 낮으나, 향후 로그에 기록 시 임의 문자열이 주입될 수 있다.
  - 제안: 에러 메시지를 고정 문자열로 변경하거나 값을 로그에 기록 시 sanitize 적용. 단, 이번 변경 범위 외의 사항.

### 의존성 보안

변경된 import:
- `listAllMakeshopOperations` from `../../nodes/integration/makeshop/metadata` — 새로 추가된 내부 모듈. 알려진 외부 취약점 라이브러리 추가 없음.
- `resolveMakeshopOperationLabel` from `@/lib/node-definitions/makeshop-extras` — 내부 모듈. 외부 의존성 추가 없음.

---

## 요약

이번 변경은 MakeShop operation 카탈로그 제공(`getServiceCatalog` makeshop 분기 추가)과 Activity 탭의 라벨 번역 헬퍼를 provider-prefix 일반화(`tryTranslateLabel`)하는 기능 추가이다. 보안 관점에서 신규 인젝션 경로, 하드코딩 시크릿, 인증/인가 우회, 민감 정보 노출 등의 취약점은 발견되지 않는다. `serviceType` 파라미터는 엄격 동등 비교로 처리되고, 카탈로그 데이터는 정적 컴파일 타임 값이며, 프론트엔드 라벨 lookup은 prefix 검사 후 React 자동 이스케이핑 내에서 렌더된다. 기존에 있던 `previewTest` 에러 메시지의 사용자 입력 포함 패턴은 이번 변경과 무관한 기존 코드이므로 INFO로만 기록한다.

## 위험도

NONE
