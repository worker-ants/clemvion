# 요구사항(Requirement) Review — websocket M-3/M-6/m-3/m-5 (refactor 06 concurrency)

## 발견사항

- **[INFO]** plan 체크박스가 구현 완료를 반영하지 않음 (plan-lifecycle 규약 위반 가능성)
  - 위치: `plan/in-progress/refactor/06-concurrency.md:146`(M-3), `:222`(M-6), `:289`(m-3), `:321`(m-5) — 모두 `- [ ] 미착수`
  - 상세: 본 diff 는 M-3(backend join/leave await+롤백), M-6(frontend off-before-on 이중 등록 방어), m-3(ws-client active pending 가드), m-5(dismiss hysteresis) 4개 항목을 모두 코드와 대응 unit 테스트로 구현했다. 그러나 plan 파일 자체는 이번 diff 범위에 없어 여전히 "미착수" 로 표기돼 있다. 프로젝트 메모(“plan 체크박스 = 실제 상태”)와 `.claude/docs/plan-lifecycle.md` 관례상 구현 완료 시 plan 체크박스도 같은 커밋/PR 로 갱신돼야 한다.
  - 제안: 이 코드 변경을 커밋할 때 `plan/in-progress/refactor/06-concurrency.md` 의 M-3/M-6/m-3/m-5 4개 항목에 완료 근거(커밋 해시·검증 결과)를 채워 `- [x]` 로 갱신. (코드 자체의 결함은 아니므로 CRITICAL/WARNING 아님.)

- **[INFO]** M-3 신규 실패 ack 문자열이 spec §3.3/§3.4 예시에 없음 — 정합 위반은 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:279` — `error: 'Subscription failed — please retry'`
  - 상세: spec §3.3 은 "평문 `error` 문자열" 이라는 shape 계약만 규정하고 개별 문자열을 전수 열거하지 않는다(§3.4 의 `Maximum subscriptions...` 도 마찬가지 패턴). 새 문자열은 기존 `{success:false, error:string}` shape 를 그대로 재사용하므로 §3.3 계약과 충돌하지 않는다. plan M-3 의 "§3.3 기존 shape 재사용" 지시와도 일치.
  - 제안: 조치 불필요. 필요 시 §3.3 표에 예시 문구 하나로 추가 가능하나 필수는 아님.

## 점검 관점별 요약

1. **기능 완전성** — 4개 plan 항목(M-3/M-6/m-3/m-5) 모두 “권장” 옵션(A) 그대로 구현됨. join 실패 시 tentative-add 롤백 + 실패 ack, leave 는 best-effort(예외 삼킴), frontend 이벤트 바인딩은 등록 직전 `off→on` 으로 멱등화, `ws-client.connect()` 는 `socket.active` 까지 가드해 connecting 중 재호출 시 churn 을 막음, snapshot warning toast 는 1초 dismiss hysteresis. 모두 대응 unit 테스트가 diff 에 포함돼 있고 assert 값이 구현과 정확히 일치(예: `connectOffCalls.length` 2→4, `resumedOffCalls.length` 1→2 재계산이 `bind` 의 이중 off 카운트와 수학적으로 맞음).
2. **엣지 케이스** — join reject 시 Set 미오염(`subs.has(channel)===false`) 확인 테스트 존재. TOCTOU 동시 subscribe 레이스 기존 테스트(`enforces MAX_SUBSCRIPTIONS...`)가 `join` mock 기본값(`undefined` resolve) 과 `await` 도입 후에도 여전히 통과하는 구조(성공 케이스에서만 `toHaveBeenCalledTimes(successes)`). unsubscribe 도중 pending join 이 뒤늦게 성공/실패해도 `clientSubs` 상태 오염 없음(idempotent delete).
3. **TODO/FIXME** — 변경 hunk 내 TODO/FIXME/HACK/XXX 주석 없음.
4. **의도-구현 일치** — 주석("M-3", "m-3", "m-5", "M-6") 이 가리키는 plan 항목 번호와 실제 동작이 1:1 대응. `disconnect` 경로 leave 는 의도적으로 fire-and-forget 유지(주석에 이유 명시: socket.io auto-leave + await 실익 없음) — M-3 스코프를 subscribe/unsubscribe 로 한정한 plan 설명(“leave 도 await”는 unsubscribe 한정)과 일치.
5. **에러 시나리오** — join 실패(reject) → catch 에서 롤백+warn 로그+실패 ack. leave 실패 → warn 만, ack 는 success:true 유지(“멤버십은 disconnect 시 정리” 로 설계된 대로). connect_error / active 상태에서의 재호출도 커버.
6. **데이터 유효성** — 채널 유효성 검사·authorizer·max-subscription 가드는 기존 로직 그대로이며 M-3 변경이 이 앞단 검증 순서를 변경하지 않음(join await 는 모든 가드 통과 후 최종 단계).
7. **비즈니스 로직** — “tentative-add 후 사후 검증” 패턴(§3.4 20개 한도)과 join 롤백이 함께 있어도 순서 충돌 없음: `clientSubs.add` → 한도 초과 시 즉시 롤백 반환 → 그 다음에만 `join` 시도. join 실패 롤백은 이후 스텝이라 한도 로직과 독립적으로 안전.
8. **반환값** — `handleSubscribe`/`handleUnsubscribe` 는 이제 async 로 전환됐고 모든 코드 경로에서 `{event, data}` 를 반환(타입 시그니처도 `Promise<...>` 로 정확히 갱신). 테스트도 `await` 로 갱신됨.
9. **spec fidelity** — `spec/5-system/6-websocket-protocol.md` §3.3/§3.4 대비 ack shape·에러 문자열 정책 모두 유지. spec 이 join/leave 의 await 여부를 규정하지 않는 영역(plan 상 "spec 대조: B")이라 이번 변경은 spec 침묵 영역의 강건성 보강 — 드리프트 아님, spec 갱신도 plan 상 "불요" 로 명시돼 있고 실제로 spec 변경이 diff 에 없음(일치).

## 요약

이번 diff 는 `plan/in-progress/refactor/06-concurrency.md` 의 M-3(join/leave await+롤백), M-6(frontend 이벤트 이중 등록 방어), m-3(ws-client pending 가드), m-5(dismiss hysteresis) 4개 항목을 plan 이 명시한 “권장 옵션 A” 그대로 정확히 구현했다. 각 항목마다 대응 unit 테스트가 함께 추가/갱신됐고 assert 값(off 호출 횟수 등)이 구현 로직과 수학적으로 정합한다. spec(§3.3/§3.4) 은 이 영역에 침묵하며 plan 도 "spec 갱신 불요" 로 판단했는데 실제로 spec 변경이 없어 일치한다. TODO/FIXME 등 미완성 흔적 없음, 에러 경로(join 실패 롤백, leave best-effort)도 명확히 정의됨. 유일한 gap 은 코드 결함이 아니라 plan 체크박스 4건이 아직 “미착수”로 남아있는 프로세스 동기화 이슈(같은 PR 로 함께 갱신 권장).

## 위험도

NONE
