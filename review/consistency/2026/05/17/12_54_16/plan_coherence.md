# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 (--impl-prep)
> Target 범위: `spec/2-navigation/`
> 현재 worktree: `integration-token-ui-autorefresh-a3f9b2`
> 검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** spec 선행 갱신 체인 완료 확인 — 추가 확인 불필요
  - target 위치: `spec/2-navigation/4-integration.md` §2.2/§2.3/§2.4/§4.1/§4.2/§9.1/§10.5/§11.4/Rationale
  - 관련 plan: `plan/in-progress/integration-token-ui-autorefresh.md` §BLOCK 처리 §선행 작업 chain
  - 상세: `integration-token-ui-autorefresh.md` 의 진행 체크리스트에 "선행: project-planner 가 spec 갱신 (PR #139, merge commit c4200d51, 2026-05-17)" 이 `[x]` 로 완료 표시되어 있다. spec-draft-integration-autorefresh plan (`spec-integration-autorefresh-b2c4f1` worktree) 이 이미 `spec/2-navigation/4-integration.md` 에 9개 섹션 패치를 적용한 상태이므로, target spec 은 현재 구현이 필요로 하는 `autoRefresh` 정의·attention 술어·IntegrationDto 정의를 포함하고 있다. 이전 impl-prep 의 두 CRITICAL (C-1 `IntegrationDto.autoRefresh` spec 미정의, C-2 `computeStatus` 일방 우회) 은 해소된 것으로 보인다.
  - 제안: 본 worktree 에서 `consistency-check --impl-prep` 재실행(`plan/in-progress/integration-token-ui-autorefresh.md` 체크리스트 3번째 항목) 을 진행하면 공식 확인이 완료된다. 현재 검토 범위(spec/2-navigation/ 전체 vs plan 정합성)에서는 별도 조치 불필요.

- **[WARNING]** `spec/2-navigation/4-integration.md` 동시 수정 — spec 갱신 worktree 의 PR merge 완료 여부 확인 필요
  - target 위치: `spec/2-navigation/4-integration.md` 전체 (§2.2/§2.3/§2.4 등)
  - 관련 plan: `plan/in-progress/spec-draft-integration-autorefresh.md` (worktree: `spec-integration-autorefresh-b2c4f1`)의 7. 진행 체크리스트 — `[ ] commit + PR` (미완료)
  - 상세: `spec-draft-integration-autorefresh.md` 의 체크리스트 확인 결과, "commit + PR" 항목이 아직 미체크(`[ ]`) 이다. `spec-integration-autorefresh-b2c4f1` worktree 가 `spec/2-navigation/4-integration.md` 에 미체크 상태의 변경을 보유 중이며, `integration-token-ui-autorefresh-a3f9b2` 이 구현 착수 전에 동일 파일의 최종본을 신뢰하고 있다. PR #139 merge commit `c4200d51` 이 실제로 main 에 반영됐다는 근거(`integration-token-ui-autorefresh.md` 의 체크리스트 메모) 는 있으나, spec plan 의 체크리스트에는 아직 `[ ]` 로 기록된 것이 plan 갱신 누락일 수 있다. main 브랜치에 해당 commit 이 실제로 존재하는지, 그리고 `spec-integration-autorefresh-b2c4f1` worktree 가 아직 활성 상태인지를 확인하지 않으면 구현이 stale spec 을 바탕으로 진행될 위험이 있다.
  - 제안: `git log main --oneline | grep c4200d51` 로 merge 여부 확인. merge 완료 시 `spec-draft-integration-autorefresh.md` 의 `[ ] commit + PR` 체크박스를 `[x]` 로 갱신하고, 모든 항목 완료 시 `plan/complete/` 로 `git mv`. merge 미완료 시 spec PR merge 를 먼저 진행한 뒤 구현 착수.

- **[WARNING]** `cafe24-backlog-residual.md` C-3 의 `status-badge.tsx` 동시 수정 — 직렬화 메모 갱신 여부 확인 필요
  - target 위치: 구현 예정 파일 `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` C-3 ("isReauthorizeDisabled 위치 이동 — status-badge.tsx 에서 export 중 → lib/integrations/utils.ts") / worktree: TBD
  - 상세: `integration-token-ui-autorefresh.md` W-3 메모에 "cafe24-backlog-residual.md C-3 (`status-badge.tsx` 의 `isReauthorizeDisabled` 이동) 이 같은 파일을 수정 예정 → 본 PR merge 이후 진행 권장. cafe24-backlog plan 에 메모 추가 필요" 라고 기록되어 있다. 현재 `cafe24-backlog-residual.md` C-3 항목에는 "ai-review I6" 참조만 있고, "본 PR merge 이후 진행 권장" 의 메모가 실제로 추가되었는지 확인이 필요하다. 해당 plan 의 worktree 가 `TBD` 이므로 아직 작업을 시작하지 않은 상태이지만, 명시적 직렬화 메모 없이 다른 개발자가 C-3 작업에 착수하면 `status-badge.tsx` 에 충돌 위험이 생긴다.
  - 제안: `cafe24-backlog-residual.md` C-3 항목 아래 "**NOTE**: `status-badge.tsx` 의 `computeStatus` 변경(`integration-token-ui-autorefresh` PR) merge 이후 착수할 것" 메모를 추가해 직렬화 의도를 명문화.

- **[WARNING]** `EXPIRING_SOON_INTERVAL` 변경과 `20260516-full-review` RESOLUTION W-32 의 동일 위치 경합 — 후속 PR 설계 시 명시적 처리 필요
  - target 위치: `spec/2-navigation/4-integration.md` §2.4 / 후속 구현 대상 `backend/src/modules/integrations/integrations.service.ts:248~275`
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` W-32 — "W-32 의 공유 상수 추출을 먼저 처리하거나 (b) 동시 처리로 한 PR 에서 묶어야 한다" (full-review-fixes-a1b2c3 worktree)
  - 상세: `integration-token-ui-autorefresh.md` W-4 메모에 "후속 PR (attention 술어 변경) 의 `EXPIRING_SOON_INTERVAL` 변경은 `plan/in-progress/20260516-full-review` RESOLUTION W-32 와 동일 위치. 후속 PR 기획 시 W-32 와 병합 처리 권장" 으로 이미 기록되어 있다. 이 충돌은 현재 진행 중인 PR (본 구현 PR — backend DTO + status-badge) 의 범위 밖이므로 본 PR 자체에는 영향 없다. 단, 후속 PR (`needsAttention()` + `EXPIRING_SOON_INTERVAL` 가드) 착수 전에 W-32 처리 상태(`full-review-fixes-a1b2c3`) 를 반드시 확인해야 한다. 현재 `full-review-fixes-a1b2c3` worktree 가 활성 상태로 확인되므로, 두 worktree 가 모두 `integrations.service.ts:248~275` 를 손대는 상황이 발생할 수 있다.
  - 제안: 본 PR (backend DTO + status-badge) 에는 영향 없음. 단, `integration-token-ui-autorefresh.md` 의 "본 PR 범위 밖 — 후속 별도 PR" 항목에 "W-32 (`full-review-fixes-a1b2c3`) merge 후 착수" 메모를 추가해 후속 착수 조건을 명문화. 후속 PR plan 작성 시 `full-review-fixes-a1b2c3` 의 W-32 처리 여부를 선행 조건으로 기록.

- **[INFO]** `20260516-full-review/RESOLUTION.md` 의 worktree (`full-review-fixes-a1b2c3`) 가 활성 상태 — target 구현 파일과의 직접 경합 없음
  - target 위치: `backend/src/modules/integrations/integrations.service.ts`, `integration-response.dto.ts`, `service-registry.ts`
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` (worktree: `full-review-fixes-a1b2c3`)
  - 상세: full-review RESOLUTION 의 변경 목록을 확인한 결과, `integrations.service.ts:80` (W-21 getSummary 단일 쿼리 통합), `integrations.service.ts:250` (W-32 EXPIRING_SOON_INTERVAL — 아직 미처리, §의사결정 보류에 있음), `credentials-transformer.ts` (W-31 Logger 교체) 등을 수정했다. 단, `service-registry.ts` 의 `ServiceDefinition`, `integration-response.dto.ts` 의 `autoRefresh` 필드, `toPublic` 매핑은 RESOLUTION 의 수정 범위에 포함되어 있지 않으므로 직접 충돌은 없다. `integrations.service.ts:248~275` 의 `EXPIRING_SOON_INTERVAL` 부분은 W-32 가 §의사결정 보류로 남아 있어 `full-review-fixes-a1b2c3` 에서 아직 손대지 않았으므로 현재 PR 은 안전하다.
  - 제안: 추적 메모 수준. 현재 구현 착수에는 장애 없음.

- **[INFO]** `spec/2-navigation/` 내 다른 파일들 (`0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md` 등) 은 target 구현과 무관한 독립 spec
  - target 위치: `spec/2-navigation/0-dashboard.md` 외 8개 파일
  - 관련 plan: 없음
  - 상세: 이번 구현이 수정하는 파일(`backend/src/modules/integrations/**`, `frontend/src/app/(main)/integrations/**`)은 `spec/2-navigation/4-integration.md` 에만 대응한다. 같은 영역의 다른 spec 파일(dashboard, workflow-list, auth-flow, error-empty-states, version-history, user-guide, execution-history, trigger-list, schedule, integration) 은 구현 대상과 직접 연관이 없다. 현재 활성 worktree 중 동일 파일을 손대는 것도 없다.
  - 제안: 추가 조치 불필요.

---

### 요약

`integration-token-ui-autorefresh-a3f9b2` 에서 진행 중인 구현(backend DTO `autoRefresh` 필드 + frontend status-badge 분기 + 상세 페이지 표기)은 전체 plan 구조와 대체로 정합하다. 선행 spec 갱신 PR (#139) 이 merge 완료됐다는 기록이 `integration-token-ui-autorefresh.md` 에 있으나, `spec-draft-integration-autorefresh.md` 의 체크리스트가 `[ ] commit + PR` 으로 아직 미체크 상태라 merge 완료 여부를 공식 확인하는 것이 중요하다. `status-badge.tsx` 를 동시에 수정할 수 있는 `cafe24-backlog-residual.md` C-3 과의 직렬화 메모가 아직 해당 plan 에 명시되지 않았고, `EXPIRING_SOON_INTERVAL` 변경이 예정된 `full-review-fixes-a1b2c3` 와의 후속 PR 설계 시 충돌 가능성이 있다. 이 두 WARNING 은 현재 PR 자체에는 영향 없으나, 직렬화 의도를 각 plan 에 명문화하는 것이 바람직하다.

---

### 위험도

LOW
