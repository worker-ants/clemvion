# 요구사항(Requirement) 리뷰

## 검토 방법

프롬프트가 조립한 diff 는 코드 변경 13개 파일 + `review/**`·`plan/**` 하위의 과거 리뷰 세션
아티팩트(수십 개, 이미 지난 라운드 산출물의 재커밋) 로 구성돼 있다. 프롬프트 내 다수 파일이
"diff 생략" 처리돼 있어, 실제 저장소(`git diff origin/main...HEAD`)를 직접 열어 전체 diff 를
확인하고 핵심 정합성 주장(구조적 가드의 실측 카운트, spec 문언, 타입체크·테스트·lint)을 코드
실행으로 재검증했다:

- `tsc -p tsconfig.build.json --noEmit` — 에러 0
- 관련 jest 스위트(`update-returning-rows`, `assert-row-array`, `source-scan`, `auth-oauth.service`,
  `execution-engine.service`, `knowledge-base.service`) 전체 GREEN (544 passed)
- `eslint --max-warnings 0` — 경고 0
- 구조적 회귀 가드가 주장하는 실측 카운트(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`
  의 `EXPECTED`/`counts` 배열)를 동일 정규식으로 직접 재계산해 전수 일치 확인
- `spec/data-flow/2-auth.md` §1.3, `spec/conventions/error-codes.md`, `spec/2-navigation/4-integration.md`
  의 `OAUTH_STATE_MISMATCH` 400·"row 없으면 거절/provider 불일치 거절" 문언과 수정 후 코드
  (`auth-oauth.service.ts` `handleCallback`) 대조 — line-level 일치
- `spec/5-system/1-auth.md:721` 의 remember-me 30일/7일 문언과 e2e(`auth-oauth-callback.e2e-spec.ts`)의
  `MAX_AGE_REMEMBER_ME`/`MAX_AGE_DEFAULT` 상수 대조 — 일치
- TypeORM 튜플 shape 버그의 "8곳" 목록이 실제로 8곳(execution-engine 2 + knowledge-base 5 +
  auth-oauth 1)과 일치하는지, 그리고 저장소 내 남은 `RETURNING` 소비 지점(`graph-extraction.service.ts`
  의 `INSERT … ON CONFLICT DO UPDATE`, `kb-stats.helper.ts`(반환값 미사용), `agent-memory.service.ts`
  의 `INSERT … RETURNING`, `notifications.service.ts`(QueryBuilder `.execute()` 경로))가 정말
  이 버그 클래스에 해당하지 않는지 개별 확인 — 전부 INSERT 커맨드 또는 TypeORM QueryBuilder 경로라
  `[rows, rowCount]` 튜플 문제와 무관함을 확인. 누락된 자매 지점 없음.

## 발견사항

없음 — CRITICAL/WARNING 급 결함을 찾지 못했다.

핵심 수정(`updateReturningRows` 헬퍼 + 8개 소비 지점 + `AuthOAuthStateRow` snake_case 타입 도입)은:

- **기능 완전성**: TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE … RETURNING` 에만 `[rows, rowCount]`
  튜플을 돌려준다는 실측(plan 문서에 재현 스크립트 결과 기록)에 정확히 대응한다. 8개 소비
  지점(`execution-engine.service.ts` 의 admission UPDATE·`updateExecutionStatus` guarded UPDATE,
  `knowledge-base.service.ts` 의 CAS 락 2곳·재큐 2곳·reset 1곳, `auth-oauth.service.ts` 의 state
  DELETE) 전부가 헬퍼를 통해 튜플/행-배열 양쪽을 흡수하도록 바뀌었고, 저장소에 남은 다른
  `RETURNING` 소비 지점은 전부 INSERT 커맨드이거나 TypeORM QueryBuilder 경로라 이 버그 클래스
  밖이다(직접 확인).
- **엣지 케이스**: `updateReturningRows` 는 비배열(throw), 빈 튜플 `[[], 0]`("없음" 보존),
  빈 행 배열 `[]`(직접 형태), `result[0]` 이 null/undefined 인 경우까지 분기가 방어돼 있고
  각각 테스트로 고정돼 있다.
- **에러 시나리오**: `detail` 인자가 필수로 승격돼(선택이었을 때 8곳 중 정확히 auth-oauth 1곳이
  비워 두어 진단이 막혔던 이력이 plan/RESOLUTION 에 기록됨) 모든 호출부가 진단 문맥을 남긴다.
  에러 메시지에 `detail` 이 실제로 실리는지도 뮤테이션 테스트로 확인돼 있다.
- **데이터 유효성/비즈니스 로직**: `record.remember_me`(snake_case) 로 컬럼 접근을 정정해
  "로그인 유지" 무시 결함도 함께 닫았고, `AuthOAuthStateRow` 인터페이스가 실제 raw 컬럼과
  일치한다(entity 정의 대조 확인). e2e(`auth-oauth-callback.e2e-spec.ts`)가 실 Postgres 위에서
  성공/재사용거절/만료거절/미존재거절/provider불일치거절/remember-me 30일·7일 양방향을 모두
  덮는다.
- **반환값**: `updateReturningRows` 는 모든 분기에서 `T[]` 를 반환하거나 throw 하며, 누락 경로
  없음.
- **TODO/FIXME**: 신규·수정 파일 전체에 TODO/FIXME/HACK/XXX 없음.
- **spec fidelity**: `spec/data-flow/2-auth.md` §1.3 시퀀스가 이미 "row 없으면 400
  OAUTH_STATE_MISMATCH, provider 불일치도 거부" 를 명시하고 있었고 수정 후 코드가 이를 실제로
  구현한다(수정 전 코드는 이 spec 문언을 어기고 있었다 — 코드가 spec 을 "따라잡는" 방향이라
  spec 자체를 고칠 필요는 없음, SPEC-DRIFT 아님). 이 PR 이 노출한 admission gate·KB CAS 락·
  node-cancellation §2.4 등 다른 영역의 spec 각주 필요성은 `plan/in-progress/
  spec-update-node-cancellation-shutdown-classification.md` #12 로 이미 project-planner 에
  위임돼 있다(developer 권한 밖이라 이 PR 범위가 아님 — 델리게이션 자체가 적절).

review/code·review/consistency 하위의 과거 세션 아티팩트(수십 개 md/json)는 이미 지난 라운드에서
소비된 리뷰 산출물의 재커밋이며 이번 diff 의 "요구사항 충족" 판단 대상인 신규 동작을 포함하지
않는다 — 그 안에 서술된 CRITICAL 들은 전부 이전 라운드에서 이미 발견·조치된 것으로, 조치 결과가
바로 위 코드 diff 에 반영돼 있음을 직접 확인했다.

## 요약

`UPDATE`/`DELETE … RETURNING` 이 TypeORM+pg 에서 `[rows, rowCount]` 튜플로 온다는 실측 결함을
공용 헬퍼(`updateReturningRows`)로 흡수하고 8개 소비 지점(소셜 로그인 state 소비 포함)을 교체한
수정이다. 헬퍼의 엣지 케이스 처리, 필수 `detail` 진단 인자, 8개 호출부 전수 커버, 신설 e2e(실
드라이버로 성공/거절 양방향 및 remember-me TTL 검증), 구조적 회귀 가드(호출 수 실측 고정)를
모두 소스 재실행/재계산으로 직접 검증했고 전부 일치했다. `spec/data-flow/2-auth.md` 등 관련 spec
본문과도 line-level 로 부합하며, 이 수정이 이전에 어기고 있던 spec 문언을 코드 쪽에서 바로잡는
방향이라 spec 자체의 결함은 아니다. `tsc`/`eslint --max-warnings 0`/관련 jest 스위트 전부
로컬에서 재확인해 GREEN 이었다. 요구사항 충족 관점에서 결함을 찾지 못했다.

## 위험도

NONE
