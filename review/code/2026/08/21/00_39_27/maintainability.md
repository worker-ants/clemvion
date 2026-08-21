# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (재검토, 00_39_27)

## 검토 범위

실질 프로덕션 코드 변경 8개 파일(+621/-10):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, plan/spec 문서, `review/code/2026/08/21/00_03_57/**`·`review/consistency/2026/08/20/**` 산출물)는 이전 라운드(`00_03_57`)가 이미 검토·처분했고 이번 diff 는 그 산출물을 그대로 커밋에 실은 것뿐이라(스코프 재확인은 해당 라운드의 `scope.md` 참조) 코드 유지보수성 관점의 재검토 대상에서 제외했다.

전작 리뷰(`00_03_57` maintainability.md)가 지적한 "find+length체크+throw 3줄이 두 호출부에 복붙" WARNING 은 이번 재작업(`resolveTriggerParametersRejectingMasked` 가 raw→resolve 순서를 캡슐화)으로 해소되어 있음을 `executions.service.ts:499`·`workflows.controller.ts:317` 실물 코드로 확인했다 — 두 호출부 모두 이제 함수 호출 한 줄이다.

## 발견사항

- **[WARNING]** 신규 `isPlainRecord` 타입가드가 같은 디렉터리에 이미 있는 `isRecord` 를 재구현한다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수 `isPlainRecord` (게이트 112~114)
  - 상세: `reject-masked-resubmission.ts` 는 `isPlainRecord(v): v is Record<string, unknown> { return v !== null && typeof v === 'object' && !Array.isArray(v); }` 를 새로 선언한다. 그런데 **바로 같은 디렉터리**(`codebase/backend/src/modules/execution-engine/utils/`)의 `to-record.ts` 가 정확히 동일한 판정을 하는 `export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }` 를 이미 export 하고 있다(refactor-03 M-7 산출물, `(x as Record) ?? {}` 단언을 없애기 위해 만든 공유 유틸). 두 함수는 이름만 다를 뿐 로직이 문자 그대로 동일하다. 이 저장소는 같은 모양의 3-줄 판정을 `manual-trigger.handler.ts`·`trigger-data.util.ts` 에도 각각 private 로 중복 선언해 둔 상태라(grep 확인, 총 4곳), 이번 PR 은 새 파일을 추가하면서 기존 공유 유틸을 import 하지 않고 그 중복 목록에 한 개를 더 얹었다. 새로 만드는 파일이라 옛 코드 관성이 아니라 **의도적으로 선택할 수 있었던 지점**이라는 점에서 이전 3건과는 성격이 다르다.
  - 제안: `import { isRecord } from './to-record';` 로 교체하고 로컬 `isPlainRecord` 선언(및 그 사용처 2곳, 게이트 101)을 제거한다. 새 판정을 만들지 않았어도 됐던 자리이므로 리스크 없는 정리다. (기존 3곳의 중복은 이번 PR 스코프 밖 — 별도 정리 대상으로 남겨도 됨.)

- **[INFO]** `throwIfAny` 헬퍼 이름이 무엇을 던지는지 시그니처만으로는 드러나지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수 `throwIfAny` (게이트 71~75)
  - 상세: `throwIfAny(errors)` 는 배열이 비어있지 않으면 `TriggerParameterValidationException` 을 던진다. 이름이 일반적이어서(`Any` 가 "무엇이든 하나라도 있으면" 을 뜻하는지 즉시 명확하지 않음) 이 파일 밖으로 옮겨지거나 재사용될 경우 오독 여지가 있다. 현재는 파일 내부(비공개) 헬퍼로 두 곳에서만 쓰이고 호출부 바로 위에 의도를 설명하는 주석이 있어 문맥상 읽는 데는 문제없다.
  - 제안: 필수 아님. 이 파일을 다시 손댈 기회가 있으면 `throwIfMaskedResubmissionErrors` 류로 구체화하는 것을 고려.

## 요약

핵심 구현(`reject-masked-resubmission.ts`, `trigger-parameter.types.ts` 증분)은 함수 하나가 raw→resolve 순서를 캡슐화하는 구조로 재정리되어 이전 라운드가 지적한 "판정 로직 두 호출부 중복" 문제가 실제로 해소됐고, 호출부(`executions.service.ts`/`workflows.controller.ts`)는 각각 함수 호출 한 줄 + 봉투별로 다른 `catch` 블록만 남아 가독성이 좋다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 매직 넘버 없이 `MAX_REDACT_DEPTH` 상수를 재사용하며, 신규 enum 값·매핑은 기존 3항목과 동일한 네이밍 컨벤션(`snake_case` reason ↔ `UPPER_SNAKE_CASE` code)을 그대로 따른다. 테스트(`reject-masked-resubmission.spec.ts` 및 두 호출부 spec)는 경계·캐너리·통합(왕복) 테스트를 의도가 드러나는 이름으로 조직해 가독성이 높다. 유일한 실질 지적은 신규 파일이 같은 디렉터리에 이미 있는 `isRecord`(`to-record.ts`) 를 이름만 바꿔 재구현한 것(WARNING) — 새로 작성하는 코드였던 만큼 손쉽게 피할 수 있었던 중복이다. 그 외에는 기존 코드베이스 스타일(문서화 밀도·네이밍·에러 코드 매핑 패턴)과 잘 정합한다.

## 위험도

LOW
