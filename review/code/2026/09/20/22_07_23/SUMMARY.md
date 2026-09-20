# Code Review 통합 보고서

## 전체 위험도

**LOW** — 트리거 `remove()`의 동시 DELETE 감사 중복 결함을 spec §4.4대로 정확히 닫는 최소 diff. CRITICAL 없음. WARNING 5건은 모두 코드 되돌림 사유가 아니라 잔존 노출(외부 teardown 중복)·서술 정확성(plan 제목 과장, CHANGELOG 누락)·테스트 완결성·유지보수 관점의 개선 권고다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보되어 화이트리스트 미이행 없음 — 이 항목은 "clean"이 아니라 위 WARNING 5건을 포함한 LOW로 판정한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Concurrency | 이번 수정은 감사 행·행 재삭제 중복만 막고, 같은 레이스에서 파생되는 외부 자원 정리(chat-channel provider teardown, listener unregister) 중복 호출은 막지 못한다. `releaseExternal(trigger)`가 advisory lock 획득 **전**, 잠금 없는 선조회 직후 무조건 실행돼 동시 DELETE 두 건 모두 teardown을 한 번씩(총 두 번) 시도한다. concurrency 리뷰가 BullMQ `removeJobScheduler`·`teardownChatChannel` 소스를 직접 확인해 500 유발이나 처리 중단으로는 이어지지 않음(best-effort, 실패 삼킴)을 실측했으나, provider API에 대한 중복 호출 자체는 남는다. 신규 e2e도 이 경로(chat-channel 있는 트리거)를 의도적으로 피해 커버하지 않는다. | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (releaseExternal 호출, 락 취득 이전, diff 밖 기존 줄) / `trigger-resource-releaser.service.ts:166` teardownChatChannel | plan에 "외부 provider teardown 중복 호출은 닫히지 않았다"를 명시하거나, `releaseExternal`을 advisory lock 안 재조회 뒤로 옮기거나 두 번째 호출을 멱등하게 만드는 후속 작업을 트래킹 |
| 2 | Requirement | plan 제목·커밋 메시지("네 삭제 경로 중 마지막 한 자리")가 실제 범위보다 넓게 주장한다. `SchedulesService.remove()` 자신의 스케줄 행 삭제(`SCHEDULE_DELETED` 감사)는 advisory lock도 재조회(`!fresh`) 가드도 거치지 않아 `this.scheduleRepository.remove(schedule)`가 동시 삭제 시 이번에 트리거에서 고친 것과 같은 형태로 감사를 두 번 남길 수 있다. 대응하는 `schedule-delete-concurrency` e2e도 없고 이 잔여를 추적하는 백로그 항목도 없다. | `plan/in-progress/trigger-dup-delete.md`(제목) / `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()`(300~352행) | plan 제목을 "트리거·워크플로·워크스페이스 세 경로"로 좁히거나, `SchedulesService.remove()`의 잔여 노출을 별도 백로그 항목으로 등재 |
| 3 | Maintainability | 신규 e2e가 이미 export된 `triggerConfigLockKey` 헬퍼를 재사용하지 않고 advisory lock key 포맷(`trigger-config:<id>`)을 문자열로 재구현했다. 주석으로 드리프트 위험을 스스로 인지하고 있으나 두 곳에 같은 지식을 수동 동기화해야 하는 상태로 남았다. | `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:29` vs `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`triggerConfigLockKey` export) | `import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';`로 교체해 `lockKey` 헬퍼 제거 |
| 4 | Testing | genuine(비-404) 삭제 실패 시 `logger.error`가 실제로 호출되는지 검증하는 테스트가 없다. 로그 삭제 뮤턴트로 관련 테스트 11/11이 GREEN으로 남는 것을 실측했다(원본 실행 시 콘솔에 ERROR 로그가 실제로 찍히지만 아무도 단언하지 않음). 자매 모듈(`workflows.service.spec.ts:1062`, 커밋 `4a9828afe`)에는 이미 대칭 테스트가 있어 같은 PR 계열 안에서 커버리지가 비대칭이다. | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` `.catch` 블록 / `triggers.service.spec.ts:4030, 4105, 4247` | `removeRejects: true` 케이스에 `jest.spyOn(Logger.prototype, 'error')`를 추가해 genuine 실패 시 호출·메시지(`trigger=<id>`, "반쯤 삭제된 상태" 등)를 단언 — `workflows.service.spec.ts:1062` 패턴 복제 |
| 5 | Documentation | 형제 두 커밋(#1369 workflows `4a9828afe`, #1368 integrations `ae4fbc374`)이 세운 "동시 삭제 동작 변경은 CHANGELOG에 문제/수정/판별력 실측 3단 구성으로 등재" 관행을 이 PR만 건너뛰었다. 이 PR 스스로를 그 형제들의 "세 번째 짝"으로 규정하면서도 CHANGELOG.md는 diff에 없다. | `CHANGELOG.md`(이번 diff에 부재) vs 커밋 `4a9828afe`, `ae4fbc374` | 동일 형식으로 "## Unreleased — 동시 DELETE 두 건이 `trigger.deleted` 감사 행을 두 번 남기던 것" 항목 추가(`[204,204]`→`[204,404]`, 감사 2건→1건 실측값 포함) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | spec fidelity 확인 — `spec/2-navigation/2-trigger-list.md:318`의 "두 번째는 404 RESOURCE_NOT_FOUND" 문구가 이번 구현으로 실제 사실이 됨. 선행 consistency 리뷰(INFO#1)가 지적한 caveat 미기재가 이번 구현으로 자연 해소. SPEC-DRIFT 아님. | `spec/2-navigation/2-trigger-list.md:318` | 조치 불요 |
| 2 | Requirement | 리뷰 도중 공유 워크트리에서 다른 reviewer로 추정되는 일시적 파일 뮤테이션(logger.error 호출을 마커 주석으로 치환)을 관측 — 이미 자체 원복되어 현재 `git diff` 무출력, 저장소 상태 깨끗함 확인. | `triggers.service.ts` `remove()` `.catch` 블록(관측 당시 일시적) | 조치 불요, 후속 fan-out 라운드 참고용 |
| 3 | Scope | `review/consistency/2026/09/20/21_43_47/**` 8개 파일 포함은 CLAUDE.md가 규정한 `--impl-prep` consistency-check 의무 절차의 정상 산출물이며 범위 이탈 아님. | `review/consistency/2026/09/20/21_43_47/**` | 조치 불요 |
| 4 | Scope | plan이 "이 PR이 하지 않는 것"(외부 자원 해제 중복 미수정·공용 헬퍼 추출 미실시·spec caveat 정정은 planner 위임)을 사전에 명시해 스코프를 좁혔고 실제 diff도 그 경계를 지킴 — 모범 사례. | `plan/in-progress/trigger-dup-delete.md` | 조치 불요 |
| 5 | Database / Security | 변경 범위 내 모든 쿼리(TypeORM `findOne` where절, e2e raw SQL `$1` 바인딩)가 파라미터화되어 SQL 인젝션 경로 없음. 락 안 재조회로 DB 왕복이 1회 늘었으나 PK 단건·컬럼 최소화(`select:{id:true}`) 조회라 비용 무시 가능. | `triggers.service.ts:1090-1093`, `trigger-delete-concurrency.e2e-spec.ts:94-96, 121-125` | 조치 불요 |
| 6 | Database | 트랜잭션·락 설계(되돌릴 수 없는 외부 해제는 락 밖, 재조회는 락 안, advisory lock은 트랜잭션 종료 시 자동 해제, 5s `lock_timeout`로 무한 대기를 오류로 드러냄)가 선행 workflows/workspaces PR과 일관되고 견고함. | `triggers.service.ts` `remove()`(1060-1121행) | 조치 불요 |
| 7 | Maintainability | 3번째로 반복되는 "동시 DELETE" e2e 테스트 스캐폴드(workflow-/workspace-delete-concurrency와 구조 거의 동일)지만, plan이 공용 헬퍼 추출을 명시적으로 유예해 둠 — 누락 아닌 의도된 지연. | `trigger-delete-concurrency.e2e-spec.ts` vs `workflow-/workspace-delete-concurrency.e2e-spec.ts` | 4번째 유사 사례 발생 시 공용 하네스 추출 우선순위 검토 |
| 8 | API Contract | 동시 DELETE 패자가 `204` 대신 `404`를 받는 멱등성 비대칭은 `spec/2-navigation/2-trigger-list.md §4.4`에 이미 명시된 의도된 제품 계약이며, 신규 에러 스키마 없이 기존 `RESOURCE_NOT_FOUND` 포맷·Swagger `@ApiNotFoundResponse` 문서를 재사용. 재조회도 원 조회와 동일한 `workspaceId` 스코프를 유지해 authz 누수 없음. | `triggers.service.ts` `throwTriggerNotFound()`(412-416, 1094행), `triggers.controller.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가/인젝션/시크릿 노출 없음. 오히려 거짓 "반쯤 삭제" 에러 로그 오탐을 없애 로그 신뢰성 개선 |
| requirement | LOW | plan 제목이 실제보다 넓게 주장(WARNING #2), spec §4.4 fidelity 정확 일치(INFO), 공유 워크트리 일시 뮤테이션 관측(INFO, 이미 원복) |
| scope | NONE | 스코프 이탈·불필요 리팩토링 없음, review/consistency 산출물·plan의 사전 스코프 경계 모두 정상 |
| side_effect | LOW | 외부 provider teardown 중복 호출 잔존(WARNING #1) |
| maintainability | LOW | e2e의 lock key 헬퍼 미재사용(WARNING #3), 반복 스캐폴드는 의도된 유예(INFO) |
| testing | LOW | genuine 실패 시 logger.error 검증 테스트 부재를 뮤테이션으로 실측(WARNING #4), 나머지 테스트 품질 양호 |
| documentation | LOW | CHANGELOG.md 누락(WARNING #5), 코드·plan·spec 문서화 자체는 수준 높음 |
| database | NONE | 신규 결함 없음, 트랜잭션·락 설계 견고, 파라미터화 쿼리 |
| concurrency | LOW | 이번 diff 범위 내 새 경쟁 조건 없음, 재확인 위치 정확. 외부 teardown 중복은 조사 결과 저위험(INFO)으로 WARNING #1과 동일 사안 |
| api_contract | NONE | 신규 계약 변경 없음, 멱등성 비대칭도 spec에 명시된 의도된 동작 |

## 발견 없는 에이전트

security, scope, database, api_contract — 모두 실질 결함 없음(NONE), INFO만 존재하거나 "문제 없음" 확인으로 분류.

## 권장 조치사항

1. `CHANGELOG.md`에 형제 커밋(#1369, #1368)과 동일한 3단 구성으로 이번 트리거 fix 항목 추가 (WARNING #5)
2. genuine 삭제 실패 시 `logger.error` 호출을 검증하는 테스트를 `workflows.service.spec.ts:1062` 패턴으로 추가 (WARNING #4)
3. 신규 e2e의 lock key 문자열 리터럴을 `triggerConfigLockKey` import로 교체해 드리프트 위험 제거 (WARNING #3)
4. plan 제목/커밋 서술의 "네 자리 완결" 주장을 실제 범위(트리거·워크플로·워크스페이스)로 정정하거나, `SchedulesService.remove()`의 잔여 노출을 별도 백로그 항목으로 등재 (WARNING #2)
5. 외부 provider teardown 중복 호출 잔존을 plan에 명시하거나, `releaseExternal`을 advisory lock 안으로 옮기는/멱등화하는 후속 작업을 트래킹 (WARNING #1)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(성능 영향 낮음으로 분류) |
  | architecture | router 판단(아키텍처 변경 없음으로 분류) |
  | dependency | router 판단(신규 의존성 없음으로 분류) |
  | user_guide_sync | router 판단(사용자 가이드 영향 없음으로 분류) |
