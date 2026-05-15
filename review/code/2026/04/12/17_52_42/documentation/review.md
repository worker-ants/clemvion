### 발견사항

---

**[WARNING] 신규 환경 변수 문서화 누락**
- 위치: `integration-oauth.service.ts` (전체), `README.md` / `.env.example`
- 상세: OAuth 흐름에서 `SLACK_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL` 환경변수를 참조하지만, 어떤 문서에도 이 변수들이 설명되어 있지 않음. 테스트 코드(`integration-oauth.service.spec.ts`)에서 `delete process.env.SLACK_CLIENT_ID`로 조작하고 있어 런타임 동작이 환경변수에 크게 의존함을 알 수 있음.
- 제안: `README.md` 또는 `.env.example`에 아래 항목 추가 필요:
  ```
  SLACK_CLIENT_ID=
  SLACK_CLIENT_SECRET=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  APP_URL=http://localhost:3011
  ```

---

**[WARNING] OAuth 토큰 교환 스텁(stub) 미문서화**
- 위치: `integration-oauth.service.ts:144–160`
- 상세: `handleCallback`의 토큰 교환 로직은 실제 HTTP 요청 없이 `stub-` 접두사 토큰을 생성하는 임시 구현임. 주석(`// Phase C: token exchange is stubbed`)이 있지만, 이 스텁이 언제 실제 구현으로 대체될지, 어떤 작업 항목과 연결되는지 명시되지 않음.
- 제안: 주석에 TODO 이슈 번호 또는 스펙 참조를 추가:
  ```ts
  // TODO: Replace with real token exchange per provider.
  // See spec/2-navigation/4-integration.md §10 and execution-engine OAuth work.
  ```

---

**[WARNING] `service-registry.ts` 공개 API 문서 불충분**
- 위치: `service-registry.ts` — `maskCredentials`, `validateCredentials`, `listSecretKeys`
- 상세: 파일 상단에 모듈 설명 주석이 있으나(`@file` 레벨), 각 export 함수에 JSDoc이 없음. 특히 `validateCredentials`는 반환값이 `string[]`(에러 메시지 배열)이고, 빈 배열이 "유효"를 의미하는 컨벤션이 함수 시그니처만으로는 불명확함.
- 제안:
  ```ts
  /**
   * Validate credentials payload against the service+variant schema.
   * @returns Array of human-readable error messages. Empty array means valid.
   */
  export function validateCredentials(...): string[] {
  ```

---

**[WARNING] `renderCallbackHtml` 함수 인라인 문서 부재**
- 위치: `integrations.controller.ts:229–277`
- 상세: OAuth 콜백 팝업용 HTML을 생성하는 함수가 컨트롤러 파일 하단에 모듈-레벨 함수로 선언되어 있음. `window.opener.postMessage`를 통해 부모 창과 통신하는 보안-민감 패턴이지만, 보안 고려사항(`origin` 검증, XSS 방지용 `\\u003c` 이스케이프 등)에 대한 주석이 없음.
- 제안:
  ```ts
  /**
   * Renders a minimal HTML page that forwards the OAuth result to the opener
   * via postMessage (same-origin) and then closes itself.
   * `<` is escaped to \u003c to prevent XSS in JSON-in-script context.
   */
  ```

---

**[INFO] `ActivityQueryDto`의 `limit`/`days` 타입이 문자열인 이유 미문서화**
- 위치: `integration.dto.ts:111–119`
- 상세: `limit`와 `days`가 `@IsString()`으로 선언되어 있고, 컨트롤러에서 `Number()` 변환을 수동으로 수행함. 이는 쿼리 파라미터가 항상 문자열로 수신된다는 NestJS 특성 때문이지만, DTO 자체에는 이 이유가 설명되어 있지 않아 다음 개발자가 혼동할 수 있음.
- 제안: DTO 클래스 또는 각 프로퍼티에 주석 추가:
  ```ts
  // Query params arrive as strings; controller converts to number.
  @IsOptional()
  @IsString()
  limit?: string;
  ```

---

**[INFO] 마이그레이션 파일 스펙 참조 방식 일관성**
- 위치: `V008__integration_usage_log_and_metadata.sql:1–2`, `V009__integration_oauth_and_expiry.sql:1–2`
- 상세: 두 마이그레이션 파일 모두 파일 상단에 스펙 문서 참조가 포함되어 있어 긍정적임. 다만 V008은 `§13, §2.10, §2.10.1`을, V009는 `§10, §11`을 참조하는데, 스펙 파일 내 섹션 번호가 실제로 존재하는지 별도 확인이 필요함.
- 제안: 현재 수준으로 유지하되, 스펙 문서의 섹션 번호가 변경될 경우 마이그레이션 주석도 함께 갱신하는 관례를 팀 내 공유 권장.

---

**[INFO] 프론트엔드 `_shared/` 컴포넌트 사용법 예제 없음**
- 위치: `_shared/credentials-form.tsx`, `_shared/service-picker-modal.tsx`, `_shared/status-badge.tsx`
- 상세: 재사용 가능한 공유 컴포넌트들이지만 Props 인터페이스 외 사용 예시나 JSDoc이 없음. `secretsMasked` prop 동작 등 미묘한 UX 동작이 코드 없이는 이해하기 어려움.
- 제안: 최소한 `CredentialsForm`의 `secretsMasked` prop에 설명 추가:
  ```ts
  /** When true, secret fields show placeholder "Leave blank to keep existing"
   *  instead of the masked value, for edit/rotate flows. */
  secretsMasked?: boolean;
  ```

---

### 요약

이번 변경은 Integration 모듈을 OAuth 지원, 만료 스캐너, 사용 로그 등 대규모 기능으로 확장하는 작업으로, 코드 내 핵심 설계 의도를 설명하는 주석(마이그레이션 스펙 참조, OAuth 스텁 설명 등)이 부분적으로 포함되어 있어 기본적인 문서화 노력은 있음. 그러나 신규 OAuth 환경변수(`SLACK_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL`)가 README나 `.env.example`에 전혀 문서화되어 있지 않아 새 개발자가 로컬 환경을 구성할 때 어려움을 겪을 수 있으며, OAuth 토큰 교환의 스텁 상태가 프로덕션 준비 여부를 모호하게 만드는 주요 문제점으로 식별됨.

### 위험도

**MEDIUM** — 기능 동작에는 영향 없으나, 환경변수 문서 누락으로 인한 온보딩 및 배포 이슈가 발생할 수 있음.