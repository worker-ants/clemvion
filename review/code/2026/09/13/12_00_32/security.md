# 보안(Security) 코드 리뷰

## 검토 범위

`guide-error-code-truth` 배치(28개 실질 변경 파일 + 이전 라운드 리뷰/컨시스턴시 산출물). 코드
영향 파일은 다음과 같다:

- `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection` 실패 응답 필드명
  `error` → `message` 리네임 (반환 값은 여전히 `sanitizeLlmErrorMessage` 의 결과물)
- `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`,
  `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` —
  생산자 0건이던 `latencyMs`/`meta` 필드 제거, 이미 실제로 나가고 있던 `code?: string` 필드 선언 추가
- `codebase/backend/src/modules/llm/llm.service.spec.ts`,
  `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`,
  `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `error`→`message`
  단언 갱신 + `assertMatchesContract` 값-대-선언 계약 검증 배선(신규 HTTP 왕복 테스트 포함)
- `codebase/frontend/src/lib/api/model-configs.ts`,
  `.../__tests__/model-configs.test.ts`,
  `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` — 프런트
  API 클라이언트 타입·픽스처 정정, 실패 토스트 회귀 테스트 신설
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`(신규),
  `.../guide-error-code-existence.test.ts`(신규),
  `.../guide-sanitized-message-parity.test.ts`(신규) — 저장소 내부 소스(`codebase/backend/src`,
  `codebase/packages`)와 MDX 코퍼스만을 `fs.readFileSync` 로 읽는 build-time 정적 텍스트 스캐너·
  vitest 스위트
- 유저 가이드 MDX 6종 — 에러 코드 표 정정(지어낸/은퇴/로드맵 이름 제거, 실재 코드로 교체)
- `CHANGELOG.md`, `PROJECT.md`, `plan/**`, `review/**` — 문서·트래커, 이전 리뷰 라운드 산출물

## 발견사항

CRITICAL/WARNING 수준의 보안 결함을 발견하지 못했다.

- **[INFO]** `testConnection` 실패 사유가 이번 변경으로 처음 화면에 도달하게 되지만, 노출 문자열은
  provider 원문이 아니라 8갈래 고정 문구다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` catch 블록,
    `return { success: false, message: sanitizeLlmErrorMessage(message) }`), 정규화 로직은
    `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` (diff 밖, 이번 변경으로
    수정되지 않음)
  - 상세: 종전엔 서비스가 `error` 필드로 사유를 실었는데 DTO·프런트엔드가 `message` 를 읽고
    있어 3층 필드명 불일치로 사유가 화면에 전혀 도달하지 않았다(토스트가 `"연결 실패: "` 로
    콜론 뒤가 비었다). 이번 rename 으로 그 사유가 처음 사용자에게 보이게 된다. `sanitize-error.util.ts`
    를 직접 열어 확인한 결과 `401/403/404/429/timeout/ECONNREFUSED/ENOTFOUND` 패턴에 매치되지
    않으면 provider 원문을 그대로 반환하는 경로가 없고, 매치 실패 시에도 범용 폴백 문장
    (`'Connection test failed. Please check your configuration.'`)으로 귀결된다. 즉 "이전엔
    도달하지 않던 채널이 열렸다" 는 사실은 있지만, 그 채널로 새로 흐르는 것이 provider API
    응답 본문·키 조각·내부 엔드포인트가 아니므로 정보 노출 취약점은 성립하지 않는다.
  - 제안: 없음(확인용). 향후 `sanitizeLlmErrorMessage` 에 새 패턴을 추가할 때 매치 실패
    분기가 여전히 고정 문구로만 귀결되는지, 특히 `message.includes()` 비교 대상이 provider
    원문의 부분 문자열을 그대로 되돌리는 방향으로 바뀌지 않는지 계속 확인할 것.

- **[INFO]** `LlmService.testConnection` 의 `this.logger.warn(...)` 은 sanitize 되지 않은 원본
  에러 메시지를 서버 로그에 남기지만, 이 줄은 이번 diff 의 변경 대상이 아니고(변경 없는 문맥
  줄) workspace 사용자에게 노출되는 로그로 재전파되지 않는다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection` catch 블록의
    `this.logger.warn(\`LLM connection test failed: ${message}\`)` 줄(diff 문맥, unchanged)
  - 상세: `testConnection` 메서드는 `LlmUsageLogService.record(...)` 를 호출하지 않는다(같은
    파일의 다른 메서드에만 그 호출이 있다). 서버 프로세스 로그에만 원본 상세가 남고, 사용자가
    보는 Activity/Usage 로그로는 전파되지 않으므로 저장소의 기존 SSRF 관련 로깅 원칙(서버 로그
    ≠ workspace 노출 로그)과 충돌하지 않는다. 이번 PR 이 만든 결함이 아니고 새로 악화되지도
    않았다.
  - 제안: 없음.

- **[INFO]** 신규 build-time 가드(`guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`)는
  저장소 내부 고정 소스(`codebase/backend/src`, `codebase/packages`, MDX 코퍼스)만 정규식으로
  스캔하는 순수 함수이며 외부/사용자 입력·네트워크·파일시스템 쓰기를 다루지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (`UPPER_SNAKE`,
    `FIELD_TABLE_NAME`, `CODE_FIELD`, `PROSE_BACKTICK`, `TABLE_HEADER_WITH_CODE`,
    `CODE_CONTEXT` 정규식 및 `scanErrorCodeCitations`/`collectBackendTokens`)
  - 상세: 각 정규식을 확인한 결과 중첩된 무제한 정량자가 겹치는 형태(catastrophic backtracking
    형태)가 없다. `TABLE_HEADER_WITH_CODE` 의 `(?:[^|]*\|)*?` 도 반복마다 최소 1개의 `|` 를
    소비해 줄 내 `|` 개수로 유계다. 설령 이차 시간이더라도 입력이 공격자가 통제하는 값이 아니라
    CI 실행 시점에 고정된 저장소 코퍼스이므로 ReDoS 공격 표면이 되지 않는다.
  - 제안: 없음.

- **[INFO]** `TestConnectionResultDto`/`ModelTestConnectionResultDto` 의 `code`/`message` 필드는
  민감정보를 담지 않는 분류 코드·정규화 문장이다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
    (`ModelTestConnectionResultDto`)
  - 상세: 신설된 `code?: string` 은 `MCP_*`/`EMAIL_CONNECT_FAILED`/`INTEGRATION_INCOMPLETE` 같은
    UPPER_SNAKE 분류 코드로, 이미 `integrations.service.ts` 가 실제로 내보내고 있던 값을 뒤늦게
    문서화한 것뿐이다(값 자체는 이번 diff 로 바뀌지 않는다). 제거된 `latencyMs`/`meta` 는
    애초에 생산자가 없어 응답에 실린 적이 없던 유령 필드였다. 과다 노출(over-exposure)이나
    새로운 정보 유출 표면이 아니다.
  - 제안: 없음.

- **[정보/오탐 아님]** 테스트 픽스처의 `apiKey: 'encrypted'`, `getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted')`
  는 형식·문맥상 명백한 mock 리터럴이며 실제 시크릿 하드코딩이 아니다
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`ModelConfigService` mock provider)
  - 상세: 실제 API 키 패턴(`sk-` 로 시작하는 실제 길이의 문자열 등)과 무관한 자리표시자이고,
    `.env`/설정 파일이 아닌 단위 테스트의 mock 반환값이다. 별도 CRITICAL/WARNING 항목으로
    등재하지 않는다.

- **인증/인가**: `llm-model-config.controller.spec.ts` 의 `@Roles` 메타데이터 단언
  (`previewModels`·`testConnection` = `editor`, `listModels` = 미지정/Viewer+)은 이번 diff 로
  값이 변경되지 않았고, 컨트롤러 자체(`llm-model-config.controller.ts`)도 이번 변경 대상이
  아니다. 응답 필드명 리네임·DTO 필드 정합화는 인가 경계와 무관하다.

- **인젝션/입력 검증**: 이번 변경 세트에 신규 SQL/커맨드/경로 조합 코드가 없다. 신규 가드는
  고정 디렉터리(`codebase/backend/src`, `codebase/packages`)만 순회하며 사용자 입력을 경로에
  섞지 않는다.

## 요약

이번 배치는 `POST /api/model-configs/:id/test`·`POST /api/integrations/:id/test` 두 엔드포인트의
응답 필드명/값-선언 불일치를 바로잡는 버그 수정(`error`→`message` rename, 생산자 0건 유령 필드
제거, 실제로 나가던 필드의 뒤늦은 선언), 유저 가이드의 지어낸/은퇴한/로드맵 전용 에러 코드 이름
정정, 그리고 그 정합성을 지키는 신규 build-time 정적 가드로 구성된다. 핵심 동작 변화는 "종전엔
화면에 도달하지 않던 실패 사유가 이제 도달한다"는 점인데, 그 사유를 만드는
`sanitizeLlmErrorMessage` 를 직접 열어 확인한 결과 provider 원문이나 키 조각을 그대로 반환하는
경로가 없고 8갈래 고정 문구로만 귀결되므로 새로운 정보 노출 경로는 아니다. DTO 필드 변경도
이미 나가고 있던 값의 뒤늦은 선언이거나 애초에 나간 적 없는 필드의 제거일 뿐 과다 노출을
만들지 않는다. 인증/인가 메타데이터·신규 인젝션 표면·하드코딩된 시크릿·안전하지 않은 암호화·
신규 외부 의존성은 diff 안에 없다.

## 위험도

NONE
