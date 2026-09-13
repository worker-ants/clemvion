# RESOLUTION — `--impl-done spec/conventions/` 라운드 3 (`review/consistency/2026/09/13/20_13_19`)

**BLOCK: NO** · Critical 0 · WARNING 2 · INFO 4 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 0건. `summary_written: false` → 직접 기록.

## WARNING#2 — bare 인용을 라운드 2 에서 «새로» 넣었다 (고침)

`guide-identifier-existence.test.ts:289` 의 `` `19_51_33` ``. **이 클래스를 고치는 커밋이
새 인스턴스를 만들었다** — 두 PR 통틀어 4번째다.

전체 경로로 고치고, 사후 술어를 **«내가 추가한 줄»** 로 좁혀 확인했다(`git diff origin/main`
의 `+` 줄 568줄 중 **0건**). 라운드 2 에서는 이 술어를 «파일 전체» 로 잡아 `CHANGELOG.md` 의
**선재분**에 걸렸다.

### 가드를 세우려다 규약 §4 를 어길 뻔했다

*"세 번째 재발이면 코드로"* 를 적용하려 했는데 `review-citations.md §4` 가
*"기존 bare 인용 499건은 다음에 건드릴 때 맞춘다 — **일괄 치환은 하지 않는다**"* 로 이미
결정돼 있었다. 폴더 스코프 가드는 `spec-links.test.ts` 의 선재 3건을 강제하므로 그 결정에
반한다. **재발 횟수가 처방을 정하는 게 아니라 규약이 정한다** — 자세한 것은
`review/code/2026/09/13/20_13_13/RESOLUTION.md`.

부수로 확인: 이 규약의 기계 강제는 **이미 존재한다**(`dto-jsdoc-citation-guard.ts`).
스코프가 backend DTO JSDoc 이라 이 폴더에 닿지 않을 뿐이고, 그 스코프를 넓히는 결정도
§4 와 같은 성격이라 한 PR 이 단독으로 정할 일이 아니다.

## WARNING#1 — 3라운드 연속 동일 · 등재분 (조치 불요)

`CONTAINER_*` 를 코드로 서술하는 spec 6파일 + §1.4 앵커 표기 택일. checker 가
*"3라운드 연속 상태 불변 — 신규 조치 불요, planner 턴에서 처리"* 로 판정했다.

## INFO — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 1 | `PROJECT.md:300` SoT 인용 | 선재·등재분 |
| 2 | `#1330`/`#1331` 계보가 spec Rationale 밖 | 등재분 |
| 3 | 발행 축 추가로 §2.1 미등재가 한 겹 더 벌어짐 | developer 권한 밖이라 미처리가 정당 |
| 4 | 트래커 L3404 해소 재확인 | 확인 완료 |
