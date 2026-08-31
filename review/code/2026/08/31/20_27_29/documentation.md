# 문서화(Documentation) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 변경(신규 `EngineErrorCode` 레이어 + AST 앵커 가드)에 대한 항목이 없다
  - 위치: `CHANGELOG.md` (미변경 — `git diff origin/main --stat` 기준 이번 커밋(`adc4a3ff6`)이 건드린 8개 파일에 포함되지 않음)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 사용자-가시적 변경뿐 아니라 **가드/하드닝 전용 변경도 일관되게 기록**하는 확립된 관례를 갖고 있다. 예컨대 가장 최근 항목 `## Unreleased — raw UPDATE/DELETE … RETURNING 회귀 가드를 큐레이션에서 발견형으로 확장했다` 는 동작 변경이 전혀 없는 "가드 로직 강화" 항목인데도 등재돼 있다. 이번 PR 은 그와 정확히 같은 성격이다 — 동작 변경 없이 (a) `error-codes.ts` 에 새 공개 상수 `EngineErrorCode`/`EngineErrorCodeValue` 를 신설하고, (b) 엔진 모듈 9개 지점의 맨 문자열 에러 코드를 상수 참조로 리다이렉트하고, (c) 향후 회귀를 막는 신규 repo-guard(AST 기반, 11개 테스트)를 추가했다. 무게감·성격이 이미 로그된 다른 항목들과 동등한데 `CHANGELOG.md` 편집이 diff 에 없다.
  - 제안: `## Unreleased` 섹션에 커밋 본문(9지점 리다이렉트, "파일 분리" 대신 "파일은 하나·const 는 둘" 설계, AST 가드 신설, 뮤테이션 검증)을 요약한 항목을 추가한다.

## 확인된 사항 (참고용 — 결함 아님)

리뷰 중 교차검증한 주요 문서화 항목은 전부 정확했다:

- `EngineErrorCode` 의 JSDoc(왜 별도 const 인지, "파일은 하나·const 는 둘" 설계 근거)이 같은 파일 상단의 `ErrorCode` 독스트링("canonical code strings 는 one source of truth")과 실제로 일치함을 grep 으로 확인(`codebase/backend/src/nodes/core/error-codes.ts:96,123`).
- "여기 있는 넷은 전부 맨 문자열이었다(2026-08-31 실측: 5지점)" 주장 — diff 상 실제 리다이렉트 지점(execution-engine.service.ts 3곳 + shutdown-state.service.ts 2곳 = 5곳, 코드 4종)과 정확히 일치.
- `ANCHORED_ELSEWHERE` 6개 항목(`INVALID_EXECUTION_STATE`/`ERROR_PORT_FALLBACK`/trigger 4종)의 "이미 타입 앵커가 있다"는 근거를 `workflow-errors.ts:114`, `execution-engine.service.ts` `ErrorPortFallbackError.code`, `trigger-parameter.types.ts:29-32,42,50,58,69` 에서 직접 확인 — 서술이 실제 코드와 일치.
- `EngineErrorCode.WORKER_HEARTBEAT_TIMEOUT` JSDoc 의 SoT 링크 `../../../../../spec/conventions/error-codes.md`(상대경로 5단계) 가 `codebase/backend/src/nodes/core/` 기준으로 실제 `spec/conventions/error-codes.md` 에 정확히 착지함을 경로 계산으로 확인. 그 문서 §3 의 `WORKER_HEARTBEAT_TIMEOUT` historical-artifact 행 서술과도 내용이 정합.
- `plan/complete/exec-intake-followups.md` 신규 상호링크(`../complete/spec-draft-webchat-execution-residuals.md`)와, 그 반대편 `spec-draft-webchat-execution-residuals.md:310` 의 `./exec-intake-followups.md` 링크가 이동 후 **양방향 모두 실제로 착지**함을 확인 — 커밋 메시지의 "이동으로 bare 상대링크가 고쳐졌다" 주장이 사실과 일치(이동 전에는 `plan/in-progress/` 에 있어 후자 링크가 깨져 있었을 것).
- `readDeclaredCodes` 문턱값 `expect(declared.size).toBeGreaterThan(30)` — 실제 `ErrorCode`(36) + `EngineErrorCode`(4) = 40 으로 여유 있게 충족, vacuous 하지 않음.
- `error-codes.ts` 내 신규 JSDoc 이 언급하는 "정규식이 JSDoc 예시(`EXECUTION_TIMEOUT`)를 값으로 잘못 주울 수 있다"는 우려는 실제로 그 파일 70번째 줄 주석에 `EXECUTION_TIMEOUT` 예시가 존재함을 확인 — AST 채택 근거가 지어낸 것이 아님.
- `spec/conventions/error-codes.md` §1 "적용 범위" 는 이미 코드 문자열 전반(어느 const 에 있든)에 적용되도록 넓게 쓰여 있어, `EngineErrorCode` 신설 자체가 그 convention 문서의 정정을 요구하지는 않음(스코프 진술이 여전히 참).

## 요약

이번 변경은 순수 리팩터링(맨 문자열 9곳 → 타입 앵커 상수)과 신규 AST 기반 회귀 가드 도입이며, 코드에 동반된 JSDoc·주석의 품질과 정확성이 매우 높다 — 설계 근거·SoT 링크·예외 목록 사유를 모두 grep/경로계산으로 교차검증했고 전부 실제 코드와 일치했다. 유일한 실질적 문서화 갭은 `CHANGELOG.md` 미갱신으로, 이 저장소가 동일 성격(가드/하드닝, 무동작변경)의 과거 변경들을 일관되게 `## Unreleased` 에 기록해 온 확립된 관례에서 벗어난다.

## 위험도

LOW
