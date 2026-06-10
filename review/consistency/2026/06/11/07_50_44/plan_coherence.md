# Plan 정합성 검토 결과

검토 모드: `--spec`
Target: `spec/2-navigation/5-knowledge-base.md` (worktree `kb-reembed-banner-ecfe2b`)

---

## 발견사항

### [CRITICAL] target spec 이 plan 의 미결 선택지 ③ 을 일방적으로 결정해 구현 명세로 확정

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` §2.4.1 "검색 불가 배너" 단락 (신규 추가분) 및 `## Rationale §R-3`
- **관련 plan**: `plan/in-progress/kb-model-change-reembed-followup.md` — "검토할 선택지 (비용·UX 정책 결정 필요)" 절, 선택지 1·2·3 모두 미결 오픈 상태
- **상세**:
  `kb-model-change-reembed-followup.md` 는 세 선택지를 나열하며 **"착수 전 project-planner spec 선갱신 필수 (의무)"** 를 명시하고 어느 선택지도 결정된 것으로 표기하지 않았다. 그런데 target spec 은 §2.4.1 에 "검색 불가 배너 + [지금 재임베딩] CTA" 를 상세 구현 명세 수준으로 추가하고, §R-3 Rationale 에서 _"근본 원인 후속(kb-model-change-reembed-followup.md)의 정책 결정에서 자동 트리거·저장 차단 대신 **③ 배너 강화**를 택했다"_ 고 서술한다. 그러나 해당 plan 에는 ③이 채택됐다는 결정 기록이 없다. plan 이 "결정 필요"로 명시 유보한 사항을 target spec 이 결정된 것처럼 기정사실화(fait accompli)하고 있어, plan 의 선행 합의 요건("착수 전 project-planner spec 선갱신 + `/consistency-check --spec` BLOCK:NO")을 우회한다.
- **제안**: 두 가지 경로 중 하나를 선택해야 한다.
  - (권장) `kb-model-change-reembed-followup.md` 에 선택지 ③ 채택 결정을 명시 기록한 뒤 (`## 결정` 절 추가 또는 기존 "비고" 갱신), target spec 변경을 그 결정의 산출물로 재처리한다. 이로써 plan→spec 방향의 단일 진실 원칙이 유지된다.
  - (대안) 만약 target spec 변경 자체가 plan 의 결정을 포함하는 spec 갱신이 되도록 의도한 것이라면, plan 의 "착수 전 spec 선갱신 의무" 조항 충족 여부를 plan 에 체크박스로 기록하고 consistency-check --spec BLOCK:NO 결과를 plan 에 등재해야 한다.

---

### [WARNING] target 의 `status: partial` + `pending_plans` 추가가 `kb-unsearchable-groom-cbe34e` worktree 와 동일 파일을 동시 수정

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` frontmatter (`status`, `pending_plans` 필드)
- **관련 plan**: `kb-unsearchable-groom-cbe34e` 브랜치(OPEN PR, active) — 이 worktree 는 `kb-unsearchable-warning` plan 의 plan-lifecycle 완료 정리 커밋(`a696281d`)만 담고 있으며, 해당 커밋이 `spec/2-navigation/5-knowledge-base.md` 의 `status` 를 `implemented` 로, `pending_plans` 를 제거 방향으로 변경한다 (git show 확인).
- **상세**:
  target(`kb-reembed-banner-ecfe2b`) 은 동일 spec 파일 frontmatter 를 `status: partial` + `pending_plans: [kb-model-change-reembed-followup.md]` 로 설정한다. 반면 `kb-unsearchable-groom-cbe34e` 브랜치는 같은 파일에서 `status: implemented` 로 복귀 + `pending_plans` 제거를 기록한다. 두 브랜치가 공통 베이스(main, `c6a9aa64`) 를 공유하면서 같은 frontmatter 필드를 다른 값으로 변경하고 있어 merge 시 충돌이 확실하다.
  단, `kb-unsearchable-groom-cbe34e` 는 plan-lifecycle 정리(grooming) 목적 브랜치로서 실질 spec 본문 변경은 없고 frontmatter 정리만 포함한다. target 이 같은 파일에 본문 신규 섹션(§2.4.1 배너, §R-3)을 추가했으므로, 어느 쪽이 먼저 merge 되느냐에 따라 반대편 브랜치가 상당한 rebase/수정을 요한다.
- **제안**: 두 브랜치의 선후를 조율한다.
  - `kb-reembed-banner-ecfe2b` 가 먼저 merge 되면, `kb-unsearchable-groom-cbe34e` 의 grooming 커밋은 `status: implemented` 로 복귀시키지 않고 `status: partial` 유지 + 본문 변경 보존으로 rebase 필요.
  - `kb-unsearchable-groom-cbe34e` 가 먼저 merge 되면, target 브랜치 rebase 후 frontmatter 가 충돌하므로 merge 前에 처리.
  - 두 브랜치를 운용하는 담당자 간에 merge 순서를 사전 조율하고, 선행 merge 가 완료된 뒤 후행 브랜치를 rebase 한다.

---

### [INFO] `kb-model-change-reembed-followup.md` 의 `worktree: (unstarted)` 이 target 변경 이후에도 여전히 미착수 sentinel 상태

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` §R-3 Rationale (plan 참조)
- **관련 plan**: `plan/in-progress/kb-model-change-reembed-followup.md` frontmatter `worktree: (unstarted)`
- **상세**: target spec 이 이 plan 의 결정을 인용하면서 `pending_plans` 에 등재했는데, plan 자체는 worktree 미배정·미착수 상태다. target spec 의 `status: partial` + `pending_plans` 등재는 이 plan 이 실제로 착수되고 구현이 완료돼야 `status: implemented` 로 복귀할 수 있음을 의미한다. plan 의 "착수 전 spec 선갱신 필수 의무" 조항상 spec 이 먼저 확정돼야 하는 순환 구조가 생기므로, 이를 plan 의 §비고 또는 체크리스트에 명확히 기재해 두는 것이 추후 혼선을 방지한다.
- **제안**: `kb-model-change-reembed-followup.md` 의 "비고" 절에 "target 선택지 ③ 이 `spec/2-navigation/5-knowledge-base.md §2.4.1·R-3` 에 spec-draft 로 반영됨 (kb-reembed-banner-ecfe2b PR). 착수 시 해당 spec 을 SoT 로 삼아 구현 단계 착수 가능" 한 줄을 추가해 순환 참조를 해소한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

(0건) — 충돌 후보 worktree 5개(db-pool-creds-pubsub, health-probe-status-d9a184, integration-expiry-fixes-1d7c7d, unified-model-mgmt-5af7ee, makeshop-catalog-labels) 는 `spec/2-navigation/5-knowledge-base.md` 를 건드리지 않으므로 §5 worktree 충돌 검토 대상에서 제외됨. `kb-unsearchable-groom-cbe34e` 는 Step 1 ancestor 음성(exit 1)·Step 2 PR OPEN(active)으로 active 처리해 §발견사항 WARNING 으로 분석.

---

## 요약

`spec/2-navigation/5-knowledge-base.md` target 의 핵심 변경(§2.4.1 검색 불가 배너 + §R-3 Rationale)은 `plan/in-progress/kb-model-change-reembed-followup.md` 가 "결정 필요"로 명시 유보한 세 선택지 중 ③을 plan 의 결정 합의 없이 spec 에 확정·기술하고 있어 CRITICAL 충돌이다. plan 의 "착수 전 project-planner spec 선갱신 의무"를 역방향으로 우회하는 구조이므로, plan 에 ③ 결정을 명기하거나 plan 갱신 없이 spec 을 먼저 확정한 근거(consistency-check --spec BLOCK:NO 기록)를 plan 에 등재해야 한다. 추가로 동일 spec 파일을 수정하는 active worktree `kb-unsearchable-groom-cbe34e`(OPEN PR)와의 frontmatter 충돌이 WARNING 수준으로 존재한다. worktree 충돌 후보 1건(kb-unsearchable-groom-cbe34e) 분석, stale skip 0건.

---

## 위험도

**CRITICAL**
