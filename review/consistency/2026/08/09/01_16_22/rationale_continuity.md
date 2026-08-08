# Rationale 연속성 검토 — backend-lint-gate (impl-done, scope=spec/data-flow/)

## 검토 대상 요약

diff-base `origin/main` 대비 diff(`codebase/backend/src/**` 약 70개 파일, `## 구현 변경 사항` 섹션)를 전수 확인했다. 모든 hunk 는 다음 두 유형 중 하나다:

1. **불필요한 타입 단언/캐스트 제거** — `as unknown as X`, `as X | undefined`(멀티라인 leading-pipe 유니언), `as never` 등을 ESLint `no-unnecessary-type-assertion`/`no-redundant-type-constituents` 류 규칙에 맞춰 제거. 런타임 동작 변화 없음(같은 값을 그대로 대입/전달).
2. **필요한 단언은 유지 + 근거 주석 추가** — 예: `retry-turn.service.ts`(errorObj 캐스트), `execution-context.service.ts`(Readonly view 캐스트), `ai-turn-executor.ts`(retryDetails), `secret-resolver.service.ts`(never→string, 캐스트 자체를 제거하되 `nest build` 로 안전성 실측 확인). 이런 지점은 `eslint-disable-next-line` + "제거하면 TSxxxx 로 깨진다"는 실측 근거 주석을 동반한다.

`spec/**` 파일은 diff 에 전혀 포함되지 않았다(모든 `diff --git` 대상이 `codebase/backend/src/...` 또는 `codebase/backend/test/...`). 즉 이번 변경은 spec 문서를 갱신하지 않는 순수 코드 lint-cleanup PR이다.

번들에 포함된 `spec/data-flow/*.md` 및 `## 관련 Rationale 발췌`(spec/0-overview, 1-data-model, 2-navigation/*, 3-workflow-editor/*, 4-nodes/*, 5-system/* 의 Rationale 전체, 특히 `5-system/4-execution-engine.md` 의 retry 원자 claim·`_resumeCheckpoint`·`failed → running` 재진입 등 실행 엔진 핵심 불변식들)를 diff 와 대조했다.

## 관점별 확인

1. **기각된 대안의 재도입** — 해당 없음. diff 는 상태 전이·큐 로직·SQL·엔드포인트 계약을 전혀 건드리지 않는다. `retry-turn.service.ts`/`execution-engine.service.ts`/`execution-context.service.ts` 등 Rationale 이 두터운 파일들도 타입 표현만 바뀌었고 조건문·SQL·전이 로직은 diff 대상 밖이다(예: `applyRetryLastTurn` 의 조건부 UPDATE, `waiting_for_input → running` claim, `_resumeCheckpoint` 재유도 로직 등은 diff 에 나타나지 않음).
2. **합의된 원칙 위반** — 해당 없음. `secret-resolver.service.ts` 의 캐스트 제거는 SS-SE-05(plaintext 비노출) 를 다루는 에러 메시지 조립부이지만, 바뀐 것은 `never → string` 캐스트 표현뿐이고 노출되는 값(`refStr.length`/`refStr.slice(0,8)`)·로직은 100% 동일하다.
3. **결정의 무근거 번복** — 해당 없음. 오히려 반대 패턴이 관찰된다: 필요한 단언을 지우려던 자동 lint-fix 가 실제로 컴파일을 깨는 지점(`retry-turn.service.ts`, `execution-context.service.ts`, `telegram-client.ts`, `secret-resolver.service.ts`)마다 단언을 **유지**하고 "제거하면 TSxxxx/no-base-to-string 로 깨진다"는 근거 주석 + `eslint-disable-next-line` 을 명시적으로 남겼다. 이는 새 Rationale 이 필요한 종류의 "결정 번복"이 아니라 순수 lint 규칙 준수/예외 처리다.
4. **암묵적 가정 충돌** — 해당 없음. 검토한 실행 엔진 불변식들(§7.5 claim 원자성, `_retryState`/`_resumeCheckpoint` allow-list, `failed → running` 재진입 게이트, credential-strip 정책 등)은 모두 diff 밖의 로직이며 우회되지 않았다.

## 참고 — Rationale 대상은 아니지만 기록

- `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 에서 `// eslint-disable-next-line no-console` 주석 2곳이 제거됐다(코드는 유지, 주석만 삭제). Rationale 연속성과는 무관(lint 설정/커버리지 문제이며 코드 리뷰 관점 — 다른 리뷰어 영역).

## 발견사항

없음.

## 요약

이번 diff 는 spec 문서 변경이 전혀 없는, 타입 단언·캐스트·유니언 포맷팅만 건드리는 기계적 lint-cleanup 이다. `spec/data-flow/*.md` 및 연관 Rationale(특히 실행 엔진 §7.5 claim, `_resumeCheckpoint`, retry 재진입 등 결정 밀도가 높은 영역)을 대조했으나 로직·SQL·상태 전이·엔드포인트 계약이 전혀 변경되지 않았고, 오히려 제거하면 빌드가 깨지는 지점은 단언을 유지하며 근거 주석을 남겨 놓았다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 발견되지 않았다.

## 위험도

NONE
