# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 적재 완료. rows[] 19개 항목 색인.

## 변경 파일 목록

이번 커밋(`de8ebff`)의 변경 파일:

1. `codebase/backend/src/common/cors/web-chat-cors.ts` — `CorsOptionsLike` 인터페이스에 `exposedHeaders?: string[]` 필드 추가
2. `codebase/backend/src/main.ts` — CORS defaultOptions 에 `exposedHeaders: ['X-Deleted-Count']` 추가
3. `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts` — flat-array DELETE 방어 분기 테스트 추가
4. `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` — 미사용 `logger` 필드·import 제거
5. `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/memory-list-panel.test.tsx` — 신규 테스트 파일
6. `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/scope-list-panel.test.tsx` — 신규 테스트 파일
7. `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` — listScopes/listMemories 테스트 추가
8. `review/code/2026/06/27/23_02_30/RESOLUTION.md` — 리뷰 산출물
9. `review/code/2026/06/27/23_02_30/SUMMARY.md` — 리뷰 산출물
10. `review/code/2026/06/27/23_02_30/_retry_state.json` — 리뷰 산출물
11. `review/code/2026/06/27/23_02_30/api_contract.md` — 리뷰 산출물
12. `review/code/2026/06/27/23_02_30/architecture.md` — 리뷰 산출물

## trigger 매칭 결과

각 매트릭스 행 대상 매칭 검사:

| 행 id | trigger | 매칭 여부 | 판단 근거 |
|-------|---------|-----------|-----------|
| new-node | `codebase/backend/src/nodes/**` | 미매칭 | 변경 파일 중 `src/nodes/` 경로 없음 |
| node-schema-change | `codebase/backend/src/nodes/**` | 미매칭 | 동상 |
| new-ui-string | semantic (TSX 한국어 리터럴) | 미매칭 | TSX 파일 2개(`memory-list-panel.test.tsx`, `scope-list-panel.test.tsx`)는 `__tests__/` 하위 테스트 파일이며, Korean 문자열은 `vi.mock("@/lib/i18n")` 으로 실제 ko dict 를 로드해 i18n 키 결과를 assertion 하는 구조임 — 프로덕션 UI 에 새 한국어 리터럴을 하드코딩한 경우가 아님 |
| integration-provider-change | semantic | 미매칭 | 신규 통합/제공자 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 미매칭 | docs 디렉토리 신규 생성 없음 |
| backend-api-change | semantic (controller/dto) | 미매칭 | `cors/web-chat-cors.ts`·`main.ts` 는 CORS 인프라 설정이며 REST API surface(URL/메서드/요청응답 스키마) 변경 없음; Swagger jsdoc·user-guide 갱신 불필요 |
| new-warning-code | semantic | 미매칭 | 신규 warningCode 없음 |
| new-error-code | `codebase/backend/src/nodes/core/error-codes.ts` | 미매칭 | 해당 파일 미변경 |
| new-cross-cutting-enum | semantic | 미매칭 | 신규 enum 값 없음 |
| new-backend-ui-zod-value | semantic | 미매칭 | 신규 zod ui.label/hint 없음 |
| new-handler-output-field | semantic | 미매칭 | 핸들러 output field 변경 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` / semantic | 미매칭 | 변경 파일이 `cors/` 및 `agent-memory/` 모듈 — auth 모듈 미변경 |
| auth-config-type-enum-change | semantic | 미매칭 | AuthConfig 타입 enum 미변경 |
| expression-language-change | `codebase/packages/expression-engine/**` | 미매칭 | 해당 경로 미변경 |
| run-debug-flow-change | semantic | 미매칭 | 실행 엔진·디버그 로깅 변경 없음 |
| env-runtime-change | semantic | 미매칭 | `main.ts` 변경이 있으나, 변경 내용은 기존 CORS 설정 객체에 `exposedHeaders` 키 추가뿐 — 신규 환경 변수·기동 방법·런타임 변경에 해당하지 않으며 README.md 갱신 대상 아님 |
| spec-major-change | `spec/2-*/**` 등 | 미매칭 | spec 파일 미변경 (S1 spec back-flow 는 이전 커밋에 포함) |
| userguide-gui-flow-section | semantic (docs MDX) | 미매칭 | docs MDX 파일 미변경 |
| spec-defect-found | semantic | 해당 없음 | |

## 발견사항

없음.

이번 변경 set 은 매트릭스 19개 trigger 중 어느 것에도 매칭되지 않는다. 변경의 성격은 (1) CORS `exposedHeaders` 인프라 버그픽스, (2) 서비스 dead code 제거, (3) 테스트 파일 신규 추가, (4) 리뷰 산출물 커밋이며, 유저 가이드 MDX·i18n dict·backend-labels 동반 갱신이 필요한 변경 유형에 해당하지 않는다.

참고: 이전 리뷰 세션의 SUMMARY.md 에도 `user_guide_sync skip(무관)` 으로 router 가 명시적으로 skip 판정한 바 있다.

## 요약

매트릭스 19개 trigger 검사, 매칭된 trigger 0개, 누락된 동반 갱신 0건. 변경 파일 전체가 CORS 인프라 픽스·테스트·리뷰 산출물로 구성되어 있으며 유저 가이드·i18n·backend-labels 동반 갱신이 필요한 trigger 에 매칭되는 파일이 없다. 해당 없음.

## 위험도

NONE
