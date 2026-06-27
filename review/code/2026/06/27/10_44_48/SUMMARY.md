# Code Review 통합 보고서

## 전체 위험도
**LOW** — `arguments`-replay 버그 수정은 정확하고 범위 이탈이 없다. 단 CHANGELOG.md 누락이 WARNING 1건이며, 나머지 발견사항은 모두 INFO 수준이다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | CHANGELOG.md 에 이번 사용자 가시적 버그픽스 항목 누락. 리포지토리에 "Unreleased" 패턴이 존재하며, 위젯 auto-boot 무증상 누락(#709 원인) 수정은 기록 대상이다. | `CHANGELOG.md` — Unreleased 섹션 | `## Unreleased` 에 "웹채팅 로더 `arguments`-replay 버그 수정 — `Array.isArray` 가드가 스텁의 `arguments` 객체를 drop 하여 auto-boot 가 무음 누락되던 문제 해소, 회귀 테스트 추가" 1–2줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `length` 상한 없는 array-like 처리 — `{ length: 1e9 }` 형태 주입 시 거대 희소 배열 생성 시도 가능. 전제: 동일 페이지 스크립트 실행 권한 필요 | `loader.ts` — `installGlobal` replay 루프 | `if (!Number.isFinite(len) \|\| len > 32)` 형태 상한 가드 추가 |
| 2 | Security | `globalName` 이 `"__proto__"` / `"constructor"` 일 때 프로토타입 체인 덮어쓰기 이론적 가능. 전제: HTML `data-global` 제어권 또는 XSS 선행 필요 | `loader.ts` — `w[globalName] = api` | 진입부에서 `["__proto__", "constructor", "prototype"]` 차단 가드 추가 |
| 3 | Security | 큐에서 유래한 `apiBase` 로 임의 외부 서버 `boot` 시도 가능. 이번 변경 이전에도 동일 위험 존재 — 신규 공격 표면 추가 아님 | `loader.ts` — `dispatch` case `"boot"` | SDK `boot` 레이어에서 `apiBase` 도메인 화이트리스트/same-origin 검증 (현재 변경 범위 밖) |
| 4 | Security | `console.warn` 에 외부 입력(메서드 명) 포함 — 외부 로깅 연동 시 로그 인젝션 경미 가능성 | `loader.ts` — default case | 외부 로깅 연동 시 메서드 명 최대 64자 제한 또는 알파벳/숫자/하이픈 이외 문자 치환 권장 |
| 5 | Requirement / Testing / Documentation | `GlobalCall = [method: string, ...args: unknown[]]` 는 tuple 타입이나 런타임 큐 항목은 `arguments` 객체(array-like). 타입 정의 자체에 이 불일치가 문서화되지 않아 향후 동일 버그 재발 가능성 잠재 | `loader.ts` L7, L12; `GlobalCall` 타입 정의 위 | `GlobalCall` 타입 선언 위에 "런타임 실제 형태는 `arguments` 객체일 수 있음 — 이 타입은 logical shape" 주석 추가; `QueueStub.q` 원소 타입을 `ArrayLike<unknown>` 으로 확장하는 별도 티켓 추적 가능 |
| 6 | Requirement | spec §1 L28 은 `push(arguments)` 스텁을 명시하나, replay 루프가 array-like 를 수용해야 한다는 구현 수준 요건은 spec 본문에 없음. 현재 fix 는 spec 계약에 부합하며 spec 변경 없이 순수 구현 버그 수정 처리가 타당 | `spec/7-channel-web-chat/2-sdk.md` §1 / R5 | 선택 사항: R5 에 "큐 항목은 `arguments` 객체(array-like)일 수 있으므로 replay 루프는 `length` 기반 수용이 필요하다" 한 줄 추가 가능 |
| 7 | Maintainability | 중간 변수 `item` 이 불필요한 이름 중복 추가 — `queuedCall` → `item` 재바인딩으로 동일 값에 두 이름이 생겨 추적 비용 증가 | `loader.ts` L104-105 | 조건식을 `queuedCall as unknown` 인라인 캐스팅으로 통합하거나 `isArrayLike()` 타입 가드 함수로 분리 |
| 8 | Maintainability | `Array.prototype.slice.call(item)` 대신 `Array.from(item)` 이 "array-like → Array" 의도를 더 명확히 표현 | `loader.ts` L113 | `const args = Array.from(item as ArrayLike<unknown>);` 로 교체 |
| 9 | Maintainability | 루프 전 주석 블록이 5행 — 역사적 배경과 spec 참조 혼재로 스캔 비용 증가 | `loader.ts` L99-103 | 2행 내외로 압축하고 상세 분석은 plan 문서 참조로 대체 |
| 10 | Maintainability / Testing | 기존 테스트와 신규 테스트의 스텁 생성 방식(rest-parameter Array vs `.q` 직접 주입) 불일치에 설명 주석 없음 | `loader.spec.ts` L113-114, L130-147 | 신규 테스트 스텁 선언 직전에 "의도: 실제 큐 로직 없이 `.q` 직접 주입 — `push(arguments)` 산출물 정확히 재현" 한 줄 주석 추가 |
| 11 | Testing | 신규 회귀 테스트가 실제 native `arguments` 객체 대신 plain object `{ 0: "boot", 1: {...}, length: 2 }` 사용 — `Array.prototype.slice.call` 동작상 동일하나 재현 충실도 미흡 | `loader.spec.ts` L135-136 | `function captureArgs() { return arguments; }` 패턴으로 실제 `arguments` 객체 사용 (선택 사항, 현재 검증 충분) |
| 12 | Testing | 기존 첫 번째 replay 테스트가 rest-parameter Array 를 push — production 스텁의 `push(arguments)` 패턴과 불일치하며 #709 실제 버그를 드러내지 않음 | `loader.spec.ts` L113-114 | 테스트 주석에 "Array push 사용(production 과 상이) — Array 경로 회귀 검증 목적" 명시 |
| 13 | Testing | boot 예외 발생 + array-like 큐 항목 결합 시나리오 미검증 (두 동작은 독립적이므로 실질 위험 낮음) | `loader.spec.ts` L197-219 | 현재 커버리지 수준으로 허용 가능. 필요 시 Info#16 테스트를 array-like 항목으로 교체 |
| 14 | Testing | filter 로직 reject 경로(비-객체·null·`length` 없는 객체) 에 대한 명시적 음성 테스트 없음 | `loader.ts` L106-111 | `stub.q = [null, 42, {}, { length: "x" }, bootArgs]` 형태 혼합 큐 테스트 추가 고려 |
| 15 | Documentation | README 큐 설명이 `arguments` 객체 호환성 보장이 설계 의도임을 명시하지 않음 (기능 설명 자체는 정확) | `codebase/packages/web-chat-sdk/README.md` L52 | "스텁은 `push(arguments)` 패턴이므로 큐 항목은 array-like — 로더는 이를 정규화해 replay함" 한 줄 추가 (선택 사항) |
| 16 | Scope | 루프 변수명 `call` → `queuedCall` rename 이 버그 수정 블록에 포함 — 기능 영향 없으나 별도 커밋 분리 관행 권장 | `loader.ts` replay 루프 헤더 | 현재 차단 불필요. 향후 스타일 변경은 별도 커밋 분리 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | array-like 상한 가드 없음·`globalName` 프로토타입 오염 이론적 가능 (모두 same-origin 신뢰 모델 내부) |
| requirement | LOW | `GlobalCall` 타입 vs 런타임 불일치·spec array-like 명시 부재 (spec 계약은 충족) |
| scope | NONE | 루프 변수명 rename 이 버그 수정 블록에 혼재 — 실질 영향 없음 |
| side_effect | NONE | 수용 범위 확장은 의도된 fix, 다층 방어 충분, 테스트 격리 정상 |
| maintainability | LOW | 변수 중복·`Array.prototype.slice.call` vs `Array.from`·주석 길이·스텁 주석 부재 |
| testing | LOW | 신규 테스트 plain object 사용·기존 테스트 Array push 불일치·음성 테스트 없음 |
| documentation | LOW | CHANGELOG.md 버그픽스 항목 누락 (WARNING), `GlobalCall` JSDoc 없음 |

## 발견 없는 에이전트

없음 — 모든 실행 에이전트에서 발견사항 존재 (scope·side_effect 는 NONE 위험도이지만 INFO 발견 있음).

## 권장 조치사항

1. **CHANGELOG.md 업데이트** (WARNING): `## Unreleased` 섹션에 `arguments`-replay 버그 수정 항목 추가 — 사용자 가시적 버그이며 배포 릴리즈 노트 대상이다.
2. **`GlobalCall` 타입 JSDoc 추가** (INFO, 재발 방지): 타입 정의 위에 "런타임 항목은 `arguments` 객체일 수 있음 — `Array.isArray` 대신 `length` 기반 guard 후 `Array.from` 정규화" 주석 추가.
3. **`Array.prototype.slice.call` → `Array.from` 교체** (INFO): 코드 가독성 개선, 1줄 수정.
4. **중간 변수 `item` 제거** (INFO): `queuedCall as unknown` 인라인 캐스팅으로 이름 중복 해소.
5. **루프 전 주석 압축** (INFO): 5행 주석을 2행 내외로 단축하고 plan 문서를 참조.
6. **스텁 생성 방식 주석 추가** (INFO): 신규 테스트 스텁 직전에 `.q` 직접 주입 의도 한 줄 명시.
7. **`globalName` 프로토타입 오염 방어 가드** (INFO, 심층 방어): `["__proto__", "constructor", "prototype"]` 차단 가드 — 낮은 실질 위협이나 방어적 추가 가능.
8. **`length` 상한 가드** (INFO): `len > 32` 상한 추가 고려 — DoS 실질 위협 낮으나 방어적 추가 가능.

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing=done`).

- **실행 (7명)**: security, requirement, scope, side_effect, maintainability, testing, documentation
- **강제 포함 (router_safety, 7명)**: documentation, maintainability, requirement, scope, security, side_effect, testing

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 해당 없음 — 작은 버그 수정 범위 |
| architecture | 해당 없음 — 아키텍처 변경 없음 |
| dependency | 해당 없음 — 의존성 변경 없음 |
| database | 해당 없음 — DB 접근 없음 |
| concurrency | 해당 없음 — 비동기/동시성 변경 없음 |
| api_contract | 해당 없음 — API 계약 변경 없음 |
| user_guide_sync | 해당 없음 — 사용자 가이드 변경 없음 |