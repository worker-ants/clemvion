# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 동일 개념("재진입 시 durable trigger input 재사용")이 3곳에 중복 구현되고, 각기 다른 길이·언어의 설명 주석을 달고 있어 향후 동기화가 깨지기 쉽다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2068-2086`(`driveResumeAwaited`, 8줄짜리 한국어 설명), `:2417-2419`(`driveResumeFrame`, 영어 2줄), `:3199-3203`(`driveStuckRedrive`, 영어 4줄)
  - 상세: 세 호출부 모두 `input: savedExecution.inputData ?? {}` 라는 동일한 한 줄 표현식을 쓰면서, 그 근거 설명은 매번 새로 서술되어 있다(하나는 한국어로 5~6줄, 나머지 둘은 영어로 1~2줄 요약). 이 패턴은 헬퍼로 추출되지 않아 "재진입 시 미완료 entry 노드는 durable input 을, 완료된 노드는 skip" 이라는 불변 규칙이 코드 상 한 곳에 존재하지 않는다. 실제로 구조적으로 동일한 4번째 호출부가 `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:565-577`(`resumeGraphAfterRetry`)에 있는데, 이곳은 여전히 `input: {}` 이며 주석도 "input 은 retry 경로엔 의미 없으므로 빈 객체" 로 전혀 다른 논리를 담고 있다. (이 4번째 지점이 실제로 안전한지는 correctness 영역이라 본 리뷰 범위 밖이나, 유지보수성 관점에서는 "동일 패턴 4곳 중 3곳만 통일된 설명/수정을 받고 1곳은 독립적으로 남아있다"는 사실 자체가 향후 변경 시 놓치기 쉬운 함정이다.)
  - 제안: `private reentryTriggerInput(savedExecution: Execution): Record<string, unknown>` 같은 이름의 작은 private 헬퍼(또는 JSDoc 을 가진 상수/유틸)로 추출해 규칙을 한 곳에서 문서화하고, 각 호출부는 `input: this.reentryTriggerInput(savedExecution)` + 짧은 참조 주석만 남긴다. `retry-turn.service.ts` 의 4번째 호출부도 같은 헬퍼를 참조하거나(공유 가능하면), 왜 이 지점만 예외인지 명시적으로 교차 참조하는 주석을 남겨 drift 위험을 줄인다.

- **[WARNING]** 새로 추가된 주석 2건이 파일 전반의 한국어 코멘트 컨벤션에서 벗어나 영어로 작성됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2418`, `:3199-3202`
  - 상세: `execution-engine.service.ts` 는 (같은 diff 의 `driveResumeAwaited` 지점을 포함해) 사실상 전부 한국어 설명 주석을 쓰는 파일이다. 그런데 이번 diff 에서 추가된 `driveResumeFrame`/`driveStuckRedrive` 두 지점의 주석만 영어로 작성돼 파일 내 언어 컨벤션이 갈린다.
  - 제안: 기존 파일 컨벤션(한국어)에 맞추거나, 위 첫 번째 항목처럼 헬퍼로 추출해 설명을 1곳에만 남기면 언어 불일치도 함께 해소된다.

- **[WARNING]** JSX 를 화살표 함수 암묵적 반환에서 블록 반환으로 바꾸는 과정에서 들여쓰기가 일부 누락되어 파일이 prettier 포맷을 통과하지 못함 (실측: `npx prettier --check` 실패)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:107-143`
  - 상세: `parameters.map((p, i) => (...))` → `parameters.map((p, i) => { const nameErr = ...; return (...); })` 로 감싸면서, `<Input value={p.name}>` 까지는 2칸 늘어난 들여쓰기(12칸)가 적용됐지만 그 아래 `<select>`, `<label>`, `{p.required !== true && (...)}`, description `<Input>`, 닫는 `</div>` 는 이전 들여쓰기(10칸)에 그대로 남아 같은 블록 내에서 들여쓰기 레벨이 섞여 있다. 기능에는 영향 없으나 diff/파일을 읽을 때 중첩 구조 파악이 어려워지고, CI 에 prettier 검사가 있다면 실패할 수 있다.
  - 제안: 해당 블록을 `eslint --fix`(prettier 직접 호출은 파일 전체 reflow 위험이 있으므로 지양) 또는 에디터 재포맷으로 들여쓰기를 통일한다.

- **[INFO]** 이번 fix 와 무관한 타입 캐스트 제거가 같은 diff 에 섞여 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:293` (`settings: { ...dto.settings } as Record<string, unknown>,` → `settings: { ...dto.settings },`)
  - 상세: Manual Trigger 파라미터 default 버그와 관계없는 1줄 리팩터링(불필요한 캐스트 제거)이 같은 파일을 건드리는 김에 섞여 들어갔다. 동작에는 영향 없어 보이나, 리뷰/블레임 시 "왜 이 줄이 이 커밋에 있는지" 맥락이 흐려진다.
  - 제안: 사소하므로 강제 조치는 불필요. 다음에 무관한 정리성 변경이 생기면 가능하면 별도 커밋으로 분리.

## 요약

핵심 로직(엔진 재진입 input, `type` 기반 트리거 조회, 저장 시점 검증, 프론트 즉시 커밋/인라인 검증)은 각 파일 단위로는 네이밍이 명확하고 함수 길이·중첩이 적절하며, 기존 관례(shared validator 재사용, spec 각주 인용, plan 문서화)를 잘 따른다. 다만 3곳에 반복된 "durable input 재사용" 로직이 헬퍼로 추출되지 않고 매번 다른 언어·분량의 설명 주석을 새로 달면서, 구조적으로 동일한 4번째 호출부(retry-turn.service.ts)가 다른 결론의 독립 주석으로 남아 향후 동기화 리스크를 키운다. 프론트 trigger-configs.tsx 는 JSX 리팩터링 과정에서 들여쓰기가 부분적으로만 적용돼 포맷 일관성이 깨졌다(prettier check 실패 실측). 이 두 가지를 제외하면 전반적으로 가독성·복잡도·매직넘버 측면에서 눈에 띄는 문제는 없다.

## 위험도

LOW
