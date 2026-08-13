# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main...HEAD` 누적 diff 31개 파일 전체(코드 9개 + plan 2개 + 이전 라운드 리뷰 산출물
`review/code/2026/08/13/20_36_35/**` 12개 + `review/consistency/2026/08/13/20_36_36/**` 8개)를
프롬프트 diff 기준으로 전수 확인했다. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
는 Bash 로 현재 파일 상태(2905~2955행)도 직접 대조해 diff 서술과 실제 코드가 일치함을 확인했다.

## 발견사항

- **[INFO]** 실 수정 범위가 plan 이 처음 규정한 "7곳"에서 "8곳"(`auth-oauth.service.ts` 소셜 로그인
  콜백 추가)으로 넓어졌고, 무관해 보이는 다른 plan 문서(`ie-resume-turn-boundary-cancel.md`)까지
  건드린다 — 다만 둘 다 **동일 근본원인**으로 소급 추적되고 투명하게 문서화돼 있어 은폐된 확장은 아니다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:141` (`updateReturningRows` 적용),
    `plan/in-progress/ie-resume-turn-boundary-cancel.md:14`(소급 정정 배너), `:499`(체크박스 정정)
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 의 원래 범위는 "무엇이 깨져 있었나 (7곳)"
    표(execution-engine 2 + knowledge-base 5)였다. `auth-oauth.service.ts` 는 그 표에 없었고, 이전
    라운드 코드 리뷰(`review/code/2026/08/13/20_36_35/requirement.md` CRITICAL 1)에서 "같은 결함
    클래스가 라이브로 남아 있다"고 지적된 뒤 `RESOLUTION.md` 를 통해 이번 diff 에 추가됐다 — 같은
    세션·같은 root cause(TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 오인)이므로 별개 작업 유입은
    아니다. `ie-resume-turn-boundary-cancel.md` 편집도 이 fix 가 그 plan 의 6~8차 라운드 CRITICAL
    종결 근거(`persisted` 계산)를 소급 무효화한다는 `plan_coherence` WARNING 을 그대로 반영한
    필수 정정이며, `developer` 의 `plan/**` 쓰기 권한 범위 안이다. 두 확장 모두 diff 자체(plan
    Overview·RESOLUTION.md·consistency SUMMARY)에 이유가 명시돼 은폐된 스코프 크립은 아니지만,
    "7곳 수정"이라는 최초 제목이 실제로는 "8곳 + 인접 plan 문서 정정"으로 커진 사실 자체는 스코프
    관점에서 기록해 둘 값어치가 있다.
  - 제안: 조치 불요(이미 근거 문서화됨). 향후 유사 사례에서는 plan frontmatter 나 Overview 에 "범위
    확장" 이력을 한 줄 남기는 관행을 유지할 것.

- **[INFO]** 리뷰 대상 31개 파일 중 20개(`review/code/2026/08/13/20_36_35/**`,
  `review/consistency/2026/08/13/20_36_36/**`)는 코드 수정이 아니라 이전 `/ai-review`·
  `/consistency-check` 세션의 산출물이다.
  - 상세: 이 저장소 규약(`CLAUDE.md` "코드 리뷰 산출물"/"일관성 검토 산출물" 위치, `review/**` 는
    gitignore 대상 아님)상 정상적으로 커밋되는 표준 워크플로 부산물이며, `developer` SKILL 의
    "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항과도 일치한다. 스코프 위반이 아니다.
  - 제안: 없음.

- **불필요한 리팩토링**: `execution-engine.service.ts` 두 지점에서 `assertRowArray(...)` 호출을
  제거하고 `updateReturningRows(...)` 로 교체했다(`admitExecutionOrDefer`·`updateExecutionStatus`).
  `updateReturningRows` 가 동일한 `!Array.isArray` 가드를 내장해 흡수하므로 처방의 일원화에 직접
  속한다. 같은 파일의 세 번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`, SELECT 지점)은
  손대지 않았고 import 도 계속 쓰여 dead code 가 아니다. `assert-row-array.spec.ts` 의 가드 수치
  변경(`guards: 3 → 1`)도 이 교체의 직접 결과다. 무관한 리팩토링 없음.
- **기능 확장**: `updateReturningRows` 는 튜플/행-배열 두 shape 만 처리하는 최소 함수이고, 신규
  옵션·플래그·설정을 도입하지 않는다. over-engineering 신호 없음.
- **포맷팅 변경**: 9개 코드 파일의 diff 훅 전부가 실질 로직/주석/타입 변경에 국한돼 있고, 무관한
  개행·공백 재정렬은 발견되지 않았다.
- **주석 변경**: 추가·삭제된 주석은 전부 이번 튜플 shape 결함의 실측 근거·회귀 이유를 설명한다.
  `execution-engine.service.ts` 의 옛 "RETURNING id 이므로 실제 shape 은 행 배열이다" 주석은
  실제로 삭제되고 새 주석으로 통합됐음을 현재 파일(2905~2955행)에서 직접 확인했다 — 이전 라운드
  documentation 리뷰가 지적한 모순 주석 CRITICAL 은 이번 diff 에서 해소된 상태다.
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`
  3개 파일에 추가된 `import { updateReturningRows } from '.../update-returning-rows'` 는 각 파일
  모두 실제 호출부가 있어 사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: 설정 파일 변경 없음.

## 요약

31개 파일 중 코드 변경 9개는 "TypeORM `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플인데
행 배열로 오인했다"는 단일 근본원인에서 벗어나지 않으며, `assertRowArray` 제거도 헬퍼가 동일 가드를
흡수하는 의도된 통합이지 드라이브바이 리팩토링이 아니다. 포맷팅·주석·임포트 변경 모두 실질 수정에
직접 결속돼 있고, 무관한 정리는 발견되지 않았다. 다만 원래 plan 이 규정한 "7곳"이 리뷰 과정에서
발견된 동일 결함(`auth-oauth.service.ts`)으로 "8곳"까지 늘었고, 그 여파로 별개 이름의 plan 문서
(`ie-resume-turn-boundary-cancel.md`)까지 정정됐다 — 둘 다 diff 자체에 근거가 투명하게 기록돼 있어
은폐된 스코프 크립은 아니지만, 최초 범위보다 실제 변경 표면이 넓어진 사실은 기록해 둘 만하다. 나머지
20개 파일(이전 `/ai-review`·`/consistency-check` 세션 산출물)은 이 저장소의 표준 강제 워크플로
부산물로, 스코프 위반이 아니다.

## 위험도

LOW
