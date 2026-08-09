### 발견사항

- **[WARNING]** cafe24-api-catalog `mains_update`/`mains_delete` 제거 근거가 field-level 카탈로그와 여전히 모순 (미해소)
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §Rationale — "미문서화 seed 9개 outright 제거 (G-3l, 2026-06-27)" 항목이 `mains_update`/`mains_delete` 를 "Cafe24 공식 docs(Latest 2026-03-01)에 부재 확정"이라 선언. 같은 target 범위인 `spec/conventions/cafe24-api-catalog/category/mains.md` (필드-레벨 카탈로그, 프롬프트 예산 초과로 번들엔 없어 직접 Read 로 확인)는 정확히 그 `PUT /api/v2/admin/mains/{display_group}`(`#update-main-category`)·`DELETE …`(`#delete-main-category`) 를 실존 공식 docs 항목으로 기록 중 — 응답 예시 JSON까지 포함.
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` § "`mains_update`/`mains_delete` 제거 근거가 field-level 카탈로그와 모순 (2026-07-26 발견)" — CRITICAL 로 등재됐고, "### 처리 (착수 시)" 하위 3개 체크박스(외부 docs 재확인 → 존재 시 복원 / 부재 시 카탈로그 정정 → §8 재발방지 절차 추가)가 전부 `[ ]` 미체크.
  - 상세: 실측 확인 결과(`codebase/backend/src/nodes/integration/cafe24/metadata/category.ts`) 코드는 여전히 `mains_list`/`mains_add` 만 갖고 있어 "제거" 결정이 그대로 유지된 상태다. 즉 결정 자체는 안 뒤집혔지만, 그 결정의 **근거 문서 내부에서 "부재 확정" 과 "실존 docs 항목" 이 동시에 SoT 로 주장**되는 모순이 2026-07-26 발견 이후 오늘(2026-08-09)까지 그대로다. `catalog-docs-drift.spec.ts` 는 metadata→docs 단방향만 봐서 이 형태의 결함은 구조적으로 못 잡는다(plan 자체가 명시).
  - 제안: 이번 작업이 cafe24 카탈로그/`category` 리소스를 건드리지 않는다면 최소한 "미해소 상태 유지" 를 기록하고 넘어갈 것. 건드린다면 plan 의 "처리 (착수 시)" 체크리스트(외부 docs 재확인이 선행)를 먼저 닫아야 target 문서의 어느 쪽(제거 결정 vs 카탈로그)이 정본인지 확정된다 — 확정 전에는 `_overview.md` §Rationale 의 "부재 확정" 서술을 impl 근거로 그대로 믿으면 안 된다.

- **[INFO]** `node-cancellation.md` 의 "사용자 cancel 버튼" 서술에 Editor+ 권한 제약이 아직 미반영 (추적은 정상)
  - target 위치: `spec/conventions/node-cancellation.md` §2.3 "사용자 cancel 버튼" 항목(L63 부근, 번들 예산 초과로 직접 Read 로 확인) — `POST /executions/:id/stop` 진입점 서술에 viewer 제외(Editor+ 전용) 언급이 없다.
  - 관련 plan: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §1 — `auth-workspace-membership-guard` P0 PR 이 `stop` 에 `@Roles('editor')` 를 부착했는데 `node-cancellation.md` L63 이 아직 갱신 전이라는 사실을 이미 정확히 추적 중(체크박스 `[ ]`, planner 트랙, P3).
  - 상세: 이 자체는 plan 이 이미 정확히 잡아 놓은 정상적인 "미착수" 상태라 위반은 아니다 — 다만 이번 --impl-prep 세션의 target 번들에는 이 plan(및 `spec/conventions/node-cancellation.md` 본문)이 예산 초과로 실려 있지 않아, target 만 보고 판단하면 "Stop 버튼에 권한 제약이 없다" 로 오독할 위험이 있다.
  - 제안: 이번 작업이 실행 취소/Stop 버튼 권한 관련이면 이 plan 의 §1 을 먼저 확인. 아니면 조치 불요 — 기록 목적.

- **[INFO]** 이번 세션의 실제 작업 diff 와 target scope 가 무관해 보임 (참고, 저신뢰)
  - target 위치: 프롬프트 전체 — `--impl-prep spec/conventions/` 이며 git diff 섹션 자체가 없음(impl-prep 특성상 정상).
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` — orchestrator 의 scope 산정이 "그 경로에 실제 diff 가 있는지" 확인하지 않는 문제를 아직 `[ ]` 로 추적 중(2026-08-09 항목까지 갱신됨, 미해소).
  - 상세: 현재 워크트리의 실제 미커밋 변경분(`git status`)은 `chat-channel/providers/slack/slack-message.renderer.spec.ts`·`execution-engine.service.spec.ts`·`executions-rerun.service.spec.ts`·`integration-expiry-scanner.service.spec.ts`·`workflows.service.spec.ts` 5개 backend 테스트 파일(타입 인자 정리 성격)뿐이며 `spec/conventions/**` 와는 무관하다. `--impl-prep` 이 사전 점검이라 diff 부재 자체는 정상 동작이지만, 실제 작업 성격(backend 테스트 typecheck 정리)과 이번 검토 scope(spec/conventions/) 가 겹치지 않아 이 판정이 "지금 하려는 작업" 에 대한 유효한 사전 게이트인지는 불확실하다.
  - 제안: 조치 불요 — 호출자(orchestrator/SUMMARY)가 이 세션의 scope 가 실제 착수하려는 작업과 일치하는지 재확인할 근거로만 참고.

### 요약

target(`spec/conventions/` 전체 스냅샷)과 `plan/in-progress/**` 사이에서 미해결 결정을 target 이 우회하는 CRITICAL 사례는 없었다. 다만 2026-07-26 에 이미 발견되고 `cafe24-backlog-residual.md` 에 명시적으로 등재된 `cafe24-api-catalog/_overview.md` ↔ `category/mains.md` 모순이 오늘까지 미해소 상태로 target 안에 그대로 남아 있어(WARNING), cafe24 category 관련 작업을 이 target 을 근거로 진행하면 잘못된 전제를 물려받을 위험이 있다. 그 외 node-cancellation.md 의 Editor+ 권한 미반영은 plan 이 이미 정확히 추적 중인 정상적 미착수 상태다. 이번 검토 scope(spec/conventions/) 와 워크트리의 실제 미커밋 변경분(backend 테스트 typecheck 정리)이 서로 무관해 보이는 점은 판정 신뢰도에 대한 참고 사항으로만 남긴다.

### 위험도

LOW
