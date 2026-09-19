# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 리팩토링 중 orphan(주인 없는) JSDoc 코멘트가 남았다 — `SSRF_BLOCKED_CLIENT_MESSAGE` 를 `http-safety.ts` 로 옮기면서 그 상수를 설명하던 원래 doc-comment 블록을 지우지 않고 그대로 남김
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:29-37` (Read 로 직접 확인 — 파일 상단 `const logger = new Logger(...)` 바로 아래, 다음 함수 `buildHttpCredentials`/`function` 앞의 doc-comment 블록. 프롬프트 diff 게이트로는 해당 hunk `@@ -33,7 +35,6 @@` 부근, 컨텍스트로 남은 3줄 + 그 아래 빈 줄)
  - 상세: 이 PR 은 `SSRF_BLOCKED_CLIENT_MESSAGE` 상수 선언을 `http-request.handler.ts` 에서 `http-request/http-safety.ts` 로 옮겼다(파일 14 diff, `export const SSRF_BLOCKED_CLIENT_MESSAGE = ...`). 그런데 그 상수를 설명하던 6줄짜리 원래 doc-comment(CWE-209 근거, `IntegrationUsageLog`/Activity API 노출 경로, DB·Email 문구와의 대칭 설명)는 `http-request.handler.ts` 에 그대로 남아 있고, 바로 아래에는 빈 줄 하나를 사이에 두고 전혀 다른 함수(`Strip URL-borne credentials...`)의 doc-comment 가 이어진다. 즉 지금 그 6줄은 **어떤 선언에도 붙지 않은 죽은 주석**이다. 반면 `http-safety.ts` 로 옮겨간 상수에는 훨씬 짧은 2줄짜리 새 doc-comment 가 붙어, CWE-209·Activity API 노출 근거 같은 상세 배경이 새 위치로 이관되지 않고 유실됐다. 같은 커밋에서 다뤄진 `database-query.handler.ts` → `database-connection.ts` 추출(`buildPgConnection`/`buildMysqlSsl`)은 함수와 그 안의 인라인 주석을 통째로 옮겨 이런 문제가 없다 — 이 파일만 누락된 사례다.
  - 제안: `http-request.handler.ts:29-37` 의 orphan 블록을 삭제하거나, 그 상세 근거(CWE-209·Activity API 노출·DB/Email 대칭)를 `http-safety.ts` 의 `SSRF_BLOCKED_CLIENT_MESSAGE` doc-comment 로 병합해 옮긴다.

## 요약

전체 diff(38개 파일, 커밋 5개 분량)는 "Database·HTTP 연결 테스터 구현"이라는 단일 의도에 매우 밀착돼 있다. 노드 핸들러에서 `DbCredentials`/`buildPgConnection`/`buildMysqlSsl`/`HttpCredentials`/`resolveHttpCredentials`/`SSRF_BLOCKED_CLIENT_MESSAGE`/`clampMessage` 를 의존성 없는 공유 모듈로 빼낸 것은 "핸들러가 `IntegrationsService` 를 import 하므로 서비스가 핸들러를 가져오면 순환 import" 라는 명시적 근거가 있는 목적 지향 리팩토링이고, 실제로 `database-query.handler.ts` 쪽은 함수 본문·인라인 주석까지 원자 단위로 그대로 이동해 부작용이 없다. DTO(`PreviewTestResultDto.code`), 컨트롤러 API 문서, 영향받은 e2e fixture(`integration-cache-invalidate.e2e-spec.ts`), 사용자 가이드(ko/en 동시 갱신), `plan/in-progress/**`·`review/consistency/**` 산출물은 모두 이 프로젝트의 SDD 워크플로(spec 선행 커밋 → impl-prep 컨시스턴시 체크 → 구현 → 가이드)가 요구하는 정상 부산물이며, 요청 범위를 벗어난 기능 추가나 무관한 파일 수정은 발견되지 않았다. 유일한 흠은 `http-request.handler.ts` 에서 이관 대상 상수의 doc-comment 를 함께 옮기지 못해 죽은 주석이 남은 것으로, 이는 스코프 이탈이라기보다 리팩토링 완결성의 국소적 누락이다. 참고로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 대한 워킹트리 미커밋 수정(트래커 체크박스 반영 + 신규 발견 5건 등재)이 존재하나, 이는 이 PR 의 체크리스트에 명시된 "트래커 반영" 마무리 단계이고 프로젝트 관례상 리뷰 뒤 plan-only 커밋으로 뒤따르는 것이 정상 순서라 스코프 위반으로 보지 않는다.

## 위험도
LOW
