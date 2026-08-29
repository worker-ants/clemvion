# 문서화(Documentation) Review

## 검증 방법

`Read`/`Grep` 으로 diff 가 인용하는 대상을 직접 열어 대조했다 (저장소 트리에는 쓰지 않음, `grep`/`git grep` 읽기 전용만 수행):

- `codebase/backend/src` 전체에서 `.cause` 를 읽는 곳 재검색 — `telegram-client.ts` 단독 주장 검증
- `git grep "C1 —"` 로 "형제 4곳" 주장 검증
- `business-metrics.service.ts` 의 `RedisFailOpenComponent` 유니온, `spec/5-system/_product-overview.md` 의 NF-OB-07 카탈로그 행 대조
- `spec/5-system/3-error-handling.md §6.3.1`, `§2.1` 봉투 스키마 실재 확인
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 이 명시한 재실측 명령(`grep -rli "fail-open" ... | grep -v spec.ts | xargs grep -l -E "Redis|ioredis|..."`)을 **그대로 재실행**

## 발견사항

- **[WARNING]** `backend-lint-gate-broken-on-main.md` 의 "재실측 (2026-08-29)" 문단이 적은 **"Redis 를 만지며 fail-open 하는 파일 21개, 미배선 19개"** 가, 이 diff 가 신설하는 파일 자신 때문에 **커밋 시점에 이미 어긋난다**.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:585-592` (게이트 숫자 기준, "재실측 (2026-08-29, `eia-failopen-observability`) — 수가 또 움직였다" 문단)
  - 상세: 문서가 적은 측정 명령(`grep -rli "fail-open" --include='*.ts' codebase/backend/src` 에서 `.spec.ts` 를 뺀 뒤 `Redis|ioredis|redisConn|RedisConnectionProvider` 포함분만 남김)을 이 PR 이 만든 최종 트리 상태로 그대로 재실행하면 **21개가 아니라 22개**가 나온다. 원인은 이 PR 이 같은 diff 로 신설하는 `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` 자신이다 — `.spec.ts` 로 안 끝나 제외 필터를 통과하고, 파일 안에 형제 파일명 `redis-fail-open-catalog.spec.ts` 를 인용하는 주석이 있어 `fail-open` 매치도 통과하며(3행), `Redis` 문자열도 여러 줄에 있다. 이 파일은 `recordRedisFailOpen(...)` 을 호출하지 않으므로(가드는 AST 파싱만 함) "배선됨" 쪽으로도 안 잡혀, 재계산하면 **22개 중 2개 배선 = 미배선 20개**다. "21개/19개" 는 이 PR 이 아직 guard 파일을 트리에 넣기 **전** 시점의 값이고, PR 이 닫히는 시점(재현 가능해야 할 시점)에는 이미 자기모순이다. 이 문서가 반복해 강조하는 "실측"의 신뢰도를 스스로 깎는 지점이라 지적한다.
  - 제안: "**측정 시점 이후 이 PR 자신이 추가한 `redis-fail-open-catalog-guard.ts` 는 자기 매치이므로 21개에서 제외**" 같은 각주 한 줄을 덧붙이거나, 최종 커밋 상태에서 명령을 다시 돌려 22/20 으로 갱신한다. 결론("미배선 다수는 이 PR 범위 밖으로 defer")에는 영향 없음 — 숫자만 재현 불가능해진다.

- **[INFO]** 같은 세션(`review/code/2026/08/29/19_17_28/`)의 개별 reviewer 산출물 8개 중 2개(`side_effect.md`, `testing.md`)만 `STATUS=... \n ===REPORT_MARKDOWN_BELOW===` 프로토콜 헤더를 파일 본문 첫 두 줄로 그대로 갖고 있고, 나머지 6개(`documentation.md`, `maintainability.md`, `requirement.md`, `scope.md`, `security.md`, 그리고 `RESOLUTION.md`/`SUMMARY.md` 는 성격이 달라 제외)는 `#` 제목으로 바로 시작한다.
  - 위치: `review/code/2026/08/29/19_17_28/side_effect.md:1-2`, `review/code/2026/08/29/19_17_28/testing.md:1-2` vs `review/code/2026/08/29/19_17_28/documentation.md:1`, `.../maintainability.md:1`, `.../requirement.md:1`, `.../scope.md:1`, `.../security.md:1`
  - 상세: `subagent-call-contract.md §7` 에 따르면 `STATUS=...`/`===REPORT_MARKDOWN_BELOW===` 는 **호출자에게 돌려주는 반환 텍스트**의 형식이지, `output_file` 에 영구히 남길 감사 기록의 형식이라는 규정은 없다. 두 파일만 그 헤더를 파일에 그대로 박아 둔 채 커밋됐고, 같은 라운드의 다른 6개 리포트는 헤더 없이 순수 리포트 본문만 저장했다 — 같은 세션 산출물 사이에 형식이 갈린다. 기능에 영향은 없지만(harness 는 반환 텍스트로 이미 판정을 끝냈다), 저장소에 영구히 남는 audit trail 을 나중에 사람이 훑을 때 두 파일만 프로토콜 잡음이 섞여 보인다.
  - 제안: 블로킹 아님. 다음에 이 규약을 다듬을 때 "`output_file` 에는 STATUS 헤더를 포함하지 않는다" 를 `subagent-call-contract.md` 에 명시하면 이 drift 가 재발하지 않는다.

- **[INFO]** 같은 세션의 consistency-checker 산출물 5개(`review/consistency/2026/08/29/19_45_22/`) 중 `rationale_continuity.md` 만 최상위 `# 제목` 줄이 없다.
  - 위치: `review/consistency/2026/08/29/19_45_22/rationale_continuity.md:1` (`### 발견사항` 으로 바로 시작) — 대조: `convention_compliance.md:1`("# 정식 규약 준수 검토 — `spec/data-flow/`"), `cross_spec.md:1`, `naming_collision.md:1`, `plan_coherence.md:1` 은 모두 `# ... 검토 — spec/data-flow/ (...)` 형태의 제목으로 시작.
  - 상세: 다섯 checker 가 같은 라운드·같은 target(`spec/data-flow/`)을 다루는데 하나만 제목이 없어 파일만 열었을 때 어느 checker 의 산출물인지 파일명을 봐야 알 수 있다. 사소하지만 다른 4개와의 형식 일관성이 깨진다.
  - 제안: 블로킹 아님. `rationale_continuity` sub-agent 의 출력 템플릿에 제목 줄을 추가하면 형식이 맞춰진다.

## 확인한 사항 (문제 없음 — 직접 대조 검증)

- **`.cause` 소비처 유일성** — `codebase/backend/src` 전체 재검색으로 `telegram-client.ts:92` 한 곳뿐임을 재확인 (파일 1 JSDoc 주장과 일치).
- **"형제 4곳" 정정** — `git grep "C1 —"` 재실행 결과 정확히 `expression-resolver.service.ts`/`.spec.ts` · `code.handler.ts`/`.spec.ts` 4곳. `agent-memory.service.ts`/`integration-expiry-scanner.service.spec.ts` 의 `C1`/`REQ-C1` 은 다른 기준이라 형제 아님 — 파일 3 주석의 구분과 일치 (이전 "3곳" 오기가 정확히 4곳으로 교정됨).
- **`RedisFailOpenComponent` 유니온 = spec 카탈로그** — `business-metrics.service.ts:38` 의 `'idempotency'` 단일 리터럴과 `spec/5-system/_product-overview.md:88` 의 `component (idempotency)` 가 정확히 일치.
- **`spec/5-system/3-error-handling.md §6.3.1`** — 실재(474행 "6.3.1 에러 wrapping 시 `Error.cause` 부착 기준"), `§2.1` 응답 봉투 스키마(`code`/`message`/`details?`/`requestId`)도 신규 `CLOSED_ENVELOPE_KEYS` 단언과 부합.
- **신규 테스트 수 "9건 추가(10→19)"** — 파일 1 diff 를 직접 세면 개별 `it` 5건 + `it.each` 4항목 = 9건, 기존 10건과 합쳐 19건 — plan 문서 주장과 일치.
- **`developer/SKILL.md` §수렴 예외** — 두 plan 트래커를 한 PR 에서 묶어 처리한 근거로 인용하는 절이 실재함을 확인(162행).
- 나머지 정본 위임(`error-shape.spec.ts` → 정본, `expression-resolver.service.spec.ts`/`code.handler.spec.ts` → 위임)과 `git mv` 로 `plan/complete/` 이동한 diff(`-M` 로 재확인, similarity 87%, frontmatter `status: complete` + "봉인 시점의 유효한 결론" 절 추가)는 전 라운드(`19_17_28`/`19_45_22`) 리뷰어들이 이미 line-level 로 대조했고, 재확인 결과도 어긋나지 않는다.

## 요약

이번 diff 는 대부분 "주석/근거 서술이 실체와 어긋나는 것을 스스로 찾아 정정"하는 성격이고, 신규 근거 주장(`.cause` 유일 소비처, C1 형제 4곳, `RedisFailOpenComponent` 단일값, `§6.3.1`/`§2.1` 인용)을 전부 직접 재현해 정확함을 확인했다 — 문서화 품질은 이 저장소 평균보다 높다. 다만 `backend-lint-gate-broken-on-main.md` 의 "21개 파일/19개 미배선" 재실측 문단은, 같은 PR 이 신설하는 가드 파일 자신이 그 측정 명령의 매치 대상이 되면서 **커밋되는 순간 이미 재현 불가능**해지는 자기모순을 안고 있다(WARNING). 그 외에는 같은 세션에서 함께 커밋되는 이전 라운드 리뷰/일관성 산출물들 사이의 소소한 서식 불일치(STATUS 헤더 잔존, 제목 누락) 두 건이 INFO 수준으로 있을 뿐, 실질적 오류는 없다. README·API 문서·CHANGELOG·설정 문서·예제 코드는 이번 diff 범위에서 갱신 대상이 아니다(런타임 동작·공개 API·환경변수 변경 없음).

## 위험도

LOW
