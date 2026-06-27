# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `wrapPaginatedSchema` 반환 값 구조의 의도적 변경 — 프로그래매틱 탐색 호환성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema` 함수 본문
  - 상세: 반환 `SchemaObject`의 내부 구조가 double-wrap(`schema.properties.data.properties.data`, `schema.properties.data.properties.pagination`)에서 single-wrap(`schema.properties.data`, `schema.properties.pagination`)으로 변경된다. 함수 시그니처(`(dto: ClassRef<T>): SchemaObject`)와 반환 타입(`SchemaObject`)은 동일하지만 런타임 값의 형태가 달라진다. 만약 반환 값을 받아 `schema.properties?.data?.properties?.data`처럼 구 경로로 탐색하는 호출자가 있다면 `undefined` 접근 오류가 발생한다. 단, plan 및 review 문서에서 15개 사용처 전수가 `ApiOkPaginatedResponse` 데코레이터 형태로만 호출(스키마 내부 구조 직접 탐색 없음)임을 확인했고, 직접 탐색하는 유일한 코드인 `api-wrapped.spec.ts`가 동반 갱신되었으므로 실제 파손 위험은 없다.
  - 제안: 현 변경은 의도적·안전함. 향후 `wrapPaginatedSchema` 반환 값을 직접 프로그래매틱 탐색하는 코드 추가 시 구 double-wrap 경로를 사용하지 않도록 팀 내 공유 필요.

- **[INFO]** `wrapPaginatedSchema` 및 `ApiOkPaginatedResponse` 함수 시그니처 — 변경 없음
  - 위치: `api-wrapped.ts` L351, L453
  - 상세: 두 함수 모두 파라미터 목록·반환 타입이 이전과 동일하다. 외부에서 타입 추론에 의존하는 호출자는 타입 레벨 브레이킹 없음.
  - 제안: 조치 불필요.

- **[INFO]** 전역 변수·공유 상태·파일시스템·환경 변수·네트워크·이벤트 — 해당 없음
  - 위치: 변경된 모든 파일
  - 상세: `wrapPaginatedSchema`와 `ApiOkPaginatedResponse`는 순수 함수(pure function)로, 전역 변수를 읽거나 쓰지 않고 호출마다 새 객체 리터럴을 반환한다. 파일시스템 조작, 환경 변수 접근, 네트워크 호출, 이벤트 발생·구독, 콜백 등록 변경이 없다. 나머지 변경 파일(plan, review 산출물)은 마크다운 문서로 런타임 영향이 전혀 없다.
  - 제안: 조치 불필요.

## 요약

이번 변경의 부작용 관점 위험은 매우 낮다. 핵심 코드 변경(`wrapPaginatedSchema`)은 순수 함수의 반환 값 내부 구조만 바꾸며, 함수 시그니처·타입·전역 상태·파일시스템·네트워크·이벤트 등 외부 관찰 가능한 부작용은 전혀 없다. 반환 값 구조 변경이 유일한 관찰 포인트이나, 15개 사용처가 모두 데코레이터 형태 호출이고 직접 탐색 코드인 테스트 파일이 동반 갱신되었으므로 실질적 파손 위험은 없다.

## 위험도

NONE
