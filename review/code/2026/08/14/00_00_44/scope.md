# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD` 실측 결과 **107개 파일, 8385(+)/41(-)**. 이 중
`codebase/**`·`plan/**` 는 정확히 **12개 파일(828줄)**, 나머지 95개는 전부
`review/code/2026/08/13/**`(6라운드)·`review/consistency/2026/08/13/**`(4라운드) 자동 산출물이다.
`git diff --name-only origin/main...HEAD | grep -Ev '^(codebase/|plan/|review/)'` 결과 0건 —
설정·CI·package.json 등 무관 경로 변경 없음. 12개 코드/plan 파일 전부를 `git diff` 로 직접
열람했고, 특히 이전 프롬프트 라운드에서 diff 가 생략됐던 `execution-engine.service.ts`·
`knowledge-base.service.ts`·`update-returning-rows.spec.ts`·`update-returning-tuple-shape.md`
는 Bash 로 원본 diff 를 재확인했다.

## 발견사항

없음(CRITICAL/WARNING) — 12개 코드/plan 파일은 plan(`plan/in-progress/update-returning-tuple-shape.md`)
이 규정한 단일 결함("`UPDATE`/`DELETE … RETURNING` 이 `[rows, count]` 튜플인데 8곳이 행
배열로 다뤘다") 수정 하나로 완전히 수렴한다.

- **의도 이상의 변경 / 무관한 수정**: 없음. 신규 헬퍼(`common/utils/update-returning-rows.ts`
  + `.spec.ts`) 와 8개 소비 지점(`execution-engine.service.ts` 2곳 — `admitExecutionOrDefer`
  L2913-2947·`updateExecutionStatus` L8504-8550, `knowledge-base.service.ts` 5곳 — re-extract
  CAS 락·embedding 재큐·graph 재큐·re-embed CAS 락·reset, `auth-oauth.service.ts` 1곳 —
  `handleCallback`) 가 plan 의 "무엇이 깨져 있었나 (8곳)" 표와 1:1 대응한다. 각 소비 지점의
  실제 diff 를 직접 확인한 결과 shape 처리 교체 외의 로직 변경은 없다.
- **불필요한 리팩토링**: `execution-engine.service.ts` 두 지점의 `assertRowArray(...)` 제거
  → `updateReturningRows(...)` 치환은 새 헬퍼가 `!Array.isArray` 가드를 이미 내장해 중복
  가드를 남기지 않으려는 처방 자체의 일부다. 같은 파일의 세 번째 `assertRowArray` 호출
  (`lockNonTerminalExecutionRow`, SELECT 지점)은 손대지 않았고 import 도 계속 쓰인다 —
  drive-by 정리가 아니다. `knowledge-base.service.ts` 5곳도 `query<{id:string}[]>()` 제네릭을
  `unknown` 으로 바꾸는 것까지 포함해 전부 같은 처방(제네릭은 검증 없는 주장이므로 헬퍼 하나가
  실제 shape 을 판별) 범위 안이다.
- **기능 확장**: `updateReturningRows<T>(result, detail)` 은 튜플/비-튜플 두 shape 만 처리하는
  최소 함수이며 신규 옵션·플래그·설정 확장 없음. `detail` 을 선택 → 필수로 승격한 것도
  (동일 브랜치 내 후속 커밋) 자매 헬퍼 `assertRowArray` 와 계약을 맞추는 결정이고 근거
  (auth-oauth 가 8곳 중 유일하게 비웠던 실제 사례)가 plan/RESOLUTION 에 남아 있다.
- **포맷팅 변경**: 각 파일 diff 는 실질 변경 줄에 국한된 hunk 이며 무관한 개행·공백 재정렬 없음.
- **주석 변경**: 추가/수정 주석은 전부 이번 튜플 shape 결함의 실측 근거·회귀 이유를 설명하는
  신규 내용이다. `execution-engine.service.ts` 안의 옛 주석("RETURNING id 이므로 실제 shape 은
  행 배열이다" — 결함의 근본 원인이 된 문장)을 삭제한 것도 이전 라운드 CRITICAL 지적에 따른
  조치이며 범위를 벗어나지 않는다.
- **임포트 변경**: `auth-oauth.service.ts`·`execution-engine.service.ts`·
  `knowledge-base.service.ts` 세 곳에 추가된 `import { updateReturningRows } from
  '.../update-returning-rows'` 는 각 파일에서 실제 호출부가 있어 사용된다. 불필요한
  정리/추가 없음.
- **설정 변경**: 없음 (`grep -Ev '^(codebase/|plan/|review/)'` 0건, 실측).
- **plan 문서 3건**(`update-returning-tuple-shape.md` 신규 255줄, `ie-resume-turn-boundary-cancel.md`·
  `retry-turn-terminal-guard.md` 소급 정정 배너+체크박스)은 이번 버그가 과거 여러 라운드에
  걸쳐 "동시 cancel 방어가 닫혔다" 고 잘못 종결시킨 근거(`persisted` 가 이 버그로 인해 항상
  `true`)였다는 사실을 정정하는, 동일 근본원인에 종속된 소급 기록이다. 두 plan 의 diff 는
  본문 배너 삽입·체크박스 정정에 한정되며 `developer` 의 `plan/**` 쓰기 권한 범위 안이다.
- **review/code, review/consistency 산출물 95개 파일**: `CLAUDE.md` §외부 LLM 호출 정책의
  "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약에 따른 정상 부산물이다.
  RESOLUTION.md 6건 전문을 확인한 결과 전부 동일 튜플 shape 결함의 리뷰·조치 기록이며,
  다른 주제의 코드 변경이나 별도 기능이 섞여 있지 않다.

## 요약

핵심 코드 변경(9개 backend 파일, 828줄 — plan 3건 포함 시 12개)은 plan 이 규정한
"UPDATE/DELETE RETURNING 튜플 shape" 단일 결함 수정 범위와 정확히 일치하며,
`assertRowArray` → `updateReturningRows` 치환·`query<T>()` 제네릭 제거도 드라이브바이
리팩토링이 아니라 처방 자체다. 최초 "7곳"에서 "8곳"(auth-oauth 소셜 로그인 콜백)으로 넓어진
범위와 인접 plan 문서(`ie-resume-turn-boundary-cancel.md`) 소급 정정도 동일 근본원인으로
추적되고 문서화돼 은폐된 스코프 크립이 아니다. diff 의 대부분(95/107 파일)을 차지하는
`review/**` 산출물은 CLAUDE.md 가 상시 승인한 자동 review/fix 강제 사이클의 정상 부산물이며
내용상 전부 동일 결함을 다룬다. 설정·CI·의존성 변경은 전무하다. 스코프 관점의 결함 없음.

## 위험도

NONE
