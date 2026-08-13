# 변경 범위(Scope) 리뷰

## 발견사항

없음(CRITICAL/WARNING) — `git diff --stat origin/main...HEAD` 실측 결과 71개 파일이 바뀌었고,
`codebase/**`·`plan/**` 는 정확히 12개 파일(783줄)로 이 PR 이 의도한 단일 결함
("`UPDATE`/`DELETE … RETURNING` 이 `[rows, count]` 튜플인데 8곳이 행 배열로 다뤘다")
수정 범위에 1:1 대응한다. 나머지 59개 파일은 전부 `review/code/**`·`review/consistency/**`
아래 세 라운드(코드 리뷰 `20_36_35`/`22_45_24`/`23_07_11`, 일관성 검토 `20_36_36`/`22_45_25`/`23_07_12`)의
자동 산출물이며, `CLAUDE.md` §외부 LLM 호출 정책 아래 "구현 완료 후 자동 review/fix 는 상시
승인된 강제 의무" 규약에 따라 이 PR 개발 과정에서 생성·커밋된 것이다. `codebase/`·`plan/` 외
경로(설정 파일·CI·package.json 등)는 `git diff --name-only` 로 전수 확인했을 때 하나도 없다.

- **의도 이상의 변경 / 무관한 수정**: 없음. `codebase/backend/src/common/utils/`(신규 헬퍼
  `updateReturningRows` + spec), `modules/auth/auth-oauth.service.ts`(+spec),
  `modules/execution-engine/execution-engine.service.ts`(+spec),
  `modules/knowledge-base/knowledge-base.service.ts`(+spec) 9개 파일 전부가 `plan/in-progress/update-returning-tuple-shape.md`
  이 표로 나열한 "무엇이 깨져 있었나 (8곳)" 목록(execution-engine 2곳·knowledge-base 5곳·
  auth-oauth 1곳)과 정확히 일치한다. 각 소비 지점 diff 를 개별 확인(`git diff` 로 전체 hunk
  직접 열람)했고, UPDATE/DELETE `RETURNING` shape 처리 교체 외의 로직 변경은 없다.
- **불필요한 리팩토링**: `execution-engine.service.ts` 에서 `assertRowArray(...)` 2곳을
  `updateReturningRows(...)` 로 교체하며 인접 주석도 다시 썼지만, 이는 새 헬퍼가 배열 가드를
  이미 내장(`!Array.isArray` 체크)하기 때문에 중복 가드를 남기지 않으려는 처방 자체의 일부다.
  같은 파일의 세 번째 `assertRowArray` 호출(SELECT 지점, `lockNonTerminalExecutionRow`)은
  손대지 않았고 import 도 계속 쓰이므로 drive-by 정리가 아니다.
- **기능 확장**: `updateReturningRows<T>(result, detail)` 은 튜플/비-튜플 두 shape 만 처리하는
  최소 함수이며, 신규 옵션·플래그·설정 확장 없음. `detail` 인자를 "선택"에서 "필수"로 바꾼
  것(`23_07_11` WARNING 4 조치)도 자매 헬퍼 `assertRowArray` 와 계약을 맞추는 범위 내 결정이고,
  근거(8곳 중 auth-oauth 한 곳이 비웠던 실제 사례)가 plan/RESOLUTION 에 남아 있다.
- **포맷팅 변경**: 각 코드 파일 diff 는 실질 변경 줄에 국한된 hunk 이며 무관한 개행·공백
  재정렬이 섞인 흔적 없음.
- **주석 변경**: 추가/수정된 주석은 전부 이번 튜플 shape 결함의 실측 근거·회귀 이유를
  설명하는 신규 내용이다. `execution-engine.service.ts` 안의 옛 주석("RETURNING id 이므로
  실제 shape 은 행 배열이다" — 이번 결함의 근본 원인이 된 문장)을 삭제한 것도 `20_36_35`
  CRITICAL 2 지적에 따른 조치로, 범위를 벗어나지 않는다.
- **임포트 변경**: `auth-oauth.service.ts`·`execution-engine.service.ts`·`knowledge-base.service.ts`
  세 곳에 추가된 `import { updateReturningRows } from '.../update-returning-rows'` 는 각 파일에서
  실제 호출부가 존재해 사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: 없음. `git diff --name-only origin/main...HEAD | grep -Ev '^(codebase/|plan/|review/)'`
  결과 0건.
- **plan 문서 3건**(`update-returning-tuple-shape.md` 신규, `ie-resume-turn-boundary-cancel.md`·
  `retry-turn-terminal-guard.md` 소급 정정 배너)은 이번에 발견된 버그가 과거 6~12+ 라운드에
  걸쳐 "동시 cancel 방어가 닫혔다" 고 잘못 종결시킨 근거(`persisted` 값이 버그로 인해 항상
  `true`)였다는 사실을 정정하는, 이 결함과 직접 연결된 소급 기록이다. 두 plan 의 diff 는
  본문 배너 삽입과 체크박스 정정에 한정되며 무관한 섹션을 건드리지 않았다.
- **review/code, review/consistency 산출물 59개 파일**: 내용을 표본 확인(각 라운드
  RESOLUTION.md 전문, `20_36_35/scope.md`·`maintainability.md`·`security.md`·`user_guide_sync.md`
  전문, `22_45_24`·`23_07_11` RESOLUTION 전문)한 결과 전부 동일한 튜플 shape 결함의 리뷰·조치
  기록이며, 다른 주제의 코드 변경이나 별도 기능 추가가 섞여 있지 않다. `_retry_state.json` 은
  harness 재시도 상태 매니페스트(로컬 절대경로 외 시크릿 없음)로, `code-review-agents`/
  `consistency-checker` SKILL 문서가 명시한 대로 세션 산출물의 일부로 커밋되는 것이 정상
  동작이다.

## 요약

핵심 코드 변경(9개 backend 파일, 783줄)은 plan 이 규정한 "UPDATE/DELETE RETURNING 튜플 shape"
단일 결함 수정 범위와 정확히 일치하며, `assertRowArray` → `updateReturningRows` 치환도
드라이브바이 리팩토링이 아니라 처방 자체다. plan 문서 3건은 이번 결함이 과거 라운드의 종결
판정 근거를 무너뜨린 소급 영향을 기록하는 것으로 같은 결함에 종속된 변경이다. diff 의 대부분
(59/71 파일)을 차지하는 `review/code/**`·`review/consistency/**` 산출물은 이 저장소가 CLAUDE.md
에서 상시 승인한 자동 review/fix 강제 사이클의 정상 부산물이며, 내용 표본 검토 결과 전부 같은
결함을 다룰 뿐 무관한 주제나 별도 기능이 섞여 있지 않다. 설정 파일·CI·의존성 변경은 전무하다.
스코프 관점의 결함 없음.

## 위험도

NONE
