# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, 02_49_22)

## 검토 범위 및 방법

이 diff 는 `origin/main` 대비 9개 커밋(`8e0728a90`..`c8dadb041`)의 누적分으로, 이미 6라운드
(`00_03_57`→`02_29_01`)에 걸쳐 코드 리뷰를 거친 상태다. 프롬프트에 포함된 `review/code/**`·
`review/consistency/**` 산출물은 그 이력 자체이며(이 저장소 컨벤션상 `review/` 는 gitignore
대상이 아니라 감사 기록으로 커밋됨), 코드 유지보수성 관점의 재검토 대상이 아니다. 이번
라운드에서는 프롬프트 diff 대신 **현재 실제 파일 상태**를 직접 열어(`Read`) 이전 라운드가
지적·처분했다고 기록한 항목들이 실코드에도 반영됐는지 대조했다.

실질 프로덕션 코드 변경:
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규, 정적 가드)

## 발견사항

- **[INFO]** `throwIfAny` 헬퍼 이름이 무엇을 던지는지 시그니처만으로 드러나지 않는다 (이전
  라운드 `00_39_27` INFO 이월, 미조치 상태 그대로 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `throwIfAny` (line 91)
  - 상세: `throwIfAny(errors)` 는 비어있지 않으면 `TriggerParameterValidationException` 을
    던진다. 파일 내부(비공개) 헬퍼로 두 호출부(line 66, 72)에서만 쓰이고 각 호출부 바로 위에
    의도를 설명하는 주석이 있어 현재 문맥에서는 오독 위험이 낮다. 새로 도입되는 변경사항은
    없음 — 지난 라운드의 판단(강제 아님)을 재확인.
  - 제안: 필수 아님. 이 파일을 다시 손댈 기회가 있으면 `throwIfMaskedResubmissionErrors` 류로
    구체화하는 것을 고려.

- **[INFO]** 신규 정적 가드(`masked-reject-callers-guard.ts`)의 주석·문자열 제거가 정규식
  기반이라 임의 코드 형태에 완전하지 않음을 스스로 문서화하고 있다 — 의도된 트레이드오프
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `stripCommentsAndStrings` (line 93)
  - 상세: 자체 doc comment 가 "AST 파서가 더 정확하지만 이 가드의 판정 대상은 import 문
    하나라 문법 표면이 좁다" 는 근거를 명시하고, 실제 오탐 사례(`02_04_38` architecture W1,
    JSDoc `{@link}` 예시 텍스트를 실제 import 로 오판)를 근거로 "주석·문자열 제거는 하되
    AST 로 확장하지는 않는다" 는 경계를 의도적으로 그었다. 이 저장소가 반복해 온 "blind
    정규식 vs 정밀 파서" 판단(형태가 좁으면 정규식, 넓으면 AST)과 정합하고, 죽은 허용목록
    캐너리·합성 fixture 탐지 캐너리로 스스로의 결함 클래스를 재검증하고 있어 리스크가 낮다.
  - 제안: 조치 불요. 참고 등재만.

## 이전 라운드 지적사항의 실코드 재확인 (신규 발견 아님, 확인 근거만 기록)

다음은 이전 라운드가 "해소"라고 기록한 항목을 실물 코드로 직접 대조해 재확인한 결과다 —
새 지적이 아니라 이번 라운드의 검증 절차로서 기록한다.

- `isPlainRecord` 재구현 (`00_39_27` WARNING) → 해소 확인. 현재
  `reject-masked-resubmission.ts` 는 로컬 판정을 만들지 않고
  `import { isRecord } from './to-record'` 를 그대로 쓴다(line 11, 121). 저장소 안에
  `manual-trigger.handler.ts`/`trigger-data.util.ts` 의 기존(이 PR 무관) `isPlainRecord`
  중복은 그대로 남아 있으나 이번 diff 가 만든 것도 건드린 것도 아니라 스코프 밖이다.
- `MASKED_MARKERS` 런타임 불변성 플라시보 (`02_04_38`/`RESOLUTION 01_15_47`) → 해소 확인.
  `Set` 이 아니라 `readonly string[]` + `Object.freeze` 로 바뀌었고(`sanitize-error-message.ts`
  line 150), `isMaskedMarker` 는 `.includes()` 로 대응 변경됐다(line 165). 캐너리 테스트
  (`sanitize-error-message.spec.ts` "MASKED_MARKERS 불변성", `.push()` 가 실제로 throw 하는지
  단언)가 이 보장을 기계에 맡긴다. `.has()` 등 옛 `Set` API 를 기대하는 잔존 소비처는 grep 상
  없음.
- 두 호출부(`executions.service.ts`/`workflows.controller.ts`)의 3줄 판정 중복
  (`00_03_57` WARNING) → 해소 확인. `resolveTriggerParametersRejectingMasked` 로 캡슐화되어
  두 호출부 모두 함수 호출 한 줄이고, `catch` 블록의 응답 포맷(`INVALID_INPUT` vs
  `INVALID_TRIGGER_PARAMETERS`, `details` 키)만 호출부마다 다르게 남아 있다.
- `errors` → `details` 봉투 교정의 회귀 방지 → 확인. `executions-rerun.service.spec.ts`
  "[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다" 테스트가 `body.errors` 가
  `undefined` 임과 `body.details` 내용 둘 다 단언한다.

## 요약

핵심 구현(`reject-masked-resubmission.ts`)은 raw→resolve 두 단계 검사 순서를 자신이 캡슐화하는
단일 진입점 함수로 정리되어 있고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮으며 매직 넘버 없이
`MAX_REDACT_DEPTH` 상수를 재사용한다. 신규 enum 값(`masked_value_resubmitted`/
`MASKED_VALUE_RESUBMITTED`)·매핑 항목은 기존 3항목과 동일한 네이밍 컨벤션을 그대로 따르고,
왜 기존 `coerce_failed` 를 재사용하지 않았는지 doc comment 로 근거를 남겨 향후 오분기를 막는다.
이전 6라운드에 걸쳐 지적된 실질 결함(boolean 우회 CRITICAL, 호출부 중복, `isPlainRecord`
재구현, `Object.freeze(Set)` 플라시보, `errors`/`details` 봉투 유실)은 모두 현재 코드에서 직접
확인한 결과 실제로 해소되어 있다. 신규 정적 가드(`masked-reject-callers-guard.ts` +
`masked-reject-callers.spec.ts`)는 자기 결함 클래스(오탐·죽은 허용목록·탐지 무력화)를 캐너리로
스스로 재검증하는 구조라 신뢰도가 높고, 이 저장소의 형제 가드(`eslint-unicorn-peer-guard.ts` 등)
패턴과 일관된다. 남는 것은 이전 라운드부터 강제 대상이 아니라고 판단된 낮은 비용의 INFO
(`throwIfAny` 네이밍) 하나뿐이며 이번 라운드에서 새로 발견된 유지보수성 결함은 없다.

## 위험도

NONE
