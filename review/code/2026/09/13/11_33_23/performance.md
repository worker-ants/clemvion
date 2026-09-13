# 성능(Performance) 리뷰

## 검토 범위

`git diff origin/main --stat -- codebase/` 기준 실질 코드/문서 변경 21개 파일 + `CHANGELOG.md`.
나머지(파일 23~107 — `plan/**`, `review/code/2026/09/13/{10_12_19,10_40_34,11_07_36}/**`,
`review/consistency/**`)는 이전 라운드 산출물(markdown/json 리포트)이라 실행되는 코드가 아니므로
성능 관점 검토 대상에서 제외한다(알고리즘·쿼리·캐싱·I/O 어느 것도 담고 있지 않음을 확인).

실질 코드 변경은 다음 세 갈래뿐이다:

1. `LlmService.testConnection` 반환 필드 rename(`error`→`message`) — 순수 문자열 키 변경
2. 두 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`)에서 생산자 0건이던
   `latencyMs`(+ `TestConnectionResultDto` 의 `meta`, `code` 추가) 선언 정리
3. 신규 build-time 정적 가드 2건(`guide-error-code-scan.ts` + `guide-error-code-existence.test.ts`,
   `guide-sanitized-message-parity.test.ts`) + 기존 테스트에 `assertMatchesContract` 배선 추가

## 발견사항

- **[INFO]** 신규 가드가 매 vitest 프로세스당 1회, `backend/src` + `packages` 전체를 동기 I/O 로
  전량 로드한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (`describe`
    최상위 `walkTree(...).map((f) => fs.readFileSync(f.absPath, "utf8"))`, 46~49행), 소비처
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` 의 `collectBackendTokens`
    (147~165행)
  - 상세: `describe` 블록 최상위(모듈 로드 시 1회, `it()` 마다 재실행되지 않음)에서 두 디렉터리를
    재귀 순회해 `.ts` 파일 전체를 `fs.readFileSync` 로 메모리에 적재(vacuity floor 단언 기준
    500+ 파일)한 뒤, 파일마다 `\b(UPPER_SNAKE)\b` 전역 정규식으로 토큰을 훑어 `Set`(1743+ 종)을
    만든다. 알고리즘은 선형(O(총 바이트 수))이고 `it()` 당 재계산 구조가 아니라 N+1 성격도 없다.
    다만 이 비용은 저장소의 backend/packages 소스 크기에 정비례해 자라며, 자매 가드
    (`impl-anchor-existence.test.ts` 등)도 이미 같은 `walkTree` 전량 순회 패턴을 쓰고 있어
    새로 도입된 아키텍처 리스크는 아니다. 동일 사안이 `review/code/2026/09/13/10_12_19/performance.md`
    ·`review/code/2026/09/13/10_40_34/performance.md` 에서 이미 INFO/NONE 으로 확인됐고, 이번 diff
    가 그 결론을 뒤집을 변경(스캔 대상 확장, 파일 수 폭증 등)을 추가하지 않았음을 재확인했다.
  - 제안: 지금 규모에서는 조치 불요. 저장소가 수 배 커지면(backend/packages 수천 파일대) `git
    ls-files` 로 대상 확장자·디렉터리를 더 좁히거나, 형제 가드들과 파일 목록/토큰 집합을 공유하는
    캐싱을 고려할 것 — 지금은 관찰 기록만 남긴다.

- **[INFO]** `guide-sanitized-message-parity.test.ts` 도 같은 계열의 소규모 정적 스캔이며 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
    (SoT 1개 파일 `readFileSync` + 정규식 `matchAll`, MDX 2개 파일 `readFileSync` + `matchAll`)
  - 상세: 소스 파일 3개(수 KB 대) 만 읽는 O(1) 스케일의 신규 테스트라 위 항목과 달리 규모 우려조차
    없다.

- **[INFO]** DTO 필드 제거(`latencyMs`, `meta`)는 페이로드 축소로 오히려 긍정적
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:52-58`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:460-489`
  - 상세: 생산자가 0건이던 필드를 OpenAPI 선언에서 제거했을 뿐 실제 응답 바디는 원래도 이 필드를
    싣지 않았으므로 런타임 직렬화 비용·페이로드 크기에 변화가 없다(문서 정합화). `code` 필드
    추가는 이미 실제로 나가고 있던 값을 선언에 반영한 것이라 마찬가지로 런타임 동작 변화 없음.

- **[INFO]** `LlmService.testConnection` 필드명 변경(`error`→`message`)은 단순 rename
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:307-357` (`testConnection`)
  - 상세: 반환 객체 키 이름만 바뀌었고 기존 `try/await/catch` 단일 흐름 그대로다. 알고리즘 복잡도,
    호출 횟수(N+1), 캐싱, 블로킹 I/O 어느 것도 변경되지 않았다.

- **[INFO]** 신규 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)와
  `assertMatchesContract` 배선은 테스트 스위트 실행 비용만 소폭 늘리며 프로덕션 경로와 무관
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (신규 `describe`,
    `beforeAll`/`afterAll` 로 Nest 앱 1회 생성/해제), `llm.service.spec.ts`·
    `integrations.service.spec.ts` 의 `assertMatchesContract(...)` 호출 추가
  - 상세: 앱 인스턴스 생성/해제가 파일당 1쌍으로 억제돼 있고(`beforeAll`/`afterAll`), 매 `it()` 마다
    새 앱을 띄우지 않는다. `contractForDto`/`assertMatchesContract` 자체는 이번 diff 로 변경되지
    않은 기존 유틸(다른 18개 DTO 에 이미 배선돼 있음)이라 이번 PR 이 새로 도입하는 성능 리스크가
    아니다.

## 요약

이번 diff 의 실질 프로덕션 코드 변경은 응답 필드 rename 1건과 미발행 DTO 필드 정리 2건뿐이며
모두 알고리즘 복잡도·쿼리 패턴·캐싱·블로킹 I/O 에 영향이 없다(`latencyMs`/`meta` 제거는 페이로드를
소폭 줄이는 방향). 신규로 추가된 코드는 build-time 정적 가드(에러 코드 실재성 스캔, 문장 SoT 대조)
2종인데 둘 다 순수 함수·선형 스캔이며 런타임 요청 경로와 무관하다. `guide-error-code-existence.test.ts`
가 매 테스트 스위트 로드 시 backend+packages 전체(500+ 파일)를 동기 로드하는 비용은 자매 가드들과
동일 계열 패턴이고 이전 두 라운드에서 이미 NONE/INFO 로 확인된 사안이며, 이번 diff 가 그 판단을
바꿀 변화(대상 확장 등)를 추가하지 않았다. N+1 호출, 메모리 누수, 불필요한 문자열 누적, 부적절한
자료구조, 과도한 선행 로딩 등 새로 도입된 성능 결함은 발견하지 못했다.

## 위험도

NONE
