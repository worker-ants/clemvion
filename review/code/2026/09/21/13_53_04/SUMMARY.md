# Code Review 통합 보고서

## 전체 위험도
**LOW** — forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보(누락 없음), router 추가 선정 2명(`database, concurrency`) 포함 총 9명 전원 정상 완료. 이번 라운드(`13_53_04`)에서 `codebase/` 실질 코드 변경은 0줄이며(직전 두 라운드와 diff 바이트 단위 동일), 유일한 신규 커밋(`6f1113a70`)은 e2e JSDoc·plan 문서의 사실 정정뿐이다. 신규 Critical/차단 사유 없음. 남은 이슈는 전부 (a) 이미 실측·트래커 등재·의도적으로 유예된 기존 항목(owner 승격 TOCTOU)의 3차 재확인이거나 (b) 이번 라운드에서 새로 발견된 plan 문서 내부 체크박스 모순 하나뿐이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/데이터베이스 | owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이 창에서 동시 `transferOwnership()`이 대상을 owner로 승격시키면 owner 행이 삭제됨 (이번 PR 신규 아님, 3라운드 연속 재확인 — concurrency·database·side_effect 모두 WARNING, security·requirement는 INFO로 재확인. 재진입 기법으로 실측 재현: `status=200, rows_remaining=0`, 이미 트래커 등재·의도적 유예) | `codebase/backend/src/modules/workspaces/workspaces.service.ts:809`(무락 owner 판정)~`:834-838`(delete+affected===0) | 이번 PR을 막을 사유 아님. 후속 PR에서 `delete({..., role: Not('owner')})` + 0행 시 원인 재조회(행없음 vs owner승격 분기) 처방을 뮤테이션 테스트와 함께 반드시 닫을 것 |
| 2 | DOCUMENTATION | `plan/in-progress/member-dup-remove.md` §C 실행 체크박스 2개가 여전히 미체크(`- [ ]`)인데, 같은 문서 하단 `## 체크리스트`는 동일 작업(C-1/C-2)이 실측과 함께 완료됐다고 기록 — 문서 내부 모순 (이번 라운드 신규 발견) | `plan/in-progress/member-dup-remove.md:79`, `:83` vs `:124`, `:127` | `:79`·`:83`을 `- [x]`로 갱신하고 하단 체크리스트 항목을 가리키는 상호참조 추가. plan을 `plan/complete/`로 옮기기 전 정리 권장 (병합 차단 사유 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `DELETE` 멱등성 표(§3, "멱등 O")와 실제 구현(동시 DELETE 패자는 404) 불일치 — 코드는 형제 6건째 검증된 의도적 패턴이 옳고 spec 각주가 미반영 상태 (1라운드에서 이미 식별, 3라운드 연속 재확인) | `spec/5-system/2-api-convention.md §3` vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-838` | 코드 유지. spec 반영은 planner 턴 대상(이미 `spec-draft-nullable-notation-followups.md`에 등재) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `§6` "204=삭제 성공" 표와 `removeMember()`(및 형제 4곳)가 200 `{ok:true}`를 반환하는 불일치 — 이번 PR 이전부터 있던 사전 존재 상태(`git log -S`로 확인), 이번 라운드에서 planner 소유 신규 항목으로 트래커 등재 완료 | `spec/5-system/2-api-convention.md:344` vs `workspaces.controller.ts` `removeMember()` | 새 조치 불요 — planner 턴에서 §3 멱등성 각주 작업과 함께 처리 예정. 재-flag 불필요 |
| 3 | SECURITY | 권한 검사(`assertAdmin`) 호출이 대상 존재·owner 판정보다 뒤에 있어 비-admin/비멤버도 응답 코드로 "멤버 존재"·"owner 여부"를 구분 가능 (신규 아님, 1라운드 지적·유예 완료, 3라운드 연속 재확인) | `workspaces.service.ts:795-815`, 대비: `updateMemberRole():306`은 `assertAdmin`을 먼저 호출 | 이번 PR 차단 사유 아님. 후속 PR에서 `assertAdmin`을 `findOne` 직후로 옮길 때 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED` 에러코드 계약 변경을 별도 검토(트래커에 이미 명시) |
| 4 | MAINTAINABILITY | `throwMemberNotFound()` 헬퍼 추출이 `removeMember()` 범위를 넘어 `updateMemberRole()`까지 확장됨 — 동작 변경 위험 낮고 JSDoc에 확장 사실 명시, 2라운드 연속 수용됨 | `workspaces.service.ts:310`, 헬퍼 정의 `:342-347` | 재조치 불요 |
| 5 | TESTING | `updateMemberRole()`의 not-found 분기(`throwMemberNotFound()` 재사용) 자체를 검증하는 unit 테스트 부재 (carry-over, 이번 PR 무관) | `workspaces.service.ts:310`; 테스트 파일에 `updateMemberRole` happy-path 1건뿐 | 급하지 않음 — 다음에 이 블록을 만질 때 not-found 테스트 추가 권장 |
| 6 | TESTING | `wireFindOne()` mock이 `where.id`만 보고 `where.workspaceId`를 검증하지 않아, 교차 워크스페이스 조회 회귀를 unit 레벨에서 못 잡음(단, `delete()` 인자 단언에서는 걸림) (carry-over) | `workspaces.service.spec.ts:1476-1481` | 급하지 않음 — 대표 테스트 1개에 `where.workspaceId` 단언 추가 권장 |
| 7 | SIDE_EFFECT | `memberRepository.remove(entity)`→`delete(criteria)` 전환이 TypeORM lifecycle hook/subscriber를 우회할 수 있는 지점이나, 저장소에 해당 훅 자체가 없어 실질 영향 없음(grep으로 0건 확인) | `workspaces.service.ts:834` | 조치 불요. 향후 `@BeforeRemove`/subscriber 추가 시 원자적 `delete()` 계열 전체가 훅을 건너뛴다는 점 유의 |
| 8 | SIDE_EFFECT | `removeMember()`의 신규 `delete()` 호출이 `deleteWorkspace` 캐스케이드용으로 세팅된 기존 공유 jest mock 기본값(`{affected:0}`)에 편승 — 현재는 모든 성공 경로가 명시 override돼 있어 안전 | `workspaces.service.spec.ts:156-158` | 조치 불요(현재 범위 안전). 향후 3번째 `memberRepository.delete()` 호출 경로 추가 시 이 공유 기본값 인지 필요 |
| 9 | MAINTAINABILITY | e2e 파일 내 두 `it` 블록이 "락 대기→공허성 가드→COMMIT→정리" 오케스트레이션을 거의 동일하게 반복 (재확인, 형제 파일 비대칭 근거로 유예 유지) | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 두 `it` 블록 | 유예 유지 동의. 6번째 이후 락 기반 동시성 e2e가 추가되면 공유 헬퍼 추출 재검토(반복 3회부터 정당화) |
| 10 | DOCUMENTATION | 리뷰 라운드 2(`13_28_12`)만 이 세션의 다른 6개 라운드와 달리 `RESOLUTION.md` 조치 기록 부재(커밋 메시지로 실질 추적은 가능) | `review/code/2026/09/21/13_28_12/`(디렉터리) | 병합 차단 사유 아님. 형식 통일을 위해 사후 `RESOLUTION.md` 추가 권장 |
| 11 | DATABASE | 감사 로그 기록이 `DELETE`와 별도 트랜잭션(best-effort) — 모듈 전체 기존 관례와 일치, 이번 PR 무관 | `workspaces.service.ts:834-845` | 조치 불요 — 모듈 전체 컨벤션 변경 사안, 이 PR 스코프 아님 |
| 12 | 검증(교차) | 이번 라운드 유일한 신규 커밋(`6f1113a70`)은 e2e JSDoc·plan 문서 정정만 포함하며 실행 코드·단언·락 로직은 바이트 단위로 무변경임을 requirement/scope/testing/concurrency/maintainability 5개 관점이 독립적으로 교차 확인 | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 상단 JSDoc | 문제 없음 — 정상 |
| 13 | 검증(양호) | 직전 라운드(1·2차) WARNING 전건 해소 확인: `MEMBER_NOT_FOUND` 3중 복제→헬퍼 추출, `getAudit()` 중복 정의 제거, 로컬 상수 camelCase 통일, `ADMIN_REQUIRED` 거부 테스트 추가 | `workspaces.service.ts`, `workspaces.service.spec.ts` | 문제 없음 — 정상 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 권한검사 순서 정보 오라클(INFO, 유예 완료), 인젝션/시크릿/에러노출 신규 문제 없음 |
| requirement | NONE | 기능 완전성 전 분기 일치, §3/§6 SPEC-DRIFT 재확인(트래커 귀속 완료), 신규 결함 없음 |
| scope | NONE | codebase 3파일 국한 재확인, throwMemberNotFound 확장은 낮은 위험으로 수용, 스코프 이탈 없음 |
| side_effect | LOW | owner TOCTOU 교차확인(WARNING), lifecycle hook 우회 무영향 확인, mock 공유값 편승(안전) |
| maintainability | NONE | WARNING 2건 해소 확인, e2e 오케스트레이션 반복만 재확인(유예 유지) |
| testing | NONE | 신규 커밋은 주석뿐, ADMIN_REQUIRED 테스트 해소 확인, carry-over INFO 2건만 잔존 |
| documentation | LOW | 직전 WARNING/INFO 3건 조치 확인, plan 체크박스 모순 신규 발견(WARNING), RESOLUTION.md 부재(INFO) |
| database | LOW | owner 승격 TOCTOU 재확인(WARNING), 인덱스/커넥션/N+1 문제 없음 |
| concurrency | LOW | owner 승격 TOCTOU 재확인(WARNING), 핵심 원자적 DELETE 판정·자가탈퇴 위임 무변경 확인 |

## 발견 없는 에이전트

해당 없음 — 9개 reviewer 전원이 최소 INFO 이상 발견사항을 보고했다(순수 "문제 없음"으로만 끝난 reviewer는 없음).

## 권장 조치사항

1. `plan/in-progress/member-dup-remove.md` §C 체크박스 2개(`:79`, `:83`)를 `- [x]`로 갱신하고 하단 체크리스트(`:124`, `:127`) 상호참조 추가 (WARNING #2, plan을 `complete/`로 옮기기 전 정리).
2. 후속 PR에서 owner 승격 TOCTOU를 `delete({..., role: Not('owner')})` + 0행 시 원인 재조회 처방으로 닫고, 뮤테이션 테스트를 동반할 것 (WARNING #1, 3라운드 연속 재확인 — 우선순위 유지 필요).
3. planner 턴에서 `spec-draft-nullable-notation-followups.md` 트래커 실행 시 `spec/5-system/2-api-convention.md` §3(SPEC-DRIFT #1)·§6(SPEC-DRIFT #2)을 함께 갱신.
4. 여유 있을 때: `13_28_12` 라운드에 `RESOLUTION.md` 사후 추가(INFO #10), `updateMemberRole` not-found 테스트(INFO #5), `wireFindOne` workspaceId 단언(INFO #6) 보강.
5. 6번째 락 기반 동시성 e2e 추가 시 `member-remove-concurrency.e2e-spec.ts`의 반복 오케스트레이션 공유 헬퍼 추출 재검토(INFO #9).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨, 누락 없음**
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 관련 낮음 |
  | architecture | router 판단상 이번 diff와 관련 낮음 |
  | dependency | router 판단상 이번 diff와 관련 낮음 |
  | api_contract | router 판단상 이번 diff와 관련 낮음 (단, 관련 §6 204/200 불일치는 requirement가 SPEC-DRIFT #2로 포착·기록) |
  | user_guide_sync | router 판단상 이번 diff와 관련 낮음 |
