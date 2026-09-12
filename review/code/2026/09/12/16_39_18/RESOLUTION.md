# RESOLUTION — 16_39_18 (라운드 2)

**CRITICAL 0 · WARNING 3 — 전부 조치했다.** 두 건이 `codebase/**` 를 바꾸므로 §정지 규칙에 따라
**라운드 3 을 돈다**.

## 조치 항목

| # | 분류 | 조치 |
|---|---|---|
| W1 | 규약 (응답 DTO 위치) | 파일을 **`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`** 로 옮겼다 — `swagger.md §5-1` 이 정한 자리이자 이름이다 |
| W2 | 문서 (plan 내부 모순) | 뮤테이션 개수를 **6종**으로 통일. 체크리스트·증거·표 세 자리를 함께 고쳤다 |
| W3 | 테스트 (orphan JSDoc) | 내가 삽입한 `it.each` 2블록이 *"대칭 필드도 막는다"* 주석과 그 테스트를 갈라놨다 → 주석을 제 테스트 위로 되돌렸다 |

## W1 — **reviewer 의 권고와 반대로 했다. 근거를 적는다**

요약은 *"코드를 되돌리지 말 것(R-CC-22 위반이 더 크다)"* 이라 했다. **그 전제를 실측으로
확인하니 성립하지 않았다**:

| 판정 | 이동 전 (`dto/`) | 이동 후 (`dto/responses/`) |
|---|---|---|
| `2-trigger-list.md` (`dto/**`) | MATCH | **MATCH** |
| `15-chat-channel.md` (`dto/chat-channel-*.dto.ts`) | MATCH | MISS |

**R-CC-22 가 막으려는 것은 "신규 파일이 어떤 glob 에도 안 잡히는 것"** 이고, 이동 후에도
`2-trigger-list.md` 가 잡는다 — spec-link 판정은 성립한다. 남는 것은 *"chat-channel spec 이
자기 파일을 보는가"* 한 축이고, 그건 **glob 한 줄을 넓히면 닫힌다**(트래커 항목).

반대로 규약을 어긴 자리는 **다음 응답 DTO 가 그대로 따라 한다.** 정식 규약이 자리를 정하고,
glob 은 그 자리를 덮도록 고치는 도구다 — 순서를 뒤집지 않는다.

> **이동이 숨은 결함을 하나 드러냈다.** `dto/responses/` 하위에만 도는 `dto-jsdoc-citation`
> 래칫이 곧바로 RED 를 냈다 — 내 `publicKey` JSDoc 에 `/ai-review` 인용이 들어 있었고,
> **JSDoc 은 공개 OpenAPI `description` 으로 나간다**(`swagger.md §3`). 더 나쁜 것은 내가 그
> 규칙을 **같은 파일 머리말에 써 놓고** 어겼다는 점이다. 서사를 `//` 로 내렸다.
> 평평한 자리에 뒀다면 이 가드는 **영영 안 돌았다** — 관례를 지키는 것이 가드를 얻는 일이기도
> 하다는 실측이다.

## 공유 워크트리 오염 — 이번엔 방향이 반대였다

요약의 §관측된 이상 상태가 `hasField` 의 미커밋 뮤테이션을 보고한다. **내 뮤테이션은 라운드 2
준비(16:39:18)보다 앞선 16:26 에 끝나고 원복까지 확인**했다(스크립트가 원복 후 원본 동일성을
assert 한다). 요약 자신이 적듯 `testing` reviewer 가 **자기 검증으로 같은 뮤테이션을 재현**했다
— 트래커의 「리뷰 in-flight 중 뮤테이션 금지」 항목은 지금까지 *내* 쪽만 적고 있었는데,
**reviewer 도 같은 트리를 뮤테이션한다**는 관측을 그 항목에 덧붙인다.

## 이월 (INFO — 조치 불요)

`ParseUUIDPipe` 부재 · `response-contract` 런타임 배선 · POST body `@ApiBody` 부재 ·
falsy-guard 단일파일 미검증 · §7 파일 트리 서술 — 전부 트래커에 있거나 스코프 밖.

## TEST

- `run-test-all: ALL PASS` (lint · unit **458 suites / 9,631** · build · e2e 305) — 조치 후 재실행
- `dto-jsdoc-citation` 래칫 5/5 통과
