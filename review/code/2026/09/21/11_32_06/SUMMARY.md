# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 9개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation/database/concurrency) 전원이 전문을 확보했고, forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료(누락 없음). testing·database·concurrency 3개 reviewer 가 각 LOW 위험도를 매겼으나 모두 "이번 diff 이전부터 있던 형제 공통 패턴" 또는 "기능 위험 없는 사소한 흠"으로 명시적으로 조치 불요 처리된 INFO 항목이며, 병합을 막을 사유는 없다. 직전 라운드(`review/code/2026/09/21/10_54_47`)의 Critical 0·WARNING 3건이 전부 조치(RESOLUTION.md, 커밋 `74a9e714b`/`5bbdf753d`/`8504d52c0`)됐음을 9개 reviewer 가 독립적으로 재검증했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/documentation | spec `4-integration.md` §9.1 DELETE 행에 "동시 삭제 시 진 쪽 404" 서술이 없음(spec 침묵) — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 등재, `--impl-prep` consistency-check 도 비차단 WARNING 으로 처분됨 | `spec/2-navigation/4-integration.md:814`; 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:4813-4821` | 조치 불요(등재 상태 유지, 다음 spec 라운드에서 project-planner 반영) |
| 2 | testing/requirement | `integrations.service.spec.ts` mock 셋업의 `remove: jest.fn().mockResolvedValue(undefined)` 스텁이 이제 어떤 테스트에서도 호출·단언되지 않는 죽은 fixture | `codebase/backend/src/modules/integrations/integrations.service.spec.ts:131` | 다음 근접 편집에서 제거 권장(이번 PR 필수 아님) |
| 3 | scope | `throwIntegrationNotFound()` 헬퍼 추출이 이번 버그(동시 DELETE 감사 중복)와 무관한 4개 메서드(`findById`/`update`/`rotate`×2/`requireEntity`)까지 건드림 — 단, 직전 리뷰 WARNING #2 를 조치한 별도 커밋(`5bbdf753d`)이며 기계적 1:1 치환임을 diff 대조로 확인 | `integrations.service.ts:602,613-618,740,1191,1219,1480` | 조치 불요(문서화된 후속 조치, 스코프 위반 아님) |
| 4 | testing | 신규 e2e(`integration-delete-concurrency.e2e-spec.ts`)가 진 쪽 응답의 상태 코드(404)만 확인하고 에러 `code` 본문은 확인하지 않음 — 형제 4개 중 workflow/trigger 와 동일 수준, workspace 보다는 판별력이 약하나 이번 diff 의 후퇴는 아니며 정확한 코드는 unit 레벨(`integrations.service.spec.ts:1083`)에서 이미 고정됨 | `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts:68-76,103` | 이번 PR 필수 아님. 다음에 e2e 계열 함께 손볼 때 `{status, body}` 확장 검토 |
| 5 | database/concurrency | 원자적 `DELETE` 커밋과 감사 로그 기록(`auditLogsService.record`)·`broadcastCredentialChange` 가 단일 트랜잭션으로 묶여 있지 않음 — 형제 4경로(workflow/workspace/trigger/schedule)와 동일한 기존 설계이며 이번 diff 가 만든 회귀 아님 | `integrations.service.ts:799-817` | 조치 불요(형제와 일관). "삭제+감사 원자성" 트래커가 생기면 함께 검토 |
| 6 | database/security | 사용처 검사(`queryUsageNodes`)와 원자적 `delete` 사이 TOCTOU 잔존 — 종전 코드에도 있던 사안, `plan/in-progress/integration-dup-delete.md` 에 명시적으로 스코프 아웃·트래커 등재됨 | `integrations.service.ts:774-799` | 조치 불요(의도된 스코프 경계) |
| 7 | database/concurrency | 감사 로그 `details`(`serviceType`/`name`)가 잠금 없는 `findOne` 시점 스냅샷 — stale 가능성 있으나 형제 구현과 동일 패턴, 직전 라운드에서 이미 조치 불요 처분 | `integrations.service.ts:765-768, 809-813` | 조치 불요(기존 처분 유지) |
| 8 | documentation | `RESOLUTION.md`(10_54_47 라운드)의 조치 전 줄 번호 인용(`:1175`,`:1197`)이 최종 파일 실제 줄 번호(`:1176`,`:1198`)와 1줄 어긋남 — 이미 종결된 사후 기록이라 재작업 불요 | `review/code/2026/09/21/10_54_47/RESOLUTION.md` | 조치 불요(참고 기록, 향후 유사 작성 시 습관 개선) |
| 9 | maintainability | 신규 e2e 파일이 형제 4개(workflow/workspace/trigger/schedule)와 구조·명명을 의도적으로 복제 — 이 저장소의 기존 의도된 미러 중복 패턴(예: cafe24/makeshop 미러)과 동일하게 판단, 결함 아님 | `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` | 지금은 조치 불요. plan 이 예고한 6번째 반복(`WorkspacesService.removeMember()`) 시점에 공통 헬퍼 추출 검토 가치 있음 |
| 10 | security | e2e 자격증명 값(`e2e-intdel-token`)은 로컬 fixture 이며 실제 시크릿 아님 | `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` | 조치 불요 |
| 11 | security/requirement/scope/side_effect/maintainability/testing/documentation/database (교차 확인) | 삭제 SQL 에 `workspaceId` 조건 유지(테넌트 격리 회귀 없음), ORM lifecycle hook·cascade 부재로 `remove()`→`delete()` 전환에 따른 부수효과 누락 없음, `throwIntegrationNotFound()` 7곳 전부 정상 반영, CHANGELOG/트래커 교차 인용 실측 일치, conflict-path 단언이 죽은 mock 대신 `delete` 를 올바르게 겨냥하도록 수정 확인 — 직전 라운드 WARNING 3건 전부 조치 완료를 재검증 | 다수 파일(각 reviewer 본문 참고) | 조치 불요(긍정 확인, 회귀 없음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테넌트 격리·SQL 인젝션·정보노출 회귀 없음. e2e 자격증명은 fixture |
| requirement | NONE | 기능 완전성·엣지케이스·spec fidelity 확인. spec §9.1 침묵은 이미 트래커 처리, 미사용 mock 정리 대상만 잔존 |
| scope | NONE | 핵심 변경은 결함 하나에 정확히 국한. 헬퍼 추출 확장은 문서화된 별도 후속 조치 |
| side_effect | NONE | ORM 훅 우회 영향 없음(hooks 0건 확인), 감사/broadcast 스킵은 의도된 중복 제거 |
| maintainability | NONE | 직전 라운드 WARNING #2(리터럴 중복) 완전 해소 재검증. 복잡도·중첩 적절 |
| testing | LOW | conflict-path 단언 수정 확인(WARNING #1 해소). 미사용 mock 스텁·e2e 판별력 약함은 비차단 |
| documentation | NONE | CHANGELOG/JSDoc/주석 교차 인용 전수 실측 일치. spec 갭은 트래커 등재 상태 |
| database | LOW | 인덱스·트랜잭션·FK CASCADE 확인. 삭제-감사 비원자성·TOCTOU 는 형제 공통 기존 패턴 |
| concurrency | LOW | 원자적 DELETE+`affected===0` 명시 비교가 실제 경쟁조건을 정확히 닫음(대조군 테스트로 뒷받침). 잔존 비원자성은 기존 처분 유지 |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 1건 이상의 INFO 관찰을 남겼으나 전원 Critical/Warning 없음(NONE 6, LOW 3).

## 권장 조치사항

1. (선택, 비차단) `integrations.service.spec.ts:131` 의 미사용 `remove` mock 스텁 제거 — 다음 근접 편집 시.
2. (선택, 비차단) 신규 e2e 의 진 쪽 응답 검증을 `{status, body}` 로 확장해 `RESOURCE_NOT_FOUND` 코드까지 확인 — workspace 형제 수준으로 판별력 강화(다음 e2e 계열 정비 시).
3. (등재 유지) `spec/2-navigation/4-integration.md` §9.1 의 "동시 삭제 시 진 쪽 404" 서술은 project-planner 의 다음 spec 라운드로 이관(이미 트래커 등재, 이번 PR 조치 불요).
4. 그 외 즉시 조치가 필요한 항목 없음 — 이번 PR 은 병합 가능 상태로 판단됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(구체적 사유는 routing manifest 에 미기재) |
  | architecture | 라우터 판단(구체적 사유는 routing manifest 에 미기재) |
  | dependency | 라우터 판단(구체적 사유는 routing manifest 에 미기재) |
  | api_contract | 라우터 판단(구체적 사유는 routing manifest 에 미기재) |
  | user_guide_sync | 라우터 판단(구체적 사유는 routing manifest 에 미기재) |
