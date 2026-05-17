# Plan 정합성 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-integration-autorefresh.md`
> 검토 worktree: `spec-integration-autorefresh-b2c4f1`
> 검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** 자매 plan `spec-update-integration-autorefresh.md` 가 다른 worktree에 위치
  - target 위치: target 문서 상단 "위임 문서: `plan/in-progress/spec-update-integration-autorefresh.md`"
  - 관련 plan: `integration-token-ui-autorefresh-a3f9b2` worktree 내 `plan/in-progress/spec-update-integration-autorefresh.md`
  - 상세: target plan 이 "위임 문서" 로 참조하는 `spec-update-integration-autorefresh.md` 는 main 의 `plan/in-progress/` 에 없고 `integration-token-ui-autorefresh-a3f9b2` worktree 안에만 존재한다. 현재 두 worktree 가 모두 `spec/2-navigation/4-integration.md` 를 다루는 작업 흐름에 묶여 있으므로 plan 파일의 위치를 인지하고 있어야 한다.
  - 제안: 추적만 필요. target plan 이 spec 본문을 패치한 뒤 merge 되면, `spec-update-integration-autorefresh.md` 내 `[ ] spec 갱신 PR merge` 체크박스를 갱신해야 한다. 양쪽 plan 에 상호 참조 링크가 이미 있으므로 별도 조치 불필요.

- **[INFO]** `spec-draft-integration-autorefresh.md` 가 main `plan/in-progress/` 에 존재하지 않음
  - target 위치: target 문서 frontmatter `worktree: spec-integration-autorefresh-b2c4f1`
  - 관련 plan: `plan/in-progress/` 루트 파일 목록
  - 상세: `spec-draft-integration-autorefresh.md` 는 현재 `spec-integration-autorefresh-b2c4f1` worktree 내부에만 존재하며 main 의 `plan/in-progress/` 에는 없다. CLAUDE.md 규약상 plan 문서는 `plan/in-progress/` 또는 `plan/complete/` 에 위치해야 하지만, worktree 내 로컬 상태로만 존재한다. spec draft 가 commit 되어 merge 될 때 main 트리에 반영되므로 수명 주기 관점에서 문제가 있다.
  - 제안: spec 본문 패치 PR 과 함께 `plan/in-progress/spec-draft-integration-autorefresh.md` 를 main 트리에도 포함하거나, PR merge 후 즉시 `git mv` 로 `plan/complete/` 로 이동해야 한다. 현재 진행 체크리스트에 `plan/complete/` 이동 항목이 존재하므로 PR merge 시 빠짐없이 실행 필요.

- **[WARNING]** `cafe24-backlog-residual.md` 의 C-3 (`status-badge.tsx` 의 `isReauthorizeDisabled` 이동) 와 후속 구현 PR 의 파일 충돌 미반영
  - target 위치: target 문서 §3 "본 PR 범위 밖" — backend 쿼리 갱신·frontend `needsAttention()` 가드를 `integration-token-ui-autorefresh.md` 후속 PR 로 분리
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` C-3 항목; `integration-token-ui-autorefresh-a3f9b2/plan/in-progress/integration-token-ui-autorefresh.md` W-3 메모
  - 상세: 후속 구현 PR(`integration-token-ui-autorefresh`) 은 `status-badge.tsx` 를 수정한다. `cafe24-backlog-residual.md` 의 C-3 도 동일한 `status-badge.tsx` 에서 `isReauthorizeDisabled` 를 이동하는 작업이다. `integration-token-ui-autorefresh.md` 의 W-3 메모에 "본 PR merge 이후 진행 권장. cafe24-backlog plan 에 메모 추가 필요" 가 적혀 있으나, `cafe24-backlog-residual.md` 자체에는 해당 메모가 아직 추가되지 않았다.
  - 제안: `plan/in-progress/cafe24-backlog-residual.md` 의 C-3 항목 아래에 "integration-token-ui-autorefresh PR merge 이후 진행" 의존 관계 메모를 추가. target(spec-draft) plan 범위 밖이므로 후속 구현 PR 착수 전에 처리하면 된다.

- **[WARNING]** `20260516-full-review/RESOLUTION.md` W-32 (`EXPIRING_SOON_INTERVAL`) 와 후속 구현 PR 의 동일 파일 수정 미조율
  - target 위치: target 문서 §3 "본 PR 범위 밖" — 백엔드 쿼리 갱신을 후속 PR 로 분리
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` W-32 보류 항목 (`EXPIRING_SOON_INTERVAL` 공유 상수 추출, 보류 이유: 사용자 합의 필요); `integration-token-ui-autorefresh-a3f9b2/plan/in-progress/integration-token-ui-autorefresh.md` W-4 메모
  - 상세: 후속 구현 PR 에서 `integrations.service.ts` 의 `EXPIRING_SOON_INTERVAL` 사용 부에 `AND NOT autoRefresh` 가드를 추가할 예정이다. 동일 위치에서 W-32 는 `EXPIRING_SOON_INTERVAL` 을 공유 상수로 추출하는 리팩토링을 보류 중이다. 두 변경이 동일 파일의 동일 구간(`integrations.service.ts:248~275`)을 손대므로, 순서 또는 병합 방식에 대한 명시적 조율이 없으면 merge 시 충돌하거나 한쪽이 다른 쪽을 덮어쓸 수 있다.
  - 제안: 후속 구현 PR 기획 시 W-32 를 동시 처리(공유 상수 추출 후 autoRefresh 가드를 같이 적용)하거나, W-32 를 별도 PR 로 먼저 진행한 뒤 후속 PR 을 이어가는 순서를 `20260516-full-review/RESOLUTION.md` 에 명기. `integration-token-ui-autorefresh.md` W-4 메모에 이미 인지가 되어 있으나 RESOLUTION 측에는 반영 없음.

- **[INFO]** `spec-update-2-navigation-hygiene.md` plan 신설 권고가 실제 생성되지 않았음
  - target 위치: target 문서 §3 "본 PR 범위 밖" — W-5·I-6~I-12 위생 항목을 별도 plan `spec-update-2-navigation-hygiene.md` 으로 분리 권고
  - 관련 plan: `plan/in-progress/` 목록 (해당 파일 없음)
  - 상세: target 문서가 "별도 plan `plan/in-progress/spec-update-2-navigation-hygiene.md` 신설 권장" 이라고 명시하나 현재 해당 파일이 존재하지 않는다. 누락된 상태로 spec 패치가 진행되면 위생 항목들이 추적되지 않는 채로 방치될 수 있다.
  - 제안: spec 본문 패치 PR 착수 전 또는 직후에 해당 plan 파일을 `plan/in-progress/spec-update-2-navigation-hygiene.md` 로 신설하거나, target 문서의 진행 체크리스트에 "hygiene plan 신설" 체크박스를 추가해 추적을 명확히 한다.

---

### 요약

target plan `spec-draft-integration-autorefresh.md` 는 사용자 결정(2026-05-17)으로 확정된 spec 선행 흐름(SDD)에 따라 작성된 문서로, 핵심 의사결정 사항(`autoRefresh` derived field 도입, attention 술어 제외, UI 표현 정책)은 자매 plan `spec-update-integration-autorefresh.md` 및 `integration-token-ui-autorefresh.md` 와 모순 없이 정렬되어 있다. 미해결 결정을 일방적으로 우회하거나 다른 worktree 의 동일 spec 파일을 병렬 수정하는 CRITICAL 수준의 충돌은 발견되지 않았다. 다만 두 개의 WARNING 이 존재한다: (1) 후속 구현 PR 의 `status-badge.tsx` 수정과 `cafe24-backlog-residual.md` C-3 의 동일 파일 수정 간 의존 관계가 `cafe24-backlog-residual.md` 에 아직 반영되지 않았고, (2) 후속 구현 PR 의 `EXPIRING_SOON_INTERVAL` 구간 변경과 full-review RESOLUTION W-32 의 동일 위치 리팩토링 간 순서 조율이 RESOLUTION 측에 명시되지 않아 추후 merge 충돌 위험이 있다. 두 항목 모두 본 spec 패치 PR 자체를 차단하지는 않으며, 후속 구현 PR 착수 전에 각 plan 문서에 메모를 추가하는 것으로 해소 가능하다.

---

### 위험도

LOW
