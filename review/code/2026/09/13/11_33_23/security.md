# 보안(Security) 코드 리뷰

## 검토 범위

`guide-error-code-truth` 배치. 실질 코드 변경은 `POST /api/model-configs/:id/test` 실패 응답
필드명 정정(`error`→`message`), 생산자 0건인 `latencyMs`/`meta` DTO 필드 제거, 형제
`TestConnectionResultDto` 에 실제로 실리는 `code` 필드 추가, 이를 검증하는
`assertMatchesContract` 계약 테스트 배선(서비스 단위 + 컨트롤러 HTTP 왕복), 유저 가이드
MDX 문서의 에러 코드 정정, 신규 build-time 정적 가드(`guide-error-code-scan.ts` /
`guide-error-code-existence.test.ts` / `guide-sanitized-message-parity.test.ts`)이다.
프롬프트가 절단한 파일은 `Read`/`git diff`로 워킹트리 원본을 직접 열어 대조했다
(`llm.service.ts` 전체, `sanitize-error.util.ts` 전체, `guide-error-code-scan.ts` 전체,
`guide-error-code-existence.test.ts` 전체, `llm-model-config.controller.spec.ts` 신규
describe 블록 전체). 이 diff 는 위 88개 파일 중 상당수(`review/code/**`, `review/consistency/**`)가
**이전 리뷰/일관성 검토 라운드의 산출물을 저장소에 커밋하는 것**이라 코드 변경이 아니며
자체로는 보안 표면이 아니다 — 그 안에 담긴 서술만 교차검증 목적으로 참고했다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 수준의 보안 결함은 발견되지 않았다.

- **[INFO]** `LlmService.testConnection` 필드 리네임(`error`→`message`)으로 종전엔 화면에
  전혀 도달하지 않던 실패 사유 문장이 처음으로 사용자에게 노출되는데, 그 문장을 만드는
  `sanitizeLlmErrorMessage` 를 직접 열어 확인한 결과 provider 원문을 그대로 반환하는 경로가
  없다 — 8갈래 고정 문구(401/403/404/429/timeout/ECONNREFUSED/ENOTFOUND 패턴 매치, 미매치 시
  범용 폴백)로만 매핑된다.
  - 위치: `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` (전체 파일, 이번
    diff 로 변경되지 않음 — 이번 변경의 보안 전제이므로 확인)
  - 상세: `codebase/backend/src/modules/llm/llm.service.ts` 게이트 354행
    (`return { success: false, message: sanitizeLlmErrorMessage(message) };`)이 이 함수를
    통해서만 사용자에게 문장을 내보낸다. key 조각·내부 엔드포인트·스택트레이스가 새어나갈
    경로가 없음을 실측으로 확인 — CHANGELOG/plan/신규 MDX 문서가 주장하는 "provider 원문은
    싣지 않는다" 가 실제 코드와 일치한다.
  - 제안: 없음(확인용 기록). 향후 이 함수에 패턴을 추가할 때 매치 실패 분기에서 원문이
    새지 않는지 계속 확인할 것.

- **[INFO]** `testConnection` catch 블록의 `this.logger.warn(...)` 는 sanitize 되지 않은 원본
  에러 메시지를 서버 로그에 남긴다. 이 줄은 diff 문맥(unchanged)이며 이번 PR 이 만든 것이
  아니다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`, 게이트 353행
    — diff 문맥 줄, 수정 대상 아님)
  - 상세: 이 메서드는 `LlmUsageLogService.record(...)` 를 호출하지 않는다(그 호출은 같은
    파일의 다른 메서드에만 있음, 신규 컨트롤러 HTTP 왕복 테스트도 `LlmUsageLogService` 를
    단순 `{ record: jest.fn() }` mock 으로만 주입해 이 경로에서 호출되지 않음을 뒷받침한다).
    즉 원본 메시지가 workspace 사용자에게 노출되는 Activity/Usage 로그 경로로 재전파되지
    않는다. 새 결함 아님.
  - 제안: 없음.

- **[INFO]** 신규 build-time 가드(`guide-error-code-scan.ts`)의 정규식은 저장소 내부 소스
  파일(`codebase/backend/src`, `codebase/packages`)만 입력으로 받으며 외부/사용자 입력을
  처리하지 않는다. 전체 코드를 직접 열어 `UPPER_SNAKE`/`FIELD_TABLE_NAME`/`CODE_FIELD`/
  `PROSE_BACKTICK`/`TABLE_HEADER_WITH_CODE`/`CODE_CONTEXT` 6개 정규식을 확인했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`
  - 상세: 중첩된 무제한 정량자가 겹치는 형태가 없어 catastrophic backtracking 형태가
    아니다. 설령 이차 시간이더라도 입력이 공격자 통제가 아니라 CI/테스트 실행 시점의 고정
    저장소 코퍼스(vitest 모듈 로드 시 1회 `fs.readFileSync`)라 공격 표면이 되지 않는다.
    `guide-sanitized-message-parity.test.ts` 도 동일하게 `readFileSync` 기반 정적 텍스트
    비교이며 외부 입력 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 픽스처(`llm-model-config.controller.spec.ts`)의 `apiKey: 'encrypted'`
  · `getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted')` 는 형식·문맥상 명백한
  mock 리터럴이며 실제 시크릿 하드코딩이 아니다. 저장소 전수 검색(`git diff` 범위 내
  password/secret/api[-_]?key/token/bearer/credential grep)에서도 이 외 하드코딩 시크릿
  후보는 없었다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (신규
    `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')` 블록의 `providers` mock)
  - 제안: 없음.

- **[INFO]** `code`/`message` 필드가 새로 선언·노출되는 형제 엔드포인트
  (`TestConnectionResultDto`)의 `code` 값들은 인증 실패 여부나 자격증명 상세가 아니라
  `INTEGRATION_INCOMPLETE`·`MCP_*`·`EMAIL_CONNECT_FAILED` 류의 분류 상수이며, `meta`·
  `latencyMs` 제거는 순수 미발행 필드 정리라 정보 노출 증가가 아니다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (게이트 464~480행 부근)
  - 제안: 없음.

## 요약

이번 배치의 실질 코드 변경(응답 필드명 정정, 죽은 DTO 필드 제거, 계약 검증 배선, 신규
build-time 정적 가드)에는 인젝션·인증/인가 우회·하드코딩된 시크릿·안전하지 않은 암호화 관련
결함이 없다. 핵심 위험 지점으로 볼 만한 것은 "종전엔 화면에 도달하지 않던 에러 문장이 이제
사용자에게 노출된다"는 동작 변화인데, 그 문장을 생성하는 `sanitizeLlmErrorMessage` 를 직접
열어 provider 원문을 절대 그대로 반환하지 않는 8갈래 고정 문구 매핑임을 확인했고, 서버
로그(`logger.warn`)의 원본 메시지도 workspace 사용자 노출 경로(`LlmUsageLogService`)로
재전파되지 않음을 확인했다. 신규 정적 가드 3종은 저장소 내부 고정 코퍼스만 순회하는
build-time 테스트 도구라 공격 표면이 없다. 나머지 다수 파일은 이전 리뷰/일관성 검토 라운드의
산출물을 커밋하는 것이라 코드 보안 표면이 아니다.

## 위험도

NONE
