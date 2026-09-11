# RESOLUTION — `review/code/2026/09/11/18_04_36` (1라운드, `--route=all`)

**입력**: CRITICAL **0** · WARNING 4 · SPEC-DRIFT 2 · INFO 11 · RISK MEDIUM ·
reviewer 14/14 · forced 누락 0 · unfinished 0.

MEDIUM 판정의 근거는 *"이 diff 가 **새로 만든** 위험 표면이 테스트로 안 잡힌다"* 였다.
그 두 건(W1·W2)을 이 라운드에서 닫는다.

---

## WARNING 1 — 콜백 URL 함수의 인자 순서

**분류**: 처방을 바꿔 해소. **지적은 절반만 맞았다 — 재현해서 갈랐다.**

reviewer 는 *"호출부 인자 스왑 뮤턴트가 124개 테스트 전량 GREEN"* 이라고 했다. jest 로는 맞다.
그런데 **두 호출부 모두 `tsc` 가 잡는다**:

| 호출부 | `tsc` | `jest` |
|---|---|---|
| `triggers.service.ts` (`rotateBotToken`) | **TS2345** | GREEN(생존) |
| `chat-channel-binder.service.ts` (`setupChatChannel`) | **TS2345** | RED |

`build` 단계가 `tsc` 를 돌리므로 이 스왑은 **main 에 갈 수 없다.** reviewer 는 jest 만 돌렸다.

**그래도 조치했다 — 방어의 *방향*이 우연에 기대고 있었기 때문이다.** 타입이 잡는 이유는
두 인자의 타입이 마침 다르기 때문(`string | undefined` vs `string`)이다. `baseUrl` 을 언젠가
non-optional 로 좁히면 스왑이 타입-유효해지고 **그때 이 자리를 보는 것은 아무것도 없다.**

→ reviewer 가 제안한 *"호출부에 두 번째 인자 단언 추가"* 대신 **시그니처를 이름 인자로 바꿔
순서 자체를 없앴다.** 테스트로 막는 것보다 형태로 없애는 쪽이 이 경우 더 싸다(호출부 2곳).

## WARNING 2 — `teardownChatChannel` 의 adapter 경로가 한 번도 안 돌았다

**분류**: 해소. reviewer 실측이 정확했다 — `remove()` 를 도는 describe 가 전부 registry 를
`has: () => false` 로 고정해서, **`adapter.teardownChannel()` 호출과 best-effort catch 두 줄이
사라져도 GREEN** 이었다.

`chat-channel-binder.service.spec.ts` **4케이스** 신설. 뮤테이션으로 확인:

| 뮤턴트 | 결과 |
|---|---|
| adapter 호출 제거 | **RED** |
| best-effort catch → 재던지기 | **RED** |

catch 테스트는 `resolves` 만 보지 않고 **warn 내용(trigger id · 사유)까지** 단언한다 —
`resolves` 만 보면 catch 가 조용히 삼켜도 통과한다.

## WARNING 3 — 신규 클래스 전용 spec 부재

**분류**: 부분 해소 + **의도적 비대칭을 문서화**.

`chat-channel-binder.service.spec.ts` 를 만들었지만 **`setupChatChannel` 은 여기서 다시 덮지
않는다.** 그쪽은 `triggers.service.spec.ts` 가 공개 진입점으로 이미 두껍게 행사하고 있고,
이동하면서 뮤테이션 3종(게이팅 · `inboundSigningRefSurvives` 술어 · 실패 경로 `fallbackConfig`)이
전부 RED 임을 실측했다. **같은 것을 두 곳에서 단언하면 다음 사람이 어느 쪽이 정본인지 모른다.**
그 판단 근거를 spec 파일 헤더에 적었다.

## WARNING 4 — JSDoc 이 아직 없는 `plan/complete/` 경로를 가리킨다

**분류**: 마무리 단계에서 해소 — **push 전에 실측 확인한다.**

reviewer 지적대로 지금은 깨진 링크다. 이 plan 은 마무리 커밋에서 `complete/` 로 옮겨지므로
최종 상태는 옳지만, **그것이 "내가 기억하는 것" 에 달려 있다**는 지적이 타당하다.
체크리스트에 이동 **후 경로 존재 확인**을 별 항목으로 넣었다.

---

## SPEC-DRIFT 2건 — 둘 다 **이미 등재됨** (reviewer 도 확인)

`--impl-prep` 이 선제 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
planner 항목으로 올려 둔 것과 **같은 지점**이다. reviewer 가 등재 사실을 직접 확인하고
*"중복 처리 방지"* 로 표기했다. developer 권한 밖(`spec/` 쓰기)이라 이 PR 에서 닫지 않는다.

## INFO 11건 — 처분

| INFO | 처분 |
|---|---|
| 1 (로그 리터럴) · 7 (`getAppBaseUrl` 중복) · 8 (OpenAPI 갭) | **이미 트래커 등재** — reviewer 도 확인 |
| 3 (lost update) · 5 (`setupChatChannel` 응집도) | **이미 트래커 등재**, 대상 파일 경로만 갱신하면 된다 |
| 2 (secret rotate 순차 await) · 4 (`preservedInboundSigningRef` 암묵 계약) · 6 (두 파일 간 중복) · 9 (테스트 격리) | 사전 존재 / 조건부 — **`codebase/**` 주석·구조 정리라 라운드를 늘리는 지렛대**다. 트래커 등재 |
| 10 (미export 로 공개표면 축소) | **긍정 관찰** — 설계 의도와 일치 |
| 11 (리뷰 중 뮤테이션 관측) | 내가 W1 검증 뮤테이션을 리뷰와 겹쳐 돌린 결과. **이미 `#1319` 에서 프로세스 항목으로 등재**했는데 **또 재발했다** — 항목에 재발을 덧붙인다 |

## 검증

새 테스트가 실제로 무는지 **뮤턴트 5종 전부 RED**:

| 뮤턴트 | 결과 |
|---|---|
| 후행 슬래시 제거 삭제 | RED (4건) |
| 선행 슬래시 제거 삭제 | RED (3건) |
| `??` → `\|\|` (빈 문자열 처분) | RED (1건) |
| teardown adapter 호출 삭제 | RED (2건) |
| best-effort catch → 재던지기 | RED (1건) |

트리거 스위트 246 → **257** (신규 11). 4단계 재수행 결과는 커밋 본문.
