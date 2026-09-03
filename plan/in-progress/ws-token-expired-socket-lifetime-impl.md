---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: developer
spec_impact: none
---

# 구현 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`)

> 근거 spec: [`spec/5-system/6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md)
> §1.2 · §1.3 · §4.6 · §6.1 · §9.2 + Rationale `R-ws-socket-lifetime-binds-token` (`#1265`).
> 토큰 수명·revoke 의미는 [`spec/5-system/1-auth.md`](../../spec/5-system/1-auth.md) §1.4·§2.3.
> 트래커: [`spec-sync-websocket-protocol-gaps.md`](../complete/spec-sync-websocket-protocol-gaps.md) 잔여 1종.

## 무엇을 만드는가

spec 이 확정한 계약을 구현한다. **서버만으로는 성립하지 않는다** — 프론트가 통지를 받아
명시적으로 재연결해야 한다.

| 쪽 | 할 일 |
|---|---|
| **backend** | 핸드셰이크에서 `exp` 를 읽어 소켓별 타이머 둘(사전 통지 `exp-60s` · 만료 `exp`). 통지 시 `auth.token_expired` `{ message, expiresAt }` emit, 만료 시 `disconnect()`. `handleDisconnect` 에서 **둘 다 해제** |
| **frontend** | `auth.token_expired` 구독 + `disconnect` 의 `reason === 'io server disconnect'` 분기 → 둘 다 REST `/auth/refresh` → `socket.auth.token` 교체 → **명시적 `connect()`** |

> **라운드 라벨 범례** — 이 문서는 **두 리뷰 사이클**을 참조한다.
> - `리뷰 NR` = 원 PR `#1266` 의 5라운드 리뷰 (2026-09-02)
> - **서브사이클 `<타임스탬프>`** = 이월 INFO 정리(이 문서 §이월 INFO 항목)의 라운드 —
>   [`11_57_58`](../../review/code/2026/09/03/11_57_58/SUMMARY.md) ·
>   [`12_16_24`](../../review/code/2026/09/03/12_16_24/SUMMARY.md) ·
>   [`12_40_10`](../../review/code/2026/09/03/12_40_10/SUMMARY.md)
>
> 종전에 둘 다 `리뷰 2R W1` 로 적어 **같은 문서 안 15줄 간격으로 다른 발견**을 가리켰다
> (서브사이클 `12_40_10` W2). 서브사이클은 타임스탬프로 식별해 충돌을 없앤다.

## 착수 전 실측 (2026-09-02)

| 측정 | 값 |
|---|---|
| access token 수명 (`auth.module.ts`) | **900초** |
| `modules/websocket/` 의 `jwtService.verify` 호출부 | **1곳** (`handleConnection`) |
| gateway 의 `exp` 참조 / 타이머 | **0 / 0** |
| FE 의 `auth.token_expired` 구독 | **0건** |
| `ws-client.ts` 의 `on("disconnect")` 재연결 경로 | **없음** (`connect_error` 만) |

**전부 신규다** — 기존 코드를 고치는 게 아니라 없는 경로를 만든다.

## 설계 주의점

- **Socket.IO 는 서버발신 `disconnect()` 에 자동 재연결을 발화하지 않는다**(reason
  `"io server disconnect"`). `reconnection: true` 가 켜져 있어도 그렇다. 프론트가 명시적으로
  `connect()` 를 불러야 한다 — 이걸 빠뜨리면 사용자가 조용히 연결을 잃는다.
- **타이머 해제 누락 = 소켓당 누수.** `handleDisconnect` 에서 둘 다 clear 한다.
- **서버는 재발급을 추적하지 않는다.** 갱신된 토큰은 **새 소켓**으로 오고 옛 소켓은 자기
  `exp` 에 끊긴다.
- **닫는 범위는 자연 만료뿐이다.** 명시적 revoke 는 refresh family 만 무효화하므로 그 소켓은
  자연 `exp` 까지(최대 15분) 산다 — spec Rationale 이 명시한 카브아웃이며 **여기서 넓히지
  않는다.**
- `exp` 가 없거나 이미 지난 토큰: 핸드셰이크 검증이 먼저 거르므로 타이머 경로에 도달하지
  않는다. 그래도 방어적으로 다룬다(음수 지연 → 즉시 처리).

## `--impl-prep` 결과 (2026-09-02) — **BLOCK: NO**

Critical 0 · WARNING 3. **checker 들이 생략된 근거 문서를 실제로 열어 읽었다** — 우려했던
"게이트가 안 보고 통과" 는 일어나지 않았고, 근거가 남았다:

| checker | 확인한 것 |
|---|---|
| rationale_continuity | 이 계획이 `R-ws-socket-lifetime-binds-token`(기각 대안·범위 경계 포함)을 **문구 단위로** 따름 |
| naming_collision | 인용 절번호 §1.2·§1.3·§4.6·§6.1·§9.2 가 **실체와 일치** |
| plan_coherence | §4.6·§5 의 won't-do 반영 확인 |

WARNING 3건 중 **1건만 이 작업 몫**이었다(형제 draft 체크리스트 위생 — 처리 완료).
나머지 둘은 **planner 트랙 규약 갭**이라 여기서 고치지 않고 등재한다:

- [x] **`2-api-convention.md` §6 상태 코드 표에 `410 Gone`·`202 Accepted` 미등재**
      (convention_compliance W1). 4개 문서가 이미 쓰는 표준 코드인데 SoT 표에 없어 §5.3
      "기본값 SoT" 역할이 불완전하다. **요구사항/계약 표라 developer 자기-반증형 소정정
      예외 대상이 아니다** — planner 턴 필요.
      → **해소 (2026-09-02, planner 턴)**: §6 에 두 행 추가 + §5.3 에 *"410 은 기본값이 없다"*
      명시. 착수해 보니 지적은 §6 뿐 아니라 **§5.3 도** 겨냥하고 있었고, 필터에 `case 410` 이
      없어 코드 미명시 410 이 `INTERNAL_ERROR` 로 떨어진다는 사실이 거기서 나왔다.
- [x] **`PASSWORD_INVALID`(세션 재인증) vs `INVALID_PASSWORD`(비밀번호 변경 확인)**
      (convention_compliance W2). 단어 순서만 다른 별개 코드인데 이름이 두 흐름의 차이를
      드러내지 않고 `error-codes.md` §3 레지스트리에도 없다. rename 은 breaking 이므로
      **의도적 분리 근거를 §3 에 등재**하는 쪽이 답일 수 있다 — planner 턴.
      → **해소 (2026-09-02, planner 턴)**: §3 등재 완료. 등재 사유는 "혼동 소지" 가 아니라
      **이름이 실제 조건보다 좁다**는 것이다(미설정+불일치 통합) — 그래서 §3 의 현행 기준에
      그대로 들어가고 레지스트리를 넓힐 필요가 없었다. **미설정 조건 분리(`PASSWORD_NOT_SET`)
      여부는 미결**이라 [`auth-change-password-oauth-only-code-split.md`](../complete/auth-change-password-oauth-only-code-split.md)
      로 이월했다 — wire 코드가 바뀌는 B 등급 표면이라 사용자 결정이 필요하다.

## 체크리스트

- [x] `--impl-prep spec/5-system/` — **BLOCK: NO**. 번들이 근거 문서를 생략했으나 checker 가 `Read` 로 열어 판정(위 표)
- [x] backend: 소켓별 타이머 + emit + disconnect + 해제 (TDD) — 뮤테이션 RED 2
- [x] frontend: 구독 + disconnect reason 분기 + **재핸드셰이크** (TDD) — 뮤테이션 RED 1 + 대조군
- [x] lint / unit / build / e2e
- [x] **`scripts/check-frontend-typecheck-ratchet.py`** — 4단계 wrapper 밖이라 별도로 돌린다.
      초판이 이걸 안 돌려 CI 를 깰 뻔했다(아래 리뷰 1R C2).
- [x] `/ai-review` **5라운드** — 신규 WARNING **8 → 5 → 4 → 3 → 0**. 최종 Critical 0 · Warning 0.
- [x] PR — `#1266` 머지

- [x] **이월 INFO 5건 — 한 번에 닫았다 (2026-09-03)**. 개별로는 차단 사유가 아니라 매 라운드
      다시 올라오던 것들이다. 뮤테이션 **4축 RED** 로 새 단언이 실제로 무는 것을 확인했다 — 선제 해제는 **두 축**이다:
      호출 자체를 지우는 것과, 조기 `return` 뒤로 되돌리는 것(후자는 `exp` 없는 재무장에서만
      드러나 다른 테스트가 잡는다). 나머지 둘은 `unref` 제거와 메시지 상수 값 변경이다:
      - `cutoff` clamp 근거 주석 — 인접 `untilNotice` 에만 있어 `:206` 을 읽는 사람은 이유를
        못 봤다. **5라운드 연속 지적**
      - `expiryTimers` 타이머 쌍 **non-optional 화** — 둘은 항상 함께 생기고 함께 해제되는데
        `?` 로 둬서 `handleDisconnect` 가 **닿을 수 없는 분기 둘**을 방어하고 있었다.
        해제 절차는 `clearExpiryTimers` 로 모아 무장·해제 두 자리가 갈리지 않게 했다
      - `MSG_AUTH_TOKEN_EXPIRING` **상수 승격** + 테스트가 그 상수와 **리터럴**을 함께 단언
        (종전 `expect.any(String)` 은 문구가 바뀌어도 안 걸렸다) — 뮤턴트 **RED**
      - `armExpiryTimers` 진입부 **선제 해제** — **내 이전 판단이 틀렸다.** "도달 불가라 검증
        불가" 로 미뤘는데, 같은 id 로 두 번 무장하는 테스트가 곧바로 관측했다(emit 2회).
        도달 불가한 것과 검증 불가한 것은 다르다 — 뮤턴트 **RED**
      - `setTimeout` **`.unref()`** — 타이머가 event loop 를 붙잡아 셧다운이 최대 토큰 수명만큼
        늦어질 수 있었다. `hasRef()` 로 단언 — 뮤턴트 **RED**

      > **닫는 과정이 새 결함 3건을 만들었다** — 첫 커밋(`69aad5d5d`)이 JSDoc 오귀속 2건과
      > W3 회귀(조기 `return` 이 선제 해제보다 먼저)를 남겼고, 리뷰
      > [`11_57_58`](../../review/code/2026/09/03/11_57_58/SUMMARY.md) 가 잡아 `b75e6a76b` 로
      > 정정했다. JSDoc 오귀속은 **5명이 독립 발견**했다.
- [x] **머지 후 planner 턴 — 완료.** spec 배지 flip + 트래커 종결 + `implemented` 승격.
      ~~spec 의 `_(계획·미구현)_` 배지 flip(§1.2·§4.6·Rationale·`:28`)과
      `spec-sync-websocket-protocol-gaps.md:23` 체크박스. **developer 권한 밖**이다(그 문구의
      원저자가 아니라 자기-반증형 소정정 예외에 해당하지 않는다). 이 PR 은 구현만 싣는다.
- [x] **유저 가이드** — `password-and-sessions.{mdx,en.mdx}` 에 Callout 추가(리뷰 2R W5).
      "실시간 연결은 자동 재연결" + **"다른 기기 로그아웃 시 그 기기의 실시간 화면은 최대
      15분 안에 끊긴다"**. 후자는 revoke 카브아웃의 사용자 표현이다 — 이 PR 이 그 창을
      **무한에서 15분으로 유계화**했다.

- [ ] **e2e — 유예. 근거를 여기 적는다(`review/**` 는 SoT 가 아니다, 2R W5).**
      WS 토큰 만료 e2e 는 900초를 기다리거나 **토큰 수명을 주입**해야 한다. 현 e2e 하네스의
      test-hook 은 boot-only op 게이트(NODE_ENV + FLAG 이중)라 런타임 토큰 TTL 주입 표면이
      없다. **유예이지 불요가 아니다** — 재개 신호: e2e 하네스에 런타임 설정 주입이 생기거나,
      이 경로의 회귀가 실제로 관측될 때.

- [ ] **cross-generation 가드 테스트의 flaky 관측 (리뷰 4R W1) — watch**

      리뷰어가 **76회 중 1회** `gen1.connect` 가 호출되는 실패를 관측했다. 내가 같은 파일을
      **150회 반복 실행했으나 0실패**다.

      **"재현 못 했다" 를 "flaky 아니다" 로 읽지 말 것.** 소스 경로상으로도 `await` 없는
      동기 구간이라 인과를 못 찾았는데, **인과를 못 찾은 것과 없는 것은 다르다.** 원인
      후보로 `vi.resetAllMocks()` 가 모듈 레벨 `mockRefresh` 의 구현까지 초기화하는 상호작용을
      의심했으나 확증하지 못했다.

      재개 신호: CI 나 로컬에서 이 테스트가 **한 번이라도 더** 실패하면 그때는 "알려진 flake"
      로 묻지 말고 원인을 끝까지 팔 것. 이 항목이 그 기록이다.

- [x] **`2-api-convention.md §10.4` — 완료.** 예외를 **위임**으로 한 줄 넣고 근거를 그 문서
      `## Rationale` 에 정착시켰다.
      ~~재연결 요약이 이제 오해를 부른다 (`--impl-done` W1, planner 트랙).~~

      §10.4 는 *"연결 끊김 시 지수 백오프로 재연결 + 마지막 수신 이벤트 ID 전달"* 이라고
      요약하는데, 서버발신 `disconnect()` 는 **자동 재연결 대상이 아니고**(§6.1 예외) 복구도
      이벤트 ID 재전송이 아니라 `execution.snapshot` 방식이다(§6.2).

      > **내 앞선 판단이 약해졌다.** spec draft 에서 §10.4 를 안 고친 근거는 *"요약에 예외를
      > 복제하면 두 곳이 갈릴 자리를 새로 만든다"* 였다. 그 논리는 지금도 맞지만 **전제가
      > 바뀌었다** — 이 구현으로 그 예외가 **15분마다 상시 발동**한다. 드물게 발동하는 예외를
      > 요약에서 생략하는 것과, 상시 경로를 요약이 반대로 적고 있는 것은 다르다.

      요구사항 텍스트라 **developer 자기-반증형 소정정 대상이 아니다** — 아래 spec 배지 flip
      planner 턴에서 함께 처리한다.

- [ ] **만료 타이머 지터 (리뷰 2R W1, performance)** — `armExpiryTimers` 의 지연 계산에
      지터가 없어 **동시 접속 코호트가 900초 주기로 뭉칠 수 있다**. 재발급된 토큰도 다시
      `exp=now+900` 이라 한 번 동기화되면 그 상태가 자기 강화된다.

      **여기서 안 고치는 이유**: cutoff 는 `exp` 라 지터를 넣을 수 없고(서버는 만료 시각에
      끊어야 한다), notice 에 지터를 넣으면 **spec §1.2 가 고정한 60초 lead 를 바꾸는 것**이라
      planner 턴이 필요하다. 관측 가능한 계약이라 구현 자유도가 아니다.

      → 배포 런북에 "대량 동시 로그인 후 15분 주기 재연결 스파이크 가능" 을 먼저 적고,
      실제로 관측되면 lead time 을 범위(예: 45~60초)로 바꾸는 planner 턴을 연다.

> **"배포 런북" 은 아직 실체 문서가 아니다** (`--impl-done` INFO#4, 2026-09-03). 저장소에
> 그런 파일이 없고 **이 plan 이 트래커 역할**을 한다 — 지금은 그게 맞지만, 런북 참조가 이
> 문서에만 **4건** 쌓였다. 하나 더 늘면 실제 ops 문서 위치를 정해 수렴시킬 것.

- [ ] **셧다운 중 만료 콜백 미실행** (서브사이클 `12_16_24` W1) — 만료 타이머에 `.unref()` 를 걸었으므로
      그 타이머만 남은 상태에서는 프로세스가 **콜백 발화 전에 종료**될 수 있다.
      정상 종료 시 소켓 자체가 소멸하므로 실질 영향은 없다고 보지만, 그레이스풀 드레인 중
      "사전 통지를 받았어야 할 클라이언트가 못 받는" 창이 생긴다.
      → 배포 런북에 그 사실을 적는다. **관측되면** `unref` 를 걷고 셧다운 훅에서 명시적으로
      해제하는 쪽으로 바꾼다.

      > **이 항목은 리뷰가 내 거짓 주장을 잡아 만들어졌다.** 서브사이클 `11_57_58`
      > RESOLUTION 에서 이 트레이드오프를 *"배포 런북에서 별도 추적 중"* 이라고 썼는데,
      > 서브사이클 `12_16_24` reviewer 가 이 plan 을 실측해 보니 그 자리의 런북 항목 2건은
      > **다른 주제**(재연결 스파이크·배포 전환 창)였다. 추적한다고 적으면서 추적처를
      > 만들지 않았다.
      > 상세: [`12_16_24/SUMMARY.md`](../../review/code/2026/09/03/12_16_24/SUMMARY.md)

- [ ] **배포 전환 창 리스크** (리뷰 1R api_contract W6) — 이 재연결 로직을 모르는 **구버전
      번들**(배포 시점에 이미 열려 있던 탭)은 최대 900초 뒤 무통지로 끊긴다. FE 우선 배포로
      창을 줄이거나 그 이탈을 감내한다는 판단을 배포 런북에 남길 것.

## 비고 — `--impl-prep` 번들 예산

`spec/5-system/` 전체가 1.3MB 라 근거 문서(`6-websocket-protocol.md`, 99,032자) 본문은
**어떤 실용 예산에서도 프롬프트에 안 들어간다.** 실측:

| `CONSISTENCY_MAX_CONTEXT_SIZE` | WS 결정 적재 | 프롬프트 |
|---|---|---|
| 262144 (기본) | ✗ | 266KB |
| 700,000 | ✗ | 738KB |
| 850,000 | ✓ | **1.17MB** — 서브에이전트 컨텍스트 초과 |

**그래도 게이트는 눈감지 않는다** — 번들이 생략 파일을 **이름으로 나열**하고 *"여기 없다는
사실을 '해당 내용이 없다' 의 근거로 삼지 말 것 — 판정에 관련되면 `Read` 로 직접 열어라"* 라고
지시한다. checker 는 Read 권한이 있고, 이 plan 이 근거 문서를 링크로 지목한다.

기본 예산으로 돌리되 **SUMMARY 가 그 문서를 실제로 읽고 판정했는지 확인**한다 — 안 읽었으면
그 라운드의 판정은 이 항목을 덮지 않는다.
