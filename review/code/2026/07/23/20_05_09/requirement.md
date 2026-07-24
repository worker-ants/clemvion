# 요구사항(Requirement) 리뷰 — presentation §4.6 excludeFromConversationThread drift 정정

대상: `plan/in-progress/presentation-thread-optout-drift.md`(신규), `plan/in-progress/node-output-redesign/form.md`(각주 추가),
`spec/4-nodes/6-presentation/0-common.md` §4.6, `spec/conventions/conversation-thread.md` §2.4,
`review/consistency/2026/07/23/19_48_09/*`(신규 consistency-check 산출물 8개).

## 사실관계 실측 검증 (모두 코드/git 대조로 확인)

리뷰 대상 문서들이 인용하는 코드 라인·카운트·커밋을 전수 재검증했다 — 전부 정확했다:

- `ConversationThreadService.appendInternal`(`conversation-thread.service.ts:202`) 첫 줄 `if (this.isOptedOut(args.node)) return;`, `isOptedOut`(`:243`) `node.config?.excludeFromConversationThread === true` — 정확.
- `appendPresentationInteraction`/`appendAiUserMessage`/`appendAiAssistantMessage`/`appendAiToolResult` 4개 전부 `appendInternal` 경유(`:86,99,121,147`) — "노드 종류 무관 단일 진입점" 주장 정확.
- `form-interaction.service.ts:280`, `button-interaction.service.ts:534` 의 `appendPresentationInteraction` 호출 — 정확.
- presentation 5개 schema `excludeFromConversationThread` grep **0건**, `.passthrough()` 개수(carousel/table/form 9·template 7·chart 4, 합 38) — 정확.
- `form.handler.ts:44` `config: { ...rawConfig }` spread, `node-output.md` Principle 7 D1(`:320`) "❌ 금지 — spread 패턴" — 정확. D1 위반 진단은 코드·spec 대조로 사실.
- `conversation-context-schema.ts:27` `const GROUP = 'Conversation Context';` — 정확.
- 인용 커밋 4개(`db496a3c2`=#516, `c097067f3`=2026-05-14 §4.6 최초 도입 및 "UI 그룹: Advanced > Conversation" 원 문구 도입, `150d45c19`=D1 baseline, `3d0bcd69b`=#997) 전부 존재 + 내용 일치.
- `spec-impl-evidence.md §3` status 라이프사이클(`partial`→`pending_plans` 의무) 서술 정확.
- docs 가드 스위트(`codebase/frontend/src/lib/docs/__tests__`) 재실행 결과 **18 files / 2661 tests 전부 pass** — plan `## 검증` 절의 주장과 일치.

이 정도로 코드 실측 기반 진술이 촘촘히 검증된 spec-drift 정정 작업은 이례적으로 신뢰도가 높다. 아래 발견사항은 이 신뢰도 높은 본체가 아니라 **부수 산출물(SUMMARY.md 집계, 체크리스트 완결성)의 정확도** 문제다.

## 발견사항

- **[WARNING]** `SUMMARY.md` 의 WARNING #1 테이블 행이 `convention_compliance` 를 공동 제기 checker 로 잘못 귀속 — 해당 checker 는 같은 주제를 INFO 로만 평가했다
  - 위치: `review/consistency/2026/07/23/19_48_09/SUMMARY.md:16` (`| 1 | cross_spec, rationale_continuity, convention_compliance | ...`)
  - 상세: WARNING #1 은 "`conversation-thread.md §2.4` 대칭 편집 미pin" 주제다. 그러나 `convention_compliance.md` 를 직접 열어 확인한 결과 이 checker 가 §2.4 관련해 남긴 발견은 **`[INFO]`** 항목("체크리스트 항목 4… 실측 근거가 이미 target 자체 조사로 확인됨 — 누락 방지 차원의 확인", `convention_compliance.md:46`) 하나뿐이며, 이 checker 의 유일한 `[WARNING]`(`convention_compliance.md:7`)은 완전히 다른 주제(frontmatter `status`/`pending_plans` 충돌 — SUMMARY 의 WARNING #2 주제)다. `SUMMARY.md` 자신의 "## Checker별 위험도" 절(`:37`)도 이를 뒷받침한다 — `convention_compliance` 행은 "frontmatter status/pending_plans 가드 충돌 리스크(WARNING) + §4.6 헤딩 레벨·§2.4 정합 확인(INFO 2건)" 이라 적어 §2.4 를 INFO 로 정확히 분류한다. 즉 `SUMMARY.md` 본문 안에서 WARNING 테이블(:16)과 Checker별 위험도 표(:37)가 **서로 모순**된다 — 전자는 §2.4 를 convention_compliance 의 WARNING 으로, 후자는 같은 checker 의 INFO 로 적는다.
  - 제안: WARNING #1 행의 Checker 열에서 `convention_compliance` 를 제거(`cross_spec, rationale_continuity` 만 남김)하거나, 두 표가 일치하도록 재집계. 이 SUMMARY 는 `plan/in-progress/presentation-thread-optout-drift.md` 의 "`--spec` 검사 반영" 표가 그대로 인용하는 근거 문서이므로(그쪽은 다행히 WARNING 번호·pin 내용만 인용하고 checker 귀속은 재인용하지 않아 실제 처리 방향에는 영향 없음), 향후 이 세션 산출물을 근거로 재집계할 사람이 오귀속을 그대로 물려받을 위험을 예방하기 위한 정정.

- **[WARNING]** 체크리스트 "developer 후속 task 등록"(WARNING 3 처방)이 실제로는 추적 가능한 백로그 항목 없이 인라인 각주로만 종결됨
  - 위치: `plan/in-progress/presentation-thread-optout-drift.md` 체크리스트 4번째 항목("sibling `node-output-redesign/form.md:154` 에 D1 재검토 각주 + developer 후속 task 등록 (WARNING 3)") — `[x]` 로 완료 표기.
  - 상세: 실제 diff 는 `plan/in-progress/node-output-redesign/form.md` 에 인라인 blockquote 각주 1개만 추가한다(`> ⚠️ D1 재검토 필요 (2026-07-23 재발견): … 수정은 developer 범위(별건).`). `git diff --stat` 로 확인한 전체 변경 파일 12개 중 이 D1 위반을 **별도로 추적하는 신규 항목**(새 backlog 파일, `node-output-redesign/form.md` 자체의 `## 종합 개선안` 체크리스트에 `- [ ]` 추가 등)은 어디에도 없다. `plan_coherence.md`(review 대상 파일 자체)가 사전에 정확히 이 갭을 지적했었다("target 체크리스트에는 이 발견을 별도 백로그로 등록하는 항목이 없고 … '별건 백로그로 분리한다'는 서술만 있고 실제 분리(신규 plan 항목 생성)가 없다", `plan_coherence.md:9-11`) — 이번 최종 diff 는 그 처방 중 "각주 추가"만 실행했고 "developer 후속 task 등록"(신규 추적 가능 항목 생성)은 여전히 미이행이다. 각주는 이미 완료 판정된 sibling plan(`node-output-redesign/form.md`, 활성 체크리스트 항목 아님) 본문 중간에 묻혀 있어, 향후 grooming 스캔에서 재발견되지 않고 누락될 위험이 실재한다.
  - 제안: `node-output-redesign/form.md` 의 `## 종합 개선안` 체크리스트(현재 2항목, `:187-188` 부근)에 `- [ ] (impl) form.handler.ts:44 의 { ...rawConfig } spread 를 명시 enumeration 으로 전환 (D1 위반, 2026-07-23 재발견)` 을 실제로 추가하거나, 별도 `plan/in-progress/` 항목을 신설해 checklist 문구("등록")와 실제 산출물을 일치시킨다.

- **[INFO]** `plan_coherence.md` 파일에 sub-agent 반환 프로토콜 헤더(`STATUS=... / ===REPORT_MARKDOWN_BELOW===`)가 리포트 본문 앞에 그대로 커밋됨 — 형제 checker 파일들과 형식 불일치
  - 위치: `review/consistency/2026/07/23/19_48_09/plan_coherence.md:1-2`
  - 상세: `cross_spec.md`/`convention_compliance.md`/`naming_collision.md`/`rationale_continuity.md` 는 모두 `### 발견사항` 또는 `#` 제목으로 바로 시작하는데, `plan_coherence.md` 만 `STATUS=success plan_coherence review complete (1 WARNING, 1 INFO)` 헤더 + 구분자 줄이 파일 내용으로 커밋돼 있다. `subagent-call-contract.md §7` 이 설명하는 기존에 알려진 하네스 특성(Workflow 경유 호출 시 "STATUS 헤더 + delimiter + 전문" 규약이 prompt 에 덧붙고, 그 원문이 그대로 저장되는 경우가 있음)과 일치해 이번 작업이 새로 만든 결함은 아니나, 이 파일을 순수 markdown 리포트로 재소비하는 후속 자동화(예: 다음 세션의 grep 기반 재집계)가 헤더 텍스트를 첫 발견사항으로 오인할 여지가 있다.
  - 제안: 필수 아님 — 소비 측(SUMMARY 재집계 스크립트)이 첫 2줄 스킵 로직을 갖고 있는지만 별도 확인 권고. 이번 diff 를 되돌릴 필요는 없다.

## 요약

`plan/in-progress/presentation-thread-optout-drift.md` 와 그에 따른 `spec/4-nodes/6-presentation/0-common.md §4.6` / `spec/conventions/conversation-thread.md §2.4` 개정은 요구사항(§4.6 이 서술하는 "동작"과 "표면" 을 층위 분리해 정확히 재서술)을 완전하고 정확하게 충족한다 — 인용된 모든 코드 라인·건수·커밋을 독립적으로 재검증했고 예외 없이 일치했으며, docs 가드 스위트도 실제로 18 files/2661 tests 전부 통과했다. `--spec` consistency-check 가 pin 한 WARNING 1(§2.4 대칭 캐비어)·WARNING 2(status 유지)·WARNING 4(UI 그룹 라벨 삭제)는 diff 에 정확히 반영됐다. 다만 (1) 그 consistency-check 산출물 `SUMMARY.md` 자체에 WARNING 테이블과 "Checker별 위험도" 표가 서로 모순되는 checker 귀속 오류가 있고, (2) WARNING 3("form.handler.ts D1 위반 별건 분리")의 "developer 후속 task 등록" 부분이 체크리스트에는 완료(`[x]`)로 표기됐으나 실제로는 추적 가능한 산출물 없이 인라인 각주 하나로만 종결돼 checklist 문구와 실제 상태 사이 괴리가 있다 — 둘 다 비차단이며 spec/코드 자체의 정확성에는 영향이 없다.

## 위험도

LOW
