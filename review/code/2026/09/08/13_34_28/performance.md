# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` DB 레벨 `select` 투영 — 성능 개선 (회귀 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (`listMembers`)
  - 상세: 종전 `relations: ['user']` 는 `User` 엔티티 전 컬럼(민감 7컬럼 포함)을 단일 JOIN 으로 로드한 뒤 `.map`(:233-240)으로 6키만 골랐다. 이번 변경은 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 를 같은 `find()` 호출에 추가해 DB 레벨에서 컬럼을 좁힌다. `relations`+`select` 조합은 TypeORM 이 여전히 단일 JOIN 쿼리로 처리하므로 N+1 로 퇴화하지 않고, 네트워크·메모리로 올라오는 바이트 수만 줄어든다. 워크스페이스 멤버 목록에 페이지네이션이 없는 점은 이번 diff 가 만든 것이 아니라 기존 동작이라 지적 대상이 아니다.
  - 제안: 조치 불요 (개선).

- **[INFO]** `production-build-devdep.spec.ts` — 이전 라운드 지적(`resolveBuildFileNames()` 반복 호출)을 부분적으로만 해소
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:44`(`const buildFiles = resolveBuildFileNames(backendDir);`) vs `:56`(`findDevDepLeaks(backendDir)`)
  - 상세: 이번 diff 는 `describe` 최상단에서 `buildFiles` 를 1회 계산해 캐너리(`:50-51`)와 `it.each` 디렉터리 배제 검사(`:73-82`) 두 자리가 공유하도록 고쳤다 — 이전 라운드(`review/code/2026/09/08/12_53_08` INFO#4)가 지적한 반복 호출(원래 3회)을 실질적으로 줄인 올바른 수정이다. 다만 `:56` 의 `findDevDepLeaks(backendDir)` 는 내부에서 `resolveBuildFileNames(backendDir)` 를 **독립적으로 다시 호출**한다(`production-build-devdep-guard.ts:112`, 이번 diff 가 건드리지 않은 기존 함수) — 그 결과 `tsconfig.build.json` 파싱 + ~800파일 glob 해석이 스위트당 총 2회(캐시된 `buildFiles` 1회 + `findDevDepLeaks` 내부 1회) 남아 있다. 이번 diff 의 범위 밖(기존 함수 시그니처를 바꾸지 않는 선에서는 닫을 수 없는 자리)이고 테스트 스위트 실행 시간에만 영향을 주므로 경미하다.
  - 제안: 급하지 않음. 다음에 `production-build-devdep-guard.ts` 를 만질 기회가 있으면 `findDevDepLeaks(backendDir, buildFiles?)` 처럼 선계산된 목록을 주입받을 수 있게 시그니처를 넓히면 이 잔여 중복도 닫힌다.

- **[INFO]** `cmd_build()` 안 타입체크 ratchet 두 개가 순차 실행 (이전 라운드에서 이미 won't-do 처분됨)
  - 위치: `.claude/test-stages.sh:80-85`(`_cmd_typecheck_ratchets`), 호출부 `:95`
  - 상세: `check-backend-typecheck-ratchet.py && check-frontend-typecheck-ratchet.py` 가 `&&` 로 순차 실행된다. `RESOLUTION.md`(`review/code/2026/09/08/12_53_08/RESOLUTION.md` INFO#5)가 이미 "`build` 단계는 docker 이미지 빌드(전체 172s)가 지배적이고, 병렬화 시 stderr 가 섞여 실패 원인 진단이 나빠진다"는 실측 근거로 won't-do 를 명시했다. 이번 diff 는 그 결정을 그대로 유지한다 — 재지적할 새 근거가 없다.
  - 제안: 조치 불요 (이미 처분됨). 로컬 반복 실행 빈도가 실측으로 병목임이 드러나면 그때 재검토.

- **[INFO]** 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`) — 스캔 범위·캐싱 규율 양호
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (`findTriggerRepositorySaves`, 전체), `endpoint-path-conflict-wrap.spec.ts:71-72`(`const files = collectTsFiles(TRIGGERS_DIR); const sites = findTriggerRepositorySaves(files, SRC_ROOT);` — `describe` 최상단 1회 계산)
  - 상세: 스캔 대상을 `src/modules/triggers` 로 좁혔고(전체 저장소 AST 순회가 아님), `describe` 최상단에서 한 번만 계산해 4개 `it` 이 공유한다 — `production-build-devdep.spec.ts` 가 겪었던 반복-호출 패턴을 처음부터 피했다. 각 파일마다 `ts.createSourceFile` 로 단일 파일 파싱만 하므로(가드 파일 :147-152) 파일 수에 선형이고 테스트 전용 코드라 런타임 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `http-exception.filter.ts`/`integration-oauth.service.ts` 의 SoT 헬퍼 치환 — 성능 특성 변화 없음
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70`(`isPostgresUniqueViolation(exception)`), `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1273`·`:1827`(`pgErrorConstraint(err)`)
  - 상세: `pg-error.ts` 의 `pgErrorCode`/`pgErrorConstraint`(`codebase/backend/src/common/db/pg-error.ts:18-47`)는 `typeof` 검사 + `??` 두 단계 프로퍼티 접근뿐인 O(1) 순수 함수라, 종전 로컬 구현(손으로 짠 옵셔널 체이닝)과 동일한 상수 시간이다. 예외 처리 경로(hot path 아님)에서 호출되므로 실질적 영향 없음.
  - 제안: 조치 불요.

## 요약

이번 diff(배치 B, 8항목)는 대부분 harness/테스트/문서 변경이며 런타임 핫패스에 영향을 주는 실질 변경은 `workspaces.service.ts` `listMembers` 하나뿐인데, 그마저 컬럼 로드를 줄이는 **성능 개선**이고 N+1 로 퇴화하지 않는다(`relations`+`select` 병용은 여전히 단일 JOIN). `http-exception.filter.ts`·`integration-oauth.service.ts` 의 SoT 헬퍼 치환은 O(1) 속성 접근을 그대로 유지하는 순수 리팩터라 성능 변화가 없다. 이전 라운드(`12_53_08`)가 지적한 `production-build-devdep.spec.ts` 의 `resolveBuildFileNames()` 반복 호출은 `describe` 최상단 1회 계산 + `it.each` 파라미터화로 실질적으로 줄었으나, `findDevDepLeaks()` 내부의 독립적인 재호출 1건은 이번 diff 의 범위(기존 함수 시그니처 불변) 밖이라 남아 있다 — 테스트 스위트 실행 시간에만 영향을 주는 경미한 잔여 사항이다. 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 스캔 범위를 `modules/triggers` 로 좁히고 계산을 1회로 캐싱해 같은 패턴을 처음부터 피했다. `cmd_build()` 의 두 typecheck ratchet 순차 실행은 실측 근거(docker 빌드가 지배적)와 함께 이미 won't-do 로 처분된 사항으로 재지적할 새 근거가 없다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
