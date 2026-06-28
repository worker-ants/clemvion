# 변경 범위(Scope) 리뷰

## 발견사항

변경 범위 이탈 또는 문제가 될 항목이 없습니다.

- 수정 파일: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`
- 변경 내용: `openAddDialog` 함수 내에서 `findByRole` → `findAllByRole` + `[0]` 인덱스 참조, 설명 주석 추가

## 요약

변경은 `openAddDialog` 헬퍼 함수 한 곳에만 집중되어 있으며, flaky 테스트 원인(동일 접근성 이름의 버튼이 복수 렌더될 때 단수 쿼리가 throw)을 최소 침습적으로 수정한다. 추가된 주석은 수정 근거를 명확히 설명하는 필수 문서화이며, 그 외 어떠한 리팩토링·기능 추가·설정 변경·무관한 파일 수정도 포함되지 않았다. 변경 범위는 의도와 완전히 일치한다.

## 위험도

NONE
