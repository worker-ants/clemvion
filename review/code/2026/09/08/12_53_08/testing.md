# 테스트(Testing) 리뷰 — 배치 B (2026-09-08)

## 검증 방법

정적 코드 리딩 외에 실행 검증을 병행했다(저장소 뮤테이션 없음, `git status --short` 로 리뷰 종료
시점 확인 — 본 리뷰 산출물 디렉터리만 untracked):

- `python3 -m pytest .claude/tests/test_doc_sync_matrix.py .claude/tests/test_typecheck_ratchet.py .claude/tests/test_install_gate_flags.py -q` → 47 passed
- `npx jest src/common/filters/http-exception.filter.spec.ts src/modules/workspaces/workspaces.service.spec.ts src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts src/repo-guards/__tests__/production-build-devdep.spec.ts src/repo-guards/__tests__/user-entity-exposure.spec.ts` → 125 passed
- `npx jest src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts src/common/db/pg-error.spec.ts` → 106 passed

## 발견사항

- **[INFO]** `integration-oauth.service.ts` 의 `pgErrorConstraint()` 치환 2곳에 대해, callsite 레벨에서 `driverError.constraint`(wrap 된 표면) 케이스의 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1273`, `:1827` (각각 cafe24/makeshop `save().catch()` 분기) — 대응 spec `integration-oauth.service.cafe24.spec.ts` "translates idx_integration_workspace_service_mall violation" 테스트(라인 602 부근)는 **최상위(flat) `constraint` 표면만** 준다. `makeshop.spec.ts`도 동일 패턴을 grep 했으나 `driverError` 표면 케이스는 두 spec 파일 어디에도 없다.
  - 상세: 이 자리는 종전에 `(err as {...})?.constraint ?? (err as {...}).driverError?.constraint` 를 손으로 두 표면 다 봤는데, 지금은 그 손-작성 로직이 `pgErrorConstraint()` 로 교체됐다. `pgErrorConstraint()` 자체는 `pg-error.spec.ts` 에서 두 표면 모두 유닛 테스트가 있어 **함수 단위 회귀 위험은 낮다**. 다만 callsite 가 실제로 `pgErrorConstraint()` 의 반환값을 올바른 위치(`STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 비교)에 배선했는지를 "wrap 된 표면이 들어와도 409 로 간다" 로 직접 확인하는 e2e/통합 케이스는 없다 — 두 callsite 모두 flat 표면 케이스만 있다. 실사용 시 TypeORM `Repository.save()` 예외는 대개 `QueryFailedError`(= wrap 된 `driverError.constraint`)로 온다는 점을 고려하면, 정작 실전 표면(wrap)이 callsite 레벨에서 미검증인 채로 flat 표면만 회귀 고정된 형태다.
  - 제안: 두 spec 파일 중 하나에 `driverError: { constraint: STORE_IDENTIFIER_UNIQUE_CONSTRAINT }` 형태의 케이스를 `it.each` 로 추가해 callsite 가 wrap 된 표면도 정확히 409 로 매핑함을 고정. (필수는 아님 — 함수 자체 유닛 테스트가 이미 두 표면을 보장하므로 심각도는 낮음.)

- **[INFO]** `.claude/test-stages.sh` 의 신설 `_cmd_typecheck_ratchets()` → `cmd_build()` 배선 자체는 harness 자동 테스트로 보호되지 않는다
  - 위치: `.claude/test-stages.sh:80` (`_cmd_typecheck_ratchets`), `:95` (`cmd_build` 안의 호출)
  - 상세: `scripts/_typecheck_ratchet.py` 코어 로직은 `test_typecheck_ratchet.py` 로 두텁게 커버되지만, "`cmd_build` 가 실제로 두 스크립트를 순서대로 부르고 실패 시 빌드 단계 전체를 비제로로 만드는가" 라는 배선 자체는 어떤 `.claude/tests/*.py` 도 실행하지 않는다(`test_run_test_watchdog.py` 는 `RUN_TEST_CONFIG` 스텁으로 `run-test.sh` 워치독만 검증하고, 프로젝트별 `test-stages.sh` 의 실제 `cmd_*` 조합은 대상이 아님 — `pnpm --filter backend build` 같은 다른 단계 조합도 동일하게 미검증이라 이 저장소의 기존 관례와 일관됨). 이 배치 자체가 "로컬 4단계가 CI 사각을 조용히 지나쳤다"(`#1292`)는 문제를 고치는 PR인데, 그 수정 지점(배선)을 지키는 자동 테스트가 없다는 점은 같은 클래스의 재발(예: 나중에 `cmd_build` 리팩터링 중 `_cmd_typecheck_ratchets &&` 가 실수로 빠짐)을 다시 조용히 허용할 수 있다.
  - 제안: 필수 조치는 아님 — plan 체크리스트에 "두 타입체크 ratchet 직접 실행" 항목이 있어 최소 1회 수동 검증은 계획돼 있다. 다만 다음에 `cmd_build` 를 다시 만질 때는 `RUN_TEST_CONFIG` 스텁 패턴(`test_run_test_watchdog.py` 참고)으로 "실패 시 build 전체가 비제로" 를 고정하는 것을 고려할 만하다.

## 잘 된 점 (참고)

- `http-exception.filter.spec.ts` 의 두 신설 테스트("raw 표면 23505"/"raw 표면 non-23505")는 기존 `QueryFailedError`(wrap) 케이스와 **의도적으로 분리된 대조쌍**으로 설계돼, 판이 넓어지거나 좁아지는 두 방향을 각각 잡는다. 양성/음성 양쪽을 갖췄고 실행 확인 결과 통과.
- `workspaces.service.spec.ts` 의 `listMembers` 투영 테스트는 "반환 키가 좁다"(매핑 축)와 "쿼리가 `select` 로 요청했다"(DB 축)를 **의도적으로 분리**했다 — 코멘트에 명시된 대로 한쪽만 있으면 투영을 되돌려도 초록이 되는 함정을 정확히 짚었고, 실측 확인함(투영 제거 시 매핑 단언만으론 못 잡음, select 단언이 그 갭을 메움).
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`fixture.ts` 3분할은 "현재 저장소가 규칙을 지킨다"와 "이 함수가 위반을 실제로 잡는다"는 별개 주장이라는 점을 fixture 대조군(`catchButNotWrapping`, `otherRepositorySave`, `twoSaves`)으로 정확히 갈랐다 — vacuous guard 방지 패턴이 잘 적용됨.
- `webhook-trigger.e2e-spec.ts` B4 는 유닛 mock 이 원리적으로 검증 못 하는 실 DB UNIQUE 제약 경로를 정확히 짚었고, `crypto.randomUUID()` 로 다른 테스트와 격리되며, `details` 두 키를 함께 단언해 부분 유실을 잡는다. `triggers.service.spec.ts` 의 mock 케이스와 e2e 가 같은 계약(`TRIGGER_ENDPOINT_PATH_CONFLICT`/`endpoint_path`)을 공유함을 직접 grep 확인.
- `production-build-devdep.spec.ts` 의 신설 `__test-utils__` 케이스는 (기존 `repo-guards` 케이스와 동일하게) 실제 저장소의 `tsconfig.build.json` 을 그대로 읽으므로 vacuous 하지 않다 — exclude 라인을 지우면 실측상 RED 로 전환됨(코드 경로 확인, 별도 뮤테이션 실행은 생략).

## 요약

배치 B의 테스트 변경은 전반적으로 높은 밀도다 — 새 프로덕션 코드 변화(전역 예외 필터의 raw-surface 분기 회귀 수정, `listMembers` DB 투영 전환, 트리거 `endpointPath` 충돌 래핑 AST 래칫, `__test-utils__` 빌드 제외) 전부에 대응하는 신규/갱신 테스트가 동반됐고, 실제로 `jest`·`pytest` 를 돌려 231건 전부 통과를 확인했다. 각 테스트는 "무엇을 놓칠 뻔했는지"를 주석으로 명시하고 대조군(양성/음성)을 갖춰 vacuous-guard 재발을 의도적으로 차단하는 이 저장소의 확립된 패턴을 잘 따른다. 발견한 두 갭 모두 INFO 등급이다 — (1) `pgErrorConstraint` 리팩터 callsite 2곳이 wrap 된 표면 케이스를 직접 재지 않지만 헬퍼 자체는 완전히 커버돼 있어 실질 위험은 낮고, (2) `test-stages.sh` 의 신규 배선은 harness 자동 테스트 밖이지만 이는 이 저장소의 기존 `cmd_*` 조합 전반에 적용되는 일관된 컨벤션이며 plan 체크리스트가 수동 검증을 이미 요구한다. 차단 사유는 없다.

## 위험도

LOW
