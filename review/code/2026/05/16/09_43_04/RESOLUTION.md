# Review Resolution — e2e Makefile follow-up 2026-05-16

세션: `review/code/2026/05/16/09_43_04`

## 결과

Critical 0. Warning 3 — 1건 즉시 조치 (Makefile 주석 보강), 2건 자연 해소 (REVIEW 종료 시 plan complete 이동). Info 1건 즉시 조치 (README 표현 명시화). 회귀 없음 (e2e 12/12 유지).

## 즉시 조치

### W1 — Makefile `e2e-test-full` 주석에 설계 의도 명시 (requirement reviewer)

**문제** 주석이 short-circuit 동작은 정확히 기술하나, **왜** runner2 (playwright) 가 skip 되어야 하는가의 설계 의도가 빠짐. 후속 개발자가 "playwright 도 항상 실행해야 하지 않나" 라고 오해할 여지.

**조치** Makefile 주석에 한 단락 추가:

```
설계 의도: runner1 (backend e2e) 실패 시 runner2 (playwright) 는 실행하지
않는다 — 백엔드 e2e 통과가 frontend e2e 의 선행 조건이며, 백엔드가 깨진
상태에서 playwright 를 돌려 노이즈 실패를 발생시키지 않기 위함.
```

### I (README) — "세 `e2e-*` 타겟" 표현 명시화 (documentation reviewer)

**문제** README 의 새 e2e 섹션에서 "세 `e2e-*` 타겟 모두 매 실행 시 `--build`" 라는 표현이 `e2e-down` 까지 포함하는지 모호. 코드 예시에 4개가 나열되어 있어 독자가 잠시 혼동 가능.

**조치** "빌드 타겟 세 개 (`e2e-up`, `e2e-test`, `e2e-test-full`) 모두 ... (`e2e-down` 은 정리 전용이라 제외)" 로 정확히 열거.

## 자연 해소 (Warning W2/W3 — plan 라이프사이클)

reviewer 가 "plan 이 `in-progress/` 에 있는 채로 commit 됐다"·"미체크 항목 잔존" 으로 지적. 본 commit 시점에서는 REVIEW WORKFLOW 가 아직 진행 중이라 `[ ] REVIEW WORKFLOW` 가 미체크인 것은 정합. REVIEW 종료 후 `complete/` 로 `git mv` 하여 자연 해소.

reviewer 의 진단은 commit 시점의 스냅샷만 보고 내린 것으로, 워크플로 단계의 의도된 순서를 반영하지 않음. 실제 자동 commit 규약 (developer SKILL.md "단계별 자동 커밋") 에 따르면 단계별 commit 이 권장되며 plan 이동은 마지막 단계 (REVIEW 후) 에 묶임.

## Info — 추적

총 ~28건 INFO. RESOLUTION 에 상세 기록 생략 — 주요는 다음 세 카테고리:

1. **추가 문서 보강 권고** — README 의 `make e2e-*` 섹션이 인프라 의존 (Docker Desktop) 을 명시하면 더 친절함. 다음 사이클.
2. **CHANGELOG 의 Test infrastructure 섹션 위치** — 정식 release 시 별 섹션으로 promote 권고. 본 PR 범위 밖.
3. **e2e-up 후 backend-e2e 외 서비스 정리** — `e2e-up` 직후 `make e2e-down` 없이 다른 작업 진행 시 idle container 잔존. 본 PR 범위 밖.

## TEST WORKFLOW 재검증

- **e2e (`make e2e-test`)**: 12/12 suites, 66/66 tests PASS — Makefile 주석·README 텍스트 변경 외 동작 영향 없음.
- backend/frontend 코드 변경 0건이라 lint/unit/build 영향 없음 (이전 commit 에서 이미 검증됨).
