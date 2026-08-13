# 아키텍처(Architecture) 코드 리뷰 결과

## 리뷰 범위

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 — TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 shape 해석 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (구조적 가드 갱신, sibling 헬퍼)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts` (호출부 1곳 교체)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts` (호출부 2곳 교체)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts` (호출부 5곳 교체)
- `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` — 문서/이전 라운드 산출물. 아키텍처 관점 실질 코드 변경 아님(리뷰 대상에서 제외).

새 헬퍼 `updateReturningRows()`는 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 에만 `[rows, rowCount]` 튜플을 돌려주는 드라이버-특이 동작(leaky abstraction)을 한 지점에 캡슐화하고, 기존에 각자 이 문제를 풀던 7개 소비 지점을 그 헬퍼로 통일한다. `common/utils/` 라는 infra 계층에 위치시키고 순수 함수·무의존성으로 설계한 것은 sibling `assert-row-array.ts` 의 전례를 그대로 따르는 합리적인 Adapter 성격 유틸리티다. 모듈 방향(`modules/* → common/utils/*`)도 올바르며 순환 의존은 발견되지 않았다.

## 발견사항

- **[WARNING]** `detail` 파라미터가 선택(optional)로 설계돼, 헬퍼 자신의 설계 근거("종전 `assertRowArray` 가 주던 진단을 잃지 않기 위함")를 헬퍼 도입 즉시 1개 호출부가 어긴다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:38-43`(시그니처 `detail?: string`) vs `codebase/backend/src/common/utils/assert-row-array.ts:16-19`(sibling 헬퍼는 `detail: string` **필수**) / `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-151`(호출부가 `detail` 인자를 아예 생략)
  - 상세: `updateReturningRows` JSDoc은 `detail` 인자의 존재 이유를 "극단 상황에서 로그만으로 지점을 특정할 수 있어야 해서"라고 명시하고, sibling 헬퍼 `assertRowArray`는 같은 목적의 파라미터를 아예 필수로 강제해 "메시지는 호출부가 준다"는 설계 원칙을 인터페이스 수준에서 관철한다. 그런데 `updateReturningRows`는 그 파라미터를 optional 로 완화했고, 실제로 이번 diff의 8개 호출부 중 정확히 `auth-oauth.service.ts` 한 곳 — 공교롭게도 이 전체 수정을 촉발한 바로 그 결함(소셜 로그인 상시 실패) 지점 — 이 `detail` 을 생략한다(engine 2곳, KB 5곳은 모두 전달). optional 파라미터가 "생략해도 컴파일이 통과"하는 인터페이스를 만들었고, 그 결과가 곧바로 관측됐다. 이 패턴(방어를 도입해 놓고 자매 지점 일부에 미적용)은 이 저장소에서 반복 관측된 실패 모드다.
  - 제안: `detail` 을 필수 파라미터로 승격하거나(sibling과 시그니처 일관성 확보), 최소한 auth-oauth 호출부에 컨텍스트("auth-oauth state consume, provider ${provider}" 등)를 채워 8개 호출부 전원이 진단 정보를 남기도록 통일한다.

- **[WARNING]** `knowledge-base.service.ts` 의 `retryFailedDocuments` embedding 분기가 `updateReturningRows` 로 감싸졌음에도 그 직전 `.query<{ id: string }[]>()` 제네릭 타입 인자를 그대로 남겨, 이 PR이 없애려던 "타입이 실제 shape 을 거짓 주장" 문제를 같은 파일 안에서 재현한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:533`(`const rows = await this.dataSource.query<{ id: string }[]>(...)`, 바로 아래 `:544`에서 `updateReturningRows<{ id: string }>(rows, ...)` 로 다시 감싼다)
  - 상세: 같은 파일의 나머지 4개 UPDATE/DELETE 소비 지점(CAS 락 2곳 `:336`대·`:718`대, graph 재큐 `:569`대, reset `:730`대 — 실제 소스 기준)은 전부 `const x: unknown = await ...query(...)` 로 제네릭을 제거해 "실제 shape 해석은 헬퍼가 책임진다"는 설계를 타입 수준에서도 관철했다. 그런데 이 한 지점만 `.query<{ id: string }[]>()` 제네릭이 남아 `rows` 를 TypeScript 상 이미 "행 배열"로 선언한다. `updateReturningRows(result: unknown, ...)` 의 파라미터가 `unknown` 이라 지금은 컴파일이 통과하고 런타임도 올바르게 동작하지만, 이 지점만 `rows` 가 이미 `{ id: string }[]` 타입이므로 향후 누군가 리팩터링하며 `updateReturningRows` 래핑을 걷어내고 `rows.map(r => r.id)` 를 직접 써도 **타입 에러 없이 컴파일된다** — 이 헬퍼가 정확히 막으려던 실수(제네릭이 "주장이지 검증이 아니다")를 이 한 지점에서 타입 시스템이 다시 허용하는 셈이다. `update-returning-rows.ts:1-6`(JSDoc)이 스스로 지적하는 위험이 같은 diff 안에서 한 곳 재도입됐다.
  - 제안: 이 호출부도 `const rows: unknown = await this.dataSource.query(...)` 로 통일해 나머지 4곳과 일관시킨다.

- **[INFO]** 회귀 방지 메커니즘이 타입/lint 수준 강제가 아니라 grep 카운트 tripwire(`update-returning-rows.spec.ts`)에만 의존한다 — 이 자체는 이미 maintainability 리뷰가 지적한 취약성과 겹치지만, 아키텍처 관점에서는 "모듈 경계"가 컴파일러/린터가 아니라 테스트 관례로만 지켜진다는 점이 핵심이다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:46`(`CONSUMING` 정규식), `:49-55`(`EXPECTED` 하드코딩 카운트)
  - 상세: 같은 DB 드라이버 quirk 을 푸는 관용구가 저장소에 3가지(로컬 `deletedRowCount()`, 구조분해 `const [rows] = …`, 공유 `updateReturningRows()`) 공존하도록 의도적으로 남겨뒀고, 신규 지점이 헬퍼를 거치지 않는 것을 막는 유일한 안전망이 파일 내용을 문자열로 세는 spec 테스트다. 정적 타입 시스템(예: `EntityManager.query` 반환 타입을 감싸는 브랜드 타입, 혹은 raw UPDATE/DELETE 전용 wrapper 메서드)이나 ESLint 커스텀 규칙 같은 컴파일/린트 단계 강제가 없어, 확장성(새 소비 지점 추가) 측면에서 "다음 개발자가 이 규약을 알고 있는가"에 의존하는 구조다.
  - 제안: 이번 PR 스코프 밖으로 봐도 무방하나, 장기적으로는 `EntityManager`/`DataSource` 를 감싸는 얇은 wrapper(`queryUpdateReturning()` 같은 전용 메서드)로 "UPDATE/DELETE RETURNING" 호출 자체를 타입으로 구분하는 편이 grep 기반 tripwire보다 견고하다.

## 요약

새 헬퍼 `updateReturningRows()` 는 배치 위치(`common/utils/`)·의존성 방향(무의존 순수 함수, modules → common 단방향)·sibling 헬퍼(`assertRowArray`)와의 관용구 일관성 면에서 이 저장소의 기존 아키텍처 규범을 잘 따르며, TypeORM 드라이버의 leaky abstraction 을 단일 지점에 캡슐화한 것은 올바른 설계 방향이다. 다만 그 헬퍼의 인터페이스 설계(`detail` optional)와 적용 완결성(KB 한 지점에 남은 stale 제네릭)에 작은 틈이 있고, 둘 다 "방어를 도입했지만 자매 지점 중 한 곳에 미적용"이라는 동일한 실패 패턴을 이번 diff 안에서 재현한다 — 다행히 둘 다 현재 런타임 동작을 깨뜨리지는 않는 잠재적 유지보수 리스크다. 순환 의존, 레이어 경계 위반, 과도한 추상화 등 구조적 CRITICAL 급 문제는 발견되지 않았다.

## 위험도

LOW
