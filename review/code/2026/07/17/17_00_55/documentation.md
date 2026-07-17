# 문서화(Documentation) 리뷰 — `@workflow/ai-end-reason` 신설 + endReason drift 구조적 차단

## 발견사항

### [WARNING] `output-shape.ts` — 리팩터가 코드는 지우고 그 코드를 설명하던 JSDoc 은 남겨 dangling comment 발생

- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:100-121`
- 상세: E-4 리팩터가 로컬 `MULTI_TURN_INTERACTION_TYPES` 하드코딩 배열 선언을 삭제하고 `interaction-type-registry.ts` 의 import 로 대체했는데(diff 상 `-const MULTI_TURN_INTERACTION_TYPES: ReadonlySet<string> = new Set([...]);` 가 삭제되고 빈 줄로 치환), 그 선언 바로 위에 있던 JSDoc 블록(`/** Multi-turn marker values recognised ... Keep in sync with spec/conventions/interaction-type-registry.md — adding a new value here without updating the registry is rejected by the AST guard in lib/__tests__/interaction-type-exhaustiveness.test.ts. */`, L112-119)은 지우지 않고 그대로 남았다. 그 결과:
  1. 이 주석은 이제 **아무 선언도 설명하지 않는 dangling comment** 다 — 바로 아래(L120-121)는 빈 줄 두 개, 그다음(L122)은 전혀 다른 상수(`CONVERSATION_END_REASONS`)를 위한 별도 JSDoc 이 시작된다.
  2. 그 위(L100-111)에 있던 **진짜 `isConversationOutput` 함수의 JSDoc**("Detect whether outputData represents a multi-turn conversation result. Handles all four shapes we emit: ...")도 이 dangling 블록 때문에 실제 함수 선언(L135)과 24줄이나 떨어지게 됐다 — 대부분의 IDE hover·TSDoc 툴링은 "선언 바로 위 주석"만 그 선언의 문서로 인식하므로, 사실상 두 JSDoc 블록 모두 고아가 된 셈이다.
  3. 남은 dangling 주석의 **내용 자체도 이제 부정확**하다 — "adding a new value here without updating the registry is rejected by the AST guard in interaction-type-exhaustiveness.test.ts" 라고 주장하지만, 실측 결과(`REGISTRY_SITES` 배열, 아래 발견사항 참조) `output-shape.ts` 는 그 AST 가드의 `REGISTRY_SITES` 에 애초에 등록된 적이 없다 — 이 파일에 대해서는 그 가드가 적용된 적이 없는 주장이다.
- 제안: L112-119 의 dangling JSDoc 블록을 삭제한다. L100-111 의 `isConversationOutput` JSDoc 은 그 함수 선언(L135) 바로 위로 옮기거나, 최소한 그 사이에 낀 `CONVERSATION_END_REASONS`(및 관련 JSDoc, L122-133)를 함수보다 먼저 정의해야 한다면 함수 JSDoc 을 함수 바로 위로 재배치한다.

### [WARNING] plan 의 E-3b 조치("`output-shape.ts` 를 `REGISTRY_SITES` 에 추가")가 실제로는 구현되지 않았고, 문자 그대로 구현하면 오히려 테스트를 깨뜨린다 — 정정 누락

- 위치: `plan/in-progress/is-conversation-output-restructure.md:228-242` (E-3b) vs `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:39-43` (`REGISTRY_SITES`)
- 상세: plan 은 E-3b 를 이렇게 적어 두었다 — *"**조치**: `output-shape.ts` 를 `REGISTRY_SITES` 에 추가 — **1줄**. 가드가 이미 값별 grep 을 하므로 그것만으로 닫힌다."* (L240). 그런데 실측 결과:
  - 현재 `REGISTRY_SITES` (L39-43) 는 여전히 3개 파일(`use-execution-events.ts`/`apply-execution-snapshot.ts`/`use-result-detail-waiting.ts`) 뿐이고 `output-shape.ts` 는 없다. `git log -p`(`f0ef4a821`·`f17fc18dd`·`6b0b5cd45`) 전 구간을 확인해도 `output-shape.ts` 가 `REGISTRY_SITES` 에 추가된 적이 없다 — 마지막 정리 커밋(`f17fc18dd`, "리뷰 발견 배선 누락 3건 + 리뷰가 못 본 사본 2건 정리")도 이 항목을 다루지 않는다.
  - 더 중요하게는, **이 plan 자신의 다른 부분이 이미 이 조치가 틀렸음을 스스로 논증**하고 있다 — 신설된 `interaction-type-registry.ts` 의 JSDoc(`IS_MULTI_TURN_INTERACTION` 위)이 정확히 같은 문제(`MULTI_TURN_INTERACTION_TYPES` 가 `WaitingInteractionType` 4값의 **부분집합** 2값만 다룸)에 대해 *"기존 grep 가드는 '모든 값이 모든 사이트에 등장' 모델이라 부분집합에 쓰면 `form`·`buttons` 를 누락으로 오탐한다 (실측)"* 라고 명시한다. 실제로 `output-shape.ts` 전체를 grep 해도 `'form'`/`'buttons'` 리터럴은 전혀 없다(실측) — E-3b 를 문자 그대로 실행해 `output-shape.ts` 를 `REGISTRY_SITES` 에 추가했다면 이 파일에 대해 `form`/`buttons` 두 값이 즉시 "missing" 으로 잡혀 **테스트가 깨졌을 것**이다.
  - 실제로는 `MULTI_TURN_INTERACTION_TYPES` 가 이제 `interaction-type-registry.ts` 의 `IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean>` (exhaustive record — 신규 `WaitingInteractionType` 값 추가 시 컴파일 강제)에서 파생되므로, E-3b 가 막으려던 위험(신규 multi-turn interactionType 값이 이 목록에서 누락되는 것) 은 grep 가드보다 **더 강한 컴파일타임 메커니즘**으로 이미 해소돼 있다. 즉 결과적으로 안전하지만, 이 사실이 plan 에 정정으로 기록돼 있지 않다.
  - 같은 문서 안에서 E-3("5곳→6곳")·E-5("6곳→7곳")·E-7("§3.2 는 대상 아님") 은 실측 후 **"틀렸다 (실측 정정)"** 각주를 명시적으로 남겼는데, E-3b 만 이 정정 관행에서 빠졌다 — SUMMARY.md(`review/consistency/.../15_06_14/SUMMARY.md`)의 "✅ E-3b 신설 — REGISTRY_SITES 에 1줄 추가" 도 Phase 1(spec 검토) 시점의 계획 확인일 뿐 Phase 2 구현 결과와는 다르다.
- 제안: E-3b 본문에 "실측 정정" 각주를 추가해 (a) `output-shape.ts` 는 `REGISTRY_SITES` 에 추가하지 않았다는 사실, (b) 그 이유(문자 그대로 추가하면 부분집합 오탐으로 테스트가 깨진다는 것을 이 plan 의 다른 절이 이미 증명), (c) 대신 `IS_MULTI_TURN_INTERACTION` exhaustive record 파생이 동일한 위험을 컴파일타임에 더 강하게 막는다는 점을 명시한다. 정정 없이 이 checklist 항목이 남아 있으면, 다음 사람이 "미완료 항목"으로 오인해 문자 그대로 실행했다가 테스트를 깨뜨릴 위험이 있다.

### [WARNING] 신규 패키지 `README.md` 가 기존 4개 형제 패키지의 확립된 구조(Build/사용법/export 표)를 따르지 않음

- 위치: `codebase/packages/ai-end-reason/README.md` (전체 28줄)
- 상세: 실측 결과 기존 shared 패키지 4개(`expression-engine`/`node-summary`/`graph-warning-rules`/`chat-channel-validation`) 는 예외 없이 README 에 다음 섹션을 포함한다 — `## 빌드`(`npm run build`/`npm test` 등 명령), `## 사용` 또는 `## Exports`(실제 import 코드 예시), `## 주요 export`(심볼별 설명 표), `## boundary`/`## 의존성·boundary`. 신규 `ai-end-reason/README.md` 는 "왜 있나"/"무엇을 소유하나"/"왜 두 유니온이 다른가"/"값 추가 시" 4개 섹션만 갖고 있어 **rationale 은 상세하지만 실제 소비 방법(빌드 명령·import 예시·export 목록)이 전혀 없다** — `codebase/packages/ai-end-reason/src/index.ts` 의 JSDoc 에도 `@example`/사용 스니펫이 없어 패키지 어디에도 "어떻게 import 해서 쓰는가"를 보여주는 코드가 없다. `naming_collision.md`(이전 라운드 consistency-check)도 이 패키지 템플릿의 "빌드/테스트/린트 스크립트 존재" 만 확인했을 뿐 README 본문 구조 정합은 점검하지 않았다.
- 제안: `## 빌드`(`npm run build`/`npm test`) 와 `## 사용`(예: `import { AiAgentEndReason, InformationExtractorEndReason, ConversationEndReason, CONVERSATION_END_REASONS } from '@workflow/ai-end-reason';`) 섹션을 추가해 형제 패키지들과 구조를 맞춘다.

### [INFO] `packages-checks.yml` 헤더 주석의 패키지 열거가 신규 패키지 추가 후 stale — 이 PR 의 주제(열거 drift 제거)와 정확히 같은 종류의 미스

- 위치: `.github/workflows/packages-checks.yml:1-4`
- 상세: 파일 최상단 주석 `# 내부 backend-공유 패키지(@workflow/expression-engine·graph-warning-rules·node-summary·chat-channel-validation)의 lint/test/build CI 가드. 종전 이 4개는 전용 CI job 이 없어 ...` 는 이 워크플로가 원래 커버하던 4개 패키지를 이름으로 나열한다. `paths:`(2곳)·`matrix.pkg`(1곳)에는 `ai-end-reason` 이 정확히 추가됐지만 이 헤더 주석은 갱신되지 않아, 새로 이 파일을 여는 사람은 주석만 보고 "4개 패키지" 로 오인할 수 있다("종전 이 4개는 ..." 문장 자체는 워크플로 도입 시점의 역사적 서술이라 틀린 말은 아니지만, 괄호 안 열거는 "현재 무엇을 커버하는가" 로 읽히기 쉽다).
- 제안: 주석의 괄호 열거에 `ai-end-reason` 을 추가하거나(`@workflow/ai-end-reason·expression-engine·graph-warning-rules·node-summary·chat-channel-validation`), "종전 이 4개는" 문장을 "현재 5개 패키지는" 식으로 갱신.

### [INFO] `PROJECT.md` "공유 패키지" 행이 여전히 2/5 패키지만 열거 (기존 drift, 이번 PR 로 3/5 누락으로 악화)

- 위치: `PROJECT.md:14`
- 상세: `| 공유 패키지 | codebase/packages/expression-engine/, codebase/packages/node-summary/ | ... |` — `graph-warning-rules`·`chat-channel-validation` 은 이미 이전부터 누락돼 있었고(이번 PR 이전부터의 기존 drift), 이번에 `ai-end-reason` 이 추가되며 미열거 패키지가 2→3 개로 늘었다. 강제 규약은 없으나(§변경 유형 매핑 표에도 "신규 공유 패키지 추가 시 PROJECT.md 갱신" 행 없음), 이 저장소 아키텍처 개요의 "코드베이스 구조" 표라 신규 인프라를 추가한 PR 이 지나가는 김에 손보기 좋은 지점이다.
- 제안: 개별 나열 대신 `codebase/packages/*` (5개 패키지) 로 와일드카드화해, 패키지 추가마다 이 표를 갱신해야 하는 손 유지 목록 자체를 없애는 편이 이 PR 의 근본 철학(사본을 없애 drift 를 구조적으로 차단)과도 일치한다.

### [INFO] `information-extractor.md` §5.6 backlink 의 "의미 소유" 주장과 `timeout` 값의 spec 무기재 — 기존에 이미 알려진 자기모순의 연장

- 위치: `spec/4-nodes/3-ai/3-information-extractor.md:458` (신규 backlink) vs §1(라인 49 부근, "타임아웃 미발생" 서술) · §4.2 step 5(라인 174, "timeout 등을 만났을 때" 서술)
- 상세: 신규 backlink 문구는 "본 절[§5.6]은 각 값의 **의미·port 매핑**을 소유"한다고 선언하지만, 패키지가 보존하는 `InformationExtractorEndReason` 6값 중 `timeout` 은 §5.6("4 종")·§5.3(에러)·다른 어느 절에도 등장하지 않는다 — `timeout` 의 "의미"는 오직 패키지 `index.ts` 의 JSDoc(현재 생산자 없음, 죽은 값이지만 보존)에만 존재한다. 이는 이번 세션의 consistency-check(`cross_spec.md` INFO)가 이미 지적한 §1 vs §4.2 자기모순("타임아웃 미발생" vs "timeout 등을 만났을 때")과 같은 지점이며, plan 은 "필수는 아니다"로 명시적으로 보류했다. 이번 diff 가 그 지점 바로 옆(§5.6 제목 아래)에 "이 절이 의미를 소유한다" 는 문구를 새로 추가하면서, 소유권 주장과 실제 커버리지 사이의 간극이 살짝 더 도드라지게 됐다.
- 제안: 필수는 아님(팀이 이미 보류 결정). 다만 다음에 이 영역을 만질 때 §4.2 step 5 문구를 §1 과 정합시키거나, §5.6 backlink 문구를 "documented 4 종의 의미" 로 좁혀 `timeout`/`error`(별도 §5.3 소유)에 대한 과잉 주장을 피하면 더 정확해진다.

### [INFO] `interaction-type-registry.md` 재넘버링(구 §4 Rationale → 신 §5)으로 archived plan 의 옛 참조가 어긋남

- 위치: `spec/conventions/interaction-type-registry.md` (구 `## 4. Rationale` → 신 `## 5. Rationale`, 신규 `## 4. AI 노드 endReason` 삽입) vs `plan/complete/refactor/02-architecture.md:237`
- 상세: `plan/complete/refactor/02-architecture.md:237` 는 `"interaction-type-registry.md §4 Rationale 의 목적(shotgun surgery 차단)과 동일 방향"` 이라고 적어 뒀는데, 이번 재넘버링 이후 실제 §4 는 "AI 노드 endReason" 절이고 Rationale 은 §5 로 밀렸다. `plan/complete/` 는 CLAUDE.md 상 "1회성·역사 문서" 로 사후 유지보수 대상이 아니라 실질 영향은 낮지만, 다른 활성 코드/spec 참조(§1·§1.1·§1.2·§2·§2.1)는 전수 grep 결과 이번 재넘버링의 영향권 밖임을 확인했다 — 유일한 어긋난 참조가 바로 이 archived 파일 1건이다.
- 제안: 조치 불필요(archived 문서 정책). 참고로만 남김.

### [INFO] 신규 `import type { ... } from '@workflow/ai-end-reason';` 4곳 중 3곳이 후속 JSDoc 블록과 빈 줄 없이 바로 붙음 (스타일)

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:71` 부근, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:40` 부근, `codebase/backend/src/nodes/core/node-handler.interface.ts:3` 부근
- 상세: 세 파일 모두 기존에 "import 블록 → 빈 줄 → JSDoc 주석" 구조였는데, 신규 import 가 그 빈 줄 자리에 삽입되며 "import → (빈 줄 없이) JSDoc" 으로 바뀌었다. 기능에는 영향 없고 순수 가독성 문제.
- 제안: 사소함 — 각 삽입 뒤에 빈 줄 하나씩 추가하면 기존 스타일과 정합.

## 장점 (참고)

- 신규 패키지 `src/index.ts` 의 JSDoc 은 "왜 패키지인가/SoT 경계/각 타입의 의도적 비대칭(`timeout` 보존 이유 포함)"까지 정확하고 상세하게 서술한다.
- `node-handler.interface.ts` 의 `endMultiTurnConversation` JSDoc 확장은 `AiAgentEndReason` 고정이 "두 구현체의 교집합만 커버" 한다는 실제 타입-안전성 공백을 정확히 서술한다 — 실측(`ai-turn-orchestrator.service.ts:914,927,996`)으로 "엔진 호출부는 `user_ended`/`error` 만 넘긴다" 는 주장이 사실과 일치함을 확인했다.
- `spec/4-nodes/3-ai/1-ai-agent.md`·`3-information-extractor.md`·`spec/conventions/interaction-type-registry.md` 의 backlink 및 §4 신설은 상대경로·앵커 모두 실제 파일 구조와 일치하며(`../../../codebase/packages/ai-end-reason/` 등 실측 확인), 기존 "3중 가드가 영구히 차단한다" 는 과장된 보증을 실측 근거와 함께 스스로 정정한 것은 이 저장소에서 드물게 보이는 좋은 관행이다.
- `interaction-type-exhaustiveness.test.ts` 의 신규 "Known limitation" 주석(grep 이 backtick 인용도 매칭한다는 한계 고지)도 같은 이유로 좋은 관행이다.

## 요약

신규 공유 패키지의 rationale 문서(`index.ts` JSDoc, 3개 spec 문서 backlink)는 정확성·상호링크·자기정정 관행 면에서 이 저장소 평균 이상이며 실측으로 교차검증한 결과 모두 사실과 일치했다. 다만 구현 단계에서 두 가지 실질적 문서-코드 불일치가 새로 생겼다 — (1) `output-shape.ts` 리팩터가 코드 선언은 지우고 그 JSDoc 은 남겨 dangling comment 를 만들었고 그 내용도 이제 부정확하며, (2) plan 문서의 E-3b 조치 항목이 실제로는(그리고 옳게도) 구현되지 않았는데도 그 사실이 정정되지 않아 문자 그대로 따르면 테스트를 깨뜨릴 수 있는 상태로 남아 있다. 신규 패키지 README 는 rationale 은 상세하지만 기존 4개 형제 패키지가 예외 없이 갖는 빌드/사용법/export 섹션이 없어 실사용자 온보딩에 약하다. 나머지는 CI 주석·`PROJECT.md` 열거·archived plan 참조 등 낮은 영향의 INFO 성 열거 drift다.

## 위험도

MEDIUM
