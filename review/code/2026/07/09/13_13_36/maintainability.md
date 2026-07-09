# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `driveResumeFrame` 신규 주석이 잘못된 함수를 참조 — 향후 탐색을 오도할 소지
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2418`
  - 상세: `// Durable trigger input on re-entry (see runNodeDispatchLoop caller in resumeGraphAfterRetry) — keeps Manual Trigger output.parameters intact.` 가 `resumeGraphAfterRetry`(별도 파일 `retry-turn.service.ts`)를 "같은 로직을 쓰는 참조처"로 가리킨다. 그러나 `resumeGraphAfterRetry` 는 바로 옆 파일(`retry-turn.service.ts:564-573`)에서 **정반대로** `input: {}` 를 그대로 유지하며 "AI multi-turn retry 는 의도적으로 durable input 을 쓰지 않는다"고 명시한다. 실제로 "durable input 재사용" 의 상세 근거를 담은 원본 주석은 같은 파일의 `driveResumeAwaited`(~line 2069)다. 이 참조 오류는 향후 이 로직을 수정하려는 개발자를 정반대 동작을 하는 코드로 안내할 위험이 있다.
  - 제안: `resumeGraphAfterRetry` → `driveResumeAwaited` 로 참조 대상을 정정.

- **[WARNING]** 동일 파일 내 신규 주석 2건이 기존 한국어 주석 컨벤션에서 벗어나 영어로 작성됨 (직전 리뷰 라운드 WARNING 미해소)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2418`(`driveResumeFrame`), `:3199-3202`(`driveStuckRedrive`)
  - 상세: 같은 diff 의 `driveResumeAwaited` 지점(~line 2069-2076)은 이 파일의 지배적 컨벤션대로 한국어로 근거를 상세히 설명하는 반면, 구조적으로 동일한 나머지 두 지점만 영어로 작성돼 파일 내 언어가 갈린다. `review/code/2026/07/09/11_08_21/maintainability.md` 가 이미 이 항목을 WARNING 으로 지적했고, `RESOLUTION.md` 조치표(W1-W11)에는 이 항목에 대응하는 명시적 처분이 보이지 않아 이번 라운드에도 그대로 남아 있다.
  - 제안: 두 지점을 한국어로 통일하거나, 아래 중복 항목과 함께 공통 헬퍼로 추출해 설명을 한 곳에만 남긴다.

- **[WARNING]** "재진입 시 durable trigger input 재사용" 로직이 3개 호출부에 매번 새 산문으로 반복되고, 4번째 구조적 동일 호출부는 반대 결론의 독립 주석을 닮 — 규칙의 단일 진실 지점 부재 (직전 라운드 WARNING 미해소)
  - 위치: `execution-engine.service.ts:2068-2076`(`driveResumeAwaited`, 한국어 8줄) / `:2417-2418`(`driveResumeFrame`, 영어 2줄) / `:3199-3203`(`driveStuckRedrive`, 영어 4줄), `retry-turn.service.ts:565-573`(`resumeGraphAfterRetry`, 한국어 8줄·반대 결론)
  - 상세: 세 지점 모두 `input: savedExecution.inputData ?? {}` 라는 동일한 표현식을 쓰지만 그 근거는 코드로 공유되지 않고 매번 별도 주석으로 재서술된다. `retry-turn.service.ts` 쪽은 상호 교차 참조 주석을 달아 "의도적 예외"임을 밝히긴 했으나, 규칙 자체("미완료 entry 노드는 durable input, 완료 노드는 skip")는 여전히 4곳의 자연어 설명에 분산돼 있다. 향후 이 파생 규칙이 바뀌면(예: `parameterValues` 오버라이드 병합) 4곳을 모두 일관되게 고쳐야 하고, 그중 하나라도 놓치면 조용히 drift 한다.
  - 제안: `private resolveReentryTriggerInput(savedExecution: Execution): Record<string, unknown>` 같은 이름의 작은 helper 로 추출해 규칙을 한 곳에 문서화하고, 4개 호출부(3+1)는 `input: this.resolveReentryTriggerInput(savedExecution)` + 1줄 참조 주석만 남긴다. `retry-turn.service.ts` 의 의도적 예외는 helper 를 쓰지 않는 이유를 짧게 교차 참조하면 충분하다.

- **[WARNING]** `saveCanvas(..., true)` 호출부가 이름 없는 boolean literal("boolean trap")을 그대로 노출
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:472` (`restoreVersion` → `return this.saveCanvas(workflowId, workspaceId, userId, dto, true);`)
  - 상세: `saveCanvas` 의 5번째 파라미터 `skipParamSchemaValidation` 정의부에는 그 의미를 설명하는 주석이 있지만(`workflows.service.ts:479-482`), 실제 호출부(`:472`)에는 `true` 만 덩그러니 남아 있어 이 한 줄만 보고는 "무엇을 skip 하는지" 전혀 알 수 없다. 리더가 `saveCanvas` 시그니처까지 거슬러 올라가야 의미를 알 수 있는 전형적인 boolean-trap 이며, 향후 6번째 파라미터가 추가되면 이런 위치 인자 호출은 더 읽기 어려워진다.
  - 제안: `this.saveCanvas(workflowId, workspaceId, userId, dto, /* skipParamSchemaValidation */ true)` 처럼 인라인 주석을 붙이거나, 옵션 객체(`{ skipParamSchemaValidation: true }`)로 바꿔 호출부 자체가 자기 설명적이 되게 한다.

- **[INFO]** 파라미터 이름 식별자 정규식이 프론트/백엔드에 여전히 이중 정의 (직전 라운드에서 이미 백로그로 처분됨, 재확인만)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:15` (`PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77` (`/^[A-Za-z_][A-Za-z0-9_]*$/`)
  - 상세: 프론트 코드 주석이 "Mirror of the backend identifier rule" 이라고 스스로 명시할 만큼 저자도 중복을 인지한 상태다. `RESOLUTION.md` 가 이미 이를 "후속(백로그): 식별자 정규식 공유 패키지 추출, 저위험 drift" 로 명시적으로 이월했으므로 이번 라운드에서 새로 조치할 필요는 없다. 참고로만 재확인.
  - 제안: 조치 불요(이미 백로그 추적 중). 공유 패키지 추출 시 `packages/` 하위로 이동 권장.

- **[INFO]** `MANUAL_TRIGGER_TYPE`(로컬 문자열 상수) vs `NODE_TYPES.MANUAL_TRIGGER`(공유 상수) 이중 정의 — 이번 PR 이 만든 문제는 아니나 같은 도메인을 손대면서 통합 기회를 놓침
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:31` (`const MANUAL_TRIGGER_TYPE = 'manual_trigger';`, 이번 diff 이전부터 존재) vs `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts`(이번 diff 가 `NodeCategory.TRIGGER` → `NODE_TYPES.MANUAL_TRIGGER` 로 교체)
  - 상세: 이번 PR 의 핵심 수정 중 하나가 정확히 "트리거 노드를 어떤 리터럴/상수로 식별하느냐" 인데, 그 과정에서 `workflows.service.ts` 가 이미 갖고 있던 별도의 로컬 리터럴(`MANUAL_TRIGGER_TYPE = 'manual_trigger'`)은 그대로 두고 `load-trigger-parameter-schema.ts` 만 공유 상수(`NODE_TYPES.MANUAL_TRIGGER`)로 옮겼다. 두 값은 현재 동일 문자열이라 기능상 문제는 없지만, "manual_trigger 리터럴의 단일 진실 지점" 이라는 이번 PR 의 취지를 `workflows.service.ts` 자신은 아직 따르지 않는다.
  - 제안: 급하지 않음. 다음에 이 파일을 손댈 때 `MANUAL_TRIGGER_TYPE` 를 `NODE_TYPES.MANUAL_TRIGGER` 로 교체해 통합.

- **[INFO]** `trigger-configs.tsx` map 콜백 내부 JSX 들여쓰기가 부분적으로만 정렬됨 — 프로젝트 린터(eslint)는 통과, 순수 가독성 잔여 이슈
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:107-143` (`<select>`, `<label>`, 조건부 defaultValue `<Input>`, description `<Input>`, 닫는 `</div>`)
  - 상세: 화살표 함수 암묵 반환 → 블록 반환(`{ const nameErr = ...; return (...) }`)으로 바뀌면서 `<Input value={p.name}>` 까지는 올바르게 2칸 늘어난 들여쓰기(12칸)를 받았지만, 그 아래 `<select>`부터 닫는 `</div>` 까지는 예전 들여쓰기(10칸)에 남아 같은 JSX 블록 안에서 두 들여쓰기 레벨이 섞여 있다. 실측: `npx eslint src/components/editor/settings-panel/node-configs/trigger-configs.tsx` 는 **경고 없이 통과**(프로젝트 authoritative linter). 이 항목은 직전 라운드에서 이미 WARNING 으로 지적됐고 `RESOLUTION.md`(W9)가 "raw prettier CLI 불일치는 알려진 이슈, 프로젝트 eslint 가 권위" 로 명시적으로 비차단 처리했다 — 그 판단은 실측과 일치한다.
  - 제안: 조치 불요(이미 처분됨). 다음에 이 블록을 다시 건드릴 기회가 있으면 에디터 재포맷으로 시각적 들여쓰기만 정리하면 좋다.

## 요약

핵심 수정 3건(엔진 재진입 durable input, `type` 기반 트리거 조회, 저장 시점 스키마 검증)은 파일 단위로는 네이밍이 명확하고 함수 길이·중첩·순환 복잡도가 낮으며, 신규 테스트(`load-trigger-parameter-schema.spec.ts`, `workflows.service.spec.ts` 추가분)의 이름도 의도를 잘 드러낸다. 다만 직전 리뷰 라운드(11_08_21)가 지적한 두 항목 — ① "durable input 재사용" 로직이 3(+1)곳에 헬퍼 없이 반복 서술되는 중복, ② 그중 2곳의 주석이 파일의 한국어 컨벤션을 벗어난 영어로 작성된 것 — 이 이번 라운드에도 그대로 남아 있고, 추가로 그중 한 주석(`driveResumeFrame`)이 실제로는 반대 동작을 하는 `resumeGraphAfterRetry` 를 참조 대상으로 잘못 지목하고 있어(정답은 `driveResumeAwaited`) 향후 탐색을 오도할 수 있다. `saveCanvas(..., true)` 호출부의 이름 없는 boolean 인자도 호출부만 봐서는 의미를 알 수 없는 소소한 가독성 결함이다. 식별자 정규식 중복·`MANUAL_TRIGGER_TYPE` 이중 정의·JSX 들여쓰기 잔여 문제는 이미 백로그로 추적 중이거나(전자) 프로젝트 authoritative linter 기준으로 비차단 처리(후자)가 확인돼 정보 수준으로만 남긴다. 전체적으로 기능적 결함은 없고, 발견 사항은 모두 주석/구조 정리 수준의 개선 권고다.

## 위험도

LOW
