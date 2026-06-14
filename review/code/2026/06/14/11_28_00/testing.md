# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] 서비스 spec 테스트 — CRUD audit describe 에 배치된 비-audit 테스트들
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 356–431 (전체 파일 기준)
- 상세: 새로 추가된 4개의 `update` 테스트 (`update config: 비-비밀 키만 shallow-merge`, `update config: 역류한 마스킹 비밀값은 무시`, `update: config 미전달 시 기존 config 불변`, `update: ipWhitelist=[] 은 전체 비움`)가 `describe('CRUD audit 기록')` 블록 내부에 배치되어 있다. 이 테스트들은 감사 로그 검증이 아니라 update 시의 merge 동작을 검증하므로 별도 `describe('update — shallow-merge·비밀값 보호')` 블록에 두었어야 한다. diff 에 추가된 4개(라인 35–111)는 `describe('CRUD audit 기록')` 외부(올바른 위치)에도 동일 내용이 복제되어 있어서 현재 파일에는 동일 테스트가 두 번 존재한다.
- 제안: diff 에서 추가된 4개 테스트(라인 35–111)는 실제 파일의 동일 본문(356–431)과 중복이므로, 하나를 제거하거나 audit describe 블록 외부에 독립 describe 로 이동한다.

### [WARNING] 마스킹 패턴 픽스처의 하드코딩으로 인한 취약한 마스킹 감지 로직 검증
- 위치: `auth-configs.service.spec.ts` — `update config: 역류한 마스킹 비밀값은 무시` 테스트 (라인 53–74)
- 상세: 테스트는 마스킹된 키를 `` `wfk_***${originalKey.slice(-4)}` `` 로 직접 조립한다. 서비스의 `update` 로직은 `SECRET_CONFIG_KEYS.has(k)` 로 키 이름만 필터링하므로, 실제로는 마스킹 패턴 감지가 아니라 "key 필드 이름이 블랙리스트에 있으면 무시"이다. 테스트 명은 "마스킹값은 무시"이나 실제 검증은 "secret 키 이름은 항상 무시"이며, 비-마스킹 값(예: `key: 'plaintext-new-key'`)을 보내도 동일하게 무시된다. 이 차이가 테스트 명에서 오해를 유발한다.
- 제안: 테스트 명을 "secret 키 이름(key/token/secret/password)은 update 로 변경 불가"로 수정하거나, 두 번째 케이스로 실제 평문 값을 보내도 무시됨을 검증하는 케이스를 추가한다.

### [WARNING] formStateFromAuthConfig — bearer_token 타입에 대한 테스트 미존재
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-form.test.ts` — `describe("formStateFromAuthConfig")`
- 상세: `formStateFromAuthConfig` 는 `api_key`, `hmac`, `basic_auth` 에 대한 수화(hydrate) 케이스가 있으나 `bearer_token` 타입은 명시적으로 테스트되지 않는다. `bearer_token` 의 경우 `config` 에 편집 가능한 필드가 없어 단순하지만, 함수가 타입에 따른 분기를 포함하지 않음을 명시적으로 확인하는 케이스가 있으면 회귀 방어에 도움이 된다.
- 제안: `formStateFromAuthConfig({ name: "B", type: "bearer_token" })` 케이스를 추가해 기본값 반환을 확인한다.

### [INFO] buildAuthConfigUpdatePayload — basic_auth 에서 username 빈 문자열 trim 동작 테스트 미존재
- 위치: `auth-config-form.test.ts` — `describe("buildAuthConfigUpdatePayload")`
- 상세: `buildAuthConfigUpdatePayload` 의 `basic_auth` 케이스는 `username: " u "` (공백 포함)로 trim 동작만 테스트한다. `username` 이 빈 문자열이나 공백만인 경우 `config.username = ""` 로 설정되는 엣지 케이스가 테스트되지 않는다. 이 경우 백엔드 shallow-merge 에서 `username: ""` 이 빈값으로 덮어쓰이는지 여부가 애매하다.
- 제안: `username: "  "` 입력 시 `config.username` 이 `""` 임을 명시적으로 검증하는 케이스 추가.

### [INFO] authentication-form 통합 테스트 — validation 실패 시 edit 모드 토스트 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` — `describe("AuthenticationPage — edit form §A.2")`
- 상세: edit 모드에서 잘못된 IP 항목이나 잘못된 헤더 이름 입력 시 validation 에러가 toast.error 로 표시되어야 하는데, 이 경로에 대한 테스트가 없다. create 폼에는 `"blocks submission and shows an error when the IP whitelist has an invalid entry"` 케이스가 있으나 edit 폼에는 상응하는 케이스가 없다.
- 제안: edit 모드에서 잘못된 IP로 Save 클릭 시 `patchMock` 미호출 + `toastError` 호출 케이스 추가.

### [INFO] authentication-form 통합 테스트 — edit 모드 name 빈값 필수 검증 미포함
- 위치: `authentication-form.test.tsx` — `describe("AuthenticationPage — edit form §A.2")`
- 상세: `handleUpdate` 에는 `formName.trim()` 이 비어있으면 toast.error 를 발생시키는 가드가 있다. 이 경로에 대한 테스트가 없다.
- 제안: edit 모드에서 name 을 지우고 Save 클릭 시 patchMock 미호출 + toastError 호출을 검증하는 케이스 추가.

### [INFO] formStateFromAuthConfig — config 가 null 인 경우 기본값 폴백 테스트 존재하나 undefined 케이스 미포함
- 위치: `auth-config-form.test.ts` — `describe("formStateFromAuthConfig")`
- 상세: `{ name: "Min", type: "api_key" }` (config 프로퍼티 자체 미포함)로 기본값 폴백 테스트가 있다. `config: null` 명시 케이스는 함수 시그니처(`config?: ... | null`)가 허용하나 테스트에서 다루지 않는다. 실제 API 응답에서 `null` 이 오는 경우가 있을 수 있다.
- 제안: `{ name: "N", type: "api_key", config: null }` 케이스를 추가해 null 처리 확인.

### [INFO] 컨트롤러 스펙 — update 핸들러의 @Roles 데코레이터 존재 검증은 있으나 업데이트된 서비스 호출 시그니처 변경 영향 없음 확인 완료
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`
- 상세: 컨트롤러 스펙의 `update → service.update(id, workspaceId, body, userId, req.ip)` 테스트는 서비스 변경과 무관하게 인터페이스 수준에서 유효하다. 서비스 내부의 shallow-merge 변경은 컨트롤러 스펙의 mock 을 통과하므로 회귀 위험 없음.

### [INFO] DTO 변경 — class-validator 검증 테스트 미존재
- 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`
- 상세: `UpdateAuthConfigDto` 는 `@ApiPropertyOptional` 설명만 변경되었으며 `class-validator` 데코레이터에 변경 없음. 별도 DTO 단위 테스트는 없으나 컨트롤러 통합 경로에서 간접 커버. 문서 변경이므로 테스트 추가 불필요.

## 요약

이번 변경에서 핵심 기능(서비스 update shallow-merge, 프런트 buildAuthConfigUpdatePayload/formStateFromAuthConfig, 편집 폼 통합)에 대한 테스트가 고르게 추가되어 있으며, 백엔드의 in-memory repo mock 설계와 프런트의 순수 함수 분리가 테스트 용이성을 잘 지원한다. 주요 시나리오(비밀값 보호, ipWhitelist 빈 배열 전달, 마스킹된 값 역류 무시, 폼 수화, 편집 PATCH 페이로드 구성)는 모두 커버된다. 단, 서비스 스펙에서 4개 테스트가 audit describe 블록 내부와 외부 양쪽에 중복 배치된 문제(diff 와 전체 파일 비교 시 확인)와, 마스킹 감지 로직 설명과 실제 구현의 의미론적 괴리가 있다. 또한 edit 모드의 validation 실패 경로(잘못된 IP, 빈 name)에 대한 통합 테스트가 누락되어 있어 보완이 필요하다.

## 위험도

LOW
