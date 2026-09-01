# 유지보수성(Maintainability) 리뷰

## 대상 요약

`error-codes.ts` 에 엔진 레이어 전용 `EngineErrorCode` const 를 신설하고, 그동안 맨 문자열
(`'LLM_RATE_LIMIT'`, `'SERVER_INTERRUPTED'`, `'WORKER_HEARTBEAT_TIMEOUT'`,
`'EXECUTION_QUEUE_WAIT_TIMEOUT'`, `'WEBCHAT_IDLE_TIMEOUT'`)로 흩어져 있던 9개 지점을
`ErrorCode.*` / `EngineErrorCode.*` 참조로 리다이렉트했다. 재발 방지용 AST 기반 가드
(`engine-error-code-anchor-guard.ts` + 픽스처 + spec) 를 신규 추가했고, `plan/` 문서를
in-progress → complete 로 이동했다.

## 발견사항

- **[INFO]** 가드 spec 의 문턱값에 인라인 근거 주석이 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` — `'[전제] 상수 파일에서 코드를 실제로 읽어 온다'` 테스트의 `expect(declared.size).toBeGreaterThan(30)`, 그리고 `'예외 목록의 모든 항목에 사유가 적혀 있다'` 테스트의 `expect(reason.length).toBeGreaterThan(20)`
  - 상세: `30`(선언된 코드 총수 하한)과 `20`(예외 사유 문자열 최소 길이)은 둘 다 "파서가 죽지 않았다"·"의미 있는 사유가 적혀 있다"를 담보하려는 의도는 주변 주석으로 읽히지만, 숫자 자체가 왜 그 값인지(예: 30을 고른 근거, 20자를 고른 근거)는 코드에 남아있지 않다. 다른 리뷰어가 "왜 하필 20/30인가"를 물으면 답할 수 있는 사람이 작성자뿐이다.
  - 제안: 하한을 정한 근거를 한 줄로 덧붙이거나(예: "ErrorCode+EngineErrorCode 합계 실측값보다 여유 있게"), 실제 개수 기반 동적 계산으로 바꿔 매직 넘버를 제거한다. 두 번째 테스트가 `ANCHORED_ELSEWHERE` 크기를 동적으로 참조하는 것과 같은 패턴을 여기도 적용할 수 있다. 우선순위는 낮다 — 자기 회귀만 방지하는 내부 테스트 임계값이라 실제 유지보수 비용은 작다.

- **[INFO]** `EngineErrorCode` JSDoc 이 `ANCHORED_ELSEWHERE` 의 사유와 내용이 부분 중복
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`EngineErrorCode` 앞 JSDoc "## 여기 있는 것 / 없는 것" 문단) vs `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` (`ANCHORED_ELSEWHERE`)
  - 상세: "왜 `INVALID_EXECUTION_STATE`/`ERROR_PORT_FALLBACK`/trigger 4종을 옮기지 않았는가"라는 동일한 설명이 두 파일에 각각 산문·표 형태로 존재한다. 한쪽이 갱신되고 다른 쪽이 stale 해질 여지가 생긴다(예: 새 예외가 추가될 때 `ANCHORED_ELSEWHERE`엔 넣었지만 JSDoc 나열은 안 고치는 경우).
  - 제안: 굳이 지금 통합할 필요는 없다 — 독자가 다른 두 진입점(사람이 읽는 문서 vs 가드가 강제하는 목록)이라 완전한 단일화는 오히려 어색하다. 다만 향후 `ANCHORED_ELSEWHERE` 항목이 늘어나면 JSDoc 쪽은 "가드 소스 참조"로 축약하고 개별 나열은 가드 파일에만 두는 방향을 고려할 만하다. 우선순위 낮음.

이 외에 CRITICAL/WARNING 급 발견은 없다. 확인한 긍정적 포인트:

- 문자열 리터럴 → enum 참조 치환은 순수 기계적 치환이며 동작 변경이 없다(값이 100% 동일).
- 새 가드는 프로젝트가 이미 채택한 "TS 소스는 정규식이 아니라 AST 파서로 읽는다" 관례를 따르고
  (`redis-fail-open-catalog-guard.ts`와 동일 패턴 — pure-logic guard + fixture + consuming spec 3분리),
  1차 정규식 스캔이 `const code = 'X'` 형태를 놓쳤던 실측을 근거로 AST 채택 이유를 명확히 남겼다.
  실제로 `npx jest engine-error-code-anchor.spec.ts` 로 재실행해 11/11 통과를 직접 확인했다.
- `collectBoundCodes` 의 3-branch AST 방문 로직은 각 분기가 공통 `record()` 헬퍼로 수렴해 검증
  로직(바인딩 이름 검사·UPPER_SNAKE 필터)이 중복되지 않는다.
- `ANCHORED_ELSEWHERE` 는 "예외" 를 봐주기가 아니라 "이미 다른 타입 앵커가 있다"는 근거와 함께
  등재하도록 강제(사유 길이 검증 + dead-entry 검증 테스트)해, 예외 목록이 조용히 미처리 항목의
  도피처가 되는 것을 막는다.
- `EngineErrorCode` 신설 JSDoc 은 "왜 파일을 안 나눴는가"(SoT 분열 방지)와 "왜 const 는 나눴는가"
  (docstring 계약 범위 준수)를 근거와 함께 설명해, 다음 사람이 같은 질문을 반복하지 않도록 한다.
- 네이밍(`EngineErrorCode`)은 기존 `ErrorCode` 컨벤션(UPPER_SNAKE 값, `as const`, `*Value` 파생
  타입)을 그대로 계승해 일관성이 높다.
- 가드 스캔 대상이 `ai-turn-orchestrator.service.ts`·`shutdown/shutdown-state.service.ts` 를 포함한
  `execution-engine` 하위 전체(재귀)이므로, 이번에 리다이렉트된 9개 지점과 여전히 앵커드-엘스웨어로
  남은 항목들이 실제로 가드 스캔 범위 안에 있음을 직접 확인했다(grep 대조 결과 가드 판정과 일치).

## 요약

이번 변경은 엔진 레이어에 흩어져 있던 맨 문자열 에러 코드 9곳을 단일 상수(`ErrorCode`/신설
`EngineErrorCode`)로 리다이렉트하는 순수 기계적 리팩터이며, 재발 방지 가드(AST 기반, fixture로
자기소멸 방지, 예외 목록에 사유 강제)까지 함께 도입해 향후 동일 결함 클래스가 재발하지 않도록
설계됐다. 새로 추가된 JSDoc/주석은 "왜 이렇게 했는가"를 근거와 함께 남겨 프로젝트 컨벤션에 부합하고,
가드 코드 자체도 중복 없이 깔끔하게 구성되어 있다. 발견된 사항은 테스트 임계값의 매직 넘버 두 곳과
문서 중복 소지 한 곳으로 전부 INFO 수준이며, 실제 유지보수 비용에 미치는 영향은 미미하다.

## 위험도

NONE
