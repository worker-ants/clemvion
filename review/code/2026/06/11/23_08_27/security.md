# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] 테스트 코드 내 하드코딩된 가짜 API 키 — 런타임 무해, 패턴 점검
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` (diff 라인 38, 53, 78, 97, 112) — `apiKey: 'encrypted'`, `getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted-key')`
- 상세: 테스트 픽스처 내 `'sk-decrypted-key'` 는 실제 키처럼 보이는 접두사(`sk-`)를 가지지만 값 자체는 명백히 가짜 문자열이다. `apiKey: 'encrypted'` 는 암호화된 상태를 표현하는 더미다. 모두 테스트 전용 mock 이며 실제 외부 API 에 사용되지 않는다. VCS 커밋에 포함돼도 비밀 정보 누출이 아니다.
- 제안: 현 상태 유지 가능. 강화하고 싶다면 `'sk-test-only'` 처럼 접두사를 더 명확히 하거나 환경 변수 mock 패턴을 따를 수 있으나 필수 아님.

### [INFO] `testConnection` 응답에 `dimension` 필드 노출 — 정보 노출 관점
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` (diff 라인 160-167), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (diff 라인 205-210)
- 상세: `testConnection` 성공 시 `dimension?: number` 가 응답에 포함된다. 이 값은 임베딩 모델이 생성하는 벡터 차원(예: 1536)으로, 공개된 모델 스펙 정보이며 민감한 비즈니스 데이터가 아니다. 외부 공격자가 이 값을 통해 내부 인프라를 역추론하거나 악용할 시나리오는 없다.
- 제안: 보안 조치 불필요. 단, 응답 DTO 에 향후 민감 필드가 추가될 경우 `@Exclude()` 혹은 직렬화 그룹을 활용하는 관례를 유지할 것.

### [INFO] `client.embed(['connection test'], config.defaultModel)` — 입력 검증 관점
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` (diff 라인 162-163)
- 상세: probe 입력 텍스트가 리터럴 `['connection test']` 로 하드코딩되어 있어 사용자 입력이 임베딩 API 로 전달되지 않는다. `config.defaultModel` 은 DB 에서 조회한 값이므로 SQL 인젝션 경로가 없고, 외부 API 호출 시 HTTP 라이브러리가 파라미터를 직렬화하므로 커맨드 인젝션 위험도 없다. probe 자체가 고정 리터럴로 동작하므로 XSS·인젝션 공격 표면이 없다.
- 제안: 이상 없음.

### [INFO] `kind` 기반 분기 — 권한 우회 가능성 점검
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` (diff 라인 160-168)
- 상세: `findEntity(configId, workspaceId)` 호출이 워크스페이스 ID 를 파라미터로 포함하므로 타 워크스페이스 설정에 대한 종단 간 격리는 서비스 레이어 외부(컨트롤러에서 workspaceId 바인딩)에서 이미 보장된다. 이번 변경에서 `kind=chat` 고정 필터를 제거했지만, 이는 필터 강화가 아니라 kind 무관 조회를 허용하는 것이므로 기존에 조회 가능했던 chat 설정 외에 동일 워크스페이스의 embedding/rerank 설정을 추가로 조회할 수 있게 됐다. 워크스페이스 내 권한 경계는 `findEntity` 가 workspaceId 로 소유권을 검증하는 방식이 그대로 유지되고 있어 타 워크스페이스 접근은 불가하다.
- 제안: `findEntity` 구현이 workspaceId 매개변수를 WHERE 조건에 강제로 포함하는지 확인하는 것을 권장한다(기존 구현 점검, 이번 diff 범위 외). 현재 변경 자체는 추가 취약점을 도입하지 않는다.

### [INFO] 에러 처리 — 민감 정보 노출 점검
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` (기존 catch 블록, diff 라인 172 범위)
- 상세: diff 에 포함된 테스트에서 `mockClient.embed.mockRejectedValue(new Error('401 Unauthorized'))` 에러가 던져질 때 `'Authentication failed. Please check your API key.'` 라는 새니타이징된 메시지를 반환하는 동작이 검증된다. 원래 에러 메시지(예: provider 가 반환한 상세 오류, 내부 스택 트레이스)가 클라이언트에 직접 노출되지 않도록 기존 에러 처리 로직이 작동하고 있음을 테스트가 확인해준다.
- 제안: 이상 없음. 새니타이징 동작이 테스트로 검증되는 것은 보안 관점에서 긍정적이다.

### [INFO] 프론트엔드 자동 저장(`PATCH /model-configs/:id`) — CSRF/인가 관점
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` (diff 라인 435-443)
- 상세: 연결 테스트 성공 시 `modelConfigsApi.update(config.id, { dimension: dim })` 를 호출한다. 이 PATCH 는 기존 `apiClient` 를 통해 발행되므로 쿠키/세션 기반 인증 헤더가 동일하게 적용된다. 별도 CSRF 토큰 처리가 프레임워크(Next.js) 레벨에서 이뤄진다면 추가 위험은 없다. `config.id` 는 이미 인가된 설정 목록에서 가져온 값이므로 타 사용자의 리소스에 대한 간접 접근 경로도 없다.
- 제안: CSRF 보호가 `apiClient` 레벨에서 처리되는지 기존 구현을 참조 확인하는 것을 권장(이번 diff 범위 외). 현재 변경 자체는 추가 취약점을 도입하지 않는다.

### [INFO] i18n 문자열 — XSS 관점
- 위치: `codebase/frontend/src/lib/i18n/dict/en/models.ts`, `codebase/frontend/src/lib/i18n/dict/ko/models.ts` (diff)
- 상세: `connectionSucceededDim: "Connected · detected dimension {{dimension}}."` — `{{dimension}}` 보간 값은 `result.dimension`(서버 응답의 `number` 타입)이다. 숫자 값을 문자열 보간하므로 HTML 인젝션/XSS 위험이 없다. React 의 JSX 자동 이스케이프도 적용된다.
- 제안: 이상 없음.

## 요약

이번 변경은 embedding 설정의 연결 테스트 회귀 수정 및 차원 자동 감지 기능 추가에 집중된 버그픽스/기능 확장이다. 보안 관점에서 중요한 취약점은 발견되지 않는다. 테스트 픽스처 내 `'sk-decrypted-key'`는 명백한 가짜 값이고, probe 입력은 하드코딩 리터럴이어서 인젝션 표면이 없다. `findEntity` 에 `workspaceId` 격리가 유지되고 있으며, 에러 메시지 새니타이징이 테스트로 검증된다. `dimension`은 공개 모델 스펙 정보로 민감 정보가 아니다. 기존 인증 인프라(`apiClient`, 컨트롤러 가드)를 그대로 재사용하므로 인증·인가 계층에 변경이 없다. 종합적으로 이번 diff 는 보안 위험을 신규 도입하지 않으며, 기존 보안 통제가 충분히 작동하고 있다고 판단된다.

## 위험도

NONE

STATUS: SUCCESS
