# 신규 식별자 충돌 검토 — `spec/4-nodes/3-ai/` (--impl-done, diff-base=origin/main)

## 검토 방법

prompt 에 첨부된 `spec/4-nodes/3-ai/` 코퍼스 스냅샷이 아니라, HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e`)
를 절대경로로 직접 확인했다. `git diff origin/main -- spec/4-nodes/3-ai/` 로 실제
변경분을 먼저 확정한 뒤(2 파일, 각 2줄), 그 diff 가 참조하는 신규 코드
(`codebase/packages/ai-end-reason/`, `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`
등)와 spec 산문(`spec/conventions/interaction-type-registry.md`)까지 넓혀 신규
식별자 전수를 전역 grep 으로 검증했다.

**범위 확인**: `scope=spec/4-nodes/3-ai/` 기준 실제 diff 는
`spec/4-nodes/3-ai/1-ai-agent.md` §7 상단과 `spec/4-nodes/3-ai/3-information-extractor.md`
§5.6 상단에 각각 2줄씩 추가된 `endReason` SoT backlink 문구뿐이다(도입 배경인
`@workflow/ai-end-reason` 패키지 신설·`interaction-type-registry.ts` 신설 자체는
선행 커밋 `f0ef4a821`/`9df2bb42f`/`b04ddc258`/`a8c946056` 에서 이미 이뤄졌고
`plan/complete/is-conversation-output-restructure.md` 로 완료 처리됨). 아래
발견사항은 이 diff 가 가리키는 신규 식별자 전체(패키지명·타입명·상수명·신규
소스 파일)를 대상으로 한다.

## 발견사항

CRITICAL·WARNING 등급 발견 없음. INFO 2건.

- **[INFO] `CONVERSATION_END_REASONS` — 패키지 export 와 frontend 소비 파일에서 동일 이름·다른 타입으로 재선언 (alias 로 완화됨)**
  - target 신규 식별자: `@workflow/ai-end-reason` 의 `export const CONVERSATION_END_REASONS`(`readonly [...] as const`, `codebase/packages/ai-end-reason/src/index.ts:80`)
  - 기존/인접 사용처: `codebase/frontend/src/components/editor/run-results/output-shape.ts:109` — 동일한 이름 `CONVERSATION_END_REASONS` 를 **`ReadonlySet<string>`** 타입의 module-local `const` 로 재선언(패키지 배열을 `new Set(...)` 로 감싼 파생값).
  - 상세: 두 선언이 이름은 같지만 타입이 다르다(원본 `readonly string[]` vs 파생 `ReadonlySet<string>`). 다만 (a) import 시 `CONVERSATION_END_REASONS as PACKAGE_CONVERSATION_END_REASONS` 로 명시적 alias 되어 같은 파일 안에서 두 이름이 동시에 존재하는 순간이 없고, (b) 바로 위에 "패키지가 값 도메인 SoT, 이 상수는 그 파생 `Set`" 이라는 JSDoc 이 붙어 있어(L100-111), 해당 파일만 보면 혼동 소지가 낮다. 다만 파일 밖에서 두 심볼을 부분 컨텍스트만 보고 대조하는 경우(예: 코드리뷰 diff 조각) "이름이 같으니 같은 값이겠지"로 오독할 여지는 남는다 — 원본은 `Array`, 파생은 `Set` 이라는 자료구조 차이까지는 이름만으로 드러나지 않는다.
  - 제안: 현행 유지로 충분(진짜 충돌은 아님). 굳이 더 낮추고 싶다면 로컬 변수명을 `CONVERSATION_END_REASON_SET` 등으로 바꿔 자료구조 차이를 이름에도 반영할 수 있으나, alias import + 인접 JSDoc 조합이 이미 이 저장소의 "심볼을 shared 패키지로 승격" 표준 패턴(다른 4개 `@workflow/*` 패키지도 동일 방식)과 일치하므로 필수 조치는 아니다.

- **[INFO — 회귀 없음 확인] 직전 라운드 WARNING(`@workflow/node-output-contract` 명명 충돌)이 최종 구현에서 해소됨**
  - 배경: `review/consistency/2026/07/17/15_06_14/naming_collision.md` (plan 단계 검토)는 초안 패키지명 `@workflow/node-output-contract` 가 기존 `spec/conventions/node-output.md`(id: `node-output`, `NodeHandlerOutput` 5필드 계약 전체의 SoT)와 이름·주제가 근접해 "패키지가 output 계약 전체를 구현한다"는 오독 위험을 WARNING 으로 지적했다.
  - 확인: 최종 구현은 패키지명을 `@workflow/ai-end-reason` 으로 개명했고(`codebase/packages/ai-end-reason/package.json:2`), README 최상단에 "소유 / 소유하지 않음(값의 의미·port 매핑 → spec 문서, 출력 봉투 구조 → `node-output.md`)" 표를 명시했다(`codebase/packages/ai-end-reason/README.md:13-18`). `spec/4-nodes/3-ai/1-ai-agent.md`/`3-information-extractor.md`/`spec/conventions/interaction-type-registry.md` 전역 grep 결과 `node-output-contract` 문자열은 저장소 어디에도 남아있지 않다. `codebase/packages/` 6개 디렉터리(`ai-end-reason`/`chat-channel-validation`/`expression-engine`/`graph-warning-rules`/`node-summary`/`sdk`/`web-chat-sdk`) 중 이름 충돌도 없다.
  - 상세: WARNING 이 요구한 3가지 완화책(개명 검토 / README 스코프 한정 / 관련 plan backlink) 중 앞 두 가지를 정확히, 더 강한 형태(개명 자체)로 이행했다. 세 번째(`plan/in-progress/node-output-redesign/` 서브플랜에 신규 패키지 backlink)는 "가능하면" 수준의 선택적 제안이었고 실제로 반영되지 않았으나, 그 plan 은 이번 diff 대상이 아니고(origin/main 대비 무변경 확인) 값을 재선언하지 않고 진단용으로 `endReason` 값을 인용만 하므로 방치해도 실질적 충돌은 없다.
  - 제안: 없음 — 확인용 기록.

## 다른 관점 (요구사항 ID / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로)

- **요구사항 ID**: diff 에 `[A-Z]{2,}-[A-Z0-9]{2,}-[0-9]+` 패턴의 신규 ID 없음 (grep 확인). 해당 없음.
- **엔티티/타입명**: `AiAgentEndReason` / `InformationExtractorEndReason` / `ConversationEndReason` / `INTERACTION_TYPE_VALUES` / `CONVERSATION_SOURCE_VALUES` / `MULTI_TURN_INTERACTION_TYPES` / `IS_MULTI_TURN_INTERACTION` 전수 전역 grep(`codebase/`, `spec/`, `plan/`) 결과 신규 파일·소비처 밖에서 다른 의미로 쓰인 기존 사용처 없음. `CONVERSATION_END_REASONS` 는 위 INFO 참조.
- **API endpoint**: 신규 REST endpoint 없음.
- **이벤트/메시지명**: 신규 webhook·queue·SSE 이벤트명 없음. endReason 값 자체(`user_ended`/`max_turns`/`condition`/`error`/`completed`/`timeout`/`max_retries`)는 `origin/main` 시점에도 각 handler 파일에 로컬 literal union 으로 이미 존재하던 값이며(예: `git show origin/main:codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 의 `type EndReason` 에 `'timeout'` 포함 확인), 이번 변경은 그 값을 패키지로 승격했을 뿐 새 값을 추가하지 않았다.
- **환경변수·설정키**: diff 에 신규 ENV var·config key 없음 (grep 확인, `AI_AGENT_TOOL_*` 등 기존 §4.2 예산 변수는 이번 diff 대상이 아닌 기존 문서 내용).
- **파일 경로**: `codebase/packages/ai-end-reason/` 신설 시점에 동명 디렉터리·패키지명 미존재 확인. CI/빌드 배선(`codebase/{backend,frontend}/package.json`, `.github/workflows/packages-checks.yml` paths·matrix.pkg, `.claude/test-stages.sh` `INTERNAL_PACKAGES`) 3곳 모두 `@workflow/ai-end-reason` 단일 항목으로 중복 없이 등록됨을 확인. `spec/4-nodes/3-ai/1-ai-agent.md`(`../../../codebase/packages/ai-end-reason/`)·`spec/conventions/interaction-type-registry.md`(`../../codebase/packages/ai-end-reason/`) 의 상대경로 링크는 각 문서 위치에서 repo root 까지의 실제 depth 와 일치해 유효하다. `interaction-type-registry.md` 의 신규 `## 4. AI 노드 endReason...` 절 anchor(`#4-ai-노드-endreason--패키지가-sot-가드-비대상`)를 참조하는 두 spec 문서의 링크도 정확히 일치하며, 기존 `## 4. Rationale`(→`## 5. Rationale` 로 재번호)의 구 anchor(`#4-rationale`)를 참조하던 문서는 저장소 전역에 없어 끊긴 링크도 없다.

## 요약

이번 라운드에서 `spec/4-nodes/3-ai/` 스코프의 실제 `origin/main` 대비 diff 는 `1-ai-agent.md`/`3-information-extractor.md` 에 각 2줄씩 추가된 `endReason` SoT backlink 문구뿐이며, 그 근거가 되는 신규 패키지(`@workflow/ai-end-reason`)·신규 타입(`AiAgentEndReason`/`InformationExtractorEndReason`/`ConversationEndReason`)·신규 frontend 소스(`interaction-type-registry.ts`)는 선행 커밋에서 이미 도입·리뷰됐다. 전역 grep 으로 재검증한 결과 이 식별자들이 기존 코드·spec 에서 다른 의미로 쓰이고 있는 CRITICAL·WARNING 급 충돌은 발견되지 않았다. 직전 plan 단계 naming_collision 라운드가 지적했던 유일한 실질 위험(패키지명 `@workflow/node-output-contract` 가 `node-output.md` SoT 를 참칭할 위험)은 `@workflow/ai-end-reason` 로 개명 + README 스코프 한정 문구로 완전히 해소된 것을 이번 라운드에서 재확인했다. 남은 것은 `CONVERSATION_END_REASONS` 동일명 재선언(alias·JSDoc 으로 이미 완화)에 대한 INFO 성 관찰뿐이다.

## 위험도

NONE
