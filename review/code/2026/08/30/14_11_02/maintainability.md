# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 라운드(`14_11_02`)는 `origin/main...HEAD` 누적 diff(52개 파일)에 대한 리뷰다. 유지보수성 관점 실질 검토 대상은 이전 세 라운드와 동일한 7개다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning`
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 판정 축 테스트(양성 6·음성 7·개수 1)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 + `findUnguarded` 순수 함수(전체 380줄)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — 타입 인자 튜플 정정 + mock 정정
- `plan/in-progress/update-returning-tuple-shape.md`, `CHANGELOG.md` — 문서(보조 검토)

`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/**`, `review/consistency/2026/08/30/12_17_21/**`(파일 8~52)는 이전 세 라운드가 생성한 워크플로 산출물(리포트 md/json)이라 애플리케이션 코드가 아니다 — 세 라운드의 동일 관점 리뷰어가 이미 같은 스코프 판단을 내렸고 이번 라운드도 그대로 따른다.

저장소는 Read 전용으로만 조사했다 — 뮤테이션 없음. `git status --short` 확인 결과 이 세션 산출 디렉터리(`review/code/2026/08/30/14_11_02/`) 외 변경 없음.

## 이전 라운드 대비 상태 — 직접 코드 대조로 재확인

3라운드(`13_46_53`) 이후 코드는 커밋 `94985c55a`(다중-unguarded 보고 테스트·CTE blind spot 캐너리·CHANGELOG/plan 문서 정정) 한 건만 추가됐고, 그 이전 라운드가 지적한 유지보수성 항목은 전부 코드에 반영된 상태를 유지한다:

- `MIN_REASON_LENGTH` 상수화(`update-returning-rows.spec.ts:186`) — 유지.
- `SRC` 상수 파일 상단 hoist(`:12`) — 유지, 두 `describe` 가 공유.
- `discover()` 3회 반복 호출 → `beforeAll` 캐싱(`:261-264`) — 유지.
- `findUnguarded` 다중 unguarded 케이스(`:343-369`, 3라운드 신규) — 순환 복잡도·중첩 깊이 모두 양호(원 함수 자체는 미변경, 테스트만 추가).

3라운드 RESOLUTION(`review/code/2026/08/30/13_46_53/RESOLUTION.md`)이 "developer SKILL §수렴 예외"로 명시적으로 닫아 둔 INFO 2건도 코드에 그대로 남아 있음을 확인했다(의도된 유예이지 누락이 아니다):
- `findUnguarded` 가 아직 `source-scan.ts` 로 이관되지 않고 `update-returning-rows.spec.ts:167-181` 에만 있음 — 조건부 유예(두 번째 소비자, 즉 `assert-row-array.spec.ts` 가 발견형으로 확장되는 시점이 트리거).
- `[string, number]` 튜플이 `EXPECTED`(:64)·`discovered`(:168)·`discover()` 반환(:247) 세 곳에서 라벨 없이 구조적으로만 동일 — won't-do(라벨 튜플은 이 파일 규모에 과함).

## 발견사항

- **[INFO]** `findUnguarded` 의 설계 근거를 담은 JSDoc 블록이 함수 선언에 붙어 있지 않고 그 앞의 별도 블록으로 떨어져 있다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:119`-`146`(붙지 않은 블록, "왜 발견형인가"·"판정은 개수로"·"왜 래퍼로 가지 않았나")과 `:148`-`166`(`findUnguarded` 바로 위, 실제로 그 함수에 연결되는 JSDoc), 함수 선언은 `:167`
  - 상세: `/** ... */` 두 블록이 빈 줄 하나 사이에 연속으로 있는데, TypeScript/IDE 의 JSDoc 연결 규칙은 **선언 바로 위**의 블록(148-166)만 `findUnguarded` 에 연결한다. 그 앞 블록(119-146)은 `describe('UPDATE/DELETE 결과를 직접...')` 의 닫는 `});`(117행) 바로 다음에 오지만 그 아래에 어떤 선언도 없다 — 즉 hover 툴팁·TypeDoc 등 도구 기반 탐색에서는 "보이지 않는" 순수 텍스트 블록이 된다. 내용 자체는 이 PR 의 핵심 설계 결정(래퍼 대안을 왜 기각했는지, 판정이 왜 개수인지)이라 중요도가 낮지 않다 — 정확히 그래서 도구가 못 찾는 자리에 있는 것이 아쉽다. 파일 나머지 부분(`source-scan.ts` 모듈 docstring, 각 `describe` 앞 블록)은 대체로 "코드 바로 위" 관례를 지키므로 이 두 블록만 국소적 이탈이다.
  - 제안: 급하지 않음. 두 블록을 하나로 합쳐 `findUnguarded` 바로 위에 두거나(길지만 도구에 잡힘), 혹은 앞 블록을 일반 `//` 섹션 헤더 주석으로 바꿔 "이건 JSDoc 이 아니라 서술용 구획 표시" 임을 형태로도 드러내면 다음 사람이 실수로 `/** */` 를 이동/삭제할 때 이 부분의 존재를 놓치지 않는다.

- **[INFO]** `hasRawUpdateReturning` 은 여전히 자기 테스트 파일 외 소비자가 없다 (2라운드 INFO, "조치 불요" 로 이미 처분됨 — carry-forward, 신규 아님)
  - 위치: 정의 `codebase/backend/src/common/__test-utils__/source-scan.ts:136`, 소비는 `source-scan.spec.ts` 뿐 — `update-returning-rows.spec.ts` 는 개수가 필요해 `countRawUpdateReturning` 을 직접 쓴다(`grep -rn hasRawUpdateReturning codebase/backend/src` 로 재확인).
  - 상세: 2라운드(`13_15_58/maintainability.md`)가 이미 동일 사실을 관측하고 "두 번째 소비자가 생기기 전까지 현행 유지" 로 조치 불요 처분했다. 3라운드에서도 변화 없음. 새 결함이 아니라 참고 기록.
  - 제안: 조치 불요.

- **[정보 확인]** 함수 길이·중첩 깊이·순환 복잡도 — 전체 재확인 결과 이전 라운드 판정과 동일하게 양호
  - `countRawUpdateReturning`(`source-scan.ts:112-133`)은 for-loop 1개 + if 1개(중첩 2단계), `findUnguarded`(`update-returning-rows.spec.ts:167-182`)는 for-loop + if 2개(중첩 3단계, 순환 복잡도 3) — 매개변수 이름(`discovered`/`allowed`/`guardCountOf`)이 역할을 명확히 드러낸다. `listSources`(`:225-241`)도 재귀 + if/else-if 로 중첩 2단계를 넘지 않는다. `discover()`(`:247-255`)는 `map → filter → sort` 체이닝이라 선형이다. 새로 추가된 CTE 캐너리(`source-scan.spec.ts:138-150`)·다중-unguarded 테스트(`update-returning-rows.spec.ts:343-369`)도 기존 `it.each`/`it` 패턴을 그대로 따라 일관성 이탈이 없다.

## 요약

3라운드에 걸쳐 실질 WARNING(중첩 제네릭 미탐지·판정 축 테스트 부재·파일 단위 존재-only 판정·허용목록 파일 단위 전면 면제·검증 로직 부재·다중 unguarded 미검증)이 모두 코드에 반영돼 해소된 상태가 이번 라운드에서도 그대로 유지됨을 직접 소스 대조로 확인했다. 매직넘버(`MIN_REASON_LENGTH`)·상수 재선언(`SRC`)·반복 스캔(`discover()` 3회)도 이전 라운드의 fix 가 그대로 살아 있다. 새로 추가된 코드(다중-unguarded 테스트, CTE blind spot 캐너리, docstring 보강)는 함수 길이·중첩 깊이·순환 복잡도·네이밍·기존 컨벤션 준수 모두 양호하다. 이번 라운드에서 새로 관측한 것은 하나뿐이다 — `findUnguarded` 의 설계 근거 JSDoc 이 함수 선언에서 한 블록 떨어져 있어 도구 기반 탐색에서 누락될 수 있다는 점(INFO, 급하지 않음). `findUnguarded` 미이관·튜플 타입 무명은 3라운드가 이미 명시적으로 유예/won't-do 처분한 항목이라 이번 라운드에서 재차 액션을 요구하지 않는다. 전체적으로 유지보수성 관점에서 추가 조치가 필요한 실질 결함은 없다.

## 위험도
LOW
