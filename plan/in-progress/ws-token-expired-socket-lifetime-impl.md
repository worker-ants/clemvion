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
> 트래커: [`spec-sync-websocket-protocol-gaps.md`](./spec-sync-websocket-protocol-gaps.md) 잔여 1종.

## 무엇을 만드는가

spec 이 확정한 계약을 구현한다. **서버만으로는 성립하지 않는다** — 프론트가 통지를 받아
명시적으로 재연결해야 한다.

| 쪽 | 할 일 |
|---|---|
| **backend** | 핸드셰이크에서 `exp` 를 읽어 소켓별 타이머 둘(사전 통지 `exp-60s` · 만료 `exp`). 통지 시 `auth.token_expired` `{ message, expiresAt }` emit, 만료 시 `disconnect()`. `handleDisconnect` 에서 **둘 다 해제** |
| **frontend** | `auth.token_expired` 구독 + `disconnect` 의 `reason === 'io server disconnect'` 분기 → 둘 다 REST `/auth/refresh` → `socket.auth.token` 교체 → **명시적 `connect()`** |

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

- [ ] **`2-api-convention.md` §6 상태 코드 표에 `410 Gone`·`202 Accepted` 미등재**
      (convention_compliance W1). 4개 문서가 이미 쓰는 표준 코드인데 SoT 표에 없어 §5.3
      "기본값 SoT" 역할이 불완전하다. **요구사항/계약 표라 developer 자기-반증형 소정정
      예외 대상이 아니다** — planner 턴 필요.
- [ ] **`PASSWORD_INVALID`(세션 재인증) vs `INVALID_PASSWORD`(비밀번호 변경 확인)**
      (convention_compliance W2). 단어 순서만 다른 별개 코드인데 이름이 두 흐름의 차이를
      드러내지 않고 `error-codes.md` §3 레지스트리에도 없다. rename 은 breaking 이므로
      **의도적 분리 근거를 §3 에 등재**하는 쪽이 답일 수 있다 — planner 턴.

## 체크리스트

- [x] `--impl-prep spec/5-system/` — **BLOCK: NO**. 번들이 근거 문서를 생략했으나 checker 가 `Read` 로 열어 판정(위 표)
- [x] backend: 소켓별 타이머 + emit + disconnect + 해제 (TDD) — 뮤테이션 RED 2
- [x] frontend: 구독 + disconnect reason 분기 + **재핸드셰이크** (TDD) — 뮤테이션 RED 1 + 대조군
- [x] lint / unit / build / e2e
- [x] **`scripts/check-frontend-typecheck-ratchet.py`** — 4단계 wrapper 밖이라 별도로 돌린다.
      초판이 이걸 안 돌려 CI 를 깰 뻔했다(아래 리뷰 1R C2).
- [ ] `/ai-review` + 조치
- [ ] PR
- [ ] **머지 후 planner 턴** — spec 의 `_(계획·미구현)_` 배지 flip(§1.2·§4.6·Rationale·`:28`)과
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

- [ ] **만료 타이머 지터 (리뷰 2R W1, performance)** — `armExpiryTimers` 의 지연 계산에
      지터가 없어 **동시 접속 코호트가 900초 주기로 뭉칠 수 있다**. 재발급된 토큰도 다시
      `exp=now+900` 이라 한 번 동기화되면 그 상태가 자기 강화된다.

      **여기서 안 고치는 이유**: cutoff 는 `exp` 라 지터를 넣을 수 없고(서버는 만료 시각에
      끊어야 한다), notice 에 지터를 넣으면 **spec §1.2 가 고정한 60초 lead 를 바꾸는 것**이라
      planner 턴이 필요하다. 관측 가능한 계약이라 구현 자유도가 아니다.

      → 배포 런북에 "대량 동시 로그인 후 15분 주기 재연결 스파이크 가능" 을 먼저 적고,
      실제로 관측되면 lead time 을 범위(예: 45~60초)로 바꾸는 planner 턴을 연다.

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
