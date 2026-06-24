# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `dispatchParkEntry` 반환 타입이 `Promise<ProcessTurnResult>` 인데, 매칭 핸들러가 없을 경우 `undefined` 를 반환한다.
  - 위치: `execution-engine.service.ts` — `dispatchParkEntry` 메서드 (`return handler ? handler.handle(ctx) : undefined`)
  - 상세: TypeScript 상 반환 타입 선언과 실제 반환값이 불일치(`undefined`를 반환하지만 타입은 `Promise<ProcessTurnResult>`)한다. 런타임에서 호출측은 `=== PARK_RELEASED` 비교만 하기 때문에 undefined가 오면 비교가 단순히 false가 되어 안전하게 처리된다. 그러나 타입 안정성 관점에서 호출측이 미래에 반환값을 다른 방식으로 사용할 경우 unexpected behavior 위험이 있다. 보안 취약점으로 직결되지는 않지만 방어적 코드 측면에서 언급한다.
  - 제안: 반환 타입을 `Promise<ProcessTurnResult | undefined>` 로 명시하거나, 매칭 실패 시 명시적 early return 처리를 문서화한다.

- **[INFO]** `assertSameWorkspace` 에서 workspace 격리 강제 (fail-closed 설계) 가 올바르게 구현되어 있다.
  - 위치: `execution-engine.service.ts` 라인 889-903
  - 상세: `callerWorkspaceId` 가 없는 경우 즉시 `WorkflowForbiddenWorkspaceError` 를 throw 하는 deny-by-default 패턴이 적용되어 있다. 이는 인가(authorization) 측면에서 바람직한 설계다.
  - 제안: 현 구현 유지.

- **[INFO]** `ai_message` 길이 가드가 `applyContinuation` 에만 적용되어 있다.
  - 위치: `execution-engine.service.ts` 라인 1061-1076
  - 상세: 이번 변경(M-4)과 직접 관련은 없으나, 동일 서비스의 `continueButtonClick` 등 다른 진입점에 동일한 가드가 일관되게 적용되어 있는지 주의가 필요하다. 이번 PR diff 범위에서는 신규 취약점이 발견되지 않는다.
  - 제안: 다른 continuation 진입점에서도 길이 가드 적용 여부를 별도로 확인한다.

- **[INFO]** `park-entry-dispatch.ts` 는 순수한 팩토리/인터페이스 모듈로, 외부 입력 처리나 인증/인가 로직을 포함하지 않는다.
  - 위치: `park-entry-dispatch.ts` 전체
  - 상세: 이 파일은 dispatch registry 구조만 정의하며 직접적인 보안 민감 동작이 없다. 입력 검증·인증·시크릿 등의 보안 요소가 없어 해당 없음.

- **[INFO]** `park-entry-dispatch.spec.ts` 는 테스트 파일이며 mock 만 포함한다.
  - 위치: `park-entry-dispatch.spec.ts` 전체
  - 상세: 하드코딩된 시크릿, 실제 자격증명, 민감 데이터가 없다. 테스트에서 사용하는 `{ type: 'x' }` 등은 더미 값이다.

## 요약

이번 M-4 리팩터링은 기존 3곳에 중복됐던 park 진입 dispatch 분기(`form/buttons/ai`)를 `ParkEntryDispatch` registry 패턴으로 일원화한 behavior-preserving 변경이다. 신규 추가된 코드(`park-entry-dispatch.ts`, `park-entry-dispatch.spec.ts`)는 외부 입력 처리·인증·암호화·시크릿 등 보안 민감 요소를 포함하지 않는 순수 구조적 리팩터링이다. 기존에 이미 구현된 workspace 격리(fail-closed), ai_message 길이 가드, 서브워크플로우 재귀 깊이 제한(`MAX_RECURSION_DEPTH = 10`) 등의 보안 통제는 그대로 보존된다. 인젝션 취약점, 하드코딩된 시크릿, 권한 검증 누락, 안전하지 않은 암호화, 민감 정보 노출 등 OWASP Top 10 항목에 해당하는 신규 취약점은 발견되지 않았다.

## 위험도

NONE
