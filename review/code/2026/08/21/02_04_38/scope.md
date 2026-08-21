# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 마커 재제출 서버측 거부 (5라운드째 누적 diff)

## 검토 방법

프롬프트가 나열한 109개 파일(코드 8 + CHANGELOG 1 + plan 3 + `review/code/**` 56 + `review/consistency/**` 32 + spec 7 + repo-guard 2)을
전수로 훑고, diff 가 생략된 핵심 구현 파일(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`)은 `Read` 로 직접 열어 대조했다.
이 브랜치는 이미 `00_03_57`·`00_39_27`·`01_15_47`·`01_38_26` 4라운드 scope 리뷰를 거쳤고, 그 산출물 자체가 diff 안에 포함돼 있다.

## 실질 코드 변경 범위 (8개 파일)

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted` reason/code 1행 추가. 기존 3항목과 동일 포맷.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규) + `.spec.ts`(신규) — 이번 기능의 핵심. 실물을 열어 확인 — raw→resolve 순서 캡슐화, 목적 외 로직 없음.
- `executions/executions.service.ts` — import 교체 + 호출부 1곳 + `errors`→`details` 봉투 교정(이번 신규 코드가 그 배선을 거치지 않으면 무의미해지는 선존 버그로, CHANGELOG·RESOLUTION 양쪽에 근거가 명시돼 있어 무관 수정이 아니라 직접 결합임).
- `workflows/workflows.controller.ts` — import 교체 + 호출부 1곳.
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS` 를 `export` 로 승격 + `Object.freeze` 추가(런타임 불변성, `01_15_47` 리뷰 INFO 조치). 새 판정 로직을 만들지 않고 기존 걸 재사용하려는 목적이 docstring 에 명시됨.
- `workflows.controller.spec.ts` / `executions-rerun.service.spec.ts` — 신규 캐너리 테스트만 추가, 기존 테스트 미수정.
- `repo-guards/__tests__/masked-reject-callers-guard.ts`(신규) + `.spec.ts`(신규) — "Manual 경로가 base 함수를 우회해서 못 쓰게" 막는 아키텍처 가드. `01_38_26` architecture 리뷰의 WARNING("불변식이 JSDoc 으로만 강제된다")에 대한 직접 응답으로 실물 코드에서도 확인했다 — 별도로 끌어들인 기능이 아니라 이번 PR 자체가 만든 위험(자매 발산)을 이번 PR 안에서 닫는 구조.

8개 파일 전부 "마스킹 마커 재제출을 서버가 거부한다"는 단일 의도에서 벗어나지 않는다. 불필요한 리팩토링·무관한 import 정리·포맷팅 노이즈·과잉 기능 확장은 발견되지 않았다.

## 발견사항

- **[INFO]** 공유 트래커 문서에서 이번 작업(W6)과 무관한 별도 항목(W5, `Execution.inputData` 외부 소비자 확인)이 같은 커밋에서 함께 종결됨
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (diff 게이트 353행, `- [x] **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인**` 항목)
  - 상세: 코드 변경은 전혀 수반하지 않고, 종결 사유("저장소 소유자의 직접 답변, 2026-08-20")도 명확하다. 이미 `01_15_47` 라운드 scope 리뷰가 동일 항목을 INFO 로 등재했고, 이 저장소는 과거에도 "그루밍 커밋이 여러 트래커 항목을 함께 닫는" 패턴을 정책적으로 허용해 온 이력이 있다(memory: `project_spec_sync_grooming_2026_07_08`). 신규 발견이 아니라 기존 처분이 그대로 유지되고 있음을 재확인.
  - 제안: 조치 불요.

- **[INFO]** `fix(security)` 커밋(`50f799efd`)이 developer 턴에서 `spec/5-system/14-external-interaction-api.md` 표 행을 직접 수정 — CLAUDE.md 의 role 경계(`developer` 는 `spec/` read-only) 위반
  - 위치: `spec/5-system/14-external-interaction-api.md` §R17 표 행. 자체 보고: `plan/complete/spec-update-masked-reject-framing.md` "⚠️ 절차 위반을 먼저 적는다 (W3)"
  - 상세: 내용 자체는 이미 planner 턴이 확정한 캐비엇을 표 행에 동기화한 것뿐이라 문제가 없으나 경로가 잘못됐다. 작업자가 `git log -S` 로 스스로 발견해 사후 정규 경로(`plan/complete/spec-update-masked-reject-framing.md`, planner 턴)로 편입·정정을 완료했다. 이미 `01_38_26` 라운드가 "조치 불요, 이미 정규화"로 처분했고, 이번 diff 는 그 정규화 산출물을 그대로 포함한다.
  - 제안: 조치 불요 — 이력 기록으로만 유지.

- **[INFO]** `review/code/**`(56개) · `review/consistency/**`(32개) 산출물이 diff 대다수를 차지
  - 상세: 이 저장소 CLAUDE.md 는 코드 리뷰/일관성 검토 산출물을 각각 `review/code/<날짜>/<시각>/`, `review/consistency/<날짜>/<시각>/` 에 커밋 대상으로 못박는다(`review/` 는 gitignore 대상이 아님). 5라운드에 걸친 리뷰-수정 루프의 흔적이 매 라운드 커밋에 실리는 것이 이 프로젝트의 표준 워크플로이지 무관한 파일 추가가 아니다. 내용도 전부 이 기능 자체를 다룬다(다른 주제의 산출물 없음).
  - 제안: 조치 불요.

- **[INFO]** spec 변경 7곳(`1-data-model.md`·`3-workflow-editor/3-execution.md`·`4-nodes/7-trigger/1-manual-trigger.md`·`5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,3-error-handling}.md`)
  - 상세: 전부 `masked_value_resubmitted`/§R17 범위 서술("재제출 한정" → "Manual 실행 경로 전체, 저작 주체 기준")·검사 시점("직후" → "전후 2단계") 정정에 국한된다. 별개 기능·별개 관심사를 끌어들인 흔적이 없고, `spec/1-data-model.md:471` 처럼 이전 라운드 서술이 최신 구현과 어긋나던 지점을 되짚어 닫는 것도 이 PR 자체의 이터레이션이 남긴 부채를 이 PR 안에서 정리하는 것이라 스코프 밖 확장이 아니다.
  - 제안: 조치 불요.

## 요약

핵심 애플리케이션 코드 변경은 8개 파일(+681줄 내외)로 좁게 유지되며 "마스킹된 값의 재제출을 Manual 실행 경로 서버측에서 거부한다"는 단일 의도에 정확히 부합한다. 신규 repo-guard(2파일)는 이 PR 자체가 남긴 아키텍처 위험(자매 함수 발산)을 이 PR 범위 안에서 닫는 응답이라 기능 확장이 아니다. `sanitize-error-message.ts` 의 export 승격·freeze 도 새 판정을 만들지 않고 기존 걸 재사용하려는 명시적 근거가 있다. 나머지 대부분(88개 파일)은 `review/**` 리뷰 산출물과 spec/plan 문서로, 이 저장소가 강제하는 표준 워크플로 부산물이며 전부 이 기능 하나만을 다룬다 — 여러 라운드 반복 리뷰의 결과이지 별개 관심사 혼입이 아니다. 유일하게 짚을 두 항목(트래커 W5 동반 종결, developer 턴의 spec 직접 수정 절차 위반)은 모두 이전 라운드에서 이미 식별·정규화 완료됐고 코드 변경이 없거나 이미 시정된 상태라 실질 위험이 없다. 불필요한 리팩토링·무관한 파일 수정·의미 없는 포맷팅·주석/임포트 정리·설정 변경은 발견되지 않았다.

## 위험도

NONE
