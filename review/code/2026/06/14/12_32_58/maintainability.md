# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: interaction.service.spec.ts

- **[INFO]** 신규 테스트 케이스(I-5)가 기존 `rejects.toMatchObject` 패턴 대신 `try/catch` 패턴으로 작성됨
  - 위치: 라인 247–273 (신규 테스트)
  - 상세: 동일 파일 내 `InvalidExecutionStateError` 계열 테스트(예: 라인 213–228, 230–245)는 모두 `await expect(...).rejects.toMatchObject(...)` 관용구를 사용한다. 신규 I-5 테스트만 `let caught: unknown; try { ... } catch (e) { caught = e; }` 패턴을 사용해 다른 테스트들과 스타일 불일치가 발생한다. 테스트 추가 시 찾아서 수정해야 할 범위가 넓어진다.
  - 제안: `await expect(service.interact(...)).rejects.toMatchObject({ status: 400, response: { error: { code: 'MESSAGE_TOO_LONG', message: 'Message exceeds the maximum allowed length.' } } })` 패턴으로 통일. `not.toContain` negative assertion 은 `rejects` resolved value 를 별도 변수로 catch 하거나 `rejects.toThrow` + inspection 으로 처리.

- **[INFO]** 매직 리터럴: 테스트에서 `MessageTooLongError(10_000, 123_456)` 수치 직접 사용
  - 위치: 라인 251
  - 상세: `10_000` 은 실제 최대 허용 길이와 동일 값이나 상수 참조 없이 인라인 하드코딩됨. 향후 한도 변경 시 spec 테이블, `MessageTooLongError` 생성자 호출, `not.toContain('10000')` 어서션 세 곳을 모두 수동으로 찾아야 함.
  - 제안: `MessageTooLongError` 모듈에서 `MAX_MESSAGE_LENGTH` 같은 상수를 export 하고 테스트에서 참조. 불가 시 인라인 주석으로 의미 명시 (`// 10_000 = 최대 허용 길이 상수와 동일`).

- **[INFO]** 테스트 설명 라벨 체계 혼재 — "변경 2.3 —" vs "I-5 —" 접두어
  - 위치: 전체 describe 블록
  - 상세: 기존 테스트 일부는 "변경 2.3 —" 접두어, 신규는 "I-5 —" 접두어를 사용한다. 두 라벨 체계가 혼재하지만 기존 파일에서도 이미 혼합 사용 중이므로 이번 변경이 추가 불일치를 유발하지는 않음. 현재 변경의 책임 범위 밖이나 장기적 정리 권장.
  - 제안: 향후 태스크 접두어 없이 동작 설명만 남기는 방향으로 통일.

---

### 파일 2: interaction.service.ts

- **[INFO]** `error.message` 를 직접 전달하는 패턴 — client-safe 불변식이 클래스 구현에 의존
  - 위치: 라인 887 — `badRequest('MESSAGE_TOO_LONG', error.message)`
  - 상세: `MessageTooLongError.message` 가 고정 client-safe 문자열(`'Message exceeds the maximum allowed length.'`)임은 `workflow-errors.ts` 생성자에서 확인된다. 이 불변식은 현재 `MessageTooLongError` 구현이 보장하지만, 서비스 코드에서 `error.message` 를 바로 전달하는 패턴은 future maintainer 가 에러 클래스를 수정할 때 노출 위험을 인지하지 못할 수 있다. 주석이 의도를 설명하고 신규 테스트가 미노출을 검증하므로 실질적 위험은 현재 낮음.
  - 제안: `MessageTooLongError.CLIENT_MESSAGE` 같은 static 상수를 참조하거나, 현재처럼 주석 + 테스트 어서션(`not.toContain`)으로 불변식을 문서화·검증하는 방식을 유지. 기존 방식도 허용 수준.

- **[INFO]** `dispatchContinuation` 내 에러 분기가 명확하고 주석 문서화 양호
  - 위치: 라인 876–890
  - 상세: `InvalidExecutionStateError` → `MessageTooLongError` → rethrow 순서로 배치. 각 블록에 spec 참조 번호와 보안 의도 주석이 있어 향후 에러 종류 추가 시 패턴을 따르기 용이함. 이슈 없음.

---

### 파일 3: plan/in-progress/eia-message-length-error-mapping.md

- **[WARNING]** 작업 체크박스 상태가 구현 완료 항목을 반영하지 않음 (프로젝트 규약 위반)
  - 위치: `## 작업` 섹션 — `be` 및 `be test` 항목
  - 상세: `interaction.service.ts` 변경과 `interaction.service.spec.ts` 신규 테스트는 이번 diff 에 포함되어 실제 구현됐으나, plan 파일의 해당 체크박스는 여전히 `[ ]` 상태. 프로젝트 규약(MEMORY: "plan 체크박스 = 실제 상태")에 따라 실제 완료 여부와 체크박스가 일치해야 한다.
  - 제안: 구현이 완료된 두 항목을 `[x]` 로 갱신.

---

### 파일 4: spec/5-system/14-external-interaction-api.md

- **[INFO]** 신규 에러 표 행(`MESSAGE_TOO_LONG`)이 기존 행보다 현저히 길어 표 가독성 저하
  - 위치: `§5.1` 에러 응답 표, `MESSAGE_TOO_LONG` 행
  - 상세: 다른 행(`INVALID_COMMAND`, `TOKEN_INVALID` 등)은 1–2 문장 이내인데 `MESSAGE_TOO_LONG` 행은 링크·괄호·설명이 중첩되어 단일 셀이 매우 길다. 정보 밀도 자체는 적절하나 표로 읽기 어렵다.
  - 제안: 표 셀은 핵심 조건(최대 길이 초과, 고정 client-safe 메시지)만 남기고 상세 cross-ref 를 표 아래 별도 note 단락으로 분리. 선호도 수준이므로 강제 변경 불필요.

---

## 요약

이번 변경은 범위가 좁고(에러 매핑 1건 + 대응 테스트 1건 + spec 1행 + plan 신규) 구현 로직 자체는 기존 패턴(`dispatchContinuation` 내 typed error → HTTP 코드 매핑)을 정확히 따르고 있어 유지보수성에 큰 위험은 없다. 주요 관심사는 두 가지다. 첫째, 신규 테스트 케이스가 동일 파일 내 유사 케이스와 다른 어서션 패턴(`try/catch` vs `rejects.toMatchObject`)을 사용해 일관성이 깨진다. 둘째, plan 파일 체크박스가 구현 완료 상태를 반영하지 않아 프로젝트 규약 위반이다. 두 항목 모두 상대적으로 소규모 수정으로 해소 가능하며, 특히 plan 체크박스 갱신은 규약상 이번 커밋에 포함되어야 한다.

## 위험도

LOW
