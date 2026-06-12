# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] 모듈 로드 시 IIFE 실행 — `ivm.Isolate.createSnapshot()` 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-snapshot-perf-ff751c/codebase/backend/src/nodes/data/code/code.handler.ts` line 1041–1049
- 상세: `DAYJS_SNAPSHOT` 상수는 모듈 최상위 IIFE로 초기화된다. `ivm.Isolate.createSnapshot()`은 V8 isolate를 생성·실행·직렬화하는 무거운 연산을 **모듈 임포트 시점에 동기적으로** 실행한다. Node.js CommonJS 환경에서는 이 코드가 첫 `require('./code.handler')` 호출 시 실행되며, 실패 시 `undefined`로 조용히 fallback하도록 try/catch로 감싸져 있어 모듈 로드 자체를 깨뜨리지는 않는다. 그러나 테스트 환경에서는 모든 `describe` 블록이 파일을 임포트하는 순간 이 V8 isolate 생성이 발생하고, CI 환경에 따라 `createSnapshot`이 지원되지 않거나 예외를 던지면 fallback 경로가 탄다는 사실이 테스트 실행 중에 나타나지 않는다. 부작용 관점에서 **모듈 임포트 == V8 isolate 생성 + 스크립트 실행** 이라는 숨겨진 I/O-equivalent 연산이 추가된다.
- 제안: 현재 `try/catch` fallback이 있어 실패 시 안전하나, 문서화가 충분히 되어 있는지 확인 필요. 이미 파일 내 주석("If `createSnapshot` is unavailable/fails on a platform, this stays `undefined`")이 있어 의도는 명확하다. 단, 이 초기화가 **모듈 사이드이펙트**임을 명시적으로 문서에 남기는 것을 권장한다.

### [INFO] `DAYJS_SNAPSHOT` — 공유 모듈 수준 상태 도입
- 위치: `code.handler.ts` line 1041–1049 (`DAYJS_SNAPSHOT` 상수), line 1436–1441 (`execute()` 내 사용)
- 상세: `DAYJS_SNAPSHOT`은 모듈 수준 상수(`const`)로 선언되어 전체 프로세스 생명주기 동안 단 한 번 초기화되는 공유 상태다. 불변(`const`)이고 `ivm.ExternalCopy<ArrayBuffer>`는 각 `new ivm.Isolate({ snapshot })`마다 내부적으로 복사되어 복원되므로, 여러 `execute()` 호출 간 상태 누출은 없다. 그러나 이 snapshot 객체 자체가 `isolate.dispose()` 혹은 ivm 내부 상태에 의해 무효화될 수 있는지는 ivm 버전에 종속적이다. 현재 구현에서는 snapshot 객체를 dispose하거나 수정하는 코드가 없으므로 문제는 없다.
- 제안: ivm 버전 업그레이드 시 `ExternalCopy<ArrayBuffer>`의 수명 정책이 바뀔 경우를 대비해 `DAYJS_SNAPSHOT`이 process lifetime 동안 유효하다는 가정을 주석으로 명시해두는 것이 좋다.

### [INFO] 테스트 파일 — `beforeEach`에서 `new CodeHandler()` 재생성이 모듈 상수(`DAYJS_SNAPSHOT`)를 초기화하지 않음
- 위치: `code.handler.spec.ts` line 163–174 (`beforeEach`)
- 상세: `handler = new CodeHandler()`는 테스트마다 새 인스턴스를 만들지만, `DAYJS_SNAPSHOT`은 모듈 수준에서 한 번만 생성된다. 테스트 격리 관점에서 snapshot 오염 여부를 걱정할 수 있으나, 새로 추가된 "fresh snapshot per run" 테스트(`does NOT capture in-isolate dayjs mutations across executions`)가 실행 간 snapshot 불변성을 행동(behavioral)으로 검증하고 있어 이 점은 명시적으로 커버된다. 부작용 리스크는 없다.
- 제안: 현재 구조는 적절하다.

### [INFO] `DAYJS_LOAD_SCRIPT` — 새 모듈 수준 상수 도입 (기존 inline 식을 상수화)
- 위치: `code.handler.ts` line 1022
- 상세: 기존에 `execute()` 내부 및 snapshot 생성에서 각각 `` `${DAYJS_SOURCE}\n;globalThis.dayjs = dayjs;` ``로 인라인 작성되던 표현식을 `DAYJS_LOAD_SCRIPT` 상수로 추출했다. 이는 중복 제거로 부작용이 없고, 오히려 두 경로(snapshot path/fallback path)가 동일한 스크립트를 사용함을 보장해 일관성을 높인다.
- 제안: 현재 구조는 적절하다.

### [INFO] 시그니처 변경 없음 — `execute()` / `validate()` / `classifyCodeNodeError()` 공개 API 유지
- 위치: 전체 diff
- 상세: `CodeHandler.execute()`, `CodeHandler.validate()`, `classifyCodeNodeError()` 시그니처는 변경되지 않았다. 기존 호출자에게 영향 없음.

### [INFO] 환경 변수 — 새 읽기/쓰기 없음
- 위치: 전체 diff
- 상세: 변경된 코드에서 새로운 `process.env` 접근은 없다. 기존 `process.env.NODE_ENV` 읽기(`failure()` 내)는 변경 이전부터 존재했으며 이번 diff에서 건드리지 않았다.

### [INFO] 네트워크 호출 / 파일시스템 부작용 없음
- 위치: 전체 diff
- 상세: 추가된 코드(`DAYJS_LOAD_SCRIPT`, `DAYJS_SNAPSHOT`, snapshot path 분기, 테스트 5건)에서 새로운 네트워크 호출이나 파일시스템 쓰기는 발생하지 않는다. `readFileSync`는 기존 `DAYJS_SOURCE` 초기화에만 사용되며 이번 diff에 새로 추가된 것이 아니다.

---

## 요약

이번 변경은 `DAYJS_SNAPSHOT`이라는 모듈 수준 공유 상수를 도입하여 per-exec dayjs 재컴파일 비용을 제거하는 성능 최적화다. 가장 주목할 부작용은 **모듈 임포트 시점에 `ivm.Isolate.createSnapshot()`이 동기적으로 실행된다**는 점으로, V8 isolate 생성이 모듈 로드의 숨겨진 비용으로 추가된다. 다만 `try/catch` fallback이 있어 플랫폼 미지원 시 안전하게 무시되고, 변경으로 인한 공개 API 시그니처 변경·전역 변수 수정·파일시스템/네트워크 부작용·이벤트 콜백 변경은 없다. 새로 추가된 테스트 5건은 snapshot 기반 격리의 핵심 불변(교차 실행 오염 없음, logs 비누적, §7.3 하드닝 유지)을 행동적으로 검증하여 부작용 리스크를 명시적으로 핀다운한다.

## 위험도

LOW
