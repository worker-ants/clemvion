# RESOLUTION — `/ai-review` 1R (Critical 0 · Warning 2)

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 `UNVALIDATED_METATYPES` 가 export 된 전역 가변 목록 — `readonly` 는 타입일 뿐 | 사실. `Object.freeze` 로 감쌌다. 파이프 spec 에 «얼려 있다» 와 «목록의 설계 타입이면 값을 그대로 넘긴다» 를 고정. freeze 를 푸는 뮤턴트 R4 — KILLED | `8bc7e8f19` |
| W2 목록의 `Number` · `Boolean` · `Array` 를 대조군이 관측하지 않음 | 사실. 셋 다 대조군 라우트(`numberBody` · `booleanBody` · `arrayBody`). 목록에서 하나씩 빼는 뮤턴트 R1~R3 — 전부 KILLED | `8bc7e8f19` |
| INFO9 정렬 1차 키(컨트롤러)가 대조군에서 순서를 가르지 않음 | 이름이 앞서고 핸들러 이름은 뒤로 가는 `AlphaBodyFixtureController.zInline` — 1차 키를 빼는 뮤턴트 R5 KILLED | `8bc7e8f19` |
| INFO5 · 11 `bodyArgIndexes` 의 다중 키 정렬이 미검증 | 직접 단언(파라미터 데코레이터가 오른쪽부터 평가돼 삽입 순서가 `[1, 0]`) — 정렬을 빼는 뮤턴트 R6 KILLED | `8bc7e8f19` |
| INFO1 가드는 광고의 **존재**만 본다 · `schema: {}` 로 면제된 웹훅 본문의 다운스트림 검증 | 조치 안 함 — spec Rationale «못 보는 것» 이 적은 경계. 웹훅 본문은 트리거 파라미터 추출(12-webhook WH-EP-05-1)이 검증한다 | — |
| INFO2 키 지정 본문 여럿 중 하나만 문서화돼도 통과 | 조치 안 함 — `@ApiBody` 는 핸들러 단위 본문 스키마 하나를 광고한다(OpenAPI `requestBody` 는 라우트당 하나). 키 지정 본문 여럿인 라우트는 저장소에 0곳 | — |
| INFO3 §5-4 제목 «새 엔드포인트» 와 소급 항목의 괴리 | 조치 안 함 — `--impl-prep` INFO4 와 같다. 남는 트래커 항목(planner)에 | 마무리 커밋 |
| INFO4 JSDoc 곁가지가 같은 커밋에 | 조치 안 함 — plan 에 명시한 곁가지(#1408 2R INFO4) | — |
| INFO6 · 7 swagger 메타데이터 키 · `design:paramtypes` 문자열 중복 | 조치 안 함 — 리뷰어 스스로 «3번째 · 4번째 소비처가 생기면» 으로 적었다 | — |
| INFO8 · 10 · 12 · 13 | 조치 불필요 — 리뷰어 스스로 «조치 불요» | — |

## TEST 결과

1R 조치 커밋 `8bc7e8f19` 기준, worktree 루트에서 1단계부터.

- lint: 통과 (`_test_logs/lint-20260926-194319.log`)
- unit: 통과 (`_test_logs/unit-20260926-194417.log`)
- build: 통과 (`_test_logs/build-20260926-194546.log`)
- e2e: 통과 — 412건 (`_test_logs/e2e-20260926-194838.log`)
