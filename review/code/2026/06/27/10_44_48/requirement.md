# 요구사항(Requirement) Review

## 발견사항

### [INFO] `GlobalCall` 타입과 런타임 실제값 간 불일치

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` L354, L444
- 상세: `GlobalCall = [method: string, ...args: unknown[]]` 는 진짜 Array 튜플 타입이나, 스텁이 `push(arguments)` 하면 런타임 항목은 `IArguments` 객체다. `existing!.q!` 를 `GlobalCall[]` 로 사용하는 코드 전반에 암묵 타입 신뢰가 있고, 테스트도 `as unknown as GlobalCall[]` 로 강제 캐스팅해 불일치를 문서화한다. 버그는 아니며 현재 fix 에서 런타임 처리가 정확히 보완되지만, 향후 타입 수준 개선(예: `GlobalCall = ArrayLike<unknown> | [method: string, ...args: unknown[]]` 또는 내부 raw queue 타입 분리) 을 고려할 수 있다.
- 제안: 현행 유지 가능. 타입 안전성 강화를 원한다면 `QueueStub.q` 의 원소 타입을 `ArrayLike<unknown>` 으로 확장하는 별도 개선 티켓으로 추적.

---

### [INFO] spec §1 가 array-like replay 를 암묵적으로만 요구 (명시 없음)

- 위치: `spec/7-channel-web-chat/2-sdk.md` §1 L28, R5 L179
- 상세: spec §1 L28 은 `push(arguments)` 스텁을 명시하고, R5 L179 는 "로더가 큐를 replay 한다" 고 선언한다. 그러나 replay 루프가 **반드시 array-like(arguments 객체) 를 수용해야 한다**는 구현 수준 요건은 spec 본문에 없다. 즉 spec 은 결과(boot 가 실행돼야 함) 를 기술하고 수단은 구현에 위임한 형태다. 본 fix 는 spec 계약에 부합하는 올바른 구현이며, spec 이 틀린 것도 아니다 — spec 표현이 약간 추상적일 뿐이다.
- 제안: 코드 유지. spec 갱신은 선택 사항(명시 강화가 필요하다면 R5 에 "큐 항목은 arguments 객체(array-like)일 수 있으므로 replay 루프는 Array.isArray 가 아닌 length 기반 array-like 로 수용해야 한다" 한 줄 추가 가능).

---

## 요약

변경된 세 파일(loader.ts, loader.spec.ts, plan doc)은 의도한 기능을 완전하고 정확하게 구현한다. 핵심 버그(replay 루프가 `Array.isArray` 로 `arguments` 객체를 버려 boot 가 실행되지 않는 문제) 는 `length` 기반 array-like 수용 + `Array.prototype.slice.call` 정규화로 올바르게 수정됐다. 수정 후 null 체크·비-객체 필터·비-문자열 메서드명 skip·replay 예외 흡수가 모두 유지돼 안전측으로 동작한다. 회귀 테스트는 실제 스텁이 만드는 array-like 큐를 정확히 재현하며(`Array.isArray(stub.q[0]) === false` 명시 포함), 기존 테스트 갭을 실증적으로 채운다. spec/7-channel-web-chat/2-sdk.md §1 L28 의 `push(arguments)` 계약 및 R5 의 "큐 replay" 요건과 완전히 일치하며 spec 변경 없이 순수 구현 버그 수정으로 처리된 것이 타당하다. plan doc 의 `spec_impact: []` 도 이와 일치한다. 발견사항은 모두 INFO 수준으로 차단 요인 없음.

## 위험도

LOW
