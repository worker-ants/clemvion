---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: planner
spec_impact:
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/2-api-convention.md
---

# spec draft — WS `auth.token_expired` 배지 flip · 트래커 종결 · §10.4 예외 반영

> 착수 근거: `#1266`(구현 머지) 후속. 코드 리뷰 5R SPEC-DRIFT #1 · `--impl-done` W1 ·
> [`ws-token-expired-socket-lifetime-impl.md`](./ws-token-expired-socket-lifetime-impl.md)
> 체크리스트의 "머지 후 planner 턴".
>
> **developer 권한 밖이라 여기까지 미뤄진 것**이다 — 배지·요약은 제품 정의 텍스트이고
> developer 가 그 문구의 원저자가 아니므로 자기-반증형 소정정 예외에 해당하지 않는다.

## 배경

`#1266` 이 `auth.token_expired` 를 backend·frontend 양쪽에서 구현했다. spec 본문은 아직
`_(계획·미구현)_` 로 적고 있고, 그것을 추적하던 트래커의 **마지막 열린 항목**이 이 하나였다.

## 결정 ① — `6-websocket-protocol.md` 를 `status: implemented` 로 승격

`spec-impl-evidence.md §3` 이 *"`partial` → `implemented`: 마지막 `pending_plans` 가
`complete/` 로 이동한 commit 안에서 승격 (가드)"* 라고 못박는다. 트래커의 열린 항목이 0이
되므로 이동 + 승격이 한 커밋 안에서 일어나야 한다.

### 남는 `_(계획·미구현)_` 배지가 승격을 막지 않는가 — 막지 않는다

이 문서에는 브레이크포인트 3종(`execution.paused`·`execution.continue`·`execution.step`)이
여전히 `_(계획·미구현)_` 로 남는다. 그런데 그 배지들은 스스로
[`3-execution.md §6 로드맵`](../../spec/3-workflow-editor/3-execution.md) 을 소유처로 지목하고,
**그 문서는 이미 `status: implemented`** 다(실측).

즉 이 저장소의 선례는 **"향후 로드맵 — 미구현" 절이 `implemented` 를 막지 않는다**는 것이고,
WS 문서의 그 배지들은 소유처의 로드맵을 **미러링**할 뿐이다. 그 로드맵이 착수되면 소유 문서
쪽에서 plan 이 생긴다.

> **추측이 아니라 선례 실측이다.** "로드맵이 남았으니 partial 유지" 라고 판단할 뻔했는데,
> 소유 문서의 status 를 열어 보고 뒤집었다.

## 결정 ② — `2-api-convention.md §10.4` 에 예외 한 줄

§10.4 는 *"연결 끊김 시 지수 백오프로 재연결 + 마지막 수신 이벤트 ID 전달"* 이라고 요약한다.
둘 다 서버발신 `disconnect()` 에는 틀리다 — 자동 재연결이 발화하지 않고(§6.1 예외), 복구도
이벤트 ID 재전송이 아니라 `execution.snapshot` 이다(§6.2).

> **`#1265` 에서 나는 §10.4 를 안 고치기로 했다.** 근거는 *"요약에 예외를 복제하면 두 곳이
> 갈릴 자리를 새로 만든다"* 였고 그 논리 자체는 지금도 맞다. **바뀐 것은 전제다** —
> `#1266` 이 그 예외를 **15분마다 상시 발동**하게 만들었다. 드문 예외를 요약에서 생략하는
> 것과, 상시 경로를 요약이 반대로 적는 것은 다르다.

복제 대신 **위임**한다 — 한 줄로 예외의 존재를 알리고 상세는 §6 으로 보낸다. 그러면 두 곳이
갈릴 표면이 안 생긴다.

## 변경안 — spec **12곳** · plan **6곳** 전수

> **이 숫자를 두 번 틀렸다.** 초판은 "spec 8곳 · plan 9곳" 이라 적었는데 세지 않고 쓴 값이었고
> (`--spec` W4), 정정하며 "10곳" 이라 적자마자 **같은 편집에서 행을 둘(9b·10b) 더 넣어 다시
> 어긋났다.**
>
> 지금 값은 **편집을 끝낸 뒤 스크립트로 센 것**이다. 손으로 세면 "세는 시점" 과 "쓰는 시점"
> 사이에 편집이 끼어든다 — 이 저장소가 반복해 데인 형태이고, 나는 그것을 정정문 안에서
> 재현했다.

> 이 draft 는 `grep -rn "auth\.token_expired"` **와** `grep -rn "spec-sync-websocket-protocol-gaps"`
> 두 축으로 셌다. `#1265` 에서 **이름 축으로만 세다** §6.1·§9.2 를 놓쳤기 때문이다 —
> "전수" 의 축이 하나면 다른 축은 무증거로 남는다.

**spec**

| # | 위치 | 변경 |
|---|---|---|
| 1 | `6-websocket-protocol.md` frontmatter | `status: partial` → **`implemented`**, `pending_plans:` **제거** |
| 2 | 〃 `:28` 전송 계층 안내 | `auth.token_expired` 만 Planned → **셋 다 처분 완료**(2 won't-do + 1 구현) |
| 3 | 〃 §1.2 `:52` | *"서버발신 emit 은 미구현 (Planned) — 결정은 확정, 구현 대기"* → **구현 완료**(`#1266`) |
| 4 | 〃 §4.6 표 `:876` | `_(계획·미구현)_` 배지 **제거** + "backend emit 은 구현 대기" 문구 정정 |
| 5 | 〃 `:1096` Planned 분리 목록 | 하위 불릿에 **Planned → 구현 완료 (2026-09-02)** 전이 추가 |
| 6 | 〃 `:1100` 잔여 목록 | **잔여 0** — 이 목록의 종결 |
| 7 | 〃 `:1101` status 강등 기록 | 원문 보존 + **승격 후속 주석**(2026-06-03 강등 → 2026-09-02 복귀). 그 주석에 **새 경로**(`plan/complete/spec-sync-websocket-protocol-gaps.md`)를 병기한다 — 원문의 `in-progress/` 경로는 이동 후 죽는데, 원문은 이력이라 못 고친다. 옆의 주석이 갱신된 포인터 역할을 한다(`plan-lifecycle §3` 인입 참조) |
| 8 | 〃 `:1115`·`:1133` 범위 밖 | 원문 보존 + **처분 완료 포인터**. row 7 과 같은 이유로 새 경로를 병기한다 |
| 9 | 〃 Rationale `R-ws-socket-lifetime-binds-token` | 구현 완료 사실 + 커밋 한 줄 |
| 9b | 〃 Rationale 신설 | **`implemented` 승격 근거를 spec 자신에** 정착 — 잔존 `_(계획·미구현)_` 배지는 이 문서의 추적 대상이 아니라 `3-execution.md §6` 로드맵의 **미러링**이고, 그 소유 문서가 이미 `implemented` 다. `3-execution.md` 의 동형 서브섹션과 같은 구조로 쓴다 (`--spec` W1) |
| 10 | `2-api-convention.md §10.4` | 서버발신 disconnect 예외 **한 줄 위임** |
| 10b | 〃 `## Rationale` 신설 | **"왜 복제가 아니라 위임인가" 를 그 문서 자신에** 정착 — `#1265` 의 "안 고침" 판단과 `#1266` 이 바꾼 전제(상시 발동)를 함께 적는다. plan 에만 두면 이 문서를 읽는 사람은 근거를 못 본다 (`--spec` W2) |

**plan** — 라이프사이클

| # | 대상 | 변경 |
|---|---|---|
| 11 | `spec-sync-websocket-protocol-gaps.md` | 마지막 체크박스 `[x]` + **`complete/` 이동** |
| 12 | `spec-draft-ws-wontdo-maintenance-appping.md` | **완료 확인 노트 추가**(그 문서엔 체크박스가 없다 — 번호 표 형식) + **`complete/` 이동** (`--impl-done` INFO#2) |
| 13 | `spec-draft-ws-socket-lifetime-binds-token.md` | 구현 항목 `[x]` + **`complete/` 이동** |
| 14 | `ws-token-expired-socket-lifetime-impl.md` | PR 체크 + **planner 항목 둘 다** `[x]` — 배지 flip(`:94`)·§10.4(`:121`). 단수로 적으면 한쪽만 체크되고 다른 쪽이 해소됐는데도 `[ ]` 로 남는다. **in-progress 유지** — 잔여(지터·e2e·배포 런북·flaky watch·이월 INFO)가 있다 |
| 15 | 이동 3건의 **인입 참조** | 살아있는 문서(`spec/`·`plan/in-progress/`)의 경로 갱신. `plan/complete/**`·`review/**` 는 시점 기록이라 **그대로 둔다** |
| 16 | 이동 3건의 **outgoing 링크** | 자기 자신이 형제를 `./name.md` 로 가리키던 링크 재계산 — `plan-lifecycle.md §3` 이 요구하는 방향이고 **가드가 안 잡는다**(`complete/**` 제외) |

## Rationale (본 draft 의 결정 근거)

**왜 `:1101` 강등 기록을 안 고치는가** — 그 문장은 2026-06-03 시점의 결정 기록이다. 고쳐 쓰면
강등이 없었던 것처럼 읽힌다. 이 문서가 이미 쓰는 패턴대로 **후속 갱신 주석**을 붙인다.

**왜 impl plan 은 `complete/` 로 안 보내는가** — 잔여 항목이 실재한다(지터·e2e·배포 런북 판단·
flaky watch·이월 INFO 5건). 봉인하면 그 근거와 재개 신호가 시점 기록이 돼 SoT 를 잃는다.

**왜 §10.4 를 복제가 아니라 위임으로 쓰는가** — 위 결정 ②. 예외의 **존재**만 알리고 내용은
§6 에 둔다. 요약이 상세를 복제하기 시작하면 그 둘이 갈리는 것은 시간 문제다.
