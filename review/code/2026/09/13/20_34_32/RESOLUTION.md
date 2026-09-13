# RESOLUTION — `/ai-review` 라운드 4 (`review/code/2026/09/13/20_34_32`)

Critical 0 · **WARNING 1** · INFO 10 · 위험도 **LOW**. forced 7명 전원 산출물 확보.

네 라운드 궤적: **W7 → W4 → W2 → W1**, MEDIUM → MEDIUM → LOW → LOW.

## WARNING#1 — JSDoc 이 두 블록 밀려 엉뚱한 describe 위에 얹혀 있었다 (고침)

*"발행 축 수집기 3종의 합성 경계 대조군"* 을 설명하는 JSDoc 이
`describe("발행 축 수집기 — 경계 대조군")` 이 아니라 **두 블록 떨어진**
`describe("staleGuideEntries — 판별 대조군")` 위에 있었다.

원인이 정확히 지목됐다 — **라운드 2**(`isMessagePrefixOnly` describe 삽입)가 밀기 시작하고
**라운드 3**(`staleGuideEntries` describe 추가)이 한 칸 더 벌렸다. **3라운드 동안 어떤
checker 도 못 잡았다.**

이동했다. 이동 전 상태(`JSDoc + staleGuideEntries describe` 인접)를 assert 로 확인하고,
이동 후 `JSDoc + 원래 대상` 인접 + 표류 지점 부재를 둘 다 검증했다.

> **orphan JSDoc 은 이 저장소가 내게 이름 붙여 둔 형태다** — *"파서 주석 3번 · 세부코드
> 위치 3번 · **orphan JSDoc 3번**"*. 그리고 원인도 기록된 것과 같다: **블록을 삽입할 때
> «자리» 를 보고 «무엇이 밀리는지» 를 안 본다.** 이번엔 두 라운드에 걸쳐 두 번 밀렸다.

## `--impl-done` 라운드 4 WARNING#5 — 이름 충돌 (고침)

라운드 3 에서 만든 `staleEntries` 가
`repo-guards/__tests__/internal-package-registration-guard.ts:129` 의 **export 된 동명
함수**와 충돌했다(시그니처 상이: `(string[], string[])` vs 내 `({token}[], Set)`).

`staleGuideEntries` 로 개명하고 양쪽을 함께 돌려 확인했다 — 24파일 **3,419건** GREEN,
기존 소유자 8곳 무영향.

> **이름을 정하기 전에 grep 하지 않았다.** 이 저장소에 그 규칙이 이미 있다 —
> *"새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라."* 개명 사유를 JSDoc 에 박았다.

## SPEC-DRIFT · INFO 10건 — 전부 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| SPEC-DRIFT | spec 6~7파일의 `CONTAINER_*` 서술 | **리뷰어가 «이 PR 조치 불요» 로 판정** — 등재·위임 완료 |
| 2 | `user-guide-evidence.md §2` 미등재 | 선재·등재분 (10라운드 확인) |
| 3 | `where` 탐색 루트가 `backend/src` 하드코딩 | **오늘 안전**(등록 3건 전부 그 안). 넷째가 밖을 가리키면 fail-loud 로 드러난다 |
| 4 | 카탈로그 하드 리드 | 4라운드 연속 기존 관행 |
| 5 | capture-group 인덱스가 정규식과 100줄 분리 | named capture 전환은 다음 기회 |
| 6 | vacuity 하한 리터럴 명명 | 4라운드 연속 이월(낮은 우선순위) |
| 7 | `where` 의 0건·2건 분기 대조군 | 라운드 3 에서 명시적 유예 |
| 8 | `userguide-gui-flow-section` 회색지대 | 실질 갭 없음 |
| 9·10 | security·side_effect 확인분 | 양성 |

## 검증

- 가드 스위트 **71건** GREEN · 폴더 23파일 **3,371건** GREEN
- 개명 후 충돌 소유자 테스트 포함 24파일 **3,419건** GREEN
- `run-test-all.sh` 5회차 — 별도 기록
