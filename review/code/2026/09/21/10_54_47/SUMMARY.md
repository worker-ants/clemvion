# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 이번 diff 가 방어하려던 결함 클래스(사용 중인 통합을 실수로 삭제)와 정확히 같은 지점을 지키는 기존 conflict-path 단위 테스트 2건이 `remove()`→`delete()` 리팩터로 죽은 mock 을 겨냥해 vacuous 해졌음이 뮤테이션으로 실측 확인됐다(testing, WARNING). 그 외 유지보수성·문서화 WARNING 2건은 LOW 수준이다. router forced 화이트리스트(7명) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | conflict-path 회귀 테스트 2건(`expect(integrationRepo.remove).not.toHaveBeenCalled()`)이 `remove()`→`delete()` 전환 이후 **vacuous** — `remove` mock 은 어떤 경로로도 호출되지 않아 사용 중인 통합을 실제로 지워버리는 회귀도 통과시킨다. 뮤테이션 삽입 실측: conflict 분기에 실제 `delete()` 호출을 끼워 넣어도 두 테스트 모두 GREEN(원복 완료, `git status --short` 클린 확인). | `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1175`, `:1197` | 두 단언을 `expect(integrationRepo.delete).not.toHaveBeenCalled();` 로 교체 |
| 2 | maintainability | 신규 404 분기(`NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })`)가 같은 함수 8줄 위 리터럴을 손으로 복제 — 형제 모듈(schedules/triggers)은 같은 시점에 `throwXNotFound(): never` 헬퍼로 이 패턴을 뽑아냈는데 `integrations.service.ts` 는 반영하지 않아 동일 리터럴이 파일 전체 7곳으로 늘었다. | `codebase/backend/src/modules/integrations/integrations.service.ts:804-809` (대조: `:765-770`) | `throwIntegrationNotFound()` 헬퍼 추출 후 `findById`/`update`/`remove` 3지점에서 재사용 (이번 diff 필수는 아님) |
| 3 | documentation | `CHANGELOG.md` 에 이번 수정 항목 누락 — 같은 "동시 DELETE 두 건 감사 중복" 결함 클래스를 고친 형제 PR 4건(workflow/trigger/schedule/rotate) 모두 항목을 남겼고, 그중 3건은 "커밋 시 빠뜨렸다가 리뷰 후 후속 커밋으로 채운" 이력이 있다. 이번 PR 이 다섯 번째 재발. | `CHANGELOG.md` (Unreleased 최상단, 이번 diff 미포함) | 형제 항목과 동일한 3단 구성(문제–판별자–고친 것)으로 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, api_contract | `broadcastCredentialChange` 직전 주석이 "TypeORM `remove(entity)` 후 `entity.id` 가 unset 될 수 있다"는 이제 적용되지 않는 옛 API 근거를 그대로 인용(결론은 여전히 맞음) | `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()`, `broadcastCredentialChange(id)` 호출 직전 주석 | 근거 문구를 "delete(criteria) 는 entity 를 변형하지 않지만 명확성을 위해 id 사용" 으로 갱신 |
| 2 | requirement, documentation, api_contract, user_guide_sync | `spec/2-navigation/4-integration.md` §9.1 에 "동시 삭제 → 두 번째 요청 404" 서술 없음 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4813` 트래커에 이번 diff 가 스코프 확장으로 등재, `--impl-prep` consistency-check 도 WARNING(비차단) 처리 | `spec/2-navigation/4-integration.md` §9.1 | 조치 불요 — 등재 상태 유지(developer 권한 밖) |
| 3 | side_effect, api_contract | 경합에서 진 두 번째 DELETE 의 응답이 `204`→`404` 로 바뀌는 wire-level 행동 변경(breaking change 아님, 형제 3건과 동일 패턴) | `integrations.service.ts:800-809` | 위 #2 트래커로 커버, 별도 조치 불요. FE/외부 SDK 가 "재시도=항상 204" 가정하는지는 별도 트랙에서 확인 권장 |
| 4 | database, concurrency | `delete()` 성공과 감사 로그 기록·`broadcastCredentialChange` 가 단일 트랜잭션으로 묶이지 않음 — 형제 4경로(workflows/triggers/schedules/integrations) 공통 기존 패턴, 이번 PR 신규 회귀 아님 | `integrations.service.ts:800-823` | 조치 불요(형제와 일관). 향후 "삭제+감사 원자성" 트래커가 생기면 4경로 함께 다룰 것 |
| 5 | security, database, concurrency | 사용처 검사(`queryUsageNodes`)와 `delete` 사이 TOCTOU 잔존 — `plan/in-progress/integration-dup-delete.md` "이 PR 이 하지 않는 것" 에 명시적으로 스코프 아웃, 트래커 등재됨 | `integrations.service.ts:775-809` | 조치 불요(별도 트래킹) |
| 6 | concurrency | 감사 로그 `details`(`serviceType`/`name`)가 `findOne` 시점 스냅샷 — `delete` 완료 전 다른 요청이 값을 갱신하면 감사 메타데이터가 stale 할 수 있음(영향 낮음) | `integrations.service.ts:762`, `:816-819` | 조치 불요 (형제 구현과 동일 패턴) |
| 7 | testing | 대조군 테스트(`affected` 미보고 드라이버)에서 `integrationCacheBus.publish.mockClear()` 만 하고 이후 단언이 없음 | `integrations.service.spec.ts:1097-1108` | `expect(integrationCacheBus.publish).toHaveBeenCalled();` 추가 또는 `mockClear()` 제거로 의도 명확화 |
| 8 | side_effect | `remove(entity)`→`delete(criteria)` 전환이 TypeORM 라이프사이클 훅(`@BeforeRemove`/subscriber)을 우회하나, 저장소 전체에 그런 훅이 0건이라 실질 영향 없음(grep 실측). 이 판단 근거가 코드/plan 어디에도 문서화되지 않아 다음 사람이 다른 엔티티에 같은 전환을 적용할 때 재검증 없이 "선례 있으니 안전"으로 오판할 여지 | `integrations.service.ts:800` | 이번 PR 조치 불요. 같은 패턴을 다른 엔티티에 반복 적용할 계획이면 판단 기준(cascade/관계 없음 + subscriber 없음)을 명시적으로 남길 것 |
| 9 | maintainability | 신규 e2e 가 형제 4파일(workflow/workspace/trigger/schedule-delete-concurrency)과 구조·매직넘버까지 거의 동일 복제 — 이 저장소의 의도된 미러 패턴(cafe24/makeshop 선례)이라 DRY 위반 아님. plan 이 예고한 6번째 자리(`WorkspacesService.removeMember`)까지 반복되면 공통 헬퍼 추출 검토 가치 | `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` | 지금은 조치 불요, 다음 반복 시 검토 |
| 10 | (운영 메모) | maintainability 리뷰 도중 공유 워크트리에 이 세션이 만들지 않은 일시적 미커밋 뮤테이션(`// MUTATION-PROBE`)이 관측됐다(다른 병렬 reviewer 의 검증 흔적으로 추정). SUMMARY 작성 시점 `git status --short`/`git diff --stat` 재확인 결과 현재 작업 트리는 클린하다 — 이미 해소됨 | `codebase/backend/src/modules/integrations/integrations.service.ts` (현재는 diff 없음) | 조치 불요(이미 해소 확인). 병합 직전 `git status --short` 한 번 더 확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 워크스페이스 격리 유지, 정보 노출 없음, TOCTOU 는 기존부터 스코프 아웃됨 |
| requirement | NONE | 기능/엣지케이스/spec fidelity 충족, stale 주석 1건(INFO) |
| scope | NONE | 변경이 결함 하나에 정확히 국한, 무관한 파일 수정 없음 |
| side_effect | NONE | 204→404 wire 변경은 의도된 것, ORM 훅 우회 영향 없음 실측 확인 |
| maintainability | LOW | `RESOURCE_NOT_FOUND` 리터럴 중복(형제는 헬퍼 도입) — WARNING |
| testing | MEDIUM | conflict-path 테스트 2건이 뮤테이션으로 vacuous 확인됨 — WARNING |
| documentation | LOW | `CHANGELOG.md` 항목 누락(형제 4건은 모두 남김) — WARNING |
| database | LOW | 삭제+감사 비원자성·TOCTOU 는 기존 패턴, 인덱스/트랜잭션/인젝션 문제 없음 |
| concurrency | LOW | 행 잠금 직렬화로 경쟁 조건 정확히 해소, 대조군 테스트로 `!affected` 함정 방어 확인 |
| api_contract | LOW | 응답 스키마/에러 포맷 불변, 404 재사용은 기존 규약과 일관 |
| user_guide_sync | NONE | doc-sync-matrix 21행 전부 미매칭, 동반 갱신 대상 없음 |

## 발견 없는 에이전트

- scope (발견사항 없음)
- user_guide_sync (발견사항 없음, 매트릭스 미매칭)

## 권장 조치사항

1. (WARNING #1, testing) `integrations.service.spec.ts:1175`, `:1197` 의 `expect(integrationRepo.remove).not.toHaveBeenCalled()` 를 `expect(integrationRepo.delete).not.toHaveBeenCalled()` 로 교체 — 병합 전 우선 조치 권장(뮤테이션으로 실측된 vacuous 테스트).
2. (WARNING #3, documentation) `CHANGELOG.md` 에 형제 4건과 동일한 3단 구성으로 이번 수정 항목 추가.
3. (WARNING #2, maintainability) 여유가 되면 `throwIntegrationNotFound()` 헬퍼를 추출해 형제 모듈(schedules/triggers) 관례에 정렬 — 이번 PR 필수 아님.
4. (INFO #7, testing) 대조군 테스트에 `integrationCacheBus.publish` 단언 추가 또는 무의미한 `mockClear()` 제거.
5. (INFO #1) `broadcastCredentialChange` 인접 주석의 stale 근거 문구를 다음 근접 편집 때 정리.
6. 병합 직전 `git status --short` 로 공유 워크트리 잔존 뮤테이션(`// MUTATION-PROBE` 류) 없음을 한 번 더 확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음
  - **제외**: 3명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(제외 사유 상세 미제공) |
  | architecture | router 판단(제외 사유 상세 미제공) |
  | dependency | router 판단(제외 사유 상세 미제공) |
