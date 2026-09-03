# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan 이 예고한 구현 형태(`it.each`)와 실제 구현(개별 `it()` 2건)이 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387`, `:417` (신설 `it(...)` 2건)
  - 상세: 삭제된 plan 원문(`plan/in-progress/entity-nullable-column-type-mismatch.md` 옛 본문, 해당 diff 의 `-` 줄)은 "`[대조군]` 테스트에 관계 버전을 `it.each` 로 더한다" 라고 예고했는데, 실제로는 `it.each` 대신 각각 독립된 `it()` 블록 2개(관계끼리 충돌 / `@Column`+관계 혼합 충돌)로 구현됐다. 다만 두 테스트가 서로 다른 fixture 구조(하나는 순수 관계 페어, 하나는 관계+Column 혼합)라 `it.each` 로 압축하면 테스트 이름·파라미터가 부자연스러워질 수 있어 이 선택 자체는 합리적이다. 범위(무엇을 테스트하는가)는 예고와 정확히 일치하고, 구현 형태만 다르다.
  - 제안: 조치 불요. 참고용 기록.

## 요약

diff 는 두 파일(`nullable-type-lie-cast.spec.ts`, `entity-nullable-column-type-mismatch.md`)만 건드리며, 커밋 전체(`git show --stat`)로 대조해도 이 두 파일 외 변경은 없다. 스펙 파일 쪽은 리뷰 10R INFO#12 가 요구한 "관계 데코레이터끼리의 동명 충돌 캐너리" 정확히 그 범위만큼만 `it()` 2건을 순수 추가(삭제 0줄)했고, 기존 테스트·헬퍼(`withFiles`)·import·프로덕션 가드 코드(`nullable-type-lie-cast-guard.ts`)는 전혀 손대지 않았다(코드가 이미 옳았다는 전제 — 실제로 가드 구현 파일이 diff 에 없음으로 뒷받침됨). plan 파일 쪽도 해당 후속 항목 한 곳(`[ ]`→`[x]`)만 갱신했고 인접한 다른 체크박스·서술은 건드리지 않았다. 포맷팅·주석·임포트·설정 변경, 무관한 리팩토링, 기능 확장 등 스코프 이탈 신호는 전무하다. 유일한 미세 차이는 plan 이 예고했던 `it.each` 대신 개별 `it()` 2건으로 구현된 점인데, 이는 스코프(무엇을 검증하는가) 자체는 그대로이고 구현 형태 선택일 뿐이라 INFO 수준으로만 기록한다.

## 위험도
NONE
