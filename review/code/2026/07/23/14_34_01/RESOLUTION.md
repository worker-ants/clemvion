# RESOLUTION — review/code/2026/07/23/14_34_01

대상: branch `claude/isconversationoutput-refactor-dc0472` (base `origin/main`).
리뷰 시점 마지막 코드 커밋 `1d46f483a`.

SUMMARY 판정: **RISK=LOW / CRITICAL=0 / WARNING=1 / INFO=6**. forced 7/7 전원 결과 확보.

> **디스크 기록 갭 확인**: 1차와 동일하게 `summary_written=false`(write_blocked) 라 main 이
> `SUMMARY.md` 를 직접 Write 했고, `reviewers[]`(7) vs `ls *.md`(7) 대조로 누락 0 확인.

## 조치 항목

| SUMMARY # | 분류 | 내용 | 조치 |
|---|---|---|---|
| **WARNING 1** | requirement | JSDoc 이 "근거의 유일한 SoT" 를 선언해 놓고, 정작 같은 diff 가 테스트로 고립시킨 `endReason` 2단 조회(`result?.endReason ?? output.endReason`)를 "Stage 5 이후 종결" bullet 에서 언급하지 않음 — 같은 JSDoc 의 "봉투 대기" bullet 은 동일 성격 fallback 을 명시하므로 처리가 비일관 | **반영** — 해당 bullet 에 2단 조회 서술 추가. 존재뿐 아니라 **우선순위의 의미**(`result` 가 그 종결의 정본)까지 명시해, 아래 INFO 1 로 새로 고정한 동작과 문서를 일치시켰다 |
| **INFO 1** | testing | `result.endReason` 과 `output.endReason` 이 서로 다른 값으로 동시 존재하는 fixture 가 없어 `??` 좌우 교환(우선순위 역전) mutation 이 41/41 green 유지 | **반영** — 주장을 먼저 실측 재현(교환 시 tsc clean + 41/41 green = **머지 가능한 mutation 생존**). 우선순위 고정 fixture 1건 추가(41 → 42): `result.endReason` 에 무효값·`output.endReason` 에 유효값을 동시에 실어 방향을 관측 가능하게 만든다. 재실측 시 I 제거로 이 테스트 1건만 red |
| INFO 2 | documentation | 1차 라운드에서 닫은 "실측 수치 이중 기록" 을 같은 라운드의 **두 번째** 신규 테스트 주석이 축소판으로 재발시킴(`tsc clean + 40/40 green` 인라인) | **반영** — 구체 수치 제거하고 plan §측정 1b 포인터로 통일. 신규 3번째 테스트도 같은 규칙으로 작성 |
| INFO 3 | requirement | plan 의 `api-convention §5.4` 인용이 "unsound 판별자" 논거와 주제가 달라 적합성이 느슨함 | **반영** — 직접 논거(`swagger.md §1-4`)와 분리하고 "관련 규약 — 직접 논거 아님" 으로 격하 |
| INFO 4 | maintainability | `isConversationOutput` JSDoc 만 헤딩·blockquote 사용으로 파일 내 포맷이 갈라짐 | **미조치 (합의됨)** — plan 항목 3 및 1차 라운드에서 의도된 결정으로 확정. 리뷰어도 "조치 불요" 명시 |
| INFO 5 | documentation | 테스트 주석의 `§Stage 5 이후 종결` 이 spec 절 번호가 아니라 JSDoc 글머리 라벨을 가리켜 `§` 기호가 두 앵커에 혼용 | **미조치** — 리뷰어 자신이 "참조 대상 정확·오독 위험 낮음·수정 불요" 로 판정 |
| INFO 6 | 양성 확인 | 실행 로직 0줄 변경, 공격표면·부작용·의존성 없음, 신규 fixture 는 공유 상태 없이 격리 | 없음 |

## 이번 라운드가 실제로 닫은 것

1차·2차 리뷰가 각각 **실측으로 재현되는 안전망 구멍**을 하나씩 짚었고 둘 다 닫았다. `endReason`
표현식(`result?.endReason ?? output.endReason`)의 관측 가능한 표면은 이제 전부 고정됐다:

| 표면 | 고정 테스트 | 대응 뮤턴트 |
|---|---|---|
| `result` 단 (좌항) | `rejects a whitelisted endReason without result.messages` 외 | C |
| `output` 단 (fallback, 우항) | `detects a terminal whose endReason sits at output.endReason …` | H |
| 두 단의 **순서** | `prefers result.endReason over output.endReason when both …` | I |
| 키 부재 시 의미 | `rejects result.messages when the endReason key is absent entirely` | R1·R2 |

## 검증

- `output-shape.test.ts` → **42 passed** (39 → 40 → 41 → 42).
- run-results + conversation → **349 passed / 19 files**.
- `eslint` clean, `tsc --noEmit` clean, probe tsconfig 로 테스트 파일 타입체크 clean.
- mutation **12건 전수 재실행**(R1·R2·R3·H·I·A~G): R3(타입 차단, 0 red) 외 **11건 전부 정확히
  대응 테스트 1건만 red**. 신규 fixture 2건이 기존 guard 와 겹치지 않음 확인. 잔여 diff 0줄.

## 하네스 사고 1건 (기록)

WARNING 1 의 JSDoc 수정 후, **편집 전에 떠 둔 stale 한 백업 base 로 `restore`** 하는 바람에 그
수정이 통째로 되돌려졌다. 재적용 + base 재캡처로 복구했고 최종 파일에 반영돼 있다(`grep` 으로
확인). 원복 방식(백업 `cp` + 절대경로) 자체는 옳았으나 **base 가 stale 하면 미커밋 작업이
사라진다** — "커밋 먼저 → mutation harness" 가 더 안전한 이유이며, plan §mutation 실측 에
함정으로 기록했다.

## 다음 라운드

테스트 fixture 1건 + JSDoc 1곳이 추가돼 주석-only 가 아니므로 3차 fresh `/ai-review` 를 돌린다.
Critical 0 + **코드** Warning 0 이면 프로젝트 관례(다회 리뷰는 Critical·Warning 0 에서 INFO
비차단 수렴)에 따라 그 라운드에서 수렴한다.
