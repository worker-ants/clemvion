# RESOLUTION — 컬럼 층 가드의 남은 빈칸 (2라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 9 — **두 Warning 모두 `codebase/` 밖**이다. 1라운드 조치(`a71642fe0`)는 9명 전원이 소스 대조로
해소를 확인했다(INFO 1 · 2). 정지 규칙(1라운드 전에 선언): Critical · Warning 0 이거나 **`codebase/` 수정 0 인 라운드에서 수렴**, 최대 3라운드
→ 이 라운드는 코드 수정이 필요한 지적이 없어 **수렴**한다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 `--impl-prep` scope 가 작업과 무관(1라운드 W1 재기록) | 1라운드 처분 유지(코드 밖 · 근거 기록). SUMMARY 권장 2(재발 방지를 harness 백로그로)를 **이번 턴에 반영** — `plan/in-progress/harness-review-gate-followups.md` §O: 두 모드가 `spec/` 최상위 파일을 scope 로 받지 못해 무관한 폴더 + 손으로 붙이는 보정 블록이 관례가 됐고, 그 관례가 앞선 두 PR 에서 **무관한 BLOCK: YES 를 두 번** 냈다(`entity-schema-declaration-drift` · `entity-column-declaration-drift` 1차 `--impl-prep`). 게이트(`review_guard.py` Gate 2)도 scope 를 보지 않는다는 것을 함께 적었다. 무관 scope 가 끌어온 spec 공백 셋은 트래커 planner 항목 «`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`» 로 등재 | 마무리 |
| W2 트래커가 아직 없는 `plan/complete/column-guard-gaps.md` 를 인용 | **관측 시점의 산물 — 조치 없음.** 리뷰가 도는 동안 작업 트리에 미리 써 둔 마무리 편집(미커밋)을 리뷰어가 읽었다. 그 `[x]` 와 인용은 `git mv plan/in-progress/column-guard-gaps.md plan/complete/` 와 **같은 마무리 커밋**에 들어가므로 커밋된 어느 상태에서도 죽은 링크가 되지 않는다(마무리 커밋 뒤 `git show HEAD:plan/complete/column-guard-gaps.md` 로 확인). 테스트 파일 헤더의 같은 인용(INFO 7)도 같은 커밋으로 살아난다. 교훈: 리뷰 fan-out 중에는 공유 작업 트리의 plan 도 건드리지 않는다 — 리뷰어가 미완 상태를 결함으로 읽는다 | 마무리 |
| INFO 8 롤백 · release 가 둘 다 실패하면 원인 오류가 가려질 수 있음 | 조치 없음 — e2e 정리 경로에서 롤백과 release 가 **둘 다** 실패하는 경우다. 1라운드 W2 의 요지(롤백 실패가 release 를 건너뛰게 하지 않는다)는 지켜지고, 그 이중 실패에서 어느 오류가 보고되는지는 이 테스트가 겨냥한 것이 아니다 | — |
| INFO 1 ~ 7 · 9 | 조치 없음 — 1 · 2 · 3 · 4 는 검증 기록, 5 · 6 은 1라운드와 같은 판단, 7 은 W2 와 같은 건, 9 는 W2 의 관측 경위 | — |

## TEST 결과

이 라운드는 코드 변경이 없다. 마지막 코드 커밋(`a71642fe0`) 뒤 TEST WORKFLOW:

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (366)
