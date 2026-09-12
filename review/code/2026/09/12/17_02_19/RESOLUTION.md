# RESOLUTION — 17_02_19 (라운드 3)

**CRITICAL 0 · WARNING 1 — 조치했다.** 조치가 `codebase/**` 를 바꾸므로 §정지 규칙에 따라
**라운드 4 를 돈다**.

## 조치

| # | 분류 | 조치 |
|---|---|---|
| W1 | 테스트 (재발 방지 자동화) | **`repo-guards/__tests__/dto-class-name-collision`** 신설 — `modules/`·`common/` 의 `*.dto.ts` **114개**를 AST 로 훑어 `export class` 이름 중복을 센다 |

## 왜 트래커 등재로 끝내지 않았나

이 항목은 **라운드 1 에서 내가 낸 CRITICAL** 의 재발 방지다. 이미 트래커에 *"전수 스캔은
1초다"* 라고 처방까지 적어 뒀는데, 그 상태로 두면 **커밋되지 않는 1회성 grep** 이 유일한 증거로
남는다 — 다음 사람은 같은 실수를 같은 방식으로 다시 발견해야 한다. 이 저장소의 규율
(*"세 번째 재발이면 산문 규율 말고 코드로"*)을 굳이 세 번째까지 기다릴 이유가 없다: 형태가
**정적으로 판정 가능**하고 형제 가드(`dto-jsdoc-citation`)가 그대로 쓸 수 있는 틀을 제공한다.

## 가드가 실제로 문다 — 두 방향으로 확인

1. **실제 사고 재현**: 라운드 1 의 CRITICAL 을 그대로 되돌려(`ChatChannelRotateBotIdentityDto`
   → `ChatChannelBotIdentityDto`) 돌리면 **RED**. 원복 후 원본 동일성 assert.
2. **대조군 fixture 2종**: (a) 같은 이름을 쓰는 두 파일 → 잡는다. (b) 주석·문자열·JSDoc 예제
   속 `export class` 3개 + 진짜 선언 1개 → **선언 하나만** 센다(정규식이었으면 4개를 셌다).

## 이 가드가 첫 판본에서 자기 fixture 를 잡고 죽었다

`src` 전체를 훑었더니 **자기 대조군 fixture 를 실데이터로 세어** 실패했다. 형제 가드가
*"fixture 는 스캔 범위 밖에 둔다"* 고 적어 둔 이유를 몸으로 확인한 셈이다. 스캔 루트를 실측으로
좁혔다 — `*.dto.ts` 는 `modules/`(111) 과 `common/`(3) 에만 있다. `> 100` 하한 단언도 함께 둬서
경로가 어긋나 0개를 스캔하면 **vacuous 통과 대신 실패**하게 했다.

> 부수: jest 의 `expect` 는 **두 번째 인자를 안 받는다**(vitest 와 다르다). 첫 판본이 그 형태로
> 죽어서, 진단을 비교 **값**에 싣는 형태로 바꿨다 — 빈 배열과 대조하면 diff 가 그대로 진단이다.

## 이월 (INFO — 전부 스코프 밖이거나 이미 등재)

`ParseUUIDPipe` 부재 · 요청 바디 DTO 화 · `response-contract` 런타임 배선 · `throwInvalidField`
타입 좁히기(3회 유예) · `it.each` 구조 중복 · `publicKey` 런타임 단언 · falsy-guard 단일파일
미검증 · §7 파일 트리 서술.

## TEST

- `run-test-all: ALL PASS` (lint · unit · build · e2e 305)
- 신규 가드 4/4 · 재현 뮤테이션 RED
