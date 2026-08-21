# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (7라운드, 02_49_22)

## 검토 방법

`git log`/`git fetch origin main`으로 branch 상태를 확인한 결과, HEAD(`c8dadb041`)는 직전 6개
리뷰 라운드(`00_03_57`~`02_29_01`)가 이미 처분을 마친 상태 그대로이며 이번 라운드 이후 새 코드
커밋은 없다. `git diff origin/main...HEAD --stat`(138 files, +12430/-25)로 전체 branch diff를
확인하고, `-- codebase/`로 필터링해 실질 애플리케이션 코드 범위(12 files, +987/-11)를 별도
확정했다. 핵심 신규 파일(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`)과
호출부 diff(`executions.service.ts`, `workflows.controller.ts`,
`trigger-parameter.types.ts`, `sanitize-error-message.ts`)는 `Read`/`git diff`로 직접 열어
프롬프트가 생략한 부분까지 전문 대조했다.

## 실질 코드 변경 범위 확인

`codebase/` 하위 12개 파일 전부가 "마스킹된 값의 재제출을 Manual 실행 경로(re-run/execute)
서버측에서 거부한다"는 단일 의도에서 벗어나지 않는다:

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted`
  reason/code 1행 추가만. 기존 3항목과 동일 포맷.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규) + `.spec.ts`(신규) — 이번
  기능의 핵심 구현. raw→resolve 2단계 검사를 캡슐화한 단일 책임 함수. 다른 책임 없음.
- `executions/executions.service.ts` — import 교체 + 호출부 1곳 교체 + `errors`→`details`
  봉투 교정. 이 교정은 새 코드가 배선을 거치지 않으면 무의미해지는 **선존 버그**로,
  docstring·CHANGELOG·spec에 근거가 명시돼 있어 무관한 drive-by 수정이 아니라 직접 결합된
  수정이다.
- `workflows/workflows.controller.ts` — import 교체 + 호출부 1곳 교체.
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS`를
  `export`로 승격 + `Set`→`readonly string[]`(freeze 플라시보 수정, 5라운드에서 자체 발견·수정).
  로직 자체(정확 일치 판정)는 변경 없음. 새 판정 함수를 만들지 않고 기존 판정을 공유하기
  위한 것으로 근거가 docstring에 있다.
- `workflows.controller.spec.ts` / `executions-rerun.service.spec.ts` — 신규 기능 캐너리
  테스트만 추가(직접 대조 완료: 전 케이스가 마스킹 마커 거부/통과 시나리오). 기존 테스트
  수정 없음.
- `repo-guards/__tests__/masked-reject-callers-guard.ts`(신규) + `.spec.ts`(신규) — "세 번째
  Manual 경로가 base 함수를 잘못 import하면 마커 거부가 조용히 우회된다"는 불변식을
  JSDoc-only 강제에서 CI 가드로 옮긴 것. **이번 PR 자체의 리뷰 라운드(`01_38_26` WARNING 1)가
  낸 지적에 대한 직접 대응**이며, 이 저장소는 CLAUDE.md에서 "구현 완료 후 자동 review/fix는
  상시 승인된 강제 의무"로 이런 fix loop를 명문화하고 있다. 판정 대상(base 함수 직접 import)이
  이 PR이 만든 wrapper/base 분리 자체에 국한되어 있어 무관한 신규 기능이 아니라 이 PR이 낳은
  새 불변식의 방어선이다.

## 발견사항

- **[INFO]** 동일 diff가 6번째로 재검토되는 중 — 실질 결함은 이미 CRITICAL 0 / WARNING 0으로
  수렴했으나, 매 라운드가 이전 라운드의 "가드 자체의 결함"을 다시 낳는 패턴이 반복됨
  - 위치: `review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26,02_04_38,02_29_01}/`
    (RESOLUTION.md 6건)
  - 상세: `02_04_38` RESOLUTION이 스스로 적었듯("가드를 넣어 결함을 막으려다 가드가 새 결함
    표면이 됐다") `01_38_26`에서 추가한 repo-guard(`masked-reject-callers-guard.ts`)가
    `02_04_38`에서 WARNING 3건(freeze 플라시보·정규식 자기참조 오판·탐지력 무보증)을 새로
    낳았다. 이는 스코프 이탈이 아니라 같은 세션의 fix→review 재귀 루프의 정상 궤적이지만,
    누적 diff 크기(+987/-11 코드, 그 중 repo-guard 2파일 213줄)가 원래 기능 요청 대비 상당한
    비중을 차지하게 된 원인이다.
  - 제안: 조치 불요 — CLAUDE.md 표준 fix loop 범위 안이고 각 라운드 RESOLUTION이 근거를
    명시했다. 참고 등재만.

- **[INFO]** `review/**` 산출물 87개 파일이 이번 커밋 히스토리에 그대로 실려 있음
  - 위치: `review/code/2026/08/21/**`, `review/consistency/2026/08/20/**`,
    `review/consistency/2026/08/21/00_55_25/**`
  - 상세: 이 프로젝트의 정보 저장 위치 규약(`CLAUDE.md`)상 코드 리뷰·일관성 검토 산출물은
    `review/code/**`/`review/consistency/**`에 저장하는 것이 표준이며, `review/`는
    gitignore 대상이 아니다(`feedback_plan_checkbox_actual_state` 메모). 이번 기능의
    리뷰 이력 자체이지 무관한 산출물이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 공유 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에서
  이번 작업(W6)과 별도인 W5 항목(`Execution.inputData` 응답 의미 반전 외부 소비자 확인)이
  같은 PR 라인에서 함께 종결됨 — 6라운드 전 `01_15_47/scope.md`가 이미 등재·조치 불요
  판정했고 이번 라운드 diff에서 그 이상의 변화가 없음을 재확인했다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (W5 `[x]` 종결 행)
  - 제안: 조치 불요(기존 판정 유지). 근거 명시·코드 변경 없음·저장소 그루밍 관례와 일치.

CRITICAL/WARNING 급 스코프 이탈은 발견되지 않았다. 불필요한 리팩토링·의미 없는 포맷팅 변경·
무관한 파일 수정·사용하지 않는 import 추가·설정 파일의 의도치 않은 변경은 코드 diff
12개 파일 전수 대조 결과 없다.

## 요약

실질 애플리케이션 코드 변경은 12개 파일·+987/-11로, "마스킹된 값의 재제출을 Manual 실행 경로
서버측에서 거부한다"는 단일 의도에 정확히 부합한다. 직접 소스를 열어 대조한 결과 핵심 구현
(`reject-masked-resubmission.ts`)은 단일 책임 함수이고, 두 호출부(`executions.service.ts`/
`workflows.controller.ts`) 변경은 import 교체 + 함수 호출 1줄 치환 + 그 새 코드가 없으면
무의미해지는 선존 버그(`errors`→`details`) 교정으로 전부 이번 기능과 직접 결합돼 있다.
`sanitize-error-message.ts`의 export 승격은 로직 복제 대신 공유를 택한 것으로 근거가 명시돼
있고, 신규 repo-guard(2파일)는 이 PR 자체가 낳은 wrapper/base 분리 불변식을 지키는 방어선으로
같은 PR의 리뷰 지적에 대한 표준 fix loop 안의 대응이다. `review/**`·`plan/**`·`spec/**`의
대량 변경(126개 파일)은 이 프로젝트의 SDD+TDD 워크플로가 요구하는 표준 산출물(리뷰 이력·
spec 동기화 문서)이며 별도 관심사를 끌어들인 흔적이 없다. 6라운드에 걸친 선행 스코프 리뷰들과
결론이 일치하며, 이번 독립 재검증에서도 새로운 스코프 이탈은 발견되지 않았다.

## 위험도

NONE
