# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `updateReturningRows` 는 "raw `.query()` 직후 반드시 호출한다" 는 **호출부 규율**로만 강제된다 — 데이터 접근 경계(예: `queryReturning<T>()` 류 래퍼)에서 구조적으로 흡수하지 않는다. 강제 수단도 컴파일 타임이 아니라, 이 PR 이 손댄 **딱 3개 파일**을 하드코딩으로 나열한 회귀 테스트(`EXPECTED`/`FILES` 배열)뿐이다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:58-64` (`EXPECTED` 배열 — `execution-engine.service.ts`/`knowledge-base.service.ts`/`auth-oauth.service.ts` 3개만 등재), `codebase/backend/src/common/utils/assert-row-array.spec.ts:56-59` (`FILES` 배열도 동일하게 2개로 고정)
  - 상세: `EntityManager.query()`/`Repository.query()` 의 반환 타입이 `Promise<any>` 라는 근본 원인(제네릭이 검증이 아니라 주장)은 이 PR 이 고친 8곳 이후에도 데이터 접근 계층 자체엔 남아 있다. 새 raw UPDATE/DELETE 호출이 이 3개 파일 밖(예: 신규 모듈)에 생기면, 헬퍼를 잊어도 아무 가드도 RED 를 내지 않는다 — `update-returning-rows.ts` 자체의 JSDoc 표(`agent-memory-admin`/`stuck-document-recovery`/`integration-oauth`)가 보여주듯, 같은 문제를 이미 4가지 다른 관용구로 각자 풀어 온 이력이 있다는 것 자체가 "호출부가 알아서 기억해야 하는" 설계의 실패 이력이다. 이번 수정은 그 이력에 5번째 관용구(공용 헬퍼)를 더했을 뿐, 원인이 되는 접근 지점(query 실행 경계)을 좁히지는 않았다.
  - 제안: 급하지 않음(문서화된 의도적 스코프 축소) — 다만 후속으로 raw UPDATE/DELETE 를 감싸는 얇은 래퍼(예: `DataSource`/`EntityManager` 확장 메서드)를 만들어 "호출 즉시 언랩" 을 구조적으로 강제하면, 회귀 테스트의 하드코딩된 파일 목록에 의존하지 않고 새 지점도 자동으로 보호된다.

- **[WARNING]** 두 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)가 공유하는 단일 카운팅 유틸 `stripComments` 가, 스스로 밝힌 존재 이유("주석 속 언급이 카운트에 섞이면 가드가 약해진다")를 **줄 끝 주석에는 적용하지 않는다** — 의도적 트레이드오프이지만, 정확히 이 결함 클래스가 이미 한 번 이 저장소에서 실제로 발생했다(같은 파일 docstring 참조).
  - 위치: `codebase/backend/src/common/utils/__testing__/source-scan.ts:22-24`(줄 끝 `//` 를 건드리지 않는다는 명시적 결정), `:26-27`(`stripComments` 구현), `:30-33`(`countCalls` — 두 가드가 공유하는 단일 출처)
  - 상세: 블록 주석·"주석만 있는 줄"은 제거되지만, `실코드(); // 나중에 helperName(x) 붙일 예정` 같은 줄 끝 주석은 그대로 남아 카운트에 섞인다. 파일 자체 docstring(`:19-20`)이 인용하는 실제 사건("`auth-oauth.service.ts` 의 docstring 이 처방을 설명하며 심벌을 적었다가 2로 셌다")은 블록 주석 형태였고 이번에 막혔지만, 같은 형태가 줄 끝 주석으로 나타나면 여전히 못 막는다. 이 유틸은 **두 가드가 동시에 의존하는 단일 출처**이므로(모듈 자체 docstring: "여기가 틀리면 두 구조적 가드가 동시에 조용히 약해진다"), 이 잔여 사각지대는 한 곳의 결함이 두 가드를 동시에 약화시킬 수 있다는 뜻이다.
  - 제안: 급하지 않음 — 이미 문서화되고 인지된 트레이드오프(URL 절단 방지)라 즉시 수정을 요구하지는 않지만, 세 번째 가드가 이 유틸을 재사용하기 전에 최소한 "줄 끝 주석은 사각지대" 라는 사실을 `countCalls` 의 JSDoc에도 명시하면 향후 재사용자가 같은 오판을 반복하지 않는다.

- **[INFO]** `updateReturningRows<T>` 는 외곽 shape(튜플 vs 행 배열)만 구조적으로 판별하고, 개별 행의 필드 shape 은 여전히 제네릭 단언(`as T[]`)에 의존한다 — "제네릭 인자는 검증이 아니라 단언" 이라는 동일한 근본 원인이 이 PR 안에서 이미 두 번(튜플/배열 오판, `AuthOAuthStateRow` 의 snake_case 필드 오판) 재발했다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:52-56`(`result[0] as T[]` / `result as T[]`), `codebase/backend/src/modules/auth/auth-oauth.service.ts:29-40`(`AuthOAuthStateRow` — 왜 별도 타입이 필요했는지 설명하는 docstring)
  - 상세: 이번 헬퍼는 "배열인가/튜플인가" 라는 **구조** 문제는 런타임으로 닫았지만, "그 행이 실제로 어떤 필드를 갖는가" 라는 **shape** 문제는 여전히 호출부의 수기 타입 선언(컴파일 타임에만 존재, 런타임 무검증)에 맡긴다. `AuthOAuthStateRow` 사례가 보여주듯 이 클래스의 결함은 튜플 문제와 독립적으로 재발할 수 있다.
  - 제안: 지금 급한 조치는 아님 — 다만 raw SQL 결과를 다루는 지점이 늘어나는 추세라면(이번 PR 로 8곳 확인), 향후 필드 레벨까지 검증하는 경량 런타임 스키마(zod 등)를 raw query 결과에 선택적으로 적용하는 확장을 검토할 가치가 있다.

- **[INFO]** 같은 문제(UPDATE/DELETE RETURNING shape)를 푸는 4가지 관용구가 의도적으로 공존한다 — 신규 헬퍼(`updateReturningRows`) 외에 `deletedRowCount()`(로컬 헬퍼), 구조분해(`const [rows] = …`), 명시적 튜플 타입(`integration-oauth`)이 "과거 호환" 명목으로 남는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:1-35`(JSDoc 의 "신규 지점은 이 헬퍼를 쓴다" 표)
  - 상세: 문서화된 의도적 스코프 결정이라 결함은 아니다. 다만 회귀 가드(`update-returning-rows.spec.ts:74-92`)는 "이미 올바른 두 선례" 만 존재를 확인할 뿐, 다섯 번째 신규 지점이 구조분해나 `deletedRowCount` 류의 레거시 관용구를 다시 베껴도 막지 못한다 — 그 형태는 공용 헬퍼를 거치지 않는 정당한 패턴으로 취급되기 때문이다.
  - 제안: 조치 불요. 다만 다음에 이 4가지 관용구를 정리할 기회가 오면(예: 관련 파일을 손대는 별도 PR), 하나로 수렴시키는 편이 장기적으로 "어느 패턴을 새로 따라야 하는가" 판단 비용을 없앤다.

## 긍정적 관찰

- `assertRowArray`(SELECT 결과 가드/narrowing) 와 `updateReturningRows`(UPDATE/DELETE 결과 변환) 는 계약이 겹치지 않게 명확히 분담되어 있다(`assert-row-array.spec.ts:86-88` 주석에 명시) — 단일 책임 분리가 잘 유지된다.
- `common/utils/update-returning-rows.ts` 는 외부 의존성이 전혀 없는 순수 함수이고, `auth`/`execution-engine`/`knowledge-base` 세 모듈이 단방향으로 이를 참조한다 — 순환 의존 없음, DIP 방향(도메인 모듈 → 공유 유틸)도 올바르다.
- `codebase/backend/tsconfig.build.json:7` 의 `**/__testing__/**` exclude 추가는 테스트 전용 공유 유틸(`source-scan.ts`)이 프로덕션 번들에 섞이지 않도록 빌드 경계를 명확히 한다 — 레이어 경계 관리가 적절하다.

## 요약

이번 변경은 TypeORM raw `.query()` 의 UPDATE/DELETE `RETURNING` 튜플 shape 오판이라는 실제 프로덕션 결함(소셜 로그인 상시 실패 등)을 공용 헬퍼 `updateReturningRows` 로 흡수하고, 기존 `assertRowArray` 와 책임을 깔끔히 분담시킨 구조적 수정이다. 순환 의존이 없고 레이어 경계(빌드 exclude 포함)도 잘 관리되어 있으며, 회귀 방지용 정적 카운팅 가드를 두 스펙이 공유하는 단일 유틸(`source-scan.ts`)로 추출해 DRY 를 개선한 점도 긍정적이다. 다만 아키텍처 관점에서 남는 것은 "고쳤다" 의 강제 수단이 데이터 접근 경계의 구조적 캡슐화가 아니라 하드코딩된 파일 목록을 검사하는 정규식 기반 테스트 가드라는 점 — 이 PR 이 다룬 3개 파일 밖에 생기는 새 raw UPDATE/DELETE 지점, 그리고 카운팅 유틸 자신이 인정한 줄 끝 주석 사각지대는 여전히 열려 있다. 모두 이미 상당 부분 문서화·인지된 트레이드오프이고 즉각적인 결함은 아니므로 전반적 위험도는 낮다.

## 위험도

LOW
