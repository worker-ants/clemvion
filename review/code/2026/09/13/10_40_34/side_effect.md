# 부작용(Side Effect) 리뷰

## 검토 범위와 방법

프롬프트에 실린 56개 파일 중 실제 코드 변경은 20개(`codebase/**`, `git diff --stat origin/main...HEAD -- codebase/` 로 재확인), 나머지는 `CHANGELOG.md`·`plan/**`·이전 라운드의 `review/code/**10_12_19`·`review/consistency/**` 산출물(둘 다 문서/JSON, 이 프로젝트 관례상 커밋 대상)이다. 프롬프트가 절단한 파일(3·18·19·22·23)은 `git diff origin/main...HEAD -- <path>` 로 원본을 직접 열어 대조했다. 아래는 저장소를 뮤테이션하지 않고 `grep`/`Read`/`git diff`만으로 확인했다 — 종료 시 `git status --short` 결과는 이 세션 자신의 미커밋 산출 디렉터리 2개(`review/code/.../10_40_34`, `review/consistency/.../10_41_13`)뿐이었다.

핵심 변경은 `POST /api/model-configs/:id/test` 응답의 실패 필드명 정정(`error`→`message`)과 두 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`)에서 생산자 0건 필드(`latencyMs`, `meta`) 제거·`code` 필드 추가, 그리고 유저 가이드 문서·신규 정적 가드(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`) 추가다.

## 발견사항

- **[INFO]** `LlmService.testConnection` 반환 타입 변경 — 공개 API(`POST /api/model-configs/:id/test`)의 실패 응답 필드명이 `error`→`message` 로 바뀐다. 시그니처·응답 shape 변경이지만 내부 소비처는 전수 확인 결과 이미 정합했다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:326` (반환 타입 선언), `:354` (반환문)
  - 상세: `grep -rn "testConnection" codebase/backend/src`로 호출부를 전수 확인 — 유일한 서버 측 호출자인 `LlmModelConfigController.testConnection`(`codebase/backend/src/modules/llm/llm-model-config.controller.ts:115`)은 `return this.llmService.testConnection(id, workspaceId)` 순수 위임이라 필드명에 관여하지 않는다. 프런트엔드 유일 소비처(`codebase/frontend/src/components/models/model-config-manager.tsx:82` `result.message ?? ""`)는 이미 `message`를 읽고 있었다 — 즉 이 리네임 이전에도 `.error`는 아무도 읽지 않았다(실제 버그였다). `spec/2-navigation/6-config.md:281`·`spec/5-system/7-llm-client.md:452`로 이 엔드포인트가 `editor` 이상 권한으로 게이트된 1st-party SPA 전용 API이고 별도 공개 SDK/외부 클라이언트 생성 파이프라인이 저장소에 없음을 확인했다 — 서드파티가 `.error`를 직접 파싱하고 있었을 가능성은 낮다. CHANGELOG(`CHANGELOG.md` 게이트 19~26행)에 "⚠️ 배포 시 확인 — 응답에서 사라지는 필드" 섹션으로 명시적으로 고지돼 있다.
  - 제안: 없음 — 이미 CHANGELOG 로 고지됐고 내부 소비처 불일치가 없음을 확인했다. 다만 이 저장소에 API 버전 관리 체계가 없어 향후 유사 필드 리네임 시 CHANGELOG 고지가 유일한 완화 수단이라는 점은 계속 유의할 것.

- **[INFO]** DTO 필드 제거(`latencyMs` ×2, `meta` ×1) — 선언된 응답 스키마가 좁아지는 인터페이스 변경이지만 실제 페이로드는 변하지 않는다(원래도 실린 적이 없었다).
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (`ModelTestConnectionResultDto`, `latencyMs?: number` 제거 — 주변 게이트 50~58행), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`, `latencyMs?: number`·`meta?: Record<string, unknown>` 제거 — 게이트 457~490행)
  - 상세: 서비스 쪽 반환 타입을 직접 대조해 실측을 재확인했다 — `IntegrationTestResult`(`codebase/backend/src/modules/integrations/integrations.service.ts:75-82`)에는 애초에 `meta` 필드가 없고(`success`·`message`·`code`·`capabilities`·`serverInfo`·`preview`만 선언), `LlmService.testConnection` 도 `latencyMs`를 반환한 적이 없다. 즉 이번 제거는 실제 와이어 포맷을 바꾸지 않고 선언만 실측에 맞춘 것이다. `code?: string` 추가(게이트 479행)는 순수 additive라 호환성 문제가 없다.
  - 제안: 없음 — 실측 근거가 코드 주석·CHANGELOG 양쪽에 남아 있고 검증도 재확인됨.

- **[INFO]** 신규 가드 2건이 매 vitest 실행마다 `codebase/backend/src` + `codebase/packages` 전체를 동기 `fs.readFileSync`로 적재 — 프로덕션 경로 부작용은 아니나 빌드/CI 시점 파일시스템 I/O가 늘어난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46` (`walkTree(root, ["codebase/backend/src", "codebase/packages"], ...)`)
  - 상세: 이 파일시스템 순회는 테스트 스위트 로드 시점(빌드/CI 전용)에만 실행되고 런타임 요청 경로와 무관하다. 자매 가드 `impl-anchor-existence.test.ts`가 이미 같은 패턴(`walkTree` 기반 backend/packages 전량 읽기)을 확립해 둔 선례를 그대로 따른다 — 새로 도입된 부작용 클래스가 아니다.
  - 제안: 없음 — 관찰 기록.

- **[INFO]** 신규 컨트롤러 통합 테스트(`POST /model-configs/:id/test — 와이어 계약 (HTTP)`)가 실제 NestJS 애플리케이션 인스턴스를 기동 — 생명주기는 정상 관리됨, 프로덕션·외부 네트워크와 무관.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:167` (`beforeAll` → `app.init()`, :204), `:207` (`afterAll` → `app.close()`, :208)
  - 상세: `Test.createTestingModule(...).compile()` → `createNestApplication()` → `app.init()`을 `beforeAll`에서 1회 실행하고 `afterAll`에서 `app.close()`로 정리한다. `supertest`가 그 인메모리 HTTP 서버에 요청을 보내는 것이라 외부 네트워크 호출이 아니다. `LLMClientFactory`·`ModelConfigService`·`LlmUsageLogService`는 전부 mock으로 주입돼(`useValue`) 실제 DB·외부 provider 호출이 발생하지 않는다. 리소스 누수·미종료 핸들 없음.
  - 제안: 없음.

- **[INFO]** `package.json`/lockfile 변경 없음, 신규 `process.env` 참조 없음 — 직접 재확인함.
  - 위치: `git diff origin/main...HEAD -- '**/package.json' 'pnpm-lock.yaml'` (결과 없음), `git diff origin/main...HEAD | grep "process\.env"` (결과 없음)
  - 상세: 의존성·환경변수 축에서 부작용 표면이 없다.
  - 제안: 없음.

## 요약

이번 변경의 실질 프로덕션 코드 수정은 `LlmService.testConnection` 반환 필드 리네임(`error`→`message`) 1건과 두 DTO의 미발행 필드(`latencyMs`, `meta`) 제거·`code` 필드 추가뿐이며, 둘 다 저장소 전수 검색으로 내부 소비처와의 정합을 재검증했고(내부 호출자는 이미 새 이름을 읽고 있었음, 제거된 필드는 서비스가 원래 반환한 적이 없었음), 이 엔드포인트가 `editor` 권한 게이트를 통과해야 하는 1st-party SPA 전용 API임도 spec 대조로 확인했다. 전역 상태·환경변수·네트워크 호출·파일시스템 쓰기·의존성 변경은 발견되지 않았고, 신규 가드·통합 테스트가 수행하는 파일 읽기·인메모리 HTTP 서버 기동은 모두 빌드/테스트 시점에 한정되며 기존 선례(`impl-anchor-existence.test.ts`)를 따른다. 공개 API 응답 shape 변경이라는 점에서 원론적으로 "인터페이스 변경" 항목에 해당하지만, CHANGELOG 고지·소비처 전수 확인·버전관리 부재에 대한 인지가 모두 갖춰져 있어 차단 사유가 되는 부작용은 없다.

## 위험도

LOW
