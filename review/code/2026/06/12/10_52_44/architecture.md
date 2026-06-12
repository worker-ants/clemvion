# Architecture Review

## 발견사항

### [INFO] 모듈 수준 전역 가변 상태 — `syntaxIsolate` 와 `DAYJS_SNAPSHOT`
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `let syntaxIsolate` (모듈 변수), `const DAYJS_SNAPSHOT` (IIFE 초기화 모듈 상수)
- **상세**: `syntaxIsolate`는 모듈 범위 가변 변수로 `CodeHandler` 인스턴스와 분리된 상태를 유지한다. `DAYJS_SNAPSHOT`은 모듈 로드 시 side-effect(ivm snapshot 생성)를 갖는다. 두 요소 모두 `CodeHandler` 클래스 외부에 존재해 단일 책임 원칙(SRP) 경계를 흐린다 — 핸들러 클래스를 인스턴스화하면 암묵적으로 모듈 전역 상태를 공유하게 된다. 이는 테스트 격리를 약화시킬 수 있으며, 다중 `CodeHandler` 인스턴스(현재는 드물지만 향후 가능)가 생길 경우 예상치 못한 공유 상태가 된다.
- **제안**: 단기적으로는 현재 구조가 JS 단일 스레드 + 모듈 싱글톤 특성상 실용적이며 허용 가능하다. 장기적으로는 `syntaxIsolate` 를 `SyntaxChecker` 전용 클래스나 `CodeHandler`의 private static 멤버로 캡슐화하고, `DAYJS_SNAPSHOT`도 `CodeIsolateFactory`류 책임으로 분리하면 SRP와 테스트 격리가 개선된다. W4 (`_buildIsolateContext()` 추출 계획)와 함께 수행하면 자연스럽다.

### [INFO] `execute()` 메서드의 과도한 책임 집중 (SRP / 응집도)
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` `CodeHandler.execute()` (약 150줄)
- **상세**: `execute()`는 단일 메서드 내에서 (1) isolate 생성 전략 결정(snapshot vs. bare), (2) jail context 구성 및 host callback 주입, (3) dayjs 로드 조건 분기, (4) bootstrap 실행, (5) 사용자 코드 컴파일, (6) dual-timeout 레이스, (7) `$vars` 동기화, (8) 성공 응답 조립 등 8가지 이상의 책임을 수행한다. 이번 변경으로 isolate 생성 분기(`DAYJS_SNAPSHOT ? ... : ...`)와 dayjs 로드 조건(`if (!DAYJS_SNAPSHOT)`)이 추가되어 이미 복잡한 메서드에 조건 경로가 더해졌다.
- **제안**: 이는 plan의 W4 (`_buildIsolateContext()` / `_runWithTimeout()` 추출)에 이미 등재된 항목이다. snapshot 분기가 추가된 지금, `_buildIsolateContext()` 내부에서 `DAYJS_SNAPSHOT` 유무를 캡슐화하면 `execute()` 의 분기 복잡성이 줄어든다. 기능·보안 영향 없는 가독성·유지보수성 개선이므로 우선순위를 높이는 것을 권장한다.

### [INFO] 스냅샷 생성 실패의 무음 폴백 — 관측 가능성 부재
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` `DAYJS_SNAPSHOT` IIFE `catch` 블록
- **상세**: `createSnapshot` 실패 시 `return undefined`로 조용히 폴백하여 레거시 per-exec 컴파일 경로로 전환된다. 이는 플랫폼 호환성 측면에서 의도된 설계이지만, 실패가 로그 없이 삼켜지면 운영 환경에서 성능 저하가 기대치 이하임을 진단할 방법이 없다. 레이어 책임 관점에서, 인프라 레벨 초기화 실패가 비즈니스 레이어(`execute()`)에서 암묵적으로 처리된다.
- **제안**: `catch` 블록에 `console.warn` 또는 구조화 로거 호출을 추가해 스냅샷 미지원 플랫폼에서 명시적 경고가 발생하도록 한다. 예: `console.warn('[CodeHandler] DAYJS_SNAPSHOT unavailable, falling back to per-exec compile:', err)`. 운영 레벨 관측 가능성이 개선된다.

### [INFO] 테스트 구조: 새 `describe` 블록의 경계 적절성
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.spec.ts` `describe('execute — dayjs snapshot path (perf follow-up)')`
- **상세**: 새 describe 블록은 snapshot 경로만을 대상으로 하는 것처럼 명명되었으나, 기존 `execute()` 호출 경로와 동일한 `CodeHandler` 인스턴스를 사용한다. 주석에 "every execute() now goes through it"이라 명시되어 있어 사실상 snapshot 경로가 아닌 다른 경로란 없다. 테스트 경계 명칭과 실제 범위 사이의 미묘한 불일치가 있지만, 분리된 명세 목적("snapshot 도입 후 특성 고정")은 명확하다.
- **제안**: describe 설명을 `'execute — snapshot parity & isolation contracts'`처럼 계약 중심 명명으로 변경하면 "snapshot 경로 전용 테스트"라는 오해를 줄일 수 있다. 기능 영향 없는 가독성 개선.

### [INFO] `deepClone`의 `JSON.parse/stringify` 제한 — 추상화 불충분
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` `deepClone()`
- **상세**: 이번 변경과 직접 관련은 없으나 `$vars` copy-out fallback 로직과 연계된 기존 구조다. `deepClone`이 `JSON.parse(JSON.stringify(value))`를 사용해 `undefined`·`Date`·순환 참조 등을 처리하지 못한다. 이미 `$vars.notClonable = () => 1` 케이스를 테스트로 명시하고 있어 이 제한을 인지하고 있음은 확인되나, 추상화 수준에서 함수명이 "deep clone"이라는 일반적 기대와 실제 동작 간 간극이 있다.
- **제안**: 함수명을 `jsonClone` 또는 `structuredCloneOrNull`로 변경하거나, JSDoc에 "JSON-safe only" 명시를 추가해 의도를 드러낸다. 이는 이번 PR 범위 밖이나 코드 가독성 측면에서 유의미하다.

---

## 요약

이번 변경(dayjs 히프 스냅샷 성능 최적화)은 아키텍처적으로 기존 격리 설계를 올바르게 따른다. `DAYJS_SNAPSHOT`은 모듈 상수로 한 번만 생성되고 각 실행마다 `new ivm.Isolate({ snapshot })`으로 fresh isolate를 생성해 메모리 격리 불변을 유지하며, host callback과 §7.3 하드닝은 per-exec BOOTSTRAP_SOURCE에 유지되어 캡처-삭제 순서(W13)가 보존된다. 설계 결정의 트레이드오프(snapshot 불변 내용만 베이크, 동적 per-exec 상태는 격리)가 코드와 주석 양쪽에 잘 문서화되어 있다. 주요 아키텍처 우려사항은 `execute()` 메서드의 증가하는 복잡성(W4로 이미 추적 중)과 모듈 전역 가변 상태(`syntaxIsolate`)이며, 이는 기존 구조의 누적 문제다. 스냅샷 생성 실패의 무음 폴백은 관측 가능성 측면에서 개선 여지가 있다. 전반적으로 보안·기능 경계는 명확히 유지되며 확장성 리스크는 낮다.

## 위험도

LOW
