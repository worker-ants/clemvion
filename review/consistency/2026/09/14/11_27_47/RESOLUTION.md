# RESOLUTION — `--impl-done spec/conventions/` 라운드 1 (`review/consistency/2026/09/14/11_27_47`)

**BLOCK: NO** · Critical 0 · **WARNING 0** · INFO 4 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 실측 **0건**.
`cross_spec`·`rationale_continuity`·`plan_coherence`·`naming_collision` 이 **NONE**.

`--impl-prep` 의 WARNING 2건(트래커 체크박스 미반영 · 캐너리 세부 ③ 누락)이 **해소 확인**됐고,
권한 밖 3건이 우회 없이 등재만 됐음도 확인됐다.

## INFO#3 — 리뷰 인용 삭제가 `review-citations.md §1` 과 긴장 (**위반 아님**, 실측)

항목 3-② 로 캐너리 두 파일에서 자기수정 로그를 걷어내며 리뷰 인용 3건이 함께 빠졌다.
checker 는 *"동일 세션의 다른 인용이 남아 있고 주장이 새 실측으로 대체된 맥락이라 실질 위반은
아님"* 이라 했다. **결론은 같지만 근거는 구조적이다:**

| 규약 | 실제 주어 | 내 편집이 대상인가 |
|---|---|---|
| §1 *"인용은 유지한다"* | **`review/**` 산출물이 커밋되어 남는다** — §2(전체경로 권장)의 근거 | **아니다** (주석 편집 금지 규칙이 아니다) |
| §4 *"소급 정리 대상이 아니다"* | **bare `hh_mm_ss`** 의 일괄 기계 치환 금지 | **아니다** (bare 아님, 일괄 아님) |

그리고 인용의 목적인 **해소 가능성**을 직접 쟀다 — 세 세션(`14_34_18`·`15_52_06`·`16_26_57`)
전부 디스크에 있고 `plan/complete/trigger-workflow-ref-canary.md` 와 트래커가 여전히
인용한다. **해소 불가가 된 것 0건.** 인용이 소스에서 durable 층으로 옮겨간 것이고, 그것이
트래커 항목의 처방(*"RESOLUTION·커밋·plan 으로"*)이었다.

## INFO#2 — 신규 가드가 spec `code:` 미등재 (**전제가 실측보다 강하다**, 등재)

checker 가 *"시행 코드 추적성 **관례** 미적용"* 이라 했는데, 형제 repo-guard 를 세어 보면
관례라 부를 만큼 일관되지 않다:

| 형제 repo-guard | spec `code:` |
|---|---|
| `masked-reject-callers` · `user-entity-exposure` | **있음** (2) |
| `redis-fail-open-catalog` · `param-uuid-pipe` · `engine-error-code-anchor` | **없음** (3) |

내가 본떠 만든 `redis-fail-open-catalog` 가 미등재 쪽이다. 등재 자체는 개선이지만 `spec/` 은
planner 권한이므로, **두 질문**(이 가드를 넣을 것인가 · repo-guard 등재를 규약으로 세울
것인가)으로 갈라 수치와 함께 트래커에 올렸다. 후자를 정하지 않으면 다음 가드에서 같은
지적이 반복된다.

## INFO#1·#4 — 조치 불요

`#1` 트래커 신규 2항목은 직전 세션 WARNING 의 재등재이지 이 diff 가 만든 충돌이 아니다(확인).
`#4` 직전 라운드 WARNING 2건 해소 + 권한 밖 3건 등재 + 커서 디코더 클러스터 배제가 전부
정확하다는 **양성 확인**이다.
