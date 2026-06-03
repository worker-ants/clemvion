# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 영역: `spec/4-nodes/4-integration/`
실행 worktree: `makeshop-api-catalog-730deb`

---

## 발견사항

### [WARNING] spec-sync-integration-common-gaps.md 의 미해결 결정 3건이 target 본문에 잔존

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 표
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-integration-common-gaps.md` §"⚠ 재분류" 항목 (worktree: `spec-sync-audit`, 2026-06-03 groom 결과)
- **상세**:
  - `spec-sync-integration-common-gaps.md` 는 다음 3건을 **"결정 필요"** 로 재분류했다:
    1. **Database Query summaryTemplate**: `{queryType} · {쿼리 첫 줄}` 의 "첫 줄" — DSL 줄분리 미지원이라 `{{queryType}} · {{query}}` (truncate 40자) downscope 가능 (minor 결정).
    2. **Send Email summaryTemplate**: `to: {수신자} +N` — `to:string[]` 슬라이스/조인/카운트 조건이 DSL 불가. **결정 필요** (downscope vs DSL 확장).
    3. **⚠ Missing integration 배지**: warningRule `when` DSL 이 node config(integrationId)만 보므로 삭제된 integration 존재 검증 불가. **아키텍처 결정 필요** (cross-entity 검증 메커니즘).
  - 그런데 target `0-common.md` §5 는 이 세 항목을 여전히 원래 스펙 그대로(`to: {수신자} +N`, Missing integration 배지) **"미구현 (Planned)"** 으로 기술하고 있다. 즉 plan 이 "결정 미해소" 라고 표시한 항목들이 target 에서 결정된 것처럼 본문에 남아 있는 형태다.
  - **실제 충돌 수준**: target 자체가 implementation 착수 전 검토(--impl-prep) 대상이며, 이 스펙 기술을 "그대로 구현 지시"로 받아들이면 미해결 결정을 일방 채택하는 것이 된다. 특히 send-email `+N` 패턴과 Missing integration 배지는 구현 난도(DSL 불가, 아키텍처 변경)가 높아 실제 구현 시 결정 없이 진행하면 차단된다.
- **제안**: `spec-sync-integration-common-gaps.md` 에서 세 항목의 결정을 먼저 확정(planner)한 후 `0-common.md §5` 를 갱신하거나, 구현 착수 시 담당 developer 가 결정이 필요한 항목(send-email +N, Missing integration 배지)을 건너뛰고 결정 완료 항목만 구현하도록 plan 에 명시하는 것이 안전하다. Database Query 의 경우 downscope 방향이 거의 자명하므로 우선 결정 처리 권장.

---

### [INFO] spec-sync-integration-common-gaps.md 의 worktree(spec-sync-audit)와 makeshop-api-catalog-730deb 가 0-common.md 에 동시 변경 — 단, spec-sync-audit PR 은 MERGED (stale skip 대상)

- **target 위치**: `spec/4-nodes/4-integration/0-common.md`
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` (frontmatter `worktree: spec-sync-audit`)
- **상세**: `spec-sync-audit` 디렉토리가 가리키는 branch `claude/switch-regex-workspace-uq` 의 PR #446 이 MERGED 상태다. 해당 worktree 는 stale — 0-common.md 에 대한 실질적 충돌 없음. 단 `spec-sync-integration-common-gaps.md` plan 이 `in-progress/` 에 여전히 남아 있어 미완 항목(3건 결정 필요)을 추적 중이므로, worktree 자체는 stale 이지만 plan 은 여전히 활성 추적 문서다.
- **제안**: plan 파일은 미완 항목 추적 목적으로 유지가 적절하나, `worktree: spec-sync-audit` 필드가 정리된 worktree 를 가리키므로 `worktree: (closed)` 또는 제거하는 정리 권장 (이 자체가 차단 이슈는 아님).

---

### [INFO] cafe24-backlog-residual.md C-6 (buildIntegrationMeta 레지스트리)을 makeshop plan 에서 편입 — 선행 cafe24 worktree MERGED (무결)

- **target 위치**: `plan/in-progress/makeshop-integration.md` §"C-6 편입"
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` (frontmatter `worktree: cafe24-backlog-residual-batch`), cafe24-api-catalog 작업 worktree `claude/cafe24-api-catalog-1665bd` PR #447 MERGED
- **상세**: makeshop-integration plan 이 `cafe24-backlog-residual.md` 의 C-6(buildIntegrationMeta 레지스트리 전환)을 "두 번째 provider 추가 직전"에 해소하는 것으로 편입 선언했다. `cafe24-api-catalog-1665bd` (Cafe24 field-level 카탈로그)의 PR #447 이 MERGED 이므로 선행 cafe24 작업 완료. C-6 자체의 구현은 makeshop 구현 Phase 1 에서 진행 예정 — 현재 코드 베이스에 레지스트리 전환이 없는 상태로 MakeShop 구현이 착수되면 C-6 해소 의무가 발생한다. spec 측 일반화 기술(makeshop-integration.md §"C-6 편입" 스펙 작업 체크박스 완료)은 이미 반영됨. developer 트랙 구현은 별도 PR. 충돌 없음.
- **제안**: 이슈 없음. plan 문서에 이미 명시됨.

---

### [INFO] spec/4-nodes/0-overview.md 의 병렬 편집 가능성 — 관련 worktree 모두 MERGED

- **target 위치**: `spec/4-nodes/0-overview.md` (makeshop-integration.md §산출물에서 "4-nodes/0-overview.md §2.4 MakeShop row 추가" 완료 체크)
- **관련 plan**: makeshop-integration.md 2026-06-03 일관성 검토 메모 "Warning #11: spec/4-nodes/0-overview.md 가 active worktree `claude/spec-inprogress-groom-c7568b` 와 동시 편집 중"
- **상세**: 해당 plan 의 경고 메모가 이미 있으나, `claude/spec-inprogress-groom-c7568b` 는 branch 에 0개 커밋 차이(diff --name-only 결과 빈 출력). 충돌 위험 해소. 나머지 overlap worktree(`claude/switch-regex-workspace-uq` PR #446, `claude/cafe24-api-catalog-1665bd` PR #447, `claude/spec-drift-gates-b26bce`, `claude/spec-sync-impl-644d19`) 모두 MERGED. `spec/4-nodes/0-overview.md` 에 대한 실질적인 병렬 편집 경합 없음.
- **제안**: 이슈 없음. 이미 plan 에 메모됨.

---

## Stale 으로 skip 한 worktree (의무 보고)

worktree 충돌 후보 중 §worktree stale 판정 cascade 로 skip 된 항목:

| worktree | branch | stale 판정 |
|----------|--------|------------|
| `spec-drift-resolve-efb608` | `claude/spec-drift-resolve-efb608` | Step 1 ACTIVE, Step 2 PR MERGED |
| `spec-sync-audit` | `claude/switch-regex-workspace-uq` | Step 1 ACTIVE, Step 2 PR #446 MERGED |
| `cafe24-api-catalog-1665bd` | `claude/cafe24-api-catalog-1665bd` | Step 1 ACTIVE, Step 2 PR #447 MERGED |
| `spec-drift-gates-b26bce` | `claude/spec-drift-gates-b26bce` | Step 1 ACTIVE, Step 2 PR MERGED |
| `spec-sync-impl-644d19` | `claude/spec-sync-impl-644d19` | Step 1 ACTIVE, Step 2 PR MERGED |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-groom-c7568b` | Step 1 ACTIVE, Step 2 PR MERGED (실질 diff 0건) |

위 6개 모두 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` 구현 착수 전 검토 대상 문서는 plan 정합성 관점에서 전반적으로 안전하다. 유일한 actionable 이슈는 `spec-sync-integration-common-gaps.md` 에 "결정 필요"로 재분류된 3건(send-email summaryTemplate +N DSL 불가 결정, Missing integration 배지 아키텍처 결정, db-query 첫 줄 downscope 결정)이 `0-common.md §5` 에 미해결 상태로 기술된 채 구현 지시처럼 읽힐 수 있다는 점이다(WARNING 1건). worktree 충돌 후보 6건 중 stale 6건 skip, active 0건 분석 — 실질적인 병렬 worktree 경합 없음.

---

## 위험도

LOW
