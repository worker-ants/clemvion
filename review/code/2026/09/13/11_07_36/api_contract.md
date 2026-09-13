# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 형제 엔드포인트 `POST /api/integrations/:id/test` 의 `TestConnectionResultDto` 가 실제로 나가는 `code` 필드를 여전히 선언하지 않는다는 직전 리뷰(`review/code/2026/09/13/10_12_19/api_contract.md` WARNING#1)의 지적이 이번 diff 에서 실제로 해소됐다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `TestConnectionResultDto` (게이트 456~478행, `code?: string` 신규 선언)
  - 상세: `Read` 로 현재 파일을 직접 열어 대조했다 — `code?: string`(`@ApiPropertyOptional()`)이 `success`/`message` 사이에 추가돼 있고, `IntegrationsService.testConnection`/`previewTest`가 반환하는 `IntegrationTestResult.code`(`integrations.service.ts`)·`spec/2-navigation/4-integration.md §9.1`의 `{success:false, code, message}` 문서화와 이제 일치한다. `integrations.service.spec.ts`(게이트 693~699행)에도 이 방향으로 `assertMatchesContract(result, await contractForDto(TestConnectionResultDto))`가 성공 경로가 아닌 `pending_install` 실패 경로에 배선됐다. 재-flag 아님 — 확인 목적의 INFO.
  - 제안: 없음.

- **[INFO]** 같은 `IntegrationTestResult` 인터페이스의 MCP 전용 필드(`capabilities`·`serverInfo`·`preview`)는 여전히 `TestConnectionResultDto`에 미선언이며, `assertMatchesContract` 배선도 성공 경로에는 아직 없다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:469-471`(주석으로 자백) / `codebase/backend/src/modules/integrations/integrations.service.ts:80-82`(인터페이스), `:1600-1602`(실제 반환) / `codebase/backend/src/modules/integrations/integrations.service.spec.ts:693-695`(주석 — "성공 경로에는 아직 걸 수 없다")
  - 상세: 값 vs 선언 불일치의 같은 클래스(선언 누락)가 MCP 성공 응답에 남아 있음을 코드 주석 스스로 밝히고 있고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3256-3259`에 "함께 할 일: 이 엔드포인트에 assertMatchesContract 배선"으로 명시 등재돼 있다. 은닉 없이 disclosure 됐고 이번 PR 스코프(가이드 에러 코드 진위 + LLM testConnection 필드명)가 아니므로 차단 사유는 아니다.
  - 제안: 후속 PR 에서 DTO 신설 + 성공 경로 계약 배선이 이뤄지는지 추적. 이번 PR 을 막을 필요는 없음.

- **[INFO]** `LlmService.testConnection` 응답 필드 `error → message` 리네임은 와이어 형식 변경(breaking 성격)이지만, 저장소 전수 검색상 소비처 영향이 없음을 실측으로 확인
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts`(`testConnection` 반환 타입·구현, 게이트 307~355행 부근), `codebase/frontend/src/lib/api/model-configs.ts:138-143`(API 클라이언트 타입)
  - 상세: `grep -rn "result\.error\b" codebase/frontend/src/components/models`, `grep -rn "\.error" codebase/frontend/src/lib/api/model-configs*` 로 `.error` 소비처 부재를 확인했다. 프런트엔드(`model-config-manager.tsx`)는 이미 `result.message`를 읽고 있었으므로 이번 리네임은 실질적으로 "기존에 도달하지 못하던 필드를 도달시키는" 버그 수정이지 하위 호환성을 깨는 변경이 아니다. 이 프로젝트에 API 버전 관리 체계(URL/헤더 버전)가 없는 상태에서 이런 wire-format 변경이 반복되면 리스크가 커지므로, CHANGELOG 의 "⚠️ 배포 시 확인" 섹션이 그 완화 수단으로 정확히 기능하고 있다.
  - 제안: 없음 — 이번 건은 적절히 처리됨. 다만 향후 유사 변경 시 이 CHANGELOG 관례(변경표 + 소비처 실측)를 계속 지킬 것.

- **[INFO]** `latencyMs` 제거(양쪽 DTO) — OpenAPI 스키마에서 필드가 사라지는 형식상 breaking change 카탈로그에 속하지만 실측상 생산자 0건이라 실질 영향 없음
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:52-58`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:460-462`
  - 상세: `contractForDto`/`assertMatchesContract`가 원리적으로 "선언됐지만 안 나가는 키" 방향은 못 잡는다는 점(주석 스스로 명시)까지 정확히 인지하고 grep 실측으로 보완했다. 프런트 API 클라이언트·테스트(`model-configs.ts`, `model-configs.test.ts`)도 함께 갱신돼 타입 계약이 3층 전체에서 일관된다.
  - 제안: 없음.

- **[INFO]** 두 테스트 엔드포인트 모두 실패 시에도 HTTP 상태가 200 으로 유지되고 `success:false`로 구분하는 계약이 이번 변경 전후로 불변
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:220,254`(신규 supertest 왕복, `res.status` 를 200 으로 단언), `integrations.service.spec.ts` 기존 케이스
  - 상세: 에러 상태 코드 축은 건드리지 않았고, 신규 컨트롤러 HTTP 왕복 테스트가 `TransformInterceptor`를 실제로 통과시켜 `{data:{...}}` 봉투와 `success:false, message` 조합의 최종 wire shape 을 고정했다 — 응답 형식 일관성 관점에서 견고한 회귀 방지책이다. 인가(`@Roles('editor')`) 도 같은 파일에서 메타데이터 단언으로 불변 확인됐다.
  - 제안: 없음.

## 요약

이번 변경의 핵심은 `POST /api/model-configs/:id/test`에서 서비스·DTO·프런트엔드 세 층의 필드명(`error` vs `message`)이 갈려 실패 사유가 화면에 전혀 도달하지 못했던 실제 결함을, 저장소 전수 검색으로 소비처 영향이 없음을 확인한 뒤 `message`로 통일해 고친 것이다. 직전 리뷰 세션(10_12_19)이 지적했던 형제 엔드포인트(`/api/integrations/:id/test`)의 `code` 필드 미선언 WARNING 은 이번 diff 에서 `code?: string` 선언 추가로 실제 해소됐음을 `Read`로 직접 대조해 확인했다. `assertMatchesContract`를 서비스 단위뿐 아니라 컨트롤러 HTTP 왕복(TransformInterceptor 포함)까지 배선해 "값 vs 선언" 불일치를 런타임 회귀로 고정한 점, 미발행 `latencyMs`를 양쪽 DTO에서 함께 제거하면서 소비처 부재를 실측으로 뒷받침한 점 모두 API 계약 관점에서 견고하다. 남은 갭(MCP 성공 응답의 `capabilities`/`serverInfo`/`preview` 미선언)은 이번 PR 스코프 밖이며 plan 트래커에 명시적으로 등재돼 있어 차단 사유가 아니다. 라우트/페이지네이션/인가 축은 이번 diff 로 변경되지 않았다.

## 위험도

NONE
