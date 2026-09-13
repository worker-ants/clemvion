# 테스트(Testing) 코드 리뷰

## 검토 방법

프롬프트에 실린 82개 파일 중 실제 코드/테스트 변경 파일(1~22)을 전수 검토했다. 프롬프트가
크기 제한으로 diff 를 생략한 3개 파일(`llm-model-config.controller.spec.ts`,
`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`)은 저장소 원본을 `Read` 로
직접 열어 확인했다. `review/**` 하위 41개 파일은 이전 리뷰 라운드의 산출물이며 이번 diff 의
코드 변경이 아니므로 테스트 관점 분석 대상에서 제외했다(단, 그 안의 처분 이력을 대조용으로
참고했다).

저장소 파일은 전혀 수정하지 않았다 — `Read`/`Grep`/`Bash`(읽기 전용 grep, jest/vitest 실행)만
사용했다. 다음 두 명령으로 실제 테스트 실행 결과를 직접 확인했다(뮤테이션 없음, `git status
--short` 로 청결 확인 완료):

```
cd codebase/backend && npx jest llm.service.spec.ts llm-model-config.controller.spec.ts integrations.service.spec.ts
→ Test Suites: 3 passed, 3 total / Tests: 193 passed, 193 total

cd codebase/frontend && npx vitest run guide-error-code-existence.test.ts guide-sanitized-message-parity.test.ts impl-anchor-existence.test.ts model-configs.test.ts model-config-manager.test.tsx
→ Test Files 5 passed (5) / Tests 297 passed (297)
```

## 발견사항

- **[INFO]** plan 체크리스트의 `.claude/tools/run-test-all.sh` 항목이 아직 미체크(`- [ ]`)로 남아 있다
  - 위치: `plan/in-progress/guide-error-code-truth.md` 체크리스트 (`## 체크리스트` 섹션, "E: planner 항목 3건 등재" 바로 다음 줄)
  - 상세: 이 프로젝트는 최근 `run-test-all.sh`(커밋 `171627852`)를 새로 만들어 "단계별로 나눠 돌리면 파이프(`| tail`)가 종료 코드를 삼킨다"는 실측 결함을 harness 레벨에서 막았다. 그런데 이 PR 의 체크리스트에는 그 스크립트를 **이 changeset 에 대해 실행**했다는 체크가 없다 — 이후 항목들(`/ai-review`, `--impl-done`)은 체크돼 있으니 개별 리뷰·consistency 게이트는 통과했지만, "4단계(lint/unit/build/e2e) 전체가 종료 코드 기준으로 통과했다"는 명시적 증거가 plan 안에는 없다. 직접 `jest`/`vitest` 로 관련 스펙만 표적 실행한 결과는 전부 GREEN(위 실행 로그)이었지만, lint/build/e2e 전체를 이 리뷰가 대신 확인한 것은 아니다.
  - 제안: push 전에 `.claude/tools/run-test-all.sh` (또는 최소 `run-test-all.sh lint unit build`)를 이 changeset 기준으로 1회 실행해 체크박스를 실제 상태로 갱신할 것.

- **[INFO]** `guide-error-code-existence.test.ts` 의 "실재" 판정 기준(`collectBackendTokens`)이 원시 텍스트 스캔이라 **주석·죽은 코드에 남은 토큰도 "실재"로 센다** — 정확히 이 PR 이 되살리려는 방향(은퇴 코드 재유입)의 잠재적 사각지대
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:154-165` (`collectBackendTokens`)
  - 상세: 이 함수는 `\b(UPPER_SNAKE)\b` 정규식으로 `backend/src`+`packages` 전체 파일 텍스트를 대상으로 토큰을 모은다. 주석(`// deprecated: OLD_CODE`)이나 죽은 코드(사용되지 않는 상수 선언)에만 남아 있는 토큰도 기준집합에 포함된다. 오늘은 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR` 가 backend·packages 어디에도 텍스트로 남아 있지 않음을 직접 grep 으로 확인했으므로(0건) **현재 베이스라인은 참**이지만, 향후 어떤 코드가 은퇴하면서 코드는 지우되 주석(`// 예전엔 X 코드였다`)을 남기면, 그 순간부터 가이드가 그 은퇴 코드를 다시 적어도 이 가드는 통과시킨다. 이 특정 실패 형태(주석/죽은 코드에만 남은 토큰)를 겨냥한 대조군(`대조군` describe 블록의 9개 케이스 중)이 없다 — 다른 8개는 신중하게 설계돼 있는데(줄 분할·문맥 신호·표 경계 등) 이 축만 비어 있다.
  - 제안: 급하지 않음(오늘 실측상 실질 위험 0). 다만 파일 상단 주석의 "판정 축을 어떻게 좁혔나" 표에 이 트레이드오프를 한 줄 추가하거나, 향후 코드 은퇴 시 리뷰 체크리스트에 "은퇴 코드 문자열이 주석에도 남지 않았는지 확인"을 명시해 두면 다음 사람이 이 사각지대를 몰라서 재발하는 일을 막을 수 있다.

- **[INFO]** 프런트엔드 실패-토스트 대조군 테스트가 `message` 필드의 "키 생략"(`undefined`) 경로만 덮고, DTO 가 명시적으로 허용하는 "명시적 `null`" 경로는 덮지 않는다
  - 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` "[대조군] 사유 필드가 비면 토스트 접미도 빈다" 테스트 — `testConnectionMock.mockResolvedValue({ success: false })`
  - 상세: `model-configs.ts` 의 타입 선언은 `message?: string | null` 이고 컴포넌트는 `result.message ?? ""` 로 두 경우(키 생략·명시적 null) 모두를 빈 문자열로 접는다. 새 대조군은 키 생략(`undefined`) 만 실어 보내고 `message: null` 을 명시적으로 보내는 케이스는 없다. 실제로 백엔드 `sanitizeLlmErrorMessage` 는 실패 시 항상 8갈래 중 하나의 비어있지 않은 문자열을 반환하므로 오늘 이 경로가 실제로 `null` 을 내는 프로덕션 시나리오는 없지만, 타입이 그 값을 허용하는 한 `??` 연산자가 두 형태 모두를 올바르게 처리하는지는 코드로 고정돼 있지 않다.
  - 제안: 심각하지 않음. 필요하면 기존 대조군 옆에 `testConnectionMock.mockResolvedValue({ success: false, message: null })` 케이스를 한 줄 추가해 `??` 분기의 두 형태(undefined/null)를 모두 이름으로 고정할 수 있다.

## 긍정적으로 확인한 사항

- **뮤테이션 근거가 테스트 주석에 실측으로 남아 있다.** `llm-model-config.controller.spec.ts` 의 HTTP 왕복 테스트는 "왜 세 종류 단언(`assertMatchesContract`·`.message` 정확 문자열·`Object.keys().sort()` 전수)이 각각 필요한가"를 4가지 뮤턴트 × 3가지 단언의 실측 표로 코드 주석에 남겨, `message` 가 optional 이라 `assertMatchesContract` 단독으로는 "필드가 통째로 사라지는" 뮤턴트를 못 잡는다는 한계를 스스로 문서화하고 실제로 보강했다. 프로젝트 메모(`feedback_design_rationale_must_be_mutation_tested.md`)가 요구하는 수준의 근거 제시다.
- **Mock 이 SUT 를 가리지 않는다.** 신규 컨트롤러 HTTP 스펙은 `LlmService` 를 mock 하지 않고 실제 서비스를 DI 하며 그 하위 의존(`LLMClientFactory`·`ModelConfigService`·`LlmUsageLogService`)만 mock 한다 — "필드 이름 축에서 vacuous 해진다"는 이유를 주석에 명시하고 회피했다. 원래 결함(필드명 불일치)이 서비스 mock 이었다면 재현 자체가 불가능했을 것이다.
- **회귀 치환이 전수·일관적이다.** `llm.service.spec.ts` 의 기존 5개 실패 케이스(`error:` 단언) 전부가 `message:` 로 정확히 치환됐고, 서비스 반환 필드 rename 뒤에도 소비처(`model-config-manager.tsx`)·e2e(`workspace-rbac.e2e-spec.ts`, 필드명 비의존)에 남은 `.error` 참조가 없음을 직접 grep 으로 재확인했다.
- **vacuity floor 설계가 프로젝트 관례를 정확히 따른다.** `guide-error-code-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 둘 다 "baseline-0 단언은 스캐너가 `return []` 로 망가져도 통과한다"는 사실을 인지하고 별도 floor 테스트(코퍼스 크기 하한·축별 최소 건수·SoT 문장 8개 정확히 추출)를 먼저 두었다. `guide-sanitized-message-parity.test.ts` 는 표→SoT·SoT→표 **양방향**을 갈라 "행을 지우는 편집"이 조용히 통과하는 것도 막는다 — 직접 정규식으로 재현해(`node -e`) 두 파일 모두 8개 문장이 정확히 일치함을 확인했다.
- **의도적으로 놓치는 경계를 코드로 고정했다.** `guide-error-code-scan.ts`/`.test.ts` 는 "여러 줄로 쪼갠 FieldTable 행은 놓친다", "실패 어휘가 없는 줄의 코드는 놓친다" 같은 알려진 미검출 방향을 **양성 단언**(`expect(codes(...)).toEqual([])`)으로 문서화해, 다음 사람이 "왜 안 걸렸지"를 추적하지 않게 해 둔다 — 이 리뷰가 지목한 두 INFO 항목과 결이 같은, 이미 확립된 프로젝트 관례다.
- **테스트 격리 확인.** `llm.service.spec.ts`(`mockClient` 를 top-level `beforeEach` 에서 재생성), `llm-model-config.controller.spec.ts`(`beforeAll`/`afterAll` 로 Nest 앱 1회 생성·정리 + `beforeEach` 에서 `mockReset`), `model-config-manager.test.tsx`(`beforeEach` 에서 `vi.clearAllMocks()` + `cleanup()`) 모두 이전 테스트의 mock 호출 기록·DOM 잔존이 다음 테스트로 새지 않도록 구성돼 있다. 실행 결과(위 로그)로도 순서 의존 실패가 없음을 확인했다.
- **직전 리뷰 라운드의 testing 지적이 실제로 해소됐다.** 라운드 1 `testing W#2`("UI 실패 경로 무테스트")가 이번 diff 의 `model-config-manager.test.tsx` 신규 테스트로, 라운드 2 `testing W#2`("형제 DTO 에 계약 검사 미배선")가 `integrations.service.spec.ts` 의 `assertMatchesContract` 추가로 각각 처리됐음을 diff 와 plan 체크리스트 대조로 확인했다.

## 요약

이 PR 은 서비스·DTO·프런트엔드 3개 레이어에 걸친 필드명 불일치 버그를 고치면서, 그 회귀
방지 체인을 서비스 단위 → 컨트롤러 HTTP 왕복 → 프런트 컴포넌트 렌더링까지 끊김 없이 세 층
모두에 실측 뮤테이션 근거와 함께 배선했다. Mock 은 SUT 를 가리지 않도록 신중하게 선택됐고,
vacuity floor·양방향 대조·의도적 미검출 경계를 코드로 고정하는 등 이 프로젝트가 요구하는
테스트 엄밀성 수준을 실제로 충족한다. 표적 실행(`jest`/`vitest`)으로 관련 스펙 전부가
GREEN 임을 직접 확인했다. 남은 항목은 경미하다 — plan 의 `run-test-all.sh` 체크박스가
아직 비어 있어 4단계 전체 통과가 plan 문서 안에서 명시적으로 증거화되지 않은 점, 새 가드의
"실재" 판정이 주석/죽은 코드에 남은 토큰까지 실재로 세는 구조적 사각지대(오늘은 실측상
영향 0), 그리고 실패-토스트 대조군이 `message: null` 명시 케이스를 아직 안 덮는 점이다.
셋 다 병합을 막을 사유는 아니다.

## 위험도

LOW
