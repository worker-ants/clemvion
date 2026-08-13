# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- `--impl-done`, target=`spec/5-system/`, diff-base=`origin/main`.
- `git diff origin/main...HEAD --stat -- spec/5-system/` 결과 **0건** — 본 diff 는 `spec/5-system/` 하위 어떤 파일도 변경하지 않는다. 프롬프트에 완전 포함된 `spec/5-system/1-auth.md` 는 기존(변경 전) 본문 그대로이며, 이번 diff 가 새로 도입한 identifier 는 없다.
- 실제 diff(`git diff origin/main...HEAD --stat`, working tree = `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)는 코드 전용 버그 수정이다:
  - `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 유틸)
  - `codebase/backend/src/modules/auth/auth-oauth.service.ts` (OAuth 콜백 소셜 로그인 상시 실패 수정)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`UPDATE ... RETURNING` 튜플 처리 수정)
  - 관련 `*.spec.ts`/`test/auth-oauth-callback.e2e-spec.ts`, `plan/in-progress/*.md`, `review/**` 갱신

## 발견사항 (신규 식별자 충돌 관점)

- **[INFO]** 신규 유틸 함수 `updateReturningRows` — 충돌 없음, 명명 정합 확인
  - target 신규 식별자: `updateReturningRows(result, detail)` (`codebase/backend/src/common/utils/update-returning-rows.ts:36`, 신규 파일)
  - 기존 사용처: 없음 — `grep -rn "updateReturningRows"` 결과 정의 1건 + 호출부(`execution-engine.service.ts`, `auth-oauth.service.ts`, `knowledge-base.service.ts`)뿐, 타 도메인에서 동명 심벌·타입·export 재사용 없음.
  - 상세: 자매 헬퍼 `assertRowArray`(`common/utils/assert-row-array.ts`, SELECT 결과 방어용)와 역할이 명확히 분리된다 — `updateReturningRows` 는 UPDATE/DELETE `RETURNING` 의 `[rows, rowCount]` 튜플 처리 전담. 두 헬퍼 명은 접두사(`assert-`/`update-`)와 대상(행 배열 검증/튜플 언랩)이 달라 혼동 소지가 낮다. `detail` 파라미터 필수화도 `assertRowArray` 의 기존 계약과 의도적으로 정렬돼 있다.
  - 제안: 조치 불필요. 향후 세 번째 "raw query 결과 언랩" 헬퍼가 추가될 경우 `update-returning-rows.ts` 파일 내 docstring 표(agent-memory-admin 의 `deletedRowCount`, stuck-document-recovery 구조분해, integration-oauth 명시 타입)에 그대로 등재해 분산을 계속 억제할 것.
- **[INFO]** `E2E_BASE_URL` 재사용 확인 — 신규 아님
  - target 신규 식별자로 보일 수 있는 요소: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` 의 `process.env.E2E_BASE_URL`
  - 기존 사용처: `codebase/backend/test/*.e2e-spec.ts` 전역에서 동일 패턴 10+ 건(`integration-cafe24-precheck.e2e-spec.ts` 등) 이미 사용 중.
  - 상세: 신규 식별자가 아니라 기존 e2e 관례를 그대로 재사용한 것. 충돌 없음.
- **엔티티/타입, API endpoint, 이벤트/큐 이름, 환경변수·config key, spec 파일 경로** — 이번 diff 는 이 다섯 축에서 **신규 도입이 전무**하다. 신규 REST endpoint·DTO·엔티티·webhook/queue/SSE 이벤트명·`registerAs` config 키·`process.env.*` 신규 변수·신규 `spec/**.md` 파일이 diff 안에 없음을 각각 grep 으로 확인(`@Post|@Get|@Put|@Patch|@Delete`, `process.env.`, `registerAs`, `new Queue`, `EventEmitter`, `export (class|interface|enum)` 패턴 매치 0건, `E2E_BASE_URL` 1건은 위에서 기존 사용으로 판명).
- 신규 plan 파일 `plan/in-progress/update-returning-tuple-shape.md` 도 `plan/` 기존 목록과 이름 충돌 없음(신규 슬러그, 유일).

## 요약

이번 diff 는 `spec/5-system/` 문서 자체를 변경하지 않는 순수 코드 버그 수정(TypeORM `UPDATE/DELETE RETURNING` 튜플 처리 오류로 인한 OAuth 소셜 로그인 상시 실패 수정)이며, 신규 도입 식별자는 내부 유틸 함수 `updateReturningRows` 하나뿐이다. 이 함수는 기존 자매 헬퍼 `assertRowArray` 와 이름·역할이 명확히 구분되고 타 영역에서 동명 심벌이 없어 요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로 어느 축에서도 충돌이 발견되지 않았다.

## 위험도

NONE
