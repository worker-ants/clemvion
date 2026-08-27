# RESOLUTION — consistency `03_03_36` (`--impl-done spec/5-system/`)

**BLOCK: NO** · CRITICAL 0 · WARNING 3 → **전부 반영**.

## W3 — **내가 방금 고친 버그와 정확히 같은 모양이 spec 에 3곳 더 있었다**

`6-websocket-protocol.md §4.2` 의 `retry_last_turn` 명령과 `NODE_NOT_RETRYABLE` ·
`RETRY_TOO_EARLY` 에러 코드 서술이 `output.error.details.…` 로 **한 겹 얕게** 적혀 있었다.

**리뷰어 주장을 그대로 받지 않고 백엔드로 확인했다** — `retry-turn.service.ts:153-164` 는

```ts
const outputData = nodeExec.outputData ?? {};
const output = (outputData.output ?? {}) as Record<string, unknown>;
const errorObj = output.error as { details?: { retryable?: unknown } };
```

로 **두 겹을 뚫는다**. 즉 구현은 옳고 문서만 얕다.

**이게 이 PR 의 결함과 같은 뿌리다.** 프런트가 §4.1 의 얕은 서술을 코드로 옮겨 배너가 죽었고,
§4.2 는 아직 그 얕은 표기를 갖고 있었다 — 다음 사람이 `retry_last_turn` 을 구현하며 같은
함정을 밟을 자리였다. 세 곳을 `outputData.output.error.details.…` 로 고치고, **왜 고쳤는지를
§4.1-a 에 기록**했다.

## W2 — 스테일 ⚠️ 마커

`conversation-thread.md §9.7` 위 마커가 *"코드 수정은 별건으로 트래커에 등재돼 있고 그
작업이 이 두 행의 문구도 검증한다"* 로 남아 있었다 — **그 작업이 이 PR 이고 끝났으므로**
그 문장은 이제 거짓이다.

**지우지 않고 해소 표기로 갱신했다.** 원문은 취소선으로 남긴다 — *"spec 산문이 곧 파싱
규칙으로 옮겨 적히는 자리"* 라는 증거로서 다음 사람에게 값이 있고, 그것이 이 마커를 처음
남긴 이유이기도 하다.

## W1 — 정본 트래커 체크 + 역참조

`12_24_55` CRITICAL 항목을 `[x]` 로 체크하고 **표면이 하나 넓었다**는 사실
(`node.completed` 호출부도 깨져 있었다 — 뮤테이션 M2 로 확인)을 함께 적었다. plan 은
`complete/` 로 이동, dangling 참조 0건 확인.

## 나머지 INFO — 조치 불요

- **#1** `3-execution.md` · `data-hydration-surfaces.md` 의 필드 요약이 §4.1-a 만큼 정밀하지
  않음 — 그 표들은 이벤트 **목록**이지 payload 계약이 아니다. 다음에 그 표를 만질 때.
- **#2** `6-websocket-protocol.md` 에 `## Overview` 부재 — `spec/5-system/` 전반의 기존
  관행이고 이 diff 범위 밖.
- **#3** `asRecord` 동명 함수가 `channel-web-chat` 에도 있다(널 처리가 다름) — 두 패키지는
  import 관계가 없다. 공유 유틸로 뽑을 때 시그니처를 맞출 자리.
- **#4** `wrapNodeHandlerOutput` vs backend `mock-output.ts` — 이름·경로 모두 분리, DRY
  관심사이지 식별자 충돌이 아니다.

TEST WORKFLOW 4단계 PASS — 이 스위트 95/95 · e2e 285 · 링크 가드 19/19.
