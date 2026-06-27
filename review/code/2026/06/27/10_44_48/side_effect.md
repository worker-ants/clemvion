# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `GlobalCall` 타입 export — 기존부터 export 되어 있던 타입
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` 7행
  - 상세: `export type GlobalCall`은 변경 전에도 이미 export 선언이 있었다. `loader.spec.ts`가 이번에 해당 타입을 import 목록에 추가했을 뿐이다. 타입은 컴파일 타임 전용이며 런타임에 아무 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 큐 항목 수용 범위 확장 — 의도된 입력 타입 확장
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` 104–119행
  - 상세: 이전 코드는 `Array.isArray(call)` 가드로 진짜 Array만 수락했다. 새 코드는 `typeof item === "object" && item !== null && typeof item.length === "number"` 조건으로 array-like 객체(arguments 포함)도 수락한다. 이는 의도된 버그 수정이다. 단, 이 변경으로 `q` 배열에 우연히 `length` 숫자 프로퍼티를 가진 일반 객체가 들어있을 경우 이전엔 무시됐으나 이제 처리 시도된다. 현실적으로 `q`는 오직 스텁의 `push(arguments)` 경로만을 통해 채워지므로 오염 가능성은 없으며, 설령 이상 객체가 들어오더라도 `args[0]` 문자열 가드와 `try/catch`가 추가 방어층으로 작동한다.
  - 제안: 조치 불필요. 현재 방어 계층(object 타입 체크 → length 숫자 체크 → args[0] 문자열 체크 → try/catch)이 충분하다.

- **[INFO]** `Array.prototype.slice.call` — 소스 객체 비변이 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` 113행
  - 상세: `Array.prototype.slice.call(item)`은 새 배열을 생성하며 원본 `item`(arguments 객체)을 변이하지 않는다. `queued` 배열 자체도 변이되지 않는다. `NaN`·음수·소수 `length` 등 비정상 값에서도 빈 배열을 반환하므로 `args[0]` 문자열 가드에서 안전하게 skip된다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트의 `window.ClemvionChat` 전역 상태 관리
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts` 44–61행 (신규 테스트)
  - 상세: 신규 테스트는 `window.ClemvionChat`에 스텁을 할당한 뒤 `installGlobal`로 real dispatcher로 교체한다. 이미 존재하는 `afterEach(() => delete window.ClemvionChat)` 블록이 이를 정리하므로 테스트 간 전역 오염이 없다. 커스텀 `warn` spy나 전역 모킹도 사용하지 않는다.
  - 제안: 조치 불필요.

## 요약

이번 변경의 부작용 관점 위험 요소는 사실상 없다. 핵심 수정인 replay 루프의 `Array.isArray` → array-like 수용 전환은 `window[globalName]` 전역 교체(`w[globalName] = api`)나 `api.__wcInstalled` 마킹 등 기존 상태 기계를 전혀 바꾸지 않는다. 함수 시그니처(`installGlobal`, `createGlobalApi`, `GlobalApi`, `QueueStub`)는 모두 유지되며 호출자에 영향 없다. 파일시스템·환경 변수·네트워크 호출은 관여하지 않는다. `GlobalCall` 타입 export는 변경 전부터 존재했고 이번에 테스트 import만 추가됐다. 변경이 일으키는 유일한 행동 차이(arguments 객체 항목이 이제 replay됨)는 버그 수정의 명시적 목표다.

## 위험도

NONE
