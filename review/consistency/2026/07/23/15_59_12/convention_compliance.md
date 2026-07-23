# 정식 규약 준수 검토 — presentation-previousoutput-spec-drift.md

target: `plan/in-progress/presentation-previousoutput-spec-drift.md`
검토 모드: spec draft 검토 (`--spec`)

## 검토 방법

target 이 인용하는 SoT(=`spec/conventions/node-output.md` §4.2, `spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md`,
`spec/5-system/4-execution-engine.md` §7.4/§9.3, `codebase/backend/src/modules/execution-engine/button-interaction.service.ts`)
를 실제 리포지토리에서 직접 열어 문구·라인번호·anchor 를 전수 대조했다 (prompt_file 에 번들된 conventions 발췌가
`cafe24-api-catalog` 로 용량을 소진해 `node-output.md` 를 포함하지 못했으므로 — 이 자체는 하네스 번들링 이슈이며 target 의
결함은 아니다).

## 발견사항

- **[WARNING]** 트리거 근거 링크가 이 worktree 에서 dangling
  - target 위치: 상단 인용문 "> 트리거: `/consistency-check --impl-done spec/4-nodes/6-presentation` (`review/consistency/2026/07/23/15_33_52/`) 의 **CRITICAL 1건**." 및 "귀속 판정: 같은 디렉터리 [`ADJUDICATION.md`](../../review/consistency/2026/07/23/15_33_52/ADJUDICATION.md)"
  - 위반 규약: 직접적으로 강제하는 `spec/conventions/*` 항목은 없음(`spec-link-integrity` 가드는 `spec/**` 대상이며 `plan/**`·`review/**` 는 스코프 밖) — 다만 CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 표의 "리뷰 산출물은 커밋 대상" 원칙과 결이 어긋난다.
  - 상세: 이 worktree(`presentation-previousoutput-spec-drift-e74b2f`) 의 `review/consistency/2026/07/23/` 아래에는 지금 이 검토가 만든 `15_59_12/` 만 존재하고, target 이 인용하는 `15_33_52/`(및 그 안의 `ADJUDICATION.md`)는 이 worktree 어디에도 없다(`git log --all`·전 worktree 탐색으로 확인, 커밋되지 않음). 트리거가 된 이전 `--impl-done` 검토는 별 worktree(구현 worktree)에서 돌았을 것으로 추정되며, 그 산출물이 아직 커밋되지 않았다면 이 링크는 독자 입장에서 영구 dangling 이다.
  - 제안: 인용 근거를 이 문서에 요약(핵심 문구 인용)으로 self-contained 하게 남기거나, 원 리뷰 산출물이 실제로 커밋됐는지 확인 후 경로를 교정. build 가드가 안 걸리는 영역이라 사람이 직접 검증해야 한다.

- **[INFO]** 동반 정정 A 의 "3곳" 카운트가 grep 으로는 2곳만 확인됨
  - target 위치: "## 동반 정정" 표 A행 — "`0-common.md` §10.9 본문·Rationale·"4-layer SSOT 정렬" **3곳**"
  - 위반 규약: 없음(순수 사실 정확도 이슈, conventions 위반 아님) — 참고용으로만 남김.
  - 상세: `spec/4-nodes/6-presentation/0-common.md` 에서 Continuation Bus 관련 "5종" 텍스트는 §10.9 본문(:394) 과 "4-layer SSOT 정렬" 불릿(:426) 2곳뿐이며, 둘 다 `## Rationale`(:432) **이전**(§10.9 섹션 내부)에 있다. `## Rationale` → "form submission wire format wrap" 절(:553-580)에는 "5종" 문구가 없다(해당 절은 "dispatch 4 케이스" 라는 별개 카운트를 다룬다). 실행자가 "Rationale" 안에서 세 번째 "5종" 자리를 찾다 헛수고할 수 있다.
  - 제안: 착수 시 "본문(:394) + 4-layer SSOT 정렬 불릿(:426)" 2곳으로 재확인하거나, Rationale 절에 실제로 손댈 지점이 있는지(예: "4-layer SSOT 정렬" 라벨이 §10.9 본문 지시만 하고 자체 카운트가 없는 지점 :578) 정정.

- **[INFO]** 용어 어순의 사소한 drift (참고, 강제 규약 없음)
  - target 위치: "### 제안 문구" 각주 초안 — "(과도기 legacy — [node-output §4.2]...)"
  - 위반 규약: 없음.
  - 상세: 코드 주석은 "legacy transitional field", `node-output.md` §4.2 는 "transitional legacy 필드" 로 이미 어순이 다르고, target 의 제안 문구는 "과도기 legacy" 로 또 다른 표현을 쓴다. 의미는 동일하나 세 곳이 조금씩 다른 표현을 쓰고 있어 grep 검색성이 약간 떨어진다.
  - 제안: 굳이 통일할 필요는 없음 — SoT 링크(§4.2)로 값 도메인을 참조하게 하는 target 의 설계가 이 drift 의 실질적 위험을 이미 낮췄다.

## 준수 확인 (양성 소견)

- **anchor 포맷**: 제안 문구가 쓰는 `../../conventions/node-output.md#42-폐기할-필드--구조` 는 `spec/4-nodes/3-ai/1-ai-agent.md:757` 이 이미 쓰고 있는 동일 anchor(`#42-폐기할-필드--구조`)와 일치 — 신규 anchor 포맷을 만들지 않고 기존 관례를 그대로 재사용했다. 상대경로도 삽입 대상 파일(`spec/4-nodes/6-presentation/**`) 기준으로 정확하다(`spec/4-nodes/6-presentation/` → `../../` = `spec/` → `conventions/node-output.md`).
- **SoT 인용의 사실 정확도**: `spec/conventions/node-output.md` §4.2 의 "단 Phase 3 완료 전 과도기 예외 …" 문구, `button-interaction.service.ts` 의 "legacy transitional field … Phase 3 precondition" 주석, `spec/4-nodes/6-presentation/{0-common.md:136, 3-chart.md:228,271, 4-form.md:258}` 의 4곳 문구를 모두 실측 대조했고 target 의 인용과 정확히 일치한다.
- **동반 정정 B 실측**: `0-common.md` Rationale "form submission wire format wrap" 절에 `waitForAiConversation`(:557,:570) / "loop 재진입"(:559,:572) 이 실제로 잔존하며, 같은 문서 §10.9 본문(:396-412)은 이미 `processAiResumeTurn` 으로 갱신돼 있어 문서 **내부 자기모순**(§10.9 본문 vs Rationale)이 실재함을 확인 — target 의 "동일 문서 §10.9 본문과 통일" 방향은 타당하다.
- **frontmatter 스키마**: `worktree`/`started`/`owner` 3필드 모두 `.claude/docs/plan-lifecycle.md` §4 스키마를 만족(`in-progress` 단계라 `spec_impact` 는 아직 의무 아님, 이 역시 §4 와 일치).
- **정보 저장 위치 원칙**: "값 도메인 SoT 는 `node-output.md` §4.2" 로 명시하고 각 spec 문서가 그 문구를 반복하지 않게 링크로 위임한 설계는 CLAUDE.md "정식 규약 → `spec/conventions/<name>.md`" 라우팅 원칙 및 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙(체크리스트 4번 항목)과 정합.
- **Principle 11(출력 예시 문서화 규칙) 과의 긴장 처리**: `1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시에 `previousOutput` 을 신규로 그려 넣지 않기로 한 결정(§비목표)은 "신규 소비 금지" 의도와 상충 신호를 줄 위험을 피하려는 의식적 트레이드오프이며, target 은 이를 Rationale 에 기록하도록 체크리스트에 명시했다 — Principle 11 이 요구하는 "완전한 케이스별 예시"와 배치될 수 있는 지점을 침묵 처리하지 않고 정면으로 판단 근거를 남기는 방식이라 규약 취지에 부합한다.

## 요약

target 은 spec draft 자체가 아니라 spec 수정을 준비하는 plan 문서이며, 인용하는 모든 1차 SoT(`node-output.md` §4.2, presentation 4곳, execution-engine.md §7.4/§9.3, 코드 주석)를 실측 대조한 결과 사실관계·anchor 포맷·상대경로 모두 기존 규약·관례와 정확히 일치한다. plan frontmatter 도 `plan-lifecycle.md` §4 스키마를 만족하고, "SoT 는 conventions 로 위임 + Rationale 에 근거 기록"이라는 설계도 CLAUDE.md 의 정보 저장 위치 원칙과 정합적이다. 발견된 문제는 두 가지뿐이며 둘 다 conventions 직접 위반이 아니라 문서 자체의 정확도 이슈다: (1) 트리거 근거로 인용한 이전 리뷰 산출물(`review/consistency/2026/07/23/15_33_52/ADJUDICATION.md`)이 이 worktree 에 커밋돼 있지 않아 dangling(WARNING), (2) 동반 정정 A 가 "3곳"이라 명시했지만 grep 상 실체가 확인되는 곳은 2곳뿐(INFO). CRITICAL 급 정식 규약 위반은 없다.

## 위험도

LOW
