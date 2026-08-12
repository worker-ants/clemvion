# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base origin/main)

## 검토 범위 확인

- 구현 diff: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
  `.spec.ts` (캐시 엔트리·payload 손상 방어 하드닝 — `JSON.parse` 가 문법 오류에만 던지는 점을
  이용해 `'null'`/`'42'`/`'[]'` 같은 유효-JSON-비객체 값이 통과하던 결함 처분) + `CHANGELOG.md`.
- `spec/data-flow/**` 자체는 이번 diff 에서 **변경 없음** (`git diff origin/main -- spec/data-flow/15-external-interaction.md` 무출력) — 즉 이번 턴은 target 문서를 건드리지 않았고, 코드만
  바뀌었다.
- 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` (이번 diff 의 원 plan,
  `eia-r8-cache-scope-4ae434` 워크트리와 동일 항목 참조) · `plan/in-progress/spec-draft-eia-r8-alignment.md` (선행 spec 정합 draft, 체크리스트 전항 `[x]`).

## 발견사항

- **[INFO]** `data-flow/15` L308·L331-338 의 "전 경로 fail-open (warn)" 서술이 이번 코드
  정밀화로 드러난 실제 동작보다 넓다 — 이미 plan 에 올바르게 등재·planner 인계된 상태
  - target 위치: `spec/data-flow/15-external-interaction.md` L308 (`## 4. 외부 의존` Redis 행)
    및 L331-338 (`### Fail-open 정책의 일관 표기` Rationale)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L635-641 (미체크 `[ ]`,
    "`data-flow/15` 의 '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다")
  - 상세: 이번 diff 는 `idempotency.interceptor.ts` 의 클래스 docstring 을 "세 경로" →
    "다섯 경로(1~5), 그중 넷(2~5)이 warn" 표로 정밀화했다. `CHANGELOG.md` 도 "다섯 경로 중
    넷 … 나머지 하나인 기동 시 미주입(생성자 `null`)은 장애가 아니라 설정 상태라 warn 대상이
    아니다" 라고 명시한다. 그런데 target 의 L308 은 여전히 "전 경로 fail-open (warn)" 으로
    뭉뚱그리고, L333 Rationale 도 "Redis/DB 미가용 시 fail-open (기능 저하 + warn 로그)" 로
    **모든 fail-open 경로에 warn 이 따른다**는 인상을 준다 — 코드가 실제로 보장하는 바보다
    한 칸 넓다. plan 은 이 정확한 불일치(경로1 no-warn)를 이미 `23_48_39 rationale_continuity
    INFO 1` 인용과 함께 등재했고 "`spec/` 쓰기는 developer 권한 밖 — planner 인계" 로 올바르게
    처리해 뒀다. 즉 **미해결 결정 우회도, 후속 항목 누락도 아니다** — 정상적으로 대기 중인
    선행 plan 항목이다.
    > 부가 관찰: 같은 Rationale 절(L333)의 "Redis/DB **미가용** 시 fail-open" 프레이밍은 이번
    > diff 가 처분한 실패 모드(Redis 는 가용하지만 **캐시 엔트리 자체가 손상**된 경우, 경로
    > 4·5)를 정확히 포착하지 못한다 — "미가용" 이 아니라 "가용하지만 오염된 데이터" 이기
    > 때문이다. 기존 plan 항목은 "경로1 no-warn" 문구만 지목하므로, planner 턴에서 이 절을
    > 고칠 때 "미가용" 프레이밍 자체도 "미가용 또는 손상" 으로 넓히는 편이 코드 docstring의
    > 5-경로 표와 더 정확히 대응한다.
  - 제안: 별도 조치 불요(이미 올바르게 추적됨). planner 턴에서 해당 항목을 처리할 때 위 부가
    관찰(미가용→미가용/손상 프레이밍)도 같은 스코프로 묶으면 재확인 왕복을 줄인다.

## 교차 확인 — 결정 우회/선행 미해소 없음

- `spec-draft-eia-r8-alignment.md` (§R8 캐시 대상 2xx/409/410 서술 정합) 는 체크리스트 전항
  `[x]` 로 완료됐고, 그 draft 가 넣었던 `data-flow/15` §2.2 표의 "선재 갭" 캐베어트 문구는
  이후 구현 완료 커밋(`a80599700`, statusCode>=400 → 열거 조건으로 교체)에서 코드와
  원자적으로 함께 제거됐다 — planner 사후 확인(`18_27_29` 항목)도 이미 plan 에 남아 있다.
  이번 diff(엔트리/payload 손상 방어)는 이 결정과 무관한 별개 표면이라 충돌 없음.
- `backend-lint-gate-broken-on-main.md` 내 "idempotency fail-open 구간의 관측·중복 억제"
  (L532, WARNING, 미해결)는 GET→SET 비원자성·모니터링 부재에 대한 별개 백로그이고, 이번 diff
  (손상 엔트리 처분)와 스코프가 겹치지 않는다 — 이번 턴이 그 항목을 우회·무효화하지 않는다.
  target 문서에도 해당 항목과 상충하는 새 서술이 없다.
- 이번 diff 가 완료 처리한 `backend-lint-gate-broken-on-main.md` L607 항목("캐시 엔트리 손상
  처리 전체가 불완전하다", `[x]` 로 갱신)은 plan 자체 파일 안의 자기-갱신이라 target(spec)과의
  정합 문제가 아니며, 체크박스·완료 서술이 실제 코드 diff(파싱 순서를 `bodyHash` 판정 뒤로 이동
  + `discardCorruptEntry` 공통화 + `isIdempotencyEntry` 형태 가드)와 일치함을 확인했다.
- 다른 `plan/in-progress/**` 파일 중 `idempotency`/`responseJson`/`fail-open`/`external-interaction`
  을 언급하는 항목을 전수 grep 했으나, 이번 diff 가 무효화하거나 새로 만들어야 하는 후속 항목은
  없었다(`eia-context-schema-followups.md`·`spec-sync-external-interaction-api-gaps.md` 등은
  DTO 위치·rate-limit·SSE replay 등 무관 표면).

## 요약

이번 턴의 코드 diff(멱등 캐시 엔트리·payload 손상 방어 하드닝)는 `spec/data-flow/` target 문서를
직접 건드리지 않았고, target 이 plan 의 미해결 결정을 우회하거나 선행 plan 을 무시하는 지점도
발견되지 않았다. 유일하게 의미 있는 관찰은 target L308/L331-338 의 "전 경로 fail-open (warn)"
서술이 이번 코드 정밀화로 실제보다 한 칸 넓다는 것인데, 이는 `backend-lint-gate-broken-on-main.md`
가 이미 정확히 등재하고 planner 턴으로 올바르게 인계해 둔 상태라 새 조치가 필요 없다(부가로,
"미가용" 프레이밍이 "손상" 모드까지는 못 덮는다는 점을 같은 planner 턴 스코프에 포함시키길
권장). CRITICAL/WARNING 급 정합성 위반은 없음.

## 위험도

NONE
