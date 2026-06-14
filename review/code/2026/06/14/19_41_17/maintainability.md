# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] `refreshPerExecution` 에서 JWT 이중 파싱
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `refreshPerExecution` 메서드
- 상세: `verifyPerExecution` 호출 후 즉시 동일 토큰을 다시 `verify(jwtPart, ...)` 로 파싱한다. `verifyPerExecution` 내부에서 이미 payload 를 파싱했음에도 `exp` 값을 꺼내기 위해 두 번 파싱하는 구조라 코드 의도가 즉각 드러나지 않는다.
- 제안: `verifyPerExecution` 반환 타입에 `exp` 를 포함시키거나, 내부 헬퍼를 통해 parsed payload 를 재사용하는 방향으로 리팩터링하면 중복 파싱·중복 로직이 제거된다. 현재 규모에서는 성능 영향이 미미하나 가독성 측면에서 의도가 불명확하다.

### [INFO] 테스트 내 인라인 매직 넘버 (job retention 임계값)
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` — `upsertJobScheduler` 단언 블록
- 상세: 테스트 단언에서 `{ age: 24 * 60 * 60 }`, `{ age: 7 * 24 * 60 * 60 }` 리터럴이 직접 사용된다. 프로덕션 코드의 `REMOVE_ON_COMPLETE_AGE_SEC` / `REMOVE_ON_FAIL_AGE_SEC` 상수가 변경될 경우 테스트가 자동으로 실패하지 않아 묵시적 drift 가 발생한다.
- 제안: 프로덕션 상수를 테스트 파일에 import 해 동일 값을 참조하거나, 해당 상수를 `terminal-revoke-reconciler.types.ts` 에 같이 export 해 공유한다.

### [INFO] `interaction.controller.ts` — Guard 미적용 방어 코드 중복·메시지 불일치
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — `interact`, `cancel`, `refreshToken`, `getStatus` 핸들러
- 상세: `if (!ctx) throw new Error('interaction context missing...')` 패턴이 네 핸들러에 반복된다. `interact` 는 `'interaction context missing — Guard 미적용?'`, 나머지 셋은 `'interaction context missing'` 으로 메시지가 불일치한다.
- 제안: private 헬퍼 `requireInteractionContext(req)` 로 추출해 단일 throw 포인트·단일 메시지로 통일한다.

### [INFO] `interact` 메서드 파라미터 네이밍 불일치 (`executionId` vs `_executionId`)
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — `interact` 메서드
- 상세: `void executionId;` 로 의도적 미사용을 처리하고 있으나, 동일 파일의 `cancel`, `refreshToken`, `getStatus` 는 `_executionId` prefix 컨벤션을 사용해 일관성이 없다.
- 제안: `interact` 파라미터도 `_executionId` 로 rename 하고 `void executionId;` 줄을 제거한다.

### [INFO] `makeService` 함수 이름 shadowing (테스트 파일)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — outer `makeService`(line 208) 와 `reconcileTerminalRevocations` describe 블록 내 재선언(line 491)
- 상세: 동일 파일에 `makeService` 라는 이름의 함수가 두 개 존재하며, 내부 함수가 outer scope 함수를 shadowing 한다. 테스트 블록 진입 시 어떤 `makeService` 가 호출되는지 즉각 파악하기 어렵고, 실수로 wrong scope 함수를 호출해도 컴파일 오류가 없다.
- 제안: 내부 함수를 `makeReconcileService` 처럼 고유한 이름으로 rename 해 shadowing 을 제거한다.

## 요약

이번 변경은 `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 별도 types 파일로 분리해 순환 의존 없이 외부 소비자가 참조하도록 하고, 하드코딩된 dev fallback secret 을 ephemeral random 으로 교체하며, Swagger 응답 데코레이터를 래핑 헬퍼로 통일하고, reconcile 경계 케이스 테스트를 추가하는 것이다. 전반적으로 SRP·관심사 분리 방향이 일관되고 상수·Spec 참조 주석도 충실해 유지보수성 기반이 탄탄하다. 발견된 사항들은 모두 INFO 수준으로, 기능 버그나 설계 결함 없이 소규모 정리(이중 파싱 단순화, 테스트 상수 공유, 방어 코드 헬퍼 추출, 네이밍 통일)로 가독성을 더 높일 수 있다.

## 위험도

NONE
