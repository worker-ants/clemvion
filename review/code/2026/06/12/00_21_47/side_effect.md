# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1-2: execution-failure-classifier.ts / .spec.ts

- **[INFO]** `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED` 두 코드가 `INTERNAL_CODES` Set에 신규 등재됨
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (INTERNAL_CODES Set)
  - 상세: 변경 전에는 두 코드가 Set에 없어 unknown-fallback 경로를 타며 `Logger.warn`(CCH-ERR-04)이 발화됐다. 변경 후에는 INTERNAL_CODES 분기에서 조기 반환하므로 warn 로그가 발화되지 않는다. 반환 key(`executionFailedInternal`)는 동일하므로 호출자 쪽 UX는 변화 없음. 이 행동 변경(warn 발화 여부)은 의도된 것이며 테스트(`warnSpy.not.toHaveBeenCalled()`)로 명시적으로 검증됨.
  - 제안: 현재 상태로 충분. 추가 조치 불필요.

- **[INFO]** spec.ts의 `it.each(...)` 배열에 `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED` 추가
  - 위치: `execution-failure-classifier.spec.ts` 라인 175-194 (`it.each` 배열)
  - 상세: 동일 두 코드가 기존 `it.each` 테스트와 신규 warn-spy 테스트에 이중 등장한다. 서로 다른 사실(key 값 vs warn 미발화)을 검증하므로 의도적 이중 커버리지다. 테스트 부작용 없음.
  - 제안: 현재 상태로 충분.

---

### 파일 3: error-codes.ts

- **[INFO]** `HTTP_BLOCKED` 항목 주석 2줄 추가 (코드 자체는 이전부터 존재)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: `ErrorCode` 객체의 멤버 값(`'HTTP_BLOCKED'`)은 변경되지 않았고 주석만 추가됨. `as const` 객체이므로 런타임 값 변화 없음. 부작용 없음.
  - 제안: 없음.

---

### 파일 4-5: code.handler.ts / .spec.ts

- **[INFO]** `classifyError` → `classifyCodeNodeError` 함수명 변경 (exported)
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` (함수 선언부 + spec.ts import)
  - 상세: 이 함수는 `@internal` JSDoc 주석으로 표시되어 있고 같은 파일 내 `execute` 메서드와 spec.ts 단위 테스트에서만 호출된다. spec.ts의 import도 `classifyCodeNodeError`로 이미 갱신됨. 다른 파일에서 `classifyError`를 직접 import하는 stale 참조가 있다면 TypeScript 컴파일 단계에서 즉시 드러나므로 실질 위험은 낮음.
  - 제안: CI 빌드 통과를 통해 stale import 부재가 검증되면 충분.

- **[INFO]** `LEGACY_TO_NORMALIZED` 타입 강화 + `Object.freeze` 적용
  - 위치: `code.handler.ts` `LEGACY_TO_NORMALIZED` 상수
  - 상세: `Object.freeze`로 런타임 돌연변이가 차단된다. fallback이 `?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED`로 변경되어 미매핑 내부 코드가 공개 API로 노출되지 않는다. 현재 경로(3개 맵 항목만 존재)에서는 동작 변화 없음. 의도된 방어적 강화.
  - 제안: 없음.

---

### 파일 6: http-request.handler.ts

- **[INFO]** `'HTTP_BLOCKED'` 문자열 리터럴 2곳이 `ErrorCode.HTTP_BLOCKED`로 교체
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (SSRF 차단 catch 블록 2곳)
  - 상세: 런타임 값이 동일(`'HTTP_BLOCKED'` === `ErrorCode.HTTP_BLOCKED`). 동작 변화 없음. 새 `import { ErrorCode }`는 pure utility 모듈이므로 circular dependency 위험 없음.
  - 제안: 없음.

---

### 파일 7-8: plan/*.md

- **[INFO]** 체크박스 상태 업데이트 및 완료 노트 추가
  - 위치: `plan/in-progress/code-node-isolated-vm-followups.md`, `plan/in-progress/http-ssrf-all-auth-followups.md`
  - 상세: 마크다운 문서 편집이며 런타임 코드 부작용 없음.
  - 제안: 없음.

---

## 요약

이번 변경은 에러 코드 분류 일관성을 높이기 위한 순수 wiring 정리다. 세 가지 핵심 변화 — (1) `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED`를 classifier `INTERNAL_CODES` Set에 등재해 불필요한 CCH-ERR-04 warn 로그를 제거, (2) `classifyError` → `classifyCodeNodeError` rename으로 내부 명명 충돌 방지, (3) `HTTP_BLOCKED` 문자열 리터럴을 `ErrorCode.HTTP_BLOCKED` 참조로 교체 — 모두 런타임 UX(반환 key, error code 값)는 변경하지 않는다. 의도치 않은 전역 상태 변경·파일시스템 접근·환경 변수 변경·네트워크 호출·이벤트 리스너 변경은 없으며, rename에 따른 공개 API 영향도 `@internal` 표시와 spec.ts 동반 갱신으로 충분히 격리되어 있다.

## 위험도

NONE
