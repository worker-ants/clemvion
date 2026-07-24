# RESOLUTION — staleness 축 분리 (1차 slice)

전체 위험도 MEDIUM / Critical 0 / Warning 6. **Warning 6건 전부 조치**(1건은 근거 기록 후 다음
slice 이관). 지적 중 정량 주장 2건은 **내가 먼저 실측으로 재확인**하고 착수했다 — 리뷰어가
숫자를 들고 오면 그 숫자부터 검증하는 것이 이 저장소에서 반복 학습한 순서다.

## 조치 항목

| # | 카테고리 | 조치 | 실측 근거 |
|---|---|---|---|
| 1 | Scope/Maintainability | **재포맷 전량 철회.** base 파일을 원본으로 되살려 구조 변경(import·구조분해·이동 구간 삭제)만 재적용 | base 가 **이미 prettier-dirty** 이고 lint 는 prettier 를 강제하지 않음(`--check` + eslint config 확인) → 내 `prettier --write` 는 **어떤 게이트도 요구한 적 없는** drive-by. diff **328줄 → 133줄**, 파일 1118 → **1009줄** |
| 2 | Architecture | **다음 slice 로 이관 + plan 에 체크박스 신설.** 쓰기 측(`invalidateWorld`/`markUnmounted`) 캡슐화는 `teardownSession`/`start` 본체와 함께 옮겨야 인터페이스를 두 번 안 바꾼다 | plan §리뷰 후속에 근거 기록 |
| 3 | Requirement/Testing | `worldGenRef` 를 4개 `useCallback` deps 에 추가. ref 자체의 렌더 간 동일성(`toBe`) 단언을 테스트에 추가 | eslint 실측 base **0건** → 추출 후 **5건** → 조치 후 **0건**(base 복귀). 추출 전엔 지역 `useRef` 라 ESLint 가 안정성을 알았고, 훅 반환이 되며 그 정적 신호가 조용히 약화됐다 |
| 4 | Requirement | `use-widget.ts` 구조분해에서 미사용 `bootGenRef` 제거 | `no-unused-vars` 경고 해소(위 0건에 포함) |
| 5 | Documentation | plan 의 **"1117 → 1012줄" 은 틀렸다** — 정정 + 왜 틀렸는지 명시 | `git show origin/main:… \| wc -l` = 1116, 당시 현재 = **1118**(증가). 내가 적은 값은 어느 시점의 실측도 아니었다. 재포맷 철회 후 실제 = **1009** |
| 6 | Documentation | 이동된 JSDoc 4곳의 "이 파일" 자기지시를 `use-widget.ts` / "이 파일군" 으로 정정 | `grep "이 파일"` 잔여 1건은 올바른 용법(이 파일로 옮겨온다) |

INFO 중 반영: `BootAttempt` 타입 테스트 재사용(6곳), 두 축 동시 변화 조합 테스트 1건 추가.

## 비-vacuity 검증 (신규 단언이 실제로 무언가를 잡는가)

| 뮤턴트 | 기대 | 실측 |
|---|---|---|
| `cannotApplyConfig` 가 world 도 보게 (= 17_36_57 CRITICAL 재주입) | 축 분리 테스트 RED | **2건 실패** |
| `worldGenRef` 를 `useRef` 대신 매 렌더 새 객체로 (= deps 계약 파괴) | 참조 안정성 단언 RED | **1건 실패** |

원복 후 8/8 통과.

## TEST 결과

- lint: **PASS** (eslint 경고 0 — base 와 동일)
- unit: **PASS** (14) / channel-web-chat **409 passed (23 files)** / typecheck clean
- build: **PASS**
- e2e: **통과** (259 passed)

## 보류·후속 항목

- Warning #2(쓰기 측 캡슐화) → `plan/in-progress/webchat-usewidget-extraction.md` §리뷰 후속에
  체크박스로 신설. 본 티켓의 다음 slice 가 가져간다.

## 후속 라운드 정정 (00_05_51 W2·W3)

본 문서가 처음 적은 "1002줄 / diff 125줄 / 408 tests" 도 실측과 어긋났다 — 재측정 결과
**1009줄 / diff 133줄 / 409 tests**. 원인: 줄 수는 `wc -l` 이 아니라 재구성 스크립트의
`len(out)`(리스트 원소 수)을 셌고 구조분해 블록이 8줄짜리 원소 1개였으며, diff·테스트 수는
이후 편집 **전**에 잰 값이었다. 같은 문서가 지적한 "미실측 주장" 을 정정하면서 반복했다.
