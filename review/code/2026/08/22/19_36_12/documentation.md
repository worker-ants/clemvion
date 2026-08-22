# 문서화(Documentation) 리뷰

## 검토 방법

프롬프트 컨텍스트 예산으로 전체가 실리지 않은 파일(`resolve-trigger-parameters.ts`,
`workflows.controller.ts`, plan 문서들)은 워크트리에서 `Read`로 직접 열어 대조했다. 신규
JSDoc·Swagger description·주석이 인용하는 spec 절(§R17)·CI 가드 파일·wrapper 함수명·
`validateTriggerParameterSchema` 실제 동작을 소스와 직접 grep/Read 로 교차검증했다.

## 발견사항

- **[INFO]** 신규 JSDoc·Swagger description 전부 실제 구현·spec과 정확히 일치 (긍정 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
    (`REASON_TO_DETAIL` 4종 JSDoc), `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123`
    (`resolveTriggerParameters` JSDoc), `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-26`
    (`inputOverride` Swagger description)
  - 상세: 직접 검증한 항목 — (1) `{@link resolveTriggerParametersRejectingMasked}` 대상 함수가
    `reject-masked-resubmission.ts:56`에 그 이름 그대로 export 됨. (2) 인용된 CI 가드 파일
    `repo-guards/__tests__/masked-reject-callers-guard.ts`·`masked-reject-callers.spec.ts` 실존.
    (3) `spec/5-system/14-external-interaction-api.md` §R17(:1576)이 `POST /workflows/:id/execute`
    의 파라미터"와 `POST /executions/:id/re-run` 의 `inputOverride`" 두 경로를 마커 재제출 거부
    대상으로 명시 — JSDoc·Swagger 의 §R17 인용이 정확. (4) `invalid_schema` JSDoc이 "입력이 아니라
    트리거 노드 설정을 고친다"고 설명한 부분은 실제로 `validateTriggerParameterSchema`(같은 파일
    :61-98)가 이름 정규식·중복·타입 enum 등 **스키마 구조**만 검사하는 것과 일치. 오래된 주장·지어낸
    참조 없음.
  - 제안: 없음 (정합 확인됨).

- **[INFO]** `resolve-trigger-parameters.ts` JSDoc의 "## 헤딩 + 한국어" 스타일은 이 저장소의
  기존 관례와 일치 — 언어 혼재 우려 해소 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108,115`
    (`## ⚠️ Manual 실행 경로는 이 함수를 직접 부르지 않는다`, `**그 검사를 여기(base)에 넣지 않은
    것은 의도다.**`)
  - 상세: 이전 라운드(`review/code/2026/08/22/19_25_39`)의 maintainability WARNING(영→한 블록 내
    언어 전환)이 반영되어 현재 파일은 이 블록 전체가 한국어로 통일돼 있음을 직접 `Read`로 확인했다
    (한글 없는 서술 줄 0건 — `{@link}` 태그·spec 경로 2줄만 예외, RESOLUTION.md 의 주장과 일치).
    추가로, JSDoc 안에 마크다운 `##` 헤딩 + 한국어 산문을 쓰는 패턴 자체는 이 파일만의 스타일이
    아니라 `strip-external-only-fields.ts:23`(`## ⚠️ 이 함수만 부르는 것은 절반이다`),
    `terminal-error-payload.ts:50`, `redact-stored-error.ts:43` 등 같은 `shared/utils/` 트리
    여러 곳에서 이미 쓰이는 정착된 관례다.
  - 제안: 없음 (정합 확인됨, 참고 기록).

- **[INFO]** `POST /workflows/:id/execute` 의 OpenAPI 문서에는 여전히 마스킹 마커 예약어
  제약이 반영되지 않음 — 단, 이번 diff가 그 사실을 자체적으로 발견·추적함
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279`(`execute()`
    의 `@Body() body?: { input?; parameterValues?; }` — DTO·`@ApiProperty` 없는 인라인 타입),
    `:245-248`(`@ApiOperation`, 마커 제약 언급 없음)
  - 상세: `execute()` 도 `re-run` 과 동일하게 `resolveTriggerParametersRejectingMasked` 를 거쳐
    `parameterValues` leaf 가 마커와 정확히 일치하면 거부한다(`:317`, `spec/5-system/14-external-interaction-api.md:1576`
    이 두 경로 모두를 명시). 그런데 `re-run.dto.ts` 만 이번 diff로 상세화되어 형제 엔드포인트 간
    비대칭이 이전보다 더 두드러졌다 — OpenAPI 스펙만 보고 통합하는 클라이언트는 `re-run` 에서는
    경고를 받지만 `execute` 에서는 아무 단서 없이 400 `MASKED_VALUE_RESUBMITTED` 를 만난다. 다만
    이 gap 은 이번 세션의 이전 리뷰(`19_25_39` documentation WARNING #1)가 이미 지적했고,
    `RESOLUTION.md`(W2)가 "DTO 승격은 코스메틱이 아니라 컨트롤러 시그니처 변경"이라는 근거로
    반영을 보류한 뒤 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(:825-832)에
    **지금 고치지 않는 이유**와 **고칠 때 이식할 내용**(=`re-run.dto.ts` 의 description)까지
    명시해 신규 항목으로 등재했다. 은폐된 스코프 축소가 아니라 근거가 남은 의도적 유예다.
  - 제안: 이번 PR 조치 불요. `execute()` body 를 DTO로 승격하거나 `@ApiBody` 를 붙이는 기회에
    `re-run.dto.ts:20-24` 의 description 을 그대로 이식 — 이미 트래커에 그렇게 기록돼 있으므로
    별도 액션 불요.

- **[INFO]** `workflows.controller.ts` 의 한/영 주석 혼재는 `execute()` 메서드 전체가 아니라
  하나의 try/catch 블록으로만 좁게 해소됨 — plan 이 스스로 인지·기록한 의도된 스코프
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:320-322`(이번에
    한국어로 통일된 블록), `:294`(`// Verify workflow belongs to workspace`), `:297-299`
    (`// Resolve trigger parameters against …`), `:332-335`(`// Stamp the trigger-source
    marker …`) — 세 곳 모두 영문 그대로 잔존
  - 상세: 직접 `Read`로 확인 — `:320-322` 는 한국어("`errors` 가 아니라 `details` 다 …")로
    바뀌었고 원문이 담고 있던 "`GlobalExceptionFilter` 는 `details` 만 읽는다"는 대조 정보는
    보존됐다. 그러나 같은 `execute()` 메서드 안 다른 세 곳의 인라인 주석은 영문으로 남아 있다.
    plan(`masked-marker-cosmetic-followups.md`)이 스코프를 "같은 try/catch 블록"으로 명시적으로
    좁혔고 그 좁은 주장("해당 블록의 한글 없는 주석 줄 0건")은 실측대로 참이다 — 결함이 아니라
    문서화된 범위 경계.
  - 제안: 조치 불요. 다음에 이 메서드를 만질 기회에 나머지 영문 주석도 통일 권장 — 이미 이번
    리뷰(`19_25_39` maintainability INFO)와 plan에 기록되어 있어 중복 등재 불요.

## 요약

이번 PR은 4개 backend 코드 파일에서 실행 로직 0줄 변경으로 JSDoc·Swagger description·인라인
주석만 확장/교정하는 순수 문서화 변경이다. 새로 추가된 모든 문서 서술(마커 3종 예약어·거부
코드·부분 일치 통과·wrapper/base 책임 분리·CI 가드 경로·§R17 인용·`REASON_TO_DETAIL` 4종의
"사용자가 취할 행동" 구분)을 실제 소스(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`,
`validateTriggerParameterSchema`)와 spec 본문(`14-external-interaction-api.md` §R17)에 직접
대조한 결과 전부 정확했고, 지어낸 참조나 오래된 주장은 없었다. 이전 리뷰 라운드가 지적한
JSDoc 블록 내 언어 혼재(WARNING)는 이 저장소에 이미 정착된 "## 헤딩 + 한국어" 관례를 따라 전체
한국어로 통일돼 해소를 직접 확인했다. 유일하게 남은 실질적 gap — `POST /workflows/:id/execute`
가 `re-run` 과 동일한 마커 거부 규칙 대상인데 OpenAPI 문서에는 그 제약이 없는 형제 엔드포인트
비대칭 — 은 여전히 사실이지만, DTO 승격(컨트롤러 시그니처 변경이라 코스메틱 스코프 밖)이 필요한
사안이라는 근거와 함께 이번 diff가 자체적으로 발견해 트래커에 상세히 등재했으므로 신규 blocking
발견이 아니라 확인·기록으로 처리한다. README·CHANGELOG·환경변수 문서화 요구사항은 이번 diff와
무관(신규 기능·설정·엔드포인트 추가 없음).

## 위험도
NONE
