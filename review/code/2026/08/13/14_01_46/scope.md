# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 완료 메모 위치가 관련 체크리스트 항목에서 멀리 떨어져 파일 맨 끝에 붙었다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1098-1111`
  - 상세: `Array.isArray(rows)` 가드 완료 메모(③)는 그 근거가 되는 체크리스트 항목
    (`execution-engine.service.ts 의 admission 자리...`, 동일 파일 게이트 1072행)
    바로 아래가 아니라, 문서 맨 끝(무관한 "required-check 등록" 단락 뒤)에 붙었다.
    같은 커밋의 ①번 항목(snapshotCache evict) 완료 메모는 체크리스트 항목 바로
    아래(게이트 489-504행)에 붙어 대비된다. 스코프 위반은 아니고 두 항목 다 실제로
    이 커밋이 닫은 백로그 항목이 맞지만, 추적성 측면에서 향후 독자가 "③ 완료 메모"를
    찾을 때 항목 근처에서 찾지 못할 수 있다.
  - 제안: (선택) 완료 메모를 게이트 1072행 체크박스 바로 아래로 옮기면 ①과 형식이
    일치해 추적하기 쉬워진다. 필수 조치는 아님.

## 요약

`git show --stat HEAD` 로 확인한 전체 diff(6 파일, +263/-3)가 리뷰 프롬프트에 제시된
diff 와 정확히 일치하며, 숨겨진 추가 hunk 는 없다. 커밋 메시지가 명시한 3개 백로그
항목(① `snapshotCache` evict 방향·상한 테스트, ② dispatcher `logFn` debug/warn 양방향
분기 테스트, ③ `execution-engine` admission 자리 `Array.isArray` fail-closed 가드+테스트)
과 실제 diff 가 1:1로 대응한다 — 이 세 항목은 `plan/in-progress/backend-lint-gate-broken-on-main.md`
가 이미 선재 공백/유예로 기록해 두었던 것으로, 이번 변경은 그 항목들을 닫는 작업일 뿐이다.
프로덕션 코드 변경은 `execution-engine.service.ts` 의 11줄짜리 fail-closed 가드 삽입과
`executions.service.ts` 의 `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export` 로 바꾼 1줄
(테스트가 상수를 import 하기 위한 최소 변경, 이미 존재하는 `MAX_EXECUTION_PATH_ROWS`
export 패턴과 동일)뿐이다. 나머지는 스펙 파일 3개에 대상 분기/경계를 정확히 겨냥한
테스트 추가와, plan 문서의 체크박스 갱신 + 완료 근거 메모다. 불필요한 리팩토링, 요청
외 기능 추가, 무관한 파일 수정, 포맷팅 잡음, 부적절한 주석/임포트/설정 변경은
발견되지 않았다. 추가된 주석·doc comment 는 해당 파일의 기존 스타일(각 describe 블록
위에 회귀 배경을 설명하는 긴 JSDoc)과 일관된다.

## 위험도

NONE
