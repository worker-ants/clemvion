# 부작용(Side Effect) 리뷰 — 2026/07/17 01:15:40

## 검토 범위 확인

35개 변경 파일 전수 확인 결과 `codebase/**` (백엔드/프런트엔드 실행 코드) 변경은 **0건**이다. 전부 두 그룹으로 구성된다.

- `review/consistency/2026/07/17/{00_17_40,00_35_59,00_55_57}/**` (21개, 신규 생성) — consistency-check sub-agent 산출물(SUMMARY/checker 결과/meta.json/_retry_state.json)
- `spec/**.md` (14개, 기존 파일 수정) — 수치 정정(`~180`→`485`), frontmatter `status`/`pending_plans` 갱신, `plan/in-progress/parallel-p2-followups.md`→`plan/complete/parallel-p2-followups.md` 링크 경로 정정, Rationale 신설(`R-wontdo-async-fanin`), `cafe24-token-refresh` 에러 격리 정책 명문화 등

따라서 "함수 상태 변경·전역변수·시그니처·네트워크 호출·이벤트/콜백" 등 코드 레벨 부작용 카테고리는 본질적으로 적용 대상이 없다. 아래는 그럼에도 문서 변경이 빌드 가드·후속 추적에 미치는 간접 영향을 실측 확인한 결과다.

## 발견사항

- **[INFO]** 코드 변경 없음 — 전형적 부작용 카테고리 해당 없음
  - 위치: 전체 diff (35파일)
  - 상세: `grep`/파일 헤더 전수 확인 결과 `codebase/backend`, `codebase/frontend`, `codebase/packages`, `codebase/channel-web-chat` 어디에도 변경이 없다. 함수 시그니처·전역 변수·이벤트 발생 로직 자체가 diff에 존재하지 않는다.
  - 제안: 없음 (해당 없음).

- **[INFO]** 파일시스템 부작용 — `review/consistency/**` 21개 신규 파일의 영구 커밋은 프로젝트 컨벤션에 따른 의도된 동작
  - 위치: `review/consistency/2026/07/17/00_17_40/**`, `.../00_35_59/**`, `.../00_55_57/**`
  - 상세: CLAUDE.md "정보 저장 위치" 표의 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 규약에 정확히 부합하는 nested-ISO 산출물이다. 다만 `_retry_state.json`(00_35_59, 00_55_57)과 `meta.json`(00_35_59)에는 로컬 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/...`)와 세션별 scratchpad tmp 경로(`/private/tmp/claude-501/.../scratchpad/spec-draft-cafe24-countmax.md`)가 하드코딩된 채 커밋된다 — 다른 머신/워크트리에서는 의미 없는 값이지만, 기존 저장소에 이미 반복되는 기록 패턴(과거 세션 산출물도 동일 구조)이라 이번 diff 고유의 신규 리스크는 아니다.
  - 제안: 조치 불요(기존 관례와 일치). 향후 재사용 도구가 이 절대경로를 파싱에 의존하지 않도록 주의만 권장.

- **[INFO, 검증됨]** `spec/5-system/11-mcp-client.md` `status: partial → implemented` + `pending_plans` 제거는 build 가드 회피 목적의 필수 변경 — 부작용이 아니라 부작용(빌드 브레이크) 예방
  - 위치: `spec/5-system/11-mcp-client.md` frontmatter
  - 상세: `codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts` 가드 (c)를 직접 열람해 확인 — `status: partial` 인 spec 은 `pending_plans` 전부가 `plan/complete/`로 이동하면 test 가 `allCompleted === false` 를 기대해 **실패**한다(= build 차단). 종전 `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` 는 실측 결과 `plan/complete/spec-sync-mcp-client-gaps.md` 로 이미 이동해 있었다(`ls` 확인). 즉 이번 status 전환이 없었다면 다음 CI 실행에서 이 가드가 깨졌을 것 — 이번 diff 는 부작용을 새로 만드는 것이 아니라 실제로 임박한 빌드 브레이크를 회피한다.
  - 제안: 없음 (정상 동작 확인됨).

- **[INFO, 검증됨]** `pending_plans` 경로 교체 2건(`1-workflow-list.md`, `9-rag-search.md`)도 대상 plan 실존 확인 — dangling reference 없음
  - 위치: `spec/2-navigation/1-workflow-list.md` (`spec-sync-workflow-list-gaps.md` → `marketplace-and-plugin-sdk.md`), `spec/5-system/9-rag-search.md` (`rag-dynamic-cut.md` → `rag-quality-improvement.md`)
  - 상세: `ls` 로 직접 확인 — 신규 참조 파일(`plan/in-progress/marketplace-and-plugin-sdk.md`, `plan/in-progress/rag-quality-improvement.md`)은 실존하고, 구 참조 파일(`spec-sync-workflow-list-gaps.md`, `rag-dynamic-cut.md`)은 `plan/in-progress/`에 더 이상 없다. `spec-pending-plan-existence.test.ts` 가드(in-progress 또는 complete 중 하나라도 실존해야 pass)를 열람해 로직도 확인 — 이 교체가 없었다면 dangling `pending_plans` 참조로 가드가 깨졌을 시나리오였다.
  - 제안: 없음.

- **[INFO, 검증됨]** `plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md` 링크 경로 정정 3건도 빌드 가드 방어용
  - 위치: `spec/conventions/{cross-node-warning-rules,execution-context,node-cancellation}.md`
  - 상세: `spec-link-integrity.test.ts` 소스를 직접 열람 — 주석에 "Scope (1) applies no target filter: a `plan/**` link written in a spec doc IS checked... plan-coherence-checker owns link hygiene *inside* `plan/**` docs — not spec→plan links" 라고 명시돼 있어, 본 diff의 파일 35(`spec/conventions/spec-impl-evidence.md`)가 정정한 서술과 실제 테스트 동작이 정확히 일치함을 확인했다. 즉 이번 3개 링크 경로 수정이 없었다면 `plan/in-progress/parallel-p2-followups.md`가 이미 부재(파일 이동 완료)하므로 이 build 가드가 깨졌을 것 — 사전 방어적 수정이다.
  - 다만 review 산출물 자체(파일 4, `review/consistency/2026/07/17/00_17_40/plan_coherence.md`)가 별도로 지적하듯, 동일한 plan 이동으로 인한 dead link 가 `plan/complete/` 문서 3개(5개 링크 인스턴스, `parallel-p2-followups-done.md`/`cross-node-warning-rules.md`/`backend-msg-i18n-impl.md`)에 남아 있다 — 이들은 `spec/**.md` 범위 밖이라 `spec-link-integrity.test.ts` 가 잡지 못해 build 는 안전하지만, 실제로는 깨진 링크다. 이 항목은 이번 diff의 리뷰 산출물이 이미 WARNING 으로 정확히 포착·보고한 사안이라 본 side-effect 리뷰에서 별도 등급을 매기지 않고 확인만 한다.
  - 제안: 없음(이미 리뷰 산출물 내 WARNING 으로 추적 중).

- **[INFO]** `spec/4-nodes/1-logic/11-merge.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/3-ai/{0-common,1-ai-agent}.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md` 등의 본문·Rationale 서술 변경은 순수 프로즈 정정(수치 갱신, 새 Rationale 앵커 `R-wontdo-async-fanin` 추가, 에러 격리 정책 명문화)이며 참조되는 코드 심볼(`AI_AGENT_TOOL_COUNT_MAX`, `cafe24-token-refresh.processor.ts` 등)은 전부 기존 구현을 있는 그대로 인용할 뿐 실제 값·동작을 바꾸지 않는다.
  - 제안: 없음.

## 요약

이번 변경 세트는 `codebase/**` 를 전혀 건드리지 않는 순수 spec 문서 정정(14개) + consistency-check 산출물 커밋(21개)이라 함수 시그니처·전역 상태·네트워크 호출·이벤트/콜백 등 코드 레벨 부작용 카테고리는 원천적으로 해당하지 않는다. 유일한 실질적 "부작용"은 파일시스템에 대한 것 — `review/consistency/**` 21개 신규 파일의 커밋인데, 이는 CLAUDE.md 의 review 산출물 저장 규약과 정확히 일치하는 의도된 동작이다. frontmatter `status`/`pending_plans` 변경 3건과 plan 링크 경로 정정 3건은 실제 빌드 가드 소스(`spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`, `spec-link-integrity.test.ts`)를 직접 열람·대조해 검증한 결과 모두 "가드를 깨지 않기 위한 필수·정확한 갱신"으로 확인됐으며, 오히려 갱신하지 않았다면 다음 CI 에서 빌드가 깨졌을 상황을 예방한다. 유일하게 남는 잔여 이슈(plan/complete/ 내부 dead backlink 5곳)는 이번 diff 자신의 리뷰 산출물(plan_coherence.md)이 이미 WARNING 으로 정확히 포착해 별도 후속 조치로 추적 중이라 본 리뷰에서 중복 등재하지 않는다.

## 위험도

LOW
