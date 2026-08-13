# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main...HEAD` 누적 diff 50개 파일(코드 9개 + plan 2개 + `review/code/2026/08/13/{20_36_35,22_45_24}/**` 20개 + `review/consistency/2026/08/13/{20_36_36,22_45_25}/**` 20개)을 프롬프트 diff 기준으로 확인하고, 프롬프트에서 크기 제한으로 생략된 항목(`knowledge-base.service.ts`, `update-returning-tuple-shape.md` 등)은 `git diff origin/main...HEAD`로 직접 대조했다. `git diff origin/main...HEAD --stat -- . ':!codebase' ':!plan' ':!review'` 결과가 빈 출력임을 확인해, 세 디렉터리(`codebase/`, `plan/`, `review/`) 밖의 변경은 없다.

## 발견사항

- **[CRITICAL]** 신규 plan 문서가 "두 plan 모두에 소급 정정 배너를 넣었다"고 서술하지만, 실제로는 한 plan만 수정됐다 — 이 diff 자신이 반복 지적해 온 "검증 없이 쓴 완료 선언"과 동일한 결함이 그 diff 안에 다시 있다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:105`(`Read`로 실제 파일 확인, 해당 hunk는 프롬프트 diff가 크기 제한으로 생략돼 게이트 없음) — "→ 두 plan 모두에 소급 정정 배너를 넣고, `ie-resume-turn-boundary-cancel.md` 는 뮤턴트 항목의 진단도 바로잡았다."
  - 상세: 이 문장 바로 위(94~103행)에서 "두 번째 plan"으로 `retry-turn-terminal-guard.md`를 지목하고("`retry-turn-terminal-guard.md` 는 12+ 라운드에 걸쳐 '동시 cancel 방어' 를 검증했는데... mock 경계 너머의 실제 `persisted` 값은 어느 라운드도 검사한 적이 없다"), 105행에서 "두 plan 모두에 배너를 넣었다"고 완료를 선언한다. 그러나 `git diff origin/main...HEAD --stat -- plan/in-progress/retry-turn-terminal-guard.md`는 **빈 출력**이고(변경 0줄), `git log origin/main..HEAD --oneline`으로 이 브랜치의 커밋 5개(`8332d9a20`·`8c0d66e08`·`08d3c7fa3`·`6d3de271d`·`443dd91a6`) 전부를 대조해도 `retry-turn-terminal-guard.md`를 건드린 커밋은 없다. 실제로 소급 정정 배너가 들어간 것은 `plan/in-progress/ie-resume-turn-boundary-cancel.md` 한 곳뿐이다(체크리스트 항목 `- [x] 소급 영향 조사·정정 — ie-resume-turn-boundary-cancel.md 배너 + 뮤턴트 오진 정정`도 그 파일 하나만 명시해, 105행 프로즈와 스스로 모순된다). `retry-turn-terminal-guard.md`가 검증해 온 "동시 cancel 방어"는 이 PR이 고친 `updateExecutionStatus`의 `persisted` 계산과 **같은 함수·같은 버그 지점**(`retry-turn.service.spec.ts:101`의 `updateExecutionStatus: jest.fn().mockResolvedValue(true)` boundary mock이 버그 상태의 상수 동작을 그대로 계약으로 굳혔다는 것이 이 PR 자신의 리뷰 산출물 `review/consistency/2026/08/13/22_45_25/plan_coherence.md`에 WARNING으로 남아 있다) — 즉 배너 없이 방치되면 라이브 동시성 결함이 "이미 검증됐다"는 잘못된 문서 상태로 굳어질 위험이 실제로 있다. 이 diff/브랜치 자체가 이미 같은 형태의 완료 선언 오류를 세 차례 자체 수정한 이력이 있다(`review/code/.../22_45_24/RESOLUTION.md` CRITICAL 1, 커밋 `6d3de271d` "RESOLUTION 에 '등재' 라 써 놓고 안 했다", 커밋 `443dd91a6` "내 완료 선언 셋이 사실과 달랐다") — 이번이 아직 잡히지 않은 4번째 사례다.
  - 제안: `update-returning-tuple-shape.md:105`를 "`ie-resume-turn-boundary-cancel.md`에는 배너를 넣었고, `retry-turn-terminal-guard.md`는 아직 넣지 않았다(후속 필요)"로 정정하고, `retry-turn-terminal-guard.md`에 실제로 동일 형태의 소급 정정 배너를 추가한 뒤 `plan/complete/` 이동 전 12차 라운드 결론(특히 `finalizeGuarded`가 `persisted=false`를 실제로 관측한 적이 있는지)을 코드로 재검증할 것.

- **[INFO]** `review/consistency/2026/08/13/22_45_25/rationale_continuity.md`는 자신이 검토한 세션 전체를 "델타 0 — 폐기 권장"이라 결론짓지만, 같은 세션의 다른 체커(`plan_coherence.md` 등)는 실제 diff를 정확히 분석해 유효한 WARNING(위 CRITICAL 항목의 근거가 된 `retry-turn-terminal-guard.md` 격차 지적 포함)을 냈다 — 그런데도 세션 7개 파일 전부가 그대로 커밋됐다.
  - 위치: `review/consistency/2026/08/13/22_45_25/rationale_continuity.md`(target을 `spec/5-system/`으로 오인해 무관한 "eia-r8-cache-scope" 작업과 혼동, "이 세션을 폐기하라"고 자체 권고) vs 같은 디렉터리의 `plan_coherence.md`(실제 diff를 정확히 분석)
  - 상세: 이 저장소 컨벤션상 `review/**` 산출물 커밋 자체는 표준 강제 워크플로 부산물이라 스코프 위반이 아니다(선행 라운드 `20_36_35/scope.md`·`22_45_24/scope.md`가 이미 같은 결론). 다만 세션 내 한 체커가 스스로 "폐기하라"고 쓴 산출물을 그대로 커밋해 둔 것은, 다음 사람이 이 디렉터리를 훑을 때 `rationale_continuity.md`만 보고 세션 전체를 무시할 위험을 남긴다.
  - 제안: 조치 불요(블로킹 아님) — 다만 향후 세션에서 체커 하나가 "target 불일치로 delta 0"라 결론지어도, 같은 세션의 다른 체커가 유효한 발견을 냈다면 세션 전체를 폐기하지 말고 유효한 부분만 취사선택하는 관행을 명시해 두면 좋다.

- **의도 이상의 변경 / 무관한 수정**: 코드 변경 9개 파일(`assert-row-array.spec.ts`, `update-returning-rows.{ts,spec.ts}`, `auth-oauth.service.{ts,spec.ts}`, `execution-engine.service.{ts,spec.ts}`, `knowledge-base.service.{spec.ts,ts}` — spec.ts 포함 9개) 전부가 "TypeORM `UPDATE`/`DELETE ... RETURNING`이 `[rows, rowCount]` 튜플인데 8곳이 행 배열로 오인했다"는 단일 근본원인에서 벗어나지 않는다. `knowledge-base.service.ts`는 프롬프트에서 diff가 생략됐으나 `git diff`로 직접 대조한 결과 CAS 락 2곳·재큐 2곳·reset 1곳 = 5곳이 plan의 표와 정확히 1:1 대응한다. `updateReturningRows(` 호출 수를 grep으로 재확인 — execution-engine 2, knowledge-base 5, auth-oauth 1 = 8, plan의 "8곳" 서술과 일치.
- **불필요한 리팩토링**: `execution-engine.service.ts` 두 지점(`admitExecutionOrDefer`·`updateExecutionStatus`)에서 `assertRowArray(...)` 제거 후 `updateReturningRows(...)`로 교체 — 헬퍼가 동일한 `!Array.isArray` 가드를 내장해 흡수하므로 처방의 일원화에 직접 속한다. 세 번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`, execution-engine.service.ts:8227, SELECT 지점)은 손대지 않아 import도 dead가 아니다.
- **기능 확장**: `updateReturningRows`는 튜플/행-배열 두 shape만 처리하는 최소 함수, 신규 옵션·플래그 없음.
- **포맷팅 변경**: 각 파일 hunk가 실질 변경 줄에 국한됨, 무관한 개행·공백 재정렬 없음.
- **주석 변경**: 추가된 주석은 전부 이번 튜플 shape 결함의 실측 근거·회귀 이유 설명. `execution-engine.service.ts`의 옛 "RETURNING id 이므로 실제 shape 은 행 배열이다" 모순 주석은 삭제·통합됐다(선행 라운드 documentation CRITICAL 2 해소, 이번 라운드도 재확인).
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`에 추가된 `updateReturningRows` import 전부 실사용됨.
- **설정 변경**: 없음.

## 요약

핵심 코드 변경(9개 backend 파일)은 "UPDATE/DELETE RETURNING 튜플 오인" 단일 결함 수정에 정확히 수렴하고, `assertRowArray` 제거도 헬퍼 일원화에 직접 속한 의도된 통합이며, 파일 범위는 `codebase/`·`plan/`·`review/` 밖으로 전혀 새지 않았다(실측 확인). 다만 새로 커밋된 plan 문서(`update-returning-tuple-shape.md`) 자체가 "두 plan 모두에 소급 정정 배너를 넣었다"는 검증되지 않은 완료 선언을 담고 있는데, 실제로는 `retry-turn-terminal-guard.md`가 전혀 수정되지 않았다 — 이 diff/브랜치가 이미 세 차례 자체 발견·수정한 "검증 없이 쓴 완료 선언" 패턴의 4번째 미포착 사례이며, 그 plan이 지키려는 실제 동시성 방어(`persisted` 계산)와 같은 코드 지점을 다루고 있어 방치 시 실질적인 위험(라이브 동시성 결함이 "이미 검증됨"으로 문서화된 채 방치)이 있다. 이 한 건을 제외하면 스코프 크립·드라이브바이 리팩토링·무관한 파일 수정은 발견되지 않았다.

## 위험도

MEDIUM — 코드 변경 자체의 스코프는 깨끗하나, 커밋된 plan 문서의 완료 선언 하나가 실제 diff와 어긋나 후속 세션을 오도할 수 있다(CRITICAL 급 개별 발견 1건).
