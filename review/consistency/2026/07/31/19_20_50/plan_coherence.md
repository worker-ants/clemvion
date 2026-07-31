### 발견사항

- **[WARNING] `spec-sync-auth-gaps.md` 가 auth spec 에 새로 추가된 감사 액션 커버리지 갭을 추적하지 못함**
  - target 위치: `spec/data-flow/1-audit.md:82-85` (§1.1 "커버리지 갭" — `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` "여전히 미구현") 및 상호참조 대상 `spec/5-system/1-auth.md:429-438` (§4.1 "Planned (미구현 — 목표 커버리지)" 표)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md:9-19` — `spec/5-system/1-auth.md:13`(frontmatter `pending_plans:`)의 **유일한** 소유 plan
  - 상세: target(`spec/data-flow/1-audit.md`)은 workflow/trigger/schedule/model_config 4개 카테고리의 감사 로깅이 여전히 구현되지 않았다고 명시한다. 코드로 직접 재확인했다 — `grep -rn "AuditLogsService" codebase/backend/src/modules/{workflows,triggers,schedules,alerts,model-config}/` → **0건**, target 의 서술과 일치. 그런데 이 갭을 추적해야 할 `spec-sync-auth-gaps.md`(2026-06-03 spec-vs-code audit 산출물)는 "미구현 항목"에 LDAP/SAML SSO 2건만 등재했고, "비고"에는 정반대로 "§1 ~ §5 의 나머지 surface (... Audit/LoginHistory ...) 는 audit 재검증에서 모두 구현 확인됨"이라 적혀 있다. `git log -S`로 확인하면 4개 카테고리의 "Planned" 서술은 커밋 `8b1aa6b69`/`9f5acd368`(2026-06-11), `9e0b579d0`(2026-06-12)에서 **plan 작성일(2026-06-03) 이후** `spec/5-system/1-auth.md`에 추가됐다 — 즉 plan 작성 시점엔 맞는 서술이었으나 spec 이 그 뒤(모델 통합 PR #541·audit action 상수화 PR #543 등) 진화하며 plan 이 갱신되지 않은 drift 다. `spec/5-system/1-auth.md`의 `status: partial` 은 `spec-sync-auth-gaps.md`가 남은 gap 을 전수 추적한다는 전제로 유지되는데(spec-impl-evidence §3), 그 plan 이 LDAP/SAML 만 닫으면 이 4개 카테고리 갭이 owning plan 없이 영구 누락될 위험이 있다.
  - 제안: `spec-sync-auth-gaps.md`의 "미구현 항목"에 이 감사 로깅 갭(workflow/trigger/schedule/model_config)을 추가하고, "비고"의 "모두 구현 확인됨" 서술을 target 과 일치하도록 정정할 것. LDAP/SAML 이 먼저 닫히더라도 이 항목이 남아있는 한 `1-auth.md`는 `status: implemented` 로 승격되어서는 안 된다.

- **[WARNING] 후속 항목 상호 참조 누락 — `workflow-duplicate-nodes-edges.md` ↔ 현재 작업 `review-info-followups.md`**
  - target 위치: (간접) `spec/data-flow/11-workflow.md` §1.5 — 두 plan 모두 이 절이 다루는 `duplicate()` 동작을 대상으로 함
  - 관련 plan: `plan/in-progress/workflow-duplicate-nodes-edges.md:193` (`- [ ] **보류된 리뷰 INFO 10건**`, "## 3. 후속 항목" 절) vs 현재 target 작업의 근거 plan `plan/in-progress/review-info-followups.md`
  - 상세: `review-info-followups.md`(현재 작업)는 정확히 `workflow-duplicate-nodes-edges.md`가 "본 PR 범위 밖 — 별도 PR" 후속 항목으로 남겨둔 "보류된 리뷰 INFO 10건"(`review/code/2026/07/30/17_54_27/RESOLUTION.md` §보류·후속 항목)을 전수 처분하는 작업이다. 그런데 `review-info-followups.md` 전체(157줄)에 `workflow-duplicate-nodes-edges` 문자열이 한 번도 등장하지 않고, 역방향으로도 참조가 없다 — 두 plan 이 같은 백로그 항목을 서로 모른 채 각자 추적 중이다. `review-info-followups.md`가 먼저 `plan/complete/`로 이동하면 `workflow-duplicate-nodes-edges.md:193`의 체크박스는 미체크 상태로 남아, 다음 grooming 때 이미 끝난 조사를 반복하게 만든다(과거 "체크리스트 두 군데" 동기화 실패와 같은 패턴).
  - 제안: 두 plan 중 먼저 완료 처리되는 쪽에서 `workflow-duplicate-nodes-edges.md:193` 체크박스를 체크하고 `review-info-followups.md`(또는 그 `plan/complete/` 경로)를 근거로 남길 것. `review-info-followups.md`의 push 전에 반영 권장.

### 요약
target(`spec/data-flow/`, 8개 파일 전수 확인)과 이번 diff(`workflows.controller.ts`/`workflows.service.ts` — Swagger 포맷·`edge.condition` 참조 격리·네이밍 통일) 자체는 정합하다: `spec/data-flow/11-workflow.md` §1.5·Rationale 은 이미 duplicate 의 "캔버스 전체 복제" 동작을 정확히 반영하고 있고, 이번 diff 는 인메모리 참조 격리·주석/네이밍 정정뿐이라 `spec_impact: none` 선언과 어긋나지 않는다. 다만 target 폴더를 전수 훑는 과정에서 이번 diff 와 직접 관련 없는 두 건의 plan 추적 drift 를 발견했다 — (1) `spec/5-system/1-auth.md`(target 이 상호참조하는 문서)에 2026-06-11~12 사이 새로 추가된 감사 액션 커버리지 갭 4종이 그 문서의 유일한 `pending_plans` 소유자인 `spec-sync-auth-gaps.md`(2026-06-03 작성, 상반된 "모두 구현됨" 서술 보유)에 반영되지 않아 향후 `status: implemented` 오승격 위험이 있고, (2) 현재 작업 plan 이 처리 중인 항목이 그 출처 plan(`workflow-duplicate-nodes-edges.md`)의 체크리스트와 상호 참조되지 않았다. 둘 다 이번 PR 을 막을 사안은 아니나 plan 갱신이 필요하다.

### 위험도
MEDIUM
