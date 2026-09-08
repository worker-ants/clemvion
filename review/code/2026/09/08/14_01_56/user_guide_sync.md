# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 change_type) Read 완료 + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L141-169) 본문 대조 완료. 두 SoT 는 행 집합이 1:1 로 일치한다.

## 변경 file 목록 확인
`git diff --name-only origin/main HEAD` 로 실측 — prompt 의 25개 실 코드/문서 파일 + review/consistency 산출물(57개, 비-코드)과 정확히 일치. 추가 stray 변경 없음.

실 코드/문서 25개:
1. `.claude/test-stages.sh` — typecheck ratchet 을 `build` 단계로 이동
2. `CHANGELOG.md` — Unreleased 항목 추가 (release note, doc-sync-matrix 대상 아님)
3. `PROJECT.md` — ratchet 이동 안내 문구 (매트릭스 본문 자체는 미변경 — §변경 유형 매핑 섹션은 그대로)
4. `codebase/backend/src/common/__test-utils__/source-scan.ts` — `enclosingScopeName` AST 헬퍼 승격 (테스트 인프라 내부)
5. `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` — 주석 정정
6-7. `codebase/backend/src/common/filters/http-exception.filter.{ts,spec.ts}` — `isPostgresUniqueViolation` 로 unique-violation 판정 폭 확대(raw 표면 포함), 회귀 테스트 추가. **기존** `RESOURCE_CONFLICT`/`INTERNAL_ERROR` 코드로 가는 조건만 넓어졌다 — 신규 코드 발행 아님
8. `codebase/backend/src/modules/integrations/__test-utils__/oauth-config-mock.ts` — 주석 정정
9-11. `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts`, `integration-oauth.service.ts` — `pgErrorConstraint()` 공용 헬퍼로 constraint 추출 통합 + wrap 표면 테스트 보강. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`/`MAKESHOP_ALREADY_CONNECTED` 등 사용자 노출 에러 코드·설정 항목 불변
12. `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명(내부 타입, wire 계약 불변)
13-14. `codebase/backend/src/modules/workspaces/workspaces.service.{spec.ts,ts}` — `listMembers` 를 JS 매핑에서 DB `select` 투영으로 전환(응답 6키 wire 계약 불변, 보안 강화)
15-20. `codebase/backend/src/repo-guards/__tests__/**` (신규 fixture 1개 포함) — 구조 가드 테스트 파라미터화·픽스처 신설(순수 테스트 인프라, `src/nodes/**` 밖)
21. `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 트리거 endpointPath 409 e2e 케이스 추가. `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 는 `triggers.controller.ts`/`triggers.service.ts` 에 이미 존재하는 계약(§1.10) — 이번 diff 로 신규 발행된 코드가 아니라 기존 계약의 e2e 커버리지 보강
22. `codebase/backend/tsconfig.build.json` — `**/__test-utils__/**` exclude 추가 (빌드 설정)
23. `codebase/frontend/src/lib/api/workflows.ts` — JSDoc 갱신(백엔드 타입 개명 반영), 인터페이스 필드·런타임 문자열 변경 없음
24-25. `plan/in-progress/*.md` — 트래커 갱신

## trigger 매칭 검토
매트릭스 21개 행을 전수 대조했다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 변경 set 에 해당 glob 매칭 파일 없음. 매칭 없음.
- **신규 UI 문자열 (TSX)** (`codebase/frontend/src/**/*.tsx`) — frontend 변경은 `workflows.ts` 1개뿐이고 `.tsx` 아님, 내용도 JSDoc 뿐(런타임 리터럴 없음). 매칭 없음.
- **신규 위젯 chrome 문자열** — `codebase/channel-web-chat/**` 변경 없음. 매칭 없음.
- **통합 신규/제공자 변경** (semantic) — cafe24·makeshop 파일이 걸렸으나, 내용은 이미 존재하던 constraint 추출 로직을 공용 헬퍼로 옮기고 **테스트 커버리지만 wrap 표면까지 확장**한 것. 사용자 노출 동작·설정 항목·에러 코드 매핑에 변화 없음 — provider 변경이 아닌 내부 리팩터로 판단. 매칭 없음.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 변경 없음. 매칭 없음.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 해당 glob 매칭 파일 없음(filter/서비스/repo-guard 만 변경). 매칭 없음.
- **신규 BullMQ 큐** — `system-status.constants.ts` 변경 없음. 매칭 없음.
- **신규 warningCode 발행** — backend `warningRules` 변경 없음. 매칭 없음.
- **신규 errorCode 발행** (`codebase/backend/src/nodes/core/error-codes.ts`) — 해당 파일 변경 없음. `RESOURCE_CONFLICT`/`INTERNAL_ERROR`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 모두 기존 코드이고, 이번 diff 는 그 코드로 가는 **조건**을 넓힌 것이지 신규 코드 도입이 아니다 (`backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 갱신 불필요). 매칭 없음.
- **신규 cross-cutting enum / backend zod ui.label 등 / handler output field** — 해당 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 변경 파일 없음. `workspaces.service.ts`(멤버 목록 투영)는 `modules/workspaces/`이지 `modules/auth/`가 아니고, 권한 판정 로직 자체는 건드리지 않았다(DB select 투영은 방어 심화이지 인가 흐름 변경이 아니다). `http-exception.filter.ts` 는 `common/filters/`로 예외 매핑 로직이지 인증·세션 로직이 아니다. 매칭 없음.
- **AuthConfig type enum 변경** — 해당 없음.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 해당 없음.
- **실행·디버깅 흐름 변경** — 해당 없음(예외 필터·워크스페이스 서비스·트리거 e2e 는 실행 엔진/디버그 로깅이 아니다).
- **환경 변수·기동 방법·런타임 변경** — `test-stages.sh`/`tsconfig.build.json` 은 CI/로컬 검증 파이프라인 변경이지 제품의 환경 변수·기동 방법·런타임이 아니다. 매칭 없음.
- **spec 신규/대규모 변경** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — `spec/` 하위 파일 변경 없음.
- **user-guide GUI 흐름 절 신규/변경** — `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음.
- **spec 자체 결함 발견** — 해당 없음.

## 결론
매트릭스 21개 trigger 중 어느 것도 이번 변경 set 과 매칭되지 않는다. 이번 배치는 (1) 전역 예외 필터의 unique-violation 판정 범위 확장(raw 표면 → 기존 `RESOURCE_CONFLICT` 코드), (2) `listMembers` DB 레벨 `select` 투영 전환(wire 계약 불변, 보안 강화), (3) `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 내부 개명, (4) repo-guard AST 헬퍼 통합·테스트 파라미터화·`__test-utils__` 빌드 exclude·typecheck ratchet 스테이지 재배치 등 **순수 backend 내부 견고화 + 테스트/빌드 인프라** 변경이며, 노드·i18n dict·backend-labels·docs MDX·auth 흐름·표현식 언어·신규 섹션·신규 warning/error 코드 발행 중 어느 축도 건드리지 않는다. `CHANGELOG.md`(릴리스 노트)는 이미 이번 변경 set 안에서 갱신되어 있으나 이는 doc-sync-matrix 대상(유저 가이드/i18n dict)이 아니다. 직전 라운드(`review/code/2026/09/08/13_34_28/user_guide_sync.md`)의 판정과 일치하며, 이번 라운드에 추가된 파일(신규 fixture, `enclosingScopeName` 승격, plan 트래커 갱신)도 같은 결론을 바꾸지 않는다.

## 요약
매트릭스 21개 trigger 전수 대조 결과 매칭 0건 — 이번 변경 set 은 backend 내부 에러 처리/DB 투영/테스트 인프라 리팩터로, 노드·i18n·docs·auth·표현식·신규 코드 발행 등 유저 가이드 동반 갱신 대상 어느 표면도 건드리지 않는다. 동반 갱신 누락 없음.

## 위험도
NONE
