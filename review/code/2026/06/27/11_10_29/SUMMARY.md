# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 버그 1건(boot 재호출 stuck state)·보안 미완결 2건(DoS 가드)·테스트 갭 1건을 포함한 WARNING 12건; Critical 없음. 핵심 버그 픽스(array-like arguments 큐 replay)는 올바르게 구현됨.

## Critical 발견사항

_해당 없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | boot 재호출 시 `instance.shutdown()` 예외가 new instance 생성을 막아 복구 불가 stuck state 발생 | `loader.ts` `case "boot":` (L52–58) | `shutdown()` 을 try-catch 로 감싸고 예외 여부와 무관하게 `instance = null` 후 `bootFn` 호출 |
| 2 | 보안 | `updateProfile` 에 payload 크기 제한 없음 — 임의 크기 객체 반복 전송으로 메모리·서버 부하 가능 | `loader.ts` L74, `index.ts` L105 | `JSON.stringify(profile).length > MAX_PROFILE_BYTES` 가드 추가 |
| 3 | 보안 | `sendMessage` 에 길이 제한 없음 — 수 MB 문자열 반복 전송으로 postMessage 버퍼·서버 처리 부하 가능 | `loader.ts` L72, `index.ts` L104 | `text.length > MAX_MESSAGE_LENGTH` 가드 추가, 초과 시 warn + 절단 또는 무시 |
| 4 | 보안 | iframe sandbox `allow-scripts + allow-same-origin` 조합 — 동일 origin 배포 실수 시 sandbox 무력화 | `bridge.ts` L62 | `widgetOrigin !== window.location.origin` 런타임 어서션 추가 또는 `allow-same-origin` 제거 가능 여부 재검토 |
| 5 | 요구사항 | spec §1 의 `ClemvionChat('off', { event, cb })` 객체 형태가 코드의 위치 인자 방식(`off, event, cb?`)과 불일치 | `loader.ts` L87–91 | spec §1 문구 정정(`project-planner` 위임) 또는 객체 형태 분기 추가 |
| 6 | 부작용 / 요구사항 | `case "off":` 에서 `cb` 가 함수가 아닐 때 `instance.off(event, undefined)` 호출 — 런타임 구현이 `undefined` 를 "전체 해제"로 처리하지 않으면 의도치 않은 동작 | `loader.ts` L84–90 | `ChatInstance.off` 구현에서 `undefined` 처리 명세 확인, 또는 단항 호출(`off(event)`)로 분기 |
| 7 | 유지보수성 | 매직 넘버 `32` (replay 루프 인자 개수 상한) — 의도 불투명 | `loader.ts` L139 | `const MAX_QUEUE_CALL_ARITY = 32;` named constant 로 추출 |
| 8 | 유지보수성 | replay 루프 내 5개 OR 조건 인라인 나열 — 가독성·독립 테스트 어려움 | `loader.ts` L134–142 | `function isValidQueueEntry(raw: unknown): raw is ArrayLike<unknown>` type predicate 헬퍼로 추출 |
| 9 | 유지보수성 | 부트 설정 픽스처 `{ apiBase: "a", triggerEndpointPath: "t" }` 10회 이상 리터럴 반복 | `loader.spec.ts` 전체 | `const BOOT_CONFIG_FIXTURE = { ... } satisfies BootConfig;` 상수 선언 후 참조 |
| 10 | 유지보수성 | `QueueStub` 스텁 초기화 패턴 2회 중복 | `loader.spec.ts` L278–282, L374–377 | `function makeQueueStub(): QueueStub` 헬퍼 추출 후 재사용 |
| 11 | 테스트 | replay 루프 내 malformed 항목 방어 가드 5개 분기 미테스트 — 가드 삭제/오수정 시 회귀 탐지 불가 | `loader.ts` L134–144, `loader.spec.ts` 전체 | null·원시값·`length > 32`·`args[0]` 비문자열 케이스 각각 테스트 추가 |
| 12 | 테스트 / 부작용 | 커스텀 전역명(`SupportChat`) cleanup 이 테스트 바디 내 위치 — assertion 실패 시 후속 테스트 전역 오염 | `loader.spec.ts` L332–345 | `afterEach` 또는 `try/finally` 로 cleanup 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 큐 항목 인자 수 상한 `32` 가드가 spec 에 미명세 — 합리적 방어 구현이나 spec 에 누락 | `loader.ts` L140 | spec §1 또는 §R5 에 "인자 수 32 초과 시 skip" 문구 추가 |
| 2 | 보안 | `globalName` 이 `constructor` 등 내장 함수 프로퍼티명이면 점유 가드 미통과로 `window.constructor` 덮어쓰기 | `loader.ts` L113–129 | 허용 전역명 정규식(`/^[A-Za-z_$][A-Za-z0-9_$]*$/`) 화이트리스트 검증 추가 |
| 3 | 보안 | `apiBase` URL 프로토콜·형식 미검증 — `javascript:` 스킴 등 통과 가능 | `index.ts` L55–59 | `new URL(config.apiBase)` 파싱 + `protocol === "https:"` 검증 추가 |
| 4 | 보안 | `wc:event` 페이로드가 origin 검증 후에도 콜백으로 무검증 전달 | `bridge.ts` L150–153 | SDK 문서·타입에 "콜백 수신 데이터 신뢰 수준 검증 후 사용" 주석 명시 |
| 5 | 보안 | 큐 전체 항목 수 무제한 — SPA 지연 로드 시 대량 적재 가능 | `loader.ts` L132–150 | `queued.slice(0, MAX_QUEUE_LENGTH)` 상한 설정 |
| 6 | 요구사항 | `QueueStub.q` 타입이 `GlobalCall[]` 이나 런타임 원소는 `arguments` array-like — 거짓 정밀도 | `loader.ts` L44 | `q?: (GlobalCall \| ArrayLike<unknown>)[]` 로 수정 또는 주석 경고 추가 |
| 7 | 요구사항 / 테스트 | `on()` 반환값(`Unsubscribe` 함수) 전파 미테스트 | `loader.spec.ts` L213–222 | `const unsub = api("on", ...); unsub(); expect(inst.calls).toContain("unsub");` 추가 |
| 8 | 요구사항 | `sendMessage` 에 `args[0]` null/undefined 시 빈 문자열 전송 — spec 에 빈 문자열 유효성 미명시 | `loader.ts` L73 | spec 에 빈 문자열 처리 명시 또는 현행 유지 |
| 9 | 부작용 | 점유 가드 분리 인스턴스 반환이 호출자에게 설치 실패 미통보 | `loader.ts` L118–124 | TSDoc 에 "점유 가드 시 분리 인스턴스 반환(window 미수정)" 명시 |
| 10 | 부작용 | `Array.from(raw)` 가 불연속 인덱스 항목으로 sparse array 생성 가능 | `loader.ts` L143 | 정상 스텁은 연속 인덱스이므로 실위험 낮음 — 경계 조건으로 기록 |
| 11 | 유지보수성 | 변수명 `w` — 의미 약한 단축 이름 | `loader.ts` L113 | `winRecord` 또는 `winAsRecord` 로 변경 |
| 12 | 유지보수성 | 테스트 주석 한/영 혼용 (영어 주석 3건) | `loader.spec.ts` L378–380 | 한국어로 통일 |
| 13 | 유지보수성 | `fakeInstance` 반환 교차 타입 익명 — 파일 간 재사용 시 타입 복제 필요 | `loader.spec.ts` L176 | `type FakeChatInstance = ChatInstance & { calls: string[] };` 선언 후 교체 |
| 14 | 테스트 | `sendMessage`/`updateProfile` null·undefined fallback 동작 미테스트 | `loader.ts` L72–74 | null args 로 호출 후 `inst.calls` 에 `"send:"` / `"updateProfile:{}"` 확인 |
| 15 | 테스트 | `q` 프로퍼티 없는 큐 스텁 함수(빈 큐 fallback 분기) 미테스트 | `loader.ts` L128 | `q` 없는 함수 스텁 설치 후 `installGlobal` 정상 실행 검증 |
| 16 | 테스트 | `boot` 반환값(`ChatInstance`) 미검증 | `loader.ts` L57–58 | `const result = api("boot", ...); expect(result).toBe(inst);` 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | updateProfile/sendMessage 크기 제한 미구현, sandbox 조합, URL 미검증 |
| requirement | LOW | off 스니펫 형태 spec/코드 불일치(WARNING), SPEC-DRIFT 큐 상한 미명세 |
| scope | NONE | 변경 범위 적절, 방어 가드 소폭 초과는 허용 범위 내 |
| side_effect | LOW | boot 재호출 shutdown 예외 stuck state(WARNING), off undefined 인자 |
| maintainability | LOW | 매직 넘버·복합 조건·픽스처 반복·스텁 초기화 중복(WARNING 4건) |
| testing | LOW | 방어 가드 분기 미테스트·커스텀 전역 cleanup 격리 미흡(WARNING 2건) |

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 보고)

## 권장 조치사항
1. **[즉시]** `case "boot":` 내 `instance?.shutdown()` 을 try-catch 로 감싸 stuck state 방지 — `loader.ts` L52–58
2. **[즉시]** replay 루프 방어 가드(null·원시값·`length > 32`·비문자열 메서드명) 단위 테스트 추가 — `loader.spec.ts`
3. **[단기]** `off` 메서드: spec §1 `ClemvionChat('off', { event, cb })` 객체 형태 vs 위치 인자 불일치 방향 확정 — project-planner 검토 또는 spec 정정
4. **[단기]** `updateProfile` / `sendMessage` 입력 크기 가드 추가 — `index.ts`
5. **[단기]** 커스텀 전역명 cleanup 을 `afterEach` 또는 `try/finally` 로 이동 — `loader.spec.ts` L332–345
6. **[단기]** 매직 넘버 `32` → `MAX_QUEUE_CALL_ARITY` named constant 추출; replay 가드 5-OR 조건 → `isValidQueueEntry` 헬퍼 추출
7. **[단기]** 부트 설정 픽스처 상수화 + `QueueStub` 초기화 헬퍼 추출 — `loader.spec.ts`
8. **[중기]** [SPEC-DRIFT] spec §1·§R5 에 큐 항목 인자 수 32 제한 문구 추가 — project-planner 위임
9. **[중기]** `apiBase` URL 프로토콜(`https:`) 검증 추가 — `index.ts` `validateBootConfig`
10. **[중기]** `on()` 반환값(Unsubscribe), `boot` 반환값, null args fallback 테스트 보완 — `loader.spec.ts`
11. **[낮음]** iframe sandbox `allow-same-origin` 조합 런타임 어서션 추가 또는 필요성 재검토 — `bridge.ts`

## 라우터 결정

라우터가 선별 실행:

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명, 전원 router_safety 강제 포함)
- **제외**: 8명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 선별 제외 |
| architecture | router 선별 제외 |
| documentation | router 선별 제외 |
| dependency | router 선별 제외 |
| database | router 선별 제외 |
| concurrency | router 선별 제외 |
| api_contract | router 선별 제외 |
| user_guide_sync | router 선별 제외 |

- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명)