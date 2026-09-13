# 성능(Performance) 리뷰

## 검토 범위

프로덕션 코드 변경은 `llm.service.ts`(반환 필드 `error`→`message` rename) ·
`model-config-response.dto.ts`/`integration-response.dto.ts`(미발행 `latencyMs`/`meta` 필드
제거, `code` 필드 추가) · `model-configs.ts`(프런트 API 클라이언트 타입) 뿐이며, 나머지는
테스트(`llm.service.spec.ts`, `llm-model-config.controller.spec.ts`,
`model-config-manager.test.tsx`, `model-configs.test.ts`) · 신규 문서 가드
(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`,
`guide-sanitized-message-parity.test.ts`) · MDX 문서 · CHANGELOG/plan/review 산출물이다.

## 발견사항

- **[INFO]** 신규 가드가 `backend/src` + `packages` 전체(.ts, 실측 1,304 + 50 = 1,354개)를
  매 테스트 실행마다 동기 `fs.readFileSync` 로 전량 로드하며, **같은 트리를 이미 다른 가드가
  독립적으로 재순회하고 있음을 확인**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46-49`
    (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …).map(f => fs.readFileSync(...))`,
    `describe` 콜백 최상위 — 모듈 로드 시 1회, `it()` 당 재계산은 아님)와 소비처
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:154-165`
    (`collectBackendTokens` — 파일마다 `\b(UPPER_SNAKE)\b` 전역 정규식 1회 스캔, 실측
    1,743종 토큰).
  - 상세: 알고리즘 자체는 선형(O(총 바이트 수))이라 이차 복잡도나 N+1 문제는 아니다. 다만
    이 diff 가 도입하는 새 코스트는 **저장소 규모에 비례해 계속 자라는 고정 오버헤드**이고,
    같은 저장소에 **이미 동일 디렉터리를 훑는 별도 가드**가 존재한다 —
    `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:462-478` 의
    `collectCodebaseSources()` 가 `codebase/backend/src`(+`frontend/src`,
    `channel-web-chat/src`, `packages`)를 `walkTree` 로 전량 순회하고,
    `spec-link-integrity.test.ts:85`(+ 그 안에서 실제로 파일 내용을 읽는
    `findBrokenSpecLinksInSources`)가 그 결과를 소비한다. 즉 CI 한 번에 frontend 테스트
    스위트가 `codebase/backend/src`+`codebase/packages` 를 **최소 두 번, 서로 다른 파일에서
    독립적으로** `readdirSync`+`readFileSync` 하는 상태다 — 결과를 캐싱·공유하는 장치는
    없다(둘 다 매 vitest 프로세스 로드 시 자신의 모듈 스코프에서 새로 순회한다).
  - 제안: 지금 규모(1,354개 파일)에서 이 자체가 CI 를 막을 사유는 아니다(이전 라운드
    `review/code/2026/09/13/10_12_19/performance.md` 도 같은 결론). 다만 "가드마다
    독립적으로 재순회할 가능성" 이 아니라 **실제로 그렇다**는 점을 이번에 확인했으므로, 후속
    가드를 더 추가하기 전에 `walkTree` 순회 결과(파일 목록 + 내용)를 vitest 프로세스 내
    모듈 레벨 캐시로 한 번만 만들고 여러 가드가 재사용하도록 정리할 근거로 남긴다.

- **[INFO]** 프로덕션 코드 변경은 필드 rename·미사용 필드 제거뿐 — 알고리즘/쿼리/캐싱/블로킹
  I/O 영향 없음
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:326,354`(`error`→`message`),
    `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:50-58`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-491`
  - 상세: `testConnection` 은 기존 `try/catch`·단일 반환문 구조를 그대로 유지한 채 반환
    객체의 키 이름만 바꿨다. DTO 에서 생산자 0건이던 `latencyMs`/`meta` 를 제거한 것은
    런타임 페이로드에 원래도 실리지 않던 필드라 직렬화 비용·응답 크기에 실질 변화가 없고,
    새로 선언된 `code?: string` 은 이미 서비스가 반환하던 값을 뒤늦게 문서화한 것뿐이다.
    DB 쿼리, 반복문 내 API 호출, 신규 캐시 레이어, 동기 I/O 도입 등 성능에 영향을 줄 만한
    패턴은 diff 안에 없다.
  - 제안: 없음.

## 요약

이번 PR 의 실질 프로덕션 코드 변경(`error`→`message` 필드 rename, 미발행 `latencyMs`/`meta`
제거, `code` 필드 선언 추가)은 순수 rename·필드 정리 수준이라 성능에 미치는 영향이 없다.
성능 관점에서 유일하게 짚을 지점은 신규 문서 가드(`guide-error-code-existence.test.ts`)가
backend+packages 전체(1,354 파일)를 매 테스트 실행마다 동기 로드·정규식 스캔한다는 것인데,
알고리즘은 선형이고 새로운 리스크 등급을 만들지는 않는다. 다만 같은 트리를 이미 별도 가드
(`spec-link-integrity.test.ts` / `spec-links.ts::collectCodebaseSources`)가 독립적으로
재순회하고 있음을 이번에 실측으로 확인했다 — 캐싱 부재로 인한 중복 I/O가 "가능성"이 아니라
"사실"이라는 점을 후속 최적화 근거로 기록해 둔다. 지금 규모에서는 병합을 막을 사유가 아니다.

## 위험도

NONE
