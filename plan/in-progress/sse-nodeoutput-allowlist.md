---
title: "SSE/fanout 의 `nodeOutput` 도 fail-closed allowlist 로 — REST 와 강도를 맞춘다"
status: in-progress
worktree: sse-nodeoutput-allowlist-3b6219
started: 2026-08-23
owner: developer
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
---

# SSE/fanout allowlist (EIA §R17 표의 마지막 행)

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 항목 *"SSE/fanout 의 `nodeOutput` 은 여전히 fail-open deny-list 다"* (2026-08-23 등재,
`18_30_40` plan_coherence W2 → `19_00_23`·`19_24_24` security W1 이 호출부 보강).

`#1205` 가 REST `getStatus` 만 닫아 **REST 와 SSE 의 방어 강도가 다른 상태**를 만들었다.
§R17 의 범위 표가 그 사실을 명시하고 있고, 이 작업이 그 행을 flip 한다.

## 배선 지점 — `toFanoutEnvelope` 하나 (실측)

트래커가 호출부 4곳을 적어 뒀지만 **그 넷이 전부 한 chokepoint 를 지난다**:

```ts
this.gateway.broadcastToChannel(channel, eventType, wireEnvelope);  // 내부 WS — 그대로
const fanoutEnvelope = this.toFanoutEnvelope(executionId, wireEnvelope);  // 외부 — 여기
```

`toFanoutEnvelope` 는 **외부 전용**이다 — 내부 WS(에디터)는 이미 broadcast 된 뒤고, 그
함수의 기존 주석이 *"fanout 은 외부 수신자(SSE 토큰 보유 채널 end-user 포함)로 나가므로
strip 한다"* 로 이미 그 경계를 규정한다. 즉 **호출부 넷을 각각 고칠 필요가 없다.**

payload 는 envelope 에 **평평하게 펼쳐진다**(`{executionId, ...payload, seq, timestamp}`).
그래서 위치가 REST 와 **정확히 같다**:

| 이벤트 | 위치 |
| --- | --- |
| form waiting | `envelope.nodeOutput` |
| buttons waiting | `envelope.buttonConfig.nodeOutput` |

## ⚠️ allowlist 가 **4키 부족하다** — 그대로 걸면 외부 채널 렌더가 깨진다

트래커가 *"잘못 좁히면 외부 채널 렌더가 깨진다"* 고 경고했고, **실측하니 사실이다.**
chat-channel 이 읽는 `nodeOutput` **top-level** 키 전수:

| 키 | 현재 allowlist |
| --- | --- |
| `config` · `output` · `formConfig` · `conversationConfig` | ✅ |
| **`payload`(19회) · `title`(15회) · `rendered`(4회) · `nodeType`(3회)** | ❌ **없음** |

`extractRendered` 가 `nodeOutput.rendered` 를, 카드/제목 렌더가 `nodeOutput.payload`·
`nodeOutput.title` 을 top-level 로 읽는다(flat legacy shape).

### 위젯은 안전하다 — #1205 는 회귀가 아니다

같은 질문을 REST 쪽에도 던졌다. 위젯(`channel-web-chat`)은 `output.rendered`·`output.items`·
`config.items`·`config.template` 처럼 **`output`/`config` 아래로** 읽는다(실측) — 둘 다
allowlist 안이다. 즉 #1205 가 넣은 회귀는 없고, **목록이 chat-channel 표면에 대해서만
좁았다.**

## 설계 — 목록은 **하나로 유지**하고 4키를 더한다

표면별로 목록을 가르면 손-동기화 지점이 둘 생긴다(이 세션이 계속 없애 온 형태). 그리고
이 넷은 성격상 **"렌더 필수 메타"** 가 맞다 — §R17 이 allowlist 를 그렇게 정의했다.

- `NODE_OUTPUT_ALLOWED_KEYS` 의 **wire 전용 그룹**에 4키 추가. 컴파일타임 결속은
  `NodeHandlerOutput` 공개 키만 덮으므로 이 넷은 **리터럴 테스트**가 지킨다(#1205 에서
  그 파생 fixture 가 vacuous 했던 자리 — 이미 리터럴 대조가 서 있다).
- `toFanoutEnvelope` 에서 두 위치에 `allowlistNodeOutputKeys` 적용. copy-on-change 유지.

## 작업

- [x] `/consistency-check --impl-prep` — `22_26_33`. Critical 0. naming W1·W2 (동명 필드
      disambiguation) 반영, cross_spec W1 은 페이로드 절단 관련 프로세스 항목이라 코드 무관.
- [x] `NODE_OUTPUT_ALLOWED_KEYS` 에 chat-channel wire 4키 추가 + 리터럴 테스트 갱신
- [x] `toFanoutEnvelope` 에 두 위치 배선
- [x] 캐너리 — `_retryState` 두 위치에서 제거 · chat-channel 4키 보존 · 내부 WS 불변
- [x] (planner 턴) §R17 표의 SSE 행 flip + "강도가 다르다" 서술 제거 + WS §4.4 단서
- [x] `22_26_33` WARNING 반영 — JSDoc 그룹 표 3그룹 동기화(W3) · 트래커 wire-only 4→8키(W4) ·
      `node-output-allowlist.ts` **재배치는 이번 라운드 무변경**(INFO 2)
- [x] 뮤테이션 검증 — **4/4 예측 일치** (아래 표)
- [ ] TEST WORKFLOW 4단계 + ratchet
- [ ] `/ai-review`

## 검증 기준

- **내부 WS 는 안 바뀐다** — 이게 이 작업의 안전 조건이다. `broadcastToChannel` 에 넘긴
  envelope 과 fanout envelope 이 **다른 객체**임을 캐너리로 고정한다.
- **뮤테이션** (커밋 후 `cp` 백업. 예측을 **실행 전에** 적고 실측과 두 칸으로 대조):

  | # | 뮤턴트 | 예측 | 실측 |
  |---|---|---|---|
  | M1 | `toFanoutEnvelope` 에서 배선 벗기기 | `_retryState` 캐너리 **2건** RED | ✅ 2 failed / 53 passed — 그 2건 |
  | M2 | allowlist 에서 `'rendered'` 제거 | chat-channel 캐너리 1건 + 리터럴 테스트 1건 RED | ✅ 2 failed / 78 passed — 4키 중 `rendered` 케이스만 |
  | M3 | `buttonConfig` 블록**만** 제거 | buttonConfig 캐너리 1건만 RED, top-level 은 GREEN | ✅ 1 failed / 54 passed — 두 분기가 실제로 갈린다 |
  | M4 | copy-on-change 제거 | 기존 `동일 객체` 테스트 1건 RED | ✅ 1 failed / 54 passed — 그 테스트 |

  M3 을 넣은 이유: M1 만으로는 **두 위치를 한 덩어리로만** 검증하게 된다. 이 저장소가
  반복해 겪은 *"넷 중 하나만"* 은 정확히 그 사각지대에서 났다.

## 재배치 defer 사유 (`22_26_33` plan_coherence INFO 2)

트래커의 *"`node-output-allowlist.ts` 를 `shared/utils/` 밖으로 재배치"* 항목은 재개 조건을
*"소비처가 둘이 되면 그때 함께 정하라"* 로 뒀고, 이번 작업이 그 시점이다. **결론: 무변경.**

소비처가 `external-interaction/` 과 `websocket/` 으로 **갈렸으므로** 그 항목이 적어 둔 후보
*"유일 소비처 인근"* 이 성립하지 않는다. `nodes/core/` 로 올리는 대안은 그쪽이 EIA 전용 wire
키 8개를 떠안게 되어 더 나쁘다. `shared/utils/` 는 두 소비처 양쪽의 하위 계층이라 상향 참조가
없다. 남은 흠(*"shared 8파일 중 유일하게 도메인 타입 import"*)은 이 파일의 **방어 수단**인
컴파일타임 assertion 그 자체라 제거 대상이 아니다. 트래커 항목의 재개 신호를
*"shared 아래가 아닌 소비처가 생겼다"* 로 갈아 두었다.
