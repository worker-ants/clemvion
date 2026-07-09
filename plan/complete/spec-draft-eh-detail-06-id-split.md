---
worktree: eh-detail-06-id-drift-baa21f
started: 2026-07-09
completed: 2026-07-09
owner: project-planner
spec_impact:
  - spec/2-navigation/14-execution-history.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/conventions/conversation-thread.md
  - spec/conventions/data-hydration-surfaces.md
  - spec/0-overview.md
---

# spec-draft: EH-DETAIL-06 요구사항 ID 범위 드리프트 해소 (ID 분리)

## 배경

`/consistency-check --impl-done` (슬러그 라우팅 하드닝 #866, review/consistency/2026/07/09/11_31_49)
cross_spec 이 발견한 pre-existing spec-vs-spec 드리프트. 하나의 요구사항 ID `EH-DETAIL-06` 이
**서로 다른 범위·완료 상태**로 두 곳에서 쓰인다:

- **owner** `spec/2-navigation/14-execution-history.md:57` — "Preview 탭: … AI Agent 노드는 대화
  내역 + 메시지별 상세 …" = **단일 노드 Preview 탭**(한 AI Agent 노드 실행 범위), **✅ 구현 완료**.
- **참조 4문서** — 동일 ID 를 "**여러 노드에 걸친 cross-node ConversationThread 재구성 derived
  view**"(v2, 미구현, 미해결 과제)로 지칭:
  - `spec/4-nodes/3-ai/1-ai-agent.md:1156`
  - `spec/conventions/data-hydration-surfaces.md:72`
  - `spec/conventions/conversation-thread.md:215, 294, 296, 347, 417`

즉 (a) 이미 완료된 좁은 요구사항과 (b) 아직 미해결인 넓은 요구사항이 같은 ID 를 공유 → EH-ID 로
상태를 판단하는 사람·도구(spec-coverage)가 "EH-DETAIL-06 = 완료" 또는 "미구현" 으로 오판 위험.
특히 `conversation-thread.md:417` 은 "§EH-DETAIL-06 의 ConversationThread 재구성 정책에 위임"
한다고 하나, owner 문서의 EH-DETAIL-06 행에는 그 "cross-node 재구성 정책"이 실재하지 않는다
(단일 노드 Preview 만 서술) → **dangling 위임**.

## 변경 (해소안: ID 분리)

기존 EH-DETAIL ID 는 01–11. **신규 `EH-DETAIL-12`** 발급.

- `EH-DETAIL-06` = 단일 AI Agent 노드 Preview 탭 (✅ 완료) — **의미·상태 불변**. 혼동 방지용
  괄호 각주만 추가("단일 노드 범위; cross-node 통합 뷰는 EH-DETAIL-12").
- `EH-DETAIL-12` (신규) = 실행 상세의 **cross-node ConversationThread 재구성 view** (여러 노드
  presentation/AI turn 을 seq·timestamp·source 로 interleave 한 통합 대화 뷰, NodeExecution 분산
  저장에서 재구성하는 derived view). **v2·미구현 → status ❌ (v2)**, 우선순위 권장.

### 파일별 편집

1. **`spec/2-navigation/14-execution-history.md`** (owner)
   - EH-DETAIL-06 행 요구사항 문구 끝에 각주 추가: "(단일 AI Agent 노드 범위; 여러 노드 통합
     ConversationThread 뷰는 EH-DETAIL-12)".
   - EH-DETAIL-11 다음에 신규 행:
     `| EH-DETAIL-12 | (v2) cross-node ConversationThread 재구성 view — 여러 노드의 presentation/AI turn 을 seq·timestamp·source 로 interleave 한 통합 대화 뷰. NodeExecution 분산 저장(output.interaction + output.result.messages)에서 재구성하는 derived view (park resume 스냅샷과 소비처 분리). 정책·UI 미정 — 모델은 conversation-thread.md §7 | 권장 | ❌ (v2) |`

2. **`spec/4-nodes/3-ai/1-ai-agent.md:1156`** — "EH-DETAIL-06" → "EH-DETAIL-12".

3. **`spec/conventions/data-hydration-surfaces.md:72`** — "EH-DETAIL-06" → "EH-DETAIL-12".

4. **`spec/conventions/conversation-thread.md`** — 5곳(215/294/296/347/417) "EH-DETAIL-06" →
   "EH-DETAIL-12". 417 의 링크 표시 텍스트도 `§EH-DETAIL-12` 로(링크 대상은 파일이라 anchor 불변).

5. **`spec/0-overview.md` §6.3 로드맵/미구현(❌) 표** — 신규 로드맵 행 추가(선례 정합):
   `| **실행 상세 cross-node ConversationThread 뷰** | 여러 노드의 presentation/AI turn 을 통합한 대화 뷰 재구성 (derived view). 단일 노드 Preview 는 §6.1 EH-DETAIL-06 ✅. 상세: [Execution History EH-DETAIL-12](./2-navigation/14-execution-history.md), [conversation-thread §7](./conventions/conversation-thread.md). |`
   — `14-execution-history.md` 는 `status: implemented` 유지(§6.1 전량 구현), v2 항목만 로드맵 표에 미러.

## Rationale

- **왜 (b) 분리 vs (a) 각주만**: 각주(a)는 EH-DETAIL-06 이 계속 두 요구사항(완료+미해결)을 동시에
  지칭해 "1 ID = 1 요구사항 1 status" 규약을 위반한 채 남는다. 분리(b)는 완료(EH-DETAIL-06)와
  v2 미해결(EH-DETAIL-12)을 각자의 ID·status 로 회복시켜 spec-coverage 오판을 근본 제거하고,
  dangling 위임(conversation-thread.md:417)도 실재 대상(EH-DETAIL-12 행)을 갖게 한다.
- **왜 owner 를 14-execution-history.md 로**: EH-DETAIL-* 는 실행 상세 UI 요구사항 네임스페이스이며,
  cross-node 통합 뷰도 실행 상세 페이지의 (미래) UI 이므로 동일 네임스페이스가 자연스럽다.
- **왜 ❌ (v2)**: 본 spec 요구사항 표 마커 컨벤션(✅ 완료 / ❌ 미구현 / 🚧 진행중) 준수. 코드에
  cross-node 재구성 구현 부재 확인(cross_spec).
- **범위**: 순수 spec 문서 정합화. 코드·데이터모델·API 무변경. 슬러그 라우팅 하드닝 #866(FE-only)과
  무관한 pre-existing 이슈를 분리 처리.
- **판정 계보(rationale_continuity INFO)**: 과거(2026-06-05/06-11) 이 ID 재사용은 "참조 용도 무해"
  INFO 로 봤으나, cross_spec(2026-07-09, #866 impl-done)이 owner 문서 **✅ 완료** 상태와 참조처
  **v2 미해결** 서술의 실제 충돌(dangling 위임 포함)을 지적해 재평가함.
- **`status: implemented` 유지 + §6.3 미러(convention_compliance WARNING 해소)**: `spec-impl-evidence.md`
  §3 상 implemented=전 약속 완료지만, 저장소 선례(`graph-rag.md`·`conversation-thread.md` 의 v2/❌
  항목)는 문서 status 를 implemented 로 두고 미구현 v2 항목을 `0-overview.md §6.3 로드맵` 표에
  **짝지어 등재**한다. 본 draft 도 동일 패턴을 따라 §6.3 에 EH-DETAIL-12 로드맵 행을 추가 →
  `partial`+`pending_plans` 전환 불요(§6.1 전 요구사항 실제 구현 완료, v2 항목만 로드맵 추적).
- **후속 안내(plan_coherence INFO)**: 향후 cross-node ConversationThread v2 착수 plan 은
  `EH-DETAIL-06` 이 아니라 `EH-DETAIL-12` 를 인용할 것.
