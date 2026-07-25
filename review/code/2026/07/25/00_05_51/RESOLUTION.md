# RESOLUTION — 2회차 (fix 후 fresh 리뷰)

LOW / Critical 0 / Warning 5. Warning 5건 전부 처리(1건은 이미 다음 slice 로 이관 확인).

## 조치 항목

| # | 조치 | 근거 |
|---|---|---|
| 1 | 쓰기 측 raw ref 노출 — **조치 없음(추적 확인)**. 리뷰어도 "이번 slice 비차단, 이미 plan/RESOLUTION 에 이관 추적 중" 으로 판정 | plan §리뷰 후속 체크박스 존재 |
| 2 | **내 정정 수치가 또 틀렸다** → 재실측 후 정정 | 아래 §계측 실패 참조 |
| 3 | 테스트 개수 "400 → 407(신규 7)" → **400 → 409** 로 정정 | `npx vitest run` = 409, 신규 훅 `it(` = 8 + 구성 지점 1 |
| 4 | plan 13행 "**상태**: 미착수" 가 frontmatter·배너와 모순 → "1차 slice 완료, 나머지 미착수" 로 갱신 | 같은 파일 3곳이 서로 다른 상태를 서술 |
| 5 | 구성 지점(`useWidget()`) 재렌더 참조 안정성 통합 테스트 신설 | 하위 훅만 고정돼 있고 실제 배선 지점엔 `rerender` 단언이 없었다 |

## 계측 실패 — 같은 축 3회

"1117→1012" → "1116→1002" → 실제 **1116→1009**. 두 번 다 "실측했다" 고 적었으나:

- **프록시를 쟀다**: `wc -l` 대신 재구성 스크립트의 `len(out)`(리스트 **원소** 수). 구조분해
  블록이 8줄짜리 원소 1개라 7줄 미계상.
- **최종 상태 전에 쟀다**: 측정 후 deps 편집·테스트 보강이 이어졌다.

교훈은 "다시 재라" 가 아니다 — 2차 정정도 같은 이유로 틀렸다. 규칙은 **문서에 숫자를 쓰는 그
시점에, 프록시가 아니라 `wc -l`/`git diff --numstat`/러너 출력으로 잰다**. 본 문서의 숫자는
전부 그렇게 얻었다.

## 비-vacuity 검증

| 뮤턴트 | 기대 | 실측 |
|---|---|---|
| `worldGenRef` 를 매 렌더 새 객체로 (deps 계약 파괴) | 신규 통합 테스트 RED | **1건 실패** (원복 후 4/4) |

## TEST 결과

- lint: **PASS** (eslint 경고 0)
- unit: **PASS** (14) / channel-web-chat **409 passed (23 files)**
- build: **PASS**
- e2e: **통과** (259 passed)

## 보류·후속 항목

- Warning #1(쓰기 측 캡슐화) — `plan/in-progress/webchat-usewidget-extraction.md` 다음 slice.
- INFO 중 `useTokenRefresh` 가 `isStale` 대신 raw 비교를 재구현하는 건(diff 밖)도 같은 plan 의
  다음 slice 에서 함께 본다.
