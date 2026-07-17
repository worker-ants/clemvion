# 아키텍처(Architecture) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + `isConversationOutput` drift 차단

## 발견사항

- **[WARNING]** `ResumableNodeHandler` 인터페이스가 두 구현체의 이질적 종결값 도메인을 하나의 구체 타입으로 대표시킴 (ISP/LSP 경계 불명확)
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:402-453` (특히 439-452 `endMultiTurnConversation`), 실사용: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:914,927,994-996`
  - 상세: `ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 파라미터가 이번 PR 로 `AiAgentEndReason`(4값)으로 명명됐지만, 실제 구현체 중 하나인 `InformationExtractorHandler` 는 다른 6값 도메인(`InformationExtractorEndReason`, `type EndReason = InformationExtractorEndReason` alias)을 받는다. 두 클래스 모두 `implements NodeHandler` 만 선언하고 `ResumableNodeHandler` 는 선언하지 않아(`ai-agent.handler.ts:40`, `information-extractor.handler.ts:193`), engine 은 `isResumableNodeHandler` 런타임 duck-typing 가드로만 이를 좁힌다(구조적 타이핑). 그 결과 tsc 는 두 구현체의 파라미터 도메인 불일치를 전혀 검사하지 않는다 (method 파라미터 bivariance). 실측 확인 결과 이 제네릭 인터페이스를 통해 실제로 전달되는 값은 두 호출부(`ai-turn-orchestrator.service.ts:914` 의 `'user_ended'`, `:996` 의 `'error'`) 뿐이라 지금은 안전하지만, 이는 **타입이 보장하는 안전이 아니라 "호출 관행이 우연히 지키는" 안전**이다 — PR 자신의 JSDoc(node-handler.interface.ts:427-437)이 이 사실을 정확히 인지하고 제네릭화(`ResumableNodeHandler<TEndReason>`)를 해법으로 제시하지만 실행은 이번 범위에서 제외했다. 부가적으로, 범용 인터페이스의 파라미터 타입 이름이 구체 구현체 하나(`AiAgentEndReason`)를 그대로 지칭하는 것도 추상화 방향이 살짝 역전된 신호다 — 인터페이스(정책)가 특정 구현(세부사항)의 이름을 알고 있다.
  - 제안: 이번 PR 은 리터럴 유니온에 이름을 붙였을 뿐 위험도를 바꾸지 않았으므로 즉시 수정을 요구하진 않으나, JSDoc 에만 남은 이 부채가 plan 이 `complete/` 로 이동한 뒤 고아가 되지 않도록 별도 backlog 항목으로 등록 권장. 후속 조치 시 `ResumableNodeHandler<TEndReason extends string = AiAgentEndReason>` 제네릭화, 또는 최소한 파라미터 타입명을 구현체 중립적 이름(예: `PolymorphicEndReason` = 실제 교집합)으로 변경.

- **[WARNING]** `isConversationOutput` 의 heuristic OR-chain 구조 자체는 이번 PR 범위에서 의도적으로 미해결 — "값 domain drift" 만 차단, "shape 판정 로직" 은 여전히 무가드
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:135-194` (`isConversationOutput`)
  - 상세: 이 PR 의 트리거가 바로 이전 PR #961 아키텍처 리뷰의 지적 — "`isConversationOutput` 의 반복적 heuristic OR-체인 확장이 이번 회귀 계열의 반복 진원지" — 이다(`plan/in-progress/is-conversation-output-restructure.md` 서두). 이번 PR 은 그 OR-chain 이 참조하는 두 "값 목록"(`CONVERSATION_END_REASONS`, `MULTI_TURN_INTERACTION_TYPES`) 의 drift 는 컴파일 타임으로 완전히 차단했다(전자는 패키지 `satisfies`+`Exclude`, 후자는 `Record<WaitingInteractionType, boolean>` exhaustiveness) — 이 부분은 훌륭하다. 그러나 OR-chain **구조 자체**(4개 이질적 shape 후보를 `unknown` 입력에 대해 순차 판정하는 방식, `output-shape.ts:188-193`)는 변경하지 않았다 — plan 이 명시적으로 "이 함수는 대화 UI 전체의 게이트라 건드리는 순간 회귀 위험이 크고, 이번 목표는 drift 차단이지 리팩토링이 아니다" 라고 범위를 좁혔다. 즉 "이미 알려진 차원(dimension) 안에서의 값 누락"은 이제 막히지만, "새로운 output shape 변형이 추가될 때 OR-chain 에 분기 자체를 빠뜨리는" 유형의 회귀에는 여전히 무방비다 — 이 축은 입력이 `unknown` 이라 타입 시스템만으로는 근본 차단이 불가능하고 discriminated union 기반 재설계가 필요한 영역이다.
  - 제안: 의도된 범위 축소이므로 이번 PR 을 막을 사유는 아니다. 다만 "PR #961 이 지적한 문제를 이번 PR 이 완전히 해소했다"는 인상을 남기지 않도록, 후속 backlog(가칭 "isConversationOutput 구조 리팩토링") 를 명시적으로 등록해 추적이 끊기지 않게 할 것을 권장.

- **[WARNING]** `output-shape.ts` 에 리팩토링 잔재로 남은 오도성(misleading) 고아 주석
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:112-119`
  - 상세: `MULTI_TURN_INTERACTION_TYPES` 선언이 `interaction-type-registry.ts` 로 이동했는데, 그 상수를 설명하던 JSDoc 블록("Keep in sync with `spec/conventions/interaction-type-registry.md` — adding a new value here without updating the registry is rejected by the AST guard …")은 삭제되지 않고 빈 줄 2개와 함께 그대로 남아, 바로 다음에 오는 `CONVERSATION_END_REASONS` 상수(122번째 줄)의 머리에 붙어버렸다. 더 나쁜 건, 이 잔여 주석이 서술하는 보증("AST 가드가 값 추가를 거부한다")은 정확히 이 PR 자신의 감사(plan §"추가 발견")가 실측으로 반증한 옛 `ReadonlyArray<T> = VALUES` 메커니즘에 대한 서술이라 이중으로 부정확한 상태로 남는다.
  - 제안: 해당 고아 블록 삭제. `MULTI_TURN_INTERACTION_TYPES` 의 SoT 설명은 이미 `interaction-type-registry.ts` 에 있으므로 여기서는 import 위 한 줄 backlink 정도면 충분.

- **[INFO]** CI/로컬 빌드 배선의 "내부 패키지 목록"이 여전히 손 유지 사본 — 이번 PR 이 겨냥한 것과 동일한 drift 계열이 메타 레벨(빌드 인프라)에 잔존
  - 위치: `.claude/test-stages.sh:25-32` (`INTERNAL_PACKAGES`), `.github/workflows/packages-checks.yml` (`matrix.pkg` + `on.pull_request.paths` + `on.push.paths`)
  - 상세: 이 두 파일은 사실상 같은 정보("이 저장소의 내부 공유 패키지 집합")를 3곳(스크립트 배열 1 + workflow paths 2 + workflow matrix 1)에 손으로 중복 유지한다 — 이는 이번 PR 이 `endReason` 에 대해 없애려 한 것과 정확히 같은 클래스의 구조다. `pnpm-workspace.yaml` 은 이미 `codebase/packages/*` glob 을 갖고 있으므로, `pnpm -r --filter "./codebase/packages/*" list --depth -1 --json` 류로 목록을 파생시키는 것도 원리적으로 가능하다. 실제로 이 세션에서 `test-stages.sh` 배선(7번째 처)이 최초 구현에서 누락돼 신규 패키지의 lint/unit/build 가 로컬 wrapper 에서 조용히 한 번도 실행되지 않은 사고가 있었다(plan §E-5 정정 각주) — 정확히 "손 유지 목록"류 구조가 만드는 사고 패턴이다.
  - 제안: 이번 PR 범위는 아니며 현재는 (뒤늦게나마) 정확히 배선됐다. 다만 향후 백로그로 "내부 패키지 목록 자동 파생" 항목을 등록해 재발을 구조적으로 차단할 것을 제안.

- **[INFO]** `interaction-type-registry.ts` 가 "값 목록 SoT" 와 "파생 비즈니스 분류" 두 책임을 겸함
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (특히 `IS_MULTI_TURN_INTERACTION`/`MULTI_TURN_INTERACTION_TYPES`, 새 파일 하단부)
  - 상세: 파일 자체 JSDoc(파일 상단)은 스스로를 "값 목록 + 타입 일치 컴파일 단언" 모듈로 규정하지만, `IS_MULTI_TURN_INTERACTION`/`MULTI_TURN_INTERACTION_TYPES` 는 그 위에 "이 interactionType 값이 multi-turn 대화인가" 라는 도메인 판단(비즈니스 분류)을 얹는다. 지금은 `Record<WaitingInteractionType, boolean>` 의 exhaustiveness 를 이용해 새 값 추가 시 분류를 컴파일 타임에 강제하는 정당한 설계이고 파일도 작아 문제는 없다. 다만 향후 `interactionType` 별 파생 분류(예: `IS_FORM_LIKE`, `REQUIRES_POLLING`)가 늘면 이 파일이 서로 무관한 비즈니스 규칙들의 저장소로 비대해질 소지가 있다.
  - 제안: 지금은 조치 불필요. 파생 분류가 2개를 넘어서면 "값 SoT" 와 "분류 규칙" 을 별 파일로 분리하는 것을 고려.

## 정합성 확인 (문제 아님 — 참고용 positive 확인)

- **패키지 경계 설계가 명확하다**: `@workflow/ai-end-reason` 은 값 도메인만 소유하고, 의미·port 매핑은 spec(`1-ai-agent.md` §7, `3-information-extractor.md` §5.6)에, 출력 봉투 구조는 `node-output.md` 에 남긴다는 경계를 README/JSDoc/spec backlink 3곳에서 일관되게 명문화했다. 초안이 제안했던 광범위 이름(`node-output-contract`)을 `interaction-type-registry.md` §4 consistency-check 과정에서 스스로 기각하고 `ai-end-reason` 으로 좁힌 것도 SRP 관점에서 올바른 자기 교정이다.
- **의존성 그래프가 깨끗하다**: `@workflow/ai-end-reason` 은 런타임/컴파일 의존성이 전무한 순수 리프(leaf) 패키지로, backend·frontend 양쪽에서만 소비되고 그 자신은 아무것도 import 하지 않는다(shared-kernel 패턴). 실측 확인 결과 `interaction-type-registry.ts` → `execution-store.ts`/`conversation-utils.ts` → (zustand/rag-types) 경로에도, `output-shape.ts` → `interaction-type-registry.ts` 경로에도 순환 참조가 없다. `components/` → `lib/` 방향 import 규칙(파일 내 기존 주석이 명시)도 이번 신규 import 둘 다 지킨다.
- **두 노드의 종결값 유니온을 강제로 병합하지 않고 파생 유니온(`ConversationEndReason = AiAgentEndReason | InformationExtractorEndReason`)만 추가한 설계**는 각 노드의 종결 의미를 흐리지 않으면서 소비자 요구(전체 집합)를 충족하는 적절한 추상화 레벨 선택이다. 향후 세 번째 multi-turn 노드가 추가돼도 같은 패턴(새 유니온 추가 + 파생 유니온에 합류)으로 확장 가능하며, `satisfies`+`Exclude` 이중 잠금이 그 확장 시점에도 배열 갱신을 컴파일 타임에 강제한다 — 확장성 관점에서 견고하다.
- **패키지 내부 템플릿(package.json/tsconfig.json/eslint.config.mjs/README 구성)이 기존 4개 shared 패키지(`graph-warning-rules` 등)와 구조적으로 동일**함을 실측 확인 — 신규 패키지 도입 시의 일관성 비용이 낮다.
- **`isConversationOutput` 자체의 조건·동작은 무변경**(SoT 만 교체)이라는 plan 의 주장은 diff 와 일치 — 리팩토링 위험을 의도적으로 배제한 최소 변경 범위 판단은 대화 UI 게이트라는 blast radius 를 고려하면 합리적이다.

## 요약

이 변경은 교과서적인 Single-Source-of-Truth 추출이다 — backend 가 선언하고 frontend 가 손으로 베껴 쓰던 `endReason` 열거값이 세 번째 drift(대화 미리보기 소실)를 내기 전에, 의존성 없는 순수 패키지(`@workflow/ai-end-reason`)로 값 도메인을 이관하고 `satisfies`+`Exclude` 양방향 잠금으로 drift 를 구조적으로 불가능하게 만들었다. 패키지 경계(값 도메인만 소유, 의미/봉투 구조는 spec 이 소유)가 README·spec backlink·consistency-check 과정에서 일관되게 지켜졌고, 의존성 그래프에 순환이 없으며, 기존 4개 shared 패키지의 템플릿·명명 규칙을 그대로 따라 저장소 전체의 아키텍처 일관성을 해치지 않는다. 가장 눈에 띄는 잔여 리스크 둘은 모두 "이번 PR 이 새로 만든 문제"가 아니라 "이미 있었고, 이번 PR 이 정직하게 문서화했지만 의도적으로 범위 밖에 둔" 것들이다 — (1) `ResumableNodeHandler` 인터페이스가 두 구현체의 서로 다른 종결값 도메인을 하나의 구체 타입 이름으로 대표시키는 ISP 경계 불명확(현재는 호출 관행이 지키는 안전), (2) 이전 PR #961 이 지적한 `isConversationOutput` 의 heuristic OR-chain 구조 자체(값이 아니라 shape 판정 로직)는 이번에도 손대지 않음. 둘 다 JSDoc/plan 에 잘 기록돼 있으나 추적 가능한 backlog 항목으로 등록돼 있지 않아, 이 plan 이 `complete/` 로 이동하면 통찰이 고아가 될 위험이 있다. 추가로 리팩토링 잔재인 오도성 고아 주석 하나(`output-shape.ts:112-119`)를 발견했다.

## 위험도

LOW
