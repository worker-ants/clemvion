# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(문서화 관례 미이행), 나머지는 전부 INFO. 핵심 수정(`AuthConfigsService.remove()` 를 원자적 `DELETE`+`affected===0` 판정으로 전환해 동시 삭제 이중 감사 로그를 제거)은 보안·API 계약·동시성·DB 정합성 어느 축에서도 결함이 발견되지 않았다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 형제 PR 4건(#1369~#1372)이 지킨 `CHANGELOG.md` "Unreleased" 항목 관례를 이 PR(그리고 직전 형제 #1373)이 잇지 않음. 코드화된 필수 규약은 아니고 최근 2건 연속 생략 — 의도적 폐기인지 우연한 누락인지 이 PR만으로는 판별 불가 | `/CHANGELOG.md`(변경 없음) | 관례를 유지한다면 형제 4건과 같은 형태의 Unreleased 항목 추가. 폐기하기로 했다면 그 결정을 트래커에 한 줄 남겨 다음 PR(8번째 model-config, 9번째 webauthn) 작성자의 반복 질문 방지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database/requirement/concurrency | `remove()` 의 선행 `findById(id, workspaceId)` 호출이 뒤이은 원자적 `delete()`의 `affected===0` 판정과 기능적으로 중복 — 매 삭제 요청마다 SELECT 왕복 1회 추가. 정확성 문제는 없고, 신규 unit 테스트(`'대상이 없으면 DELETE 를 시도하지 않는다'`)가 지키는 의도적 트레이드오프(낭비 DELETE 회피)로 보임 | `auth-configs.service.ts:299` | 조치 불요(저빈도 관리자 액션). 정리하려면 `findById` 제거하고 `delete()`의 `affected===0` 단독 판정으로 단순화 가능 |
| 2 | side_effect/testing | 유닛 테스트 mock `delete()`가 구조분해에서 `workspaceId`를 받지 않고 `id`만으로 시뮬레이션 — "다른 workspaceId면 삭제되지 않는다"는 행동적 보장을 mock이 검증하지 못함(`toHaveBeenCalledWith` 인자 단언으로 필드 누락만 방지). 실제 DB 레벨 스코프는 e2e/프로덕션 코드로 보완되나, cross-tenant negative 테스트는 이 모듈 전체(`create`/`findById`/`update`/`remove`)에 부재(기존 관례) | `auth-configs.service.spec.ts:49-52` | 필수 아님. 여유 있으면 cross-tenant negative 테스트 백로그 추가 |
| 3 | side_effect/testing | mock 팩토리의 `remove: jest.fn(async () => undefined)`가 이번 리팩터로 어떤 경로에서도 호출되지 않는 죽은 코드가 됨 | `auth-configs.service.spec.ts:44` | 이번 PR 범위에서 제거하거나 "동시 삭제 이후 미사용" 주석 남기기 |
| 4 | requirement/documentation | `spec/2-navigation/6-config.md` §3 API 표에 "동시 삭제 → 두 번째 404" 서술 부재 — 형제 `2-trigger-list.md` §4.4 대비 문서 밀도 비대칭(7번째 인스턴스). 이미 consistency-check(INFO)와 `spec-draft-nullable-notation-followups.md` 후속 트래커가 처분·등재함, `spec_impact: none` 선언과 일치 | `spec/2-navigation/6-config.md:267` | 조치 불요(이미 처분됨). plan 본문에 근거 한 줄 추가 권장 |
| 5 | documentation | `findById()` JSDoc 호출자 목록이 `remove()`를 누락 — 이 PR 이전부터 있던 선재 stale, 이번 PR이 만든 문제 아님 | `auth-configs.service.ts` `findById` JSDoc | 이왕 `remove()` 본문을 만진 김에 호출자 목록에 `remove` 추가 권장 |
| 6 | maintainability | 동시-삭제 e2e 스펙 계열이 7개 파일로 늘었고 구조적 보일러플레이트(beforeAll/afterAll, 공허성 가드, 정렬 판정 등)가 파일마다 반복됨 | `test/auth-config-delete-concurrency.e2e-spec.ts` vs 형제 e2e 파일들 | 이번 PR 차단 사유 아님. 8번째(model-config)·9번째(webauthn) 시점에 `test/helpers/concurrency.ts` 공용 헬퍼 추출 고려 |
| 7 | requirement | 신규 e2e 감사 로그 카운트 쿼리가 `resource_type='auth_config'` 필터를 생략(형제 `integration-delete-concurrency.e2e-spec.ts`는 포함) — `resource_id`(UUID)+`action` 조합으로 이미 스코프돼 실질적 판별력 손실은 없음 | `test/auth-config-delete-concurrency.e2e-spec.ts:107-111` | 조치 불요(선택적으로 필터 추가해 형제와 정렬) |
| 8 | concurrency | e2e 공허성 가드의 `setTimeout(() => resolve('pending'), 1_500)` 타이머가 `clearTimeout` 되지 않음 — 결과에 영향 없고 `--detectOpenHandles` 진단 노이즈 수준 | `test/auth-config-delete-concurrency.e2e-spec.ts` (Promise.race 블록) | 우선순위 낮음. 필요시 타이머 핸들 저장 후 clearTimeout |
| 9 | testing | `'대상이 없으면 DELETE 를 시도하지 않는다'` 테스트의 `repo.delete.mockClear()`가 매 테스트 `beforeEach`에서 새 mock을 만들므로 사실상 no-op | `auth-configs.service.spec.ts:347` | 기능 영향 없음, 가독성 nit — 유지/삭제 무방 |
| 10 | scope | `findById()`의 인라인 404 throw를 `throwAuthConfigNotFound()` 헬퍼로 추출 — 버그 수정 자체와 별개인 기존 경로 리팩터. `remove()`가 같은 404를 두 번째로 던져야 하는 근거가 명확하고 plan에 사전 고지됨 | `auth-configs.service.ts:131-154` | 조치 불요 — 근거가 diff·plan에 이미 명시 |
| 11 | scope | `plan/in-progress/spec-draft-nullable-notation-followups.md`(다른 트래커) 2개 항목(RolesGuard 근거 정정, 6축 열거→재열거형 일반화) 편집이 같은 diff에 포함 — `plan/**` 범위 내, PR 체크리스트에 disclose됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4842-4874, 4944-4964` | 차단 사유 아님. 향후 이런 부수 정정은 별도 커밋 분리 권장 |
| 12 | side_effect | `remove(entity)`→`delete(criteria)` 전환은 TypeORM 라이프사이클 훅/구독자를 우회 — 현재 `AuthConfig`엔티티·저장소 전체에 해당 훅 0건임을 재검증해 지금은 부작용 없음. 향후 훅 추가 시 이 `delete()` 경로가 조용히 우회할 잠재 드리프트 | `auth-configs.service.ts` `remove()` (delete 호출부) | 조치 불요(주석으로 이미 문서화). 향후 훅 추가 시 상호 참조 주석 고려 |
| 13 | api_contract | 신규 `throwAuthConfigNotFound()`가 `triggers.service.ts`의 400 `AUTH_CONFIG_NOT_FOUND`(§1.11, 다른 계약)와 이름이 근접 — JSDoc으로 이미 명확히 구분해 두어(consistency-check W1 대응 완료) 실질 리스크는 낮음 | `auth-configs.service.ts:149-154` | 조치 불요(이미 완화). 후속 변경 시 두 에러 코드 혼동 주의 |

## 문제 없음으로 확인된 항목 (긍정적 검증)

- 워크스페이스 스코프: `delete({id, workspaceId})` 조건절에 `workspaceId` 명시 포함 — cross-tenant 삭제 차단, 오히려 종전(`remove(entity)`, PK만 사용)보다 강화됨 (security, api_contract, requirement, concurrency)
- `affected===0` 명시 비교 채택 — `!affected`였다면 드라이버 미보고(`null`/`undefined`)를 삭제 실패로 오판하는 회귀 발생. 대조군 테스트(`it.each([[undefined],[null]])`)로 고정 (security, database, concurrency, testing)
- 원자적 단일 `DELETE` 문 하나로 승자/패자 판별 — 별도 lock 없이 DB 직렬화에 안전하게 의존 (database, concurrency)
- 컨트롤러 외부 계약(204 성공, 404 `RESOURCE_NOT_FOUND`) 불변, breaking change 없음 (api_contract)
- 에러 메시지에 민감정보 노출 없음, SQL 인젝션 표면 없음(전부 파라미터화 쿼리) (security)
- e2e 테스트가 `SELECT ... FOR UPDATE`로 실제 겹침을 만들고 공허성 가드(`Promise.race`)로 레이스 발생 자체를 검증 — 거짓 양성 방지 (testing, concurrency)
- FK `ON DELETE SET NULL`(DB 레벨) + entity에 cascade/lifecycle hook 없음을 직접 확인 — `remove(entity)`→`delete(criteria)` 전환이 캐스케이드 동작을 바꾸지 않음 (database, side_effect, requirement)
- 신규 마이그레이션 없음, PK/인덱스로 조회되어 풀스캔 위험 없음 (database)
- doc-sync-matrix 21개 trigger 전수 대조 결과 매칭 0건 — 유저 가이드 갱신 대상 아님 (user_guide_sync)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인가 우회·정보 노출 신규 결함 없음. 워크스페이스 스코프·감사 로그 정합 정상 |
| requirement | NONE | 형제 4패턴과 처방 일치, spec 원문 대조 전부 일치. 선행 SELECT 중복·e2e 필터 생략·spec 밀도 비대칭은 비차단 INFO |
| scope | LOW | 핵심 변경은 목표에 정확히 대응. findById 헬퍼 추출과 무관 트래커 2건 편집은 disclose된 경미한 범위 확장 |
| side_effect | LOW | 공개 시그니처/전역상태/네트워크 부작용 없음. lifecycle hook 우회 잠재 드리프트, mock 스코프 느슨함은 INFO |
| maintainability | LOW | 형제 패턴과 형태 일치, 가독성 양호. e2e 보일러플레이트 누적(7번째)은 향후 추출 고려 대상 |
| testing | LOW | 회귀 커버리지 충분(정상/패자/대조군/사전확인). 죽은 mock 필드, 얕은 workspaceId mock 스코프는 INFO |
| documentation | LOW | 주석·plan 근거 실측 정확. CHANGELOG.md 관례 미이행이 유일한 WARNING |
| database | LOW | 원자성·인덱스·파라미터화 정상. 불필요한 선행 SELECT, 비트랜잭션 감사 기록은 기존 계약(신규 리스크 아님) |
| concurrency | LOW | TOCTOU 결함이 원자적 DELETE로 올바르게 해소됨. 선행 SELECT 중복, e2e 타이머 미정리는 INFO |
| api_contract | NONE | 외부 계약 불변, 오히려 테넌트 격리 강화. 에러명 근접은 JSDoc으로 이미 완화 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건 — 유저 가이드 갱신 대상 아님 |

## 발견 없는 에이전트

- user_guide_sync — "발견사항: 없음" 명시(21개 trigger 전수 대조 후 매칭 0건)

## 권장 조치사항

1. `CHANGELOG.md` "Unreleased" 항목 관례를 유지할지 결정하고, 유지한다면 형제 4건과 같은 형태로 이 PR에도 항목을 추가한다(WARNING #1).
2. (선택) mock 팩토리의 죽은 `remove` 키 제거, `delete` mock에 `workspaceId` 스코프 시뮬레이션 강화 — 다음에 이 spec 파일을 만질 때 처리.
3. (선택) `remove()`의 선행 `findById` 호출을 제거하거나, 제거하지 않는 이유(fail-fast 의도)를 plan/주석에 한 줄 남긴다.
4. (백로그) 동시-삭제 e2e 스펙 계열이 8번째(model-config)·9번째(webauthn)에 도달하면 `test/helpers/concurrency.ts` 공용 헬퍼로 추출 검토.
5. Critical/차단 사유 없음 — 이 외 조치는 전부 선택적.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 변경(단건 DELETE 경로, 저빈도 관리자 액션)에 성능 영향 표면 없음 |
  | architecture | 형제 4건과 동일한 아키텍처 패턴 재사용, 신규 구조적 결정 없음 |
  | dependency | 신규/변경 의존성 없음 |

관련 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/authconfig-dup-delete-7e3a1c/review/code/2026/09/21/15_18_16/{security,requirement,scope,side_effect,maintainability,testing,documentation,database,concurrency,api_contract,user_guide_sync}.md` (전부 디스크에 이미 존재 확인, 누락 없음)
- SUMMARY.md 자체 Write는 하네스에 의해 차단됨(basename 정확 일치 규칙) — 위 전문을 호출자가 `summary_output_file`에 멱등 기록해야 함
