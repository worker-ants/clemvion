# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 이번 PR 이 고치는 버그(`testConnection` 실패 응답 3층 필드명 불일치로 토스트가 비어 나가던 문제)는 백엔드·API 클라이언트 계층에서 실측(66/66, 26/26, 39/39 GREEN)으로 검증됐으나, **정작 그 문장을 화면에 렌더링하는 마지막 지점(UI 컴포넌트)에는 실패 경로 테스트가 없다**(WARNING #2). 또한 이번 PR 이 도입한 신규 가드는 "에러 코드 이름의 실재"만 보증하고, 이번 결함의 실질 원인이었던 "문구/필드 내용의 정확성"까지는 닫지 못해 같은 클래스의 문서-코드 drift 가 `models.mdx` 표에서 다시 열릴 수 있다(WARNING #1). 인접 파일(형제 엔드포인트 DTO)에 같은 결함 클래스가 잔존한다는 사실도 확인됐다(WARNING #3, 이번 diff 스코프 밖). 14개 reviewer 전원이 성공적으로 결과를 반환했고(forced 7명 전원 결과 확보 — 강제 화이트리스트 미이행 없음), 누락·재시도 필요 항목은 없다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서-코드 정합(architecture) | 신규 가드(`guide-error-code-existence`)는 에러 **코드 토큰**의 실재만 검증하고, `models.mdx`에 새로 박아 넣은 8갈래 실패 **문장**은 `sanitize-error.util.ts`의 문자열을 수기로 옮긴 것이라 이를 대조하는 자동 검사기가 없다. 이번 PR이 막으려 한 것과 같은 클래스(SoT 문구 변경 → 미러 문서 조용히 낡음)가 이 표에서 재발할 수 있다 | `codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx` vs `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` | `sanitize-error.util.ts`의 8개 문자열을 export 하고 가드가 `models.mdx` 표 문장이 그 집합의 부분집합인지 대조하도록 확장, 또는 후속 plan 항목으로 명시 등재 |
| 2 | 테스트(testing) | "연결 실패" 토스트가 실제 `message` 문자열을 렌더링하는지 검증하는 컴포넌트 테스트가 없다 — 이 PR이 고친다고 주장하는 사용자 증상(토스트가 `"연결 실패: "`로 비어 나감) 자체가 UI 조립 지점에서 무테스트. 백엔드 계약 테스트·API 클라이언트 픽스처 테스트는 이 파일을 로드하지 않아 이 지점을 원리적으로 못 본다 | `codebase/frontend/src/components/models/model-config-manager.tsx:83` (`t("models.connectionFailed", { error: result.message ?? "" })`), 테스트 `model-config-manager.test.tsx`(실패 케이스 0건) | `testConnectionMock.mockResolvedValue({success:false, message:"..."})` 케이스 추가 + `toast.error`가 그 문자열을 포함해 호출됨을 단언 |
| 3 | API 계약(api_contract, requirement 중복 확인) | 형제 엔드포인트 `POST /api/integrations/:id/test`의 `TestConnectionResultDto`가 실제로 26곳에서 반환되는 `code` 필드(및 `capabilities`/`serverInfo`/`preview`)를 여전히 선언하지 않는다 — 이번 PR이 `/api/model-configs/:id/test`에서 고친 것과 동일한 "값 vs 선언" 불일치 클래스가 인접 파일에 잔존. `assertMatchesContract`도 이 엔드포인트엔 배선돼 있지 않아 런타임으로도 못 잡는다(이번 diff 스코프 밖, 블로킹 아님) | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456-465` vs `integrations.service.ts`(`IntegrationTestResult`), `spec/2-navigation/4-integration.md §9.1` | 후속 plan 백로그에 `TestConnectionResultDto.code` 선언 추가 + 해당 엔드포인트 `assertMatchesContract` 배선 등재 |
| 4 | 유지보수성 | `LlmService.testConnection` 함수 시그니처(파라미터 목록과 반환 타입 사이)에 6줄짜리 근거 주석을 끼워 넣어 시그니처 가독성을 해침. 같은 PR의 다른 DTO 파일들은 같은 종류 근거를 통상적인 leading comment 자리에 둬 배치 관례가 갈림 | `codebase/backend/src/modules/llm/llm.service.ts:312-321` | 근거 문단을 함수 상단 기존 JSDoc 블록으로 옮기고 `@returns`에 실패 shape(`{success:false, message}`)도 포함 |
| 5 | 유지보수성 | `collectBackendTokens(files: readonly string[])`의 파라미터명이 실제 값(이미 읽어들인 파일 **내용** 문자열)과 반대로 명명돼 다음 유지보수자를 오해시킬 수 있음 | `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:147,150` | 파라미터명을 `fileTexts`/`sourceTexts`로 변경 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `sanitizeLlmErrorMessage`를 직접 확인한 결과 provider 원문을 그대로 반환하는 경로 없이 8갈래 고정 문구로만 매핑됨 — 이번에 처음 도달 가능해진 실패 문장 경로에 정보 유출 없음 | `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` | 조치 불요 |
| 2 | 보안 | `testConnection` catch 블록의 `logger.warn`은 원본 에러를 서버 로그에만 남기고 `LlmUsageLogService.record`를 호출하지 않아 workspace 사용자 노출 로그로 재전파되지 않음 | `codebase/backend/src/modules/llm/llm.service.ts:348`(diff 문맥) | 조치 불요 |
| 3 | 성능 | 신규 가드가 `backend/src`+`packages` 전체(500+ 파일)를 매 테스트 실행마다 동기 `readFileSync`로 전량 로드 — 알고리즘은 선형이고 기존 자매 가드와 동일 패턴이라 현재 규모에서 문제 아님, 저장소 성장 시 벽시계 비용 관찰 필요 | `guide-error-code-existence.test.ts:46-49`, `guide-error-code-scan.ts` | 조치 불요(관찰만) |
| 4 | 아키텍처(긍정) | 서비스/DTO/프런트엔드 3레이어 필드명 불일치를 `assertMatchesContract`로 서비스 단위+컨트롤러 HTTP 왕복 두 레이어에 배선해 재발 방지 인프라로 정착 | `llm.service.spec.ts`, `llm-model-config.controller.spec.ts` | 조치 불요(긍정적 관찰) |
| 5 | 아키텍처 | `ModelTestConnectionResultDto`/`TestConnectionResultDto` 두 DTO가 유사 shape(`latencyMs` 유령 필드 등)를 중복 유지 — shotgun-surgery 패턴 반복 가능성 | `model-config-response.dto.ts`, `integration-response.dto.ts` | 3회 이상 반복되면 공용 베이스 DTO 검토 |
| 6 | 요구사항/범위 | `TestConnectionResultDto`의 `latencyMs` 제거가 원 트래커 제목("가이드 에러 코드")보다 넓은 Integrations 도메인까지 번짐 — plan·CHANGELOG에 생산자 0건 실측과 함께 명시 고지돼 은닉된 drive-by 아님 | `integration-response.dto.ts:457-462` | 조치 불요(이미 고지됨) |
| 7 | 요구사항 | 이번 PR이 처음 도입한 `<ImplAnchor kind="api-endpoint">` 실사용 사례로 인해 `impl-anchor-existence.test.ts`의 "아직 실사례가 없다"는 주석이 조용히 낡음(기능은 정상 통과) | `impl-anchor-existence.test.ts:108-112` | 저위험 후속 정리(선택) |
| 8 | 테스트 | `latencyMs` 재도입을 막는 장치가 코드 주석뿐 — `assertMatchesContract`는 "선언됐지만 응답에 없는 optional 키" 방향은 원리적으로 못 잡음(PR 스스로 인지·문서화) | `model-config-response.dto.ts:53-56`, `integration-response.dto.ts:460-462` | 우선순위 낮음, 여유 시 정적 grep 가드 백로그 검토 |
| 9 | 테스트 | `FieldTable` 축 정규식이 줄 단위 스캔이라 향후 `<FieldTable>` 행이 여러 줄로 쪼개지면 조용히 놓칠 수 있음(오늘 코퍼스는 전부 한 줄 스타일이라 실질 위험 낮음) | `guide-error-code-scan.ts`(`scanErrorCodeCitations`) | 우선순위 낮음, 합성 대조군 케이스 추가 고려 |
| 10 | 문서/스펙 | `spec/5-system/7-llm-client.md §8.3`이 `testConnection` 실패 shape을 아직 문서화하지 않음(이번 결함의 spec 층 근본 원인) — developer 권한 밖이라 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 정확히 planner 위임 등재됨 | `spec/5-system/7-llm-client.md §8.3` | 조치 불요(이미 추적 중), `--impl-done` 재부상 시 기지 gap으로 인지 |
| 11 | 문서/스펙 | `spec/5-system/3-error-handling.md §1` 카탈로그 누락 및 `spec/conventions/user-guide-evidence.md §2.1` 관계표에 신규 가드 미등재 — 동일하게 planner 위임 완료 | 해당 spec 파일 | 조치 불요(이미 추적 중) |
| 12 | 유저가이드 동기화 | 이번에 정확해진 에러 코드들(`HTTP_TRANSPORT_FAILED` 등)이 `backend-labels.ts`의 `ERROR_KO`에 매핑 안 돼 실제 발생 시 영문 노출 — 단 이 코드들은 이번 PR 이전부터 존재했고(신규 발행 아님) 별도 트래커(`#1328`)로 명시적으로 분리돼 스코프 밖 | `codebase/frontend/src/lib/i18n/backend-labels.ts`(미변경) | 조치 불요(별도 트래커 추적 중, 우선순위 판단 시 참고) |
| 13 | 의존성 | `package.json`/lockfile 변경 없음, 신규 TS 파일의 모든 import는 기존 설치·존재 패키지/내부 모듈 재사용 확인 | 전역 | 조치 불요 |
| 14 | 부작용 | `LlmService.testConnection` 반환 필드 rename의 유일한 프로덕션 호출부(controller)는 순수 위임이며 프런트엔드는 이미 `result.message`를 읽고 있어 blast radius가 문서화된 대로 좁게 닫혀 있음 | `llm-model-config.controller.ts:115`, `model-config-manager.tsx:82` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정보 유출 경로 없음 확인(sanitize 매핑 8갈래 고정 문구) |
| performance | NONE | 신규 가드 선형 스캔, 현재 규모에서 문제 없음 |
| architecture | LOW | 계약 강제 배선은 긍정적이나 문서 내용 정확성 검사는 여전히 무방비(WARNING #1) |
| requirement | NONE | 핵심 결함 해소 확인(66/66·26/26 GREEN), spec 갭은 정당하게 planner 위임 |
| scope | LOW | sibling DTO 필드 제거가 원 트래커보다 넓은 도메인까지 번짐(고지됨) |
| side_effect | LOW | 필드 rename·DTO 필드 제거 blast radius 좁게 닫힘 확인 |
| maintainability | LOW | 시그니처 내 주석 배치, 파라미터 오명명 2건(WARNING #4,#5) |
| testing | LOW | UI 렌더링 지점 실패 경로 테스트 공백(WARNING #2) |
| documentation | NONE | spec 갭은 정당하게 planner 트래커 위임, ko/en 동기화 확인 |
| dependency | NONE | 신규 외부 의존성 없음 |
| database | NONE | 해당 없음(DB 관련 코드 변경 없음) |
| concurrency | NONE | 해당 없음(동시성 표면 변경 없음) |
| api_contract | LOW | 형제 엔드포인트 DTO에 동일 클래스 결함 잔존(WARNING #3) |
| user_guide_sync | NONE | 동반 갱신 누락 0건, 스코프 밖 항목은 이미 트래커 분리 |

## 발견 없는 에이전트

- database — 검토 대상에 DB 관련 코드(엔티티/마이그레이션/쿼리/트랜잭션) 없음
- concurrency — 검토 대상에 동시성 표면(공유 상태/락/비동기 흐름 변경) 없음

## 권장 조치사항

1. `model-config-manager.test.tsx`에 실패 경로(`success:false`) 케이스를 추가해 `toast.error`가 `result.message`를 포함해 호출됨을 단언한다 — 이번 PR의 회귀 방지 체인에서 유일하게 비어 있는 마지막 층(WARNING #2).
2. `sanitize-error.util.ts`의 8개 실패 문장을 export 하고 신규 가드가 `models.mdx` 표 문장과 대조하도록 확장하거나, 후속 plan 항목으로 명시 등재한다(WARNING #1).
3. 형제 엔드포인트 `/api/integrations/:id/test`의 `TestConnectionResultDto`에 `code` 필드 선언 추가 + `assertMatchesContract` 배선을 후속 plan 백로그에 등재한다(WARNING #3, 블로킹 아님).
4. `llm.service.ts`의 시그니처 중간 주석을 JSDoc으로 이동하고, `collectBackendTokens`의 파라미터명을 `fileTexts`로 정정한다(WARNING #4, #5) — 저비용 가독성 개선.
5. (저위험, 선택) `impl-anchor-existence.test.ts`의 낡은 주석 정리, `FieldTable` 여러 줄 리터럴 대조군 케이스 추가.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행. `forced`(router_safety) 명단(`documentation, maintainability, requirement, scope, security, side_effect, testing`)이 함께 고지됐으며 **forced 전원 결과 확보 확인됨** — 강제 화이트리스트 미이행 없음. `skipped`(router 제외) 없음.