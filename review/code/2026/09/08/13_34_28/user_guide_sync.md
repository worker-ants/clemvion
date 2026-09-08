# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L141-198) 본문 확인 완료.

## 변경 file 목록 (25개 실 코드/문서, 나머지는 review/consistency 산출물)
1. `.claude/test-stages.sh` — typecheck ratchet 을 build 단계로 이동
2. `CHANGELOG.md` — Unreleased 항목 추가
3. `PROJECT.md` — ratchet 이동 안내 문구
4-5. `codebase/backend/src/common/filters/http-exception.filter.{ts,spec.ts}` — `isPostgresUniqueViolation` 로 unique-violation 판정 폭 확대(raw 표면 포함), 회귀 테스트 추가
6-8. `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts`, `integration-oauth.service.ts` — `pgErrorConstraint()` 공용 헬퍼로 constraint 추출 통합 + wrap 표면 테스트 보강
9. `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명(내부 타입, wire 불변)
10-11. `codebase/backend/src/modules/workspaces/workspaces.service.{ts,spec.ts}` — `listMembers` 를 JS 매핑에서 DB `select` 투영으로 전환(응답 6키 wire 계약 불변)
12-16. `codebase/backend/src/repo-guards/__tests__/**` — 가드 테스트 파라미터화·픽스처 신설(순수 테스트 인프라)
17. `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 트리거 endpointPath 409 e2e 케이스 추가(§1.10 계약 고정, 신규 계약 아님)
18. `codebase/backend/tsconfig.build.json` — `__test-utils__/**` exclude 추가
19. `codebase/frontend/src/lib/api/workflows.ts` — JSDoc 갱신(백엔드 개명 반영), 필드/타입 변경 없음
20-21. `plan/in-progress/**.md` — 트래커 갱신
22-51. `review/code/**`, `review/consistency/**` — 리뷰/일관성 산출물(비-코드)

## trigger 매칭 검토
매트릭스 21개 행을 전수 대조했다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 변경 set 에 해당 경로 파일 없음. 매칭 없음.
- **신규 UI 문자열 (TSX)** — frontend 변경은 `workflows.ts` 1개뿐이고 `.tsx` 가 아니며 내용도 JSDoc 뿐(런타임 문자열 없음). 매칭 없음.
- **신규 위젯 chrome 문자열** — `channel-web-chat` 변경 없음. 매칭 없음.
- **통합 신규/제공자 변경** (semantic) — cafe24·makeshop 관련 파일이 걸렸으나, 변경 내용은 이미 존재하던 constraint 추출 로직(`flat ?? driverError`)을 공용 헬퍼 `pgErrorConstraint()` 로 옮기고 **테스트 커버리지만 wrap 표면까지 확장**한 것이다. 사용자 노출 동작·필드·설정 항목·에러 코드 매핑(`ALREADY_CONNECTED_BY_SERVICE`)에 변화가 없다. "제공자 변경" 이 아니라 내부 헬퍼 리팩터 + 회귀 테스트로 판단 — grey-zone 이지만 **문서 갱신을 요하는 사용자 가시 변경은 없음**.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/` 변경 없음. 매칭 없음.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 해당 파일 없음(filter/서비스/repo-guard 만 변경). 매칭 없음.
- **신규 BullMQ 큐** — `system-status.constants.ts` 변경 없음. 매칭 없음.
- **신규 warningCode / errorCode** — `error-codes.ts`·`warningRules` 변경 없음. `RESOURCE_CONFLICT` 는 기존 상태코드 기본 에러 코드(`error-response.dto.ts` 에 이미 정의)이고 이번 변경은 그 코드로 **가는 조건을 넓힌 것**이지 새 코드 발행이 아님. 매칭 없음.
- **신규 cross-cutting enum / backend zod ui.label 등 / handler output field** — 해당 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 변경 파일 없음. `workspaces.service.ts`(멤버 목록 투영)는 `modules/workspaces/` 이지 `modules/auth/` 가 아니고, 권한 판정 로직도 건드리지 않았다(투영은 방어 심화이지 인가 흐름 변경이 아님). 매칭 없음.
- **AuthConfig type enum 변경** — 해당 없음.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 해당 없음.
- **실행·디버깅 흐름 변경** — 해당 없음(에러 필터·워크스페이스 서비스는 실행 엔진이 아님).
- **환경 변수·런타임 변경** — 해당 없음.
- **spec 신규/대규모 변경** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — `spec/` 하위 파일 변경 없음.
- **user-guide GUI 흐름 절 신규/변경** — `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음.

## 결론
매트릭스 21개 trigger 중 어느 것도 이번 변경 set 과 매칭되지 않는다. 이번 PR 은 (1) 전역 예외 필터의 unique-violation 판정 범위 확장(raw 표면 → 409, 이미 존재하는 `RESOURCE_CONFLICT` 코드로), (2) `listMembers`/`WorkflowVersionDetail` 의 내부 방어·명명 개선(wire 계약 불변), (3) repo-guard 테스트 파라미터화·typecheck ratchet 스테이지 재배치 등 **순수 backend 내부 견고화 + 테스트/빌드 인프라** 변경이며, 노드·i18n dict·backend-labels·docs MDX·auth 흐름·표현식 언어·신규 섹션·신규 코드 발행 중 어느 축도 건드리지 않는다. `CHANGELOG.md`(릴리스 노트)는 이미 이번 변경 set 안에서 갱신되어 있으나 이는 doc-sync-matrix 대상(유저 가이드/사전)이 아니다.

## 요약
매트릭스 trigger 21개 전수 대조 결과 매칭 0건 — 이번 변경 set 은 backend 내부 에러 처리/DB 투영/테스트 인프라 리팩터로, 노드·i18n·docs·auth·표현식·신규 코드 발행 등 유저 가이드 동반 갱신 대상 어느 표면도 건드리지 않는다. 동반 갱신 누락 없음.

## 위험도
NONE
