# 문서화(Documentation) 리뷰 — EIA §R17 마커 재제출 서버측 거부

## 검토 범위

실제 코드/설정 변경(파일 1~16): `CHANGELOG.md`, `trigger-parameter.types.ts`,
`reject-masked-resubmission.ts`(신규)/`.spec.ts`(신규), `resolve-trigger-parameters.spec.ts`,
`executions-rerun.service.spec.ts`, `executions.service.ts`, `workflows.controller.spec.ts`,
`workflows.controller.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`(신규),
`production-build-devdep-guard.ts`/`.spec.ts`(신규), `sanitize-error-message.ts`/`.spec.ts`,
`tsconfig.build.json`. plan 문서(파일 17~19)와 spec 7곳(파일 187~193)도 실제 파일을 직접
`Read`/`grep` 해 대조했다. 파일 20~186(`review/**` 하위 이전 라운드 산출물)은 이미 확정된
감사 기록이라 개별 재평가 대상에서 제외했다(내용은 위 실코드·spec 대조 결과와 모순되지 않음을
확인).

## 발견사항

발견된 CRITICAL 없음.

- **[INFO]** base 함수 `resolveTriggerParameters` 의 JSDoc 에 wrapper 로의 역참조가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-109`
    (함수 선언부 docstring, 이번 diff 에는 포함되지 않은 기존 파일)
  - 상세: 이번 PR 이 만든 `resolveTriggerParametersRejectingMasked`(wrapper, `reject-masked-resubmission.ts`)
    의 docstring 은 "Manual 실행 경로는 이 wrapper 를, webhook·schedule 은 base 를 직접 쓴다" 는
    분업을 매우 상세히 설명한다. 그런데 그 설명은 **wrapper 쪽에만** 있다. 새 Manual 실행
    경로를 작성하는 개발자가 (자연스러운 이름의) base 함수 `resolveTriggerParameters` 를 먼저
    찾아 그 docstring 만 읽으면, wrapper 의 존재도 "Manual 경로는 base 를 직접 쓰면 안 된다" 는
    규칙도 알 길이 없다. 실제로는 신규 repo-guard(`masked-reject-callers-guard.ts` +
    `masked-reject-callers.spec.ts`)가 CI 시점에 위반을 잡아 기능적 위험은 낮지만, 그건 **작성
    시점의 안내가 아니라 사후 발견**이다. 이 PR 자체가 "주석은 규칙을 강제하지 못한다" 는
    교훈을 여러 곳(가드 헤더 주석, CHANGELOG)에 명시적으로 남겼는데, 정작 base 함수 쪽에는
    최소한의 안내성 JSDoc 한 줄도 없다.
  - 제안: `resolve-trigger-parameters.ts` 의 `resolveTriggerParameters` docstring에 `{@link
    resolveTriggerParametersRejectingMasked}` 참조 한 줄만 추가 — "Manual 실행 경로는 이 함수
    대신 wrapper 를 쓴다" 는 안내. 강제는 이미 가드가 하므로 이건 순수 문서 보강.

- **[INFO]** 신규 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 주석
    (`resolveTriggerParametersRejectingMasked` 호출 직전 3줄)과 바로 아래 기존 주석
    (``// `details` so GlobalExceptionFilter surfaces the per-field breakdown``)
  - 상세: 이번 diff 가 만든 문제는 아니고(해당 영어 줄은 컨텍스트 라인, 미변경) 마이너하다.
    다만 문서화 관점에서도 언급할 가치가 있다 — 최근 커밋들(직전 5개 커밋 메시지 포함)이
    서술형 근거 주석을 한국어로 쓰는 쪽으로 수렴하는 추세라, 이 파일만 두 언어가 섞여 다음에
    이 블록을 여는 사람이 어느 언어로 이어써야 할지 애매해질 수 있다. maintainability 리뷰가
    같은 지점을 다른 관점(코드 일관성)에서 이미 지적했다 — 여기서는 문서화 관점에서 동일
    관찰을 보강하는 것으로, 별도 조치 항목은 아니다.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

## 문서화 품질 — 확인된 강점

- **docstring 밀도·근거**: `reject-masked-resubmission.ts` 는 "왜 필요한가 / 범위 / 왜 resolve
  를 감싸는가(검사 시점) / 경계 두 가지" 를 함수 단위로 구조화한 JSDoc 으로 남겼고, 각 결정에
  반증된 대안(초판이 뚫린 세 갈래 표)까지 표로 고정했다. `masked-reject-callers-guard.ts` /
  `production-build-devdep-guard.ts` 도 "정규식→AST 전환" 근거를 무수정 프로브 실측 표로 남겨
  다음 사람이 같은 패턴(정규식으로 되돌리기)을 반복하지 않도록 안내한다.
- **오래된 주석 없음**: `trigger-parameter.types.ts`(4종 reason/code 매핑), `sanitize-error-message.ts`
  (`MASKED_MARKERS` export 이력), `tsconfig.build.json`(exclude 사유) 모두 diff 시점 코드와
  주석 내용이 일치한다. `resolveTriggerParametersRejectingMasked` 의 "raw 우선" 주석과
  실제 구현 순서(① raw → throwIfAny → ② resolve → throwIfAny)가 정확히 대응한다.
  `REASON_TO_DETAIL` 의 내부 문서 예시(`missing_required`/`coerce_failed`)는 신규 4번째
  항목을 배제하지 않는 "예시" 로 쓰였을 뿐이라 stale 하지 않다.
- **spec 동반 갱신 — 7곳 전부 확인**: `plan/complete/spec-draft-inputoverride-marker-reject.md`
  가 예고한 7개 spec 편집 지점(§R17 표, error-handling §1.7·§1.3, replay-rerun §8.1·§10.2,
  manual-trigger §6, data-model, execution.md, webhook §5.2)이 실제 diff 에 전부 반영돼 있고,
  검사 시점 서술("전후 2단계")·범위 서술("Manual 실행 경로 전체, 저작 주체 기준")이 스펙
  7곳·docstring·CHANGELOG·테스트 주석 사이에서 표현만 다를 뿐 의미가 어긋나는 곳이 없다.
  `spec-update-masked-reject-framing.md` 는 초판 spec 서술의 stale 지점(검사 시점 "직후" →
  "전후", "재제출 한정" → "Manual 실행 경로 전체")을 발견 경위·근거와 함께 정정했고, 자신이
  경고한 "자매 발산" 패턴을 스스로 두 번 겪었다가 세 번째 자매(`1-data-model.md`)를 마저
  찾아 4곳 전부를 닫았다.
- **회귀 테스트 ↔ 문서 서술 일치**: `executions-rerun.service.spec.ts` 의
  `[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다` 테스트 docstring 이 CHANGELOG·
  `executions.service.ts` 인라인 주석·`spec-draft-inputoverride-marker-reject.md` 의 "선존
  버그" 서술과 표현·근거 모두 일치한다.
- **CHANGELOG**: 이 저장소의 기존 관행(다중 `## Unreleased` 섹션, 각 PR 하나씩)을 그대로
  따르고, 범위·검사 시점·부산물(repo-guard 2건)까지 코드 변경과 대조해 사실과 어긋나는
  서술이 없다.
- **README/설정 문서**: `codebase/backend/README.md` 에 trigger-parameter·repo-guards 관련
  언급이 원래 없어 갱신 누락이 아니다. 신규 설정은 `tsconfig.build.json` 의 exclude 항목
  하나뿐이고 인라인 주석으로 충분히 근거가 남아 있다(JSONC 주석은 `ts.readConfigFile` 이
  파싱하므로 형식상 문제 없음, 가드 자신도 같은 API 로 읽는다).

## 요약

핵심 신규 로직(`reject-masked-resubmission.ts`)과 부산물 repo-guard 2건, spec 7곳·CHANGELOG·
plan 문서 사이의 문서화 정합성이 이례적으로 높다 — 이미 9~10 라운드의 자체 리뷰를 거치며
docstring·spec 서술·주석이 실제 구현(검사 시점 2단계, 범위 판정 기준, 에러 봉투 배선)과
반복적으로 대조·정정된 흔적이 코드 곳곳의 doc comment 에 근거와 함께 남아 있다. 새로 찾은
문제는 사실상 없다 — 유일한 지적은 base 함수(`resolveTriggerParameters`, 이번 diff 밖의 기존
파일) docstring에 신규 wrapper 로의 역참조가 없다는 점으로, repo-guard 가 기능적으로는 이미
막고 있어 위험도는 낮고 순수 가독성 보강 수준이다. README·API 문서·CHANGELOG 갱신 필요성은
모두 충족됐고, 오래된(stale) 주석이나 코드와 어긋나는 spec 서술은 발견되지 않았다.

## 위험도

LOW
