# Testing 관점 코드 리뷰

## 발견사항

### [WARNING] 단일 테스트 케이스 내 이중 단언 패턴 — 첫 단언 실패 시 두 번째 단언 미실행
- 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`, 122–135행
- 상세: `WORKSPACE_ID_REQUIRED` 코드 단언 테스트가 `expect(() => factory(undefined, ctx)).toThrow(BadRequestException)` 를 먼저 실행한 뒤, `try/catch` 블록에서 factory 를 다시 호출해 응답 본문을 검증한다. 첫 `expect().toThrow()` 가 통과하면 factory 를 두 번 호출하는 구조이며, 첫 호출이 예기치 않게 통과할 경우(`throw` 미발생) `catch` 블록이 실행되지 않아 핵심 단언인 `code: 'WORKSPACE_ID_REQUIRED'` 검증이 누락된다.
- 제안: `toThrow` 선행 검사를 제거하거나, Jest 의 `.toThrow` + `.toThrowError` 매처 체인, 또는 `expect().rejects` 패턴을 사용해 단일 호출로 양쪽을 모두 검증한다. 예:
  ```ts
  expect(() => factory(undefined, ctx)).toThrowError(
    expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' })
  );
  ```
  혹은 공식적으로 지원하는 패턴:
  ```ts
  let caughtError: unknown;
  expect(() => {
    try { factory(undefined, ctx); }
    catch (e) { caughtError = e; throw e; }
  }).toThrow(BadRequestException);
  expect((caughtError as BadRequestException).getResponse()).toEqual(
    expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }),
  );
  ```

### [INFO] 빈 문자열 헤더 케이스 테스트가 에러 코드까지 단언하지 않음
- 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`, 137–141행
- 상세: `X-Workspace-Id` 헤더가 빈 문자열일 때 `BadRequestException` 을 throw 함을 확인하나, `code: 'WORKSPACE_ID_REQUIRED'` 포함 여부를 단언하지 않는다. 앞서 추가된 WORKSPACE_ID_REQUIRED 단언 테스트와 일관성이 없고, 빈 문자열 경로가 다른 코드를 발행할 경우 탐지가 안 된다.
- 제안: 위 WARNING 패턴과 동일하게 `getResponse()` 까지 단언하도록 보완한다.

### [INFO] `user` 가 `null` 인 케이스와 `undefined` 인 케이스에 대해 에러 코드 단언 누락
- 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`, 143–153행
- 상세: `user` 가 `undefined` 또는 `null` 일 때의 두 케이스도 예외 타입만 확인하며 `code` 단언이 없다. 동일한 코드 경로를 타는지 보장하기 어렵다.
- 제안: 세 "throw" 케이스 모두 동일 `code: 'WORKSPACE_ID_REQUIRED'` 를 발행함을 단언하거나, 공통 헬퍼 함수로 추출해 반복을 줄인다.

### [INFO] 신규 `ERROR_KO['WORKSPACE_ID_REQUIRED']` 항목에 대한 i18n parity 테스트 자동 커버 여부 확인 권장
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`, 758–759행
- 상세: 파일 상단 주석에 "i18n guard CI check verifies both directions" 라는 언급이 있고, `__tests__/backend-labels.test.ts` 에 P3-C-2 parity guard 가 있다고 명시되어 있다. 신규 `ERROR_KO['WORKSPACE_ID_REQUIRED']` 항목이 해당 guard 의 커버리지 목록에 포함되어 있는지 — 즉 guard 가 user-facing 코드 목록에 이 항목이 존재함을 검증하는지 확인이 필요하다. guard 가 manual 등록 기반이라면 누락될 수 있다.
- 제안: `backend-labels.test.ts` 의 P3-C-2 guard 가 `WORKSPACE_ID_REQUIRED` 를 포함하고 있는지 점검한다. 포함되어 있으면 문제 없음.

### [INFO] 스펙/플랜 파일(파일 3~8) — 코드 변경 아님, 테스트 대상 없음
- 위치: 파일 3(`plan/in-progress/chat-channel-followups-batch.md`), 4(`spec-sync-chat-channel-gaps.md`), 5(`spec/5-system/1-auth.md`), 6(`spec/5-system/11-mcp-client.md`), 7(`spec/5-system/15-chat-channel.md`), 8(`spec/conventions/error-codes.md`)
- 상세: 이 파일들은 순수 문서 변경(spec, plan tracking)으로 코드 실행 경로가 없다. 테스트 대상이 아니다.

---

## 요약

테스트 관점에서 가장 유의미한 변경은 `workspace.decorator.spec.ts` 의 신규 단언 추가다. `WORKSPACE_ID_REQUIRED` 코드 단언 의도는 명확하나, 구현이 `expect().toThrow()` + `try/catch` 이중 호출 패턴을 사용해 첫 단언 실패 시 핵심 코드 단언이 실행되지 않는 잠재적 커버리지 사각이 존재한다. 빈 문자열·null·undefined 케이스도 예외 타입만 확인하고 에러 코드 단언이 빠져 있어 일관성이 아쉽다. `backend-labels.ts` 의 `ERROR_KO` 신규 항목은 기존 CI parity guard 에 자동 포함되는지 확인이 필요하다. 스펙/플랜 문서 변경은 테스트 영향이 없다.

## 위험도

LOW
