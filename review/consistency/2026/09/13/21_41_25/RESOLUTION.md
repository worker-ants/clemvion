# RESOLUTION — `--impl-done spec/conventions/` 라운드 7 (`review/consistency/2026/09/13/21_41_25`)

**BLOCK: NO** · Critical 0 · WARNING 3 · INFO 7 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 0건.

`plan_coherence` 가 **NONE** 이고 라운드 6 의 두 지적(`spec_impact` 5파일 누락 · §1 합의
미인용)이 `eb53aba1c` 에서 **실측 해소**됐음을 확인했다.

## WARNING#3 — SoT 인용이 착지하지 않는다 (고침)

세 곳이 `user-guide-evidence.md §2` 를 SoT 로 인용하는데 **그 문서에 이 가드가 없다**
(실측 `grep -c guide-identifier` → **0**):

| 자리 | 처분 |
|---|---|
| `guide-identifier-scan.ts` 헤더 | 착지하는 SoT(`error-codes.md` + `3-error-handling.md §1`)로 교체 + 미등재 사실 명시 |
| `guide-identifier-existence.test.ts` JSDoc | 같은 정정 |
| `PROJECT.md:300` | 같은 정정 |

`spec/` 은 권한 밖이라 **문서를 고치는 대신 인용을 사실대로** 만들었다. *"가족 규약은 그
문서이지만 이 가드의 등재는 planner 트래커 대기"* — 지금도 참이고 등재 후에도 참이다.

> `#1330` 이 가족을 만든 시점부터 어긋나 있었고 **9라운드 동안 INFO 로 떠다녔다.**
> 등급이 올라온 것은 checker 가 `PROJECT.md` 와 **스캐너 헤더를 함께** 봤기 때문이다 —
> 한쪽만 보면 *"문서 표가 낡았다"* 로 읽히고, 둘을 함께 보면 *"내 코드가 없는 것을
> 가리킨다"* 가 된다.

## INFO#7 — `complete/` 봉인 대비 역참조 (고침)

카탈로그 탈출구의 **조건부 폐기** forward-note 가 내 plan 안에만 있었는데 그 plan 은
`complete/` 로 봉인된다. 결정이 내려질 트래커 §1.4 항목에 **양방향** 역참조를 넣었다 —
(a) 를 택하면 등록 2건이 불필요해지고, won't-do 면 탈출구 분기와 대응 테스트 3건이 제거
대상이다.

## WARNING#1·#2 — planner 등재분 (조치 불요)

spec 6파일의 `CONTAINER_*` 서술 + §1.4 축 미구분. **7라운드 연속 불변**이고 checker 가
*"재등록 불요, 이 PR 비차단"* 으로 판정했다.

## 나머지 INFO — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 1 | `PROJECT.md:300` SoT | **WARNING#3 처분에 포함** |
| 2 | `isMessagePrefixOnly` vs `R-CCA-9`(런타임 message-parsing 금지) | checker 가 *"층이 다르고 정신적으로 정합"* 으로 확인 — 정적 문서검증 vs 런타임 분기 |
| 3 | §1.4 «탈출구» 설계는 기존 결정 재사용 | 조치 불요 |
| 4 | 가이드 문구 정정은 `#1330` 선례의 두 번째 적용 | **양성 확인** — 무근거 번복 아님 |
| 5 | *"허용목록 없음"* 원칙이 conventions 미등재 | 세 번째 반복 시 Rationale 승격 검토 — 등재분 |
| 6 | `CONTAINER_*` 6파일 중복 확인 | 중복 재등재 방지 기록 |
