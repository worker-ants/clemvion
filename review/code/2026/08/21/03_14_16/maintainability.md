# 유지보수성(Maintainability) 리뷰 — 마커 재제출 서버측 거부 (Manual 실행 경로 전체로 확장)

## 발견사항

- **[INFO]** `findMaskedResubmissions` 가 `export` 되어 있지만 실제 외부 소비처가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` — 함수 선언부 (115번째 줄대, `export function findMaskedResubmissions(...)`)
  - 상세: 같은 파일 안의 `resolveTriggerParametersRejectingMasked` 가 두 번(raw 검사·resolve 후 검사) 호출하는 것이 전부이고, `sanitize-error-message.spec.ts` 의 언급은 doc 주석 안의 텍스트일 뿐 실제 `import` 가 아니다(저장소 전체 grep 으로 확인). 직접 단위 테스트도 없다 — `reject-masked-resubmission.spec.ts` 는 `resolveTriggerParametersRejectingMasked` 만 import 해서 간접적으로만 커버한다. 같은 PR 의 `REASON_TO_DETAIL` 매핑 리터럴에 대해 이미 "형제와 나란히 두지 않으면 직접 겨냥한 단언이 없다"는 지적을 스스로 캐너리 주석으로 남겨 놓았는데(`resolve-trigger-parameters.spec.ts`), 같은 성격의 갭이 `findMaskedResubmissions` 에도 있다. `export` 로 넓혀 둔 공개 표면은 다음 사람이 "이 함수는 모듈 밖에서도 쓰라고 만든 것"으로 오인해 새 소비처를 만들 여지를 준다.
  - 제안: 외부 소비 계획이 없다면 `export` 를 제거해 module-private 로 좁히거나(캡슐화), 계속 넓게 두려면 `reject-masked-resubmission.spec.ts` 에 `findMaskedResubmissions` 를 직접 겨냥하는 단위 테스트 한두 개를 추가해 "간접 커버만 된다"는 상태를 없앤다.

- **[INFO]** 판정 모듈과 그 가드의 파일명이 서로 다른 단어 순서를 쓴다("reject-masked" vs "masked-reject")
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (모듈 자신) vs `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` / `masked-reject-callers.spec.ts` (allowlist 가드)
  - 상세: 핵심 모듈은 "reject-masked-resubmission"(reject → masked → resubmission), 그 직접 호출부를 지키는 가드는 "masked-reject-callers"(masked → reject → callers) 로 어순이 뒤바뀌어 있다. 기능적으로는 문제없지만, 파일명으로 관련 파일을 찾거나(`grep -l`, IDE 퍼지 검색) 새 파일을 추가할 때 어느 순서를 따를지 다음 사람이 헷갈릴 수 있는 사소한 일관성 결함이다.
  - 제안: 강제할 사안은 아님. 다음에 이 영역을 손댈 기회가 있으면 가드 파일명을 `reject-masked-callers-guard.ts` 류로 맞추는 것을 고려.

- **[INFO]** `workflows.controller.ts` 의 같은 `try/catch` 블록 안에 새 한국어 주석과 기존 영어 주석이 섞여 있다 (이전 라운드 `00_03_57` maintainability 에서 이미 지적, 비강제로 분류되어 아직 미해결)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 한국어 주석(`resolveTriggerParametersRejectingMasked` 호출 직전) 바로 아래, `` `details` so GlobalExceptionFilter surfaces the per-field breakdown `` 로 시작하는 기존 영어 주석
  - 상세: 이번 diff 가 만든 결함은 아니고(영어 줄은 컨텍스트, 미변경) 강제 사안도 아니지만, 이번 라운드에서도 여전히 같은 블록 안에 두 언어가 공존한다. 최근 커밋들이 서술형 근거 주석을 한국어로 통일하는 쪽으로 수렴하는 추세라(본 diff 의 다른 신규 주석 전부 한국어) 다음에 이 블록을 여는 사람이 어느 언어로 이어써야 할지 헷갈릴 수 있다.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

## 요약

이번 라운드는 이미 7차례 리뷰를 거친 마커 거부 로직의 최종 정리 단계로, 직전(`00_03_57`) 라운드가 WARNING 으로 지적했던 "두 호출부의 find+throw 3줄 중복"이 `resolveTriggerParametersRejectingMasked` 단일 wrapper 로 캡슐화되어 실제로 해소됐다(양 호출부는 이제 `resolveTriggerParametersRejectingMasked(schema, ...)` 한 줄만 호출). 핵심 로직(`reject-masked-resubmission.ts`)은 여전히 작고 책임이 하나이며, JSDoc 이 검사 시점·경계(정확 일치·깊이 상한)·phase 분리 이유를 매우 상세히 근거로 남겨 다음 유지보수자가 "왜 이렇게 짰는가"를 코드만 보고 재구성할 수 있다. `trigger-parameter.types.ts` 의 신규 reason/code 추가도 기존 3항목과 동일한 네이밍·구조를 그대로 따르고, `Record<reason, ...>` 타입이 컴파일 타임에 매핑 누락을 막아준다. `MASKED_MARKERS` 를 `Set`→`readonly string[]`+`Object.freeze` 로 바꾼 것도 실제 런타임 불변성을 확보하고 캐너리 테스트로 고정해 "문서만 그렇게 서술하고 실제로는 안 막히는" 이전 결함 패턴을 제거했다. 남은 지적은 전부 INFO 수준의 사소한 마감(불필요할 수 있는 export, 파일명 어순, 잔존 영어 주석)이며 어느 것도 이번 PR 의 병합을 막을 사유가 아니다.

## 위험도

LOW
