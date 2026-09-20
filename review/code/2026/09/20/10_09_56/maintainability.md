# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 같은 `catch` 블록 안에서 동일한 표현식 `err instanceof Error ? err.message : String(err)` 이 두 번 반복 계산된다 — 형제 호출부들과 스타일이 어긋난다.
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:272` 와 `:279` (같은 `catch (err)` 블록, 게이트 270~280)
  - 상세: `database-connection-tester.ts`(같은 PR, `const detail = err instanceof Error ? err.message : String(err);` 를 catch 진입 직후 한 번만 계산)와 `http-request.handler.ts`(`const detail = ...` 를 357번 줄에서 한 번만 계산)는 이 표현식을 catch 블록 최상단에서 한 번만 계산해 `detail` 로 재사용한다. 그런데 같은 PR 의 `database-query.handler.ts` 만 `logger.warn` 호출과 `sanitizeMessage` 호출에서 각각 다시 인라인 계산한다 — 같은 diff 안에서 세 곳 중 한 곳만 다른 패턴을 쓴다.
  - 제안: catch 진입부에서 `const detail = err instanceof Error ? err.message : String(err);` 로 한 번 뽑아 `logger.warn` 과 `sanitizeMessage(detail)` 양쪽에서 재사용하면 형제 파일들과 스타일이 맞고, 표현식이 두 번 어긋날 여지(예: 한쪽만 고치는 실수)도 없어진다.

- **[INFO]** «가드가 판정(`SsrfBlockedError`) 이 아닌 오류를 던지면 분류되지 않은 실패로 승격한다» 는 `if (!(err instanceof SsrfBlockedError)) { logger.warn(...); return/throw ... }` 형태가 호출부 넷(`database-connection-tester.ts`, `database-query.handler.ts`, `http-request.handler.ts`, `http-redirect.ts`)에 구조적으로 반복된다. 코멘트 문구도 거의 동일하게 네 번 반복된다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (guard 함수), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:270`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (`outboundBlockReason`)
  - 상세: 다만 각 호출부가 판정 아닌 오류를 처리하는 방식(응답 객체 반환 vs `throw`, 사용하는 에러 코드, usage 로그 기록 여부)이 서로 달라 얇은 공용 헬퍼로 묶으면 파라미터가 늘어나 오히려 가독성이 떨어질 수 있다. 이 중복은 이미 이 PR 이 직접 만든 1라운드 리뷰(`review/code/2026/09/20/09_35_16/SUMMARY.md` INFO 1)에서 지적되었고, `RESOLUTION.md` 는 "공용 헬퍼 추출은 트래커의 «공용 가드를 중립 위치로 이동» 항목과 결이 같다"는 근거로 조치를 보류했다 — 새로운 지적이 아니라 기존 트래킹된 판단의 재확인이다.
  - 제안: 지금 조치는 불필요. 다만 가드가 향후 두 번째 판정 아닌 예외 유형(예: 타임아웃)까지 구분해야 하는 시점이 오면, 그때는 4곳을 개별로 손대기보다 이번에 보류한 공용 위치 이동과 함께 헬퍼 추출을 재고할 가치가 있다.

- **[INFO]** 신규 테스트 파일 4곳(`database-connection-tester.spec.ts`, `database-query.handler.spec.ts`, `http-request.handler.spec.ts`, `http-redirect.spec.ts`)이 거의 동일한 `jest.mock(..., () => ({ ...jest.requireActual(...), <guardFn>: jest.fn(...) }))` 보일러플레이트와 그 위의 설명 주석을 반복한다.
  - 위치: 각 spec 파일의 `jest.mock('../../nodes/integration/http-request/http-safety')` (또는 `.js`) 블록
  - 상세: Jest 모듈 mock 은 파일마다 독립적으로 선언해야 하는 특성상 흔한 형태이며, 공용 헬퍼로 뽑아도 각 파일에서 여전히 `jest.mock` 팩토리를 인라인으로 써야 하는 Jest 의 hoisting 제약 때문에 실질적 절감이 크지 않다.
  - 제안: 현재로선 조치 불필요. 다섯 번째 소비자가 같은 패턴을 또 추가하게 되면 공용 `mockSsrfGuard()` 헬퍼(테스트 유틸)를 고려.

## 요약

이번 변경은 SSRF 가드의 "차단 판정"과 "가드 자체의 고장"을 네 호출부에서 갈라내는 작업으로, 각 파일에 왜 그렇게 분기하는지를 설명하는 JSDoc/인라인 주석이 충실하고, 새 테스트 이름도 한국어 서술형으로 기존 스타일과 일관되며 의도가 분기별로 명확하다. 네이밍(`SsrfBlockedError`, `INTEGRATION_CALL_FAILED` 등)과 매직 넘버는 기존 상수/컨벤션을 그대로 재사용해 새로 도입된 것이 없다. 유일하게 실질적인 흠은 `database-query.handler.ts` 의 한 `catch` 블록 안에서 동일 표현식이 형제 파일들과 달리 두 번 인라인 반복되는 작은 스타일 불일치이며, 판정 분기 구조 자체의 4파일 반복은 이미 직전 리뷰 라운드에서 식별되어 근거와 함께 보류된 사안이라 새로 조치를 요구하지 않는다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
