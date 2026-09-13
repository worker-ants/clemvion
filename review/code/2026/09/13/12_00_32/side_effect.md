# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TestConnectionResultDto` 필드 추가/제거(`code` 신설, `latencyMs`·`meta` 제거)가 이 진단 도구(`assertMatchesContract`)의 대조 범위 밖 소비처에 영향이 없는지 확인함 — 영향 없음 확인
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (클래스 `TestConnectionResultDto`)
  - 상세: `latencyMs`·`meta` 는 생산자가 0건임을 실측으로 확인(diff 주석에 근거 명시), `meta` 라는 이름이 같은 서비스 파일에 다른 용도(`buildIntegrationMeta`, 카탈로그 조회용 `IntegrationMeta`)로 남아 있어 혼동 가능성이 있었으나 실제 grep 결과 그 두 용례는 이 DTO 를 쓰는 엔드포인트(`POST /api/integrations/:id/test`)와 무관한 것으로 확인됨. 신규 `code` 필드도 프런트엔드 `integrations.ts` API 클라이언트가 아직 좁은 타입(`{success, message}`)으로 unwrap 하고 있어 소비하지 않지만, 이는 이 PR 이전부터 존재하던 상태이고 이번 diff 로 새로 깨진 것은 아님(백엔드는 이미 `code` 를 내보내고 있었다는 것이 이 PR 의 진단 전제).
  - 제안: 없음(정보 제공용).

- **[INFO]** `LlmService.testConnection` 반환 타입 시그니처 변경(`error?` → `message?`)의 호출자 영향 범위를 전수 확인함
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` 함수 `testConnection`
  - 상세: 저장소 내 이 메서드의 유일한 호출자는 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 의 `testConnection` 핸들러이며 순수 위임(`return this.llmService.testConnection(...)`)이라 별도 매핑이 없다. 프런트엔드 소비처(`model-config-manager.tsx`)는 diff 대상 파일 목록에 없었는데, 확인 결과 이미 `result.message ?? ""` 로 읽고 있어 이번 변경 전부터 그 방향으로 맞춰져 있었다(diff 없음 확인). API 클라이언트(`lib/api/model-configs.ts`)·테스트(`model-configs.test.ts`, `model-config-manager.test.tsx`)도 함께 갱신되어 3층(서비스·DTO·프런트엔드)이 모두 `message` 로 정렬됨. e2e/Playwright mock 중 이 필드명에 의존하는 것은 없음(grep 0건).
  - 제안: 없음.

- **[INFO]** 신규 가드 테스트(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`)의 정규식 사용이 모듈 스코프의 `g` 플래그 `RegExp` 객체(`FIELD_TABLE_NAME`, `CODE_FIELD`, `PROSE_BACKTICK`)를 공유 상태로 사용하지만, 매 호출 진입 시 `rx.lastIndex = 0` 으로 명시적 리셋 후 `exec` 루프가 `null` 까지 완주하므로 재진입(같은 프로세스 내 반복 호출)에도 오염되지 않음을 확인함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` 함수 `scanErrorCodeCitations`
  - 상세: 테스트 스위트가 여러 MDX 파일에 대해 같은 정규식 인스턴스를 재사용하는 패턴은 일반적으로 `lastIndex` 오염 버그의 전형적 원인이지만, 이 구현은 방어적으로 리셋하고 있어 실제 부작용은 없다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 백엔드 진단 컨트롤러 테스트(`llm-model-config.controller.spec.ts` 신규 `describe`)가 `Test.createTestingModule` + `app.init()` 으로 실제 Nest 애플리케이션 인스턴스를 기동하고 `afterAll` 에서 `app.close()` 로 정리함을 확인 — 테스트 프로세스 내에서만 존재하는 격리된 인스턴스이며 실제 네트워크 포트 바인딩 없이 `supertest` 로 in-process 호출됨. 다른 테스트 스위트와 전역 상태 공유 없음.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')`
  - 상세: `beforeAll`/`afterAll` 로 앱 생명주기가 스위트 범위에 국한되고 `beforeEach` 에서 mock 리셋(`clientTestConnection.mockReset()`)이 이루어져 테스트 간 상태 누수 위험 없음.
  - 제안: 없음.

- **[INFO]** CHANGELOG·PROJECT.md·MDX 문서 변경은 순수 문서/텍스트 변경으로 런타임 부작용 없음. `review/code/**`·`review/consistency/**` 하위에 커밋된 다수의 과거 라운드 리뷰 산출물(RESOLUTION.md, SUMMARY.md 등)은 프로젝트 관례(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 따른 정상적인 아카이브이며 코드 실행 경로에 영향 없음.
  - 위치: `CHANGELOG.md`, `PROJECT.md`, `review/code/2026/09/13/**`
  - 상세: 없음.
  - 제안: 없음.

## 요약

이 변경의 핵심은 `LlmService.testConnection` 응답 필드 rename(`error`→`message`)과 두 테스트-연결 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`)의 필드 정리(유령 필드 `latencyMs`·`meta` 제거, 실재하던 미선언 필드 `code` 추가)이며, 이는 공개 API 응답 스키마를 바꾸는 인터페이스 변경이다. 전수 확인 결과 저장소 내 모든 호출자·소비처(백엔드 컨트롤러 위임, 프런트엔드 API 클라이언트·컴포넌트·테스트, Swagger 데코레이터)가 이미 새 필드명에 맞춰 함께 갱신돼 있고, 제거된 필드는 실측으로 생산자 0건임이 확인돼 있어 숨은 호출자에게 영향을 줄 가능성은 낮다. 새로 추가된 가드 테스트·계약 검증 유틸리티(`assertMatchesContract`)는 테스트 프로세스 범위에 격리돼 있고 전역 상태·파일시스템·네트워크에 대한 예상 밖의 부작용은 관찰되지 않았다. 문서(MDX/CHANGELOG) 변경과 과거 리뷰 라운드 산출물 커밋은 프로젝트 관례에 부합하는 순수 정보성 변경이다.

## 위험도

LOW
