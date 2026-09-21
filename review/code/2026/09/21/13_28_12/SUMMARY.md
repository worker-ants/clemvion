# Code Review 통합 보고서

## 전체 위험도
**LOW** — 10명 reviewer(forced 7명 포함) 전원 결과 확보, 전원 위험도 LOW. 이번 diff(핵심 3개 코드 파일: `workspaces.service.ts`/`workspaces.service.spec.ts`/신규 `member-remove-concurrency.e2e-spec.ts`)의 신규 Critical/차단 사유는 없음. 단, 다수 reviewer가 owner 승격 TOCTOU·권한 검사 순서 오라클을 재확인했으며 이는 **이번 PR이 만든 결함이 아니라 이미 실측·트래커 등재·의도적으로 유예된 기존 갭**이다(아래 WARNING 참조). forced 7명 전원 결과 확보되어 화이트리스트 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency/database | owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이에 동시 `transferOwnership()`이 대상을 owner로 승격시키면 owner가 삭제될 수 있음(재진입 기법으로 `status=200, rows_remaining=0` 실측 재현됨). 이번 PR이 새로 만든 결함이 아니고, 신규 `affected===0` 판별자의 의미 오염을 피하려 의도적으로 별도 PR로 유예됨(requirement·side_effect·database·concurrency는 WARNING, security는 INFO로 재확인) | `codebase/backend/src/modules/workspaces/workspaces.service.ts:809`(무락 owner 판정)~`:834-838`(원자적 delete) | 후속 PR에서 `delete({..., role: Not('owner')})` + `affected===0` 시 재조회로 "행없음 vs owner변경" 원인 분기 처방을 자체 뮤테이션 테스트와 함께 반드시 닫을 것(이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재, 재등재 불요) |
| 2 | security/requirement | `removeMember()` 권한 검사(`assertAdmin`)가 대상 조회·owner 판정보다 뒤에 있어, 워크스페이스 비멤버도 `404 MEMBER_NOT_FOUND`/`403 CANNOT_REMOVE_OWNER`/`403 ADMIN_REQUIRED` 세 응답으로 멤버 존재·owner 여부를 구분해 알아낼 수 있음(존재/owner 오라클). 형제 메서드 `updateMemberRole()`/`addMemberByEmail()`은 `assertAdmin`을 최우선 호출하는 것과 대비. 이번 PR이 만든 결함 아님, 이미 직전 라운드에서 발견·등재됨 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` — `findOne`(:800)→404(:803)→self-check(:804)→owner 403(:809)→`assertAdmin`(:815) | 신규 조치 불요(자가 탈퇴 허용·owner 대상 에러 코드 계약 변경을 수반해 별 PR 필요, 이미 트래커 등재·유예). 후속 PR에서 `spec/5-system/3-error-handling.md` 기준 별도 consistency 라운드로 다룰 것 |
| 3 | documentation | 신규 e2e 파일(`member-remove-concurrency.e2e-spec.ts`)이 이미 등재된 "다섯 `*-delete-concurrency.e2e-spec.ts`가 spec frontmatter에 없다"는 트래커 항목의 열거·글롭 패턴("-delete-" vs 신규 파일의 "-remove-")을 갱신하지 않아 착수 즉시 stale해짐. 같은 diff가 인접 항목 2곳에서는 "개수를 세지 말라"는 교훈을 이미 적용했음에도 이 항목만 누락 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4927` | "다섯"→"여섯" 갱신 또는 개수를 명시하지 않는 서술로 변경(low 우선순위, 병합 차단 아님) |
| 4 | api_contract | `DELETE /api/workspaces/:id/members/:memberId`(및 `deleteWorkspace`) 성공 응답이 `200 {data:{ok:true}}`로, `spec/5-system/2-api-convention.md §6`의 "204 No Content=삭제 성공" 표와 어긋남. `workspaces.controller.ts`(diff 밖) 전체의 기존 패턴이며 형제 4개 컨트롤러(workflows/triggers/schedules/integrations)는 모두 명시적 204를 씀 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-373`, `:201-219` (diff 밖, 컨트롤러 미변경) | 이번 PR 스코프 아님. 차기 §3 각주 정리 작업 때 "성공 상태 코드도 컨트롤러별 204/200 두 갈래"라는 사실을 §6에 함께 각주로 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/documentation/maintainability/testing | 직전 라운드(`12_57_05`) WARNING #3~#5 조치(`throwMemberNotFound()` 추출, `getAudit()` 중복 정의 제거, `ADMIN_REQUIRED` 거부 테스트 추가)가 워킹트리 원본과 대조해 정확히 반영됨을 재확인(`npx jest` 75/75, `npx tsc --noEmit` 0 에러) | `workspaces.service.ts:342-347`, `workspaces.service.spec.ts:38-41`,`:1565-1576` | 없음 — 조치 확인 완료 |
| 2 | scope | `throwMemberNotFound()` 추출이 `updateMemberRole()`까지 확장되어 원 지적 범위(`removeMember` 내부 2곳)보다 1곳 넓음. 동일 리터럴의 기계적 통합이라 위험 낮고 커밋 메시지·JSDoc에 투명하게 기록됨 | `workspaces.service.ts:310`(호출부), `:332-341`(JSDoc) | `RESOLUTION.md` #3 항목에 "updateMemberRole 포함 3곳" 문구 보강 권장(선택) |
| 3 | scope | `spec-draft-nullable-notation-followups.md`에 이번 PR 코드와 무관한 백로그 3건(auth-configs/model-config/webauthn)이 함께 등재됨 — 형제 PR들의 확립된 관례와 일치 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4874-4925` | 없음 — 현행 유지 |
| 4 | side_effect | `remove(entity)`→`delete(criteria)` 전환이 TypeORM lifecycle hook/subscriber를 우회하지만, 저장소 전체에 그런 훅·subscriber·emit이 없음을 grep으로 확인 — 실질 유실 없음 | `workspaces.service.ts:834-838`, entity 파일 | 없음(확인용). 향후 이 엔티티 계열에 훅 추가 시 유의 |
| 5 | maintainability | e2e 파일 안 두 테스트가 "락 대기→공허성 가드→COMMIT→정렬→finally 정리" 오케스트레이션을 거의 동일하게 반복(형제 5파일은 `it` 1개뿐이라 해당 없음). 형제 4파일과의 비대칭을 피하려 유예 | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:61-129`, `:139-204` | 6번째 락 기반 동시성 e2e 추가 시 공유 헬퍼 추출 재검토 |
| 6 | testing | `wireFindOne()` mock이 `where.workspaceId`를 검증하지 않아, `findOne` 호출의 workspaceId 스코핑 누락 회귀(교차 워크스페이스 조회)를 이 unit 테스트가 못 잡음(`delete()` 단은 인자 단언으로 잡힘). 파일 전반의 기존 관례, 이번 PR 신규 아님 | `workspaces.service.spec.ts` `wireFindOne()`(게이트 1469-1482) | 급하지 않음 — 다음에 이 블록을 만질 때 `where.workspaceId` 단언 추가 권장 |
| 7 | testing | `throwMemberNotFound()`를 공유하게 된 `updateMemberRole()`의 not-found 분기 자체를 검증하는 unit 테스트가 여전히 없음(리팩터로 노출된 기존 갭, 이번 PR이 동작을 바꾸지 않음) | `workspaces.service.ts:310` | `updateMemberRole()`에 대상 없음 시 `MEMBER_NOT_FOUND` 테스트 추가 권장(급하지 않음) |
| 8 | documentation/api_contract | e2e/plan 문서의 "형제 다섯은 전부 204, `removeMember`만 200 예외" 서술이 부정확 — 같은 컨트롤러 형제 `deleteWorkspace()`도 이미 200을 반환(기존 e2e가 이미 `[200,404]`로 고정, 테스트 결과 자체는 옳음) | `member-remove-concurrency.e2e-spec.ts:18-20`, `plan/in-progress/member-dup-remove.md:94-95` | 정정 불요(기능 영향 없음). 다음에 주석 만질 때 정확히 서술 |
| 9 | api_contract | `MEMBER_NOT_FOUND` 에러 코드가 "진짜 부재"와 "동시 삭제 패자" 두 원인을 구분 없이 표현 — 형제 5건(#1369~#1372) 전부의 기존 관례, 신규 모호성 아님 | `workspaces.service.ts:310`, `:838` | 없음 |
| 10 | database/concurrency | 원자적 `DELETE`+`affected===0` 명시 비교는 인덱스(PK 기반 단일 행)·동시성 관점에서 적절, 신규 인덱스 불필요. 감사 로그는 별도 트랜잭션(best-effort)으로 기존 모듈 관례와 일치. 자가 탈퇴 위임(`leaveWorkspace()`)이 실제로 `pessimistic_write` 트랜잭션 안에서 재조회로 닫혀 있음을 소스 대조로 검증 | `workspaces.service.ts:834-845`, `:652-664` | 없음 — 확인용 |
| 11 | 전 reviewer 공통 | 이번 세션 리뷰 중 저장소에 코드 변경을 남긴 reviewer 없음(`git status --short` 각자 확인, 산출 디렉터리 외 변경 0건) | — | 없음 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `DELETE` 멱등성 표(`spec/5-system/2-api-convention.md §3`, `DELETE\|O`)가 실제 동작(동시 요청 중 진 쪽은 이제 404)과 다시 어긋남 — 형제 5건(#1369~#1372)과 동일 패턴의 6번째 적용. 코드가 옳고 spec 각주만 낡은 전형적 SPEC-DRIFT | `spec/5-system/2-api-convention.md:111` vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:838` | 코드 유지. spec 반영(§3 각주 "동시 요청 중 진 쪽은 404를 받을 수 있다")은 planner 턴 대상 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재되어 신규 등재 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 보안 결함 없음. owner TOCTOU·권한검사순서 오라클은 INFO로 재확인(기존 갭) |
| requirement | LOW | RESOLUTION.md 조치 3건 반영 확인. owner TOCTOU·권한순서 WARNING 재확인, DELETE 멱등성 SPEC-DRIFT 재확인 |
| scope | LOW | 코드 변경 정확히 3파일로 국한. `throwMemberNotFound()` 확장 범위(updateMemberRole 포함)만 INFO |
| side_effect | LOW | lifecycle hook 우회 무해 확인. owner TOCTOU WARNING 재확인 |
| maintainability | LOW | 직전 라운드 WARNING 2건 해소 확인. e2e 내부 오케스트레이션 반복만 INFO |
| testing | LOW | 분기 커버리지 촘촘. wireFindOne workspaceId 미검증·updateMemberRole not-found 미검증 INFO |
| documentation | LOW | 이전 WARNING/INFO 조치 문구 정확성 확인. 신규 e2e 트래커 미갱신 WARNING |
| database | LOW | 원자적 DELETE·인덱스·트랜잭션 경계 적절. owner TOCTOU WARNING 재확인 |
| concurrency | LOW | 원자성·자가탈퇴 위임 검증. owner TOCTOU WARNING 재확인 |
| api_contract | LOW | 요청검증·URL·응답봉투 불변. DELETE 200 vs spec 204 WARNING(diff 밖), DELETE 멱등성 SPEC-DRIFT 재확인 |

## 발견 없는 에이전트

(없음 — 10개 reviewer 전원 최소 1건 이상의 INFO/WARNING/SPEC-DRIFT 기록. 단 전원이 "이번 PR을 막을 신규 Critical/차단 사유는 없다"고 결론)

## 권장 조치사항

1. (우선순위 유지, 별도 PR) owner 승격 TOCTOU — `delete({..., role: Not('owner')})` + `affected===0` 시 원인 재조회(행없음 vs owner변경) 처방을 자체 뮤테이션 테스트와 함께 닫을 것. 이미 트래커 등재됨, 재등재 불요.
2. (우선순위 유지, 별도 PR) `removeMember()` 권한 검사 순서를 `assertAdmin` 우선으로 재배치 — 자가 탈퇴 허용 조건·owner 대상 에러 코드 계약 변경(`CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED`)을 `spec/5-system/3-error-handling.md` 기준 별도 consistency 라운드로 함께 다룰 것.
3. (planner 턴) `spec/5-system/2-api-convention.md §3` DELETE 멱등성 표에 "동시 요청 패자는 404를 받을 수 있다" 각주 반영(SPEC-DRIFT #1, 6번째 사례) — 코드 변경 불요.
4. (low 우선순위) `plan/in-progress/spec-draft-nullable-notation-followups.md:4927`의 "다섯 *-delete-concurrency.e2e-spec.ts" 트래커 항목을 신규 `member-remove-concurrency.e2e-spec.ts` 포함하도록 갱신하거나 개수 비명시 서술로 변경.
5. (선택) `RESOLUTION.md` #3 항목에 `throwMemberNotFound()` 추출이 `updateMemberRole()`까지 포함해 3곳임을 보강 기록.
6. (급하지 않음) `wireFindOne()` mock에 `where.workspaceId` 단언 추가, `updateMemberRole()` not-found 분기 unit 테스트 추가 — 다음에 해당 테스트 블록을 만질 때 함께 처리.
7. (차기 spec 정리 시) `spec/5-system/2-api-convention.md §6`에 "DELETE 성공 코드가 컨트롤러별 204/200 두 갈래"라는 사실 각주 반영(api_contract WARNING #4, 이번 PR 스코프 아님).

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router가 이번 diff와 무관하다고 판단(성능 특성 변경 없는 원자적 DELETE 전환 + 리팩터) |
  | architecture | router가 이번 diff와 무관하다고 판단(구조적 재설계 없음, 기존 패턴 답습) |
  | dependency | router가 이번 diff와 무관하다고 판단(신규 의존성 추가 없음) |
  | user_guide_sync | router가 이번 diff와 무관하다고 판단(사용자 가이드 영향 없는 백엔드 내부 리팩터) |
