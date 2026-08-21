# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (`02_29_01`)

## 검토 범위

이 브랜치는 이미 5라운드(`00_03_57` → `00_39_27` → `01_15_47` → `01_38_26` → `02_04_38`) 유지보수성
리뷰를 거쳤다. 각 라운드가 지적한 항목 — (1) 두 호출부의 `find+length체크+throw` 복붙, (2) 신규
`isPlainRecord` 가 기존 `isRecord`(`to-record.ts`) 를 이름만 바꿔 재구현, (3) `Object.freeze(new
Set(...))` 가 `.add()` 를 막지 못하는 플라시보(RESOLUTION 문서가 존재하지 않는 런타임 보장을
서술), (4) repo-guard 정규식이 JSDoc 예시 안의 import 문을 실제 import 로 오판해 허용목록에
자기참조를 얹어 은폐, (5) repo-guard 의 탐지 능력 자체가 무보증(제외 필터를 무력화해도 3개
테스트 전부 GREEN) — 전부 다음 실제 소스를 직접 `Read` 로 열어 재확인했고, 모두 해소돼 있음을
확인했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` — `isRecord`
  (`to-record.ts`) 를 import(11행)해서 쓰고, `resolveTriggerParametersRejectingMasked` 하나가
  raw→resolve 검사 순서를 캡슐화해 두 호출부가 각각 함수 호출 한 줄만 남았다.
- `codebase/backend/src/shared/utils/sanitize-error-message.ts:150-166` — `MASKED_MARKERS` 가
  `readonly string[]` + `Object.freeze([...])` 로 교체됐고(`isMaskedMarker` 는 `.includes()`),
  `sanitize-error-message.spec.ts` 에 "MASKED_MARKERS 불변성" 캐너리(`push` 가 `TypeError`,
  주입값이 마커로 판정되지 않음)가 그 보장을 기계에 고정한다.
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` — `importsBaseFn` 이
  `stripCommentsAndStrings` 로 주석·문자열을 먼저 걷어낸 뒤 import 블록만 매칭하고, 그 결과
  가드 자신·형제 spec 은 허용목록에서 자연히 빠져 있다(주석에 그 경위가 남아 있음).
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` — 위반 파일을 임시
  디렉터리에 실제로 만들어 가드가 정확히 지목하는지, 대조군(wrapper 만 쓰는 파일)은 잡히지
  않는지 확인하는 캐너리 2개가 추가돼 "탐지 능력 무보증" 문제가 해소돼 있다.

실질 프로덕션/테스트 신규 표면(`trigger-parameter.types.ts`, `reject-masked-resubmission.ts`
+ `.spec.ts`, `executions.service.ts`, `workflows.controller.ts` + `.spec.ts`,
`executions-rerun.service.spec.ts`, repo-guard 2파일, `sanitize-error-message.ts` + `.spec.ts`)
를 이번 라운드에서도 프롬프트가 아니라 소스를 직접 열어 재검증했다. `CHANGELOG.md`·`plan/**`·
`review/code/**`·`review/consistency/**`·`spec/**` 는 이전 라운드가 이미 검토·처분한 산출물이
그대로 커밋에 실린 것이거나 문서 변경이라 코드 유지보수성 재검토 대상에서 제외했다.

## 발견사항

새로 찾은 CRITICAL/WARNING 없음. 기존에 등재됐고 계속 이월되는 INFO 2건만 실코드로 재확인한다.

- **[INFO]** `workflows.controller.ts` 의 신규 한국어 인라인 주석과 인접한 기존 영어 인라인
  주석이 같은 `try/catch` 블록 안에 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 한국어 주석
    (`314`~`316`행, "마스킹된 값이 그대로 재제출됐는가 …") 바로 아래 기존 영어 주석(`320`~
    `322`행, `` // `details` so GlobalExceptionFilter surfaces the per-field breakdown ``)
  - 상세: 이 diff 가 새로 만든 문제는 아니고(영어 줄은 미변경 컨텍스트 라인), `00_03_57`·
    `01_38_26`·`02_04_38` documentation/maintainability 라운드가 이미 INFO 로 등재하고 "조치
    불요·이월"로 처분한 항목과 동일하다. 최근 커밋 메시지·본 diff 의 다른 신규 주석은 전부
    한국어로 수렴하는 추세라, 이 파일만 언어가 섞여 다음에 이 블록을 여는 사람이 어느 언어로
    이어써야 할지 헷갈릴 수 있다는 점은 유효하다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님. 다음에 이 블록을 편집할 기회가 있으면 함께
    한국어로 통일 검토.

- **[INFO]** `ExecutionsService.reRun` 이 여전히 137줄(§420-556)로 길고 6가지 책임(404/권한
  체크·dry-run pre-flight·chain depth 체크·입력 해석·실행 트리거·audit log)을 한 메서드가
  순차 수행한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (`420`행 시작 ~ `556`행 종료), 신규 마스킹 검사 블록은 `495`~`516`행
  - 상세: 이 구조는 이 PR 이전부터 있었고, 이번 변경이 그 안에 얹은 것은 4줄짜리 함수 호출
    (`resolveTriggerParametersRejectingMasked`) 하나뿐이라 신규 복잡도 증가는 미미하다.
    `00_03_57`·`01_15_47` 라운드가 같은 항목을 이미 등재·이월했다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님. 다음에 `reRun` 을 손댈 일이 생기면 입력 해석
    블록을 `resolveRerunInput(...)` 류 private 헬퍼로 추출하는 것을 고려.

## 그 외 확인 사항 (발견 아님)

- `reject-masked-resubmission.ts`: `resolveTriggerParametersRejectingMasked`·`findMaskedResubmissions`·
  `hasMaskedLeaf`·`throwIfAny` 모두 짧고 단일 책임, 중첩은 최대 2단(`Array.isArray`/`object`
  분기), 매직 넘버 없이 `MAX_REDACT_DEPTH` 상수를 재사용한다. 각 함수 상단 JSDoc 이 "왜 이
  순서인가"·"왜 여기서 검사하는가" 를 구체적 반증 사례(타입별 우회 표)로 근거를 남겨 다음
  사람이 순서를 되돌리는 실수를 하기 어렵게 만든다.
- `trigger-parameter.types.ts`: 신규 `masked_value_resubmitted` reason / `MASKED_VALUE_RESUBMITTED`
  code 추가가 기존 3항목과 동일한 네이밍 컨벤션(`snake_case` ↔ `UPPER_SNAKE_CASE`)·구조를
  그대로 따른다. `coerce_failed` 를 재사용하지 않기로 한 결정에 doc comment 로 근거를 남겼다.
- `reject-masked-resubmission.spec.ts`: 경계(깊이 상한/상한+1)·정상 통과(부분 포함)·타입별
  우회·JSON 문자열 경로·왕복 통합(실제 마스커 산출물)·phase 분리·스택 안전성까지 캐너리
  태그로 의도를 명시해 조직했다. 새 헬퍼(`nestObj`/`nestArr`/`rejectedFields`)는 이름이
  목적을 정확히 드러낸다.
- `masked-reject-callers-guard.ts`/`.spec.ts`: 파서(순수 로직)와 소비 spec 을 분리하는 이
  저장소의 기존 repo-guard 규약(`eslint-unicorn-peer-guard.ts` 등)을 그대로 따른다.
  `listSourceFiles` 의 디렉터리 재귀 walker 가 다른 repo-guard 들과 유사 보일러플레이트를
  반복하지만 이 저장소가 기존에도 가드마다 독립적으로 허용해 온 패턴이라 이번 diff 의
  새로운 이탈이 아니다.
- `executions.service.ts`/`workflows.controller.ts`: `resolveTriggerParameters` →
  `resolveTriggerParametersRejectingMasked` 치환이 시그니처를 그대로 유지한 drop-in
  교체이고, 두 호출부의 `catch` 블록은 응답 포맷(`INVALID_INPUT` vs
  `INVALID_TRIGGER_PARAMETERS`)만 다르게 유지한 채 `details: toTriggerParameterErrorDetails(err.errors)`
  로 통일돼 있어 자매 호출부 간 봉투 드리프트가 해소됐다.

## 요약

5라운드에 걸친 반복 리뷰-수정 사이클을 거쳐 CRITICAL(boolean 완전 우회)·다건의 WARNING(호출부
중복·타입가드 재구현·불변식 플라시보·가드 자기 오탐·가드 탐지 무보증)이 실제로 해소된 상태이고,
이번 라운드에서 핵심 프로덕션/테스트 8개 파일 전부를 직접 열어 재확인해도 그 결론은 유지된다.
함수 길이·네이밍·중첩 깊이·순환 복잡도·매직 넘버·기존 코드베이스 스타일(문서화 밀도·에러
코드 매핑 패턴·repo-guard 규약) 정합성 전부 양호하다. 새로 찾은 항목은 없고, 기존에 여러 라운드가
"조치 불요·이월"로 이미 처분한 INFO 2건(주석 언어 혼재·`reRun` 길이)만 그대로 유효하다.

## 위험도

LOW
