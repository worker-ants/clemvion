# RESOLUTION — `/ai-review` 1R (`review/code/2026/09/27/13_50_41`)

판정 기준 HEAD: `52744b0cf`(리뷰 대상). 리뷰 뒤 `git status --short` · `git diff --stat HEAD` 가 이 세션 디렉터리 외 변경 0 을 확인했다.
다만 리뷰 **도중**에는 testing 리뷰어가 공유 워크트리에서 뮤테이션을 하고 `.orig` 사본으로 되돌렸다(W3 — 아래).

## 조치 항목

| SUMMARY # | 심각도 | 조치 | 커밋 |
|---|---|---|---|
| 1 | Critical | `PATCH /workflows/:id { settings: null }` 500 회귀(이 PR 이 만든 것) — 병합 가드를 `settings != null` 로 해 고치기 전 동작(no-op)으로 돌렸다. 단위 «settings: null 은 던지지 않고 저장된 설정을 그대로 둔다» · e2e B 에 `settings: null` → 200 · 저장값 유지. 뮤턴트 G1(가드 되돌림) KILLED | `edd79ca40` |
| 2 | Warning | 노드 응답 `workflow` 제거가 표제 결함과 다른 결함 — 리뷰어가 «재작업 불요» 로 적었다. 같은 라우트의 계약 대조가 드러낸 결함이라 별도 커밋 · 단위 · 뮤턴트 N1 · plan 절로 격리해 이 PR 에서 닫았다. 코드 조치 없음 | — |
| 3 | Warning | 리뷰 중 `nodes.service.ts` 가 일시적으로 바뀐 것 — testing 리뷰어의 워크트리 내 뮤테이션(transcript 의 `cp …/nodes.service.ts.orig` · `cp …/workflows.service.ts.orig` 복원 명령). 리뷰 뒤 HEAD 와 일치 확인. 코드 조치 없음 | — |
| INFO 4 | Info | e2e C 가 `toolOwnerId` 를 늘 null 로만 보던 것 → 도구 노드(`toolOwnerId` 채움)를 따로 만들어 라벨만 PATCH 뒤 저장값 · 응답값 단언 | `edd79ca40` |
| INFO 5 | Info | 명시적 null → 값 지움(§5.4 tri-state) 캐너리를 워크플로 단위에 추가. 뮤턴트 H1(헬퍼가 null 도 거름)이 이 테스트로도 죽는다 | `edd79ca40` · `e16a35beb` |
| INFO 9 | Info | `NotArray<T>` 교차의 동작을 JSDoc 한 문단으로 | `edd79ca40` |
| INFO 6 · 7 · 8 · 10 · 11 · 12 | Info | 조치 불요 — 근거는 plan §`/ai-review` 1R | `a4f57aeb0` |

`e16a35beb` 는 INFO 5 캐너리의 부수 정정이다 — 첫 재실행 unit 단계에서 `nullable-type-lie-cast` 가드가 캐너리의
`null as unknown as string` 을 낡은 캐스트로 잡았고(`_test_logs/unit-20260927-140741.log`), `Object.assign` 은 교차 타입이라 캐스트가
필요 없어 뺐다. 그 뒤 lint 부터 다시 돌렸다.

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260927-140921.log`)
- unit: 통과 (`_test_logs/unit-20260927-141020.log`)
- build: 통과 (`_test_logs/build-20260927-141145.log` — 타입체크 ratchet 포함)
- e2e: 통과 — 422 passed (`_test_logs/e2e-20260927-141445.log`, HEAD `e16a35beb`)
