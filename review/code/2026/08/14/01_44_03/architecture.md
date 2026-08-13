# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 신규 헬퍼 `updateReturningRows` 는 "TypeORM UPDATE/DELETE RETURNING 튜플 unwrap" 이라는 횡단 관심사의 **정본**으로 도입됐지만, 저장소에는 같은 문제를 **이미 각자 해결한 3개 지점**(`agent-memory-admin`의 로컬 `deletedRowCount()`, `stuck-document-recovery`의 구조분해, `integration-oauth`의 명시 튜플 타입)이 "과거 호환으로 유지, 새로 따라 하지 않는다" 로 남아 있다. 구조적 회귀 가드(`update-returning-rows.spec.ts`)의 `EXPECTED` 목록도 이번에 고친 3개 파일(`execution-engine.service.ts`/`knowledge-base.service.ts`/`auth-oauth.service.ts`)만 보호하고, 나머지 3개 기존 지점은 대조군으로만 값이 고정될 뿐 "새 소비 지점이 이 헬퍼를 우회했는지" 는 감시하지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:21-37` (관용구 4종 표 + "신규 지점은 이 헬퍼를 쓴다"), `codebase/backend/src/common/utils/update-returning-rows.spec.ts:58-63` (`EXPECTED` 3파일 한정)
  - 상세: 이는 이번 PR 이 만들려는 "단일 출처" 추상화가 **의도적으로, 그리고 문서화된 채로** 부분적이라는 뜻이다(트레이드오프 자체는 합리적 — 기존 3곳은 이미 정확했고 손대는 blast radius 를 늘리지 않는 판단). 다만 이 상태에서 향후 `agent-memory-admin`/`stuck-document-recovery`/`integration-oauth` 근처에 새 UPDATE/DELETE RETURNING 소비 지점이 추가되면, 개발자가 "이미 이 파일에 있는 로컬 관용구" 를 복제하기 쉽고, 그 복제는 어떤 가드에도 걸리지 않는다 — 가드의 감시 범위가 "이번에 고친 파일" 로 한정돼 있기 때문이다. 즉 헬퍼 자체는 SRP·재사용성 면에서 잘 설계됐으나, 프로젝트 전체에 걸친 "단일 진실 강제" 는 아직 이번 diff 의 3개 파일에만 국한된다.
  - 제안: 즉시 조치는 불필요(문서화된 defer). 다만 plan 후속 항목으로 "3개 레거시 지점을 정본 헬퍼로 마이그레이션하거나, 최소한 그 3개 파일도 `EXPECTED` 대조군에 '변경 시 알림' 형태로 편입" 을 등재해 두면, 지금 문서에 적힌 의도(신규 지점은 반드시 이 헬퍼)가 나중에도 강제력을 유지한다.

- **[INFO]** 두 "자매" 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)가 `SRC = join(__dirname, '..', '..')` 계산과 `readFileSync` 루프를 각자 인라인으로 반복한다. 공유 파싱 로직(`countCalls`/`stripComments`)은 `source-scan.ts` 로 잘 추출됐지만, "대상 파일을 읽어 정규식을 돌린다" 는 한 단계 위의 뼈대는 아직 두 파일에 복제돼 있다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` (`자매 지점 전수 — 가드 누락 회귀 가드` describe, `SRC` 정의부) / `codebase/backend/src/common/utils/update-returning-rows.spec.ts:8` (`SRC` 정의부)
  - 상세: 이 결함 클래스(같은 모양의 "소비 지점 수 == 헬퍼 호출 수" 가드가 헬퍼마다 반복 생성)가 이번 PR 이 고친 근본 문제(지식이 지점마다 흩어짐)와 구조적으로 같은 패턴이라, 세 번째 유사 가드가 생기는 시점에 같은 종류의 비대칭(한쪽만 하드닝)이 다시 나올 위험이 test 계층에도 있다. maintainability 리뷰가 이미 이 중복을 상세히 짚었으므로 조치 우선순위는 낮다.
  - 제안: maintainability.md 의 제안(공유 유틸 추출)과 동일 — 급하지 않음, 세 번째 유사 가드 등장 시 추출.

## 요약

이 PR 은 좁고 잘 통제된 버그 수정이다 — `assertRowArray`(SELECT 전용)와 `updateReturningRows`(UPDATE/DELETE 전용)로 책임을 명확히 분리하고, 두 헬퍼가 서로를 JSDoc `{@link}` 로 교차 참조해 오용을 막았으며, 두 모듈 모두 외부 의존성 없는 순수 함수라 순환 참조 위험이 없다. 신규 `updateReturningRows` 는 `common/utils` 레이어에 정확히 위치해 auth/execution-engine/knowledge-base 세 독립 도메인 서비스에서 재사용되고, raw SQL 드라이버의 shape 지식을 서비스 레이어 밖으로 캡슐화한다(레이어 책임 분리 양호). 테스트 전용 파싱 유틸(`source-scan.ts`)도 `__testing__/` 디렉터리 + `tsconfig.build.json` exclude 로 프로덕션 코드와 명확히 경계 지어졌고, 실제로 spec 파일에서만 import 되는 것을 확인했다(모듈 경계 준수). `auth-oauth.service.ts` 의 신규 `AuthOAuthStateRow` 타입도 raw SQL 행의 실제 shape(snake_case)을 entity 타입과 분리해 명시적으로 모델링한 점이 좋다. 유일한 아키텍처 관찰점은 이 "단일 출처" 추상화가 저장소 전체가 아니라 이번 diff 가 건드린 3개 파일에만 강제력을 갖는다는 것(문서화된 의도적 defer)과, 자매 회귀 가드 사이의 얕은 보일러플레이트 중복(이미 maintainability 가 상세 지적) 뿐이며 둘 다 CRITICAL/WARNING 급은 아니다.

## 위험도

LOW
