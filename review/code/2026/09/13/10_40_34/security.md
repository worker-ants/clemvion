# 보안(Security) 코드 리뷰

## 검토 범위와 방법

56개 변경 파일(`git diff origin/main...HEAD --stat` 로 실측) 중 실제 프로덕션 코드/런타임 표면에
영향을 주는 파일은 소수다 — 나머지는 `CHANGELOG.md`, 유저 가이드 MDX, `plan/**`, 그리고 이전
`/ai-review`·`/consistency-check` 세션의 산출물(`review/code/2026/09/13/10_12_19/**`,
`review/consistency/2026/09/13/{01_15_40,10_12_54}/**`)이 그대로 새 파일로 커밋되는 것이다.

프롬프트가 크기 제한으로 절단한 파일은 저장소 원본을 직접 `Read`/`Bash cat`으로 열어 확인했다:

- `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` (전체, diff 밖 — 이번 변경의
  보안 전제)
- `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 전후 문맥)
- `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (신규 HTTP 왕복 테스트
  전문 — mock 시크릿 리터럴 확인)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (전문 — 정규식 ReDoS 형태
  점검)
- `codebase/frontend/src/components/models/model-config-manager.tsx` (`toast.error` 호출부 —
  XSS 표면 확인)
- `codebase/backend/src/modules/integrations/integrations.service.ts` (`code:` 리터럴 전수 —
  민감정보 유출 여부)

저장소 파일은 뮤테이션하지 않았다(읽기 전용 확인만 수행, `git status --short` 로 청결 확인
불필요 — 애초에 아무것도 쓰지 않음).

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 수준의 보안 결함은 발견되지 않았다.

- **[INFO]** `LlmService.testConnection` 실패 응답 필드명 정정(`error`→`message`)으로 **종전엔
  화면에 전혀 도달하지 않던 사유 문장이 처음으로 사용자에게 노출**된다 — 정보 유출 경로가
  새로 열리지 않았음을 직접 확인
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:352-354` (`testConnection` catch
    블록)
  - 상세: `sanitizeLlmErrorMessage`(`codebase/backend/src/modules/llm/utils/sanitize-error.util.ts`,
    diff 밖)를 전문 확인한 결과, provider 원본 에러 문자열을 그대로 반환하는 경로가 없다 —
    `401/403/404/429/timeout/ECONNREFUSED/ENOTFOUND` 8가지 패턴 매치 후 **고정 문구**만
    반환하고, 매치 실패 시에도 고정 폴백 문구("Connection test failed. Please check your
    configuration.")로 수렴한다. 즉 API 키 조각·내부 엔드포인트·스택트레이스가 이 경로로 새로
    노출될 여지가 없다. CHANGELOG/plan 의 "provider 원문은 싣지 않는다" 주장이 실측과 일치한다.
  - 제안: 없음(확인용 기록). 향후 이 함수에 매치 패턴을 추가할 때, 그 분기가 실수로 `message`
    (원본)를 그대로 반환하지 않는지 계속 확인할 것.

- **[INFO]** `this.logger.warn(...)` 이 sanitize 되지 않은 원본 에러 메시지를 서버 로그에 남기지만
  이 줄은 diff 문맥(unchanged)이며 workspace 사용자에게 노출되는 경로로 재전파되지 않음을 확인
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:353`
  - 상세: `testConnection` 은 `LlmUsageLogService.record(...)` 를 호출하지 않는다 — grep 으로
    확인한 결과 그 호출은 이 파일의 다른 메서드(`chat`/`stream` 경로)에만 있다. 저장소의 기존
    SSRF 관련 원칙("서버 로그에만 원본 상세, workspace 가시 로그에는 일반화된 문구")과 충돌하지
    않는다. 새 결함 아님.
  - 제안: 없음.

- **[INFO]** 신규 build-time 가드(`guide-error-code-scan.ts`)의 정규식은 저장소 내부 소스만
  스캔하는 비-공격 표면 도구 — ReDoS 형태 아님을 직접 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:52-97`
    (`UPPER_SNAKE`·`FIELD_TABLE_NAME`·`CODE_FIELD`·`PROSE_BACKTICK`·`CODE_CONTEXT`·
    `TABLE_HEADER_WITH_CODE`)
  - 상세: 전문을 읽고 중첩 무제한 정량자가 겹치는 catastrophic backtracking 형태가 없음을
    확인했다. `TABLE_HEADER_WITH_CODE` 의 `(?:[^|]*\|)*?` 도 반복마다 최소 1개의 `|` 를 소비해
    줄 내 `|` 개수로 유계다. 입력은 `codebase/backend/src`·`codebase/packages` 의 고정 소스
    코퍼스이며 공격자가 통제할 수 있는 값이 아니므로(build-time CI 전용) 설령 이차 시간이라도
    공격 표면이 되지 않는다.
  - 제안: 없음.

- **[INFO]** `llm-model-config.controller.spec.ts` 의 mock 리터럴(`apiKey: 'encrypted'`,
  `getDecryptedApiKey → 'sk-decrypted'`)은 형식·문맥상 명백한 테스트 픽스처이며 실제 시크릿
  하드코딩이 아님
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`ModelConfigService` mock provider 블록)
  - 상세: `'encrypted'`/`'sk-decrypted'` 는 실재 프로바이더 형식(`sk-` 접두 + 랜덤 문자열)과
    다른 플레이스홀더 문자열이고, 이 파일이 mock 하는 대상(`ModelConfigService.findEntity`/
    `getDecryptedApiKey`) 자체가 테스트 더블이라 프로덕션 자격증명과 무관하다.
  - 제안: 없음.

- **[INFO]** `POST /model-configs/:id/test` 의 `@Roles('editor')` 인가 메타데이터가 이번 변경
  전후로 그대로 유지됨을 확인 — 응답 필드명 변경이 인가 경계에 영향을 주지 않음
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`"testConnection method has 'editor' role metadata"` 테스트, 기존 테스트 — 이번 diff 로
    새로 추가된 것 아님) · 실제 컨트롤러 데코레이터는 diff 밖(unchanged)
  - 상세: 이번 diff 는 컨트롤러 라우트·가드 데코레이터를 전혀 건드리지 않고 서비스 반환 필드명
    과 DTO 선언만 바꿨다. 새로 추가된 HTTP 왕복 테스트도 `X-Workspace-Id` 헤더 요구 등 기존
    인가/필수 헤더 경로를 우회하지 않는다.
  - 제안: 없음.

- **[INFO]** `TestConnectionResultDto` 에 새로 선언된 `code` 필드가 노출하는 값은 고정
  분류 코드일 뿐 민감정보가 아님
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (게이트 464-479행, `code?: string`)
  - 상세: `integrations.service.ts` 전수 확인 결과 이 필드에 실제로 실리는 값은
    `INTEGRATION_CREDENTIALS_UNREADABLE`·`INTEGRATION_INVALID_CREDENTIALS`·
    `EMAIL_CONNECT_FAILED`·`MCP_CONNECT_FAILED` 류의 고정 분류 문자열뿐이며, 자격증명 원문·
    내부 경로·스택트레이스가 이 필드로 전파되는 경로는 없다.
  - 제안: 없음.

- **[INFO]** `toast.error(t("models.connectionFailed", { error: result.message ?? "" }))` —
  서버가 내려주는 `message` 는 8갈래 고정 문자열이라 클라이언트 렌더링 시 XSS 표면이 되지 않음
  - 위치: `codebase/frontend/src/components/models/model-config-manager.tsx:82-83`
  - 상세: `result.message` 는 `sanitizeLlmErrorMessage` 의 8가지 고정 영문 문장 중 하나이거나
    `undefined` 이며 provider 임의 문자열이 아니다(위 확인 참조). `sonner` 의 `toast.error` 는
    기본적으로 텍스트를 그대로 렌더링하고 `dangerouslySetInnerHTML` 등 HTML 삽입 경로를 쓰지
    않으므로, 설령 향후 이 문자열 집합이 넓어지더라도 이 자리 자체는 스크립트 실행 벡터가
    아니다.
  - 제안: 없음.

- **[INFO]** DTO 필드 제거(`latencyMs`) — 생산자 0건 실측 재확인, 정보 노출 축소 방향이라
  보안 리스크 없음
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:50-58`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-465`
  - 상세: OpenAPI 선언에서 필드를 빼는 것은 인터페이스 축소이며 실제 응답 바디에는 원래도
    실리지 않던 값이라 보안 관점에서 새로운 노출·차단 표면이 생기지 않는다.
  - 제안: 없음.

- **[INFO]** `package.json`/lockfile 변경 없음 — 신규 외부 의존성 도입 0건
  - 위치: 저장소 루트(`git diff origin/main...HEAD --stat` 재확인)
  - 상세: 새로 추가된 TS 파일이 import 하는 심볼(`supertest`, `assertMatchesContract`/
    `contractForDto`, `walkTree`/`repoRoot`)은 전부 기존에 이미 설치·존재하는 패키지/내부
    모듈의 재사용이다. `guide-error-code-scan.ts` 는 외부 의존성 0.
  - 제안: 없음.

## 요약

이번 배치의 실질 보안 관련 표면은 `POST /api/model-configs/:id/test` 실패 응답 필드명 정정
(`error`→`message`)으로 "종전엔 화면에 도달하지 않던 에러 사유가 처음 사용자에게 노출된다"는
동작 변화 하나다. 그 사유 문장을 만드는 `sanitizeLlmErrorMessage` 를 직접 열어 확인한 결과
provider 원문을 그대로 반환하는 경로가 없는 8갈래 고정 문구 매핑이라 API 키 조각이나 내부
엔드포인트가 새로 유출되지 않는다. 인젝션·인증/인가 우회·하드코딩된 실제 시크릿·안전하지
않은 암호화·평문 전송에 해당하는 변경은 이번 diff 어디에도 없으며, 컨트롤러의 `@Roles` 인가
메타데이터도 변경 전후로 동일하게 유지된다. 신규 build-time 가드(`guide-error-code-scan.ts`)는
저장소 내부 고정 소스만 훑는 read-only 정적 분석 도구라 ReDoS·경로 탐색 등 공격 표면이 되지
않는다. `package.json`/lockfile 변경이 없어 의존성 축의 리스크도 없다. 전반적으로 이번 변경은
보안 관점에서 안전하다.

## 위험도

NONE
