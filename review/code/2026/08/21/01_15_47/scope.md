# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 branch diff(79 files, +5662/-24)를 확인하고,
`codebase/` 하위만 별도로 필터링해 실질 애플리케이션 코드 변경 범위를 검증했다. 프롬프트가
생략한 파일(`reject-masked-resubmission.ts`/`.spec.ts`, `spec/5-system/3-error-handling.md`,
`plan/in-progress/spec-draft-inputoverride-marker-reject.md` 등)은 `git diff`/`Read` 로 직접
열어 대조했다.

## 발견사항

- **[INFO]** 공유 tracker 문서(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에서
  이번 작업(W6, 마커 리터럴 거부)과 무관한 별도 항목(W5, `Execution.inputData` 응답 의미 반전의
  외부 소비자 확인)이 같은 커밋(`3e96f4b44`)에서 함께 종결 처리됨
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (diff 게이트 353행 부근,
    `- [x] **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인**` 항목)
  - 상세: W5 는 이번 PR 의 주제(마커 재제출 서버측 거부)와 다른 트래커 항목이다. 종결 사유
    자체는 "저장소 소유자의 직접 답변(2026-08-20)"으로 근거가 명확하고 코드 변경은 전혀
    수반하지 않지만, W6 전용 planner 커밋(`3e96f4b44`, "`inputOverride` 서버측 마커 거부를
    명문화") 안에 함께 묶여 커밋 메시지의 스코프보다 넓은 편집이 들어갔다. 이 저장소는 과거에도
    "그루밍 커밋에서 여러 트래커 항목을 함께 닫는" 패턴을 정책적으로 허용해 온 이력이 있고
    (`project_spec_sync_grooming_2026_07_08`), 실질 리스크는 낮다.
  - 제안: 조치 불요(문서 전용, 근거 명시, 기존 관례와 일치). 참고로만 기록.

- **[INFO]** `spec/5-system/3-error-handling.md` 에 `MASKED_VALUE_RESUBMITTED` 도입과 별개로
  기존에 문서화가 빠져 있던 `INVALID_INPUT` 최상위 코드 표 행이 새로 추가됨
  - 위치: `spec/5-system/3-error-handling.md` (§1.7 인근, `| `INVALID_INPUT` | Re-run 의
    `inputOverride` 가 ... |` 신규 행)
  - 상세: `MASKED_VALUE_RESUBMITTED` 는 `details[].code` 필드값이고, 그 부모 최상위 `error.code`
    인 `INVALID_INPUT` 이 이 카탈로그 표에 이전엔 등재돼 있지 않았다. 신규 상세 코드를 설명하려면
    부모 코드의 존재를 먼저 문서화해야 하므로 직접 종속된 보강이며, 별개 기능 추가가 아니다.
  - 제안: 조치 불요 — 이번 기능이 요구하는 카탈로그 정합성 보강 범위 안.

## 실질 코드 변경 범위 확인

`codebase/` 하위 diff 는 8개 파일(+681/-10)로 좁게 유지된다:

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted` reason/code
  enum 1행 + 매핑 1건 추가만. 기존 3항목 포맷 그대로 준수.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규) + `.spec.ts`(신규) — 이번 기능의
  핵심 구현. 다른 책임 없음.
- `executions/executions.service.ts` — import 교체 + 호출부 1곳 교체 + `errors`→`details` 봉투
  교정(§R17 표 캐비엇·CHANGELOG·RESOLUTION 이 모두 "이 PR 이 만드는 새 코드가 그 배선을 거치지
  않으면 무의미해지는 선존 버그"로 근거를 남겨 직접 결합돼 있음을 확인 — 별개 무관 수정이 아님).
- `workflows/workflows.controller.ts` — import 교체 + 호출부 1곳 교체.
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS` 를
  `export` 로 승격만(로직 변경 없음, 새 판정 함수를 만들지 않고 기존 판정을 재사용하기 위함 —
  "미러 발산" 재발을 피하려는 명시적 근거가 docstring 에 있음).
- `workflows.controller.spec.ts` / `executions-rerun.service.spec.ts` — 신규 기능에 대한 캐너리
  테스트만 추가, 기존 테스트 수정 없음.

이 8개 파일 모두 "마스킹 마커 재제출을 서버가 거부한다"는 단일 의도에서 벗어나지 않는다.
불필요한 리팩토링·의도치 않은 포맷팅 변경·무관한 import 정리·사용하지 않는 import 추가는
발견되지 않았다.

## 나머지 71개 파일에 대한 판단

`review/code/**`, `review/consistency/**`, `plan/in-progress/**`, `spec/**` 변경은 이
저장소의 SDD+TDD 워크플로 규약(`CLAUDE.md` 정보 저장 위치 표)상 각 라운드의 필수 산출물이자
이번 기능의 spec 동기화·리뷰 이력이며, 별도 관심사를 끌어들인 흔적이 없다 — spec 변경은 전부
`masked_value_resubmitted`/§R17 범위 서술·검사 시점 정정에 국한되고, plan 문서는 이 작업의
진행 기록(및 위 INFO 1건)이다. 이들은 코드 스코프 이탈이 아니라 이 프로젝트가 요구하는 표준
부산물이다.

## 요약

실질 애플리케이션 코드 변경은 8개 파일·681줄로 "마스킹된 값의 재제출을 Manual 실행 경로
서버측에서 거부한다"는 단일 의도에 정확히 부합하며, 기존 판정 로직 재사용(`isMaskedMarker` export
승격)과 직접 결합된 선존 버그 수정(`errors`→`details`) 외에는 범위를 벗어나는 수정이 없다.
39개의 `review/**` 산출물과 spec/plan 문서 변경은 이 프로젝트의 표준 워크플로 부산물로, 스코프
이탈이 아니다. 유일하게 짚을 점은 공유 트래커 문서에서 무관한 항목(W5)이 이번 W6 전용 커밋에
함께 종결된 것인데, 코드 변경이 없고 근거가 명시적이라 실질 위험은 낮다.

## 위험도

NONE
