# RESOLUTION — C-1 step2 (AiTurnOrchestrator + EngineDriver)

리뷰 세션: `review/code/2026/06/17/08_20_06/SUMMARY.md`
대상: `claude/engine-split-s2-aiturn` (C-1 step2)
전체 위험도: **MEDIUM** · Critical 0 · Warning 9 · fix 커밋 `d1386c07`

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W-1 | Testing | **fix** — `handleAiMessageTurn` 직접 단위테스트 5건(context absent→FAILED·nodeExec null·save throw recover·form_submitted 직렬화 + ai_message control) | `d1386c07` |
| W-2 | Testing | **fix** — `emitAiWaitingForInput` 직접 단위테스트 3건(ai_form_render+pendingFormToolCall·checkpoint 미대상 노드·nodeExec null pass-through) | `d1386c07` |
| W-3 | Architecture | **fix** — ES module 순환 import 해소. value helper 7종(`RehydrationError`·`withInteractionMeta`·`withSourceMarker`·`buildConversationConfigFromOutput`·`buildConversationMetaFromResumeState`·`buildAiMessageDebugFromResumeState`·`userMessageSignalApplies`)을 신규 `ai-conversation-helpers.ts` 로 분리. orchestrator→engine 잔존 참조는 `import type { WaitingInteractionType }` 뿐(런타임 순환 제거). e2e 부팅으로 런타임 검증. | `d1386c07` |
| W-4 | Architecture | **수용** — god-class 8,411줄 잔류는 strangler-fig 의도. PR3(Form/Button)·PR4(Retry)로 점진. | — |
| W-5 | Architecture | **fix** — EngineDriver ISP. orchestrator 미사용 `resolveHasDefaultLlmConfigCached`·`clearLlmDefaultConfigCache` 를 인터페이스에서 제거(9→7멤버), 엔진 내부 private 복귀. | `d1386c07` |
| W-6 | Maintainability | **수용(후속)** — `handleAiMessageTurn` ~250줄/8관심사. 본 PR 은 verbatim 이동(행위 보존)이라 추가 분해는 별도 개선. plan 후속 고려. | — |
| W-7 | Maintainability | **fix** — `emitAiWaitingForInput` 의 객체리터럴 내 IIFE → 지역 const(`conversationThreadSnapshot`) 추출. 행위 동일. | `d1386c07` |
| W-8 | Testing | **fix** — orchestrator/engine spec 의 logger·메서드 spy 오염 방어: `afterEach(() => jest.restoreAllMocks())` 추가. | `d1386c07` |
| W-9 | Concurrency | **수용** — `handleAiMessageTurn` LLM await 중 외부 cancel→context 삭제 window. 기존 `{ended:true, finalStatus:'FAILED'}` 방어코드 적절(verbatim 보존). 근본 window 축소는 장기 검토. | — |

INFO 처분: I-1·I-2 [SPEC-DRIFT] (`classifyLlmError` 이동·`waitForAiConversation`/`processAiResumeTurn` 소유 서술) → **체인 종료 시 planner 일괄**(c1-engine-split.md spec 갱신 phase). 기타 INFO(JSDoc·Symbol 토큰·테스트 캐스팅 등)는 저우선 — 후속 가능.

## TEST 결과

- **lint**: 통과 — 변경 6파일 eslint 0 errors.
- **unit**: 통과 — `src/modules/execution-engine` 30 suites / **779 passed** (신규 orchestrator spec 64 포함). execution-engine 은 otplib 미의존 → 환경오염 면역. (호스트 full `npm test` 의 auth/users/app.module 8 suites 는 아래 otplib 환경오염으로 실패 — 본 PR diff 와 무관.)
- **build**: 통과(본 PR 범위) — execution-engine 전 파일 tsc 컴파일 clean(`error TS` 중 totp 외 0). 호스트 `npm run build` 는 `auth/totp.service.ts:8`(otplib export) 만 실패 — 환경오염. **dockerized build(npm ci, package-lock otplib v12)는 totp 포함 전체 성공**(e2e 가 빌드 단계 포함).
- **e2e**: 통과 — dockerized **34 suites / 202 tests**(`make e2e-test`, npm ci=package-lock otplib v12 → 호스트 심링크 오염 면역). AI 멀티턴 park/resume 통합 포함 → 추출·W3 순환해소의 런타임 무회귀 + deploy-정확 build 검증.

## 환경 노트 (otplib — 본 PR 무관, 검증됨)

병렬 잡의 **otplib ^13 업그레이드**(refactor backlog 07 m-9) 가 **공유(심링크) node_modules** 를 `13.4.1` 로 변경. 본 worktree 는 main 의 node_modules 를 심링크하므로 v13 을 상속하나, worktree `package.json` 은 `^12.0.1`·`totp.service.ts` 는 v12 API(`authenticator` export) → 호스트 build/full-unit 의 **auth 부분만** 실패. `totp.service.ts` 는 본 PR diff 에 없음(git status 확인). dockerized 게이트(`npm ci`=package-lock v12)는 면역하며 통과 → **코드는 정상**. 격리(심링크→실설치) 미수행: `@workflow/*` file-dep dist 재빌드 등 worktree-bootstrap 복잡도 유발 + 환경문제라 코드 게이트(execution-engine unit + docker e2e)로 충분. 병렬 잡의 otplib PR 머지 시 자연 해소.

## 보류·후속 항목

- **W4·W6**: PR3·PR4 점진 분할 / 향후 메서드 분해 (c1-engine-split.md).
- **SPEC-DRIFT I-1·I-2**: 체인 종료(PR4) 시 planner 가 spec §Rationale·§1.1·§7.5 서술 일괄 갱신 (c1-engine-split.md spec 갱신 phase).

## impl-done (consistency) 후속

`/consistency-check --impl-done` 1차(09_01_32) **BLOCK: YES**(Critical: `RehydrationError` re-export 체인 fragility) → 해소 후 재실행(09_16_12) **BLOCK: NO**.

- **Critical 해소** (commit `a894ad62`): 엔진의 `ai-conversation-helpers` re-export 블록 제거 + 유일 외부 소비자 `userMessageSignalApplies`(엔진 spec)를 helpers 직접 import 로 통일 → re-export 체인 소멸, `RehydrationError` 단일 클래스 식별성 명확화. (실측상 FP: `class RehydrationError` 정의 1개·두 spec 모두 RehydrationError 미import. 그러나 체커 권고대로 직접 import 통일로 근본 정리.)
- **재실행 잔여 Warning 3건** (비차단, BLOCK: NO):
  - W-1 (`LLM_API_ERROR` passthrough 테스트 어서션 누락): `classifyLlmError` 는 verbatim 이동된 기존 행위(정규화 의미 불변) — 후속 테스트 보강 항목으로 기록(c1-engine-split.md 후속 고려).
  - W-2 (`interaction-type-registry.md §1.2` emit 위치 열에 `ai-turn-orchestrator.service.ts` 미등재): 체인 종료 시 planner 일괄 (c1-engine-split.md spec 갱신 phase).
  - W-3 (`LlmCallRecord`/`AiTurnDebugEntry` vs 기존 `LlmCallTrace`/`TurnDebugEntry` 중복): `shared/` 승격은 별도 후속 리팩토링(c1-engine-split.md 후속 고려).
- **INFO**(spec 주체 서술·코드 포인터 stale·`RehydrationError` 위치 I-7): 체인 종료 spec-sync 일괄 / W-3 와 함께 처리.
