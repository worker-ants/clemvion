# 보안(Security) 리뷰 — IE `endMultiTurnConversation` errorPayload 계약 명문화

## 리뷰 대상
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — 회귀 테스트 2건 추가
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `endMultiTurnConversation` 시그니처에 미사용(`_` prefix) 옵션 파라미터 3개 추가 + docblock 확장
- `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler.endMultiTurnConversation` docblock 확장 (구현체별 `errorPayload` 소비 방식 상이함을 명문화)
- `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/*` — 계획·일관성 검토 산출물 (문서, 실행 코드 없음)

## 변경 성격
런타임 로직 변경이 **없다**. `InformationExtractorHandler.endMultiTurnConversation`은 이전과 동일하게 `(state, endReason)` 두 인자만 실제로 사용하며, 새로 추가된 `_errorPayload` / `_failedUserMessage` / `_failedUserMessageSource`는 인터페이스 arity를 맞추기 위한 선언일 뿐 함수 본문에서 전혀 참조되지 않는다(`return this.buildMultiTurnFinalOutput(state, endReason);`). 나머지 변경은 이미 존재하던 divergence(AI Agent는 engine `errorPayload`를 verbatim relay, IE는 self-fill)를 docblock·테스트로 명문화한 것뿐이다.

## 발견사항

없음. 아래는 확인했으나 리스크로 분류하지 않은 항목이다.

- **[INFO]** 신규 파라미터는 미사용 상태로 선언만 됨
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:773-775`
  - 상세: `_errorPayload?: { code: string; message: string; details?: unknown }` 등 3개 인자가 `_` prefix로 no-op 의도를 명시하며 추가됨. 인젝션·검증 우회로 이어질 신규 데이터 흐름이 없다 — 엔진이 넘기는 `errorPayload`가 IE 쪽에서 어떤 방식으로도 `output`에 도달하지 않는다(의도적으로 버려짐). 오히려 §5.3 code-기반 `retryable` invariant를 우회 relay로부터 보호하는 방향의 변경.
  - 제안: 조치 불필요. 회귀 테스트(`ignores the engine errorPayload and self-fills the §5.3 error envelope`)가 향후 누군가 verbatim relay로 "고치는" 실수를 막는 핀 역할을 하므로 오히려 안전성 강화.

- **[INFO]** 테스트 픽스처에 시크릿·PII 유사 값 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` 신규 블록 전체
  - 상세: `errorState()` / `enginePayload`는 `gpt-4o`, `429 rate limited` 등 합성 mock 값이며 실제 API 키·토큰·자격증명 문자열이 없다. `grep -iE "password|secret|api[_-]?key|token|credential"` 결과도 전부 `inputTokens/outputTokens/totalTokens`(LLM 사용량 필드) 매칭으로 오탐이며 실제 하드코딩 시크릿은 없음.
  - 제안: 조치 불필요.

- **[INFO]** 에러 메시지 노출 정책 — 이번 diff 범위 밖
  - 위치: `information-extractor.handler.spec.ts` 기존 코드(`err.message).toBe('network down')` 등, diff 헝크 밖 "전체 파일 컨텍스트"에 포함된 기존 테스트)
  - 상세: provider가 던진 원시 `Error.message`를 `output.error.message`로 그대로 노출하는 기존 동작이 있으나, 이는 이번 변경이 건드리지 않은 pre-existing 코드다. 새로 추가된 self-fill 경로(`'Conversation terminated due to LLM call failure'`)는 오히려 provider 세부 메시지를 감추는 generic 문자열을 사용해 정보노출 표면을 넓히지 않는다.
  - 제안: 별건으로 다룰 사안이며 이번 리뷰 스코프에서는 조치 불필요.

## 요약
이번 변경은 `InformationExtractorHandler.endMultiTurnConversation`과 `ResumableNodeHandler` 인터페이스의 기존 동작(엔진 `errorPayload`를 무시하고 self-fill)을 docblock·회귀 테스트로 명문화한 순수 문서화/계약-고정 작업이다. 새 파라미터는 미사용 placeholder이고, 실제 데이터 흐름·인증/인가 경로·쿼리·출력 이스케이핑에 변화가 없으며 하드코딩된 시크릿도 없다. 인젝션, 인증/인가, 입력 검증, 암호화, 의존성 측면에서 새로 도입된 공격 표면이 없다.

## 위험도
NONE
