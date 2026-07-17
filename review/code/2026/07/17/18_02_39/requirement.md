STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/review/code/2026/07/17/18_02_39/requirement.md RESET_HINT=
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `a8c9460564df00131fcb39c516d9ee8ca6a3383b`

`fix(ai-end-reason): 리뷰 WARNING#1,2,5,6,9,10 정리` — 이전 리뷰 라운드의 WARNING 6건을 정리하는 후속 커밋. 7개 파일(Dockerfile 2, 코드 1, 테스트 2, README 1, plan 1) 모두 정독 + 저장소 실물(현재 워크트리) 대조 + **신규 테스트 2건에 대한 mutation 재현(직접 코드 mutate → 실패 확인 → 원복)** 을 수행했다.

## 검증 방법 (요약)

- `output-shape.ts`(SUMMARY#1)의 diff는 JSDoc 삭제/재배치뿐 로직 라인 변경 0건임을 diff·전체 파일 대조로 직접 확인.
- SUMMARY#5 mutation: `interaction-type-registry.ts`의 `ai_form_render: true→false` → `interaction-type-registry.test.ts`의 신규 테스트 1건만 실패(35 passed/1 failed), 나머지(기존 exhaustiveness 가드 포함) 전원 green. 원복 후 재확인.
- SUMMARY#6 mutation: `output-shape.ts`의 `looksLikeConversationEnd`에서 `CONVERSATION_END_REASONS.has(endReason)` 절 제거 → `output-shape.test.ts` 32건 중 신규 테스트 1건만 실패(35 passed/1 failed). 원복 후 재확인.
- 두 mutation 모두 커밋 메시지가 주장한 결과("SUMMARY#5/#6 테스트만 실패, 다른 31개 영향 없음")와 **정확히 일치** — 신규 테스트가 실제로 겨냥한 회귀를 잡는 유효한 회귀 방지 테스트임을 실측으로 확인.
- Dockerfile 2건(SUMMARY#10)의 "4개→5개", "6개→7개" 정정은 실제 `COPY codebase/packages/...` 라인 수를 직접 세어 대조 — 두 파일 모두 일치.
- `codebase/packages/ai-end-reason/src/index.ts` / `package.json`을 직접 읽어 README 신설 섹션(SUMMARY#9)의 export 목록·값 개수·빌드 스크립트 서술이 실제 코드와 일치함을 확인.
- 관련 spec `spec/conventions/interaction-type-registry.md §4`("AI 노드 endReason — 패키지가 SoT")를 읽어 본 diff 이후에도 spec 본문(SoT 위치·강제 방식·경계 서술)과 패키지 실제 구현이 line-level로 일치함을 확인 — 이번 diff는 spec이 규정한 계약을 벗어나지 않는다.

## 발견사항

- **[WARNING]** plan 정정 각주(SUMMARY#2)가 커밋 SHA를 잘못 인용함 — `f17fc18dd`가 아니라 `f0ef4a821`
  - 위치: `plan/in-progress/is-conversation-output-restructure.md:244`
  - 상세: 해당 각주는 "`interaction-type-registry.ts`에 `IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean>` exhaustive 구조를 신설해 `MULTI_TURN_INTERACTION_TYPES`를 그 파생으로 바꿨다(`f17fc18dd`)"라고 적었다. 그러나 `git log --oneline -- codebase/frontend/src/lib/conversation/interaction-type-registry.ts`는 이 파일 역사 전체에서 커밋이 **단 하나(`f0ef4a821`)** 뿐임을 보인다. `git show f17fc18dd -- .../interaction-type-registry.ts`는 빈 diff(그 커밋은 이 파일을 전혀 건드리지 않음)이고, `git show f17fc18dd --stat`로 확인한 실제 변경 파일 목록(`.claude/test-stages.sh`, `packages-checks.yml`, `ai-agent.handler.ts`, `node-handler.interface.ts`, `output-shape.test.ts`, `interaction-type-exhaustiveness.test.ts`, `packages/README.md`, `docker-compose.e2e.yml`)에도 `interaction-type-registry.ts`가 없다. 반대로 `git show f0ef4a821 -- .../interaction-type-registry.ts`는 이 파일을 신규 생성하며 각주가 서술한 `IS_MULTI_TURN_INTERACTION` 구조를 **정확히 그 형태로** 도입한다. 결정적으로, **같은 plan 파일의 18줄 앞(line 226)**이 동일 커밋을 정확히 "최초 구현(`f0ef4a821`)"이라 올바르게 인용하고 있어, 문서 자체가 자기모순이다.
  - 제안: `f17fc18dd` → `f0ef4a821`로 정정. (참고: `f17fc18dd`가 실제로 한 일은 `interaction-type-exhaustiveness.test.ts`의 "여기가 test SoT"라는 낡은 주석을 — `f0ef4a821`이 이미 옮긴 사실에 맞게 — 정정한 것으로, 완전히 무관하진 않으나 각주가 지목한 "구조 신설" 그 자체의 커밋은 아니다.)

- **[WARNING]** 재배치된 `isConversationOutput` JSDoc의 "네 가지 shape" 서술이 실제 OR-체인 분기 수보다 적음 (콘텐츠는 사전 존재하나, 이번 diff가 함수 바로 위로 옮겨 노출도·신뢰도를 높임)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:114-125`(JSDoc, SUMMARY#1이 이 정확한 블록을 삭제 후 재작성 없이 재삽입) / 함수 본문 `:127-179`
  - 상세: JSDoc은 "Handles all four shapes we emit"이라며 legacy flat completed / new wrapped completed / new wrapped waiting / legacy waiting 4개만 열거한다. 그러나 실제 `return` 문은 `(hasLegacyMessages && (outputInteraction || metaInteraction)) || hasConvConfig || looksLikeConversationEnd || isCanonicalWaiting`로 최소 4개의 독립 OR 항 + 함수 최상단의 별도 early-return(legacy `interactionType`/`conversationConfig`)까지 합쳐 5개 이상의 독립 인식 경로를 갖는다. 이 중 (a) `looksLikeConversationEnd`(`output.result.messages` + `endReason` 화이트리스트 — post-Stage-5 ai_agent terminal)와 (b) `hasConvConfig`(`output.conversationConfig` 단독 존재, 최상단 legacy `raw.conversationConfig`와는 다른 위치)는 4-bullet 목록 어디에도 명시적으로 대응되지 않는다. 이 diff가 신설한 바로 그 테스트(`output-shape.test.ts`)조차 (a) 경로를 `"detects post-Stage-5 ai_agent terminal via output.result.messages + endReason"`이라는 **별도 이름의 shape**로 부르고 있어, 코드·테스트 스스로 "4개보다 많다"고 증언한다. `isConversationOutput`은 plan 문서가 "대화 UI 전체의 게이트"라 부르고 동일 계열 버그가 이미 두 번(`error`/`condition` 누락, PR #959) 난 고위험 함수이므로, 불완전한 열거를 신뢰한 채 이 함수를 확장하면 같은 계열의 세 번째 회귀로 이어질 위험이 있다.
  - 제안: 이번 diff의 결함(내용은 편집 없이 위치만 이동)은 아니지만, SUMMARY#1이 이 정확한 JSDoc을 "정리 대상"으로 명시적으로 다룬 김에 누락된 두 분기를 bullet에 추가하거나 "all four shapes"를 "여러 shape(정확한 개수는 OR-체인 참고)"로 완화하는 편이 향후 회귀 예방에 저비용·고가치다.

- **[INFO]** SUMMARY#9 커밋 메시지의 "형제 패키지 4개 전부가 갖는 `## 빌드` / `## 사용(Exports)` 섹션" 서술이 과장됨
  - 위치: `codebase/packages/ai-end-reason/README.md`(`## 빌드`/`## 사용(Exports)`) vs `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary}/README.md`
  - 상세: 4개 형제 패키지 README를 직접 대조. `chat-channel-validation`은 `## 빌드` 섹션이 아예 없다(`## Exports`만 존재, `npm run build`/`npm test` 언급 없음) — "4개 전부"가 아니라 3/4. "`## 사용(Exports)`"라는 정확한 표제는 넷 중 어느 것도 쓰지 않는다: `expression-engine`/`node-summary`는 `## 사용`(괄호 없음) + 별도 `## 주요 export` 표, `graph-warning-rules`는 `## 주요 export`만, `chat-channel-validation`은 `## Exports`(영문). 신설된 `## 사용(Exports)`는 이 넷 중 어느 패턴과도 문자 그대로 일치하지 않는 제3의 변형이다. 다만 콘텐츠 자체(빌드 커맨드는 `package.json`의 `"build": "tsc"`/`"test": "jest"`와 정확히 일치, export 목록은 `src/index.ts`의 실제 4개 export와 정확히 일치)는 정확하고 유용하다 — 순수 문구 서술의 문제이며 기능·정확성 영향은 없다.
  - 제안: 이 diff 자체를 되돌릴 필요는 없음(내용은 옳고 가치 있음). 다만 이번 커밋이 SUMMARY#10에서 스스로 "실측 없는 개수 주장은 stale해진다"는 교훈을 얻었으니, 커밋 메시지의 "전부/모두" 같은 정량적 서술도 같은 기준으로 실측 후 표현하는 편이 일관적이다.

- **[INFO]** (참고, 범위 밖) `CHANGELOG.md`에 이번 작업 계열(endReason drift 구조적 차단) 항목 누락
  - 위치: 저장소 루트 `CHANGELOG.md` — `f0ef4a821`~`a8c946056` 7개 커밋 중 어느 것도 이 파일을 건드리지 않음.
  - 상세: 사용자 제보 버그(`error`/`condition` 누락으로 인한 대화 미리보기 소실)를 구조적으로 차단하는 사용자-가시적 fix 계열인데, 직전 PR(#958)의 review-fix가 명시적으로 "사용자 가시 fix마다 CHANGELOG 절을 남기는 컨벤션"을 언급하며 동일 항목을 지적·수정한 선례가 있다. 이번 정리 커밋(SUMMARY#1,2,5,6,9,10) 자체의 스코프에는 CHANGELOG가 포함되지 않으므로 이 diff의 결함은 아니다.
  - 제안: plan이 `plan/complete/`로 이동하기 전, `## Unreleased` 절 추가를 별도로 챙길 것을 권장 (documentation reviewer 리포트와 동일 지적 — 중복 조치 불필요, 참고용).

## 요약

이 커밋은 프로덕션 로직을 전혀 변경하지 않는 순수 정리(cleanup) 커밋이며, 커밋 메시지가 명시한 6개 SUMMARY 항목 모두 실제 파일 변경과 1:1로 정확히 대응한다. 가장 중요한 검증 대상인 신규 테스트 2건(SUMMARY#5 값-정확성, SUMMARY#6 화이트리스트 negative)은 mutation 주입을 **직접 재현**해 커밋 메시지의 주장이 사실임을 확인했고, Dockerfile 주석 정정(SUMMARY#10)과 README 신설 섹션(SUMMARY#9)의 기술적 내용도 실제 코드와 정확히 일치한다. 관련 spec(`interaction-type-registry.md §4`)과도 line-level로 어긋남이 없다. 다만 이번 diff가 직접 손댄 문서 두 곳에서 정확성 결함을 발견했다 — (1) plan 정정 각주가 인용한 커밋 SHA가 실제와 다르고(자기 문서 내에서도 모순), (2) 재배치되며 노출도가 커진 `isConversationOutput` JSDoc이 실제보다 적은 shape 수를 주장한다(내용 자체는 이번 diff 이전부터 존재). 둘 다 런타임 동작에는 영향이 없는 문서/주석 정확성 이슈이며 이 diff를 차단할 사유는 아니다.

## 위험도

LOW
