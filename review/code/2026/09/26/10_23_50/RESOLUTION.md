# RESOLUTION — `review/code/2026/09/26/10_23_50` (2라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 13. forced 6명 전원 리포트 확보(`forced_missing` 없음).
정지 규칙(1라운드 전에 선언): «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건». 2라운드부터 구조 · 문서 수준만 남으면
«수렴 예외» + 트래커 등재.

**종결 판정 — 이 라운드로 수렴한다.** Critical 0, 이 라운드 codebase 수정 0건. Warning 2 중 W1 은 1라운드 W2 의 재지적으로
코드 조치 대상이 아니고(기조치), W2 는 문서(주석) 수준이라 developer SKILL §수렴 예외 로 등재한다 — 근거는 아래 표.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 14곳의 wire-level 성공 코드 변경(외부 소비자에게 breaking) | **기조치 — 코드 변경 없음.** 1라운드 W2 와 같은 지적(`review/code/2026/09/26/10_00_52/RESOLUTION.md`). CHANGELOG 항목이 변경 목록과 외부 호출자 확인 경고를 싣고, 저장소 내 201 정확 비교는 0건. 리뷰어도 «추가 차단 사유 아님» 이라 적었다. PR 본문에 같은 경고를 싣는다 | — |
| W2 `swaggerResponseStatuses` docstring 이 «2xx 데코레이터를 50개 가까이» — 실제는 `Api*Response` 가 50개 가까이, 그중 2xx 는 일곱 | **수렴 예외(developer SKILL §수렴 예외)로 등재.** (a) 동작 결함이 아니다 — 주석 한 줄의 수치 오기이고 판정 코드와 형제 spec(`http-status-advertised.spec.ts` 헤더 «그중 2xx 가 일곱이다») · `swagger.md` Rationale 은 맞게 적는다. (b) 고치면 codebase 수정이라 리뷰 freshness 가 재무장돼 3라운드를 강제한다. (c) 이 표가 인용이다. (d) 트래커 «성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다» 항목(이 가드를 다시 여는 다음 작업)에 정정을 함께 적었다 — 그보다 먼저 이 PR 에서 codebase 를 다시 고칠 일이 생기면(`--impl-done` 조치 등) 그때 함께 고친다 | — |
| INFO1 새 e2e 헤더가 `plan/complete/post-status-openapi.md` 를 인용(아직 in-progress) | 이 PR 의 마무리 커밋이 plan 을 `complete/` 로 옮겨 해소 | (마무리 커밋) |
| INFO4 reauthorize · request-scopes · KB search 성공 경로 e2e | 1라운드 INFO3 과 같다 — 외부 OAuth · 임베딩 인프라 부재. 1라운드 RESOLUTION «보류» 그대로 | — |
| INFO5 `@HttpCode` 위치가 `@Post` 직후 / `@Roles` 뒤로 갈린다 | 조치 불요 — 이 PR 은 각 핸들러의 기존 데코레이터 사이(가능하면 `@Roles` 뒤, 없으면 라우트 데코레이터 뒤)에 넣었고, 저장소 기존 48곳도 두 형태가 섞여 있다. 컨벤션화는 별 결정 | — |
| INFO6 · INFO7 `createSourceFile` 중복 · `judgeHandler` 책임 분리 | 조치 불요(리뷰어 «필수 아님»). 뮤턴트 15/15 가 판정 분기를 가른다 | — |
| INFO2 · INFO3 · INFO8~INFO13 | 조치 불요(범위 밖 · 이전 라운드 처리 · 정상 확인) | — |

## TEST 결과

이 라운드는 codebase 를 고치지 않았다 — 직전 통과 결과가 그대로 유효하다(`f5b10f57b` 기준).

- lint: PASS (`_test_logs/lint-20260926-101426.log`)
- unit: PASS (`_test_logs/unit-20260926-101517.log`)
- build: PASS (`_test_logs/build-20260926-101627.log`)
- e2e: 통과 — 73 스위트 · 409건 (`_test_logs/e2e-20260926-101909.log`)

## 보류·후속 항목

- W2 docstring 정정 — 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` «성공 응답을 광고하지 않는 라우트
  핸들러가 15곳 있다» 항목에 함께 등재(수렴 예외).
