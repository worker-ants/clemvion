# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공유 정규식 SoT(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN` ×2)를 넓히는 변경이라 blast radius 가 이 diff 안에서 가장 크다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:42`(`SECRET_LEAK_PATTERNS` 값 패턴), `codebase/backend/src/shared/utils/sanitize-error-message.ts:100`(`CREDENTIAL_KEY_PATTERN`), `codebase/backend/src/modules/websocket/websocket.service.ts:75`(`CREDENTIAL_KEY_PATTERN` 미러)
  - 상세: 이 세 상수는 모듈 스코프 `const` 이지만 사실상 여러 소비자가 공유하는 전역 설정이다. grep 결과 `SECRET_LEAK_PATTERNS`/`deepRedactSecrets`/`redactSecrets`는 `redact-stored-error.ts`, `thread-renderer.ts`, `terminal-error-payload.ts`, `execution-engine/sanitize-error-message.ts`, `integration-oauth.service.ts`, `interaction.service.ts`, `strip-external-only-fields.ts`, `ai-turn-orchestrator.service.ts`, `mcp-error-codes.ts`, `websocket.service.ts` 전부가 소비한다. `token` 계열 전체(`[A-Za-z0-9_-]*token`)로 넓히면 이 모든 소비자의 출력이 동시에 바뀐다 — 예: `nextPageToken`/`continuationToken` 같은 불투명 커서도 이제 마스킹된다(코드 주석이 "accepted false positive"로 명시). 이번 diff 는 이를 문서화하고(캐너리 테스트 포함) plan 에서 "427 suites / 8,811 전원 GREEN"으로 blast radius 를 실측했다고 기록했으므로 결함은 아니나, 리뷰어 관점에서 **공유 프리미티브를 넓히는 편집은 자매 함수 전수뿐 아니라 모든 소비 지점의 관측 가능한 출력을 바꾼다**는 점을 명시적으로 기록해 둔다. 함수 시그니처·export 표면 자체는 변경되지 않았다(`redactSecrets`/`deepRedactSecrets`/`redactMcpSecrets`/`sanitizeMcpErrorMessage` 전부 동일 시그니처).
  - 제안: 조치 불필요 — 이미 plan 에 blast-radius 실측·캐너리·뮤테이션 검증이 기록돼 있다. 향후 이 세 상수를 다시 넓힐 때도 같은 전수 소비자 목록을 재확인할 것.

- **[INFO]** `MCP_EXTRA_SECRET_PATTERNS` 를 빈 배열로 만들어 `redactMcpSecrets` 의 첫 번째 for 루프가 상시 no-op 이 됨
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — `redactMcpSecrets` 함수, `for (const [pattern, replacement] of MCP_EXTRA_SECRET_PATTERNS)` 루프(파일 컨텍스트 74행)
  - 상세: 이전에는 이 루프가 MCP 전용 bare `token=` 패턴을 실제로 적용했다. 이번 변경으로 배열이 비어 루프 바디가 한 번도 실행되지 않는 죽은 순회가 된다. 기능적으로는 회귀가 아니다 — 공용 `SECRET_LEAK_PATTERNS` 가 동일 형태를 흡수했음을 `mcp-error-codes.spec.ts` 8건 GREEN 으로 확인했고, JSDoc 이 "훅을 의도적으로 남겨 둔다"고 설명한다. 다만 리뷰 관점에서 "함수가 예상 외로 아무 일도 안 하게 됨"은 향후 유지보수자가 `MCP_EXTRA_SECRET_PATTERNS` 를 지워버리기 쉬운 지점이므로 기록해 둔다.
  - 제안: 조치 불필요(문서화 충분). 배열이 비었으므로 향후 이 상수를 완전히 제거하고 싶은 유혹이 있을 수 있는데, JSDoc 이 그 유혹을 이미 다루고 있다.

- **[INFO]** `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 확장을 검증하는 전용 회귀 테스트가 diff 에 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:75`; 대응 스펙 `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(diff 없음)
  - 상세: `sanitize-error-message.spec.ts` 에는 값 축·키 축 19건의 신규 회귀 테스트가 추가됐지만, 이는 `sanitize-error-message.ts` 의 `CREDENTIAL_KEY_PATTERN`(shared)만 검증한다. `websocket.service.ts` 는 그 상수를 **독립적으로 미러링**한 별도 정규식 리터럴이며(import 아님), 새 JSDoc 이 "함께 갱신한다"고 명시하지만 이 diff 안에서 `websocket.service.spec.ts` 자체의 신규 케이스는 확인되지 않았다(`grep` 결과 `csrf`/`x-auth-token`/`nextPageToken` 관련 케이스 0건, 기존 `api_key` 회귀 주석 1건만 존재). 두 파일이 문자 그대로 같은 정규식 소스를 공유하지 않는 손-미러 구조이므로, WS 쪽이 실제로 올바르게 동기화됐는지는 이 diff 의 테스트만으로는 직접 관측되지 않는다.
  - 제안: 이미 push 전이라면 `websocket.service.spec.ts` 에도 `csrf_token`/`x-auth-token` 형태의 최소 회귀 케이스를 하나 추가해 두 미러가 실제로 같은 값을 내는지 테스트로 고정 — side-effect 자체는 아니지만 "미러가 조용히 갈리는" 이 저장소의 반복 실패 형태를 예방한다.

## 요약

핵심 변경은 세 개의 정규식 상수(`SECRET_LEAK_PATTERNS` 값 패턴, `CREDENTIAL_KEY_PATTERN` ×2 미러)를 `token` 접두 계열까지 흡수하도록 넓히고, MCP 전용 중복 패턴(`MCP_EXTRA_SECRET_PATTERNS`)을 비워 흡수시킨 것이다. 함수 시그니처·공개 API·환경 변수·네트워크 호출·파일시스템 쓰기(신규 plan/review 문서 제외) 는 전혀 변경되지 않았고, 마스킹 함수들은 여전히 순수(입력 mutation 없음, copy-on-change)하다. 유일하게 주목할 부작용 축은 **공유 정규식 SoT 를 넓히면 다수의 다운스트림 소비자(웹소켓 emit, 대화 스레드, 종결 에러 페이로드, MCP 에러, execution-engine 알림 등)의 마스킹 출력이 동시에 바뀐다**는 점인데, 이는 이번 변경의 의도된 목적이고 plan 문서에 blast-radius 실측(427 suites / 8,811 GREEN)·뮤테이션 검증·캐너리 테스트로 뒷받침돼 있다. `MCP_EXTRA_SECRET_PATTERNS` 가 비어 no-op 루프가 된 것도 의도적으로 문서화된 훅이다. WS 쪽 `CREDENTIAL_KEY_PATTERN` 미러에 대한 전용 회귀 테스트 부재만 경미한 갭으로 남는다.

## 위험도
LOW
