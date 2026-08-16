# RESOLUTION — `09_51_00` (branch `claude/eia-terminal-error-sanitize-audit`)

Critical **0** · Warning **10** · INFO 6. Warning 8건 반영, 2건은 근거와 함께 무조치.

---

## W1 (requirement) — 내 주장이 또 구현보다 넓었다 · **주장을 좁혔다**

지적이 맞다. 커밋 메시지·plan 에 *"연결 문자열이 마스킹된다"* 고 썼는데 무수정 프로브로 재니
거짓이다:

| 입력 | 결과 |
|---|---|
| `postgres://user:pw@db.internal/prod` | `postgres://***@db.internal/prod` ✅ |
| `Bearer sk-live-…` | `***` ✅ |
| `postgres://db.internal:5432/prod` (자격증명 없음) | **무변화** |
| 내부 호스트명·사설 IP·스택 프래그먼트 | **무변화** |

`SECRET_LEAK_PATTERNS` 는 **자격증명**을 겨냥한다. 자매 유틸의 `CONNECTION_STRING_PATTERN` ·
`STACK_TRACE_PATTERN` · 500자 절단은 알림 경로 전용이다.

**넓히지 않고 주장을 좁혔다.** 그 패턴들을 shared SoT 로 올리면 `deepRedactSecrets` 의 다른
소비자(conversation-thread `turns[].data` · `ai_message.messages[]` · EIA `nodeOutput`)까지
전부 영향받는다 — blast radius 가 다른 결정이라 별도 PR 이 맞다. JSDoc 에 실측표로 **못 잡는
것**을 명시했고, 잔여 갭을 `spec-sync-external-interaction-api-gaps.md` 에 등재했다.

## W7 (testing) — 내 테스트가 공허했다 · **반영**

`code: 'EXECUTION_TIME_LIMIT_EXCEEDED'` · `nodeId: <uuid>` 는 애초에 어떤 패턴에도 안 걸려서
**마스킹이 실수로 걸려도 no-op** 이라 GREEN 이었다. "안 건드린다" 를 증명하지 못한다.

마스킹이 걸리면 반드시 값이 바뀌는 입력(`Bearer sk-…` / `api-key=…`)으로 교체. 판별력을
뮤테이션으로 실증 — `code`/`nodeId` 에 마스킹을 거는 뮤턴트 2개가 **RED**.

> **뮤테이션 자체가 한 번 틀렸다.** 셸이 `\n` 을 문자 그대로 넘겨 구문이 깨진 뮤턴트가
> `Tests: 0 total` 을 냈는데 그건 RED 가 아니라 **무효 뮤턴트**다. python 으로 다시 만들었다.
> 그리고 내가 붙인 tsc 유효성 게이트도 **오탐**이었다 — 이 저장소는 베이스라인에 이미 tsc
> 오류가 있어(래칫) 절대 판정으로 못 쓴다. 유효성 근거는 "jest 가 24개를 정상 로드했다" 다.

## W3 (side_effect/documentation) — 내부 신뢰 채널 · **실측해서 답했다**

`09_25_29` 가 *"워크플로우 에디터가 마스킹값을 받아도 되나"* 를 물었는데 내가 답을 안 남겼다.
재니: 프런트는 `execution.failed` 를 **webhook 구독 화이트리스트 라벨로만** 쓰고
(`external-interaction-card.tsx`), 실행 실패 표시는 REST `NodeExecution`/`Execution` 에서 온다.
**에디터는 이 payload 의 `error.message` 를 렌더링하지 않는다** → 내부 표면 회귀 없음.

## 나머지

| # | 처분 |
|---|---|
| W2 docstring 에 "webhook 알림" 잔존 | **반영** — 호출부 3곳 전부 `in_app`/`email` 실측, 문구 제거 |
| W4 JSDoc 궤도 이탈 | **반영** — `redactTerminalError` 를 `@param` 블록 앞으로 이동 |
| W8 JSON message 재직렬화 미고정 | **반영** — 케이스 추가(secret 제거 + JSON 파싱 유지 단언) |
| W9 라운드 수 4 vs 5 | **반영** — 나열 근거(5개 ID)에 맞춰 헤더 정정 |
| W10 CHANGELOG 누락 | **반영** — wire 바이트가 바뀌는 변경이라 항목 추가(잔여 갭·수신자 영향 포함) |
| W5 테스트 중복 | **무조치** — 신규 블록의 null/details 단언은 **마스킹 도입 후에도** 그 계약이 유지되는지를 묻는다. 상단 블록과 의도가 다르다 |
| W6 optional-키 관용구 혼재 | **무조치** — 리뷰도 "강한 요구 아님". 기존 `if` 를 건드리면 diff 가 넓어진다 |
| INFO 1·2·3 (길이 상한 · 취소 경로 · node 이벤트) | 후속/범위 밖 — plan 에 기록 |

---

## 검증

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — backend **426 suites / 8752 tests** |
| build | PASS |
| e2e | PASS — 276 |

뮤테이션: message·details 마스킹 제거 · 객체/레거시 경로 각각 누락 · details 키 항상 생성
**5/5 RED**, code/nodeId 마스킹 뮤턴트 **2/2 RED**, 생존 0.
