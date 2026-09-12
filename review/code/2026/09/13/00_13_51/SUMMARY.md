# Code Review 통합 보고서

## 전체 위험도
**LOW** — keyset 커서(`login-history`/`background-runs`)의 `id`/`i` 성분에 `isUuidShaped` 형태 검증을 추가해 Postgres SQLSTATE 22P02→500 마스킹을 막는 좁은 스코프의 방어적 수정. SQL 인젝션·스키마·동시성·의존성 관점의 신규 리스크는 없다(14개 reviewer 중 6개 NONE, 나머지 8개 LOW, CRITICAL/HIGH 없음). 강제 포함(router_safety) 대상 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `background-runs.service.ts`의 `getBackgroundRun`은 신규 UUID 검증이 포함된 `decodeCursor`가 `verifyExecutionAccess`(워크스페이스 소유권 검사)보다 먼저 실행된다. 이 diff 이후 "cross-workspace + 잘못된 커서" 조합의 응답이 기존 404(NotFound)에서 400(`INVALID_CURSOR`)으로 바뀌는데 이를 고정하는 회귀 테스트가 없다(정보 유출은 아니며 `resolveLimit`과 같은 기존 순서 관행일 가능성이 높음). 부수로 신규 테스트 파일에 이 순서 때문에 소비되지 않는 죽은 mock(`executionRepo.createQueryBuilder.mockReturnValueOnce(...)`)이 1건 존재 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:92-95` (호출 순서), `background-runs.service.spec.ts:638-640` (죽은 mock) | cross-workspace + 비-UUID 커서 조합을 단언하는 테스트를 추가해 현재 우선순위(400, 404 아님)를 명시적으로 고정. 팀이 이 우선순위를 의도로 확정하면 plan에도 1줄 등재. 죽은 mock은 제거하거나 "decodeCursor가 먼저 실행돼 도달하지 않는다" 주석 추가 |
| 2 | 유지보수성 | `isUuidShaped` 선택 근거(22P02→500 마스킹 메커니즘, `isValidUuid` 대신 고른 이유, spec Rationale 인용)를 담은 ~12줄 산문 주석이 `uuid.ts`의 `isUuidShaped` JSDoc과 두 호출부(`login-history.service.ts`, `background-runs.service.ts`)에 사실상 3중으로 복제되어 있다. developer 스스로 이전 라운드(`review/code/2026/09/12/23_19_03` maintainability INFO#1)에 이미 등재하고 "주석-only, 동작/커버리지/계약 불변이므로 이번 배치에서는 보류"로 후속 트래커(`spec-draft-nullable-notation-followups.md`)에 defer했으나, 이번 diff에도 여전히 그대로 남아있어 재확인 차 기록 | `codebase/backend/src/modules/auth/login-history.service.ts:53-64`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`, 참고 SoT `codebase/backend/src/common/utils/uuid.ts:16-41` | 상세 근거는 `uuid.ts`의 `isUuidShaped` JSDoc 한 곳에만 두고, 두 호출부 주석은 "왜 이 술어를 쓰는지는 그 JSDoc 참고" 정도의 1~2줄 참조로 압축. 이미 등재된 항목이므로 별도 신규 조치는 후속 세션에서 |
| 3 | 문서화 | `isUuidShaped`(`uuid.ts`)의 JSDoc "앵커 정정(2026-08-09, `#1112` 실측)" 문단이 "진짜 캐너리는 `uuid.spec.ts`의 두 술어 경계 테스트와 `workspace-context.util.spec.ts`의 nil UUID 테스트뿐"이라고 **닫힌 목록**으로 단언한다. 그런데 바로 이 diff가 `login-history.service.ts`·`background-runs.service.ts`에 새 소비처 2곳과 각각의 `[대조군]` 회귀 테스트를 추가해, 지금은 캐너리가 최소 4곳이다. 같은 diff의 `uuid.spec.ts`는 정확히 같은 종류의 실수("호출부는 한 곳뿐")를 스스로 지적하며 grep 기반 서술로 고쳤는데, 그 수정이 `uuid.ts`의 정본 JSDoc에는 반영되지 않았다 | `codebase/backend/src/common/utils/uuid.ts:27-32` | `uuid.ts`의 해당 문단도 닫힌 테스트 목록 대신 grep 기반 서술(또는 최소 새 소비처 언급)로 갱신 |
| 4 | 요구사항/문서화 | `uuid.spec.ts`의 신규 docstring이 소비처 개수를 "2026-09-12 실측은 3곳"이라 적고 재현용 grep 명령을 제시했으나, 그 명령을 그대로 실행하면 함수 **정의부**(`uuid.ts:45`)가 `isUuidShaped(` 패턴에 걸려 실제로는 4줄이 출력된다("호출부 3곳"을 의도했으나 정의부 제외 필터가 없음). 이 docstring의 존재 이유가 "다음 사람이 같은 명령으로 재검증"인데, 그 명령을 최초로 돌리는 순간부터 문서 숫자와 어긋난다 | `codebase/backend/src/common/utils/uuid.spec.ts:61-67` | grep 명령에 정의부 제외 필터 추가(예: `grep -v 'uuid\.ts:'`) 또는 "3곳(정의부 제외)"라고 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약/아키텍처/부작용 | 두 keyset 커서 디코더의 실패 계약이 서로 다르며(무시 후 200 vs 400 `INVALID_CURSOR`), 이번 배치가 각 디코더의 **기존** 실패 모드에 맞춰 검증만 추가해 그 비대칭을 통일 없이 강화한다. `spec/2-api-convention.md §8.2`의 opaque base64/400 단일 표준과도 어긋난다 | `login-history.service.ts:65` vs `background-runs.service.ts:178-180` | 조치 불요 — `plan/in-progress/keyset-cursor-uuid-validation.md §C`, `spec-draft-nullable-notation-followups.md`에 planner 소관으로 이미 등재됨 |
| 2 | API 계약 | `INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND`가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 미등재 — 이번 diff 이전부터 존재하던 갭, 새 결함 아님 | `background-runs.service.ts` catch 블록 | 조치 불요 — `--impl-prep` consistency-check로 이미 포착, planner 항목 등재됨 |
| 3 | 부작용 | 두 엔드포인트의 관측 가능한 실패 응답이 변경됨(500→200, 500→400) — CHANGELOG·plan에 배포 영향(모니터링 신호 소실 포함)까지 이미 명시 공지되어 "숨은" 부작용 아님 | `login-history.service.ts:65`, `background-runs.service.ts:178-180`, `CHANGELOG.md:3-27` | 배포 시 해당 500 카운트 기반 알람이 있는지만 재확인 권고 |
| 4 | 의존성 | 공유 유틸 `isUuidShaped`(외부 의존성 0, 순수 함수)의 소비처가 1곳(`workspace-context.util.ts`) → 3곳으로 증가. 순환 의존 위험 없음, 소비처 확장은 plan에 이미 인지·등재됨 | `codebase/backend/src/common/utils/uuid.ts`, 신규 호출부 `login-history.service.ts:8,65`, `background-runs.service.ts:22,178` | 조치 불요 — 소비처가 더 늘면 JSDoc을 워크스페이스 국한 서술에서 일반화하는 것을 고려(이미 등재됨) |
| 5 | 테스트 | nil UUID(`'00000000-...-000000000000'`) 리터럴이 `uuid.spec.ts`·`login-history.service.spec.ts`·`background-runs.service.spec.ts`·`background-monitoring.e2e-spec.ts` 네 곳에 각각 하드코딩됨 | 각 파일의 `[대조군]` 테스트 | 급하지 않음. 공용 테스트 fixture(`shared/testing/`)로 `NIL_UUID` export 추출 고려 |
| 6 | 유지보수성 | e2e 테스트 두 파일(`background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`)에 "mock이 원리적으로 확인 못하는 것을 여기서 확인한다"는 설명 JSDoc 블록이 도메인 명사만 바뀐 채 거의 동일하게 복제됨 | 각 파일 신규 it 블록 상단 | 급하지 않음 — 세 번째 유사 사례가 생기면 공용 문서로 추출 고려 |
| 7 | 문서화 | `background-runs.service.ts`의 `decodeCursor`/`encodeCursor`에 인코딩 규약·실패 계약을 설명하는 상위 요약 docstring이 없음(자매 파일 `login-history.service.ts`는 있음) — 이번 diff가 만든 결함 아닌 사전 존재 갭 | `background-runs.service.ts` `decodeCursor`/`encodeCursor` 정의부 | 필수 아님. 다음에 이 파일을 만질 때 짧은 요약 docstring 추가 고려 |
| 8 | 데이터베이스 | `login_history`의 기존 인덱스(`idx_login_history_user_created`)가 tie-breaker `id`를 포함하지 않음 — `created_at`이 동일 밀리초로 겹칠 때만 영향, 이번 diff가 만든 회귀 아님 | (인덱스 정의, diff 범위 밖) | 조치 불요 — 새 이슈로 등재하지 않음 |
| 9 | User Guide Sync | `codebase/backend/src/modules/auth/**` 및 `.../executions/background-runs/**` 변경이 각각 `auth-session-flow-change`/`run-debug-flow-change` trigger glob과 경로상 겹치나, 실질은 내부 커서 검증 강화이고 대상 문서(`07-workspace-and-team/`, `05-run-and-debug/`)에 해당 API 계약을 다루는 서술 자체가 없어 갱신 대상 아님 | 매트릭스 대조 결과 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 경로 없음(파라미터 바인딩 사전 존재) — 실질은 22P02→500 마스킹 방지, ReDoS 없음 |
| performance | NONE | O(1) 비-backtracking 정규식, 오히려 실패 경로 DB 왕복을 줄이는 개선 |
| architecture | LOW | 계약 비대칭·주석 복제·유틸 소비 범위 확장 — 전부 이미 등재·근거 있음 |
| requirement | LOW | 기능/엣지케이스/에러시나리오 spec 일치, `uuid.spec.ts` grep 명령 개수 불일치(WARNING) |
| scope | NONE | 핵심 diff는 2줄 검증 추가로 국한, 나머지는 회귀 고정·문서화 |
| side_effect | LOW | 응답코드 변경(500→200/400)은 공지됨, 계약 비대칭은 기등재 |
| maintainability | LOW | 근거 주석 3중 복제(WARNING), e2e JSDoc 복제(INFO) |
| testing | LOW | 촘촘한 대조군·mutation 6/6·e2e 실DB 검증, cross-workspace+잘못된 커서 조합 테스트 누락(WARNING) |
| documentation | LOW | CHANGELOG/plan 우수, `uuid.ts` JSDoc 닫힌 목록이 이 diff로 재차 낡음(WARNING) |
| dependency | NONE | 신규 외부 의존성 없음, 내부 유틸 소비처 fan-out만(이미 추적) |
| database | NONE | SQL 인젝션·마이그레이션·트랜잭션 영향 없음, 술어 선택이 DB 파싱 규칙과 정합 |
| concurrency | NONE | 순수 동기 검증 로직, 동시성 영향 표면 없음 |
| api_contract | LOW | 계약 비대칭·에러코드 카탈로그 미등재는 기존 갭(기등재), CHANGELOG 공지 모범적 |
| user_guide_sync | NONE | frontend/spec 변경 0건, semantic 매칭 후보 2건 모두 문서 서술 자체가 없어 갱신 불요 |

## 발견 없는 에이전트

- concurrency — 이번 diff는 순수 동기 검증 로직 추가뿐이라 동시성 관점에서 검토할 표면이 없음("해당 없음")

## 권장 조치사항

1. `background-runs.service.ts`의 `getBackgroundRun`에 cross-workspace + 잘못된 커서(비-UUID `i`) 조합 테스트를 추가해 현재 관측되는 우선순위(400, 404 아님)를 명시적으로 고정한다. 팀이 이 우선순위를 의도로 확정하면 plan에도 등재.
2. `uuid.spec.ts`의 grep 재현 명령에 함수 정의부 제외 필터를 추가하거나 "3곳(정의부 제외)"로 명시해, 캐너리 검증 절차 자체의 신뢰도를 회복한다.
3. `uuid.ts`의 `isUuidShaped` JSDoc "닫힌 캐너리 목록" 문단을 grep 기반 서술 또는 최소 신규 소비처 언급으로 갱신해 다시 낡지 않게 한다.
4. (낮은 우선순위, 이미 등재됨) `login-history.service.ts`/`background-runs.service.ts`의 복제된 근거 주석을 `uuid.ts` JSDoc 한 곳으로 집약하고 호출부는 짧은 참조로 압축.
5. (낮은 우선순위) `background-runs.service.spec.ts`의 죽은 mock 세팅 제거 또는 "decodeCursor가 먼저 실행돼 도달하지 않는다" 주석 추가, `NIL_UUID` 리터럴 공용 fixture化 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer 실행(14명 전원 성공). 강제 포함(router_safety) 목록 `documentation, maintainability, requirement, scope, security, side_effect, testing` 전원 결과 확보됨 — 화이트리스트 미이행 없음.