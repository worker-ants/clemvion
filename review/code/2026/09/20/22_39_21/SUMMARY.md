# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 2건(테스트 커버리지 갭 1건, 문서 자기-약속 미이행 1건). forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 락 안 재조회(`m.findOne(Trigger, { select:{id:true}, where:{id, workspaceId} })`)의 `workspaceId` 스코프가 어떤 단위 테스트·e2e 로도 검증되지 않는다. `makeService()`의 `freshFindOne` 콜백이 `(options)` 인자를 아예 선언하지 않고, 신규 unit 2건도 `m.findOne` 호출 인자를 단언하지 않으며, e2e 도 단일 workspace 안에서만 두 DELETE 를 겹친다. `where` 절에서 `workspaceId` 를 빠뜨리는 authz 누수 회귀가 나도 스위트 전체가 GREEN 으로 남는다. | `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1094`; `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3766, 3811-3815, 4030, 4125` | `freshFindOne` 시그니처를 `(findOptions) => ...` 로 바꿔 `where:{id, workspaceId}` 호출을 단언하거나, e2e 에 "다른 workspace 의 트리거 id 로 DELETE → 404" 케이스 추가 |
| 2 | Documentation | `plan/in-progress/trigger-dup-delete.md` 가 스스로 약속한 "이 PR 이 §4.4 를 사실로 만들면 트래커의 planner 항목 (b) 에 그 사실을 적는다"가 이번 diff 에 반영되지 않았다. `spec-draft-nullable-notation-followups.md` 의 planner 항목 (b)("§4.4 는 구현 검증 대기 caveat 필요")는 손대지 않았고, 체크리스트에도 이를 강제할 전용 항목이 없어 `plan/complete/` 이동 시 조용히 누락될 위험이 있다. | `plan/in-progress/trigger-dup-delete.md` (게이트 93-94줄, "이 PR 이 하지 않는 것"); `plan/in-progress/spec-draft-nullable-notation-followups.md` (4785-4793줄, planner 항목 (b)) | 체크리스트에 "planner 항목 (b) §4.4 caveat 불필요 처분" 을 별도 줄로 추가하거나, 트래커 4792-4793줄에 "2026-09-20 실측 완료 — caveat 불필요" 주석을 직접 추가(tracker 상태 갱신이라 developer 권한 범위) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Concurrency / Security / API Contract | 외부 provider teardown(`releaseExternal` — chat-channel teardown, BullMQ job scheduler 해제 등)은 advisory lock 취득 **전**에 무조건 실행되어 동시 DELETE 두 건 모두에서 한 번씩(총 두 번) 호출된다. 이번 diff 는 DB 행·감사 중복만 닫았다. best-effort·실패 삼킴 구조라 500 이나 처리 중단으로 이어지지 않음은 직전 라운드가 실측. plan/CHANGELOG/트래커 3곳에 이미 명시 등재되어 은폐가 아니다. | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 의 `releaseExternal(trigger)` 호출부(락 취득 전, diff 밖) | 조치 불요 — 재-flag 방지 대상으로 이미 처분됨 |
| 2 | Requirement / Database / Concurrency / API Contract | `SchedulesService.remove()` 자신의 스케줄 행 삭제도 advisory lock·재조회 가드 없이 트랜잭션 밖에서 실행되어 같은 형태의 감사 중복 가능성이 남아 있다. 이번 diff 범위 밖이며 트래커에 신규 developer 후속 항목으로 등재됨. | `codebase/backend/src/modules/schedules/schedules.service.ts:345`; 등재 위치 `plan/in-progress/spec-draft-nullable-notation-followups.md` | 후속 세션에서 트리거와 동일한 처방(advisory lock → 락 안 재조회) 적용 |
| 3 | Maintainability | 신규 e2e(`trigger-delete-concurrency.e2e-spec.ts`)가 형제 두 파일(workflow/workspace)과 구조적으로 거의 동일 — 3번째 반복. `Logger.prototype.error` spy 보일러플레이트도 같은 파일에 2회 신규 추가. 둘 다 plan 에서 공용 헬퍼 추출을 명시적으로 유예했거나 기존 코드베이스 컨벤션과 일치. | `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`; `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4032, 4127` | 조치 불요(유예 근거 명시됨). 4번째 유사 사례 시 공용 헬퍼 추출 재검토 |
| 4 | Requirement | spec fidelity 재확인 결과 `spec/2-navigation/2-trigger-list.md:318` §4.4(동시 삭제 시 두 번째는 404)와 구현이 에러 코드·스코프까지 line-level 로 일치. SPEC-DRIFT 아님. | `spec/2-navigation/2-trigger-list.md:318`; `triggers.service.ts:1090-1094, 412-416` | 조치 불요 |
| 5 | Requirement / Documentation / Concurrency | e2e 의 advisory lock key 가 리터럴에서 `triggerConfigLockKey` import 로 교체(SUMMARY#3)되어 프로덕션 코드와 lock key 계산의 단일 진실원이 재확립됨 — 두 자리 수동 동기화 드리프트 위험 제거(개선). | `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:8, 94`; `codebase/backend/src/modules/triggers/trigger-config-lock.ts` | 조치 불요 |
| 6 | Testing | 신규 404-분기 단위 테스트가 `releaseExternal`(외부 teardown)이 패자 경로에서도 여전히 실행됐는지는 단언하지 않는다. 새 결함은 아니나 회귀 가드로 명시화하면 향후 조사 비용이 준다. | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4030-4054` | 선택 사항 — `expect(events).toContain('teardown')` 추가 |
| 7 | Scope | diff 30개 파일 중 24개는 `/ai-review`·`consistency-check --impl-prep` 산출물(리뷰/일관성 리포트 + RESOLUTION 기록) — CLAUDE.md 상시 강제 절차의 정상 산출물이며 범위 이탈이 아니다. | `review/code/2026/09/20/22_07_23/**`, `review/consistency/2026/09/20/21_43_47/**` | 조치 불요 |
| 8 | API Contract | 동시 DELETE 패자 응답이 `204`→`404`로 바뀌는 것은 이미 spec 에 문서화된 계약을 뒤늦게 충족시키는 것으로 신규 breaking change 가 아니다. 에러 스키마·인가 스코프 재사용, 신규 엔드포인트/DTO 변경 없음. | `triggers.service.ts:1090-1094, 412-416`; `spec/2-navigation/2-trigger-list.md:318` | 조치 불요 |
| 9 | Database | 락 안 재조회는 PK 단건·컬럼 최소화 조회로 비용 무시 가능. advisory lock 은 트랜잭션 종료 시 자동 해제되어 커넥션·락 잔존 위험 없음. | `triggers.service.ts` `remove()` | 조치 불요 |
| 10 | User Guide Sync | doc-sync-matrix 21개 trigger row 전수 대조 결과 매칭 0건 — 순수 백엔드 동시성 버그 수정으로 frontend/유저가이드/i18n 영향 없음. | `.claude/config/doc-sync-matrix.json` 대조 | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. workspaceId 스코프 유지, 파라미터 바인딩, 시크릿 하드코딩 없음. 외부 teardown 중복은 기존 등재된 잔여로 재-flag 안 함 |
| requirement | NONE | RESOLUTION 5개 조치 커밋 전부 실측 검증 완료. spec §4.4 와 line-level 일치, SPEC-DRIFT 없음 |
| scope | NONE | 핵심 코드 변경 14줄 + 테스트로 목표 결함 하나에 정확히 국한. 리뷰 산출물 다수는 정상 워크플로 |
| side_effect | LOW | 함수 시그니처/공개 계약/전역 상태 불변. 외부 provider teardown 중복 호출은 기존 등재된 잔여 (INFO) |
| maintainability | NONE | 네이밍·헬퍼 재사용·주석 스타일이 기존 컨벤션과 일치. e2e/logger spy 반복은 의도적 유예 |
| testing | LOW | 핵심 로직 뮤테이션 검증 양호하나 신규 재조회의 workspaceId 스코프 미검증 (WARNING #1) |
| documentation | LOW | CHANGELOG·주석·JSDoc 정확. 스스로의 planner 항목 기재 약속 미이행 (WARNING #2) |
| database | NONE | 재조회 쿼리 저비용·파라미터화. SchedulesService 잔여는 diff 범위 밖 |
| concurrency | LOW | 이번 diff 로 신규 동시성 결함 없음. 기존 두 잔여 항목(teardown 중복, SchedulesService) 확인만 |
| api_contract | NONE | 204→404 변경은 기존 spec 계약 충족, breaking change 아님. 신규 계약 표면 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21 row 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- **security** — "발견사항: 없음" (Critical/Warning 대상 없음으로 명시). 상세 검토 결과는 위 위험도 요약 참조.
- **user_guide_sync** — "발견사항: 없음" (매칭된 trigger 없음).

## 권장 조치사항

1. (WARNING #1) `makeService()` 의 `freshFindOne` 콜백이 `findOptions` 를 받도록 수정하고 `where:{id, workspaceId}` 호출을 단언하는 단위 테스트를 추가하거나, e2e 에 cross-workspace DELETE 케이스를 추가해 인가-민감 재조회의 워크스페이스 스코프를 회귀로부터 고정한다.
2. (WARNING #2) `plan/in-progress/trigger-dup-delete.md` 체크리스트에 "planner 항목 (b) §4.4 caveat 처분" 항목을 명시하거나, `spec-draft-nullable-notation-followups.md` 4792-4793줄에 실측 완료 주석을 직접 추가해 `plan/complete/` 이동 시 이 약속이 누락되지 않도록 한다.
3. (선택, INFO #6) 신규 404-분기 단위 테스트에 `expect(events).toContain('teardown')` 를 추가해 "패자도 teardown 은 스킵하지 않는다"는 사실을 명시적 회귀 가드로 만든다.
4. (이미 트래커 등재, 후속 세션) `SchedulesService.remove()` 에도 트리거와 동일한 advisory lock → 락 안 재조회 처방을 적용해 동종 감사 중복 잔여를 닫는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 (사유 미제공 — 성능 영향 없는 동시성 버그 수정으로 판단된 것으로 추정) |
  | architecture | router 판단 (사유 미제공 — 아키텍처 변경 없는 로컬 함수 수정으로 판단된 것으로 추정) |
  | dependency | router 판단 (사유 미제공 — 신규 의존성 추가 없음으로 판단된 것으로 추정) |
