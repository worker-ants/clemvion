# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `gray-matter` 프로세스-전역 캐시를 두 개의 독립 스캔 구현이 같은 파일 집합(`plan/complete/**`)에 대해 공유한다 — 현재는 안전하게 회피돼 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:139`(`findNonTerminalCompletedPlans`), `plan-scan.ts:249`(`checkPlanFrontmatter`), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:97`, `spec-plan-completion.test.ts:118`
  - 상세: 파일 자체 주석(`plan-scan.ts:130-138`, `spec-plan-completion.test.ts:93-96`)이 정확히 짚고 있듯, `gray-matter` 는 옵션을 안 넘기면 파일 내용을 키로 쓰는 **모듈(프로세스) 전역 캐시**를 갖는다. 캐시 등록이 파싱 성공 여부와 무관하게 **파싱 전에** 먼저 일어나기 때문에, 파싱이 throw 하면 부분 초기화된 캐시 엔트리가 남고, 동일 내용을 읽는 **다음 호출**(다른 함수·다른 파일이라도 무방, 캐시 키가 raw 텍스트이므로)이 그 오염된 엔트리를 조용히 돌려받는다. `plan-scan.ts`(`findNonTerminalCompletedPlans`, `checkPlanFrontmatter`)와 `spec-plan-completion.test.ts`(Gate C)가 **동일한 `plan/complete/**` 트리를 각자 파싱**하므로, 만약 한쪽이 `matter(text)` 로 옵션 없이 호출하면 실행 순서(어느 스캐너가 먼저 그 파일을 읽는가)에 따라 결과가 갈리는 순서-의존 버그가 된다. 이는 스레드 경쟁이 아니라 **호출 순서에 의한 공유 가변 상태 오염**이라는 점에서 동일 부류의 위험(비결정적 공유 자원 접근)이다.
  - 현재 상태: 4곳 모두 `matter(raw, {})` 처럼 **빈 옵션 객체를 명시**해 캐시를 완전히 우회하고 있어 실질적 위험은 없다. `plan-scan.ts` 주석은 이 방어가 "어떤 테스트로도 관측되지 않는다"(뮤테이션 테스트로 확인)는 점까지 인지하고 남겨둔 것으로, 의도적 방어임이 명확하다.
  - 제안: 그대로 유지. 다만 이 저장소에 `plan/complete/**` 를 파싱하는 **세 번째** 소비처가 새로 생기면 반드시 같은 `matter(text, {})` 패턴을 따르도록, 가능하면 `plan-scan.ts` 나 별도 유틸에 "캐시 우회 파서" 헬퍼를 하나 두고 공유하는 편이 "옵션 객체 빠뜨림" 회귀를 원천 차단한다(현재는 각 호출부가 개별적으로 규율을 지켜야 하는 구조).

- **[INFO]** 테스트 fixture 의 임시 디렉터리는 스위트 간 격리돼 있어 병렬 실행 시 경쟁 없음 (참고용, 조치 불요)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:35`(`beforeAll` — `fs.mkdtempSync`), `:190`(두 번째 `mkdtempSync`), `spec-plan-completion.test.ts` 는 실제 저장소 `repoRoot()` 를 읽기 전용으로만 스캔
  - 상세: Vitest 는 기본적으로 테스트 파일을 워커별로 격리 실행한다. 각 `describe` 블록이 `mkdtempSync` 로 유일 이름의 임시 디렉터리를 만들고 `afterAll` 에서 정리하므로, 다른 테스트 파일·다른 워커와 파일시스템 경로가 충돌할 가능성이 없다. 같은 파일 내 `it()` 들은 `root` 를 읽기만 하고 쓰지 않으므로(쓰기는 `beforeAll` 한 번뿐) 순서 무관하게 안전하다.

## 요약

이번 변경은 전부 Node.js 동기(synchronous) `fs.*` API 로 작성된 빌드-타임/테스트-타임 스캐너·가드 코드(`plan-scan.ts`, `spec-links.ts`, 관련 테스트, 문서)이며 스레드·워커·Promise 동시 실행·이벤트 루프 스케줄링과 무관하다. async/await, mutex/semaphore, connection pool 도 등장하지 않는다. 유일하게 주목할 만한 지점은 `gray-matter` 의 프로세스-전역 파싱 캐시를 두 개의 독립 스캔 구현(`plan-scan.ts`·`spec-plan-completion.test.ts`)이 같은 파일 집합에 대해 공유한다는 점인데, 이는 이미 코드 작성자가 정확히 인지하고 모든 호출부에서 빈 옵션 객체(`{}`)로 캐시를 우회해 방어해 두었다(주석에 근거·실측까지 기록). 따라서 실질적인 경쟁 조건이나 원자성 위반은 없고, 향후 세 번째 소비처가 이 패턴을 따르지 않을 경우에 대한 예방적 참고만 남긴다.

## 위험도
LOW（실질 결함 없음 — 문서화·방어된 공유 캐시 패턴에 대한 참고성 INFO 2건만）
