# RESOLUTION — 17_23_34 (라운드 4)

**CRITICAL 0 · WARNING 1 — 조치했다.** 조치가 `codebase/**` 의 주석을 바꾸므로 §정지 규칙대로
**라운드 5 를 돈다**. (주석뿐이라 넘어가고 싶지만, 바로 그 *"주석뿐"* 논리로 라운드 1의 fix 가
orphan JSDoc 을 만들었다 — 규칙을 내가 선언했으니 내가 지킨다.)

## 조치

| # | 분류 | 조치 |
|---|---|---|
| W1 | 문서 (인용 형식) | 이 PR 이 새로 넣은 **bare `hh_mm_ss` 인용 5곳**을 전체 경로로 (`review/code/2026/09/12/…`) |

**기존 인용은 건드리지 않았다** — `review-citations.md §4` 가 *"기존 인용은 소급 정리 대상이
아니다 — 그 자리를 다음에 건드릴 때 함께 맞춘다"* 로 정한다. 저장소에 같은 형태가 다수 남아
있고(`repo-guards/__tests__/` 등), 그것까지 고치면 이 PR 의 diff 가 무관한 파일로 번진다.
**이 PR 의 파일 안에서는 잔여 0건**을 정규식으로 확인했다.

## TEST — 그리고 jest 워커 SIGSEGV 는 **환경**이다

4단계 재실행에서 `unit` 이 두 번 실패했는데, 원인은 내 변경이 아니다(마지막 편집은 **주석뿐**):

| 실행 | SIGSEGV 희생자 |
|---|---|
| 17:35 | `workflow-assistant-stream.service.spec.ts` |
| 17:36 | `knowledge-base.service.spec.ts` |

**매번 다른 스위트**이고, 각자 단독 실행하면 통과한다. 결정적 확인 —
**`jest --runInBand` 로 전수 실행: 459 스위트 / 9,634 테스트 전부 통과**(워커 없이 단일
프로세스). 즉 워커 병렬 실행의 문제이지 코드 결함이 아니다. 같은 형태를 이 저장소가 이미
"flaky" 로 기록해 뒀다(무관한 변경 중 발생 → 재실행).

- `lint` · `build` PASS, `e2e` 305 PASS (직전 라운드 실행분 — 이후 변경은 주석뿐)
- `--runInBand` 전수 GREEN 이 이 라운드의 회귀 부재 증거다

## 이월 (INFO — 전부 defer 확정이거나 planner 축)

`swagger.md` `code:` 에 신규 가드 미등재(planner) · 가드의 비재귀 순회·닫힌 스캔 루트(현재
무해) · 3-way 충돌 fixture · `ParseUUIDPipe` · `throwInvalidField` 넓은 타이핑(3회 유예) ·
`publicKey` 런타임 단언 · falsy-guard 단독 미검증.

> reviewer 3명이 이번에도 **미커밋 뮤테이션 잔여물**을 관측했다(이전 라운드와 같은 패턴).
> 내 뮤테이션은 커밋 전에 원복·assert 했고, 관측 시점엔 사라져 있었다고 그들도 적었다.
> 트래커의 「리뷰 in-flight 뮤테이션」 항목에 **누적 관측**으로 이미 옮겨 뒀다.
