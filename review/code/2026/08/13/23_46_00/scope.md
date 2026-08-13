# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD` 실측: 88개 파일, 6705(+)/41(-)줄. `codebase/**`·`plan/**` 만
필터링하면 정확히 12개 파일(816줄)이고, `codebase/`·`plan/`·`review/` 밖 경로(설정·CI·의존성)는
0건이다(`git diff --name-only … | grep -Ev '^(codebase/|plan/|review/)'` 결과 없음). 프롬프트가
크기 제한으로 생략한 `execution-engine.service.ts`·`knowledge-base.service.ts`·
`update-returning-tuple-shape.md` 는 `Read`/`git diff` 로 직접 열어 대조했다.

## 발견사항

없음(CRITICAL/WARNING) — 이 누적 diff 는 "TypeORM `UPDATE`/`DELETE … RETURNING` 이
`[rows, rowCount]` 튜플인데 코드베이스 8곳(execution-engine 2·knowledge-base 5·
auth-oauth 1)이 행 배열로 오인해 왔다" 는 단일 결함 수정으로 수렴한다.

- **의도 이상의 변경 / 무관한 수정**: 없음. 코드 9개 파일(`common/utils/update-returning-rows.{ts,spec.ts}`
  신규, `execution-engine.service.{ts,spec.ts}`, `knowledge-base.service.{ts,spec.ts}`,
  `auth-oauth.service.{ts,spec.ts}`, `assert-row-array.spec.ts`)이 plan
  `update-returning-tuple-shape.md` 의 "무엇이 깨져 있었나 (8곳)" 표와 1:1 대응함을
  `execution-engine.service.ts`/`knowledge-base.service.ts` 실제 diff 로 직접 확인했다.
  `auth-oauth.service.ts` 편입은 원래 plan 범위(7곳) 밖이었지만, 같은 세션의
  `20_36_35/RESOLUTION.md` CRITICAL 1(같은 결함이 소셜 로그인에도 살아 있음을 감사 사각지대로
  놓쳤다는 지적)에 대한 조치이고 root cause 가 동일해 별개 작업 유입이 아니다.
- **불필요한 리팩토링**: `execution-engine.service.ts` 두 지점(`admitExecutionOrDefer`,
  `updateExecutionStatus`)에서 `assertRowArray(...)` 를 `updateReturningRows(...)` 로 교체했다.
  새 헬퍼가 동일한 `!Array.isArray` 가드를 내장해 흡수하므로 중복 가드를 남기지 않은 처방의
  일부다. 같은 파일의 세 번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`, SELECT
  지점)은 손대지 않았고 import 도 계속 쓰여 dead code 가 아니다. `assert-row-array.spec.ts`
  의 가드 수치 변경(`guards: 3 → 1`)도 이 교체의 직접·필연적 결과다.
- **기능 확장**: `updateReturningRows<T>(result, detail)` 은 튜플/비-튜플 두 shape 만 처리하는
  최소 함수이고 신규 옵션·플래그·설정 확장이 없다. `detail` 을 선택→필수로 바꾼 것도 자매
  헬퍼 `assertRowArray` 와 계약을 맞추는 범위 내 결정이며 근거(auth-oauth 가 실제로 비웠던
  사례)가 문서에 남아 있다. over-engineering 신호 없음.
- **포맷팅 변경**: 실측한 두 서비스 파일의 diff hunk 는 실질 로직/주석/타입(`unknown` 전환) 변경에
  국한돼 있고 무관한 개행·공백 재정렬이 섞인 흔적이 없다.
- **주석 변경**: 추가·삭제된 주석은 전부 이번 튜플 shape 결함의 실측 근거·회귀 이유를 설명한다.
  `admitExecutionOrDefer` 안의 옛 모순 주석("RETURNING id 이므로 실제 shape 은 행 배열이다" /
  "위 제네릭은 주장이지 검증이 아니다")은 실제로 삭제·통합돼 있음을 현재 파일에서 확인했다
  (`grep -n "위 제네릭"` 결과 남은 지칭 없음) — 이전 라운드(`23_27_48/maintainability.md`)가
  지적한 잔존 모순은 이번 최종 상태에서 해소됐다.
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`
  세 곳에 추가된 `import { updateReturningRows } from '.../update-returning-rows'` 는 모두 실제
  호출부가 있어 사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: 없음(확인 완료, 위 방법 참조).
- **plan 문서 3건**(`update-returning-tuple-shape.md` 신규, `ie-resume-turn-boundary-cancel.md`·
  `retry-turn-terminal-guard.md` 소급 정정 배너)은 이번 결함이 과거 6~12+ 라운드에 걸쳐 "동시
  cancel 방어가 닫혔다" 고 잘못 종결시킨 근거(`persisted` 가 튜플 버그로 항상 `true`)였다는
  사실을 소급 정정하는, 이 결함과 인과적으로 직결된 기록이다. 두 plan 의 diff 는 배너 삽입과
  체크박스 정정에 한정되고 무관한 섹션을 건드리지 않으며, `developer` 의 `plan/**` 쓰기 권한
  범위 안이다.
- **review/code(59개)·review/consistency(29개) 산출물**: 이 PR 개발 세션 중 4라운드
  코드 리뷰(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`)와 4라운드 일관성 검토
  (`20_36_36`/`22_45_25`/`23_07_12`/`23_27_49`)가 생성한 표준 부산물이며,
  `CLAUDE.md` §외부 LLM 호출 정책의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"
  규약에 따라 커밋되는 것이 정상이다. 내용을 표본 확인(각 라운드 `RESOLUTION.md` 전문,
  `scope.md`·`maintainability.md` 다수)한 결과 전부 동일 결함(튜플 shape)의 리뷰·조치 기록일
  뿐 다른 주제·별도 기능이 섞여 있지 않다.

## 요약

`origin/main...HEAD` 누적 diff 88개 파일 중 실질 코드/문서 수정은 `codebase/`·`plan/` 의 12개
파일(816줄)뿐이며, 전부 "TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인" 단일 결함
수정이라는 의도에서 벗어나지 않는다. `assertRowArray` → `updateReturningRows` 치환은 드라이브바이
리팩토링이 아니라 처방 자체이고, 이전 라운드가 지적한 잔존 모순 주석도 최종 상태에서 해소됐음을
직접 확인했다. `auth-oauth.service.ts` 편입과 두 무관 plan 문서(`ie-resume-turn-boundary-cancel.md`,
`retry-turn-terminal-guard.md`) 정정은 표면적으로는 범위 확장처럼 보이지만 전부 같은 root cause
로 소급 추적되고 diff 자체에 근거가 투명하게 기록돼 있어 은폐된 스코프 크립이 아니다. 나머지
76개 파일(review/code·review/consistency 산출물)은 이 저장소가 상시 승인한 자동 review/fix
강제 사이클의 정상 부산물이며 내용상으로도 이 결함만 다룬다. 설정·CI·의존성 변경은 전무하다.

## 위험도

NONE
