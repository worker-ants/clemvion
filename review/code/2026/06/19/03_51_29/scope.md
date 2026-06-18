# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: button-interaction.service.spec.ts

- **[INFO]** 기존 테스트에 `setStructuredSpy` 단언 추가 (diff +13줄, `@@ -200,6` 훵크)
  - 위치: 208–226라인 (diff 기준)
  - 상세: `processButtonResumeTurn` 의 `setStructuredOutput` 호출 여부·내용을 단언하는 spy가 추가됐다. 이는 `button-interaction.service.ts`에 신규 도입된 `buildResumedStructuredOutput` 경로가 실제로 `setStructuredOutput`을 호출함을 기존 통합 테스트 안에서 검증한다.
  - 제안: 문제 없음. 기존 테스트 케이스의 행위 보존 확인 범위 보강이며, 신규 함수 추가에 정확히 대응한다.

- **[INFO]** `resolveButtonInteraction` 격리 단위 테스트 suite 신규 추가 (~200라인)
  - 위치: diff `@@ -466,3 +491,320` — 파일 말미 신규 `describe` 블록
  - 상세: 서비스 파일에 새로 추출된 `resolveButtonInteraction` 순수함수를 격리해 4개 분기((a)port/(b)link/(b2)url 부재/(c)item-level/(d)fallback) + 에러 경로 2개 + Fix 3·4 엣지케이스를 커버한다. 임포트에 `resolveButtonInteraction`, `isButtonClickPayload`, `ButtonClickPayload`, `StructuredInteraction`, `NodeHandlerOutput`이 추가됐다.
  - 제안: 추가된 임포트는 모두 신규 테스트 대상에 직접 사용된다. 불필요한 임포트 없음.

- **[INFO]** `buildResumedStructuredOutput` 격리 단위 테스트 suite 신규 추가 (~100라인)
  - 위치: diff 파일 말미 두 번째 신규 `describe` 블록
  - 상세: `buildResumedStructuredOutput` 순수함수의 5개 변형(prevStructured undefined/Array fallback/previousOutput 체인 방지/prevMeta 조건부/port·status 보존)을 단언한다.
  - 제안: 문제 없음. 서비스 파일에 추출된 두 번째 순수함수에 대한 테스트로 범위에 정확히 부합한다.

### 파일 2: button-interaction.service.ts

- **[INFO]** `ButtonClickPayload`, `isButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction` 타입/함수 추출 및 `export` (~260라인 추가)
  - 위치: diff `@@ -31,6 +31,274` — 클래스 선언 위 모듈 레벨
  - 상세: 기존 `processButtonResumeTurn` 내부 인라인 로직(payload 분기·port 선택·output 구성)을 `resolveButtonInteraction` 순수함수로, structured output 구성 블록을 `buildResumedStructuredOutput` 순수함수로 추출했다. `export`는 테스트 파일의 직접 임포트를 위해 필요하다.
  - 제안: 문제 없음. 행위 보존 리팩토링 + 테스트 가능성 확보가 목적임이 주석/JSDoc으로 명시됐다.

- **[INFO]** `processButtonResumeTurn` 내부 인라인 로직 교체 (~89라인 제거, ~19라인 추가)
  - 위치: diff `@@ -195,18 +463,11` 및 `@@ -222,108 +483,19` 및 `@@ -335,49 +507,17`
  - 상세: 기존 `let selectedPort / interactionData / updatedOutput / structuredInteraction` + 분기 블록이 `resolveButtonInteraction(...)` 단일 호출로, structured 구성 블록이 `buildResumedStructuredOutput(...)` 호출로 교체됐다. 메서드 외부 행위(DB/emit 순서)는 변경 없다.
  - 제안: 문제 없음.

- **[INFO]** 주석 교체 (기존 인라인 주석 → 이관 안내 주석)
  - 위치: diff `-    // Process the interaction result` 블록 및 `-    // Mirror the interaction result...` 블록
  - 상세: 제거된 인라인 로직의 주석이 제거되고, 순수함수로 이동했음을 설명하는 간결한 주석으로 교체됐다. 순수함수 자체에 동일 내용의 JSDoc이 옮겨졌다.
  - 제안: 주석 변경이 로직 이동과 1:1 대응한다. 불필요한 주석 추가/삭제 없음.

## 범위 외 변경 여부

변경된 두 파일 모두 단일 작업 범위("C-1 step 버튼 인터랙션 순수함수 추출 + 격리 단위 테스트 추가")에 정확히 대응한다. 무관한 파일 수정, 설정 파일 변경, 관련 없는 리팩토링, 불필요한 임포트 정리는 일절 없다. 포맷팅 변경도 실질 변경과 뒤섞이지 않는다.

## 요약

두 파일의 변경은 `processButtonResumeTurn` 내부의 순수 결정 로직을 모듈 레벨 함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 추출하고, 그에 대응하는 격리 단위 테스트를 추가하는 단일 목적에 완전히 수렴한다. 기존 통합 테스트에 spy 단언 1개가 추가됐으나 이는 신규 `setStructuredOutput` 호출 경로 검증으로 범위 내다. 범위 외 수정, 과잉 기능 추가, 무관한 파일 변경, 불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
