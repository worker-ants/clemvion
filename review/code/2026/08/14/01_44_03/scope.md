# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `auth-oauth.service.ts`에서 튜플 shape 수정과 함께 `remember_me`(snake_case) 컬럼 매핑 결함도 같은 커밋(`e34a85b44`)에서 수정됐다 — 원래 결함(tuple shape) 과는 원인이 다른 별개의 버그다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`AuthOAuthStateRow` interface 도입부, `handleCallback` 내 `const rememberMe = record.remember_me === true;`)
  - 상세: CHANGELOG.md·plan(`update-returning-tuple-shape.md`)·커밋 메시지(`e34a85b44 fix(auth): 튜플을 고치니 그 아래 컬럼명 결함이 드러났다`) 모두 이 결함을 "튜플 버그가 콜백을 막고 있어 도달 불가능했던 dead code였다가, 튜플을 고치는 순간 처음 실행 가능해진 결함"으로 명시적으로 설명하고 있어 인과관계가 문서화돼 있다. 튜플 수정만 하고 이 결함을 방치하면 배포 즉시 "로그인 유지"가 침묵으로 깨진 상태로 나가므로, 같은 PR에서 함께 닫는 것이 합리적이다. 다만 엄밀히는 "UPDATE/DELETE RETURNING 튜플 오인"이라는 plan 제목의 단일 결함 범위를 살짝 넘는 두 번째 버그 클래스이므로 기록해 둔다.
  - 제안: 조치 불요 — 근거가 문서화돼 있고 인과관계가 명확해 스코프 위반으로 보지 않는다. 참고용 INFO.

- **[INFO]** 두 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)가 공유하던 "주석 스트리핑 카운팅" 로직을 신규 공유 유틸 `common/utils/__testing__/source-scan.ts`로 추출했다 — 넓게 보면 리팩토링이다.
  - 위치: `codebase/backend/src/common/utils/__testing__/source-scan.ts`(신규), `codebase/backend/src/common/utils/assert-row-array.spec.ts`(`countCalls` 사용으로 교체), `codebase/backend/tsconfig.build.json`(`**/__testing__/**` exclude 추가)
  - 상세: 이 추출은 임의 정리가 아니라 이번 라운드에서 실제로 발견된 결함(`00_54_01` testing WARNING 1 — 한쪽 가드만 주석 스트리핑 하드닝을 받아 비대칭이 생김)을 근본적으로 닫기 위한 것으로, 두 가드의 계산을 한 곳으로 모아 "세 번째 가드가 생겨도 여기만 고치면 된다"는 근거가 파일 docstring에 명시돼 있다. `tsconfig.build.json` 변경도 이 신규 테스트 전용 디렉터리를 dist에서 제외하기 위한 필연적 동반 변경이다. 스코프 이탈이라기보다 "이번 라운드가 발견한 자기 테스트의 결함을 고치는" 정당한 범위 내 리팩토링으로 판단된다.
  - 제안: 조치 불요.

- **[INFO]** plan 소급 정정(retroactive footnote)이 `exec-intake-followups.md`, `ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`, `spec-update-node-cancellation-shutdown-classification.md` 4개의 기존 in-progress plan 문서에 걸쳐 삽입됐다 — 코드 수정 자체보다 넓은 문서 범위처럼 보인다.
  - 위치: 위 4개 plan 파일의 "소급 정정 (2026-08-13/14)" 배너 블록
  - 상세: 이 튜플 shape 버그는 위 plan들이 완료 처리하며 "닫혔다"고 선언한 근거(`updateExecutionStatus`의 `persisted` 값)를 무효화하는 실제 소급 영향이 있고, 이는 `update-returning-tuple-shape.md`의 "소급 영향" 섹션에서 각 plan별로 구체적 근거(반환값이 항상 `true`였다는 실측)와 함께 추적된다. 임의로 관련 없는 문서를 건드린 것이 아니라, 새로 발견된 버그가 실제로 무효화한 과거 완료 선언들을 정정하는 것으로, 이 저장소의 기존 관례(자매 plan 소급 각주 패턴)와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**`·`review/consistency/**` 하위에 이전 6개 ai-review 라운드(`20_36_35`~`00_00_44`)와 5개 consistency-check 라운드(`20_36_36`~`00_00_45`)의 산출물(RESOLUTION.md, meta.json, 각 관점별 `.md`)이 대량으로(약 94개 파일) 이번 diff에 포함돼 있다.
  - 위치: `review/code/2026/08/13/*/`, `review/code/2026/08/14/00_00_44/`, `review/consistency/2026/08/13/*/`, `review/consistency/2026/08/14/00_00_45/`
  - 상세: 이는 CLAUDE.md가 규정한 "구현 완료 후 `/ai-review` + Critical/Warning fix는 상시 승인된 강제 의무"이자 developer 역할의 쓰기 권한(`review/**/RESOLUTION.md`)·`code-review-agents`/`consistency-checker` skill의 산출 경로 규약에 정확히 부합하는 표준 워크플로 부산물이다. 실제 코드 변경(`codebase/**`, `plan/**`)과 무관한 별도 파일·기능이 섞인 것이 아니라, 같은 fix-review 사이클이 반복된 흔적이므로 "무관한 수정"으로 분류하지 않는다.
  - 제안: 조치 불요.

- **의도 이상의 변경 / 무관한 수정**: `git diff --stat origin/main...HEAD`를 실측한 결과, `codebase/backend/**`(핵심 헬퍼 3쌍 신규+기존 소비 지점 3개 파일 수정+e2e 1개 신설)와 `codebase/backend/tsconfig.build.json`, `CHANGELOG.md`, `plan/in-progress/**` 5개 문서, `review/code|consistency/**` 산출물 외에 다른 영역(frontend, packages, channel-web-chat, CI 설정, 기타 backend 모듈)을 건드린 파일은 없다. `execution-engine.service.ts`·`knowledge-base.service.ts`의 diff를 직접 대조한 결과 plan이 명시한 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1)과 정확히 1:1 대응하며, 그 외 로직 변경은 없다.
- **불필요한 리팩토링**: `assertRowArray` → `updateReturningRows` 치환은 각 지점에서 실제 shape(튜플 vs 행 배열)이 다르다는 새로 발견된 사실에 따른 필수 교체이며, 남은 SELECT 지점(`lockNonTerminalExecutionRow` 등)의 `assertRowArray` 호출은 그대로 유지돼 있어 드라이브바이 전면 치환이 아니다.
- **기능 확장**: 신규 헬퍼 `updateReturningRows`는 튜플/행 배열 두 shape만 판별하는 최소 함수이며 옵션·플래그 확장 없음. over-engineering 신호 없음.
- **포맷팅 변경**: 각 diff는 실질 변경 줄에 국한돼 있고 무관한 개행·정렬 변경이 섞인 흔적은 확인되지 않았다.
- **주석 변경**: 추가된 주석은 전부 이번 결함(튜플 shape·컬럼명 매핑)의 실측 근거·회귀 이유를 설명하는 신규 주석이며, 무관한 기존 주석을 건드린 곳은 없다. `execution-engine.service.ts`의 옛 "RETURNING id 이므로 실제 shape은 행 배열이다" 잘못된 주석은 삭제하고 올바른 설명으로 대체했는데, 이는 근본 원인이 된 잘못된 믿음을 남겨두지 않기 위한 의도적 정정이다.
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`에 추가된 `import { updateReturningRows } from ...`는 각 파일에서 실제로 호출부가 있어 사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: `tsconfig.build.json`의 `exclude` 배열에 `**/__testing__/**` 1개 패턴만 추가됐고, 신규 테스트 전용 공유 디렉터리(`common/utils/__testing__/`) 도입과 직접 연동된 필연적 변경이다. 그 외 설정 파일(tsconfig 나머지, eslint, CI 워크플로 등) 변경 없음.

## 요약

리뷰 대상 diff(137개 파일, `origin/main...HEAD`)는 "TypeORM 0.3.31+pg가 UPDATE/DELETE RETURNING에 `[rows, rowCount]` 튜플을 돌려주는데 8곳이 행 배열로 오인했다"는 단일 결함 클래스 수정에서 벗어나지 않는다. 실제 코드 변경은 신규 헬퍼(`updateReturningRows`) + 8개 소비 지점 교체 + 회귀 가드 3벌(자체 스펙, 자매 가드 하드닝, 신규 e2e) + 그 하드닝에 필요한 최소 공유 테스트 유틸 1개 + tsconfig 예외 1줄로 명확히 국한된다. `auth-oauth.service.ts`의 컬럼명(snake_case) 결함 동반 수정은 원래 결함과는 별개 버그이지만 튜플 수정이 처음으로 그 dead code를 살려낸 인과관계가 문서화돼 있어 같은 PR에 포함하는 것이 합리적이다. plan 문서 4곳에 걸친 소급 정정과 대량의 `review/**` 산출물은 코드 스코프 이탈이 아니라 이 저장소가 규정한 다회 fix-review 워크플로와 새로 밝혀진 버그의 실제 소급 영향을 반영한 정당한 문서화다. 무관한 파일·설정·포맷팅·불필요한 임포트 변경은 발견되지 않았다.

## 위험도

NONE
