# 성능(Performance) 코드 리뷰

## 범위에 대한 메모

이번 changeset(112개 파일)의 실질 코드 diff는 6개 파일로 좁다(`git diff origin/main --stat` 확인):

- `.claude/hooks/_lib/plan_guard.py` — 정규식 확장(체크박스 `>` 인용 처리)
- `.claude/tests/test_plan_guard.py` — 신규 unit test 5건
- `codebase/backend/src/nodes/core/error-codes.ts` — JSDoc 주석만 변경(런타임 로직 무변경)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 테스트 케이스
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — 신규 vitest 가드 파일
- `spec/conventions/error-codes.md` — 문서

나머지(`plan/**` 7건, `review/**` 98건)는 plan 트래킹 문서와 harness 세션 산출물(자동 생성 markdown/JSON)로, 런타임에 실행되지 않는 정적 기록이라 성능 관점의 채점 대상이 아니다. 백엔드 서비스·DB 쿼리·API 핸들러·프론트엔드 컴포넌트 등 제품 런타임 코드는 이번 changeset에 없다(`error-codes.ts`도 주석만).

## 발견사항

- **[INFO]** 신규 가드 테스트가 같은 디렉터리 트리를 3회 별도로 순회한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — `it.each(EXPECTED_ROOTS)` 블록(135행 부근)과 `it("잔재 태그가 없다", ...)` 블록(151행 부근), 둘 다 `collectScanTargets`/`findStrayTags` 를 통해 `walkTree` 를 호출
  - 상세: `[전제] plan/ 를 실제로 스캔했다`, `[전제] spec/ 를 실제로 스캔했다` 두 케이스가 각각 `collectScanTargets(root, ["plan"])`, `collectScanTargets(root, ["spec"])` 로 부분 트리 순회를 하고, 바로 다음 `"잔재 태그가 없다"` 테스트가 `findStrayTags(root)` → `collectScanTargets(root)`(기본값 `["plan","spec"]`)로 사실상 같은 두 디렉터리를 다시 순회한다. 세 번째 순회에서는 추가로 ~890개 `.md` 파일 전체를 `readFileSync` 해 줄 단위 정규식 검사까지 수행한다. 결과적으로 파일 목록 diff·구조는 3회 재계산된다.
  - 제안: 테스트 스위트 실행 시 1회성 비용(디렉터리 순회, 로컬 파일시스템, 수백 개 파일 규모)이라 실질적 영향은 미미하며 차단 사유는 아니다. 다만 순회 비용이 더 커질 경우를 대비해 `describe` 블록 상단에서 파일 목록을 한 번 수집해 재사용하는 구조로 정리할 여지는 있다.

- **[INFO]** `findStrayTags` 가 각 파일을 라인 배열로 전체 적재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — `findStrayTags` 함수(106행 부근), `lines = fs.readFileSync(...).split("\n")`
  - 상세: 스트리밍 대신 파일 전체를 문자열로 읽고 `split("\n")` 으로 배열화한 뒤 `forEach` 로 정규식 검사한다. `plan/`·`spec/` 마크다운 파일 각각의 크기가 크지 않고(문서 파일), 파일당 처리 후 배열이 GC 대상이 되어 누적 메모리 문제는 없다. 테스트 실행 1회성 비용으로 문제 삼을 수준이 아니다.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음 (근거 기록)

- `plan_guard.py` 의 `_CHECKBOX` 정규식 확장(`^\s*` → `^(?P<quote>[\s>]*)`)은 중첩 정량자가 없는 단순 문자 클래스 확장으로, 카타스트로픽 백트래킹 위험이 없다(선형 시간 유지). `_all_checkboxes_done` 은 파일을 스트리밍(`for line in f`)으로 한 줄씩 처리하며 모듈 레벨에서 컴파일된 정규식(`_CHECKBOX`, `_QUOTED`)을 재사용한다 — 알고리즘 복잡도는 여전히 파일 크기에 대해 O(n), 호출당 1개 plan 파일만 열어 hook 실행 경로에서 병목이 될 소지가 없다.
- `error-codes.ts` 변경은 JSDoc 주석 추가뿐이며 런타임 바이트코드/타입에 영향 없음 — 성능 관점에서 완전히 중립.
- `spec-links.test.ts` 추가 케이스는 in-memory fixture(`fs.writeFileSync` 로 임시 파일 몇 개 생성) 기반이라 규모가 작고, 기존 통합 테스트 구조를 재사용해 새로운 스캔 경로를 만들지 않았다.
- `stray-tool-tags.test.ts` 상단 주석이 스스로 `review/**`(31파일)를 스캔 범위에서 제외한 이유를 "봉인된 산출물이라 읽히지 않는다" 로 명시해, 불필요한 스캔 범위 확장을 의도적으로 피했다 — 지연 로딩/불필요 연산 관점에서 오히려 바람직한 스코핑이다.

## 요약

이번 changeset의 실질 코드 변경은 harness git-hook 스크립트의 정규식 확장 1건, 그 unit test 5건, JSDoc 주석 1건, 그리고 문서 무결성 가드용 vitest 테스트 2건(1개 신규 파일 포함)뿐이다. 모두 CI/hook 실행 시 1회성으로 도는 검사 로직이며 제품 런타임 요청 경로(API, DB, 프론트엔드 렌더링)에는 전혀 닿지 않는다. 알고리즘 복잡도는 기존과 동일한 선형(O(n))이 유지되고, N+1 호출·블로킹 I/O 병목·캐싱 필요성·메모리 누수 같은 실질 위험 패턴은 발견되지 않았다. 유일하게 언급할 만한 지점은 신규 vitest 가드가 동일 디렉터리 트리를 테스트 케이스별로 3회 재순회한다는 점인데, 이는 테스트 스위트 1회 실행 비용(수백 개 마크다운 파일 규모)으로 프로덕션 성능과 무관해 INFO 수준에 그친다.

## 위험도

NONE
