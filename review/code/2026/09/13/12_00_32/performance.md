# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 신규 가드가 매 테스트 실행마다 `backend/src` + `packages` 전체를 재귀 탐색·전문 로드한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46-51` (`walkTree` 호출), `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:173-184` (`collectBackendTokens`)
  - 상세: `walkTree(root, ["codebase/backend/src", "codebase/packages"], …)` 로 500개 이상(vacuity floor 단언 `sourceTexts.length > 500`)의 `.ts` 파일을 `readFileSync` 로 전부 메모리에 올리고, 전역 정규식(`\b(UPPER_SNAKE)\b`)으로 파일마다 전수 스캔해 `Set<string>` 을 만든다(실측 1743종). 시간·공간 복잡도는 전체 소스 바이트 수에 선형(O(n))이라 알고리즘적으로 병적이지는 않지만, 테스트 스위트가 돌 때마다 이 전체 트리를 매번 새로 읽고 새로 스캔한다 — 다른 `*.test.ts` 가 같은 `backend/src` 를 이미 훑고 있다면(예: `impl-anchor-existence.test.ts` 류 자매 가드) 중복 I/O·중복 정규식 스캔이 파일 단위로 누적된다.
  - 제안: 지금 규모(수백 파일, 초 단위)에서는 CI 비용상 문제 삼을 정도는 아니다. 다만 자매 가드들이 늘어나며 같은 트리를 반복 스캔하는 패턴이 굳어지면, 프로세스 스코프의 `describe`-레벨 캐시(예: 파일 목록·토큰 집합을 모듈 top-level 상수로 한 번만 계산해 여러 `it` 가 공유 — 이미 이 파일 자체는 `describe` 바깥에서 한 번만 계산하도록 잘 되어 있음)를 스위트 간에도 공유하는 방향(예: 별도 setup 모듈에서 한 번 계산 후 재사용)을 고려할 수 있다. 지금 diff 범위에서는 회귀가 아니라 기존 자매 가드와 동일한 기존 관례를 답습한 것이므로 차단 사유는 아니다.

- **[INFO]** `scanErrorCodeCitations` 가 파일당 라인 수 × 정규식 3개를 순회 — 정상 범위
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:142-163` (`scanErrorCodeCitations`), `:123-139` (`codeTableRows`)
  - 상세: MDX 파일을 줄 단위로 분리한 뒤 줄마다 `FIELD_TABLE_NAME`·`CODE_FIELD` 정규식을 무조건 실행하고, `CODE_CONTEXT.test(line) || inCodeTable.has(idx)` 조건이 참일 때만 `PROSE_BACKTICK` 을 추가로 돈다. 각 정규식은 겹치지 않는 단순 리터럴 매칭이라 줄 길이에 선형이고 중첩 정량자로 인한 역추적 폭발 소지는 없다(고정폭 토큰 클래스 `[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`). 파일 수(92개, vacuity floor)·줄 수 규모에서 문제 없음.
  - 제안: 없음 — 관측만 기록.

- **[INFO]** 신설 계약 검사(`assertMatchesContract`/`contractForDto`)가 테스트 세 곳에 새로 배선됨 — 런타임 프로덕션 경로에는 영향 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:695-699`, `codebase/backend/src/modules/llm/llm.service.spec.ts:470-476`
  - 상세: `response-contract.ts` 자체는 이번 diff 에 포함되지 않은 기존 유틸이며, 리플렉션 기반 DTO 메타데이터 조회로 보인다(파일은 diff 밖이라 이번 리뷰의 성능 평가 대상에서 제외). 호출 지점 자체는 테스트당 1회 호출이라 반복문 내 호출(N+1) 형태가 아니다.
  - 제안: 없음.

- **[INFO]** DTO 필드 정리(`latencyMs`/`meta` 제거, `code` 추가)는 순수 스키마 변경으로 성능 영향 없음
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (`ModelTestConnectionResultDto`), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`), `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 반환 필드 `error`→`message`)
  - 상세: 응답 객체의 필드명 변경·미사용 필드 제거일 뿐 알고리즘·I/O·메모리 패턴에 변화 없음.
  - 제안: 없음.

## 요약

이번 변경분의 실질 코드는 (1) DTO/서비스 반환 필드명 정정 및 죽은 필드 제거, (2) 문서(MDX/CHANGELOG) 정정, (3) 신규 vitest 가드 3종(`guide-error-code-existence`, `guide-error-code-scan`, `guide-sanitized-message-parity`) 추가로 구성된다. 프로덕션 런타임 경로(컨트롤러·서비스·API 클라이언트)에는 필드명 변경 외 알고리즘·I/O·캐싱에 영향을 주는 로직 변경이 없다. 신규 테스트 가드는 backend+packages 전체 소스 트리를 매 실행마다 정규식으로 훑지만 파일 수·줄 수 규모에서 선형이고 병적 패턴(중첩 정량자 ReDoS, N+1 I/O, O(n²) 문자열 누적)은 관측되지 않았다 — 테스트 스위트 실행 시간 누적이라는 관례적 비용만 있을 뿐 회귀는 아니다.

## 위험도

NONE
