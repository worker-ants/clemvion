# 부작용(Side Effect) Review

## 발견사항

### [INFO] 테스트 파일에서 동일 조건의 factory 이중 호출 (workspace.decorator.spec.ts)

- 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts` 라인 122~135
- 상세: 첫 번째 테스트 케이스(`WORKSPACE_ID_REQUIRED` 코드 단언)에서 `factory(undefined, ctx)`가 동일 컨텍스트에 대해 두 번 호출된다 — `expect(() => ...).toThrow(...)` 1회 + `try { factory(...) }` 1회. `factory`가 호출될 때 외부 상태를 변경하지 않는다면 무해하지만, 데코레이터 팩토리가 내부적으로 요청 횟수를 추적하거나 부작용이 있는 경우 이중 호출이 예기치 않은 상태를 만들 수 있다. 현재 `@WorkspaceId()` 데코레이터는 `createParamDecorator`로 구현된 순수 읽기 함수여서 실질적 부작용은 없으나, 테스트 패턴으로서는 idiomatic하지 않다(단언 방식을 단일 try/catch 또는 `expect().toThrow()`만으로 통일 권장).
- 제안: 두 번 호출을 하나로 통합하거나, `toThrow` + `getResponse` 단언을 jest의 `expect(...).rejects`/커스텀 matcher로 단일 패스화한다.

### [INFO] `ERROR_KO` 객체에 새 전역 상수 항목 추가 (backend-labels.ts)

- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 객체 라인 756~759
- 상세: `WORKSPACE_ID_REQUIRED` 항목이 모듈 레벨 `const ERROR_KO` 객체에 추가된다. 이 객체는 모듈 초기화 시 한 번 생성되고 이후 읽기 전용으로 사용되므로 런타임 변이(mutation)는 없다. `translateBackendError` 함수는 `ERROR_KO[code]` 조회만 하며 객체를 수정하지 않는다. 부작용 없음.
- 제안: 해당 없음.

### [INFO] i18n 가드 CI 게이트 의존 확인 필요 (backend-labels.ts)

- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 파일 설명 주석 "i18n Principle 3 — synchronization on both add and remove"
- 상세: 파일 주석에 따르면 i18n 가드 CI가 `backend-labels.ts` 의 키와 백엔드 에러 코드 목록 사이의 parity를 검증한다. `WORKSPACE_ID_REQUIRED`가 `ERROR_KO`에 추가되었으나, 백엔드 `ErrorCode` enum에 해당 값이 이미 존재하는지 본 리뷰 범위 내에서 직접 확인되지 않는다. plan 파일에서 이 검증을 CI 단계로 언급하고 있으며(`/consistency-check --impl-done` BLOCK:NO 체크), 가드가 정상 동작하면 불일치는 차단된다. 부작용은 없지만 가드 통과 여부를 명시적으로 확인할 것을 권장한다.
- 제안: `plan/in-progress/chat-channel-followups-batch.md`의 `/consistency-check --impl-done` 체크박스를 수행하여 parity 확인 완료.

### [INFO] spec/plan 문서 변경 — 런타임 부작용 없음

- 위치: `plan/in-progress/chat-channel-followups-batch.md`, `plan/in-progress/spec-sync-chat-channel-gaps.md`, `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/error-codes.md`
- 상세: 이 파일들은 문서 전용 변경으로, 어떠한 런타임 상태·전역 변수·파일시스템·네트워크 호출·이벤트/콜백에도 영향을 미치지 않는다. 내용상으로는 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` rename 이력 등재, MakeShop Internal Bridge 행 추가, 인증 토큰 24h 유효 동기화, R-CC-18 Rationale 신설 등이 포함된다. 모두 단일 진실(SoT)을 강화하는 방향이며 외부 API 계약 변경이 없다.
- 제안: 해당 없음.

## 요약

이번 변경 전체에서 의미 있는 런타임 부작용은 식별되지 않는다. 코드 변경은 테스트 파일(`workspace.decorator.spec.ts`)과 i18n 상수 파일(`backend-labels.ts`) 두 곳에 한정된다. 테스트 파일에서는 동일 컨텍스트에 대해 `factory`가 이중 호출되나, 해당 팩토리는 순수 읽기 함수여서 실질적 부작용이 없다. `ERROR_KO` 객체는 모듈 레벨 상수로 초기화 후 불변이므로 전역 변이가 없다. 나머지 파일은 모두 문서(`spec/` · `plan/`)로 런타임에 영향이 없다. 공개 API 시그니처 변경, 환경 변수 도입, 파일시스템 부작용, 네트워크 호출, 이벤트/콜백 변경은 전혀 없다.

## 위험도

NONE
