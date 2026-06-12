# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### code.handler.spec.ts

- **[INFO]** 테스트 네이밍 스타일 혼재
  - 위치: 추가된 테스트 블록 전체 (lines 36, 61, 75, 94, 120, 129)
  - 상세: 기존 테스트는 `it('should ...')` 형식을 사용하나 신규 테스트 일부는 `it('reuses the lazy ...', ...)`, `it('falls back to ...')`, `it('does not spoof ...')` 등 다양한 시작 동사를 혼용한다. 동일 describe 블록 내 일관성이 낮아 나중에 실패 메시지를 읽을 때 패턴 인식이 어려워진다.
  - 제안: `describe` 블록 내 기존 `should` 접두어 규칙을 따르거나, PR 단위로 일관된 스타일 가이드를 명문화한다.

- **[INFO]** 테스트 내 인라인 타입 단언 반복
  - 위치: lines 62-68, 75-82, 94-106, 120-127
  - 상세: `(await handler.execute(...)) as unknown as { meta: { logs: string[] } }` 형태의 타입 단언이 각 테스트마다 반복된다. 동일한 단언 패턴이 4회 이상 등장하며 반환 타입이 변경되면 모든 위치를 수동으로 수정해야 한다.
  - 제안: `type ExecuteResult<T> = T` 형태의 헬퍼 타입 또는 `asExecuteResult<T>(val: unknown): T` 형태의 작은 타입 단언 헬퍼를 테스트 파일 상단에 선언하면 중복 제거와 의도 명확화를 동시에 달성할 수 있다.

- **[INFO]** isolate reuse 테스트의 루프 매직 넘버
  - 위치: line 44 (`for (let i = 0; i < 5; i++)`)
  - 상세: `5`의 의미가 코드만 보아서는 불명확하다. 주석 설명은 있으나 상수 선언 없이 인라인으로 사용되었다.
  - 제안: `const REUSE_ITERATIONS = 5;` 상수로 추출하거나 최소한 인라인 주석 `// 5회 = 재사용 내성 최소 검증 횟수` 를 추가한다.

### code.handler.ts

- **[INFO]** W14 주석 수정 — 가독성 향상 확인
  - 위치: lines 157-167 (변경된 JSDoc)
  - 상세: off-by-one 버그(+4 → +3) 수정 및 spec 교차 참조 추가로 주석의 정확성과 추적 가능성이 개선되었다. 변경 자체는 유지보수성에 긍정적이다.
  - 제안: 없음 (양호).

### http-request.handler.spec.ts

- **[WARNING]** `makeService` 호출 패턴 반복 — 새 테스트 4건 전체에 동일 setup 중복
  - 위치: lines 203-204, 230-231, 260-261, 284-285
  - 상세: 신규 테스트 블록 4개 모두 `const { service } = makeService('bearer_token', { token: 't' }); const handler = new HttpRequestHandler(service as never);` 2줄을 반복한다. 기존 `beforeEach`나 헬퍼가 있음에도 테스트 함수 내부에서 인라인 셋업을 선택한 이유가 불분명하다. 토큰값 `'t'`도 매직 문자열이다.
  - 제안: 공통 setup 을 `beforeEach` 또는 `describe` 스코프 내 공유 변수로 추출하거나, 적어도 `const TOKEN = 't';` 상수를 선언해 의도를 명시한다.

- **[WARNING]** `process.env` 수동 복원 패턴 — 테스트 격리 취약
  - 위치: lines 220-246 (`allows custom-auth private targets...` 테스트)
  - 상세: `prev = process.env.ALLOW_PRIVATE_HOST_TARGETS` → `try/finally` 복원 패턴은 기능적으로 올바르나, Jest에서는 `jest.replaceProperty` 또는 `jest.resetModules()` + `jest.spyOn(process, 'env', 'get')` 패턴이 더 관용적이며 테스트 프레임워크가 복원을 보장한다. 동일 패턴이 `http-request.handler.spec.ts` 다른 곳에도 이미 존재할 수 있으므로 일관성 문제가 될 수 있다.
  - 제안: `jest.replaceProperty(process.env, 'ALLOW_PRIVATE_HOST_TARGETS', 'true')` 사용 또는 테스트 파일 상단에 env 복원 헬퍼 함수를 정의해 재사용한다.

- **[INFO]** dry-run 테스트의 `dryRunContext` 변수 내 매직 문자열
  - 위치: lines 253-257
  - 상세: `__dryRun: true, __workspaceId: 'ws-1'` 에서 `'ws-1'`은 맥락이 없는 하드코딩 값이다. 기존 `contextWithWorkspace` 픽스처에서 사용되는 값과 일치하는지 한눈에 확인하기 어렵다.
  - 제안: `contextWithWorkspace.variables.__workspaceId` 를 참조하거나 기존 픽스처를 스프레드 확장하는 방식으로 변경하면 의도와 값의 출처가 명확해진다.

- **[INFO]** `it.each` 테스트 레이블의 세 번째 인자(`%s`) 미사용
  - 위치: lines 193-217 (`blocks authentication=%s → %s (%s) with HTTP_BLOCKED`)
  - 상세: 테스트 이름에 `(%s)` 세 번째 자리표시자가 있지만 콜백 함수 시그니처 `async (authentication, url)` 에서 세 번째 인자(`IMDS`/`RFC1918`/`localhost`)는 무시된다. 이름을 보면 세 번째 인자가 의미 있어 보여 유지보수자가 혼동할 수 있다.
  - 제안: 세 번째 인자를 콜백에서 수신하거나(`async (authentication, url, _label)`) 테스트 이름에서 `(%s)` 부분을 제거하여 시그니처와 레이블을 일치시킨다.

### backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 배열 확장 — 인라인 주석 적절
  - 위치: lines 326-332
  - 상세: 주석이 코드 추가의 맥락(refactor 04 C-3)을 명확히 기술하고 있어 가독성에 기여한다. 변경 자체는 유지보수성에 중립적이다.
  - 제안: 없음 (양호).

- **[INFO]** fallback 문자열 변수명 `fallback` 이 복수 테스트에 재선언
  - 위치: lines 342, 350
  - 상세: 두 테스트 케이스 모두 지역 `const fallback = "..."` 로 선언하는데, 이름이 동일하여 읽을 때 헷갈릴 수 있다. 더 구체적인 이름(`ssrfFallback`, `dbSsrfFallback`)이 각 케이스의 의도를 명확히 한다.
  - 제안: 각 `fallback` 변수를 목적을 반영하는 이름으로 변경한다.

### plan 파일 (markdown)

- **[INFO]** plan 파일 체크박스 업데이트의 장문 인라인 완료 주석
  - 위치: `plan/in-progress/code-node-isolated-vm-followups.md` lines 376, 382; `plan/in-progress/http-ssrf-all-auth-followups.md` line 449
  - 상세: 완료 표시와 함께 추가된 괄호 내 설명이 매우 길어(1-3줄 이상) 마크다운 편집기에서 체크박스 목록을 읽기 어렵게 만든다. 완료 근거가 중요하다면 하위 bullet 또는 별도 섹션으로 분리하는 것이 가독성에 유리하다.
  - 제안: 완료 상세 설명은 `  - 완료: ...` 하위 bullet 형식으로 분리한다. 단 기존 프로젝트 관행이 인라인 주석이라면 무시해도 무방하다.

---

## 요약

이번 변경의 핵심 코드(테스트 추가 + W14 주석 수정)는 전반적으로 기존 코드베이스 패턴을 잘 따르고 있다. 주요 유지보수성 문제는 두 가지다. 첫째, `http-request.handler.spec.ts` 의 신규 테스트 4건이 동일한 2줄 셋업(`makeService` + `new HttpRequestHandler`)을 중복 반복하며 `process.env` 복원도 프레임워크 관용 패턴 대신 수동 `try/finally` 를 사용한다. 둘째, `code.handler.spec.ts` 와 `http-request.handler.spec.ts` 모두 반환값 타입 단언과 매직 문자열이 인라인으로 흩어져 있어 반환 타입 변경 시 다수 위치를 수정해야 한다. `it.each` 레이블과 콜백 인자 불일치는 독자 혼선을 유발하는 소규모 일관성 문제다. 기능적 회귀 위험은 없으며 가독성 개선 여지가 LOW 수준으로 존재한다.

## 위험도

LOW
