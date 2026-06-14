### 발견사항

- **[INFO]** `dispatchContinuation` 에 `MessageTooLongError` catch 블록 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/codebase/backend/src/modules/external-interaction/interaction.service.ts` 라인 882~888 (`dispatchContinuation` private 메서드 내부)
  - 상세: 기존 `throw error` rethrow 경로 앞에 `instanceof MessageTooLongError` 분기를 삽입해 `badRequest('MESSAGE_TOO_LONG', error.message)` 를 throw 한다. `error.message` 는 `MessageTooLongError` 생성자가 고정 client-safe 문자열로 설정한다고 주석으로 명시되어 있으며, 내부 길이 수치(`maxLength`, `actualLength`)는 `error.message` 에 포함되지 않는다. 전역/공유 상태 변경 없음. 함수 시그니처 변경 없음.
  - 제안: `MessageTooLongError.message` 가 실제로 고정 문자열인지 `workflow-errors.ts` 생성자에서 한 번 더 확인 권장 (테스트 I-5 에서 `'Message exceeds the maximum allowed length.'` 를 단언하고 있어 사실상 검증되어 있음).

- **[INFO]** `MessageTooLongError` import 추가 (서비스·스펙 파일 2곳)
  - 위치: `interaction.service.ts` 라인 614~616, `interaction.service.spec.ts` 라인 36~39
  - 상세: `../execution-engine/workflow-errors` 에서 named import 하나 추가. 모듈 범위에서 전역 변수 도입 없음. 기존 `InvalidExecutionStateError` import 는 유지됨.
  - 제안: 없음.

- **[INFO]** `interaction.service.spec.ts` 에 테스트 케이스 I-5 추가
  - 위치: 라인 247~273
  - 상세: 순수 단위 테스트. `mockRejectedValueOnce` 로 `MessageTooLongError(10_000, 123_456)` 를 injection 하며 실제 엔진·DB 호출 없음. 공유 상태·전역 변수 없음. `try/catch` 패턴으로 예외 body 를 직접 검증하며, `body.message` 에 `'123456'`·`'10000'` 문자열이 포함되지 않음을 `not.toContain` 으로 단언해 내부 수치 누출을 명시적으로 차단.
  - 제안: 없음.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` 에러 표에 `400 MESSAGE_TOO_LONG` 행 추가
  - 위치: 라인 1013 (에러 표 내 단일 행)
  - 상세: 문서 변경 — 런타임 부작용 없음. 기존 행의 순서·내용 변경 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/eia-message-length-error-mapping.md` 신규 파일 생성
  - 위치: `plan/in-progress/` 디렉터리
  - 상세: 작업 추적 문서 신규 생성. 런타임 부작용 없음. 파일시스템 상에 새 파일이 생기는 의도된 변경.
  - 제안: 없음.

### 요약

이번 변경은 `dispatchContinuation` private 메서드 내부에만 한정된 error-mapping 추가로, 함수 시그니처·공개 API·전역 상태·환경 변수·네트워크 호출에 영향을 주지 않는다. `MessageTooLongError` 는 기존 `throw error` 경로 직전에 catch 되어 `BadRequestException(400)` 으로 변환될 뿐이며, `error.message` 가 고정 문자열임을 테스트가 `not.toContain` 으로 직접 검증하고 있어 내부 길이 수치 누출 경로도 차단된다. 기존 호출자(`interact` 메서드)의 시그니처와 반환 타입은 변경되지 않았고, 다른 명령(`submit_form`, `click_button`, `end_conversation`)에 대한 동작도 영향을 받지 않는다. 의도하지 않은 부작용은 발견되지 않았다.

### 위험도

NONE
