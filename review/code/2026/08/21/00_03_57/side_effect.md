STATUS=success side_effect review complete — 0 CRITICAL, 1 WARNING, 3 INFO
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 서버측 거부

## 검토 범위

핵심 코드 변경 8개 파일(`trigger-parameter.types.ts` · `reject-masked-resubmission.ts`(+spec) ·
`executions-rerun.service.spec.ts` · `executions.service.ts` · `workflows.controller.ts`(+spec) ·
`sanitize-error-message.ts`)을 실제 저장소에서 `Read`/`grep` 으로 직접 열어 대조했다. `plan/**`·
`review/**` 아래의 문서·리뷰 산출물 추가는 이 저장소 컨벤션(`review/`·`plan/`은 gitignore 대상이
아니며 산출물을 커밋하는 것이 정상 워크플로)상 부작용이 아니므로 범위에서 제외했다. `spec/**.md`
편집도 런타임 부작용이 아니므로 제외.

## 발견사항

- **[WARNING]** 공개 API `POST /workflows/:id/execute` 의 동작이 "재제출 방지"를 넘어 **신규 입력에도
  적용**되도록 넓어졌다 — 리터럴 값이 마커 세 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 정확히
  같은 요청은 재제출 여부와 무관하게 무조건 400 으로 거부된다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:313-323` (`findMaskedResubmissions` 호출 블록)
  - 상세: 이 엔드포인트는 재제출 전용이 아니라 Manual 실행 전체(JSON 에디터 자유 편집 포함)의 단일
    진입점이고, 값이 "히스토리에서 재적재됐는지" vs "방금 새로 타이핑됐는지" 구분할 플래그를 받지
    않는다. 즉 사용자가 그 필드 값으로 문자 그대로 `***` 를 신규로 입력해도(재제출과 무관하게)
    동일하게 거부된다 — 이 엔드포인트를 호출하는 기존 클라이언트(자동화 스크립트·QA 도구 등)가
    과거에 정상적으로 통과시키던 값 집합이 이번 변경으로 조용히 좁아진다(인터페이스 축소, 하위
    호환 파괴 가능성). 자매 호출부 `executions.service.ts` (`reRun`, `inputOverride`) 는 "재제출"
    의미가 실제로 성립하므로 이 우려에서 자유롭다.
  - 참고: 이 특정 사항은 이미 같은 세션의 `review/consistency/2026/08/20/23_33_00/{SUMMARY,cross_spec}.md`
    가 독립적으로 WARNING 으로 지적했고, `spec/5-system/14-external-interaction-api.md §R17`(잔여②
    행 아래 "가드의 범위" 캐비엇, gate `1575-1596`)이 이를 **의도된 트레이드오프**("Manual 파라미터
    값 슬롯에서 마커 세 문자열은 예약어")로 명문화했다 — 즉 인지·수용된 결정이지 미인지 결함은
    아니다. 다만 부작용 관점에서 "공개 엔드포인트가 과거 통과시키던 입력 부분집합을 거부로 전환한다"
    는 사실 자체는 side-effect reviewer 로서 별도로 등재해 둔다 — 릴리스 노트/API 소비자 공지 여부는
    이 PR 의 diff 만으로는 확인 불가.
  - 제안: 신규 발견이 아니므로 추가 조치 요구 없음(§R17 이 이미 결정·문서화). 다만 이 거부가 처음
    배포되는 시점에 "Manual 파라미터 값에 리터럴 마커 문자열을 직접 입력하는 기존 자동화가 있는가"를
    별도로 확인했는지 재확인 권장(이미 트래커에 등재된 "왜 지금인가" 확인과는 다른 질문 — 그쪽은
    `Execution.inputData` **읽기** 소비자를 물었고, 이건 **쓰기**(파라미터 값) 소비자를 묻는다).

- **[INFO]** 에러 응답 봉투의 필드가 `errors` → `details` 로 바뀌었다(공개 인터페이스 변경처럼
  보이지만 실질 영향은 없음을 코드로 확인)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:495-514`
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)는
    `resp.details ?? nested?.details` 만 읽고 `resp.errors` 는 애초에 읽지 않는다 — 실측 확인. 즉
    종전 `errors: err.errors` 는 응답 직렬화 단계에서 이미 100% 버려지고 있었으므로, 이번에
    `details: toTriggerParameterErrorDetails(err.errors)` 로 바꿔도 **기존에 그 필드를 읽던
    소비자는 존재할 수 없다**(애초에 값이 안 나갔으므로). 순수한 버그 수정이며 회귀 위험 없음.
    (같은 결함이 이번 PR 전 세 라운드의 consistency 리뷰에서 CRITICAL 로 이미 다뤄졌고 이번 diff 가
    그 수정을 반영한 것 — 새로 발견한 것 아님.)

- **[INFO]** `reason`/`code` 판별 유니온에 4번째 값을 추가했으나, 유일한 소비처가
  `Record<..., ...>` 로 타입 강제되어 있어 미매핑 누락이 컴파일 타임에 잡힌다(부작용 없음, 확인용)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:11-18`
    (`reason` 유니온), `:26-34`(`code` 유니온), `:36-63`(`REASON_TO_DETAIL` — `masked_value_resubmitted`
    항목 추가)
  - 상세: `grep` 으로 저장소 전체를 확인한 결과 `reason`/`code` 위에서 이 3(→4)종 값을 놓고
    exhaustive `switch`/패턴매칭을 하는 다른 소비처는 없다(`toTriggerParameterErrorDetails` 의
    `Record<>` 매핑이 유일). 프런트에도 `MISSING_REQUIRED_FIELD` 등 필드 코드로 분기하는 코드가
    없다(grep 0건). 따라서 유니온 확장이 어딘가에서 "새 케이스를 default 로 조용히 흘려보내는"
    형태의 부작용을 일으키지 않는다.

- **[INFO]** `sanitize-error-message.ts` 의 `isMaskedMarker`/`MASKED_MARKERS` 가 module-private
  에서 `export` 로 승격됐다 — 공유 유틸의 공개 표면 확장(의도된 것, 충돌 없음 확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const MASKED_MARKERS`),
    `:156-164`(`export function isMaskedMarker`)
  - 상세: 새 소비처는 같은 프로세스 안의 `reject-masked-resubmission.ts` 한 곳뿐이고, 이 모듈은
    순수 함수만 담고 있어(상태 없는 정규식 배열 + `Set`) import 시점 부작용이 없다. `MASKED_MARKERS`
    는 타입상 `ReadonlySet<string>` 이지만 런타임 `Set` 은 caller 가 타입 단언으로 우회하면 변경
    가능한 공유 싱글턴이다 — 이 리스크는 이번 diff 가 만든 게 아니라(원래도 모듈 내부에서 공유되던
    객체) export 로 노출 범위만 넓어진 것이며, 현재 유일한 신규 소비처는 읽기만 한다. 조치 불요,
    기록용.

## 확인 후 이상 없음으로 판정한 항목

- `findMaskedResubmissions`/`hasMaskedLeaf`(`reject-masked-resubmission.ts`)는 순수 함수 — 인자
  객체를 변경하지 않고(`Object.entries`/`Object.values` 읽기 전용 순회), 전역 상태·파일시스템·
  환경변수·네트워크 호출이 전혀 없다. 재귀 깊이는 `MAX_REDACT_DEPTH`(10)로 상한이 걸려 스택 오버플로
  부작용도 없다(회귀 테스트로 5,000 depth 입력까지 확인됨).
- 두 호출부(`workflows.controller.ts`/`executions.service.ts`) 모두 새 `throw` 를 **자신을 감싸는
  바로 그 `try/catch` 안**에 넣어 동일 `catch (err) { if (err instanceof TriggerParameterValidationException) ... }`
  분기로 흡수된다 — 제어 흐름이 예상대로 동작하며, 이 신규 예외가 다른 catch 로 새거나 audit 로깅
  swallow 블록(같은 파일 뒷부분의 "실패는 swallow" 감사 로그)에 걸리는 경로는 없다(그 swallow 는
  검증 통과 후 `engine.execute` 호출 이후에만 적용됨을 확인).
  `resolveTriggerParameters` 의 나머지 3개 호출부(`hooks.service.ts`·`schedule-runner.service.ts`
  ×2)는 이번 diff 가 건드리지 않아 webhook/schedule 경로 동작은 변경되지 않았다(문서화된 의도된
  스코프와 일치, grep 으로 실측 확인).
- 새 함수·타입은 모두 기존 함수 시그니처를 변경하지 않고 추가만 한다 — `resolveTriggerParameters`
  시그니처 불변, `TriggerParameterValidationException` 생성자 불변. 기존 호출자에 영향 없음.
- 환경변수 읽기/쓰기, 네트워크 호출, 신규 전역 mutable 상태 도입 없음.

## 요약

핵심 로직(`findMaskedResubmissions`)은 순수 함수이고 두 호출부는 기존 예외 처리 흐름 안에 정확히
접합되어 있어 제어 흐름·전역 상태·파일시스템·네트워크 축에서는 부작용이 없다. 타입 유니온 확장은
`Record<>` 강제 매핑 덕에 미매핑 누락 위험이 컴파일 타임에 차단된다. 유일하게 주목할 부작용은
`POST /workflows/:id/execute` 가 "재제출 방지"라는 원래 의도를 넘어 **신규 입력**까지 거부 대상에
넣어 공개 엔드포인트의 기존 통과 입력 부분집합을 좁힌 것인데, 이는 이미 같은 세션의 다른 리뷰어가
독립적으로 지적했고 spec(§R17)이 의도된 트레이드오프로 명문화한 상태라 WARNING 으로만 재확인한다.
에러 응답의 `errors→details` 필드 변경은 겉보기엔 인터페이스 변경이지만 `GlobalExceptionFilter` 가
`errors` 를 애초에 읽지 않았음을 코드로 확인했으므로 실질적 회귀 위험은 없다.

## 위험도

LOW
