# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 형제 엔드포인트 `POST /api/integrations/:id/test` 의 응답 DTO 가 실제로 실리는 `code` 필드를 여전히 선언하지 않는다 — 이번 PR 이 고친 결함과 **같은 클래스**가 인접 파일에 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`, 게이트 456~465행) — `success` / `message` / `meta` 만 선언
  - 상세: `IntegrationsService.testConnection`/`previewTest` 가 반환하는 `IntegrationTestResult` 인터페이스(`codebase/backend/src/modules/integrations/integrations.service.ts:75` 부근)는 `code?: string` 을 명시하고, 실제로 `code:` 리터럴이 서비스 전체에서 26곳에서 반환된다(`INTEGRATION_CREDENTIALS_UNREADABLE` 등). `spec/2-navigation/4-integration.md §9.1` 도 실패 shape 을 `{success, code, message}` 로 문서화한다. 그런데 `@ApiOkWrappedResponse(TestConnectionResultDto)` 로 광고되는 DTO 에는 `code` 가 없다 — 이번 PR 이 `/api/model-configs/:id/test` 에서 고친 "값 vs 선언 불일치"와 정확히 같은 패턴이다. 다만 이 PR 은 이 파일에서 `latencyMs` 제거만 했을 뿐 `code` 갭은 건드리지 않았고, `assertMatchesContract` 도 이 엔드포인트엔 배선돼 있지 않아(실측: plan 문서가 "사용처는 일부 e2e 뿐"이라고 밝힘) 런타임으로도 못 잡는다.
  - 제안: 이번 PR 블로킹 사유는 아니다(스코프 밖, diff 미변경 부분). 다만 같은 결함 클래스가 남아 있으므로 플랜 백로그에 `TestConnectionResultDto.code` 선언 추가 + 그 엔드포인트에도 `assertMatchesContract` 배선을 등재할 것을 권고.

- **[INFO]** `ModelTestConnectionResultDto`/`TestConnectionResultDto` 두 DTO 모두에서 `latencyMs` 를 제거한 것은 저장소 내 생산자 0건 실측으로 뒷받침되지만, OpenAPI 스키마 관점에서 "응답에서 필드 제거"는 형식상 breaking change 카탈로그에 속한다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-465`, `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:50-58`
  - 상세: 이 프로젝트에 API 버전 관리(URL/헤더 버전) 체계가 없어 이런 필드 제거는 CHANGELOG 고지가 유일한 완화 수단이다. 이번 CHANGELOG 항목("⚠️ 배포 시 확인 — 응답에서 사라지는 필드")이 그 역할을 정확히 수행하고 있고, 실제로 이 값이 한 번도 채워진 적이 없었다는 실측(저장소 전수 grep 으로 확인: `latencyMs` 잔존 참조가 주석뿐)이 있어 외부 클라이언트가 실질적으로 영향받을 가능성은 낮다. 문제로 등재하지 않고 참고로만 남긴다.
  - 제안: 없음(현재 대응이 적절함).

- **[INFO]** `POST /api/model-configs/:id/test` 실패 응답 shape(`{success, message, dimension?}`)이 `spec/2-navigation/6-config.md §3` 에 아직 문서화되지 않음
  - 위치: `spec/2-navigation/6-config.md §3` (파일 미변경, spec 갭)
  - 상세: `plan/in-progress/guide-error-code-truth.md` §E #3 에 이미 planner 백로그로 등재돼 있고(`developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 스코프에서 고칠 수 없음), 이 항목이 애초에 가이드가 존재하지 않는 이름을 지어낸 근본 원인으로 지목돼 있다. 절차상 올바르게 위임됐으므로 차단 사유 아님.
  - 제안: 병합 후 planner 턴에서 §3 갱신이 실제로 이뤄지는지 추적.

## 긍정적으로 확인한 사항 (참고)

- `error`→`message` 필드 리네임: 서비스 실제 반환·선언 DTO·프런트엔드 소비 세 층의 불일치(`error` vs `message`)로 실패 토스트가 빈 문자열을 냈던 실제 프로덕션 결함을 고친다. 저장소 전수 검색(`grep -rn "\.error\b"` 등)으로 `.error` 소비처가 없음을 확인했고, 프런트엔드(`model-config-manager.tsx`)는 이미 `result.message` 를 읽고 있어 이 리네임은 프런트 입장에서 breaking change 가 아니라 결함 수정이다.
- 회귀 방지: `assertMatchesContract`/`contractForDto` 를 서비스 단위 테스트뿐 아니라 컨트롤러 HTTP 왕복 테스트(`Test.createTestingModule` + supertest + 실제 `TransformInterceptor`, mock 아닌 진짜 `LlmService`)에도 배선해 "선언 vs 값" 불일치를 런타임으로 고정했다. 필드명 축에서 vacuous 해지지 않도록 mock 서비스 대신 실제 서비스를 DI 한 설계가 견고하다.
- 문서(mdx) 정정: `MAKESHOP_API_ERROR`(지어낸 이름), `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`(은퇴한 이름), `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`(로드맵 전용 이름) 을 실제 backend 소스 대조로 정정했고, 새 가드(`guide-error-code-existence` + `guide-error-code-scan`)로 동일 결함 재발을 build-time 에 차단한다 — "에러 응답 형식 일관성" 관점에서 우수한 보완.
- 인증/인가: 이번 diff 는 컨트롤러 라우트·가드(`@Roles`, `@ApiBearerAuth`, `Throttle`)를 변경하지 않았고, 응답 필드만 손댔다. 확인 결과 `llm-model-config.controller.ts` 는 기존 가드가 그대로 유지된다.
- URL/경로·페이지네이션: 이번 diff 범위에 라우트 설계나 목록 API 변경이 없어 해당 없음.

## 요약

이번 변경의 핵심은 `POST /api/model-configs/:id/test` 응답에서 서비스·DTO·프런트엔드 세 층의 필드명이 갈려 실패 사유가 화면에 전혀 도달하지 못하던 실제 결함을 `message` 로 통일해 고친 것이며, 저장소 전수 검색으로 하위 호환성(기존 소비처 없음)을 검증하고 `assertMatchesContract` 를 HTTP 왕복까지 포함해 배선해 회귀를 런타임으로 고정한 점이 API 계약 관점에서 견고하다. 함께 제거된 `latencyMs` 는 실측상 생산자 0건이라 실질적 breaking change 가 아니며 CHANGELOG 고지도 적절하다. 다만 리뷰 중 형제 엔드포인트 `/api/integrations/:id/test` 의 `TestConnectionResultDto` 에 실제로 실리는 `code` 필드가 여전히 선언에서 빠져 있는, 이번 PR 이 고친 것과 동일한 클래스의 잔여 결함을 발견했다(diff 밖이라 이번 PR 을 막을 사유는 아니지만 후속 등재를 권고). spec 문서화 갭(§3)은 이미 planner 백로그로 올바르게 위임돼 있다.

## 위험도

LOW
