# 부작용(Side Effect) Review — `@workflow/ai-end-reason` (main..HEAD)

## 범위 안내

`prompt_file` 이 이번 배치에 지정한 "리뷰 대상 파일"은 실제로는 7개뿐이며 전부
문서류다 — `review/consistency/2026/07/17/15_06_14/{meta.json,naming_collision.md,
plan_coherence.md,rationale_continuity.md}` (이전 consistency-check 세션 산출물
커밋) + `spec/4-nodes/3-ai/{1-ai-agent,3-information-extractor}.md` ·
`spec/conventions/interaction-type-registry.md` (backlink 각주 추가). 오케스트레이터
지시의 중점 파급 1~5(backend 타입 교체·`MULTI_TURN_INTERACTION_TYPES`·frontend
화이트리스트·Dockerfile/CI 배선·신규 registry 모듈)는 이 7개 파일의 diff 안에는
없다 — 해당 실제 코드는 이전 리뷰 라운드(`review/code/2026/07/17/13_28_39/` 등)에서
이미 다뤄졌을 가능성이 높다.

다만 지시된 중점 파급이 이번 PR(`main...HEAD`) 전체의 부작용 판단에 필수적이므로,
worktree 실물 코드를 직접 대조·실행해 아래 1~5 를 모두 실측 검증했다(diff 문자열만
읽지 않고 `git diff main...HEAD`, 관련 스크립트 실행 등으로 재현). 그 결과 **문서
7개 자체의 부작용은 전무**하지만, 배경으로 지시된 배선 축(4번)에서 **실제로 재현되는
CI 하드 실패 1건 + 배선 누락 1건 + 오배치 파일 1건**을 발견했다 — 아래 발견사항
1~3.

## 발견사항

- **[WARNING] `docker-compose.e2e.yml` — `ai-end-reason` node_modules 볼륨 마스킹 누락 → e2e `config-guard` CI 하드 실패 (실측 재현)**
  - 위치: `docker-compose.e2e.yml` `playwright-runner.volumes` (L250-261), 가드 스크립트 `scripts/check-e2e-playwright-config.py`
  - 상세: `codebase/frontend/package.json`(L36)이 `@workflow/ai-end-reason` 을 신규 direct dependency 로 추가했고, `codebase/frontend/Dockerfile.playwright-e2e` 의 COPY 목록에는 정상적으로 반영됐다. 그러나 `docker-compose.e2e.yml` 의 `playwright-runner` 서비스 volumes 마스킹 목록(호스트 node_modules 가 컨테이너 설치본을 덮지 않게 막는 anonymous volume)에는 기존 4개 패키지(`expression-engine`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`)만 있고 신규 5번째 `ai-end-reason` 이 빠져 있다. 이 정합은 `scripts/check-e2e-playwright-config.py` 가 강제하는데, 이 워크트리에서 직접 실행해 재현했다:
    ```
    $ python3 scripts/check-e2e-playwright-config.py
    [e2e-config-guard] FAIL: frontend @workflow closure ≠ compose volume-mask set.
        frontend @workflow closure = ['ai-end-reason', 'chat-channel-validation', 'expression-engine', 'graph-warning-rules', 'node-summary']
        compose mask packages      = ['chat-channel-validation', 'expression-engine', 'graph-warning-rules', 'node-summary']
        missing from compose masks: ['ai-end-reason']; extra in compose masks: —
    1 violation(s).
    ```
    `.github/workflows/e2e.yml` 의 `config-guard` job 이 이 스크립트를 실행하고, frontend/backend e2e job 들이 `needs: config-guard` 로 그 결과에 의존한다 — 즉 현재 상태로는 e2e CI 게이트가 하드 실패(exit 1)한다. 오케스트레이터가 실측했다는 "backend·frontend Docker 빌드 성공"은 `docker build` 만으로는 이 별도 게이트(`config-guard` job, python 스크립트)를 통과하지 못하므로 그 검증 범위 밖이다.
  - 제안: `docker-compose.e2e.yml` L257-261 volumes 블록에 `- /app/codebase/packages/ai-end-reason/node_modules` 1줄 추가.

- **[WARNING] `.github/workflows/packages-checks.yml` — `push` 트리거 paths 목록에 `ai-end-reason` 누락 (`pull_request` 트리거와 비대칭)**
  - 위치: `.github/workflows/packages-checks.yml` L7-25
  - 상세: `on.pull_request.paths`(L10)와 `matrix.pkg`(L42)에는 `ai-end-reason`/`@workflow/ai-end-reason` 이 정상 추가됐다. 그러나 `on.push.branches:[main].paths`(L20-24) 목록에는 여전히 기존 4개 패키지만 있고 신규 패키지 경로가 빠져 있다 — PR 리뷰 시점 lint/test/build 는 매트릭스로 정상 수행되지만, `main` 브랜치에 대해 `ai-end-reason/**` 경로만 변경되는 push(예: 이 파일 자체를 건드리지 않는 후속 hotfix 커밋)는 이 워크플로를 트리거하지 않는다 — 다른 4개 패키지와 다른 취급.
  - 제안: L20-24 에도 `- 'codebase/packages/ai-end-reason/**'` 를 추가해 5개 패키지 대칭을 맞춘다.

- **[WARNING] `codebase/packages/README.md` — `ai-end-reason/README.md` 와 byte 단위로 완전히 동일한 오배치 파일 신규 생성**
  - 위치: `codebase/packages/README.md` (신규 파일, 28 lines)
  - 상세: `diff codebase/packages/README.md codebase/packages/ai-end-reason/README.md` 실행 결과 두 파일이 **완전히 동일**하다. `git log -- codebase/packages/README.md` 로 확인한 결과 `main` 에는 존재하지 않던 파일이며, 내용은 "# @workflow/ai-end-reason" 로 시작해 그 패키지 전용 설명(SoT 경계·두 유니온이 다른 이유·값 추가 절차)이다 — `codebase/packages/` 전체의 인덱스 문서가 아니라 한 패키지의 README 가 부모 디렉터리에 그대로 잘못 복제된 것으로 보인다(기존 4개 패키지는 이런 부모-디렉터리 README 를 만든 적이 없다). 파일시스템 부작용(예상치 못한 파일 생성) 관점의 명백한 사례다. 방치하면 향후 실제 "packages 전체 인덱스" 문서를 작성할 때 파일명이 선점돼 있어 혼란을 준다.
  - 제안: `codebase/packages/README.md` 삭제. packages 전체 인덱스가 실제로 필요하면 별도 내용으로 새로 작성.

- **[INFO] backend 타입 교체 5곳 — 실측 결과 리터럴 유니온과 값 집합 완전 동일, 계약 파급처는 이미 함께 치환됨**
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts`(`ResumableNodeHandler.endMultiTurnConversation`), `ai-turn-executor.ts` 의 동일 메서드 + `buildMultiTurnFinalOutput` + `multiTurnPortForEndReason`(3곳), `information-extractor.handler.ts` 의 로컬 `type EndReason`
  - 상세: `codebase/packages/ai-end-reason/src/index.ts` 를 직접 대조 — `AiAgentEndReason = 'user_ended'|'max_turns'|'condition'|'error'`(4값), `InformationExtractorEndReason = 'completed'|'max_turns'|'user_ended'|'timeout'|'max_retries'|'error'`(6값) 는 치환 전 인라인 리터럴 유니온과 **값 집합이 정확히 일치**한다(순서만 다름 — 유니온은 순서 무관). `ResumableNodeHandler` 를 구현하는 클래스는 저장소 전체에서 `AiTurnExecutor`·`InformationExtractorHandler` 단 둘뿐임을 grep 으로 확인했고, 이 두 곳 모두 같은 PR 에서 함께 치환돼 인터페이스와 구현체가 어긋나는 순간이 없다. 호출부(`ai-turn-orchestrator.service.ts`)는 리터럴 문자열로 호출해 타입 변경의 영향을 받지 않는다. 시그니처 **텍스트**는 바뀌었지만 해석된 타입·런타임 동작은 무변경 — 순수 리팩토링으로 판정.

- **[INFO] `MULTI_TURN_INTERACTION_TYPES` Record 파생 치환 — 실측 결과 기존 `Set(["ai_conversation","ai_form_render"])` 와 동일 멤버십**
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`(신설) `IS_MULTI_TURN_INTERACTION`/`MULTI_TURN_INTERACTION_TYPES`, 소비처 `output-shape.ts`
  - 상세: `IS_MULTI_TURN_INTERACTION` 객체 리터럴의 key 선언 순서는 `form, buttons, ai_conversation, ai_form_render`, 값은 각각 `false,false,true,true`다. `Object.entries` 는 비-정수형 문자열 key 에 대해 삽입 순서를 보존하므로 `.filter(([,v]) => v).map(([k]) => k)` 결과는 정확히 `["ai_conversation","ai_form_render"]` — `new Set()` 로 감싸면 순서 자체가 무의미해지므로 이전 하드코딩 `Set` 과 멤버십이 완전히 같다. `isConversationOutput` 의 이 축 판정은 동작 변화 없음.

- **[INFO] `CONVERSATION_END_REASONS` 6→7값(+`timeout`) 확장 — 현재 코드에서 `'timeout'` producer 없어 실측상 무해, 단 forward-compat 성격의 잠재 변화점으로 기록**
  - 위치: `output-shape.ts` `isConversationOutput` 의 `looksLikeConversationEnd` 분기 (`hasResultMessages && CONVERSATION_END_REASONS.has(endReason)`)
  - 상세: `information-extractor.handler.ts` 전체를 grep 한 결과 `'timeout'` 문자열이 `endReason` 으로 실제 emit 되는 코드 경로가 0건이다 (패키지 주석도 "`portForEndReason` 에 case 없어 default → `error`" 로 동일하게 명시). 따라서 `timeout` 이 세트에 새로 포함돼도 그 값을 실제로 만드는 코드가 없는 한 `looksLikeConversationEnd` 가 이 값으로 새로 `true` 가 될 수 없다 — "무해" 주장은 실측으로 확인됨. 다만 이는 **현재 코드 기준**의 무해함이며, 향후 누군가 IE 의 dormant `timeout` 값을 실제로 되살려 emit 하게 만들면 `isConversationOutput` 이 자동으로 그 케이스를 대화 종결로 인식하게 된다 — 패키지가 명시적으로 의도한 forward-compatibility 이므로 이번 PR 의 결함은 아니나, 향후 `timeout` producer 를 추가하는 PR 리뷰 시 이 연쇄를 인지하도록 참고 기록.

- **[INFO] 신규 모듈 `lib/conversation/interaction-type-registry.ts` — 순환 의존 없음 (실측)**
  - 위치: 신설 파일의 import (`import type { WaitingInteractionType } from "@/lib/stores/execution-store"`, `import type { ConversationTurnSource } from "./conversation-utils"`)
  - 상세: 두 import 모두 `import type`(type-only)이라 컴파일 후 런타임 import 그래프에서 완전히 소거된다. `git diff --stat main...HEAD -- codebase/frontend/src/lib/stores/execution-store.ts codebase/frontend/src/lib/conversation/conversation-utils.ts` 결과가 비어 있어(무변경) 두 파일이 신규 모듈을 되돌아 import 하도록 바뀐 바 없음을 확인했다. `conversation-utils.ts → execution-store.ts`(기존, type-only) 의존 위에 신규 모듈이 얹히는 다이아몬드 구조일 뿐 사이클이 아니다. 런타임 값 export 는 상수 배열 2개 + `Record` 리터럴 1개뿐이라 번들 크기 영향도 무시할 수준.

- **[INFO] spec 문서 3곳의 신규 backlink — 상대경로·앵커 모두 실제 파일 위치와 정합 확인 (부작용 없음)**
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md`·`3-information-extractor.md` 의 `[`@workflow/ai-end-reason`](../../../codebase/packages/ai-end-reason/)`, `spec/conventions/interaction-type-registry.md` 자기참조 앵커 `#4-ai-노드-endreason--패키지가-sot-가드-비대상`
  - 상세: 상대경로 depth(`spec/4-nodes/3-ai/*.md` 기준 `../../../` = repo root, `spec/conventions/*.md` 기준 `../../` = repo root)를 직접 계산해 실제 `codebase/packages/ai-end-reason/` 위치와 일치함을 확인했고, GitHub 스타일 헤딩 슬러그 규칙(소문자화·word-char 외 제거·공백→hyphen, em-dash 제거 시 양옆 공백이 남아 `--` 이중 hyphen 발생)을 수동 적용한 결과도 실제 추가된 헤딩("## 4. AI 노드 `endReason` — **패키지가 SoT** (가드 비대상)")과 정확히 일치한다. 깨진 링크를 남기는 부작용 없음.

- **문서 7개 자체(이번 배치의 실제 diff) — 부작용 없음**
  - `review/consistency/2026/07/17/15_06_14/{meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}` 는 이전 consistency-check 세션 산출물을 그대로 커밋하는 신규 read-only 문서, `spec/4-nodes/3-ai/{1-ai-agent,3-information-extractor}.md`·`spec/conventions/interaction-type-registry.md` 는 산문에 backlink/rationale 각주를 추가하는 수 줄~수십 줄 편집이다. 전역 변수·함수 시그니처·공개 API·env var·네트워크 호출·이벤트/콜백 어느 축으로도 부작용을 일으키지 않는다. 참고: `naming_collision.md`/`plan_coherence.md`/`rationale_continuity.md` 는 패키지를 옛 초안 이름 `@workflow/node-output-contract` 로 지칭하지만 실제 구현은 `@workflow/ai-end-reason` 으로 개명돼 있다 — "부작용"은 아니고 이 저장소의 관례(리뷰 산출물은 작성 시점 스냅샷으로 동결)상 정상이나, 다음 사람이 두 이름을 혼동하지 않도록 참고.

## 요약

이번 배치의 `prompt_file` 이 지정한 실제 diff(consistency-check 산출물 4개 + spec 문서 3개)는 순수 문서 변경으로 부작용이 전무하다. 그러나 오케스트레이터가 지시한 중점 파급 1~5(main..HEAD 전체 범위)를 실물 코드로 직접 검증한 결과, **핵심 로직(backend 타입 교체·`MULTI_TURN_INTERACTION_TYPES`·`CONVERSATION_END_REASONS` 확장·신규 frontend 모듈)은 실측상 동작 무변경으로 안전**하다는 점은 확인됐지만, **배선 축(중점 4)에서 실제로 재현되는 CI 하드 실패 1건(`docker-compose.e2e.yml` 마스킹 누락 → `config-guard` job fail, `python3 scripts/check-e2e-playwright-config.py` 로 직접 재현)과 CI 트리거 비대칭 1건(`packages-checks.yml` push paths), 그리고 오배치 파일 1건(`codebase/packages/README.md` 이 `ai-end-reason/README.md` 와 완전 중복)**을 발견했다. 세 건 모두 프로덕션 런타임 동작에는 영향이 없지만, 첫 번째는 병합 전 CI 게이트를 실제로 막는 결함이라 반드시 수정이 필요하다.

## 위험도

MEDIUM
