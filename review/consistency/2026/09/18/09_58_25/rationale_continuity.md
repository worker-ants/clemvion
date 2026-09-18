# Rationale 연속성 검토 — spec-draft-deletion-release-current-tense

## 발견사항

- **[CRITICAL]** `secret-store.md` 를 `implemented` 로 승격하면서 진짜로 미해결인 pending 항목을 놓친다
  - target 위치: `plan/in-progress/spec-draft-deletion-release-current-tense.md` §"실측" 표 4행 + `### C7. spec/conventions/secret-store.md frontmatter`(`status: implemented` + `pending_plans` 블록 삭제)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` `## Rationale` → `### R-5. status: partial 의 pending_plans: 의무화 — plan 라이프사이클 역방향 강제`("spec 가 자기를 책임지는 plan 을 가리킨다... 텔레그램 chat-channel 케이스에서 spec 가 plan 을 가리키지 않아 '어떤 plan 도 책임지지 않는 빈 약속' 으로 영구 누락"). 같은 문서 §2 표는 `partial→implemented` 승격을 "모든 `pending_plans` 가 `complete/` 로 이동" 하는 시점으로 못박는다.
  - 상세: `secret-store.md` 의 유일한 `pending_plans` 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 다. target 은 "이 문서가 약속한 표면(§2 `deleteByPrefix`·§2.1·§5.3·§6)은 전부 구현됐고, `partial` 로 내린 사유는 #1345 하나뿐" 이라 판단해 `pending_plans` 를 통째로 비우고 `status: implemented` 로 승격한다. 그러나 그 followups 트래커는 여전히 `plan/in-progress/` 에 남아 있고, 그 안에는 **아직 체크되지 않은(`- [ ]`)** 별개 항목이 있다 — "열린 `config` 맵 안의 신규 비밀은 e2e `not.toHaveProperty` 를 동반해야 한다 — 규약에 명시" (2026-09-05 등재, `review/code/2026/09/05/23_30_00` security W2). 이 항목은 정확히 *"`secret-store.md`(§1.1 인접) 또는 `2-api-convention.md §5.4` … 에 **한 문장**으로 못 박는다"* 라고 적어 `secret-store.md` 를 두 후보 착지점 중 하나로 명시 지목한다. 즉 이 spec 문서에는 **아직 쓰이지 않은, 실재하는 미해결 약속**이 남아 있을 수 있는데, target 은 이를 감사(audit)하지 않고 `pending_plans` 를 비운다. `spec-pending-plan-existence`/`spec-status-lifecycle` 가드는 경로 실존과 "pending_plans 전부가 `complete/` 로 이동했는데 승격 안 함" 방향만 기계적으로 검사하므로, "아직 열려 있는 트래커 안의 무관한 항목이 이 spec 을 겨눈다" 는 이번처럼 가드가 못 잡는다 — R-5 가 막으려던 바로 그 실패 모드("어떤 plan 도 책임지지 않는 빈 약속")를 이번에 다시 만든다.
  - 대조: 같은 target 문서의 `### C8` 은 정확히 같은 종류의 판단을 **올바르게** 수행한다 — `1-workflow-list.md` 의 `pending_plans` 에서 이 followups 트래커 참조를 지우되, "남은 두 항목 때문에" `status: partial` 은 유지한다고 명시한다. `secret-store.md`(C7) 에는 이 대조 감사가 빠져 있다.
  - 제안: `### C7` 을 다음 중 하나로 정정한다. (a) line-1099 항목의 착지점이 `secret-store.md` 인지 `2-api-convention.md` 인지 먼저 판정하고, `secret-store.md` 가 후보에서 배제됨을 확인한 뒤에만 `status: implemented` + `pending_plans` 삭제를 적용하며 그 판정 근거를 target 의 "실측"/Rationale 에 한 문장으로 남긴다. 또는 (b) C8 과 동일하게 `pending_plans` 참조는 유지하되 `status: partial` 로 두고, "남은 이유는 §1.1 인접 문장 미기입 하나" 라고 적어 R-5 의 역방향 링크를 끊지 않는다.

- **[INFO]** 잠금 순서(워크스페이스→멤버십) 신설 근거가 `## Rationale` 이 아니라 표 셀 본문에만 있다
  - target 위치: `### C6` (`spec/data-flow/12-workspace.md §1.10` 동작 칸 재작성) 마지막 문장 — *"잠금 순서(워크스페이스 → 멤버십)는 소유권 이전과 같다 — 둘이 겹칠 때 교착하지 않게."*
  - 과거 결정 출처: `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D6("워크스페이스 삭제는 이미 워크스페이스 행을 pessimistic_write 로 잠그므로 그 뒤에 열거만 더한다")과, 기존 spec 문면(`12-workspace.md §1.10`, 커밋 217fadecb 시점)의 "멤버십·워크스페이스 row 를 잠근 뒤"라는 반대 순서 서술. `12-workspace.md` 의 `## Rationale` 절(활성 워크스페이스/멤버십 검증 등 다수 항목, R-CC 류와 유사한 번호 없는 절 구성)에는 이 교착 회피 순서를 뒷받침하는 항목이 보이지 않는다(직접 열람 확인, 헤더 목록에 매칭 항목 없음).
  - 상세: 기존 문면이 "멤버십 → 워크스페이스" 순으로 적었던 근거가 원래 무엇이었는지 spec 어디에도 없어 이번 정정이 "틀린 서술을 코드에 맞게 고치는 것"인지 "교착 회피라는 새 설계 원칙을 도입하는 것"인지 문서만으로 구분되지 않는다. CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 관례에 따르면 이 교착-회피 근거는 `12-workspace.md` 의 `## Rationale` 에도 짧게 등재되는 편이 다음 사람이 이 순서를 다시 뒤집지 않게 한다.
  - 제안: `12-workspace.md` `## Rationale` 에 "§1.10 워크스페이스 삭제 잠금 순서 = 소유권 이전과 동일(교착 회피)" 항목을 한 문단 추가하거나, 최소한 §1.10 본문에서 그 항목을 참조하도록 앵커를 남긴다.

- **[INFO]** 이 checker 입력 번들에서 `10-triggers.md`·`11-workflow.md`·`12-workspace.md`·`15-chat-channel.md`·`secret-store.md` 의 `## Rationale` 이 예산 초과로 절단됨
  - target 위치: 없음 (checker 입력 자체의 한계)
  - 과거 결정 출처: 해당 없음 — 방법론 메모
  - 상세: `_prompts/rationale_continuity.md` 의 "관련 Rationale 발췌" 절이 이 다섯 문서에 대해 *"본문 생략됨 — 컨텍스트 예산 초과"* 로 명시한다. 이번 검토는 저장소 원본 파일을 직접 열어 보완했지만(위 두 발견은 그렇게 얻었다), 번들만 보고 판정하면 이 다섯 문서의 Rationale 위반은 원천적으로 탐지 불가능하다.
  - 제안: `--spec` 번들 예산에서 target 의 `spec_impact` 에 나열된 파일은 우선순위를 올려 절단 대상에서 제외하는 것을 고려(기존 메모 `feedback_consistency_spec_mode_budget` 와 같은 클래스의 갭).

## 요약

target 의 본문 변경(C1~C6, C9)은 #1345(`D1~D7`)가 세운 계약을 뒤집지 않고 구현이 확정한 세부(부모 잠금 상한·권한 선검사·schedule job 실패 시 중단·워크스페이스 삭제 실행 순서)를 정확히 새 Rationale 문단(§"권한 선검사 창을 잔여 목록에 넣는 이유")과 함께 반영하며, execution-engine.md §4.4 표에 억지로 끼워 넣지 않는 "비대상" 판단도 근거가 탄탄하다 — 결정 번복 시 새 근거를 남기라는 원칙을 대체로 잘 지킨다. 다만 `secret-store.md` frontmatter 승격(C7)은 같은 pending_plans 트래커 안에 남아 있는, 그 문서를 명시 지목하는 별개의 미해결 항목(2026-09-05 등재)을 감사하지 않은 채 `pending_plans` 를 비워, `spec-impl-evidence.md` R-5 가 명시적으로 막으려 한 "누구도 책임지지 않는 빈 약속" 상태를 재현할 위험이 있다 — 이 한 건이 CRITICAL 이다.

## 위험도

MEDIUM
