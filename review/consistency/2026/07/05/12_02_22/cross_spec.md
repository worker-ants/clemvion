# Cross-Spec 일관성 검토 — ai-context-memory-followup-v2 종결 draft

## 검토 대상

- target: `plan/in-progress/spec-draft-ai-context-memory-close.md`
- 검토 모드: spec draft (--spec)
- 영향 spec: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md`
- 특별 검증 지시사항: `0-common.md`·`17-agent-memory.md` 의 `status: partial → implemented` 승격이 타당한지, 즉 두 spec 안에 다른 미구현/Planned v1 surface 가 남아있지 않은지(문서화된 명시적 future-roadmap 항목은 3-execution §6 선례에 따라 허용) 확인.

## 검증 방법

1. 실제 `spec/**` 파일(0-common.md, 17-agent-memory.md, 1-ai-agent.md, conversation-thread.md, 3-information-extractor.md, node-output.md, 3-execution.md, spec-impl-evidence.md)을 직접 읽고 draft 의 각 주장을 코드베이스 grep 으로 재확인.
2. `pending_plans` 참조 4건이 실제 4개 spec frontmatter 와 일치하는지 grep 대조.
3. plan 파일(`ai-context-memory-followup-v2.md`) 의 체크박스 상태와 draft 가 "이미 반영됨" 이라 주장하는 2개 stale 항목을 실제 spec 본문과 대조.
4. `status` 라이프사이클 가드(`spec/conventions/spec-impl-evidence.md §3`)의 전이 규칙과 draft 의 조치가 일치하는지 확인.
5. 3-execution.md §6 "브레이크포인트 (향후 로드맵 — 미구현)" 선례를 직접 읽고 draft 가 원용하는 패턴과 동형인지 비교.

## 발견사항

검토 결과 **CRITICAL/WARNING 급 충돌 없음**. 아래는 검증 과정에서 확인한 사실과 소소한 INFO 관찰이다.

- **[INFO]** status 승격 근거 검증 — 정상
  - target 위치: `## pending_plans 참조 현황` §"status 승격 근거 (0-common · 17-agent-memory)"
  - 대조 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/spec-impl-evidence.md §3`, `spec/3-workflow-editor/3-execution.md §6`
  - 상세: 직접 확인 결과 draft 의 주장이 모두 사실과 일치한다.
    - `17-agent-memory.md §7 "v2 로드맵"` 은 5개 항목(증분추출 AGM-08, TTL AGM-10, 의미기반 dedup AGM-09, 추출분류 AGM-11, 가시화 UI AGM-12/13)을 `~~취소선~~` + "✅ 구현 완료" 로 명시하고, "남은 로드맵" 은 정확히 1건("사용자 식별자 연동" — 최종사용자 식별자 인프라 도입 시에만 유효해지는 조건부 미래 항목)만 남아 있다. 이는 활성 tracking plan 이 없는 명시적 future-roadmap 항목으로, `spec/3-workflow-editor/3-execution.md §6`("브레이크포인트 — 상태: 미구현(로드맵). … v1 범위 밖이며 별도 plan·spec 개정으로 재도입할 때까지 설계 참고용")과 동형 패턴이다. `3-execution.md` 는 이 로드맵 절을 포함한 채로 `status: implemented` 를 유지하고 있어 실제 선례로 확인됨.
    - `0-common.md` 본문 전체(§1~§11 + Rationale)를 읽어도 자체 미구현 surface 는 없다. 유일한 "로드맵" 텍스트(`:165` "v2 로드맵")는 `conversation-thread.md §7`(자신의 로드맵, 별도 spec)로의 포인터일 뿐 0-common 자신의 약속이 아님. `:53` 의 "향후 확장 가능"(Internal MCP Bridge 의 Shopify/Naver 확장)도 `0-overview.md §6.3` 과 동일하게 이미 별도 로드맵 행으로 분리된 확장 계획이지 0-common 자신의 미완성 요구사항이 아니다.
  - 결론: 두 spec 의 `partial → implemented` 승격은 spec-impl-evidence §3 전이 규칙("`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동하는 commit 안에서 승격 **의무**")과 정확히 일치하며, "미래-로드맵 ≠ partial" 판단도 실제 코드/문서 검증상 타당하다.
  - 제안: 없음(현행 유지).

- **[INFO]** pending_plans 4건 참조 정합성 — 정상
  - target 위치: `## pending_plans 참조 현황` 표
  - 대조 대상: `spec/4-nodes/3-ai/0-common.md:13`, `spec/4-nodes/3-ai/1-ai-agent.md:15-17`, `spec/5-system/17-agent-memory.md:7`, `spec/conventions/conversation-thread.md:20-21`
  - 상세: `grep -rn "ai-context-memory-followup-v2" spec/` 결과 정확히 이 4개 파일만 참조하며, draft 표의 "현 pending_plans" 열과 실제 frontmatter 가 일치한다. `1-ai-agent.md` 잔존 2건(`ai-agent-tool-connection-rewrite.md`, `exec-park-durable-resume.md`)과 `conversation-thread.md` 잔존 1건(`exec-park-durable-resume.md`)은 모두 `plan/in-progress/` 에 실제로 존재해 `partial` 유지가 타당하다.
  - 제안: 없음.

- **[INFO]** stale-checkbox 2건의 "이미 main 반영" 주장 재검증 — 정상
  - target 위치: `## 배경 (group A 재검증 결론)` 항목 1·2
  - 대조 대상: `spec/conventions/node-output.md:90`, `spec/4-nodes/3-ai/3-information-extractor.md:163,694`
  - 상세: 직접 읽어 확인한 결과 두 파일 모두 draft 가 주장하는 최종 상태와 문자 그대로 일치한다(`node-output.md:90` = "**`ai_agent` 전용**" + `information_extractor` 는 `meta.memory` 를 echo 하지 않는다는 명시 + AI Agent §7.1 SoT 링크; `3-information-extractor.md:163,694` = `memoryState.lastExtractionTurnSeq`(I12) + 구 평면 키 폴백 병기). 두 항목을 `[x]` 로 정정하는 draft 의 판단은 코드/spec 실제 상태와 부합한다.
  - 제안: 없음.

- **[INFO]** webchat-widget-refactor.md 이동은 spec 무영향
  - target 위치: `## 변경` 항목 6
  - 대조 대상: `spec/**` 전체
  - 상세: `grep -rln "webchat-widget-refactor" spec/` 결과 0건 — draft 의 "spec 무관(spec_impact:[])" 주장과 일치. 이 plan 이동은 어느 spec frontmatter 의 `pending_plans` 도 참조하지 않으므로 본 종결 PR 에 동봉해도 dangling reference 위험이 없다.
  - 제안: 없음.

- **[INFO]** "editor" 프로시저 성격의 draft — 데이터 모델/API/RBAC/상태전이 변경 없음
  - target 위치: draft 전체
  - 대조 대상: `spec/1-data-model.md`, `spec/0-overview.md` 등
  - 상세: 본 draft 는 순수 frontmatter(`status`, `pending_plans`) 조정 + plan 파일 이동만 다루며, 엔티티 필드·API 계약·요구사항 ID·상태 머신·RBAC 규칙 어느 것도 신규 정의하거나 변경하지 않는다. 따라서 cross-spec 충돌 관점(데이터 모델/API/요구사항 ID/상태 전이/RBAC/계층 책임)에서 구조적으로 위험이 낮은 draft 이다.
  - 제안: 없음.

## 요약

target draft 는 이미 완료된 `ai-context-memory-followup-v2` plan 을 spec-impl-evidence §3 절차대로 종결하고, `pending_plans` 가 비게 되는 두 spec(`0-common.md`, `17-agent-memory.md`)을 `implemented` 로 승격하는 순수 bookkeeping 성격의 draft다. 특별 검증 지시사항(승격 타당성)을 코드/spec 원문 직접 대조로 재확인한 결과, `17-agent-memory.md §7` 의 "남은 로드맵"은 활성 tracking plan 없는 명시적 future-roadmap 1건뿐이고 `3-execution.md §6` 의 breakpoint 로드맵 선례와 동형이며, `0-common.md` 는 자체 미구현 surface 가 전혀 없음을 확인했다. `pending_plans` 4건 참조 현황, stale-checkbox 2건의 "이미 반영됨" 주장, `webchat-widget-refactor.md` 이동의 spec 무관성도 모두 실제 파일 대조로 검증되어 draft 의 서술과 정확히 일치한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 target 이 다른 spec 영역과 모순되는 지점을 발견하지 못했다.

## 위험도

NONE
