# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(documentation: 캐너리 self-spec 헤더의 "다섯 자리"가 실제로는 6곳이며 형제 e2e 파일 자신의 "여섯 형태" 서술과도 모순). 프로덕션 서비스 코드(`triggers.service.ts` 등)는 이번 브랜치에서 전혀 수정되지 않았고, forced 7명 전원(security·requirement·scope·side_effect·maintainability·testing·documentation) 결과가 인라인 전문으로 확보되어 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `trigger-workflow-ref.spec.ts` 헤더가 "다섯 자리"에서 `TriggerDto.workflow` 를 확인한다고 서술하나, 실측(`grep -c 'expectTriggerWorkflowRef(' trigger-workflow-ref.e2e-spec.ts`)은 6곳이고, 그 e2e 파일 자신의 헤더도 "여섯 형태"로 명시해 두 문서가 서로 다른 수(5 vs 6)를 주장한다. 이 배치는 정확히 이 형태의 결함("N개를 열거하고 N-1개만 잠근다")을 다섯 차례 반복해 잡아 온 이력이 있어 방치 시 여섯 번째 사례가 된다. | `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:8-9` (편집 hunk 밖 인접 줄, 이번 PR 이 만든 결함은 아니고 헬퍼 도입 커밋(`5b458b1ec`)부터 있던 값) | "다섯 자리"를 "여섯 자리"로 정정하거나, 숫자 중복 유지보수를 없애기 위해 `trigger-workflow-ref.e2e-spec.ts` 헤더를 SoT 로 참조만 하도록 변경. 이번 PR 스코프 밖이면 최소한 `spec-draft-nullable-notation-followups.md` 트래커에 등재. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `as`/`satisfies`/괄호 unwrap 로직이 `user-entity-exposure-guard.ts` 와 거의 동일한 형태로 두 번째 독립 구현됨(괄호 처리 여부는 실제 제약 차이에서 온 합리적 발산) | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:68` vs `user-entity-exposure-guard.ts:208` | 지금 통합 강제 불필요(규칙-of-3 미달). 세 번째 guard 가 같은 unwrap 을 요구하면 공용 유틸(`unwrapExpressionWrappers`) 승격 검토하도록 짧게 메모 |
| 2 | testing | `readAllTriggerSecretColumnLists`(배선 함수) 자체를 겨냥한 단위 테스트는 없음 — 원자 함수(`readStringArrayConst`)는 12케이스로 충분히 잠겨 있어 기존 라운드에서 조치 불요로 처분된 사항 재확인 | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:109-123` | 조치 불필요 |
| 3 | testing | plan 체크리스트의 "9건 GREEN" 수치가 최신 상태(현재 12/12 GREEN, 라운드 1~4에서 대조군 추가)와 어긋남 — 코드 정확성엔 영향 없음 | `plan/in-progress/trigger-canary-hardening.md`(항목 1 체크리스트 줄) | "9건 GREEN(라운드 0 시점) → 라운드 1~4 각각 대조군 추가로 최종 12건" 각주 갱신 또는 최종 수치로 통일 |
| 4 | side_effect | 신규 spec 의 `beforeAll`이 `mkdtempSync` 단계에서 예외를 던지면 `tmp` 미할당 상태로 `afterAll`의 `fs.rmSync(tmp, ...)`가 별도 예외를 낼 수 있음(실질 잔여 파일 발생은 없음, 극히 이례적 환경 실패 경로) | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` `beforeAll`/`afterAll`(119-124행) | 신경 쓰인다면 `tmp: string \| undefined` 선언 + `afterAll`에서 `if (tmp) fs.rmSync(...)` 가드 추가. 차단 사유 아님 |
| 5 | requirement / SPEC-DRIFT 아님 | `secret-store.md §R4`가 `TriggersService.delete()`라 적지만 실제 메서드명은 `remove()` — 코드가 만든 drift 가 아니라 spec 쪽 기존 오탈자이며, 새 e2e JSDoc이 이를 처음 명시적으로 인용함. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3945`에 planner 항목으로 등재됨(developer 권한 밖) | `spec/conventions/secret-store.md:428`, `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:153-167` | 추가 조치 불필요(이미 등재됨) |
| 6 | scope | 4개 fix 커밋(`4c1a49b30`/`3f5e451b3`/`1a99f07a4`/`026fbb610`) 각각이 코드 수정 + plan 체크리스트 갱신 + 해당 라운드 리뷰 산출물을 한 커밋에 담음 — 권장 순서(코드 커밋→세션→SUMMARY→리뷰-only 커밋)와 다르나, 라운드 2 RESOLUTION에서 "다음 배치에서 지킨다"로 이미 자체 기록된 사항이고 실질 스코프 이탈은 없음 | 커밋 4건의 `git show --stat` | 조치 불필요(이미 등재·설명됨), 향후 별개 작업에서 순서 준수 |
| 7 | security/side_effect/scope/requirement/maintainability/testing/documentation (교차 확인) | 신규 repo-guard·spec 은 하드코딩 상수 경로만 읽는 순수 함수, `os.tmpdir()` 격리+`afterAll` 정리로 저장소 트리 밖 봉쇄, 기존 export 헬퍼(`expectTriggerWorkflowRef`) 재사용으로 시그니처 변경 없음, 프로덕션 코드 무편집, 새 인젝션 표면·시크릿 하드코딩·인증 변경 없음 — 전 reviewer 공통 확인 | 변경된 6개 파일 전체 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 무변경, 하드코딩 상수 경로만 읽는 순수 devtime AST 가드, 새 인젝션 표면 없음 |
| requirement | NONE | 비밀 컬럼 3중 사본 값 일치, `TriggerDto.workflow` 커버리지가 실제 로드 경로에 정확히 배치, spec 오탈자는 코드 drift 아님(이미 등재) |
| scope | NONE | codebase 실질 변경 6개 파일 전부 plan 4항목에 1:1 대응, fix 4회도 신설 spec 파일 내부에 국한 |
| side_effect | NONE | 전역 상태·환경변수·네트워크 호출 신규 도입 없음, 임시 파일 I/O는 tmpdir 격리+정리 |
| maintainability | NONE | 기존 guard 관례와 정렬, unwrap 로직 중복은 실제 제약 차이에 따른 합리적 발산(INFO) |
| testing | NONE | 4라운드 결과물 뮤테이션 재현으로 독립 재검증, 신규 타입 오류 없음 |
| documentation | LOW | 캐너리 헤더 "다섯 자리" vs 실측 6곳 불일치(WARNING 1건), 그 외 인용·수치 전수 정확 |

## 발견 없는 에이전트

없음 (모든 reviewer 가 최소 INFO 이상 기록, documentation 만 WARNING 1건).

## 권장 조치사항
1. `trigger-workflow-ref.spec.ts:8-9`의 "다섯 자리"를 실제 호출 수(6곳)와 일치하도록 정정하거나, 숫자 중복 유지보수를 없애기 위해 `trigger-workflow-ref.e2e-spec.ts` 헤더를 단일 SoT 로 참조하는 형태로 변경한다.
2. (선택) plan `trigger-canary-hardening.md`의 "9건 GREEN" 수치를 현재 12/12 로 갱신한다.
3. (선택) `trigger-secret-columns.spec.ts`의 `beforeAll`/`afterAll` 에 `tmp` 미할당 가드를 추가해 극단적 환경 실패 시 이중 예외를 방지한다.
4. Critical 0건, Warning 1건(문서 전용, 코드 로직 무관)이므로 이번 배치는 병합 차단 사유가 없다 — WARNING 은 후속 소정정으로 처리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, forced 전원과 동일)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — **7명 전원 forced, 전원 결과 확보됨** (미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(devtime 가드·e2e 단언 추가)와 관련성 낮음 |
  | architecture | 신규 아키텍처 변경 없음(기존 repo-guard 관례 재사용) |
  | dependency | 신규 의존성 도입 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | 신규 HTTP 엔드포인트·계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 기능 변경 없음(devtime 전용) |