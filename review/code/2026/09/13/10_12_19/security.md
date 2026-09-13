# 보안(Security) 코드 리뷰

## 검토 범위

`guide-error-code-truth` 배치 — `LlmService.testConnection` 실패 응답 필드명을 `error`→`message` 로 정정(3층 불일치 해소), 생산자 0건인 `latencyMs` DTO 필드 제거, 유저 가이드의 실재하지 않는 에러 코드 5종 정정, 신규 build-time 가드(`guide-error-code-existence`/`guide-error-code-scan`) 추가. 총 28개 변경 파일 중 코드 영향 파일은 6개(backend DTO 2·service 1·spec 2, frontend API client 1)와 신규 테스트 스캐너 2개이며, 나머지는 MDX 문서·plan·review 산출물이다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 수준의 보안 결함은 발견되지 않았다.

- **[INFO]** 정규화 함수(`sanitizeLlmErrorMessage`)는 이번 diff 로 변경되지 않았으나, 이번 변경의 보안 전제를 이루므로 확인해 두었다.
  - 위치: `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` (전체 파일, diff 밖)
  - 상세: 이번 PR 은 `testConnection` 실패 응답의 필드명을 `error`→`message` 로 바꿔 **종전엔 화면에 전혀 도달하지 않던 사유 문장이 처음으로 사용자에게 노출**되게 만든다. 사유 문장 자체는 `sanitizeLlmErrorMessage` 가 만드는데, 이 함수를 직접 열어 확인한 결과 provider 원문을 그대로 돌려주는 경로가 없고 8갈래 고정 문구 중 하나로만 매핑된다(`401/403/404/429/timeout/ECONNREFUSED/ENOTFOUND` 패턴 매치, 미매치 시 범용 폴백). 즉 이번에 "처음 도달하게 된" 통로에 새로운 정보 유출 경로가 열리지 않았다 — CHANGELOG/plan 의 "provider 원문은 싣지 않는다" 주장이 실측과 일치한다.
  - 제안: 없음(확인용 기록). 향후 이 함수에 패턴을 추가할 때는 매치 실패 분기에서 원문이 그대로 새지 않는지 계속 확인할 것.
- **[INFO]** `LlmService.testConnection` catch 블록의 `this.logger.warn(...)` 는 sanitize 되지 않은 원본 에러 메시지를 서버 로그에 남긴다. 이 줄은 diff 문맥(unchanged)으로만 등장하며 이번 PR 이 만든 것이 아니다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:348` (diff 문맥 줄, 수정 대상 아님)
  - 상세: 저장소의 기존 SSRF 관련 결정(`spec/4-nodes/4-integration/1-http-request.md` §SSRF)은 "서버 로그(`logger.warn`)에만 원본 상세를 남기고, **workspace 사용자에게 노출되는 Activity/Usage 로그에는 일반화된 문구만 남긴다**"는 원칙을 명시한다. `testConnection` 경로를 직접 확인한 결과 이 메서드는 `LlmUsageLogService.record(...)` 를 호출하지 않는다(그 호출은 파일의 다른 메서드에만 있다) — 즉 이 원본 메시지가 workspace 사용자에게 노출되는 경로로 재전파되지 않으므로 위 원칙과 충돌하지 않는다. 새 결함 아님, 확인 목적의 기록.
  - 제안: 없음.
- **[INFO]** 신규 가드(`guide-error-code-scan.ts`)의 정규식은 저장소 내부 소스 파일(`codebase/backend/src`, `codebase/packages`)만을 입력으로 받는 build-time 테스트 도구이며 외부/사용자 입력을 처리하지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`
  - 상세: `UPPER_SNAKE`/`FIELD_TABLE_NAME`/`CODE_FIELD`/`PROSE_BACKTICK`/`TABLE_HEADER_WITH_CODE` 패턴을 검토했다. 중첩된 무제한 정량자가 겹치는 형태가 없어 catastrophic backtracking 형태는 아니며(`TABLE_HEADER_WITH_CODE` 의 `(?:[^|]*\|)*?` 도 각 반복이 최소 1개의 `|` 를 소비해 줄 내 `|` 개수로 유계), 설령 이차 시간이더라도 공격자가 통제하는 입력이 아니라 CI/테스트 실행 시점의 고정 저장소 코퍼스이므로 공격 표면이 되지 않는다. 새 결함 아님, 확인 목적의 기록.
  - 제안: 없음.
- 테스트 픽스처(`llm-model-config.controller.spec.ts`)의 `apiKey: 'encrypted'`·`getDecryptedApiKey: ... 'sk-decrypted'` 는 형식·문맥상 명백한 mock 리터럴이며 실제 시크릿 하드코딩이 아니다(별도 findLLM 발견사항으로 등재하지 않음).

## 요약

이번 배치는 응답 필드명 정정(버그 수정)·죽은 DTO 필드 제거·문서 정확성 회복·신규 build-time 가드 추가로 구성되며, 인젝션·인증/인가·시크릿 하드코딩·안전하지 않은 암호화 관련 코드 변경은 없다. 핵심 위험 지점은 "종전엔 도달하지 않던 에러 문장이 이제 사용자에게 노출된다"는 동작 변화인데, 그 문장을 만드는 `sanitizeLlmErrorMessage` 는 provider 원문을 절대 그대로 반환하지 않는 8갈래 고정 문구 매핑이라 정보 유출 경로가 되지 않음을 직접 확인했다. 신규 가드는 저장소 내부 정적 코퍼스만 순회하는 build-time 테스트 도구라 공격 표면이 없다. 전반적으로 보안 관점에서 이 변경은 안전하다.

## 위험도

NONE
