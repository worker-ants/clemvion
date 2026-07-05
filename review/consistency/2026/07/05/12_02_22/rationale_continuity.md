# Rationale 연속성 Check — spec-draft-ai-context-memory-close.md

## 대상

- target: `plan/in-progress/spec-draft-ai-context-memory-close.md`
- 검토 모드: spec draft 검토 (--spec)
- 관련 spec: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md`, `spec/conventions/spec-impl-evidence.md`

## 검증 절차 요약

target 이 인용하는 사실 claim 을 실제 spec/plan 파일과 대조 검증했다.

1. **plan checkbox 실제 상태** — `plan/in-progress/ai-context-memory-followup-v2.md` 잔여 `[ ]` 2건(node-output.md meta.memory 행, 3-information-extractor.md watermark 참조)을 확인. `spec/conventions/node-output.md:90`, `spec/4-nodes/3-ai/3-information-extractor.md:163,694` 를 직접 대조한 결과 target 의 claim(이미 main 반영)이 코드/spec 현황과 일치.
2. **frontmatter pending_plans 현황표** — 4개 spec 의 실제 frontmatter(`0-common.md`, `1-ai-agent.md`, `17-agent-memory.md`, `conversation-thread.md`)를 열람해 target 표(현재값·제거후값)와 대조 — 완전 일치.
3. **"미래-로드맵 ≠ partial" 선례** — target 이 근거로 든 `3-execution §6 breakpoint 로드맵` 사례를 `spec/3-workflow-editor/3-execution.md` 에서 확인. `status: implemented` + §6 "브레이크포인트 (향후 로드맵 — 미구현)" + Rationale "§6 브레이크포인트 약속 surface 의 v1 제외" 항목이 실재하며, target 이 인용한 패턴(frontmatter implemented + 로드맵 절 유지)과 정확히 동형.
4. **spec-impl-evidence §3.1 전이 규칙** — "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)" 규약과 target 변경 2·3 이 정확히 부합.
5. **R-5 (`pending_plans:` 의무화 — dangling 방지)** — target 의 "기각 대안 (b) plan 만 이동하고 frontmatter 방치 → dangling pending_plans 유발" 서술이 `spec-impl-evidence.md R-5`(텔레그램 chat-channel dangling 사례, "역방향 링크 없으면 영구 누락" 근거)와 정합.
6. **17-agent-memory.md §7 "v2 로드맵"** — "실현됨(v2)" 5건 + "남은 로드맵" 1건(사용자 식별자 연동)이 target 서술과 완전 일치.
7. **0-common.md `:165`** — "상세 규약(… v2 로드맵) 은 [Spec Conversation Thread] 참조" 라는 포인터 문장 확인 — target 의 "0-common 자신의 미구현이 아니라 conversation-thread 로드맵으로의 포인터" 주장과 일치.

## 발견사항

검토 관점 1~4(기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 가정 충돌) 전반에 걸쳐 CRITICAL/WARNING 급 문제를 발견하지 못했다. target 은 새로운 설계 결정을 도입하는 spec 이 아니라, 이미 codebase 에 반영된 상태를 spec frontmatter/plan lifecycle 에 뒤늦게 동기화하는 "정리성" 변경이며, 인용하는 모든 선례·규약이 실제로 존재하고 일치한다.

- **[INFO]** `partial`→`implemented` 승격 후 §7 "남은 로드맵" 표기가 유일한 잔존 약속이 되는데, 그 항목(사용자 식별자 연동)에 대응하는 활성 plan 이 전혀 없다는 점을 target Rationale 이 이미 명시("활성 tracking plan 이 없는 명시적 future-roadmap")하고 있어 이는 문제가 아니라 의도된 상태다. 다만 `spec-impl-evidence.md §3` 표는 `implemented` 상태의 `pending_plans:` 를 "없음" 으로 규정하므로, 향후 "사용자 식별자 연동" 을 실제로 착수할 때 재차 `partial` + 신규 `pending_plans` 로 되돌리는 절차가 필요하다는 점을 spec-draft 체크리스트나 §7 텍스트에 한 줄 명시해 두면 향후 담당자의 재확인 비용을 줄일 수 있다(강제 사항 아님, 가독성 제안).
  - target 위치: `## Rationale` "미래-로드맵 vs partial" 항
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙, `spec/3-workflow-editor/3-execution.md §6` 선례
  - 상세: 선례(3-execution §6)와 마찬가지로 "로드맵 재개 시 partial 로 되돌린다" 는 것은 §3.1 전이 규칙(`backlog`→`spec-only`→`partial`)에서 이미 함의되나 명문화되어 있지는 않음.
  - 제안: 선택 사항. 굳이 target 을 수정할 필요는 없음 — spec-impl-evidence 자체의 전이 규칙이 이미 일반 규약으로 커버.

## 요약

target 문서는 새 설계 결정을 도입하지 않고, 이미 main 에 반영된 구현 상태를 spec frontmatter(pending_plans/status)와 plan lifecycle(`in-progress`→`complete`)에 뒤늦게 정합시키는 절차적 정리(spec-impl-evidence §3 종결 흐름)다. target 이 인용하는 모든 사실적 근거 — plan checkbox 잔여 2건의 실제 반영 여부, 4개 spec frontmatter 의 현재/변경후 상태, "미래-로드맵→implemented+로드맵표기" 선례(3-execution §6), dangling pending_plans 방지 원칙(R-5) — 를 원본 파일과 직접 대조 검증한 결과 전부 정확했다. 기각된 대안의 무단 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 등 Rationale 연속성을 해치는 패턴은 발견되지 않았으며, 오히려 target 은 spec-impl-evidence 의 명시적 승격 규약(§3.1)과 과거 선례를 정확히 인용해 self-consistent 하게 논거를 구성하고 있다.

## 위험도

NONE
