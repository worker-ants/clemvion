# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드 삼각 불일치를 이번 PR 이 Database·HTTP rotate 실패 경로까지 넓힌다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 메서드, `dispatchTest` 실패 시
    `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })` 블록. Swagger 서술은
    `codebase/backend/src/modules/integrations/integrations.controller.ts` — `rotate()` 의 `@ApiBadRequestResponse` (게이트: 파일 11
    unified diff, `- '입력값 검증 실패 또는 자격 증명 유효성 오류'` → `+ '입력값 검증 실패 또는 자격 증명 유효성 오류, 새 값의 연결 테스트 실패(\`INTEGRATION_TEST_FAILED\`)'` 줄)
  - 상세: `BadRequestException` 은 HTTP 400 을 던지는데, `spec/2-navigation/4-integration.md §9.4` 는 같은 코드를
    `INTEGRATION_TEST_FAILED (422)` 로 문서화하고 있고, `spec/5-system/2-api-convention.md §6` 의 일반 원칙("422=비즈니스 로직 오류")도
    의미상 422 를 지지한다 — 코드·spec 두 문서·컨벤션 사이에 삼각으로 어긋난 상태다. 이 PR 이전에는 `rotate` 가 `mcp`/`email` 서비스에서만
    이 예외 경로를 탔지만, 이번 PR 이 Database·HTTP 의 새 실패 코드(`DB_AUTH_FAILED`/`HTTP_AUTH_FAILED` 등)를 같은
    `INTEGRATION_TEST_FAILED` → 400 경로에 태워 이 불일치의 표면을 넓힌다. 다행히 새로 추가된
    `codebase/backend/test/integration-connection-test.e2e-spec.ts` 의 "D. rotate — 새 자격증명이 테스트를 통과하지 못하면 교체하지
    않는다" 테스트는 `expect(res.status).toBeGreaterThanOrEqual(400); expect(res.status).toBeLessThan(500);` 로 **정확한 상태 코드를
    단언하지 않아** 이 불일치를 e2e 로 고정시키지는 않는다(구현 plan `plan/in-progress/integration-db-http-testers.md` 의 "체크리스트"에
    이 의도가 명시돼 있음을 확인).
  - 제안: 이 PR 자체를 막을 사안은 아니다(이미 트래커에 등재돼 있고 e2e 도 신중하게 회피했다) — 다만 400/422 불일치가 이번에 실질적으로
    도달 가능한 경로(Database·HTTP)로 넓어졌으므로, `plan/in-progress/integration-db-http-testers.md` 의 "트래커 반영" 체크리스트
    항목을 완료할 때 `spec/5-system/11-mcp-client.md:539`(400 실측 서술)와 `spec/5-system/2-api-convention.md §6`(422 원칙)
    두 근거를 함께 남겨 후속 PR 이 이 상태 코드를 임의로 "정정"하지 않도록 명시해 둘 것.

- **[INFO]** HTTP 연결 테스트에서 "그 밖의 4xx" 는 `success: true` 로 응답 — 클라이언트가 `success` 단독으로 "자격증명 검증 완료"로
  오독할 여지
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` — `classify()` 함수의
    `if (status >= 400) { return { success: true, message: 'Reached the server, but base_url answered HTTP ${status} ...' }; }` 분기
  - 상세: 서버에 닿았지만 자격증명 검증은 못한 상태를 `success: true` 로 표현한다 — 의도된 설계이고 CHANGELOG·API 설명(`@ApiOkWrappedResponse`
    description "실패 시 `code` 로 원인을 구분합니다")·사용자 가이드(mdx 두 파일)에 일관되게 문서화돼 있어 결함은 아니다. 다만 API
    소비자(프론트엔드·외부 통합)가 `success` bool 만으로 "자격증명이 유효함"을 판단하면 오도될 수 있는 응답 형식이라는 점은 계약 문서에서
    사람이 읽는 텍스트로만 방어되고 있다(스키마 레벨의 구분 필드는 없음).
  - 제안: 현 상태 유지로 충분 — 필요하다면 향후 `verified: boolean` 같은 3-state 필드를 추가해 "연결 성공 / 검증 불가 / 실패"를 스키마
    레벨에서 구분하는 것을 고려할 수 있으나 이번 PR 스코프에서 요구되진 않는다.

## 확인된 양호 사항 (참고)

- `PreviewTestResultDto.code` 신설 및 `TestConnectionResultDto.code` 설명 갱신은 둘 다 optional(`@ApiPropertyOptional`) 필드로,
  기존 클라이언트에 대해 완전히 additive — breaking change 아님. `integrations.service.spec.ts` 에 `assertMatchesContract` 로
  두 DTO 의 실패 응답 shape 을 직접 검증하는 배선이 이번에 추가돼(이전에는 값은 나가는데 DTO 선언이 없던 gap), 이전 라운드
  consistency-check(`review/consistency/2026/09/19/13_21_00`) WARNING 3 이 해소됐음을 코드로 확인했다.
- `http-connection-tester.ts` 의 SSRF 차단 응답(`blocked()`)이 `SSRF_BLOCKED_CLIENT_MESSAGE` 를 재사용해 차단된 host/IP 를
  클라이언트 응답에 싣지 않는다 — 같은 라운드 WARNING 2(정찰면 축소 invariant 미계승 우려)가 실제 구현에서는 해소돼 있음을 확인했다.
- Database·HTTP 서비스가 `preview-test`/`:id/test`/`rotate` 에서 구조 검증만 하다가 실제 접속으로 바뀌는 것은 기존에 "통과"하던
  저장된 통합이 이제 실패할 수 있는 실질적 동작 변화이지만, CHANGELOG "배포 뒤 보일 수 있는 것" 절에 명시적으로 안내돼 있고 이것이
  이 PR 이 고치려는 보안 결함(틀린 자격증명도 통과)의 본질이므로 하위 호환성 관점에서 문제로 보지 않는다.
- URL/경로 설계·페이지네이션·인증-인가 데코레이터(`@Roles`, `@Throttle`, `@WorkspaceId`)는 이번 diff 로 변경되지 않았고 기존 패턴과
  일관된다. 새 엔드포인트·버전 변경은 없다.

## 요약

이번 변경은 신규 엔드포인트나 URL 구조 변경 없이 기존 `preview-test`/`:id/test`/`:id/rotate` 세 경로가 공유하는 `dispatchTest` 에
Database·HTTP 실제 연결 테스트를 추가하고, 그 결과로 나가는 새 `code` 값 다섯 개(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`DB_HOST_BLOCKED`
재사용·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_BLOCKED` 재사용)를 응답 DTO 에 additive 하게 반영한다.
DTO 계약 검증(`assertMatchesContract`)이 신규·기존 gap 모두에 배선돼 응답 형식 일관성이 코드 수준에서 보장된다. 유일하게 남는 계약
관점 이슈는 `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 spec 문서 두 곳(422)과 실제 구현·인접 spec 서술(400) 사이에서 이미
어긋나 있던 것을, 이 PR 이 Database·HTTP rotate 실패 경로까지 확장해 도달 가능 범위를 넓힌다는 점이다 — 다만 신규 e2e 는 정확한
상태 코드를 단언하지 않도록 신중하게 작성됐고 트래커에도 이미 등재돼 있어 이번 PR 자체를 막을 사안은 아니다. CRITICAL 급 하위 호환성
파괴·요청 검증 누락·인증/인가 우회는 발견되지 않았다.

## 위험도

LOW
