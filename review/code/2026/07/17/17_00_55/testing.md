# 테스트(Testing) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + endReason drift 구조적 차단

검토 방법: 프롬프트의 diff 정독 + 현재 워크트리 소스 전체 열람 + **실제 실행 검증**(jest/vitest/tsc/eslint 4종 + `check-e2e-playwright-config.py`) + **mutation 실측**(4건 — 통과 자체가 검증이 아니라는 이 PR 자신의 원칙을 리뷰에도 적용). 모든 mutation 은 검증 직후 `git checkout --` 로 원복, 최종 `git status` clean 확인.

## 실행 검증 요약 (사실관계)

| 대상 | 명령 | 결과 |
|---|---|---|
| `@workflow/ai-end-reason` | `pnpm test`(jest) | 5 passed |
| `@workflow/ai-end-reason` | `pnpm build`(tsc) / `pnpm lint`(eslint) | 둘 다 clean |
| backend 변경 3개 spec (`ai-turn-executor`/`ai-agent.handler`/`information-extractor.handler`) | `jest` | 173 passed |
| backend 변경 4개 소스 파일 | `eslint` | clean (0 warning) |
| backend 전체 `tsc --noEmit -p tsconfig.json` | 참고용 | 197 pre-existing error, 전부 이 diff 무관 파일(carousel/chart/table/workflow/http-safety 등). 4개 대상 파일(0건) — **실제 게이트인 `nest build`(`tsconfig.build.json`, spec 제외)는 clean** |
| frontend 변경 2개 테스트 파일 | `vitest run` | 33 passed |
| frontend 전체 | `vitest run` | **278 files / 5506 tests passed** |
| frontend 변경 4개 파일 | `eslint` | clean |
| Docker/compose `@workflow/*` 클로저 정합 | `scripts/check-e2e-playwright-config.py` | `OK: ... @workflow closure (5) synced` |

## 발견사항

### [WARNING] `IS_MULTI_TURN_INTERACTION` 매핑의 **값**(true/false) 정확성에 대한 테스트가 0건 — mutation 실측으로 5506개 테스트 전원 미검출 확인

- **위치**: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:69-83` (`IS_MULTI_TURN_INTERACTION` → `MULTI_TURN_INTERACTION_TYPES`), 소비처 `codebase/frontend/src/components/editor/run-results/output-shape.ts:13,144,165,172`
- **상세**: 이 PR 이 `MULTI_TURN_INTERACTION_TYPES` 를 "두 번째 무가드 손 목록"(plan §E-3b)이라 진단하고 `interaction-type-registry.ts` 로 옮기며 `Record<WaitingInteractionType, boolean>` 형태(`IS_MULTI_TURN_INTERACTION`)로 재구성했다. 이 구조는 **키 4개(`form`/`buttons`/`ai_conversation`/`ai_form_render`)가 전부 존재하는지**만 컴파일타임에 강제한다 — `WaitingInteractionType` 에 값이 추가되면 이 리터럴이 깨진다. 그러나 **각 키에 매핑된 boolean 값이 실제로 맞는지는 타입 시스템이 검사하지 않는다** (`ai_form_render: true` 를 `false` 로 바꿔도 `Record<WaitingInteractionType, boolean>` 타입에는 여전히 부합).
  실측(mutation): `ai_form_render: true` → `false` 로 변경(전형적 복붙/오타 재현) 후 frontend 전체 `vitest run` 실행 → **278 test files / 5506 tests 전원 통과, 0건 실패**. `MULTI_TURN_INTERACTION_TYPES`/`IS_MULTI_TURN_INTERACTION` 를 직접 참조하는 테스트는 grep 전수 결과 0건이었다. 이 값이 잘못되면 `ai_form_render` 로 끝나는 대화의 미리보기 탭이 사라진다 — **이 PR 이 `endReason` 에 대해 막으려는 것과 정확히 같은 증상**이 형제 코드(`interactionType` 분류)에서는 여전히 무방비다. 참고로 이 값 자체(true/true/false/false)는 현재 정확하다 — 문제는 "지금 틀렸다"가 아니라 "틀려도 아무 테스트도 못 잡는다"는 것.
- **제안**: `MULTI_TURN_INTERACTION_TYPES` 가 정확히 `{"ai_conversation","ai_form_render"}` 이고 `"form"`/`"buttons"` 를 포함하지 않는지 확인하는 단언 1건을 `output-shape.test.ts` 또는 신설 `interaction-type-registry.spec.ts` 에 추가.

### [WARNING] `isConversationOutput` 의 endReason 화이트리스트 **거부(negative)** 경로가 테스트되지 않음 — whitelist 체크를 제거하는 mutation 이 5506개 테스트를 전부 통과

- **위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts:174-180` (`looksLikeConversationEnd`)
- **상세**: `looksLikeConversationEnd = hasResultMessages && typeof endReason === "string" && CONVERSATION_END_REASONS.has(endReason)`. 이번 diff 가 고친 `output-shape.test.ts` 의 `"accepts every unified endReason as a conversation terminal"` 은 **화이트리스트에 있는** 값에 대해 `true` 인지만 순회 검증한다(positive-only). `result.messages` 는 있지만 `endReason` 이 화이트리스트 **밖**인 경우 `false` 를 반환해야 한다는 negative 테스트는 어디에도 없다.
  실측(mutation): `&& CONVERSATION_END_REASONS.has(endReason)` 조건절 자체를 제거(어떤 문자열이든 통과)한 뒤 frontend 전체 `vitest run` 실행 → **5506 tests 전원 통과, 0건 실패**. 즉 이 whitelist 검사를 통째로 무력화해도 현재 테스트 스위트는 알아채지 못한다. 이 whitelist 의 존재 이유가 "부정확한/미지의 endReason 을 대화로 오인하지 않기 위함"인데, 그 방어선이 사실상 무검증 상태다 — 컴파일타임 장치(`satisfies`/`Exclude`)는 "배열이 유니온과 일치하는가"만 지키지, "런타임에 그 배열을 실제로 참조해 걸러내는가"는 지키지 못하는 축이라 이 gap 은 패키지 도입만으로는 안 닫힌다.
- **제안**: `hasResultMessages: true` + 화이트리스트 밖 임의 문자열(`endReason: "bogus_value"`) 조합에서 `isConversationOutput` 이 `false` 를 반환하는 테스트 1건 추가 (`rejects non-conversation shapes...` 근처가 자연스러운 위치).

### [INFO] `end-reason.spec.ts` 마지막 테스트가 파일 자신의 설계 원칙(타입 중복 검증 금지)과 어긋나는 동어반복

- **위치**: `codebase/packages/ai-end-reason/src/__tests__/end-reason.spec.ts:41-46` (`'모든 값이 ConversationEndReason 으로 좁혀진다'`)
- **상세**: 파일 상단 docstring 이 "타입으로 이미 강제되는 것을 런타임에서 또 확인하는 건 중복이라 두지 않는다"를 명시적 설계 원칙으로 선언하고, 나머지 4개 테스트(중복/비어있음/양쪽 도메인 대표값/`'out'` 미포함)는 정확히 그 원칙대로 "타입이 못 잡는 축"만 겨냥한다. 그런데 이 5번째 테스트는 `const narrowed: ConversationEndReason = reason` 대입 — 컴파일이 통과하면(즉 이 파일이 로드되면) 이미 타입 검증은 끝난 상태이고, 뒤이은 `expect(typeof narrowed).toBe('string')` 는 배열 원소가 문자열이라는 자명한 사실만 재확인해 어떤 값 mutation 에도 실패할 수 없는 tautology 다. 실질적 해는 없음(느리지 않고 다른 4건은 원칙에 정확히 부합) — 파일이 스스로 선언한 원칙과의 사소한 불일치일 뿐.
- **제안**: 제거하거나, 타입이 못 잡는 실질 조건(예: 각 값이 `AiAgentEndReason` 또는 `InformationExtractorEndReason` 어느 한쪽에는 반드시 속한다는 상호배타 아닌 "합집합 커버리지" 확인)으로 교체.

## 긍정 확인 (실측으로 검증됨 — 참고용)

- **E-1 (기존 가드의 컴파일타임 false-negative 수정)**: `interaction-type-exhaustiveness.test.ts` 의 옛 `const _t: ReadonlyArray<T> = VALUES` 패턴이 `T` 에 값이 추가돼도 통과하던 실제 버그였음을 직접 재현 확인했고, 신규 `interaction-type-registry.ts` 의 `Exclude`+`[X] extends [never]` 패턴은 **`INTERACTION_TYPE_VALUES` 에서 `"ai_form_render"` 를 제거하는 mutation 에 대해 실제로 `tsc` 컴파일 에러(`TS2322: Type 'true' is not assignable to type 'never'`)로 검출**함을 실측했다 — 주석의 주장이 사실과 일치.
- **`@workflow/ai-end-reason` 의 `satisfies`+`Exclude` 양방향 잠금**: 3방향 mutation 을 모두 실측 — (1) 배열에서 값 제거 → `Exclude` 가 `TS2322` 로 검출, (2) 배열에 미지 값(`'TYPO_VALUE'`) 추가 → `satisfies` 가 `TS2322`(`Type '"TYPO_VALUE"' is not assignable to type 'ConversationEndReason'`)로 검출. 커밋 메시지·plan 문서의 주장이 실측과 정확히 일치한다.
- **회귀 테스트 유효성**: 이번 diff 는 `endReason` 파라미터 타입을 리터럴 유니온에서 동일 값의 named 타입(`AiAgentEndReason`/`InformationExtractorEndReason`)으로 바꾸는 순수 리네임이라 기존 backend 회귀 스위트(`endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`multiTurnPortForEndReason` 를 exercise 하는 173개 테스트, `user_ended`/`max_turns`/`condition`/`error` 4값 전부 이미 커버)가 무수정으로 전부 유효함을 실행으로 확인.
- **테스트 격리·가독성·Mock 적절성**: `end-reason.spec.ts`/`output-shape.test.ts` 모두 테스트 간 공유 mutable state 없음, mocking 불필요(순수 값/함수)이며 실제로 미사용. Korean 코멘트가 "왜 이 값/이 케이스가 필요한지"(PR #959 회귀 이력, Inv-8 등)를 각 테스트 옆에 명시해 향후 유지보수자가 삭제 유혹을 느끼지 않도록 설계돼 있다 — 특히 "빈 배열이면 `Exclude`가 유니온 전체를 missing 으로 보고 컴파일을 깨뜨리지만, 유니온까지 함께 지워지면 조용히 통과한다"는 `'비어있지 않다'` 테스트의 근거 설명은 드문 수준의 정교함.
- **인프라/배선 테스트**: `.claude/test-stages.sh` `INTERNAL_PACKAGES` 등록·`.github/workflows/packages-checks.yml` matrix+paths(pull_request/push 둘 다) 등록·`docker-compose.e2e.yml` 마스킹 등록을 모두 실측 확인했고, `check-e2e-playwright-config.py` 가 실제로 5개 `@workflow/*` 패키지 클로저 정합을 `OK` 로 통과시킴을 실행 확인 — plan 이 자인한 "6곳→7곳 정정"(`test-stages.sh` 누락) 이 최종 diff 에는 반영돼 있다.

## 스코프 외 확인 (문제 없음 — 오탐 방지용 기록)

- `resolve-dynamic-ports.ts`/`edge-utils.ts` 의 `user_ended`/`max_turns` 리터럴은 캔버스 **포트 UI 라벨**(별개 도메인)이며 패키지 README 가 "port 매핑은 소유하지 않음"을 명시적으로 선언 — 이 diff 의 미스가 아니라 의도된 경계.
- backend 전체 `tsc --noEmit -p tsconfig.json` 의 197개 에러는 이 diff 가 만들거나 건드린 4개 소스 파일 어디에도 없고(grep 확인), 실제 빌드 게이트(`nest build` → `tsconfig.build.json`, `**/*spec.ts` 제외)는 clean — 무관한 pre-existing 노이즈로 판단, 리포트에서 제외.

## 요약

핵심 신규 자산(`@workflow/ai-end-reason` 패키지의 `satisfies`+`Exclude` 양방향 컴파일타임 잠금, `interaction-type-registry.ts` 로 이전된 실동작 exhaustiveness 단언)은 4가지 방향의 mutation 실측 전부에서 주장대로 정확히 작동했고, 기존 backend/frontend 회귀 스위트(173+5506+33+5 테스트)도 무수정으로 전부 green 이었으며 CI/Docker 배선도 `check-e2e-playwright-config.py` 로 실측 확인됐다 — 이 PR 이 표방한 "endReason drift 의 구조적 차단"이라는 좁은 목표에 대해서는 테스트 설계·실측 검증 수준이 이 리포지토리 기준으로도 상당히 높다. 다만 리팩토링 과정에서 옆으로 옮겨진 형제 코드 두 곳 — `interaction-type-registry.ts` 의 `IS_MULTI_TURN_INTERACTION` **값** 정확성, `isConversationOutput` 의 endReason 화이트리스트 **거부** 경로 — 는 mutation 실측 결과 frontend 전체 5506개 테스트 중 단 하나도 잡아내지 못하는 사각지대였다. 두 사각지대 모두 "지금 틀렸다"는 증거는 없지만, 틀렸을 때의 증상이 바로 이 PR 이 세 번째로 되풀이됐다고 진단한 "미리보기 탭 소실"과 동일 계열이라는 점에서, 통과 자체를 검증으로 삼지 않는다는 이 PR 자신의 원칙을 형제 코드에도 완결적으로 적용하지 못한 채 남겨둔 잔여 리스크로 본다.

## 위험도

MEDIUM
