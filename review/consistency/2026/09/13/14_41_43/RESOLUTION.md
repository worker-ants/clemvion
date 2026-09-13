# RESOLUTION — `--impl-done` (`review/consistency/2026/09/13/14_41_43`)

**BLOCK: NO · Critical 0 · WARNING 4 · INFO 4.** 전 항목 처분 완료.

## WARNING

| # | 처분 | 근거 |
|---|---|---|
| 1 | **등재분** | `user-guide-evidence.md §2` 가 신규/확장 가드를 미등재 — `#1330` 부터의 선재 갭이고 `spec/**` 이라 권한 밖. planner 항목에 **파일명·스코프·Rationale 요구**까지 반영해 뒀다 |
| 2 | **등재분** | *"허용목록 없음"* 번복 근거가 spec `## Rationale` 로 안 올라갔다. 같은 planner 항목에 **한 턴으로** 묶으라는 조건을 등재 문구에 적었다 — 세 조각(표·frontmatter·Rationale)을 나눠 처리하면 표가 두 번 미완결이 된다 |
| 3 | **등재분** | `cafe24-api-metadata.md §4` Principle 오인용 — 이번 작업과 **무관한 선재 결함**, planner 등재 완료 |
| 4 | **고침** | 리네임이 자매 파일의 상호참조를 놓쳤다(`guide-sanitized-message-parity.test.ts:16`). 같은 지적을 `/ai-review` 의 **6개 리뷰어**가 독립으로 냈다 — 두 게이트가 같은 자리를 짚었다 |

> **W#4 를 내가 놓친 이유를 실측했다.** 리네임 직후 `grep -rn "guide-error-code" … | head -12`
> 를 돌렸는데 **정확히 12줄이 나왔다** — 잘린 목록을 전수로 읽었다. 상한 없이 다시 세니
> 5파일이고 그중 하나가 이 자매 파일이었다. *"전수 열거"* 를 한다면서 출력에 상한을 걸었다.

## INFO — 조치 불요

- **1**: env 기준집합(`.env.example`·compose)을 소유하는 spec 문서 부재 — 오늘 무충돌, 향후
  "환경변수 명명 규약" 신설 시 조율 필요하다는 기록만.
- **2**: `cafe24-api-metadata.md` 도입부 `## Overview` 헤딩 부재 — 비긴급.
- **3**: 백로그에 Rationale 초안이 이미 심어져 재발 방지에 진전 — 양성 관찰.
- **4**: 넓힌 기준집합(env 선언처)이 `guide-error-code-truth.md §D` 가 기각한
  *"frontend 소스 포함"* 과 **다른 자원**이라 기각 결정 재도입이 아님 — 판단 유지.
  (기각된 것은 *"가이드가 인용한 이름이 프런트 라벨 맵으로 자기를 증명"* 하는 순환이고,
  env 선언처에는 그 순환이 없다.)

## 검증

`run-test-all.sh` ALL PASS (e2e 307) · 타입체크 ratchet 둘 baseline 일치.
