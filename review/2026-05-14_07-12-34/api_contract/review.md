### 발견사항

- **[WARNING]** `CandidateEntry` 응답 형식 변경 — `sublabel` 필드 추가
  - 위치: `candidate-lookup.service.ts` L167, `candidate-lookup.service.spec.ts` L181
  - 상세: `lookupMcpServers`가 반환하는 `CandidateEntry` 객체에 `sublabel: i.serviceType`이 추가됐다. 이 내부 API를 소비하는 AI Agent 워크플로 어시스턴트 클라이언트가 `{ id, label }` 두 필드만 가정하고 있다면, 타입 체크 또는 destructuring에서 불일치가 발생할 수 있다.
  - 제안: `CandidateEntry` 인터페이스에 `sublabel?: string`을 명시적으로 추가하고, 이 타입을 소비하는 모든 클라이언트(프론트엔드 `IntegrationSelector`)가 해당 필드를 받아도 안전한지 확인.

- **[WARNING]** Cafe24 리소스 목록 백엔드·프론트엔드 이중 정의
  - 위치: `integration-configs.tsx` L248–266, `metadata/types.ts` `CAFE24_RESOURCES`
  - 상세: 18개 리소스 목록이 백엔드(`types.ts`)와 프론트엔드 설정 패널(`integration-configs.tsx`)에 각각 하드코딩됐다. 백엔드에 리소스가 추가될 때 프론트엔드를 수동으로 동기화해야 한다. 현재 순서도 미세하게 다르다(백엔드 `CAFE24_RESOURCES` 순서와 프론트엔드 `CAFE24_RESOURCES` 순서 비교 시).
  - 제안: 백엔드 메타데이터 엔드포인트(예: `GET /integrations/cafe24/metadata`)를 추가하거나 공유 패키지로 추출해 단일 진실을 유지.

- **[WARNING]** `OAuthBeginDto`에 Cafe24 조건부 필수 필드가 `@IsOptional()`로만 선언됨
  - 위치: `integration.dto.ts` L239–303
  - 상세: `mallId`는 `service === 'cafe24'`일 때 실질적으로 필수지만 DTO 레벨에서 `@IsOptional()`로 선언돼 있다. 검증은 서비스 레이어(`integration-oauth.service.ts`)에서 수행하므로 작동은 하지만, DTO가 `BadRequestException` 대신 422 Unprocessable Entity가 아닌 같은 코드를 내려 클라이언트 입장에서 실패 경로 구분이 모호하다.
  - 제안: `@ValidateIf((o) => o.service === 'cafe24')` + `@IsNotEmpty()`를 조합해 Cafe24 한정 필수 필드를 DTO 레벨에서 명시.

- **[INFO]** `@MinLength(3)/@MaxLength(50)`과 `@Matches(/^[a-z0-9-]{3,50}$/)` 중복 선언
  - 위치: `integration.dto.ts` L255–262
  - 상세: 정규식이 이미 길이를 3–50으로 제한하므로 `@MinLength`/`@MaxLength`는 불필요하다. 오류 메시지가 두 벌 발생할 수 있다.
  - 제안: `@MinLength`/`@MaxLength` 제거, `@Matches` 하나만 유지.

- **[INFO]** 프론트엔드 유효성 검증 정규식 백엔드와 별도 관리
  - 위치: `new/page.tsx` L232
  - 상세: `/^[a-z0-9-]{3,50}$/` 정규식이 DTO와 프론트엔드에 각각 하드코딩됐다. 현재는 일치하지만 백엔드 변경 시 프론트엔드는 자동으로 갱신되지 않는다.
  - 제안: 공유 상수(모노레포 `shared/` 패키지 또는 API 스키마 생성)로 추출.

- **[INFO]** `OAuthBeginDto` fat DTO 패턴 — 공급자별 필드 혼재
  - 위치: `integration.dto.ts` L237–303
  - 상세: 현재는 Cafe24 4개 필드지만, 이후 Shopify·Naver 등이 추가되면 DTO가 지속적으로 비대해진다. `providerConfig?: Record<string, unknown>` 하나로 묶고 각 공급자 스키마로 내부 검증하는 방식이 더 확장성이 높다.
  - 제안: 단기적으로는 현행 유지 가능, 세 번째 공급자 추가 전에 리팩토링 고려.

---

### 요약

이번 변경은 Cafe24 OAuth 흐름, 노드 실행, MCP Internal Bridge를 추가하는 대규모 신규 기능이다. 기존 API 계약(Google/GitHub OAuth begin, 통합 목록, MCP 서버 목록)은 모두 선택적 필드 추가와 nullable 컬럼 확장으로만 변경돼 하위 호환성이 유지된다. 주요 우려 사항은 `CandidateEntry`에 `sublabel` 필드가 추가되면서 내부 API 형식이 바뀐 점, 18개 리소스 목록이 백엔드·프론트엔드에 이중으로 정의된 점, Cafe24 필수 파라미터가 DTO 레벨에서 명시적으로 강제되지 않는 점이다. 세 가지 모두 런타임 장애보다는 유지보수 부채에 해당하며, 즉각적인 breaking change는 없다.

### 위험도
**LOW**