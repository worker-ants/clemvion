# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음.

## 검토 근거

1. **매트릭스 적재** — `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.
2. **변경 파일 식별** — orchestrator prompt 의 110개 파일 목록을 전수 확인하고, `git diff --stat origin/main...HEAD` (110 files changed) 로 대조해 누락된 파일이 없음을 확인. 실제 코드 변경은 다음 12개 `codebase/**` 파일에 집중:
   - `codebase/backend/src/common/filters/http-exception.filter.ts` (+`.spec.ts`) — 전역 예외 필터가 로컬 `isUniqueViolation` 대신 SoT `isPostgresUniqueViolation` 사용
   - `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (+ cafe24/makeshop `.spec.ts`, `oauth-config-mock.ts`) — `pgErrorConstraint()` 헬퍼로 중복 constraint 추출 로직 통합
   - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 타입 `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명(내부 식별자만)
   - `codebase/backend/src/modules/workspaces/workspaces.service.ts` (+`.spec.ts`) — `listMembers` 를 JS 매핑에서 DB `select` 투영으로 전환(응답 wire 계약 불변)
   - `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 409 충돌 e2e 케이스 추가
   - `codebase/backend/tsconfig.build.json` — `__test-utils__` exclude 글로브 추가
   - `codebase/frontend/src/lib/api/workflows.ts` — JSDoc 주석만 갱신(코드 변경 없음)
   - 그 외 `codebase/backend/src/repo-guards/__tests__/**`, `codebase/backend/src/common/__test-utils__/**` — 테스트/가드 전용 파일
3. **trigger 매칭** — 위 12개 파일을 매트릭스 21개 행의 `trigger.globs`/semantic 판단 기준과 전수 대조:
   - **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 파일 없음 (`src/nodes/` 하위 변경 0건)
   - **신규 UI 문자열** (`codebase/frontend/src/**/*.tsx`) — 매칭 파일 없음. 이번 diff 의 유일한 frontend 파일(`workflows.ts`)은 `.ts`(JSDoc-only)이며 `.tsx`도 아니고 신규 리터럴도 없음
   - **통합/제공자 변경** (semantic) — `integration-oauth.service.ts`/cafe24·makeshop `.spec.ts` 가 표면적으로는 이 카테고리에 속할 수 있으나, 실제 변경은 이미 존재하던 `ALREADY_CONNECTED_BY_SERVICE`/`STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 충돌 처리 로직에서 constraint 추출 부분을 `pgErrorConstraint()` 공용 헬퍼로 옮긴 **순수 내부 리팩터**다. 신규 provider, 신규 필드, 사용자 설정 흐름 변경이 전혀 없어 `06-integrations-and-config/<provider>.mdx` 갱신 대상이 아님
   - **유저 가이드 신규 섹션 디렉토리** (`content/docs/*/`) — 매칭 파일 없음
   - **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 매칭 파일 없음 (`modules/auth/` 하위 변경 0건; `plan/in-progress/auth-guard-reflection-hardening.md` 는 plan 문서일 뿐 `modules/auth/` 코드 변경이 아님)
   - **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 파일 없음
   - **실행·디버깅 흐름 변경** (semantic, `05-run-and-debug/` 대상) — `http-exception.filter.ts` 변경은 워크플로 실행 엔진/디버그 로깅이 아니라 HTTP 계층의 unique-violation 상태 코드 매핑을 두 원시 표면(`err.code`/`err.driverError.code`) 모두로 넓히는 크로스커팅 예외 필터 수정이다. 실측 blast radius ~0(요청 경로에 raw query 없음, `plan/in-progress/spec-followups-batch-b.md` B-3 명시)이고 워크플로 실행·디버그 패널의 사용자 가시 동작에 영향 없어 05-run-and-debug 대상이 아님
   - **신규 warning/error code 발행** (`error-codes.ts`/warningRules) — 매칭 파일 없음. `RESOURCE_CONFLICT`는 기존 에러 코드이며 이번 diff 는 그 코드가 적용되는 원시 표면 범위만 넓혔을 뿐 신규 코드를 추가하지 않음
   - **백엔드 API 변경** (`*.controller.ts`, `dto/**`) — 매칭 파일 없음
   - 나머지 행(신규 BullMQ 큐, cross-cutting enum, backend ui zod 값, handler output field, AuthConfig enum, env/런타임, spec 대규모 변경, GUI 흐름 절)도 모두 매칭 파일 없음
4. 남은 변경(`.claude/test-stages.sh`, `PROJECT.md`, `CHANGELOG.md`, `scripts/check-{backend,frontend}-typecheck-ratchet.py`, `plan/**`, `review/**`)은 하네스·CI ratchet·plan 추적·리뷰 산출물이며 매트릭스의 어떤 trigger 대상도 아님.

## 요약

매트릭스 21개 행 전수를 이번 diff 의 110개 변경 파일(코드 실질 변경은 `codebase/**` 12개)과 대조한 결과, 어떤 trigger 에도 매칭되지 않았다 — 노드 추가/schema 변경 없음, 신규 `.tsx` UI 문자열 없음, docs/i18n/backend-labels 대상 provider 변경 없음(순수 내부 constraint-추출 리팩터), 신규 섹션 디렉토리 없음, `modules/auth/**` 변경 없음, expression-engine 변경 없음, 신규 warning/error code 없음. 이번 배치는 전역 예외 필터의 unique-violation 판정 확장, `listMembers` DB 투영 전환, 타입 개명, 관련 회귀 테스트 추가로 구성된 순수 backend 내부 정합성/방어 강화 작업이라 유저 가이드 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
