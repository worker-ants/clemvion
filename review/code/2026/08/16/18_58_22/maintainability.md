# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 직전 라운드(`18_33_52`)에서 "리뷰 라운드 이력이 영구 소스 주석에 박제"됐다며 **W2 로 지적·수정 완료를 선언**했으나(`e88ac4bdf` 커밋 메시지: "라운드 ID·자기정정 서사를 걷어내고 설계 근거와 보장의 경계만 남겼다"), 실제로는 `redact-stored-error.ts` 한 파일에만 적용됐고 자매 파일들에는 **똑같은 패턴이 그대로 남아 있다**. 커밋 메시지가 예시로 직접 인용한 문장(`"종전 이 문장은 … 틀렸다(18_14_50 documentation W1)"`)조차 소스에 원문 그대로 남아 있어, "고쳤다"는 서술과 실제 diff 범위(`git show --stat e88ac4bdf` 확인 결과 `executions.service.ts` 는 그 커밋에 포함되지 않음)가 어긋난다.
  - 위치:
    - `codebase/backend/src/modules/executions/executions.service.ts:89` — `(`17_35_49` maintainability W1 — 실제로 그렇게 됐다)`
    - `codebase/backend/src/modules/executions/executions.service.ts:629` — `(`16_32_42` cross_spec CRITICAL)`
    - `codebase/backend/src/modules/executions/executions.service.ts:637` — `(`17_12_34` performance W1)`
    - `codebase/backend/src/modules/executions/executions.service.ts:797` — `(`17_35_49` documentation W2)`
    - `codebase/backend/src/modules/executions/executions.service.ts:805-806` — `종전 이 문장은 *"반환 지점이 넷"* 이라고 썼는데 **틀렸다**(`18_14_50` documentation W1)` (커밋 메시지가 그대로 인용한 그 문장)
    - `codebase/backend/src/modules/executions/executions.service.ts:811` — `(`17_12_34` side_effect W1)`
    - `codebase/backend/src/modules/executions/executions.service.ts:991` — `(`17_12_34` maintainability W1)`
    - `codebase/backend/src/modules/executions/executions.service.spec.ts:998` — `(`--spec`(`16_32_42`))`
    - `codebase/backend/src/modules/executions/executions.service.spec.ts:1053` — `(`17_35_49` testing W1)`
    - `codebase/backend/src/modules/executions/executions.service.spec.ts:1057` — `(`17_12_34` performance W1)`
    - `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:52` — `(`17_12_34` testing W1)`
    - `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:218` — `(`18_14_50` testing INFO)`
  - 상세: 라운드 ID(`17_12_34`, `17_35_49`, `18_14_50`, `16_32_42` 등)는 이 저장소 세션의 임시 리뷰 산출물 디렉토리명이다. 새로 이 파일을 여는 다음 사람에게는 맥락 없는 타임스탬프일 뿐이며, 그 라운드 산출물(`review/code/2026/08/16/*/`)이 나중에 정리·삭제되면 참조 대상 자체가 사라진다. 지적 자체는 이미 팀이 스스로 "옳다"고 인정하고 한 번 고친 적이 있는 항목이라(`redact-stored-error.ts` 는 실제로 클린하다 — grep 결과 round-ID 0건), 이번에 적용이 누락된 파일들만 남은 상태다. `stop()` 메서드(`executions.service.ts:791-823`)는 함수 본문이 3줄(`821-823`)인데 JSDoc 이 30줄(`791-820`)로, 커밋 메시지가 지적한 "함수 본문 3줄에 JSDoc 30줄" 그 사례와 정확히 일치하는데도 정작 손대지 않은 파일에 남아 있다.
  - 제안: `executions.service.ts`/`executions.service.spec.ts`/`redact-stored-error.spec.ts`/`background-runs.service.spec.ts` 4개 파일에서 라운드 ID·"종전 이 문장은 틀렸다" 류 자기정정 서사를 제거하고, 설계 근거·불변식·보장의 경계만 남긴다. 서사는 이미 커밋 메시지·CHANGELOG·`plan/in-progress/eia-internal-rest-error-masking.md` 가 담고 있으므로 소스에서는 제거해도 정보 손실이 없다. 특히 `stop()` JSDoc 은 "반환 계약이 바뀌었다" 절과 "동시성 계약" 절을 남기고 라운드 서사(제일 위 인용문 두 단락)를 걷어내면 분량이 크게 줄어든다.

## 일반 평가 메모 (참고용, 조치 불요)

- **네이밍**: `ResponseExecution`/`ResponseNodeExecution`/`redactStoredErrorForResponse`/`toResponseExecution` 는 의도가 명확하고 서로 일관된 접두/접미 규칙(`Response*`)을 따른다. `ExecutionError`(제어흐름 예외 클래스, `workflow-errors.ts`)와의 이름 충돌을 의도적으로 피한 근거가 JSDoc 에 남아 있어 좋다.
- **함수 책임 분리**: `stop()`(마스킹 관문) / `stopInternal()`(TOCTOU 원자 UPDATE 로직) 분리, `toResponseExecution()`(관계 제거 + 마스킹 단일 관문) / `toExecutionDto()`(DTO 조립 전용 별도 경로) 구분은 "자매 표면 중 하나만 마스킹" 재발을 구조적으로 막는 합리적 설계다.
- **중복 코드**: `buildSingleQB` 테스트 헬퍼 중복은 이전 라운드에서 최상위 `describe` 로 hoist 되어 해소됐음을 확인했다(`executions.service.spec.ts:92`, 호출부 다수가 동일 헬퍼 재사용).
- **매직 넘버**: 이번 diff 가 새로 도입한 매직 넘버는 없다(`NODE_EXECUTIONS_MAX_LIMIT=200`, `MAX_EXECUTION_PATH_ROWS=10_000` 등은 기존 상수 재사용).
- **`.claude/docs/plan-lifecycle.md` §`pending_plans` 신규 절**: 표·재현 방법·실패 형태를 명시해 향후 재계산 시 같은 논쟁이 반복되지 않도록 문서화한 점이 좋다. 가독성·구조 문제 없음.

## 요약

핵심 로직(`redactStoredErrorForResponse` 단일 관문 수렴, `stop`/`stopInternal` 분리, `toResponseExecution`/`toExecutionDto` 역할 구분)의 구조적 품질은 5라운드에 걸친 리뷰로 이미 높은 수준이다. 다만 직전 라운드가 "리뷰 라운드 이력을 소스 주석에서 걷어냈다"고 명시적으로 선언한 조치가 `redact-stored-error.ts` 한 파일에만 적용되고 나머지 4개 자매 파일(`executions.service.ts`·`executions.service.spec.ts`·`redact-stored-error.spec.ts`·`background-runs.service.spec.ts`)에는 반영되지 않았다 — 이 저장소가 반복적으로 겪어 온 "자매 표면 중 하나만 고친다" 패턴이 이번에는 코드 품질 관리 그 자체에서 재발한 형태다. `stop()` JSDoc(3줄 본문·30줄 문서)이 그 대표 사례로 남아 있다.

## 위험도

MEDIUM
