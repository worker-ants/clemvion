# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 전 10개 reviewer(강제 화이트리스트 7명 포함)가 전문을 확보했고, forced 미이행 항목 없음. `side_effect`·`documentation`·`concurrency` 3개 reviewer 가 순수 INFO 발견에도 보수적으로 LOW 를 자체 부여해 그 등급을 그대로 반영했다.

> **라우팅 무결성 확인**: forced(router_safety) 7개(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보됨 — "forced 인데 결과 없음" 없음. 인라인 전문 10건 모두 authoritative 로 반영했으며, 디스크상 대응 `<name>.md` 파일도 전부 존재함을 확인(영속화 불필요).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/api_contract | 락 안 재조회(`workspaceId` 스코프 유지) + `NotFoundException` 분리는 spec `2-trigger-list.md §4.4`("동시 삭제 시 두 번째는 404")를 line-level 로 정확히 충족. `204→404` 변경은 신규 breaking change 가 아니라 기존에 문서화된 계약을 코드가 뒤늦게 충족시킨 것 | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1101) | 조치 불필요 |
| 2 | side_effect/concurrency/database/api_contract | 스코프 밖 잔여 2건이 트래커에 정확히 등재됨: ①`releaseExternal` 이 advisory lock 취득 **전** 무조건 실행돼 동시 DELETE 시 외부 provider teardown 중복(이전 라운드부터 기지, best-effort·실패 삼킴 구조), ②`SchedulesService.remove()`(`schedules.service.ts:345`)가 락·재조회·트랜잭션 없이 같은 형태의 감사 중복 결함을 가짐(이번 라운드 신규 등재) | `triggers.service.ts:1066`, `schedules.service.ts:345`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4583-4589·4773-4783 | 조치 불필요 — 별도 후속 세션 대상, 은폐 아님 |
| 3 | maintainability/testing/database/concurrency | 직전 두 라운드(`22_07_23`,`22_39_21`) WARNING 2건이 실제로 닫혔음을 소스+뮤테이션으로 재검증: (a) 락 안 재조회 `workspaceId` 스코프를 `freshFindOptions` 캡처로 실단언(뮤테이션 시 정확히 신규 테스트 1건만 RED), (b) genuine 실패 시 `logger.error` 호출 자체를 단언 | `triggers.service.spec.ts` 게이트 4030-4064, 4127-4156 | 조치 불필요 |
| 4 | maintainability/testing/database | e2e advisory lock key 리터럴 복제를 제거하고 프로덕션 export 헬퍼 `triggerConfigLockKey` import 로 교체 — 테스트-프로덕션 lock key drift 위험 제거 | `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:8` | 조치 불필요 |
| 5 | side_effect/concurrency/database/api_contract | 이번 라운드의 실질 diff 는 테스트/문서 전용 — 프로덕션 코드(`triggers.service.ts`) 변경 없음. 함수 시그니처·공개 API·트랜잭션 경계 모두 이전 두 라운드에서 이미 NONE 판정된 것과 동일 | `triggers.service.ts` (변경 없음), `triggers.service.spec.ts` (+74/-1) | 조치 불필요 |
| 6 | scope/documentation | 트래커 정정 문구가 아직 `plan/in-progress/`에 있는 plan 을 `plan/complete/trigger-dup-delete.md` 로 선인용(실제 이동 전) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4767, 4794 | 마무리 커밋(실제 이동) 때 자연 해소, 선택적 정정 |
| 7 | documentation | 다운스트림 문서가 "side_effect·concurrency WARNING 1" 로 표기했으나 실제로는 side_effect 만 WARNING, concurrency 는 같은 관측을 INFO 로 교차 확인 — 잔여 위험 과대평가 소지(기능 영향 없음) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4585 | 조치 불필요, 굳이 정정 시 등급 분리 표기 권장 |
| 8 | maintainability | 3번째 반복되는 동시성 e2e 스캐폴드 구조 중복(`trigger-`/`workflow-`/`workspace-delete-concurrency.e2e-spec.ts`) — plan 문서가 공용 헬퍼 추출을 명시적으로 유예(별도 설계 항목) | `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 전체 | 추적 중, 네 번째 유사 사례 시 우선순위 재검토 |
| 9 | testing | 404 분기 단위 테스트가 `releaseExternal`(teardown)이 패자 쪽에서도 실행됐는지는 단언하지 않음(선택 사항, 새 결함 아님) | `triggers.service.spec.ts:4035-4064` | 선택 — `expect(events).toContain('teardown')` 고려 |
| 10 | requirement | `plan/in-progress/trigger-dup-delete.md` 체크리스트 3항목(`/ai-review` 수렴·`--impl-done`·`plan/complete/` 이동) 미완료 — 이번 라운드가 그 첫 항목 수행 과정 자체이므로 자연스러움 | `plan/in-progress/trigger-dup-delete.md` 게이트 110-112 | 이번 라운드 수렴 시 마무리 커밋에서 체크박스 갱신 + 이동 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. workspaceId 스코프 유지, 파라미터 바인딩, 시크릿 하드코딩 없음. 신규 테스트는 보안 커버리지 개선 |
| requirement | NONE | spec §4.4 line-level 일치. 3갈래(재조회 실패/성공/genuine 실패) 완결. SPEC-DRIFT 없음 |
| scope | NONE | diff 45파일 전부 목표 결함 하나에 국한, 스코프 이탈 없음 |
| side_effect | LOW | 프로덕션 변경 없음(테스트 전용). teardown 중복 잔존은 기 문서화된 잔여 |
| maintainability | NONE | 이전 WARNING 2건(lock key 리터럴, workspaceId 미단언) 해소 확인. 함수 복잡도 낮음 |
| testing | NONE | 뮤테이션 재현으로 신규 테스트 판별력 실측(RED 1/12). 전체 스위트 165/166 pass |
| documentation | LOW | plan/complete 선인용, 리뷰어 등급 표기 미세 과장 — 기능 영향 없음 |
| database | NONE | PK 단건 조회, 트랜잭션 경계 정합, 락 누수 없음 |
| concurrency | LOW | 핵심 동시성 코드 미변경(이전 판정 유효), 신규 테스트 vacuous 아님 확인 |
| api_contract | NONE | 새 엔드포인트/스키마/에러코드 없음. 기존 spec 계약을 코드가 충족 |

## 발견 없는 에이전트

없음 — 전 10개 reviewer 가 최소 1건 이상의 INFO 관측을 기록함(Critical/Warning 은 전원 0건).

## 권장 조치사항

1. (선택) `triggers.service.spec.ts` 의 404 분기 테스트에 `expect(events).toContain('teardown')` 단언을 추가해 "패자 쪽도 외부 teardown 은 실행된다"는 기지 사실을 회귀 가드로 고정 (testing #9).
2. `plan/in-progress/trigger-dup-delete.md` 체크리스트 3항목 수행: 이번 SUMMARY 수렴 확인 → `--impl-done` 실행 → 체크박스 갱신 + `plan/complete/` 이동을 한 마무리 커밋에서 함께 처리 (requirement #10, scope/documentation #6).
3. (선택, 저우선) `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4585 의 "side_effect·concurrency WARNING 1" 표기를 "side_effect WARNING 1(concurrency 는 INFO 로 교차 확인)"로 정정해 등급 혼동 예방 (documentation #7).
4. `SchedulesService.remove()`(`schedules.service.ts:345`) 의 동형 감사 중복 결함은 이번 PR 스코프 밖이며 트래커에 이미 등재됨 — 별도 후속 세션에서 advisory lock 적용 여부부터 실측 (side_effect/concurrency/database/api_contract #2).
5. 코드 변경(`codebase/**`)이 없는 라운드이므로 별도 재-`/ai-review` 불요 — Critical/Warning 0 으로 이미 수렴.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency`, `api_contract` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 없음 (성능 영향 미미한 diff) |
  | architecture | router 판단상 해당 없음 (아키텍처 변경 없음) |
  | dependency | router 판단상 해당 없음 (신규 의존성 없음) |
  | user_guide_sync | router 판단상 해당 없음 (사용자 가이드 대상 변경 없음) |
