# 정식 규약 준수 검토 — llm-usage-attr-hardening (impl-prep)

대상: draft plan (변경 (e) `ai-turn-executor.ts` 타입 주석, 변경 (g) `information-extractor.handler.spec.ts` 테스트 1건 추가)
base: `origin/main` @ `cc3dafa8c`

## 발견사항

0건 (Critical/Warning 없음). 아래는 검증 과정에서 확인한 사실 기록 (INFO 3건, 모두 비차단).

- **[Info] `@typescript-eslint/consistent-type-imports` 미설정 — 혼합 named import 는 lint-safe**
  - target 위치: 변경 (e) import 절 (`ai-turn-executor.ts:11` 예정 수정)
  - 근거 파일: `codebase/backend/eslint.config.mjs:1-103` (규칙 목록에 `consistent-type-imports` 부재), `@typescript-eslint/eslint-plugin` 의 `flat/recommended-type-checked.js`(node_modules) 확인 — 이 preset 에도 해당 규칙 미포함
  - 상세: impl-prep 요청에서 "이 규칙이 켜져 있으면 Critical" 이라 가정했으나, 실측 결과 backend `eslint.config.mjs` 는 `tseslint.configs.recommendedTypeChecked` + prettier + 소수 커스텀 규칙만 사용하고 `consistent-type-imports` 는 어디에도 등록돼 있지 않다. 따라서 `import { LlmService, LlmCallContext } from '../../../modules/llm/llm.service';` 같은 값+타입 혼합 named import 는 lint fail 을 유발하지 않는다. 또한 `nest-cli.json` 에 `"builder": "swc"` 지정이 없어 `nest build` 는 기본 tsc 전체-프로그램 컴파일을 쓴다 — `tsconfig.json` 의 `isolatedModules: true` 는 파일 단위 트랜스파일러(SWC/Babel 등)에서만 타입-전용 심볼 소거 문제를 일으키는데 여기 해당 없음. 즉 draft 의 혼합 import 계획은 컴파일·lint 양쪽 모두 안전.
  - 제안: 없음 (규약 위반 아님). 단 이 확인 결과가 "가정 반박" 이므로 impl 단계에서 다시 문제 삼지 않도록 이 사실을 기록으로 남김.

- **[Info] import 스타일 — sibling precedent 는 일치, 동일 파일 내 기존 관례와는 미세한 결이 다름**
  - target 위치: 변경 (e) `ai-turn-executor.ts:11`
  - 근거 파일: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:10` (`import { LlmService, LlmCallContext } from '../../../modules/llm/llm.service';` — draft 가 계획한 것과 완전히 동일한 형태로 이미 존재), 대비 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:37-42` (`import { AiConditionEvaluator, type ConditionDef } from './ai-condition-evaluator';`, `import { type MemoryStrategy } from './ai-agent.schema';` — 같은 대상 파일 안에서 값+타입 혼합 시 inline `type` 수식어를 붙이는 로컬 관례가 이미 2곳 존재)
  - 상세: draft 의 계획(plain 혼합 import, `type` 수식어 없음)은 **동일 기능 계열의 자매 핸들러(`information-extractor.handler.ts`)의 선례와는 완전히 일치**한다. 다만 **수정 대상 파일 자체(`ai-turn-executor.ts`)** 는 이미 자체적으로 "값+타입 혼합 시 `type` 인라인 태그" 패턴을 2곳에서 채택하고 있어, 파일 내부 일관성 관점에서는 `import { LlmService, type LlmCallContext } from ...}` 쪽이 좀 더 그 파일의 기존 스타일에 가깝다. 두 선례가 서로 다른 방향을 가리키므로 이는 규약 위반이 아니라 취향 수준의 결정 — lint 로 강제되지 않음.
  - 제안: 구현 시 `import { LlmService, LlmCallContext }` (자매 파일과 통일, draft 그대로) 또는 `import { LlmService, type LlmCallContext }` (해당 파일 로컬 관례와 통일) 둘 다 허용. 어느 쪽을 택하든 Critical/Warning 아님 — 결정만 하면 됨.

- **[Info] CHANGELOG 갱신 — 정식 규약 대상 아님 (확인 결과)**
  - target 위치: 변경 (e)/(g) 전체 (draft 에 CHANGELOG 언급 없음)
  - 근거 파일: `spec/conventions/**` 전체 grep 결과 CHANGELOG 관련 규칙 0건, `PROJECT.md` §변경 유형 → 갱신 위치 매핑(`PROJECT.md:111-138`) 표에도 CHANGELOG 행 없음, `.claude/skills/developer/SKILL.md` · `.claude/skills/project-planner/SKILL.md` 에도 CHANGELOG 언급 없음. CHANGELOG 관련 텍스트가 등장하는 곳은 `.claude/agents/documentation-reviewer.md`/`code-review-agents` 뿐이며, 거기서도 "중요한 변경에 대한 CHANGELOG 업데이트 **필요성**" 이라는 판단형 체크리스트 항목이지 build-gate 는 아니다.
  - 상세: `CHANGELOG.md:21-25` 에 이미 이번 하드닝이 뒤따르는 원 PR(#877/#879, "멀티턴 resume 턴 llm_usage_log attribution")의 Unreleased 항목이 존재한다. 본 draft 는 "런타임 동작 변경 0" 인 순수 타입 주석 + 테스트 추가이므로, CHANGELOG 신규 항목 없이 진행해도 정식 규약 위반이 아니다.
  - 제안: 없음. 원한다면 기존 §21-25 항목에 "(컴파일 타임 하드닝 + 회귀 테스트 추가)" 한 문장을 덧붙이는 것도 가능하나 의무는 아님.

## 검토 항목별 결론

1. **테스트 컨벤션** — 준수. `describe('collection retry loop')` 블록(`information-extractor.handler.spec.ts:954-1107`)이 실제로 `retryState()`(:970-992)·`finalizeCall()`(:44-69)·`asNodeHandlerOutput()`(:14-29, 간접적으로 `getResult`/`getError` 경유)을 이미 사용 중이며 draft 의 신규 테스트 계획과 정확히 부합. `retryState()` 는 draft 의 주장대로 `executionId`/`workflowId`/`nodeExecutionId` 를 기본값으로 갖지 않는다 — `handler.ts:891` 의 `state.executionId ? {...} : undefined` 삼항이 이를 확인시킨다. 대칭 선례 `ai-turn-executor.spec.ts:520-533` 의 `mock.calls[1][2]` + `expect.objectContaining` 단언 스타일은 backend 스펙 스위트 전반에서 흔한 관용구(`mock.calls[` 사용 spec 파일 64개 중 43개가 같은 파일 안에서 `objectContaining` 도 함께 사용)라 저장소 관례로 확인됨.
2. **import 컨벤션** — 위 INFO 2건 참조. Critical 아님 — 가정했던 lint 규칙 부재 확인, sibling 파일 정확히 동일 선례 존재.
3. **PROJECT.md 변경 유형 → 갱신 위치 매핑** — 해당 없음, 정상. 표(`PROJECT.md:117-138`)의 각 행(신규 노드/schema 변경/신규 UI 문자열/통합 변경/API 추가/BullMQ 큐/warningCode/errorCode/cross-cutting enum/backend ui.label/handler output field/AuthConfig enum/user-guide GUI 절) 중 어느 것도 "기존 파일의 타입 주석 추가 + 테스트 1건 추가" 에 매칭되지 않는다. i18n/user-guide/backend-labels 동반 갱신 불요.
4. **spec-impl-evidence** — 해당 없음, 정상. `ai-turn-executor.ts` 는 이미 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:`(파일 목록 중 정확히 이 경로 등재)에 포함, `information-extractor.handler.ts` 는 `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter `code:` 에 등재. 둘 다 기존 파일 수정이라 신규 glob 등록 불요. `.spec.ts` 테스트 파일은 저장소 전역에서 `code:` frontmatter 배열에 등재되는 관례가 없음(grep 결과 `.spec.ts` 언급은 본문 서술에서만 발견 — 예: `4-cafe24.md:509`, `4-integration.md:1598` 등)을 확인, 신규 테스트 추가가 frontmatter 갱신을 요구하지 않음을 재확인.
5. **CHANGELOG** — 위 INFO 3번째 항목 참조. 정식 규약 대상 아님, 확인 완료.

## 요약

Draft 가 계획한 두 변경(ai-turn-executor.ts 의 `LlmCallContext` 타입 주석 + import, information-extractor.handler.spec.ts 의 attribution 회귀 테스트 1건)은 `spec/conventions/**` 및 `PROJECT.md` 의 정식 규약 관점에서 위반 사항이 없다. 테스트는 기존 `describe('collection retry loop')` 블록의 헬퍼·자매 파일의 mock 단언 관례를 그대로 따르고, import 는 우려했던 `consistent-type-imports` lint 규칙이 실제로는 backend `eslint.config.mjs` 에 존재하지 않음을 확인해 혼합 named import 가 안전함을 검증했다(단, 수정 대상 파일 자체의 로컬 `type` 인라인 관례와는 미세한 스타일 차이가 있어 INFO 로만 기록). PROJECT.md 동반 갱신 매트릭스·spec-impl-evidence frontmatter 모두 이번 변경 범위(기존 파일 내부 수정, 신규 파일/glob/enum/필드 없음)에 해당 트리거가 없어 추가 조치가 불요하며, CHANGELOG 갱신 역시 정식 규약이 요구하는 항목이 아니다. Critical/Warning 없이 구현 착수 가능.

## 위험도

NONE

STATUS: DONE
