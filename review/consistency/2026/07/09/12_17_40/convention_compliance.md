<!-- main 이 journal(wf_69efdc97-165)에서 복원 — subagent write 격리. -->

## 발견사항

- **[WARNING]** 신규 `EH-DETAIL-12` (v2·미구현) 행 추가가 owner 문서의 `status: implemented` 프런트매터와 충돌할 소지
  - target 위치: "변경 (해소안: ID 분리)" §"파일별 편집" 1번, `spec/2-navigation/14-execution-history.md` 요구사항 표에 `EH-DETAIL-12 | ... | 권장 | ❌ (v2)` 행 신설
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (`status` 라이프사이클) — `implemented` = "모든 약속 구현 완료", `partial` = "일부 구현됨 → `pending_plans:` **의무**"
  - 상세: `14-execution-history.md` frontmatter 는 `status: implemented` 를 유지한 채로, 본문 핵심 "요구사항" ID 표(EH-DETAIL)에 명시적으로 **미구현(❌ v2)** 요구사항을 신규로 등재한다. 이 표는 파일 전체가 implemented 임을 뒷받침하는 promise ledger 로 기능해 왔고(기존 11행 전부 ✅), 이번에 처음으로 미구현 promise 가 같은 표에 섞여 들어간다. `spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts` 는 body 의 개별 요구사항 행을 파싱하지 않으므로 build 는 통과하지만, 본 컨벤션이 막으려는 "spec 약속 vs 구현 부재" 갭(§Overview 가 명시하는 텔레그램 chat-channel 사례)과 형태상 유사한 패턴이다. `pending_plans:` 도 추가되지 않아 이 v2 promise 를 추적하는 plan 이 없다.
  - 참고 선례: `spec/conventions/conversation-thread.md`(status: implemented)의 "§7 v2 로드맵" 절, `spec/5-system/10-graph-rag.md`(status: implemented)의 "P2+ (후속) ❌" Phase 행은 모두 `spec/0-overview.md §6.3 로드맵/미구현(❌)` 표에 **별도 등재**돼 있다 (예: "Graph RAG 후속 (P2+)" 행). 즉 "implemented 문서 + 미구현 v2 항목" 조합 자체는 이 저장소에서 이미 받아들여진 패턴이지만, 그 경우 항상 `0-overview.md §6.3` 에 대응 로드맵 행을 짝지어 두는 관행이 있다. 이번 draft 는 그 짝을 만들지 않는다.
  - 제안: (a) `spec/0-overview.md §6.3` 에 "실행 상세 cross-node ConversationThread 재구성 (EH-DETAIL-12)" 로드맵 행을 추가해 Graph RAG 선례와 정합시키거나, (b) Rationale 에 "`implemented` 유지 사유"(전체 파일 promise 중 이 v2 항목만 예외적으로 미구현임을 왜 `partial`+`pending_plans` 전환 없이 감내하는지)를 명시한다. 근본적으로는 이 컨벤션이 파일 단위 status 와 body 내 per-requirement ✅/❌ 마커 사이의 관계를 명문화하지 않은 gap 이므로, 반복되면 `spec-impl-evidence.md` 자체에 "요구사항 표 내 개별 ❌ 항목과 파일 status 의 관계" 절을 추가하는 것도 고려할 만하다.

- **[INFO]** 신규 행의 cross-reference 가 표의 기존 링크 관행과 다른 bare-text 형식
  - target 위치: "파일별 편집" 1번, 신규 행 텍스트 끝 "정책·UI 미정 — 모델은 conversation-thread.md §7"
  - 위반 규약: 명시적 규약은 아니나 같은 표(EH-DETAIL-10/11, EH-NAV-04)의 기존 관행 — 타 spec 절 참조는 전부 `[Spec 이름 §N](경로#anchor)` 형태 markdown 링크 사용
  - 상세: 신규 행만 파일명·절 번호를 plain text 로 적어 표 안에서 형식이 튄다. 클릭 가능한 cross-link 이 아니므로 `spec-link-integrity.test.ts` 보호 대상도 되지 않아, 향후 `conversation-thread.md §7` 이 리네이밍돼도 stale 참조를 가드가 잡지 못한다.
  - 제안: `[conversation-thread.md §7](../conventions/conversation-thread.md#7-v2-로드맵)` 형태의 정식 링크로 교체.

- **[INFO]** 반복되는 요구사항 ID 드리프트를 다루는 정식 규약 부재
  - target 위치: "Rationale" §"왜 (b) 분리 vs (a) 각주만" — "1 ID = 1 요구사항 1 status" 원칙 인용
  - 위반 규약: 해당 없음 (참고용) — `spec/conventions/**` 어디에도 요구사항 ID 네이밍·소유권·불변 범위를 다루는 정식 문서가 없음을 확인(`spec-impl-evidence.md` 는 frontmatter `status` lifecycle 만 다루고 body 의 `EH-*`/`GR-*` 류 ID 규칙은 비대상).
  - 상세: 이번 드리프트가 `cross_spec`/`naming_collision` checker 의 휴리스틱으로만 잡혔고, 사전에 막을 정식 규약이 없다. 본 draft 자체는 문제 없으나, 이런 사후 대응이 재발할 여지가 있다.
  - 제안: target 수정은 불필요. 대신 project-planner 가 후속으로 `spec/conventions/requirement-ids.md` 같은 경량 문서를 만들어 "ID = 1 요구사항 1 status, 소유 문서 불변, 참조 문서는 `§ID` 형태로만 인용" 등을 명문화하면 이번 patch 가 도입한 원칙이 정식 규약으로 승격돼 향후 `consistency-check` 의 검증 근거가 명확해진다. (규약 갱신 제안이며 target draft 차단 사유는 아님.)

## 요약
target draft 는 plan frontmatter(`worktree`/`started`/`owner`), `plan/in-progress/spec-draft-<name>.md` 명명·`## Rationale` 종결 구조, 라인 번호·앵커 인용의 정확성(모두 실제 파일과 대조 확인됨), 링크 대상 anchor 불변 판단 등 확인 가능한 정식 규약을 모두 준수한다. ID 네이밍(`EH-DETAIL-12`, 01–11 다음 순번)과 상태 마커(`❌ (v2)`)도 파일 내 기존 관행(EH-NAV-04 의 괄호 부연 패턴)과 어긋나지 않는다. 유일하게 짚을 지점은 신규 미구현 요구사항 행을 `status: implemented` 문서의 promise 표에 추가하면서 `spec/0-overview.md §6.3` 로드맵 등재나 `pending_plans:` 전환 같은, 이 repo 가 유사 사례(Graph RAG 등)에서 따르던 짝짓기 관행을 생략한 점이다. build 가드를 직접 깨뜨리진 않지만 spec-impl-evidence 컨벤션이 지키려는 "약속 vs 구현" 투명성 취지와는 결이 다르므로 WARNING 으로 기록한다. 나머지는 스타일/문서화 개선 제안(INFO) 수준이다.

## 위험도
LOW