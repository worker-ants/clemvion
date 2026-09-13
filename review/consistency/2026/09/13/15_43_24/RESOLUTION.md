# RESOLUTION — `--impl-done` 라운드 4 (`review/consistency/2026/09/13/15_43_24`)

**BLOCK: NO · Critical 0 · WARNING 2 · INFO 4.** **developer 추가 조치 없음.**

checker 의 결론을 그대로 옮긴다 — *"developer 는 위 두 항목에 대해 추가 조치 없이 진행 가능
— 권한 경계(`spec/**` 쓰기 금지)를 정확히 지키고 있음."*

## WARNING 2건 — 둘 다 `spec/**`, 둘 다 등재분

| # | 내용 | 판정 |
|---|---|---|
| 1 (**4중 수렴**) | `user-guide-evidence.md §2` 가드 가족 미등재 + *"허용목록 없음"* 번복 Rationale 미승격 | `spec/` 쓰기 권한 밖. 초안까지 등재해 뒀고 checker 가 *"복붙 수준"* 으로 확인 |
| 2 (2중 수렴) | `cafe24-api-metadata.md §4` Principle 오인용 | 〃. **이 PR 과 무관한 2026-05-16 선재 결함** |

> **4라운드 연속 같은 항목이 뜨는 것은 정상이다.** 이 항목의 해소는 planner 턴에서만 가능하고,
> 매 라운드 checker 는 *현재 상태*를 본다. 중요한 것은 **developer 쪽 잔여가 0** 이라는
> checker 의 명시 확인이고, 라운드 1~4 내내 그 판정이 유지됐다.
>
> 세 조각(§2 표 · frontmatter · `## Rationale`)을 **한 planner 턴에** 묶으라는 조건도
> 등재 문구에 적혀 있다 — 나눠 처리하면 표가 두 번 미완결이 되고, 그게 이 가드 계열이
> 실제로 반복해 온 형태다.

## INFO

| # | 처분 |
|---|---|
| 1 | 이번 번복이 **부분 재도입**이라는 확인 — frontend 소스는 여전히 기준집합 밖이라 `#1330` 이 기각한 *"자기증명 오염"* 축은 **보존**했다. planner 가 Rationale 에 *"무엇을 뒤집고 무엇을 보존했는가"* 를 쓰도록 이미 반영 |
| 2 | 모듈-private `UPPER_SNAKE` 상수명이 backend repo-guard 의 동명 상수와 **우연히 중복** — 둘 다 비-export 라 충돌 아님. 공유 유틸화 시 통합 고려 |
| 3 | `GUIDE_EXTERNAL_VOCABULARY` 접두 분리 의도가 실측과 일치 확인 |
| 4 | §2 gap 이 **방치가 아니라 추적 중**임을 확인 |

## 검증

`spec/conventions/**` 델타 0 · 라운드 1~4 내내 developer 잔여 0 유지.
