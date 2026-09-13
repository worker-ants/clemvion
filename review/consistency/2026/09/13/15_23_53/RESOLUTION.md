# RESOLUTION — `--impl-done` 라운드 3 (`review/consistency/2026/09/13/15_23_53`)

**BLOCK: NO · Critical 0 · WARNING 3 · INFO 4.** developer 쪽 추가 조치 **없음**.

라운드 2 의 CRITICAL(bare `hh_mm_ss`)이 해소 확인됐다 — checker 가 전수 grep 으로
**신규 위반 0건**을 재확인했다(INFO#3).

## WARNING 3건 — 전부 `spec/**`, 전부 등재분

| # | 내용 | 왜 developer 가 못 고치나 |
|---|---|---|
| 1 | `user-guide-evidence.md §2` 표·frontmatter 가 이 가드 가족을 미등재("가드 3건" 그대로) | `spec/` 쓰기 권한 밖. **`#1330` 부터의 선재 gap** 이고 이번 PR 이 만든 것이 아니다 |
| 2 | *"허용목록 없음"* 원칙 번복 근거가 spec `## Rationale` 로 미승격 | 〃. 3라운드 연속 열려 있으나 **developer 쪽 조치는 완료** — 초안까지 등재해 뒀다 |
| 3 | `cafe24-api-metadata.md §4` Principle 오인용 | 〃. 이번 PR 과 **완전 무관한 선재 결함**(2026-05-16 작성 시점부터) |

> checker 의 정리를 그대로 옮긴다 — *"developer 쪽 추가 조치 없음. 이번 PR 은 권한 경계를
> 지키며 필요한 모든 spec 갱신을 planner 백로그에 **완결된 형태로** 위임 완료했음을 확인."*

**세 건 모두 한 planner 턴에 묶어야 한다**는 조건을 등재 문구에 적어 뒀다. 나눠 처리하면
§2 표가 두 번 미완결이 되고, 그게 이 가드 계열이 실제로 반복해 온 형태다.

## INFO

| # | 처분 |
|---|---|
| 1 | 이번 번복이 `#1330` 기각 사유 중 **"frontend 자기증명 오염" 축은 보존**했다는 확인 — 완전 폐기가 아니라 **부분 선택적 번복**. planner 가 Rationale 에 *"무엇을 뒤집고 무엇을 보존했는가"* 를 쓰도록 등재 문구에 이미 반영 |
| 2 | 신규 식별자 6종 전역 grep — 충돌 0건. `GUIDE_EXTERNAL_VOCABULARY` vs 무관 도메인 `KNOWN_DOCS_ABSENT` 접두 분리는 impl-prep 단계 결정대로 유지 |
| 3 | bare `hh_mm_ss` 해소 확인 — 양성 |
| 4 | 리네임 전방 참조 orphan **0건** — 남은 `guide-error-code-*` 는 전부 각주·역사 서술이고 `plan/complete/` 는 소급 정정 대상 아님(관례 일치) |

## 검증

라운드 2 CRITICAL 해소 확인 · `run-test-all.sh` ALL PASS (e2e 307) · 가드 스위트 24/24.
