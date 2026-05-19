# RESOLUTION — 11_45_40

> Review session: `review/code/2026/05/19/11_45_40`
> Worktree: `ai-agent-turn-fail-finalize-a22724`
> Reviewer note: C1 은 false positive — interface(247-251) + handler(1811-1819) 에 이미 구현됨.
> W3 / W4 / I10 은 본 PR scope 외 (사용자 지정).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C1 (requirement) | false positive | — | endMultiTurnConversation errorPayload 3번째 인자 이미 구현됨 (interface:247, handler:1811). reviewer 가 변경 전 코드를 참조한 false positive. skip. |
| W_json (requirement + testing + side_effect) | 코드 | 82383739 | extractAiTurnErrorPayload JSON.stringify 비직렬화 객체 보호 — try/catch 추가. WAITING_FOR_INPUT 회귀 재현 엣지케이스 차단. |
| arch-C2 (architecture) | 코드 | 82383739 | sanitizeLastErrorMessage를 shared/utils/sanitize-error-message.ts 로 이동. integration-oauth.service.ts 에 re-export 추가해 기존 import 경로 호환 유지. execution-engine.service.ts 는 공유 레이어에서 직접 import. |
| W_null (requirement + side_effect) | 코드 | 82383739 | nodeExec===null FAILED 경로에 warn 로그 추가. handleAiTurnError + finalizeAiNode FAILED 분기 양쪽. |
| test-W_extract (testing) | 코드 | 82383739 | extractAiTurnErrorPayload 단위 테스트 10건 추가 — Error/string/null/number 분기, LLM_RATE_LIMIT fallback, details sanitize, 순환참조 fallback. |
| test-W_flush (testing) | 코드 | 82383739 | FAILED e2e 시나리오 flushPromises 단일→2회 호출 (ai-review W4 패턴 통일). |
| lint-webauthn (webauthn.dto + spec) | 코드 | 82383739 | Type/IsArray unused import 제거, mockedGenerateAuthOpts → _mockedGenerateAuthOpts. |
| W3 | 코드 | 본 PR scope 외 | ExecutionEngineService God Object 추출 — 4200줄 분해는 별도 worktree 권장. |
| W4 | 코드 | 본 PR scope 외 | handleAiTurnError/finalizeAiNode 책임 분리 — refactor 성격, 별도 worktree 권장. |
| I10 | 코드 | 본 PR scope 외 | 날짜 인라인 주석 제거 — 기존 다수 주석과 동일 패턴, 별도 일관화 작업 권장. |

## TEST 결과

- lint  : 2 errors 잔류 — `sessions.controller.ts:34` / `node-component.interface.ts:242` (PR diff 외 pre-existing, 본 세션 scope 아님)
- unit  : 통과 (4052 passed)
- build : (unit pass 로 build 별도 불필요, e2e docker build 통과로 확인)
- e2e   : 통과 (93/93)

## 보류·후속 항목

- **본 PR scope 외 — 후속 plan 권장**:
  - W3: `ExecutionEngineService` God Object 추출 (`AiConversationService` 등 분리). PR-H/I 계획 구체화 권장.
  - W4: `handleAiTurnError` / `finalizeAiNode` 책임 분리 (sentinel throw 를 control flow 로 사용하는 안티패턴 해소, `AiTurnFinalizedError` 전용 클래스 등).
  - I10: 날짜 인라인 주석 일관화 (기존 코드베이스 전반의 동일 패턴과 함께 별도 일관화 작업).
- **pre-existing lint errors** (본 resolution scope 외):
  - `src/modules/auth/sessions.controller.ts:34` — `SessionDto` unused (pre-existing, commit cd1352c1)
  - `src/nodes/core/node-component.interface.ts:242` — `unknown` overrides union type (pre-existing)
- **INFO 항목 (자동 수정 대상 아님)**:
  - `sanitizeLastErrorMessage` cross-module import 문서화 comment — 이제 공유 레이어로 이동했으므로 해소됨.
  - `handleAiTurnError` JSDoc `@param` 누락 — 기존 파일 스타일과 일치, 향후 JSDoc 규약 정비 시 처리.
  - `finalStatus` 타입 앨리어스 부재 — `type AiFinalStatus = 'COMPLETED' | 'FAILED'` 정의는 W4 리팩토링과 함께 처리 권장.
  - `flushPromises` 단일 호출 취약성 — 이번 세션에서 2회 호출 패턴으로 수정 완료.
