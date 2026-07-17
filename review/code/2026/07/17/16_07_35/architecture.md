# 아키텍처(Architecture) 리뷰 — `@workflow/ai-end-reason` 신설 + endReason drift 구조적 차단

> 대상 커밋: `f0ef4a821`(패키지 신설) · `9df2bb42f`(spec 후속). `prompt_file` 에 첨부된 diff 는
> `review/consistency/**` 산출물 4개 + spec 3개(`1-ai-agent.md`/`3-information-extractor.md`/
> `interaction-type-registry.md`)뿐이었으나, 지시된 점검 관점(a)~(e)가 실제 코드(패키지 소스,
> `node-handler.interface.ts`, `ai-turn-executor.ts`, `information-extractor.handler.ts`,
> frontend `interaction-type-registry.ts`/`output-shape.ts`/exhaustiveness test)에 대한 판단을
> 요구하므로, 이 리뷰는 워크트리 실물 코드를 직접 읽어 근거를 확인했다.

## 발견사항

- **[WARNING] `codebase/packages/README.md` — packages 루트에 특정 패키지 README 가 오배치돼 전체 워크스페이스 인덱스로 오인될 위험**
  - 위치: `codebase/packages/README.md` (신규 파일, `f0ef4a821`)
  - 상세: 이 파일은 `codebase/packages/ai-end-reason/README.md` 와 **바이트 단위로 동일한 내용**이다(제목 `# @workflow/ai-end-reason`부터 동일). `codebase/packages/` 디렉터리에는 이 패키지 외에도 `chat-channel-validation`/`expression-engine`/`graph-warning-rules`/`node-summary`/`sdk`/`web-chat-sdk` 6개가 형제로 존재하는데, 그중 어느 것도 루트에 자기 README 사본을 두지 않는다. `git show f0ef4a821^:codebase/packages/README.md` 는 "파일 없음" — 이 위치에 파일이 있었던 적이 없으므로 기존 인덱스를 덮어쓴 것도 아니고, 순수 신규 생성이다. `grep -rn "packages/README"` 로 저장소 전체를 검색해도 이 파일을 참조하는 곳이 하나도 없어 아무 기능에도 연결돼 있지 않다.
  - 왜 아키텍처 문제인가(모듈 경계): `codebase/packages/README.md` 라는 경로는 "packages 워크스페이스 전체의 인덱스"라는 의미를 강하게 시사한다. 실제로는 그 자리에 특정 패키지 하나의 문서가 놓여, 다음 사람이 이 디렉터리를 처음 열었을 때 "packages 전체가 ai-end-reason 하나만 다룬다"거나 "이게 전체 인덱스다"라고 오독할 수 있다 — 패키지 경계(점검 관점 7)가 파일시스템 레벨에서 흐려진 사례다. `codebase/packages/ai-end-reason/README.md` (정상 위치)는 이미 존재하므로, 이 사본은 순수한 배치 실수로 보인다(템플릿 복사 스크립트가 두 번 쓰였거나 target 경로를 잘못 지정한 것으로 추정).
  - 제안: `codebase/packages/README.md` 를 삭제한다. 만약 "packages 워크스페이스 전체 인덱스"가 실제로 필요하다면, 7개 패키지를 한 줄씩 요약하는 별도 내용으로 새로 작성해야지 특정 패키지 README 를 그대로 복제해서는 안 된다.

- **[WARNING] `.github/workflows/packages-checks.yml` — `push` 트리거 paths 에 `ai-end-reason` 누락 (pull_request/matrix 는 반영됨)**
  - 위치: `.github/workflows/packages-checks.yml:8-24` (특히 `push.paths`, L18-24)
  - 상세: 이번 커밋 diff 는 `pull_request.paths`(L10)와 `matrix.pkg`(L42)에는 `'codebase/packages/ai-end-reason/**'` / `'@workflow/ai-end-reason'` 을 추가했지만, `push.paths`(L20-24, main 브랜치 push 트리거)에는 추가하지 않았다. 결과적으로 `expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation` 4개는 push·PR 양쪽에서 대칭적으로 커버되는데 `ai-end-reason` 만 PR 트리거에서만 잡힌다.
  - 왜 문제인가: 이 PR 의 커밋 메시지 자체가 "배선 6곳(실측)... CI 두 곳을 빠뜨리면 빌드는 통과하는데 검증만 조용히 사라진다"며 CI 배선 누락을 이 작업의 핵심 리스크로 명시하고 있다 — 그런데 정작 이 워크플로 파일 안에서 동일한 종류의 누락(4곳 중 1곳 비대칭)이 새로 생겼다. 실무 영향은 제한적이다 — PR 시점 `pull_request` 트리거가 이미 lint/test/build 를 수행하므로 머지 전에는 걸러진다. 다만 향후 `pnpm-lock.yaml` 만 바뀌는 push 이벤트나 hotfix 성 direct push 시나리오에서 `ai-end-reason` 만 회귀 검증에서 빠질 수 있다.
  - 제안: `push.paths` 에 `'codebase/packages/ai-end-reason/**'` 한 줄을 추가해 4개 패키지와 대칭을 맞춘다.

- **[WARNING] `ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 파라미터가 `AiAgentEndReason` 으로 고정 — 인터페이스는 두 핸들러(AI Agent·IE) 공유를 명시하면서 타입은 한쪽만 반영**
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:403-437` (특히 L416 JSDoc·L429 `endReason: AiAgentEndReason`), 구현부 `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1176-1180`(로컬 `EndReason = InformationExtractorEndReason`)·`:1908-1917`(`portForEndReason` default 분기)
  - 상세: `ResumableNodeHandler` 인터페이스의 JSDoc(L389-390)은 "Multi-turn 대화형 노드 (**ai_agent, information_extractor**) 가 구현해야 하는 추가 메서드"라고 명시해 두 노드 타입 모두가 이 계약의 구현자임을 선언한다. 그런데 `endMultiTurnConversation` 의 `endReason` 파라미터 타입은 `AiAgentEndReason`(`user_ended`/`max_turns`/`condition`/`error`) 하나로 고정돼 있어, IE 고유 값(`completed`/`max_retries`)을 표현할 수 없다. `InformationExtractorHandler` 클래스는 `implements NodeHandler` 만 선언하고 `ResumableNodeHandler` 는 선언하지 않으므로(engine 은 `isResumableNodeHandler` 런타임 duck-typing 가드로만 narrow), tsc 는 IE 의 로컬 `EndReason = InformationExtractorEndReason` 와 인터페이스의 `AiAgentEndReason` 사이 불일치를 **전혀 검사하지 않는다**. 실측 결과 이 간극이 실제 버그로 이어지지는 않는다 — 이 메서드를 범용으로 호출하는 유일한 지점(`ai-turn-orchestrator.service.ts` 의 `handleAiEndConversation`/`handleAiTurnError`)은 항상 `'user_ended'` 또는 `'error'` 리터럴만 넘기고, 이 둘은 두 유니온의 교집합이라 우연히 안전하다. 게다가 IE 의 `portForEndReason` 는 `default: return 'error'` 로 미매치 값을 방어한다. 그러나 이는 **타입 시스템이 아니라 우연한 호출 패턴 + 런타임 방어 코드**가 안전을 지키는 구조다 — 만약 향후 세 번째 resumable 노드 타입이 추가되거나, 이 범용 호출부가 노드별 고유 종결값을 넘기도록 확장되면 컴파일러는 아무 경고도 주지 못한다.
  - 참고: 이 자체는 **이번 PR 이 새로 만든 결함이 아니다** — plan 의 E-3 표가 "동작 무변경, 리터럴 유니온을 같은 값의 named 타입으로 바꾸는 것뿐"이라고 명시한 대로, 이 파일의 해당 줄은 리팩터링 전에도 이미 좁은 리터럴 유니온이었다. 다만 이번 작업이 정확히 이 줄(`node-handler.interface.ts:428`)을 편집하면서 패키지가 이미 제공하는 `ConversationEndReason`(두 도메인의 합집합, 정확히 이런 "여러 구현체가 공유하는 인터페이스"용으로 설계된 파생 타입)으로 갈아탈 기회가 있었는데 채택하지 않았다.
  - 제안(강제 아님, 후속 검토 권장): `ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 타입을 `ConversationEndReason` 으로 넓히거나, 각 구현체가 자신의 구체 타입으로 narrow 할 수 있도록 인터페이스를 제네릭화한다. 최소한 JSDoc 에 "이 파라미터 타입은 현재 두 구현체의 교집합 호출 패턴에만 안전하며 IE 고유 종결값은 표현하지 못한다"는 한 줄을 남기면, 다음 사람이 이 인터페이스를 신뢰하고 IE 고유 값을 넘기려다 겪을 혼란을 예방할 수 있다.

- **[정보 확인 — 이상 없음] (a) 패키지 경계: 값 도메인만 소유, 의미·port 매핑·봉투 구조는 spec 이 계속 소유**
  - `codebase/packages/ai-end-reason/src/index.ts` 는 순수 타입 2개 + 파생 타입 1개 + 런타임 배열 1개, 총 96줄, **의존성 0개**(다른 어떤 backend/frontend 모듈도 import 하지 않음 — 순환 참조 원천 차단). `portForEndReason`류의 의미·라우팅 로직은 여전히 `ai-turn-executor.ts`/`information-extractor.handler.ts` 내부에 남아 있고, 패키지는 그 로직이 참조하는 "가능한 값의 집합"만 제공한다. `spec/conventions/node-output.md` 는 이번 변경에서 **전혀 건드리지 않았다**(grep 결과 `endReason`/`ai-end-reason` 언급 0건) — plan 의 최종 결정("node-output.md 는 봉투 구조 SoT 라 값 도메인을 얹으면 경계가 흐려진다")이 코드·spec 양쪽에서 실제로 지켜졌다. `spec/4-nodes/3-ai/1-ai-agent.md`/`3-information-extractor.md`/`spec/conventions/interaction-type-registry.md §4` 세 곳 모두 "SoT 는 패키지, 의미·port 매핑은 여기, 봉투 구조는 node-output.md" 라는 동일한 3분할 경계 문구를 반복해 명시하고 있어 문서 간 정합성도 확인됨.
  - 규모 판단("너무 얇은가"): 소스 96줄 + 테스트(`end-reason.spec.ts`) 58줄, 총 ~154줄은 기존 4개 패키지 중 최소 규모인 `chat-channel-validation`(158줄)과 대등하다 — 이 저장소의 "단일 값 도메인 하나만 다루는 shared 패키지"에 대한 이미 확립된 규모 관행과 일치하며, 과소 추상화(1파일이라 문제)로 보기 어렵다.
  - 명명: 초안 단계 `@workflow/node-output-contract`(naming_collision 체커가 WARNING 지적)에서 `@workflow/ai-end-reason` 으로 최종 변경돼 스코프가 이름에 정확히 반영됐고, "향후 interactionType 도 받을 자리"라는 확장 여지 서술도 plan 에서 명시적으로 철회됐다 — 넓은 이름을 먼저 선점하는 위험이 실제 코드 반영 단계에서 해소됨.

- **[정보 확인 — 이상 없음] (b) 두 유니온 분리 유지 + 파생 유니온 설계**
  - `AiAgentEndReason`(`user_ended`/`max_turns`/`condition`/`error`)과 `InformationExtractorEndReason`(`completed`/`max_turns`/`user_ended`/`timeout`/`max_retries`/`error`)을 병합하지 않고 각자 유지한 판단은 타당하다 — IE 는 `condition` 라우팅이 없고 AI Agent 는 `completed`/`max_retries` 개념이 없어, 병합 시 각 노드의 포트 매핑 switch(`AiTurnExecutor` L3421, IE `portForEndReason`)가 존재하지 않는 case 까지 타입상 받아들이게 돼 exhaustive switch 의 방어력이 약화된다. `ConversationEndReason` 은 오직 소비자(frontend `isConversationOutput` 게이트)가 "어떤 노드든 상관없이 대화 종결로 볼 값 전체"를 필요로 하는 지점에만 쓰이고, 두 handler 내부 로직은 각자의 좁은 유니온을 그대로 쓴다 — 책임 분리가 코드에 실제로 반영돼 있다.
  - `satisfies`(배열 ⊆ 유니온) + `Exclude`(유니온 ⊆ 배열) 양방향 잠금은 설계문서 주장에 그치지 않고 `src/__tests__/end-reason.spec.ts` 가 "타입 장치가 못 잡는 축"(중복값, 빈 배열, 한쪽 유니온 전체 소실, `'out'` 오염)을 런타임 테스트로 보완한다 — 무엇을 컴파일러가 잡고 무엇을 테스트가 잡는지 경계를 정확히 인지하고 설계된 흔적이 뚜렷하다.

- **[정보 확인 — 이상 없음] (c) `lib/conversation/interaction-type-registry.ts` 신설 — 근거·배치 모두 타당**
  - 근거 실측: `codebase/frontend/tsconfig.json` 이 `src/**/__tests__/**` 를 exclude 하므로 옛 `interaction-type-exhaustiveness.test.ts` 내부의 `const _typecheck: ReadonlyArray<T> = VALUES` 류 컴파일타임 단언은 tsc 가 애초에 읽지 않는 코드였다(테스트 파일에 명백한 타입 에러를 넣어도 `tsc --noEmit` 0건 보고 — 문서에 "실측"이라 적힌 주장을 신뢰할 근거가 코드 구조로도 확인됨: exclude 패턴과 파일 경로가 실제로 일치한다).
  - 레이어·응집도 판단: "tsc 가 봐야 하는 불변식은 tsc 가 보는 소스 모듈에 있어야 한다"는 원칙에 부합하는 정당한 이동이다. 이관 후 테스트 파일(`interaction-type-exhaustiveness.test.ts`)은 이제 이 모듈에서 **값 목록을 import** 해 순수 런타임 grep 검증(파일 I/O + 정규식)만 수행하도록 역할이 재편됐다 — "컴파일타임 자기증명은 src, 런타임 파일-대-파일 교차검증은 test" 라는 명확한 역할 분담이 성립한다.
  - 다만 한 가지 미세한 응집도 이슈: 이 모듈은 두 종류의 export 를 함께 담고 있다 — ① 순수 프로덕션 게이트 값(`MULTI_TURN_INTERACTION_TYPES`, `output-shape.ts` 의 `isConversationOutput` 이 실제 런타임에 소비) ② 컴파일타임 자기증명 전용 값(`INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES`, 저장소 전체 grep 상 유일한 소비처가 `interaction-type-exhaustiveness.test.ts` 뿐). 이 두 그룹은 "enum 값 목록과 타입의 동기화"라는 같은 문제의식을 공유하므로 한 파일에 있는 것 자체가 부당하지는 않으나(응집도상 방어 가능), 파일 상단 문서화에 "①은 프로덕션 게이트, ②는 grep 테스트 전용 SoT" 라는 이중 역할을 한 줄 더 명시해 두면 향후 이 파일에 export 를 추가하는 사람이 두 성격을 혼동하지 않는다. (INFO, 강제 아님)

- **[정보 확인 — 이상 없음] (d) `Record<WaitingInteractionType, boolean>` 파생 — 이 문제(전체 열거값을 정확히 N개 카테고리로 완전 분류)에 대해 TS 로 표현 가능한 사실상 최선의 패턴**
  - 옛 구조(`new Set(["ai_conversation", "ai_form_render"])`, 무가드 손 목록)와 대안으로 고려됨직한 "두 개의 `satisfies readonly T[]` 배열"(multi-turn 배열 + single-turn 배열)은 여전히 **같은 결함을 재현**한다 — 새 `WaitingInteractionType` 값이 추가됐을 때 두 배열 어디에도 넣지 않아도 `satisfies` 는 "배열 ⊆ 유니온" 방향만 검사하므로 통과한다(정확히 이 PR 이 `CONVERSATION_END_REASONS` 설계에서 지적한 것과 동일한 편측 검사 함정). `Record<WaitingInteractionType, boolean>` 은 객체 리터럴 완전성 검사(모든 key 필수 + 초과 key 거부)를 이용해 "각 값을 정확히 하나의 카테고리로 분류했는가"를 컴파일러가 직접 강제한다 — 부분집합 분류 문제에 대해 grep 가드보다 근본적으로 우월한 해법이며, 대안이 마땅치 않다는 판단에 동의한다.
  - 스타일 사소 지적(INFO): 같은 파일 계열에서 패키지의 `CONVERSATION_END_REASONS` 는 `as const satisfies readonly ConversationEndReason[]` 패턴을 쓰는데, `IS_MULTI_TURN_INTERACTION` 은 `: Record<WaitingInteractionType, boolean>` 명시적 타입 annotation 을 쓴다. 두 방식 모두 누락·초과를 동일하게 잡아내므로 기능적 차이는 없으나, 같은 PR 안에서 "왜 한쪽만 satisfies 를 쓰는가"라는 사소한 일관성 의문을 남길 수 있다. 강제할 정도는 아님.

- **[정보 확인 — 이상 없음] (e) IE `type EndReason = InformationExtractorEndReason` 로컬 별칭 — 타당**
  - `information-extractor.handler.ts` 내부에 `EndReason` 을 참조하는 지점이 8곳 이상(L1178, 1186, 1194, 1427, 1908 등)이라, 별칭을 유지하면 이번 리팩터링을 "타입 선언 교체" 로 국소화하고 호출부 전원 rename 을 피할 수 있다 — 최소 diff 원칙에 부합. 이 별칭은 `export` 되지 않아 파일 경계 밖으로 노출되지 않으므로 캡슐화도 유지된다. 위 WARNING 항목(인터페이스가 `AiAgentEndReason` 고정)과는 별개 문제다 — 그 항목은 "공유 인터페이스의 파라미터 타입이 정확한가"를 묻고, 이 항목은 "핸들러 내부 별칭 유지가 타당한가"를 묻는데, 후자는 그 자체로 결함이 없다(별칭이 무엇을 가리키든 내부 일관성만 지키면 되고, 실제로 지켜지고 있다).

## 요약

`@workflow/ai-end-reason` 패키지의 핵심 설계 — 값 도메인만 소유하고 의미·port 매핑·봉투 구조는 spec 에 남기는 경계, `AiAgentEndReason`/`InformationExtractorEndReason` 을 병합하지 않고 파생 유니온만 만드는 판단, `satisfies`+`Exclude` 양방향 잠금 — 은 코드·spec·테스트 세 층위에서 서로 일치하며 아키텍처적으로 건전하다. `lib/conversation/interaction-type-registry.ts` 신설도 "tsc 가 보는 소스로 컴파일타임 불변식을 옮긴다"는 근거가 실측(tsconfig exclude)과 정확히 맞아떨어지는 정당한 조치이고, `Record<WaitingInteractionType, boolean>` 파생은 이 부분집합 분류 문제에 대해 grep 가드보다 근본적으로 우월한 해법이다. 다만 구현 과정에서 두 가지 구체적 결함이 새로 생겼다 — ① `codebase/packages/README.md` 가 `ai-end-reason/README.md` 의 오배치 사본으로 남아 packages 워크스페이스 전체 인덱스로 오인될 수 있고, ② `packages-checks.yml` 의 `push.paths` 에 `ai-end-reason` 이 빠져 다른 4개 패키지와 CI 배선이 비대칭이다 — 둘 다 이 PR 이 스스로 강조한 "CI 배선 누락이 조용한 검증 소실을 만든다"는 원칙에 정확히 해당하는 사례라 반드시 짚어야 한다. 또한 `ResumableNodeHandler.endMultiTurnConversation` 이 AI Agent·IE 두 구현체를 명시적으로 공유한다면서도 `endReason` 타입을 `AiAgentEndReason` 하나로 고정해 둔 것은 이번 PR 이전부터 있던 latent 타입 부정확성이며, 지금 이 줄을 편집하는 김에 `ConversationEndReason` 으로 넓힐 기회가 있었으나 "동작 무변경" 스코프 규율 때문에 채택되지 않았다 — 급하지는 않으나 후속 과제로 남겨둘 가치가 있다.

## 위험도

LOW
