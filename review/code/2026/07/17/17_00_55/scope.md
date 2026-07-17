# 변경 범위(Scope) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 (isConversationOutput drift 차단)

검토 대상: 37개 파일 (`main` 대비 `claude/is-conversation-output-restructure-08f20e`, `git diff $(git merge-base main HEAD)...HEAD`).
검토 방법: `plan/in-progress/is-conversation-output-restructure.md` 에 서술된 의도(Phase 1 spec, Phase 2 E-1~E-7)를 기준선으로 각 파일·각 라인이 그 의도에 직접 봉사하는지 대조. 5개 커밋(`f0ef4a821`→`6b0b5cd45`) 전체를 개별 확인.

## 발견사항

### [WARNING] `review/code/2026/07/17/16_07_35/{meta.json,_retry_state.json}` — 완료되지 않은 이전 리뷰 라운드의 상태 파일이 무관한 "test" 커밋에 편입됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/review/code/2026/07/17/16_07_35/meta.json`, `.../16_07_35/_retry_state.json` — 커밋 `b04ddc258` (`test(ai-end-reason): 패키지 테스트 신설 — CI 실패 + 타입이 못 잡는 축`)
- **상세**: `git show --name-status b04ddc258` 확인 결과 이 커밋은 `codebase/packages/ai-end-reason/src/__tests__/end-reason.spec.ts` 1개만 추가하는 게 커밋 메시지의 취지인데, 실제로는 위 2개 리뷰 세션 상태 파일도 함께 추가됐다 — 커밋 메시지 어디에도 언급이 없다. 더 문제는 이 2개 파일이 **완결된 리뷰 산출물이 아니라는 점**이다: `_retry_state.json` 은 `"routing_status": "pending"`, `"agents_success": []`, `"agents_pending"` 에 14개 전원 — 즉 라운드가 시작만 되고 끝난 적이 없는 스냅샷이다. 실제 `SUMMARY.md` 와 14개 서브에이전트 리포트 중 커밋된 것은 **0개**이며, 현재 워킹트리에도 3개(`architecture.md`/`side_effect.md`/`testing.md`)만 untracked 로 남아있고 나머지 11개는 존재하지 않는다. 그런데 후속 커밋 `f17fc18dd` 의 메시지는 "`/ai-review`(16_07_35) WARNING 처리 ... 리뷰 지적(3건)" 이라며 이 라운드가 실제로 3건의 유효한 지적을 냈다고 서술한다 — 즉 라운드는 실무적으로 **완료·활용**됐는데, git 이력에는 "시작만 하고 끝나지 않은" 상태 파일만 고아로 남아 실제와 다른 그림을 영구 기록한다.
- **근거(범위 관점)**: 체크리스트 (1) 의도 이상의 변경 / (4) 무관한 수정 에 해당 — "패키지 테스트 신설" 이라는 커밋의 목적과 무관한 파일이, 그것도 불완전한 상태로 섞여 들어갔다. `feedback_review_gate_loop_avoidance.md` 교훈("마지막은 review/** 전용 커밋으로 종결")과도 반대 방향이다 — review 산출물이 소스 커밋에 흡수됐다.
- **제안**: 리뷰 라운드는 (a) 완결(`SUMMARY.md` + 전체 서브에이전트 리포트)까지 확인 후 **해당 라운드의 전 파일을 한 커밋**으로 묶거나, (b) 완결하지 못한 라운드(16_07_35)는 애초에 커밋하지 않는다. 이번 건은 사후 조치로 16_07_35 세션의 나머지 리포트를 채워 완결하거나, 상태 파일 2개만 별도 `chore` 성격 커밋으로 재정리하는 편이 이력을 덜 오도한다.

### [WARNING] `output-shape.ts` — `MULTI_TURN_INTERACTION_TYPES` 를 다른 모듈로 옮기면서 그 설명 JSDoc 을 지우지 않아 죽은 주석으로 남음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/codebase/frontend/src/components/editor/run-results/output-shape.ts:112-119`
- **상세**: 이 diff 는 `const MULTI_TURN_INTERACTION_TYPES: ReadonlySet<string> = new Set([...])` 선언을 삭제하고 `@/lib/conversation/interaction-type-registry` 의 import 로 대체했다(정당한 리팩터링, E-3b 의도와 일치). 그런데 바로 위에 있던 그 선언 전용 JSDoc — *"Multi-turn marker values recognised in either top-level (legacy) or `meta.interactionType` (canonical) positions. Keep in sync with `spec/conventions/interaction-type-registry.md` — adding a new value here without updating the registry is rejected by the AST guard..."* — 은 그대로 남았다. 지금은 이 주석이 **선언을 잃고 허공에 뜬 채** 아래 2줄 공백을 거쳐 곧바로 `CONVERSATION_END_REASONS` JSDoc 으로 이어진다. "add a new value **here**" 라는 문장은 이제 이 파일에 존재하지 않는 대상을 가리켜 다음 독자를 오도한다 — 실제 값 목록·AST 단언은 `interaction-type-registry.ts` 로 이관됐고 그 파일에 이미 갱신된 설명이 있다(중복이자 stale 사본).
- **근거(범위 관점)**: 체크리스트 (6) 주석 변경 — 코드를 옮기면서 주석 정리가 누락된 전형적 사례.
- **제안**: 112-119번 줄의 JSDoc 블록을 삭제(그 내용은 `interaction-type-registry.ts` 의 `MULTI_TURN_INTERACTION_TYPES` export 주석이 이미 대체).

### [INFO] 코드 삭제 후 남은 이중 공백줄 — 2곳

- **위치**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/codebase/frontend/src/components/editor/run-results/output-shape.ts:120-121` (위 항목과 같은 자리 — `MULTI_TURN_INTERACTION_TYPES` 선언 삭제 후 빈 줄 2개 잔존)
  - `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:8-9` (`WaitingInteractionType`/`ConversationTurnSource` type-only import 2줄 삭제 후 빈 줄 2개 잔존)
- **상세**: 두 파일 모두 base 대비 신규로 도입된 이중 공백줄이다(base 커밋 기준 diff 로 확인 — 각 파일에 원래부터 있던 이중 공백은 별도 위치이며 이번 변경과 무관). `no-multiple-empty-lines` 류 lint 룰이 없다면 CI 는 통과하지만 순수 포맷팅 잔여물이다.
- **근거(범위 관점)**: 체크리스트 (5) 포맷팅 변경 — 실질 변경(선언 삭제)의 부산물이지만 정리되지 않았다.
- **제안**: 각 위치의 중복 빈 줄 1개씩 제거.

### [INFO] `@workflow/ai-end-reason` type-only import 삽입이 backend 3개 파일에서 "import 블록–코드" 사이 공백줄을 잠식

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:69`, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:39`, `codebase/backend/src/nodes/core/node-handler.interface.ts:4` (모두 `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/` 하위)
- **상세**: 세 파일 모두 기존에는 `<마지막 상대경로 import>` → 빈 줄 → `/** JSDoc */` 구조였다. 신규 `import type { ... } from '@workflow/ai-end-reason';` 가 import 정렬 규칙(상대경로 그룹과 패키지 그룹 분리)에 따라 빈 줄 **뒤**, 즉 기존 그룹과 새 그룹 사이에 삽입되면서, 정작 "import 끝 – 코드 시작" 사이의 빈 줄이 사라졌다(신규 import 바로 다음 줄이 JSDoc). eslint import 정렬 자동화의 부수효과로 보이며 기능·빌드에는 영향 없는 순수 가독성 이슈다.
- **근거(범위 관점)**: 체크리스트 (5) 포맷팅 변경 — 실질 변경(신규 import)에 자동 포맷 부산물이 섞였다. 3개 파일에 동일 패턴으로 일관되게 나타나 도구 기인으로 판단되며, 심각도는 낮다.
- **제안**: 필요 시 각 신규 import 다음에 빈 줄 1개 추가. 우선순위 낮음.

## 정합성 확인 (범위 이탈 아님 — 참고용)

- **패키지 스캐폴딩 정합**: `codebase/packages/ai-end-reason/{package.json,tsconfig.json,eslint.config.mjs}` 를 기존 sibling `graph-warning-rules` 와 diff 한 결과 name/description 문구 외 실질 차이 없음 — plan 이 명시한 "기존 4개 템플릿 그대로" claim 과 일치, 임의 설정 확장 없음.
- **배선 변경 전부 1~2줄 단일 목적 추가**: `.claude/test-stages.sh`(1줄) / `.github/workflows/packages-checks.yml`(3곳, 각 1줄) / 3개 Dockerfile(각 1~2줄) / `docker-compose.e2e.yml`(1줄) — 전부 신규 패키지 등록 목적에 정확히 대응하며 무관한 항목 변경 없음.
- **`pnpm-lock.yaml`**: 33줄 전부 추가(삭제 0) — `git diff` 로 확인한 결과 신규 `ai-end-reason` 패키지 자신의 devDependencies 등록뿐, 기존 의존성 버전 변동 없음.
- **`codebase/packages/README.md`**: 커밋 `f0ef4a821` 에서 오배치로 추가됐다가 `f17fc18dd` 에서 삭제되어 최종 diff(`main`↔`HEAD`)에는 나타나지 않음 — 브랜치 내에서 자체 교정됨, 잔존 이슈 아님.
- **`MULTI_TURN_INTERACTION_TYPES` 를 "1줄 grep 등록" 대신 `Record<WaitingInteractionType, boolean>` 전체 이관으로 처리한 것**: plan 의 E-3b 항목은 "1줄 추가로 닫힌다" 로 적혀 있었으나 실제 구현은 새 소스 모듈(`interaction-type-registry.ts`)로 값·컴파일타임 단언을 전부 이관하는 더 큰 구조로 갔다. 이는 은폐된 확장이 아니라 **코드 주석과 spec(`interaction-type-registry.md §5`) 양쪽에 왜 grep 가드가 부분집합에 오탐하는지(`form`/`buttons` false-positive, 실측)까지 명시**돼 있어 투명하게 공개된 설계 피벗이다 — E-1(같은 파일의 죽은 컴파일타임 가드 수정)과 사실상 하나의 문제였으므로 동일 작업 범위로 판단.
- **`node-handler.interface.ts` 의 확장된 JSDoc(15줄)**: `endReason` 파라미터 타입을 좁은 리터럴 유니온에서 `AiAgentEndReason` 으로 바꾸며 생기는 "이 계약은 두 구현체의 교집합만 커버한다" 는 캐비앗을 설명 — 커밋 메시지가 "architecture 리뷰 제안의 최소안" 이라 명시한 대로 리뷰 발견에 대한 응답이며 이번 diff 자신이 만든 타입 변경의 한계를 문서화한 것이라 범위 내로 판단.
- **`review/consistency/2026/07/17/15_06_14/**` (8개 파일, `--spec` 게이트 완료 라운드)**: `SUMMARY.md`(BLOCK: NO) + 5개 checker 리포트 전원 확보된 **완결된** 라운드로, CLAUDE.md 의 `project-planner spec/ 쓰기 직전 consistency-check --spec 의무` 를 충족하는 정당한 산출물. 위 WARNING 대상(16_07_35, 미완결)과 대비된다.
- **plan 문서(`plan/in-progress/is-conversation-output-restructure.md`, 316줄 신설)**: CLAUDE.md "Plan must include spec updates" 원칙대로 spec 갱신까지 정식 phase 로 포함하고 있으며, 자체적으로 "5곳→6곳"/"6곳→7곳" 등 실측 정정 이력을 남겨 초안 대비 구현 확장분을 스스로 추적한다.

## 요약

이번 변경은 계획서(`plan/in-progress/is-conversation-output-restructure.md`)가 명시한 목표 — `endReason` 값 도메인을 `@workflow/ai-end-reason` 패키지로 단일화하고 그 배선(backend/frontend/Docker/CI/lock) 및 연쇄 발견(테스트 파일의 죽은 컴파일타임 가드, `MULTI_TURN_INTERACTION_TYPES` 무가드 사본, 누락된 6번째 선언처)을 함께 닫는 것 — 에 37개 파일 전부가 직접 대응하며, 무관한 기능 추가나 임의 리팩터링은 발견되지 않았다. 패키지 스캐폴딩은 기존 sibling 패키지 템플릿을 그대로 따르고, CI/Docker/lockfile 변경은 전부 신규 패키지 등록이라는 단일 목적의 최소 추가다. 다만 두 가지 실질적 잔여물이 있다 — (1) 완료되지 않은 이전 `/ai-review` 라운드(16_07_35)의 상태 파일만 무관한 "test" 커밋에 편입돼 실제와 다른 이력을 남겼고, (2) `output-shape.ts` 에서 코드를 다른 모듈로 옮기며 그 설명 주석을 지우지 않아 죽은 JSDoc 이 남았다. 이중 공백줄 잔존(2곳)과 import 정렬 부수효과(3곳)는 순수 포맷팅 수준의 부산물이다. 넷 다 CRITICAL 급 범위 이탈은 아니며 소규모 정리로 해소 가능하다.

## 위험도

LOW
