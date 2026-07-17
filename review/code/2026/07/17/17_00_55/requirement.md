STATUS=success requirement review complete — 37 files, CRITICAL 0 / WARNING 3 / INFO 2, risk LOW
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + `isConversationOutput` drift 구조적 차단

## 검증 방법

diff 37개 파일을 정독한 뒤, 다음을 직접 실행해 claim 을 실측 검증했다 (grep 카운트가 아니라 실제 컴파일/테스트 실행):

- `pnpm --filter @workflow/ai-end-reason build/test/lint` — 전부 통과 (tsc 0 에러, jest 5/5, eslint 0).
- `codebase/frontend`: `npx tsc --noEmit` 전체 통과 (0 에러). `vitest run` 으로 `interaction-type-exhaustiveness.test.ts` + `output-shape.test.ts` (33 tests) + `src/lib/docs/__tests__/**`(spec frontmatter/link-integrity/plan-frontmatter 등 18 suite, 2606 tests) 전부 통과.
- `codebase/backend`: `npx tsc --noEmit -p tsconfig.build.json`(실제 `nest build` 가 쓰는 설정, `*.spec.ts` 제외) 0 에러. `jest ai-agent.handler.spec.ts ai-turn-executor.spec.ts information-extractor.handler.spec.ts` 173/173 통과.
  - 참고: `tsconfig.json`(spec 포함, IDE 용) 로 `tsc --noEmit` 하면 carousel/http-safety/cafe24-mcp/workflow.schema 등 **본 PR 과 무관한 기존 파일**에서 다수 에러가 나오나, 이는 `tsconfig.build.json` 이 `**/*spec.ts` 를 exclude 하므로 실제 빌드 게이트와 무관한 pre-existing 노이즈다 (재현: 두 tsconfig 결과 비교로 확인, 본 PR 변경 파일과 무관).
- `python3 scripts/check-e2e-playwright-config.py` — `@workflow closure (5) synced across Dockerfile COPY + compose masks` 로 OK. Docker 배선(backend/frontend/e2e 3개 Dockerfile + compose 마스킹) claim 을 이 가드로 교차검증.
- `grep -rn "user_ended" codebase/backend/src codebase/frontend/src` 전수 — endReason 리터럴 유니온 사본이 `@workflow/ai-end-reason` 패키지 자신 외에는 0곳(전부 string-literal 비교/테스트 값/JSDoc). "6번째 선언처(`ai-agent.handler.ts:192`) 수정 완료" claim 과 일치.
- `class InformationExtractorHandler implements NodeHandler` / `class AiAgentHandler implements NodeHandler` grep — `node-handler.interface.ts` 의 JSDoc 이 주장하는 "어느 클래스도 `implements ResumableNodeHandler` 를 선언하지 않는다" 를 실측 확인. `ai-turn-orchestrator.service.ts` 의 두 호출부(`'user_ended'`/`'error'`)도 JSDoc 주장과 일치.

## 발견사항

- **[WARNING]** plan 문서의 E-3b 절이 서술하는 조치와 실제 구현이 다르다 — 실행 결과는 더 우수하지만 plan 이 갱신되지 않았다.
  - 위치: `plan/in-progress/is-conversation-output-restructure.md` "E-3b" 절 (`output-shape.ts 를 REGISTRY_SITES 에 추가 — 1줄`) vs 실제 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (`IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean>` exhaustive 구조)
  - 상세: plan 은 "MULTI_TURN_INTERACTION_TYPES drift 차단"을 위해 `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 에 `output-shape.ts` 를 등록하는 grep 가드 방식을 명시했다. 그러나 실제 구현은 그 방식을 쓰지 않았다 — `REGISTRY_SITES` 는 지금도 3개 파일뿐이고 `output-shape.ts` 는 없다(실측 확인). 대신 새 파일 `interaction-type-registry.ts` 에 `Record<WaitingInteractionType, boolean>` exhaustive 맵을 만들어 컴파일러가 누락을 강제하도록 했다. 이 파일 자체의 JSDoc 이 이유를 정확히 설명한다 — "grep 가드는 '모든 값이 모든 사이트에 등장' 모델이라 부분집합(2/4값)에 쓰면 `form`·`buttons` 를 누락으로 오탐한다(실측)". 즉 실제 구현이 plan 이 놓친 결함을 재발견해 **더 나은 방식으로 우회**한 것이며 기능적으로는 문제없다(tsc/vitest 로 확인). 문제는 plan 텍스트가 이 피벗을 전혀 반영하지 않아, `complete/` 이동 후 이 plan 을 읽는 사람은 "REGISTRY_SITES 에 1줄 추가"가 실제 구현이라고 잘못 이해하게 된다.
  - 제안: plan 의 E-3b 절을 실제 구현(신규 소스 모듈 + exhaustive Record)으로 갱신. spec 은 아니므로 CRITICAL 대상은 아니나 결정 기록의 정확성을 위해 developer 후속 커밋으로 정정 권장.

- **[WARNING]** (낮음, 주석 전용) 신규 패키지 추가로 Dockerfile 주석의 개수 표기가 stale.
  - 위치: `codebase/backend/Dockerfile:29` (`**backend closure (= @workflow 4개)만**`), `codebase/frontend/Dockerfile.playwright-e2e:38-39` (`**frontend closure(= @workflow 4개)만**` / `manifest 는 위에서 6개 전부 COPY`)
  - 상세: 이번 PR 이 두 Dockerfile 의 소스 COPY 블록에 `ai-end-reason` 을 추가해 실제로는 5개 패키지(backend)/manifest 7개(playwright-e2e) 가 됐으나, 인접한 기존 주석("4개"/"6개")은 갱신되지 않았다. 실제 COPY 지시문 자체는 정확·완전함을 `check-e2e-playwright-config.py` 실행으로 확인했으므로 빌드에는 영향 없는 순수 문서 drift다. 다만 이 PR 의 목적 자체가 "가드가 있는 줄 알았는데 잘못된 정보를 갖고 있던" 계열의 재발 방지이므로, 같은 종류의(훨씬 낮은 리스크지만) 숫자 drift 를 새로 2곳 남긴 점은 지적할 가치가 있다.
  - 제안: "4개"→"5개", "6개"→"7개" 로 정정 (기능 영향 없음, 후속 커밋 또는 후속 PR 에서 처리 가능).

- **[INFO]** `output-shape.ts` 에 이제 아무것도 설명하지 않는 dangling 주석이 남아 있음.
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:112-120`
  - 상세: `MULTI_TURN_INTERACTION_TYPES` 정의가 `interaction-type-registry.ts` 로 이동(import 로 대체)했는데, 그 정의를 설명하던 JSDoc 블록("Keep in sync with `spec/conventions/interaction-type-registry.md` — adding a new value here without updating the registry is rejected by the AST guard in `lib/__tests__/interaction-type-exhaustiveness.test.ts`")이 삭제되지 않고 빈 줄만 남긴 채 그대로 붙어 있다. 이 주석의 주장은 애초(리팩토링 전)에도 정확하지 않았다 — plan 의 E-3b 실측이 밝힌 대로 `output-shape.ts` 는 한 번도 `REGISTRY_SITES` 에 없었다. 리팩토링 후에는 설명 대상 코드 자체가 이 파일에 없으므로 완전히 붕 떠 있다.
  - 제안: 해당 JSDoc 블록 삭제 (실제 guard 설명은 `interaction-type-registry.ts` 자신의 JSDoc 이 담당).

- **[INFO]** `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록에 이번에 신설된 정식 SoT 파일 2개가 없음.
  - 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` (파일 상단)
  - 상세: 신설 §4 및 §5 Rationale 갱신문이 각각 `codebase/packages/ai-end-reason/src/index.ts` 와 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 를 명시적 코드 SoT/구현 위치로 지목하지만, frontmatter `code:` 목록(spec-impl-evidence 컨벤션의 근거 링크)에는 등재돼 있지 않다. `spec-code-paths.test.ts` 가드는 `status: implemented` spec 에 `code:` glob 이 ≥1 매치만 요구하므로 기존 항목들로 이미 충족돼 빌드는 안 깨진다(실측: `src/lib/docs/__tests__/**` 전체 통과) — 즉 non-blocking.
  - 제안: 두 파일을 `code:` 에 추가하면 spec↔구현 근거가 더 정확해짐 (선택 사항).

- **[INFO]** (범위 밖 관찰, 리뷰 대상 diff 의 결함 아님) 작업 디렉터리에 커밋되지 않은 로컬 변경 1건 발견.
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (working tree, uncommitted)
  - 상세: 리뷰 중 `git status` 로 `output-shape.ts` 가 HEAD 대비 uncommitted 로 수정된 상태(`looksLikeConversationEnd` 에서 `CONVERSATION_END_REASONS.has(endReason)` 체크가 제거된 상태)를 발견했다. **`git show HEAD:...` 로 확인한 결과 커밋된(리뷰 대상) 버전에는 이 체크가 온전히 존재**하므로 이번 리뷰 대상 diff 의 결함이 아니다. plan 이 스스로 요구하는 "mutation 주입 후 red 확인" 회귀 검증(Phase 3, "회귀 검증 의무: 일부러 유니온에 값을 추가해 컴파일이 깨지는지 실측한다") 이 같은 worktree 에서 동시 진행 중이었을 가능성이 높다(memory: 공유 worktree 동시편집이 측정 아티팩트를 만든 선례 있음). 참고용으로만 기록 — orchestrator 가 최종 커밋 전 `git status` 로 이 worktree 가 clean 한지 재확인 권장.

## 확인된 정합 사항 (발견 아님 — 검증 근거로 기록)

- **spec fidelity 전 항목 line-level 일치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7 의 신규 backlink(`AiAgentEndReason`)가 패키지의 실제 union(`'user_ended'|'max_turns'|'condition'|'error'`)과 정확히 일치, `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 의 backlink(`InformationExtractorEndReason`)도 패키지 union과 일치(§5.6 "4 종" 서술과 §5.3 의 별도 `error` 포트 서술이 모순 없이 IE union 6값을 정확히 분담). `spec/conventions/interaction-type-registry.md` §4 신설 절은 패키지 내부의 `satisfies`/`Exclude` 이중 잠금 메커니즘을 실제 `index.ts` 구현과 정확히 일치하게 서술.
- **경계 서술 정확**: "패키지는 값 도메인만 소유, port 매핑/봉투 구조는 spec 소유" 라는 각 backlink 의 주장이 실제로 지켜짐 — `ai-end-reason/src/index.ts` 에 port 매핑 로직 없음, `node-output.md` 에 `endReason` 언급 없음(grep 0건, 소유권 미충돌).
- **`node-handler.interface.ts` JSDoc 의 자기 비판적 서술 정확**: "engine 의 범용 호출부는 `'user_ended'`/`'error'` 만 넘긴다" 는 주장을 `ai-turn-orchestrator.service.ts:914,996` 실측으로 확인. "어느 클래스도 `implements ResumableNodeHandler` 를 선언 안 함" 도 실측 확인.
- **"6번째 endReason 선언처" 수정 완료**: `ai-agent.handler.ts:191-205` 의 `endMultiTurnConversation` 이 `AiAgentEndReason` 타입을 사용하며, backend 전체에 endReason 리터럴 유니온의 잔존 사본 0건(패키지 자신 제외).
- **TODO/FIXME/HACK/XXX 없음**: diff 의 핵심 변경 파일 9개 전수 grep 결과 0건.
- **엣지 케이스 커버**: 패키지 자체 jest(`end-reason.spec.ts`)가 중복값·빈 배열·양쪽 노드 도메인 기여·`'out'` 미포함·타입 narrowing 5가지를 검증 — "타입 장치가 못 잡는 축만" 이라는 자체 설계 원칙과 일치.
- **CI/Docker 배선 완결성**: `.claude/test-stages.sh` `INTERNAL_PACKAGES` (7번째 발견 배선처) 추가 확인 + `cmd_lint`/`cmd_unit`/`cmd_build` 3곳 모두에 전파됨. `.github/workflows/packages-checks.yml` 의 `paths`(PR+push) · `matrix.pkg` 전부 갱신. `check-e2e-playwright-config.py` 실행으로 e2e Docker 배선 100% 정합 확인.

## 요약

`@workflow/ai-end-reason` 패키지 신설 + `isConversationOutput` 의 두 하드코딩 목록(`endReason`, `MULTI_TURN_INTERACTION_TYPES`) 제거는 의도한 기능(교차 스택 drift 의 구조적/컴파일타임 차단)을 완전하고 정확하게 구현했다. spec 3개 문서(AI Agent §7, Information Extractor §5.6, interaction-type-registry §4/§5)와 코드가 line-level 로 일치함을 직접 대조·grep·실행으로 검증했고, CRITICAL 급 spec-code 불일치나 기능 누락은 발견되지 않았다. backend 6곳·frontend·CI·Docker 3개·compose·test-stages.sh 등 이 PR 이 스스로 열거한 "배선 전수" 항목 전부가 실제로 완결됐음을 직접 실행(tsc/jest/vitest/e2e-config-guard)으로 확인했다 — 이는 리뷰 대상 PR 이 반복 강조하는 "가드는 있다가 아니라 깨뜨려 봤다로만 신뢰" 원칙을 스스로도 충족한다는 의미다. 남은 이슈는 모두 비차단 수준의 문서 정합성 결함(plan 문서가 실제 구현과 다른 접근을 서술, Dockerfile 주석의 개수 오기 2곳, 옮겨진 정의를 계속 가리키는 죽은 주석 1곳, spec frontmatter code: 목록 보강 여지)이며, 기능적 결함이나 spec 위반은 없다.

## 위험도

LOW
