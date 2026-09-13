# 보안(Security) Review

## 발견사항

- **[INFO]** `TestConnectionResultDto`/`ModelTestConnectionResultDto` 에서 `latencyMs`(양쪽), `meta`(형제 DTO) 제거 + `code`(형제 DTO) 신설은 정보 노출 관점에서 안전하다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (`ModelTestConnectionResultDto`)
  - 상세: 제거된 두 필드는 실측(diff 주석·CHANGELOG)상 생산자 0건이라 노출 축소일 뿐이며, 새로 선언된 `code` 는 이미 26곳에서 발행되던 고정 열거 문자열(`INTEGRATION_CREDENTIALS_UNREADABLE` 등)을 문서화한 것뿐이라 새 유출 표면이 아니다. `IntegrationsService` 내 `code:` 리터럴을 확인한 결과 provider 원문·자격증명·내부 경로가 섞이는 값은 없었다.
  - 제안: 없음 (참고용 기록).

- **[INFO]** `LlmService.testConnection` 의 `error`→`message` 필드 리네임은 새 정보 유출 경로를 만들지 않는다 — `sanitizeLlmErrorMessage`(8갈래 고정 문구, 미변경)를 그대로 경유한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` catch 블록)
  - 상세: `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts`(diff 밖, 확인용으로 직접 열람)는 provider 원문을 절대 그대로 반환하지 않고 401/403/404/429/timeout/ECONNREFUSED/ENOTFOUND/폴백 8종 고정 문장 중 하나로만 치환한다. `this.logger.warn`은 서버 로그에만 원문을 남기고(클라이언트로 전송 안 됨) 이는 기존 동작 그대로다. 새 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)도 `res.body.data.message`가 정규화 문장인지, 키 전수가 `['message','success']`인지 단언해 "정규화를 벗겨 provider 원문을 흘리는" 방향의 회귀를 캐너리로 고정했다 — 오히려 방어가 강화됐다.
  - 제안: 없음.

- **[INFO]** 신규 계약 검증(`assertMatchesContract`/`contractForDto`) 배선은 과다 노출(over-exposure) 회귀를 잡는 방향으로 기여한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts`, `codebase/backend/src/modules/llm/llm.service.spec.ts`, `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
  - 상세: `response-contract.ts`(diff 밖, 선례로 audit-logs 의 `User` 엔티티 26키 유출을 잡은 정본 검사기)를 이 두 엔드포인트에 새로 배선했다. `llm-model-config.controller.spec.ts`의 HTTP 왕복 테스트는 mock 서비스가 아니라 실제 `LlmService`를 DI 하고 `Object.keys(res.body.data).sort()`로 와이어 키를 전수 고정해, DTO에 선언되지 않은 키가 응답에 실리는 방향(과다 노출)까지 함께 막는다. 보안 관점에서 긍정적 강화다.
  - 제안: 없음. (참고로 CHANGELOG/plan 문서 자체가 이미 지적하듯, 형제 엔드포인트의 MCP 전용 필드 `capabilities`/`serverInfo`/`preview` 는 여전히 미선언 상태로 남아 있으나 이는 이번 diff 가 손대지 않은 기존 상태이고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있어 재차 플래그하지 않는다.)

- **[INFO]** 문서(mdx) 변경분(`MAKESHOP_API_ERROR`→`MAKESHOP_404` 등, 에러 코드 표 정정)과 신규 가드(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`)는 빌드 타임 전용 순수 텍스트 스캐너로, 사용자 입력을 다루지 않고 저장소 고정 경로만 읽는다 — 인젝션·경로 탐색 표면 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`, `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`
  - 상세: 정규식들(`UPPER_SNAKE`, `FIELD_TABLE_NAME`, `CODE_FIELD`, `CODE_CONTEXT` 등)은 중첩 정량자가 없는 선형 패턴이라 ReDoS 우려가 없고, 대상 파일 목록은 `repoRoot()` 기준 고정 상대 경로(`codebase/backend/src`, `codebase/frontend/src/content/docs`, `codebase/packages`)로만 walk 하며 외부/사용자 입력을 받지 않는다.
  - 제안: 없음.

- **[INFO]** 프런트엔드 토스트가 `result.message ?? ""` 를 화면에 노출하는 경로(`model-config-manager.tsx`)는 XSS 위험이 없다
  - 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` (i18n 보간 → `toast.error`), 대응 테스트 `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx`
  - 상세: `message` 는 백엔드 `sanitizeLlmErrorMessage` 를 거친 8갈래 고정 문자열만 가능하고, sonner `toast.error` 는 React 기반 텍스트 렌더링이라 `dangerouslySetInnerHTML` 경유가 아니다. 신규 테스트 두 건(정상/대조군)도 문자열 정확 일치(`toHaveBeenCalledWith`)로 검증해 부분 일치로 인한 은닉 결함 가능성도 배제했다.
  - 제안: 없음.

- **[INFO]** 신규/변경 테스트 파일에 사용된 자격증명류 리터럴(`apiKey: 'encrypted'`, `getDecryptedApiKey: ... 'sk-decrypted'`)은 실제 시크릿이 아닌 mock 픽스처 문자열이다
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (`ModelConfigService` mock provider)
  - 상세: 값 자체가 실제 API 키 포맷이 아니고(`sk-decrypted` 등) 단위 테스트 mock 값이라 하드코딩 시크릿에 해당하지 않는다. 저장소 전체 diff 를 시크릿 패턴(AKIA, ghp_, xox, PEM 헤더 등)으로 grep 했으며 일치 항목 없음.
  - 제안: 없음.

## 요약

이번 변경은 `POST /api/model-configs/:id/test` 실패 응답 필드명이 서비스·DTO·프런트엔드 3층에서 갈려 실패 사유가 화면에 전혀 도달하지 않던 결함을 `message` 로 통일해 고치는 것이 핵심이며, 실패 사유는 여전히 `sanitizeLlmErrorMessage` 의 8갈래 고정 문구를 거쳐 provider 원문(키 조각·내부 엔드포인트 가능성)을 노출하지 않는다. 함께 제거된 `latencyMs`/`meta` 는 생산자 0건인 유령 필드였고, 신설된 `code` 는 이미 나가고 있던 고정 열거값을 문서화한 것뿐이라 새 유출 표면이 아니다. 오히려 이 PR 은 과다 노출(엔티티 패스스루)을 잡는 정본 `assertMatchesContract` 검사기를 두 테스트 대상 엔드포인트(서비스 단위 + 컨트롤러 HTTP 왕복)에 새로 배선하고, 응답 키 전수를 고정하는 단언까지 추가해 보안 회귀 방지 측면에서 개선됐다. 문서(mdx) 변경과 신규 가드 스크립트는 사용자 입력을 다루지 않는 빌드 타임 전용 정적 스캐너이며 인젝션·시크릿 하드코딩·인증/인가 관련 코드는 이번 diff 범위에 없다. 하드코딩된 시크릿, 인젝션, 인증 우회, 안전하지 않은 암호화 사용 등 CRITICAL/WARNING 급 발견사항은 없었다.

## 위험도

NONE
