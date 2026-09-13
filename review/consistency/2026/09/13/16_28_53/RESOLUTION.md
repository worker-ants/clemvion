# RESOLUTION — `--impl-done spec/conventions/` 라운드 6 (`review/consistency/2026/09/13/16_28_53`)

**BLOCK: NO** · Critical 0 · WARNING 1 · INFO 5 · 위험도 LOW.
5개 checker 전원 전문 제출(`unfinished: []` · `recovered: []`).

## 하향이 없었음을 파일 단에서 대조했다

`consistency-summary` 가 checker 의 `[CRITICAL]` 을 WARNING 으로 낮춰 `BLOCK: NO` 를 내는
것은 규약 위반이므로, 요약을 믿지 않고 **원 리포트를 직접 grep** 했다 —
`[CRITICAL]` 마커 **0건**. 5개 파일의 "CRITICAL" 등장은 전부 *"Critical 위배: 없음"*
헤딩이다. 요약의 `BLOCK: NO` 와 리포트가 일치한다.

## WARNING #1 — `user-guide-evidence.md §2` 미등재 (권한 밖 · 등재분)

SoT 가 *"Build-time 가드 3건"* 이라 적고 있는데 실제 인벤토리는 이 PR 의
`guide-identifier-existence` · `guide-sanitized-message-parity` 를 포함해 더 넓다.
**6라운드 연속 같은 항목**이고 `spec/conventions/**` 쓰기는 `project-planner` 전속이다.

자기-반증형 소정정 예외에도 **해당하지 않는다** — 그 예외는 *내가 그 문서에 써 넣은
예고 문장*에만 열리고, 가드 인벤토리 표는 예고가 아니라 목록이다(plan `§A` 에 기록).

checker 자신이 결론을 적었다: *"developer 쪽 조치(플랜 등재·권한 준수)는 완료 상태이므로
codebase 쪽을 추가로 막을 근거 없음"*. 갱신 초안은
`plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 이하에 이미 있다.

## INFO — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 1 | `cafe24-api-metadata.md §4` Principle 오인용 | 이 PR 과 무관한 **선재** 결함. 별도 planner 항목으로 등재분 |
| 2 | 부분 재도입이 `#1330` 의 "frontend 자기증명 오염" 기각 사유는 **보존** | 기준집합에서 frontend 소스는 계속 제외 — 무엇을 뒤집고 무엇을 지켰는지 초안에 반영됨 |
| 3 | `review-citations.md §2` 준수 — bare `hh_mm_ss` **0건** | 라운드 2 에서 전수 정정한 클래스가 유지됨을 재확인 |
| 4 | 명명 규약(`field-table`/`code-field`/`backtick`) 일관 | 조치 불요 |
| 5 | 신규 식별자 6종 전수 대조 **충돌 0건**, 옛 `guide-error-code-*` **댕글링 0건** | 리네임 잔해 없음 |

## 라운드 6 이 수렴이 아닌 이유

이 게이트는 **라운드 4 부터 수렴**해 있었고 이번도 같다 — 남은 WARNING 은 planner 몫이다.
라운드가 이어지는 것은 이쪽이 아니라 `/ai-review` 쪽이며, 이번엔 그마저 **Critical 0 ·
WARNING 0** 이었다. 그럼에도 라운드 7 이 필요한 것은 **내가 INFO 처분과 선행-참조 제거로
`codebase/` 를 고쳤기 때문**이다(`review/code/2026/09/13/16_28_47/RESOLUTION.md`).
