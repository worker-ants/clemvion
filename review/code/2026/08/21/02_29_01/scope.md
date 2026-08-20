# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, `02_29_01`)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 브랜치 diff(124 files, +10596/-25)를 확인하고,
`codebase/` 하위만 별도 필터링(11 files, +949/-11)해 실질 애플리케이션 코드 변경 범위를
검증했다. 프롬프트가 diff 를 생략한 파일(`reject-masked-resubmission.ts`/`.spec.ts`,
`executions-rerun.service.spec.ts`, `masked-reject-callers-guard.ts`,
`plan/complete/spec-draft-inputoverride-marker-reject.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`,
`spec/5-system/3-error-handling.md`)는 `git diff`/`Read` 로 직접 열어 대조했다. 이 커밋들은
이전 5라운드(`00_03_57`→`02_04_38`)가 이미 심층 검토·처분한 diff 가 그대로 포함된 누적
브랜치이므로, 각 라운드의 `scope.md`(파일 26/39/52/67/81)가 이미 내린 판단을 재검증하되
독립적으로 실물 코드를 다시 대조했다.

## 실질 코드 변경 범위 확인 (`codebase/` 11개 파일, +949/-11)

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted` reason/code
  enum 1행 + 매핑 1건. 기존 3항목과 동일 포맷.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규)+`.spec.ts`(신규) — 이번 기능의
  핵심 구현. `isRecord`(`to-record.ts`) 공유 유틸을 재사용하도록 정리돼 있음을 실물로 확인 —
  로컬 재구현 없음.
- `executions/executions.service.ts` — import 교체 + 호출부 1곳 교체(게이트 499) + `errors`→
  `details` 봉투 교정(게이트 512). 후자는 신규 필드별 안내가 응답에 실제로 실리기 위한
  전제 조건이라(주석·CHANGELOG·plan 문서가 모두 "이 배선을 안 고치면 새 코드가 무의미해지는
  선존 버그"로 근거를 남김) 별개 무관 수정이 아니라 직접 결합된 수정이다.
- `executions/executions-rerun.service.spec.ts` — 신규 기능 캐너리 3건만 추가. 기존 테스트
  수정 없음(`Read` 로 diff 전문 확인).
- `workflows/workflows.controller.ts` — import 교체 + 호출부 1곳 교체(게이트 317)만.
- `workflows/workflows.controller.spec.ts` — 신규 기능 캐너리 3건만 추가.
- `repo-guards/__tests__/masked-reject-callers-guard.ts`(신규)+`.spec.ts`(신규) — "Manual 경로가
  base `resolveTriggerParameters` 를 잘못 import 하면 마커 거부가 조용히 우회된다"는 불변식을
  기계로 강제하는 가드. 기능 확장이 아니라 `01_38_26` 라운드가 낸 WARNING("불변식이 JSDoc
  으로만 강제된다")의 fix 이고, 같은 저장소에 이미 있는 자매 패턴(`eslint-unicorn-peer-guard.ts`
  등, 파서/소비-spec 분리 규약)을 그대로 따른다 — over-engineering 이 아니라 기존 관례 준수.
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS` 를
  `export` 로 승격 + `Set`→`readonly string[]`(실제 런타임 불변화, `02_04_38` W3 fix)만. 새
  판정 로직을 만들지 않고 egress 마스킹과 같은 판정을 공유하기 위한 승격이라 목적이 명확하다.
- `shared/utils/sanitize-error-message.spec.ts` — 승격된 export 의 불변성·마커 집합을 고정하는
  캐너리만 추가.

이 11개 파일 전부 "마스킹된 값의 재제출(및 Manual 실행 경로의 직접 입력)을 서버가 거부한다"는
단일 의도에서 벗어나지 않는다. 불필요한 리팩토링·의도치 않은 포맷팅 변경·무관한 import 정리·
사용하지 않는 import 추가는 발견되지 않았다.

## 나머지 113개 파일에 대한 판단

- **CHANGELOG.md**(파일 1) — 이번 기능 서술만. 인접한 `## Unreleased — Execution.inputData
  카브아웃…` 섹션은 diff 밖(문맥 라인)이라 이번 변경이 손댄 게 아니다.
- **`review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26,02_04_38}/**`**(파일 16~85, 39개
  경로) — 이전 5라운드 리뷰 산출물이 그대로 committed. 이 저장소는 `review/code/**` 를 커밋
  대상으로 다루는 것이 오래된 표준 관례임을 `git log --oneline --all -- 'review/code/**'`
  (650 커밋, 여러 과거 PR 병합 커밋 포함)로 재확인했다 — 스코프 이탈이 아니라 이 프로젝트의
  SDD+TDD 워크플로가 요구하는 표준 부산물.
- **`review/consistency/2026/08/{20,21}/**`**(파일 86~117, 32개 경로) — 동일한 이유로 표준
  부산물.
- **`plan/complete/spec-draft-inputoverride-marker-reject.md`**(파일 13, 신규) — 이번 기능의
  범위 결정 근거(왜 지금인가·무엇을 거부하는가·왜 raw 우선 검사인가) 전용 planner 산출물.
  실물(`Read`)로 확인 — 무관 내용 없음.
- **`plan/complete/spec-update-masked-reject-framing.md`**(파일 14, 신규) — spec 서술 정정
  전용(검사 시점 "직후"→"전후", "재제출 한정"→"Manual 실행 경로 한정"). 절차 위반(developer
  턴이 `spec/` 표 행을 직접 고친 것)을 스스로 적발해 사후 정규화한 기록도 포함 — 이는 스코프
  이탈이 아니라 그 이탈을 correction 하는 문서 자체다.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`**(파일 15) — 트래커 W6
  항목을 종결 처리. 다만 같은 diff 에서 **무관한 별도 항목 W5**(`Execution.inputData` 응답
  의미 반전의 외부 소비자 확인)도 함께 `[x]` 로 종결됨(게이트 353행 부근). 이 항목은 이전
  라운드(`01_15_47/scope.md`)에서 이미 INFO 로 등재됐고, 코드 변경을 수반하지 않으며 종결
  사유("저장소 소유자 직접 답변")가 명시돼 있다. 이 저장소가 "그루밍 커밋에서 여러 트래커
  항목을 함께 닫는" 패턴을 정책적으로 허용해 온 선례(`project_spec_sync_grooming_2026_07_08`)와
  일치해 실질 위험은 낮다.
- **`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
  `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/{3-error-handling,12-webhook,
  13-replay-rerun,14-external-interaction-api}.md`**(파일 118~124, 7곳) — 전부
  `masked_value_resubmitted`/§R17 범위·검사 시점 서술에 직접 종속된 문장 추가/치환만. 부모
  `INVALID_INPUT` 최상위 코드가 `3-error-handling.md` 카탈로그 표에 이전엔 없었던 것을 이번에
  등재한 것(`error-handling.md:80` 부근 신규 행)도, 신규 상세 코드(`MASKED_VALUE_RESUBMITTED`)를
  설명하려면 부모 코드가 먼저 문서화돼 있어야 하므로 직접 종속된 보강이지 별개 기능 추가가
  아니다. `Read`로 7개 파일 diff 전문을 대조해 무관 서술 변경이 섞여 있지 않음을 확인했다.

## 발견사항

- **[INFO]** 공유 tracker 문서에서 이번 작업(W6)과 무관한 별도 항목(W5, `Execution.inputData`
  응답 의미 반전의 외부 소비자 확인)이 같은 diff 에 함께 종결 처리됨 (이전 라운드에서 이미
  등재·처분된 항목의 재확인)
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `- [x]
    **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인**` 항목(파일 15, diff 게이트
    353행 부근)
  - 상세: 코드 변경은 전혀 수반하지 않고, 종결 사유("저장소 소유자의 직접 답변, 2026-08-20")도
    명시돼 있다. 이 저장소의 기존 그루밍 커밋 관례와 일치해 실질 리스크는 낮다.
  - 제안: 조치 불요(문서 전용, 근거 명시, 기존 관례와 일치). 참고로만 기록.

## 요약

실질 애플리케이션 코드 변경은 11개 파일(+949/-11)로 "마스킹된 값의 재제출(및 Manual 실행
경로에서의 직접 입력)을 서버가 거부한다"는 단일 의도에 정확히 부합한다. 5라운드에 걸친 반복
검토를 거치며 추가된 부수 변경(선존 `errors`→`details` 봉투 버그 수정, `isMaskedMarker`/
`MASKED_MARKERS` export 승격+실제 불변화, repo-guard 신설)은 전부 새 기능이 의미 있게
작동하기 위한 직접 결합 항목이거나 이전 라운드가 낸 WARNING 의 fix 였으며, 기존 저장소 관례
(자매 파서+spec 분리 가드 패턴)를 그대로 따라 over-engineering 이 아니다. 무관한 리팩토링·
포맷팅-only 변경·불필요한 임포트·설정 파일 변경은 발견되지 않았다. 나머지 113개 파일(`review/
code/**` 39곳, `review/consistency/**` 32곳, `plan/**` 3곳, `spec/**` 7곳, CHANGELOG 1곳)은
이 프로젝트의 SDD+TDD 워크플로가 요구하는 표준 부산물이며(과거 650개 커밋에 걸친 관례로
확인), 전부 이번 기능의 spec 동기화·리뷰 이력에 국한된다. 유일하게 반복 등재되는 항목은
트래커 문서에서 무관한 항목(W5)이 같은 diff 에 함께 종결된 것인데, 코드 변경이 없고 근거가
명시적이며 기존 그루밍 관례와 일치해 실질 위험은 낮다.

## 위험도

NONE
