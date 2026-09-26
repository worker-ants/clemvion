# RESOLUTION — `/ai-review` 1R (Critical 0 · Warning 1)

미리 선언한 정지 규칙은 «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건» 이다. 남은 Warning 은 plan 문서의 경로 인용 하나이고
codebase 를 고치지 않고 처분한다. 이 라운드의 codebase 수정은 0건이라 리뷰는 **1R 에서 수렴한다**.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 `integration-personal-owner-followup.md` 가 아직 없는 `plan/complete/forbidden-helper-sentences.md` 를 인용 | 이 PR 의 마무리 커밋이 plan 을 바로 그 경로로 옮긴다(`git mv`, 같은 PR). 머지 시점에는 참이고, `plan/in-progress/` 경로로 적으면 머지 직후 거짓이 된다. 저장소 선례도 같다 — `success-advert` 의 `advertised-response-contract.e2e-spec.ts` 머리 주석이 이동 전에 `plan/complete/success-advert.md` 를 적었다. push 전에 이동을 `git show HEAD:<path>` 로 확인한다 | 마무리 커밋 |
| INFO1 이음 규칙 · 헬퍼 이름이 spec 에 없다 | 조치 안 함 — `--impl-prep` INFO2 와 같은 지적으로 plan «검토 경고 처리» 표가 처분했다(헬퍼 JSDoc 이 규칙과 근거를 싣는다) | — |
| INFO2 §2-4 표 202 · 410 · 429 | 조치 안 함 — 트래커 planner 항목으로 이미 등재 | — |
| INFO3 재실행 두 곳의 서비스 문장이 이음보다 넓게 바뀜 | 조치 안 함 — plan «방향» 이 미리 적은 확장(종전 «— RolesGuard / … — 서비스» 는 이 두 곳만의 형식) | — |
| INFO4 `forbiddenWithService(string, string)` 인자 순서를 타입이 못 잡음 | 조치 안 함 — 13 호출부가 전부 헬퍼 결과를 첫 인자로 넘기고, 순서가 뒤집히면 문장이 헬퍼 문장으로 시작하지 않는다. 브랜드 타입은 호출부 13곳과 헬퍼 두 개의 반환 타입을 함께 바꿔야 해 이 결함 크기에 비해 크다 | — |
| INFO5 integrations 두 상수의 서비스 문장 중복 | 조치 안 함 — plan «안 하는 것» 의 서비스 문장 표기 통일 범위 밖(이 PR 전부터의 중복) | — |
| INFO6 호출부가 헬퍼를 거치는지 강제하는 테스트가 없음 | 조치 안 함 — plan «안 하는 것 — 형식 가드» 와 뮤턴트 M2(SURVIVED)가 이미 적은 한계 | — |
| INFO7 · 8 · 9 | 조치 불필요 — 리뷰어 스스로 «없음 · 조치 불요» | — |

## TEST 결과

이 라운드에서 codebase 는 바뀌지 않았다. 직전 결과(구현 커밋 `ed68742f8` 기준)가 그대로다.

- lint: 통과 (`_test_logs/lint-20260926-152813.log`)
- unit: 통과 (`_test_logs/unit-20260926-152912.log`)
- build: 통과 (`_test_logs/build-20260926-153038.log`)
- e2e: 통과 — 412건 (`_test_logs/e2e-20260926-153229.log`)
