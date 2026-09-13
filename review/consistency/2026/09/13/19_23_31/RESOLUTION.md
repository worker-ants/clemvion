# RESOLUTION — `--impl-done spec/conventions/` 라운드 1 (`review/consistency/2026/09/13/19_23_31`)

**BLOCK: NO** · Critical 0 · WARNING 3 · INFO 4 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 **0건** — 하향 여부 파일 단에서 대조.
`summary_written: false` 였고 디스크에도 없어 직접 기록했다.

## WARNING#3 — 이 diff 가 닫은 트래커 항목을 체크하지 않았다 (고침)

`spec-draft-nullable-notation-followups.md` 의 *"`CONTAINER_MISSING_EMIT`·
`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다"* 항목이 **(A) 문장 정정** 을 처분안으로
담고 있었고 이 배치가 정확히 그것을 했는데 `[ ]` 로 남아 있었다.

`[x]` + 해소 근거를 적었다. **실측을 함께 실었다** — `execution-engine.service.ts:8016` 이
`nodeExec.error = { message }` 로 기록한다. **`code` 필드가 아예 없다.** 그래서 가이드의
*"전용 에러 코드는 없어요"* 는 정확하다.

## WARNING#1 — spec 6파일이 아직 «코드» 로 적는다 (등재)

가이드는 이 배치가 고쳤지만 spec 쪽 6파일이 여전히 코드처럼 서술한다. 전수로 세어
등재했고, **통일할 선례가 같은 저장소에 있다** — `spec/4-nodes/1-logic/3-loop.md:189-191`
은 같은 표에서 **발행 문자열 전문**을 인용한다. 형태를 발명할 필요가 없다.

`spec/` 은 planner 전속이라 이 배치 밖이다.

## WARNING#2 — *"왜 이 둘만 카탈로그 밖인가"* 가 무기재다 (등재)

§1.4 가 `MAX_ITERATIONS_EXCEEDED` 등 *"앵커 없는 맨 문자열"* 7종을 **정식 카탈로그 항목**
으로 취급한다. 실측하면 `CONTAINER_*` 와 **구조가 같다**(둘 다 `throw new Error('X: …')`).
**차이는 코드가 아니라 카탈로그다.**

택일 두 갈래를 등재했고, **어느 쪽이든 이 배치의 가드를 건드린다**는 점도 함께 적었다 —
(a) backfill 하면 등록 2종이 자동으로 불필요해지고, (b) §1.4 에 *"메시지 접두"* 표기를
달면 탈출구의 의미가 달라진다.

> **이 WARNING 이 `/ai-review` WARNING#3 을 낳았다.** 카탈로그 탈출구를 들여다보다
> *"그게 오늘 한 번도 발화하지 않는다"* 를 발견했다 — 같은 세션의 두 게이트가 같은 자리를
> 다른 각도에서 짚었다.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | `PROJECT.md:300` SoT 표기 vs `user-guide-evidence.md §2` 미등재 | 선재 — 등재분(7라운드 확인) |
| 2 | plan 자평이 실제 이행보다 넓다 | **고침** — *"(a) 도 (b) 도 아니고 §B-3 설계로 절차적 정합화만"* 으로 축소 |
| 3 | 가드 family 가 어떤 `spec/conventions/*` 의 `code:` 에도 없다 | 선재 구조 공백 — 등재분 |
| 4 | 신규 식별자 7개 충돌 0건 | 조치 불요 |
