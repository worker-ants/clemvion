# 변경 범위(Scope) 리뷰

## 발견사항

없음 — `git diff --stat origin/main...HEAD -- codebase plan` 실측 결과 15개 파일(코드 10 +
plan 5)이 프롬프트의 파일 1~15와 정확히 1:1 대응하며, 전부 단일 결함
(`UPDATE`/`DELETE … RETURNING` 이 TypeORM 0.3.31+pg 에서 `[rows, rowCount]` 튜플로 오는데
7~8곳이 행 배열로 다뤘다)의 발견·수정·회귀 가드·소급 문서 정정으로 수렴한다.

- **의도 이상의 변경 / 무관한 수정**: 코드 10개 파일 각각을 원본 diff로 직접 재확인했다
  (`update-returning-rows.ts` 신규 헬퍼, `update-returning-rows.spec.ts` 신규 구조적 가드,
  `assert-row-array.spec.ts` 카운트 3→1 갱신, `auth-oauth.service.ts`/`.spec.ts`,
  `execution-engine.service.ts`/`.spec.ts`, `knowledge-base.service.ts`/`.spec.ts`,
  `auth-oauth-callback.e2e-spec.ts` 신규). 전부 plan(`update-returning-tuple-shape.md`)의
  "무엇이 깨져 있었나 (8곳)" 표에 나열된 지점과 1:1 대응하고, 무관한 함수·로직 변경은
  없었다.
- **불필요한 리팩토링**: `assertRowArray` → `updateReturningRows` 교체(engine 2곳, kb 5곳)는
  얼핏 무관 삭제로 보이지만 `updateReturningRows` 자체가 동일한 `!Array.isArray` 가드를
  내장해 흡수하므로 이 결함 수정의 핵심 처방(헬퍼 일원화)에 직접 속한다. engine 의 세
  번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`, SELECT 지점, `:8223`)은 손대지
  않고 남아 있고 import 도 여전히 사용돼(`assertRowArray` 1회) dead import 가 아니다.
  `.query<T>()` 제네릭을 `unknown` 으로 낮춘 변경(engine 2곳·kb 4곳)도 "타입이 실제 shape 을
  보장하지 않는다"는 이번 결함의 근본 원인을 코드로 반영한 것으로 스코프 내다.
- **기능 확장**: 신규 헬퍼는 튜플/비-튜플 두 shape 만 처리하는 최소 함수(57줄)다. 신규
  옵션·플래그·설정 확장 없음. over-engineering 신호 없음.
- **포맷팅 변경**: 각 코드 diff 는 실질 변경 줄에 국한된 hunk 이며 무관한 개행·공백
  재정렬이 섞인 흔적이 없다.
- **주석 변경**: 추가/수정된 주석은 전부 이번 결함(튜플 shape)의 실측 근거·회귀 이유·과거
  옛 주석("`RETURNING id` 이므로 실제 shape 은 행 배열이다")의 정정을 설명하는 것으로,
  결함과 무관한 기존 주석을 건드리지 않았다.
- **임포트 변경**: `execution-engine.service.ts`/`knowledge-base.service.ts`/
  `auth-oauth.service.ts`에 추가된 `import { updateReturningRows } from '.../update-returning-rows'`
  는 세 파일 모두 실제 호출부가 있어 사용된다. 기존 `assertRowArray` import 도 engine 에서
  여전히 쓰이므로 불필요한 정리·추가가 없다.
- **설정 변경**: 설정 파일 변경 없음.
- **plan 문서(5개)**: `update-returning-tuple-shape.md`(신규, 259줄)는 이번 결함 자체의
  발견·실측·처방·검증 기록이라 스코프 내다. 나머지 4개(`exec-intake-followups.md`,
  `ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`,
  `spec-update-node-cancellation-shutdown-classification.md`)는 **이번 결함이 과거에 "닫혔다"고
  잘못 종결한 다른 plan들의 결론을 소급 정정하는 배너·체크리스트 추가**로, plan 문서의
  기존 기술 서술 자체를 변경하지 않고(예외: `ie-resume-turn-boundary-cancel.md` 의 생존
  뮤턴트 항목 진단 정정 — 이 역시 같은 튜플 결함이 원인이라 직접 관련) 정확히 이 결함의
  blast radius 범위 안에 있다. `developer` 는 `spec/` 쓰기 권한이 없어(CLAUDE.md skill 표)
  spec 변경이 필요한 5건은 실제 spec 을 고치지 않고 `[planner 위임]` 표로만 등재했다 —
  권한 밖 확장을 시도하지 않고 위임한 것은 스코프 준수 신호다.
- **review/ 산출물(review/code/2026/08/13/*, review/consistency/2026/08/13~14/*)**: 프로젝트
  컨벤션상 `code-review-agents`/`consistency-checker` 가 `review/code/**`·
  `review/consistency/**`에 직접 쓰기 권한을 갖고, `developer` 는 `review/**/RESOLUTION.md`만
  쓴다. 실제로 신규 파일 중 `RESOLUTION.md`(4건, `20_36_35`/`22_45_24`/`23_07_11`/`23_46_00`)
  만 developer 산출물 성격이고 나머지(`meta.json`, `_retry_state.json`, `scope.md`,
  `security.md` 등 리뷰어별 리포트)는 반복된 `/ai-review` 라운드 자체의 표준 산출물이다.
  CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 명시하므로 이는
  scope creep 이 아니라 이 프로젝트의 필수 워크플로 부산물이다.

## 요약

리뷰 대상 diff 전체(코드 10 + plan 5 + review 산출물 다수)는 "`UPDATE`/`DELETE RETURNING`
튜플 shape 오해" 라는 단일 결함의 발견 → 8곳 수정 → 구조적 회귀 가드 2벌 → e2e 신설 →
그 결함이 과거 종결시킨 다른 plan 들의 소급 정정 → 8라운드에 걸친 `/ai-review` 산출물
기록이라는 하나의 연속된 이야기에서 벗어나지 않는다. `assertRowArray`→`updateReturningRows`
교체와 제네릭 `unknown` 하향은 드라이브바이 리팩토링이 아니라 처방 그 자체이며, plan 4건의
소급 배너 추가는 이번 결함의 blast radius 조사 결과이지 무관한 문서 손질이 아니다. spec
변경이 필요한 부분은 developer 권한 밖이라 직접 고치지 않고 `[planner 위임]` 으로만 남겨
두어 권한 경계도 지켰다. 무관한 포맷팅·주석·임포트·설정 변경은 발견되지 않았다.

## 위험도

NONE
