STATUS=success documentation review complete — 4 findings (0 CRITICAL, 2 WARNING, 2 INFO)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `fix(ai-end-reason)` 리뷰 후속 정리 (a8c9460)

대상 커밋은 그 자체가 "이전 리뷰 WARNING(고아 JSDoc·주석 drift·README 형평성·plan 오류)을 정리"하는 문서화 개선 커밋이다. 아래는 그 개선의 정확성 검증 + 남은 갭 점검 결과다.

## 발견사항

- **[WARNING]** `@workflow/ai-end-reason` drift 구조적 차단 작업 전체에 `CHANGELOG.md` 항목 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/CHANGELOG.md` (본 plan 브랜치의 7개 커밋 `f0ef4a821`→`9df2bb42f`→`b04ddc258`→`f17fc18dd`→`6b0b5cd45`→`a8c946056` 중 어느 것도 이 파일을 건드리지 않음 — `git diff main...HEAD --stat -- CHANGELOG.md` 결과 없음)
  - 상세: 이 저장소는 병합되는 거의 모든 PR 이 `CHANGELOG.md` 에 `## Unreleased — <제목>` 절을 남기는 것을 실제로 지켜온다(직전 15개 머지 커밋 전수 확인, 100% 일치). 더 결정적으로, 바로 직전 PR(`#958`, `ab19fef67`)의 review-fix 커밋 메시지에 **"W#6 CHANGELOG Unreleased 절 추가. 사용자 가시 fix 마다 절을 남기는 [컨벤션]…"** 이라는 명시적 문구가 있다 — 즉 documentation reviewer 가 이 정확한 항목("사용자 가시 fix 인데 CHANGELOG 누락")을 최근 PR 에서 이미 한 번 지적했고 그때 고쳐졌다. 이번 작업의 동기 자체가 **사용자 제보 버그**(대화 미리보기 탭 소실, `error`/`condition` 누락 — plan 문서 "같은 버그가 세 번 났다" 절)이고, 유사 사례("KB WebSocket 이벤트 count drift 정정" — 런타임 동작 무변경인 drift-class 구조 수정)도 CHANGELOG 에 등재돼 있어 이번 건도 정확히 같은 계열이다.
  - 제안: plan 이 `plan/complete/` 로 이동하기 전에 `## Unreleased — endReason 화이트리스트 drift 구조적 차단 (@workflow/ai-end-reason)` 류의 절을 추가하고 `spec/conventions/interaction-type-registry.md §4` 를 SoT 로 backlink. (본 정리 커밋의 범위를 벗어나는 지적일 수 있으나, plan 의 "Phase 4 — `/ai-review`" 가 곧 마지막 라운드이므로 지금이 놓치기 전 마지막 지점이다.)

- **[WARNING]** `isConversationOutput` JSDoc 의 "네 가지 shape" 열거가 실제 인식 분기 수와 어긋남 (relocate 만 되고 내용은 미검토)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/codebase/frontend/src/components/editor/run-results/output-shape.ts:114-125`
  - 상세: 이번 커밋(SUMMARY#1)은 이 JSDoc 블록을 함수 바로 위로 옮기고 24줄 이격을 없앴다 — 좋은 개선이다. 다만 텍스트는 이동만 됐고 내용은 그대로다: `"Handles all four shapes we emit"` 이라며 4개 bullet 을 나열한다. 그러나 실제 구현은 `return (A || B || C || D)` (4개) **+ 최상단 legacy 조기 return** (총 5개 이상의 독립 분기)이며, 그중 최소 2개는 4-bullet 목록 어디에도 명시적으로 대응되지 않는다: (1) `hasResultMessages`/`looksLikeConversationEnd` — `output.result.messages` + endReason 화이트리스트 매칭. 이번 커밋이 신설한 테스트가 이 분기를 정확히 `"detects post-Stage-5 ai_agent terminal via output.result.messages + endReason"` 이라는 **별도 이름의 shape** 로 부르고 있어, 코드 스스로 4개보다 많다고 증언한다. (2) `hasConvConfig`(`output.conversationConfig` 단독 존재) — 4-bullet 어디에도 `output.conversationConfig` 패턴이 언급되지 않는다. 이 함수는 plan 문서가 스스로 "대화 UI 전체의 게이트" 라 부르는 안전 임계 함수라, 다음 사람이 "shape 는 4개뿐" 이라 믿고 다섯 번째 분기를 놓칠 위험이 있다.
  - 제안: 이왕 이 JSDoc 을 만지는 김에(SUMMARY#1 의 목적 자체가 이 함수의 문서 위생이었으므로) `output.result.messages`+`endReason` 분기와 `output.conversationConfig` 분기를 bullet 에 추가하거나, "all four shapes" 를 "여러 shape(정확한 개수는 구현부 OR 체인 참고)" 로 완화한다.

- **[INFO]** README 신규 섹션 제목이 "형제 패키지 4개 전부" 와 정확히 일치하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/codebase/packages/ai-end-reason/README.md` (`## 빌드` / `## 사용(Exports)`, SUMMARY#9) vs `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary}/README.md`
  - 상세: 실측 결과 — `chat-channel-validation/README.md` 는 `## 빌드` 절이 아예 없다(`## Exports` 만 존재). `expression-engine`/`node-summary` 는 `## 사용`(Exports 없이)을 쓴다. `graph-warning-rules` 는 `## 주요 export` 를 쓴다. 즉 4개 형제 패키지 중 **어느 것도** 정확히 `## 사용(Exports)` 라는 제목을 쓰지 않고, `## 빌드` 도 3/4 만 갖는다. 커밋 메시지의 "형제 패키지 4개 전부가 갖는 ## 빌드 / ## 사용(Exports) 섹션 추가" 라는 서술이 다소 과장됐다.
  - 제안: 내용 자체(빌드 커맨드 + export 목록 예제)는 유용하고 이번 diff 의 실질적 목적(README parity)을 충분히 달성한다 — 굳이 되돌릴 필요는 없다. 다만 향후 커밋 메시지에서 "전부가 갖는" 같은 정량적 주장을 쓸 때는 이번 작업 자체가 정정한 SUMMARY#10(Dockerfile 주석 drift)과 같은 기준으로 실측 후 표현하는 게 일관적이다.

- **[INFO]** 루트 `README.md` / `PROJECT.md` 의 `codebase/packages` 예시 목록이 이미 stale (본 diff 범위 밖, 사전 존재)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/README.md:107`, `/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e/PROJECT.md:14`
  - 상세: 두 문서 모두 `codebase/packages/*` 를 `expression-engine, node-summary` 두 개만으로 예시한다. 실제로는 7개 패키지(`ai-end-reason` 포함)가 있다. 다만 이 staleness 는 `ai-end-reason` 이전부터 존재했다(`chat-channel-validation`/`graph-warning-rules`/`sdk`/`web-chat-sdk` 추가 시에도 갱신되지 않음) — 본 diff 가 새로 유발한 문제가 아니고, 이번 정리 커밋의 명시적 스코프(WARNING#1,2,5,6,9,10)에도 포함되지 않는다. 참고용으로만 남긴다.
  - 제안: 이번 작업에서 조치할 필요는 없음. 별도 백로그 후보.

## 좋은 점 (참고)

- 신설 테스트 2건(`output-shape.test.ts` 의 화이트리스트 거부 케이스, `interaction-type-registry.test.ts`)의 인라인 주석은 모범적이다 — 단순히 "무엇을" 이 아니라 "왜"(어떤 사각지대를 닫는지, 관련 PR/파일과의 관계)를 명시하고, 후속 유지보수자가 테스트의 존재 이유를 재구성할 필요가 없게 한다.
- SUMMARY#10 의 Dockerfile 주석 개수 정정(`4개→5개`, `6개→7개`)은 실제 `COPY` 라인 수를 직접 grep 하여 재검증한 결과 **정확함**을 확인했다(backend: source COPY 5줄, playwright-e2e: source COPY 5줄 + manifest COPY 7줄).
- SUMMARY#2 의 plan 각주(REGISTRY_SITES 미실행·대체 설계 설명)도 각주가 인용한 실측 근거(`output-shape.ts` 에 `"form"`/`"buttons"` 리터럴 0건, 커밋 `f17fc18dd`/`9df2bb42f` 존재)를 독립적으로 재현했고 모두 정확했다. 이렇게 "실행되지 않은 조치를 조용히 지우지 않고 각주로 남기는" 방식은 plan 문서의 의사결정 이력을 보존하는 좋은 관행이다.
- SUMMARY#1 의 JSDoc 이관 후 `interaction-type-registry.ts` 를 직접 확인한 결과 고아/중복 문서가 남아있지 않고, `{@link MULTI_TURN_INTERACTION_TYPES}` 크로스레퍼런스를 포함한 새 JSDoc 이 잘 작성돼 있다.
- 패키지 README → `spec/conventions/interaction-type-registry.md §4` → `spec/4-nodes/3-ai/{1-ai-agent,3-information-extractor}.md` 백링크 체인을 직접 확인했고 끊어진 링크 없이 일관되게 배선돼 있다.

## 요약

이 커밋은 문서화 관점에서 순수하게 긍정적인 방향의 정리 작업이며, 주장된 수정 사항(JSDoc 재배치, Dockerfile 주석 drift 정정, 신규 테스트의 설명 주석, plan 각주)을 모두 독립적으로 재검증한 결과 사실과 일치했다. 남은 갭은 두 가지 WARNING으로 요약된다 — (1) 이 작업 전체가 사용자 제보 버그를 구조적으로 차단하는 아키텍처 변경임에도 이 저장소의 확립된 "PR당 CHANGELOG 절" 관행(직전 PR 의 리뷰가 명시적으로 요구했던 바로 그 항목)을 아직 충족하지 못했고, (2) 이번에 옮겨진 `isConversationOutput` JSDoc 의 "shape 4개" 서술이 커밋이 신설한 테스트 스스로가 이름 붙인 "post-Stage-5" 분기 등 실제 분기 수보다 적게 잡혀 있다. 나머지는 커밋 메시지 문구의 사소한 과장(INFO)과 이 diff 범위 밖의 기존 staleness(INFO)뿐이다.

## 위험도

LOW
