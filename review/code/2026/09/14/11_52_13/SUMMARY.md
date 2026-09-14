# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 없음(신규 devtime repo-guard + e2e 단언 추가 + 캐너리 주석 정리뿐). Critical 없음. WARNING 2건은 모두 논블로킹(하나는 `developer` 권한 밖이라 이미 plan 트래커에 등재된 spec 메타데이터 갭, 다른 하나는 신규 방어 분기의 영구 테스트 결속 누락). forced 화이트리스트 7명(security·requirement·scope·side_effect·maintainability·testing·documentation) 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `2-trigger-list.md` frontmatter `code:` 가 §3(`TriggerDto.workflow` 계약)의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts`(+헬퍼)만 등재하는데, 이번 diff 가 `schedule-trigger.e2e-spec.ts`에 추가한 3개 단언(C-2/G/H)도 같은 §3 계약을 schedule 타입에 대해 처음 시행함 — 코드가 spec 을 위반하는 방향이 아니라 spec 문서의 `code:` 메타데이터가 실제 시행 파일 집합보다 좁아진 것 | `spec/2-navigation/2-trigger-list.md:20-26` vs `codebase/backend/test/schedule-trigger.e2e-spec.ts:237,366,404` | `project-planner` 턴에서 frontmatter `code:`에 `schedule-trigger.e2e-spec.ts` 추가. `developer`는 `spec/` 쓰기 권한이 없어 `plan/in-progress/spec-draft-nullable-notation-followups.md:3935-3941`에 이미 정당하게 등재됨(우회 아님) — 코드 쪽 추가 조치는 불요 |
| 2 | testing | 라운드1 지적("파일 부재 미방어")을 받아 새로 추가한 `existsSync` 방어 분기가 영구 회귀 테스트로 결속되지 않음 — 검증은 리뷰 세션 중 저장소 파일을 수기로 리네임했다 원복하는 방식뿐이었고, 커밋된 spec 에는 이 분기를 타는 `it()`이 0건이라 CI가 이 분기의 회귀를 못 잡음(문구 삭제·로직 제거해도 9/9 GREEN 유지) | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(`readStringArrayConst`의 `!fs.existsSync(abs)` 분기), `.../trigger-secret-columns.spec.ts`(대조군 블록에 해당 케이스 없음) | `[대조군]` 블록에 `expect(() => readStringArrayConst(tmp, 'no-such-file.ts', 'X')).toThrow(/가 없다|옮겨졌거나/)` 케이스 1건 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability, documentation | 라운드1 vacuous 삼항식 수정 과정에서 남은 불필요한 중첩 템플릿 리터럴(`${'문자열 리터럴'}`을 또 다른 템플릿 안에 감쌈) — 동작 영향 없음, 파일 내 스타일 일관성만 소폭 저하 | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (`throw new Error(...)` 메시지부) | `` `${rel}: 상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것` `` 로 단순화(선택) |
| 2 | requirement | `GET /api/triggers/:id`(단건 조회) 의 schedule 타입 `workflow` 양성 커버리지 0건 — plan 이 명시적으로 인지하고 트래커에 별도 항목으로 유예(은폐 아님) | `codebase/backend/test/schedule-trigger.e2e-spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md:3958-3963` | 블로킹 아님, 트래커 항목 존재로 충분 |
| 3 | requirement | `secret-store.md` 문서 자체의 내부 명명 불일치 — §2.1 근방은 `TriggersService.remove()`, §R4는 `TriggersService.delete()`로 서로 다르게 지칭(이번 diff 무관, 기존 spec 결함) | `spec/conventions/secret-store.md:390` vs `:428` | 차기 `project-planner` 턴에서 §R4의 `delete()`를 `remove()`로 정정 |
| 4 | testing | `readStringArrayConst`가 이름이 같은 비-최상위(지역) 선언과 실제 최상위 목록을 구분하지 않음 — 현재 감시 대상 3개 실파일엔 해당 없어 실위험 낮음 | `trigger-secret-columns-guard.ts`의 `visit()`(사전순회 후 첫 일치 선언 채택) | 급하지 않음. 필요 시 JSDoc에 "최상위 선언 하나만 있다고 가정" 명시 |
| 5 | testing | G/H(`schedule-trigger.e2e-spec.ts`)의 `expectTriggerWorkflowRef`는 원 회귀(chatChannel 재조회 분기)의 정확한 분기를 재현하지 않음 — 단 schedule 타입은 PATCH로 `chatChannel`을 구조적으로 보낼 수 없어(`disallowed.push('chatChannel')`) 결함 아님, 더 일반적인 회귀(관계 유실)를 지킴 | `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`it('G. ...')`/`it('H. ...')`), `triggers.service.ts` `update()` | 조치 불요. 필요 시 호출부 주석 한 줄로 오독 방지 |
| 6 | scope | 라운드2 커밋(`4c1a49b30`)이 코드 fix 3파일 + 트래커 갱신 2파일 + harness 산출물 25파일을 한 커밋에 함께 묶음 — 내용 충돌·은폐 없음, 저장소 MEMORY가 권장하는 "리뷰-only 커밋 분리" 관례와는 다소 어긋남(하드 룰 여부는 문서상 불명확) | 커밋 `4c1a49b30` | 참고용, 블로킹 아님 |
| 7 | security/side_effect/maintainability | 신규 repo-guard·spec은 하드코딩 경로만 읽는 순수 함수, `os.tmpdir()` 격리+`afterAll` 정리로 봉쇄, e2e 3곳 신규 단언은 기존 export 헬퍼 재사용뿐이라 신규 노출/부작용 표면 없음 | `trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`, `schedule-trigger.e2e-spec.ts` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 프로덕션 코드·인증/인가·암호화·네트워크 호출 없음. 하드코딩 상수 경로만 읽는 AST 정적 가드, 더미 시크릿, `secret_store` 삭제 경로(§R4) 스코프 분리 서술 정확 |
| requirement | LOW | vacuous 삼항식(전 라운드 WARNING) 수정 확인. WARNING 1건(spec `code:` 갭, 권한 밖·트래커 등재됨), INFO 3건(단건 조회 커버리지 유예, secret-store.md 명명 불일치, 엣지케이스 검증 완료) |
| scope | NONE | 36개 파일 전부 4개 plan 항목 또는 라운드1 지적 처분에 1:1 대응, 이탈 없음. 커밋 분리 미준수는 참고용 INFO |
| side_effect | NONE | 순수 읽기 전용 guard, tmp 격리 정리, 기존 헬퍼 재사용 단언만 추가. 프로덕션 부작용 없음 |
| maintainability | NONE | vacuous 삼항식 올바르게 if/throw 로 분리됨. 사소한 중첩 템플릿 리터럴 잔재(INFO)만 |
| testing | LOW | WARNING 1건(신규 existsSync 방어 분기가 영구 테스트로 결속 안 됨), INFO 2건(동명 지역선언 미검증, G/H가 원 회귀 정확 재현은 아니나 결함 아님) |
| documentation | NONE | 라운드1 INFO 3건(헤더 축·plan 수치·CHANGELOG) 모두 해소 확인, grep 재실측 바이트 단위 일치. 중첩 템플릿 리터럴 동일 관찰(INFO) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 수준 관찰을 보고했으나(대부분 "문제 없음" 확인성 기록), Critical 은 전원 0건.

## 권장 조치사항

1. `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 대조군 블록에 "대상 파일 자체가 없는 경우" 케이스 1건 추가하여 `existsSync` 방어 분기를 영구 회귀 테스트로 결속 (testing WARNING).
2. 다음 `project-planner` 턴에서 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 추가 (requirement WARNING, `developer` 권한 밖이라 트래커에 정당 등재된 상태 — 급하지 않음).
3. (선택, 급하지 않음) `trigger-secret-columns.spec.ts`의 불필요한 중첩 템플릿 리터럴 단순화.
4. (선택, 급하지 않음) 차기 `project-planner` 턴에서 `secret-store.md §R4`의 `TriggersService.delete()`를 `remove()`로 정정 — 이번 PR 범위 밖의 기존 spec 결함.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — router 자체 선택은 0명이었고 안전 화이트리스트가 전원을 강제 포함시킴). **forced 전원 결과 확보됨 — 미이행 없음.**
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 프로덕션 런타임 코드 변경 없음(devtime 테스트/가드 전용) — 무관 판단 |
  | architecture | 신규 모듈 경계·의존성 구조 변경 없음 — 무관 판단 |
  | dependency | package.json/의존성 변경 없음 — 무관 판단 |
  | database | 스키마/쿼리 변경 없음(기존 파라미터화 쿼리만 재확인) — 무관 판단 |
  | concurrency | 신규 동시성 로직 없음 — 무관 판단 |
  | api_contract | API 응답 스키마 변경 없음(기존 `TriggerDto.workflow` 필드에 대한 e2e 단언 추가뿐) — 무관 판단 |
  | user_guide_sync | 사용자 대면 기능/UI 변경 없음(devtime 테스트 하드닝) — 무관 판단 |