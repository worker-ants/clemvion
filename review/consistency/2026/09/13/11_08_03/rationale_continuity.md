# Rationale 연속성 검토 — guide-error-code-truth (impl-done, scope=spec/5-system/)

## 조사 방법

`spec/5-system` 델타는 0 (코드 전용 PR). 프롬프트 번들이 예산 초과로 `3-error-handling.md`·
`7-llm-client.md` 등 17개 파일 본문을 절단했으므로, 두 문서와 `2-navigation/4-integration.md`·
`spec/conventions/error-codes.md` 를 워킹트리에서 직접 Read 하고, `git diff origin/main` 으로
실제 코드/문서 변경분을 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

### [INFO] "결과 객체는 에러 봉투와 필드명이 겹치면 안 된다" 원칙이 JSDoc 한 곳에만 산다

- target 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection` 메서드
  JSDoc (`## 실패 필드는 message 다` 절, `error` → `message` rename 근거)
- 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` — `POST
  /api/integrations/:id/test` 가 이미 `{success, code, message}` 200-결과-객체 패턴을 확립
  (`§9.1`, "Endpoint 시맨틱: `:id/test` 는 ... 결과 body 형식이 이미 `{ success, code, message
  }` 의 success/false 패턴이라 가드 결과도 같은 shape 으로 표현하는 게 자연스럽다")
- 상세: 이번 diff 는 `LlmService.testConnection` 반환 필드를 `error` → `message` 로 정정해
  형제 엔드포인트·DTO·프런트엔드와 이름을 맞췄다 — 이 자체는 기존 선례(위 §9.1 패턴)를
  올바르게 따른 **정합화**이지 번복이 아니다. 다만 새로 추가된 JSDoc 근거 문장("이 응답은
  HTTP 200 의 결과 객체라 에러 봉투(`{ error: { code, message } }`)와 이름이 겹치면 안
  된다")은 향후 다른 200-결과-객체 엔드포인트에도 적용될 만한 **일반 원칙**처럼 읽히는데,
  `spec/5-system/2-api-convention.md §5.3`(에러 봉투 SoT)이나 `4-integration.md` 어느
  Rationale 에도 이 명명 충돌 규칙 자체는 명문화돼 있지 않다 — 코드 코멘트에만 존재한다.
  또한 이 엔드포인트는 형제(`:id/test`)와 달리 `code` 필드를 아직 갖지 않는데(관련 필드
  shape 자체가 어느 spec 표에도 없다는 사실은 plan 이 이미 실측·등재함), 이 비대칭이
  spec Rationale 부재 상태로 코드 주석에만 근거를 두고 있다.
- 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 등재된
  `testConnection` 실패 응답 shape 문서화 항목이 처리될 때, 이 명명 원칙("결과 객체 필드는
  에러 봉투 필드명과 겹치지 않는다")도 함께 `7-llm-client.md` 또는 `2-api-convention.md`
  Rationale 에 명문화할 것을 제안. 코드 자체를 지금 바꿀 필요는 없음(BLOCK 대상 아님).

## 교차 검증한 항목 (문제 없음으로 판정)

- **은퇴 코드 재도입 여부**: `spec/5-system/3-error-handling.md §1.4` 가 "더 이상 사용하지
  않는다" 고 명시한 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 는 diff 어디에도
  재도입되지 않았다 — `run-results{,.en}.mdx`·`error-handling{,.en}.mdx` 는 이들을 제거하고
  실재하는 노드-카테고리별 코드(§1.4 표와 정확히 일치)로 교체했다.
- **CWE-209 원문 미노출 원칙**: `§2 에러 응답 형식`/`api-convention §5.3`이 못박은 "내부
  구현 원문 echo 금지" 원칙을, `sanitizeLlmErrorMessage` 8갈래 고정 문장 + 신설
  `guide-sanitized-message-parity.test.ts` 가 오히려 강화한다(가이드가 원문을 옮기지 않고
  SoT 고정 문장과 글자 단위로 일치하는지 검증). 위반 없음.
- **`nodeName` → `nodeLabel`**: 이미 `1-auth.md` 밖 §2.2(2026-08-17)에서 정정된 기존 spec
  결정을 문서 diff 가 뒤늦게 따라간 것 — 새 번복 아님.
- **가드 배치 위치(`repo-guards/` 대신 `codebase/frontend/src/lib/docs/__tests__/`)**: plan 이
  인용한 `spec/conventions/error-codes.md` "본 문서가 유일하게 소유하는 것: ① 의미 기반
  명명 원칙, ② rename 안정성 정책, ③ historical-artifact 예외 레지스트리" 문구를 직접
  대조 확인 — 정확히 일치. 가드를 그 문서에 두지 않은 근거가 지어낸 것이 아니라 실재.
- **처분 번복의 취소선 처리**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에서 과거 처분("수렴 코드 `LLM_CONNECTION_ERROR` 를 적어라")을 취소선으로 남기고 반증
  근거(실측: 해당 엔드포인트는 코드를 전혀 내지 않음)를 바로 옆에 기록 — "결정의 무근거
  번복" 에 해당하지 않는 모범적 처리.
- **`{success, code, message}` 패턴 확장**: `TestConnectionResultDto`(integrations)에 `code`
  필드를 추가한 것은 `4-integration.md §9.1`이 이미 문서화한 실제 발행값(`code:
  'INTEGRATION_INCOMPLETE'` 등)을 뒤늦게 선언한 것이며, 신규 원칙 도입이 아니다.
- **Planned 로드맵 코드(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`) 배제**: `7-llm-client.md §6`
  이 이 둘을 "미구현(Planned)... 현재는 `LLM_CONNECTION_ERROR` 로 수렴" 이라고 명시한 것을
  직접 대조 확인 — 신설 가드가 이들을 실패로 잡는 것(Planned 허용 안 함)은 "유저 가이드는
  현재 동작만 서술한다" 는 기존 문서 성격과 정합.

## 요약

이 PR 은 spec/5-system 본문을 건드리지 않는 코드·문서 전용 변경이며, 발견된 유일한 실질
설계 결정(`error`→`message` 필드 rename, 에러 코드 카탈로그 정정, 은퇴 코드 제거)은 모두
기존 spec Rationale(§9.1 결과-객체 패턴, §1.4 은퇴 목록, §6 Planned 표기, CWE-209 원칙)을
근거로 하거나 그 원칙을 강화하는 방향이었고, 스스로 실측한 반증(과거 처분 취소선)까지
투명하게 남겼다. spec 표가 없는 자리(testConnection 실패 shape)는 코드로 결정을 내리는
대신 planner 백로그로 명시 이관해 권한 경계도 지켰다. 유일한 지적은 새로 도입된 명명
근거 하나가 spec Rationale 이 아니라 JSDoc 에만 있다는 정합 보완 제안(INFO)이다.

## 위험도

NONE
