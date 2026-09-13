# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 신규 가드가 매 테스트 실행마다 `backend/src` + `packages` 전체를 동기 I/O 로 전량 로드한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46-49` (`walkTree(...).map((f) => fs.readFileSync(...))`), 소비처 `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` 의 `collectBackendTokens` (147-158줄)
  - 상세: `describe` 콜백 최상위(모듈 로드 시 1회, `it()` 당 재실행 아님)에서 `codebase/backend/src` + `codebase/packages` 를 재귀 순회해 `.ts` 전 파일을 `fs.readFileSync` 로 메모리에 적재(`sourceTexts`, 실측 500+ 파일)한 뒤, 파일마다 `\b(UPPER_SNAKE)\b` 전역 정규식으로 토큰을 훑어 `Set`(실측 1743종)을 만든다. 알고리즘 자체는 선형(O(총 바이트 수))이라 이차 복잡도 문제는 없고, `it()` 블록마다 재계산하는 구조도 아니라 N+1 성격도 없다. 다만 이 스캔 비용은 **저장소 전체 backend/packages 소스 크기에 정비례**해 자라는 costant이고, CI 의 매 PR 마다(이 테스트 파일이 선택되는 한) 동기 I/O 로 수백 개 파일을 순차 `readFileSync` 한다 — 병렬 파일시스템 캐시가 있어도 저장소가 커질수록 이 한 테스트 파일의 벽시계 시간이 조용히 늘어난다.
  - 제안: 지금 규모(500+ 파일, 수 MB)에서는 문제 삼을 수준이 아니며, 자매 가드(`impl-anchor-existence.test.ts` 등)도 이미 `walkTree` 기반 전량 순회를 쓰는 동일 계열 패턴이라 새로 도입된 리스크는 아니다. 다만 저장소가 수 배 커지면(예: backend/packages 파일 수 5000+) 이 describe 블록 하나가 vitest 전체 스위트 시간에서 눈에 띄는 비중을 차지할 수 있으니, 그 시점엔 (a) 파일 목록을 `git ls-files` 로 미리 걸러 스캔 대상 확장자/디렉터리를 더 좁히거나 (b) 다른 가드와 파일 목록·토큰 집합을 공유(현재는 가드마다 독립적으로 동일 트리를 재순회할 가능성)하는 캐싱을 고려할 것. 지금 시점에는 조치 불요, 관찰만 기록.

- **[INFO]** DTO 필드 제거(`latencyMs`)는 페이로드 축소로 성능에 오히려 긍정적
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:52-58`(`ModelTestConnectionResultDto`), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-465`(`TestConnectionResultDto`)
  - 상세: 생산자가 0건이던 `latencyMs` 필드를 OpenAPI 선언에서 제거했다. 실제 응답 바디에는 원래도 실리지 않던 필드라 런타임 동작·직렬화 비용에는 변화가 없다(순수 문서 정합화). 성능 관점에서 부정적 영향 없음, 참고로만 기록.

- **[INFO]** `llm.service.ts::testConnection` 필드명 변경(`error`→`message`)은 단순 rename, 알고리즘/호출 패턴 변화 없음
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:312-350`
  - 상세: 반환 객체 키 이름만 바뀌었고 `try/catch`·단일 await 체인 구조는 그대로다. N+1, 블로킹, 캐싱 이슈와 무관.

## 요약

이번 변경분의 실질 프로덕션 코드 수정은 응답 필드 rename(`error`→`message`) 1건과 미사용 DTO 필드(`latencyMs`) 제거 2건뿐이며, 둘 다 알고리즘 복잡도·쿼리 패턴·캐싱·블로킹 I/O에 영향이 없고 후자는 오히려 페이로드를 소폭 줄인다. 나머지 실질 변경은 문서(MDX)와 테스트 코드다. 유일하게 성능 관점에서 짚어볼 만한 지점은 신규 가드 테스트(`guide-error-code-existence.test.ts` + `guide-error-code-scan.ts`)가 backend+packages 전체 소스를 매 테스트 실행마다 동기 로드·정규식 스캔한다는 점인데, 알고리즘은 선형이고 테스트당 재계산도 아니며 기존 자매 가드들과 같은 계열 패턴이라 지금 규모에서는 문제가 되지 않는다. 저장소 성장에 따라 벽시계 비용이 서서히 늘어날 수 있다는 점만 관찰로 남긴다.

## 위험도
NONE
