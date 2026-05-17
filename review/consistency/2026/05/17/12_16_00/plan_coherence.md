# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 (--impl-prep)
> Target: `spec/2-navigation/`
> 대상 worktree: `integration-token-ui-autorefresh-a3f9b2`
> 검토 시점: 2026-05-17

---

## 발견사항

### [CRITICAL] `autoRefresh` 기반 `computeStatus` 분기가 현재 spec 정의와 충돌

- **target 위치**: `integration-token-ui-autorefresh.md` §범위 "프론트엔드 — `computeStatus` 의 `expiresSoon` 분기에 `autoRefresh` 가드" + 변경 의도 §2 "expiresSoon 분기를 `expiresSoon && !autoRefresh` 로 좁힘"
- **관련 plan**: `plan/in-progress/spec-update-integration-autorefresh.md` — "결정 필요" 로 남겨진 spec 변경 항목 (§2.4, §2.3, §9.1, §10.5, §11.4). 동 plan은 "project-planner 호출 또는 사용자에게 위임 → spec 본문 갱신"이 체크박스 미완 상태임.
- **상세**: 현재 `spec/2-navigation/4-integration.md §2.2` 상태 텍스트 정의는 `Connected / Expires in Nd / Expired / Error / Pending install` 이며, autoRefresh 통합에 대한 예외 규칙이 없다. 구현 계획은 `computeStatus` 를 수정해 `expiresSoon && autoRefresh` 인 경우 "Expires in Nd" 대신 "Connected + Auto-renews subLabel" 을 반환하도록 한다. 이는 spec §2.2 가 정의한 `expiresSoon` → "Expiring" 전이 규칙을 spec 갱신 없이 일방적으로 우회하는 것이다. `spec-update-integration-autorefresh.md` 는 이 변경을 project-planner 합의 사안으로 명시하고 있으나, 합의가 완료되지 않은 상태에서 구현이 동일 worktree에서 진행될 예정이다.
- **제안**: 구현 착수 전 `spec-update-integration-autorefresh.md` 의 project-planner 위임 체크리스트를 선행 완료하고, `spec/2-navigation/4-integration.md §2.2 / §4.1 / §4.2` 가 autoRefresh 예외를 명시한 이후 구현을 진행해야 한다. 대안으로 이번 PR 범위에서 `computeStatus` 분기 변경을 제외하고 `subLabel` 렌더·`InfoRow tooltip` 등 순수 표현 레이어에만 한정하는 방법도 있다.

---

### [CRITICAL] `IntegrationDto.autoRefresh` 필드가 spec §9.1 에 정의되지 않은 상태에서 DTO 추가

- **target 위치**: `integration-token-ui-autorefresh.md` §범위 "백엔드 — `IntegrationDto` 에 `autoRefresh: boolean` 필드 추가" + 변경 의도 §1 "IntegrationDto 에 `autoRefresh: boolean` 신규 필드 추가"
- **관련 plan**: `plan/in-progress/spec-update-integration-autorefresh.md` §A "§9.1 IntegrationDto 응답 스키마 — `autoRefresh: boolean` 필드 추가" — 체크박스 미완(project-planner 위임 미완료).
- **상세**: `spec/2-navigation/4-integration.md §9.1` 에는 현재 `autoRefresh` 필드가 존재하지 않는다. 구현 계획은 이 필드를 backend DTO 와 frontend 타입에 추가할 예정이다. spec 에 정의되지 않은 필드를 DTO 에 추가하면 spec-code 드리프트가 발생하며, swagger 문서와 spec 간 불일치가 생긴다. 이는 SDD(Spec-Driven Development) 원칙상 spec 선행 요건에 해당하는 사안이다.
- **제안**: `spec-update-integration-autorefresh.md` §A 의 spec 갱신(§9.1 autoRefresh 필드 추가)이 project-planner 에 의해 완료된 이후 DTO 추가를 진행한다. spec 갱신 PR 이 merge 되기 전까지 backend DTO 변경을 블로킹해야 한다.

---

### [WARNING] `status-badge.tsx` 에 대한 잠재적 병렬 작업 (cafe24-backlog-residual)

- **target 위치**: `integration-token-ui-autorefresh.md` §영향 파일 "`frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — expiresSoon 분기 가드 + StatusView.subLabel + StatusBadge 렌더"
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` §Polish-followup 잔여 C-3 "`isReauthorizeDisabled` 위치 이동 — badge UI 컴포넌트(`status-badge.tsx`) 에서 export 중 → 도메인 모듈로 이동". `worktree: TBD` (미배정).
- **상세**: `cafe24-backlog-residual.md` 의 C-3 항목이 `status-badge.tsx` 에서 `isReauthorizeDisabled` 를 다른 모듈로 이동하는 리팩토링을 요구하고 있다. 현재 `worktree: TBD` 이므로 다른 worktree 에서 동시에 작업 중이지는 않지만, 이번 PR 이 `status-badge.tsx` 를 수정한 이후 C-3 리팩토링이 착수되면 merge conflict 또는 semantic conflict 가 발생할 수 있다. 이번 PR 이 `StatusView` 타입·렌더 로직을 변경하기 때문에 이후 `isReauthorizeDisabled` 이동 작업의 범위가 달라진다.
- **제안**: C-3 작업 착수 시 이번 PR 에서 변경된 `status-badge.tsx` 형태를 기준으로 이동 대상을 재확인하도록 `cafe24-backlog-residual.md` C-3 항목에 "이번 PR(integration-token-ui-autorefresh) 머지 이후 진행" 메모를 추가한다.

---

### [WARNING] 20260516-full-review RESOLUTION 의 deferred W-32 (`EXPIRING_SOON_INTERVAL`)와 후속 충돌 가능성

- **target 위치**: `integration-token-ui-autorefresh.md` §본 PR 범위 밖 "backend `EXPIRING_SOON_INTERVAL` 쿼리 변경 — 후속 PR"
- **관련 plan**: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 W-32 "`EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석으로만 동기화". 같은 파일이 `integrations.service.ts:250` 을 가리킨다.
- **상세**: `spec-update-integration-autorefresh.md §백엔드 영향` 은 후속 PR 에서 `integrations.service.ts` 의 `EXPIRING_SOON_INTERVAL` 사용 위치에 `AND NOT autoRefresh` 조건을 추가한다고 명시한다. 이는 W-32 의 "EXPIRING_SOON_INTERVAL 상수 통합" 작업과 동일 위치(`integrations.service.ts:250`)를 건드린다. W-32 는 worktree 미배정 상태이므로 직접 충돌은 아니지만, 후속 PR 기획 시 두 변경을 함께 처리하거나 순서를 명확히 해야 한다. 이번 PR 은 해당 파일을 건드리지 않으므로 직접 충돌은 없다.
- **제안**: `spec-update-integration-autorefresh.md` 에 W-32 와 동일 파일·위치를 수정한다는 사실을 메모로 추가하여, 후속 PR 작성자가 W-32 와 병합 처리할 수 있도록 한다.

---

### [INFO] `spec-update-impl-prep-findings.md` 의 open C1 (Execution data-model) — 이번 작업과 무관

- **target 위치**: 이번 구현 대상 `spec/2-navigation/`
- **관련 plan**: `plan/in-progress/spec-update-impl-prep-findings.md` (worktree: `ai-thread-source-mark-7c4f2a`) C1 — `spec/1-data-model.md §2.13` re_run_of/chain_id 컬럼 미추가.
- **상세**: C1 은 `spec/5-system/13-replay-rerun.md §9.1` 와 관련된 데이터 모델 문서 변경이며, 이번 구현 대상(`spec/2-navigation/`)과 영역이 다르다. 직접 충돌 없음. 추적 메모로 기록.
- **제안**: 조치 불필요.

---

### [INFO] `harness-i18n-userguide-gap.md` — i18n parity 체크 병렬 추적

- **target 위치**: `integration-token-ui-autorefresh.md` §범위 "i18n ko/en 키 추가"
- **관련 plan**: `plan/in-progress/harness-i18n-userguide-gap.md` — i18n ko↔en dict parity 자동 가드 관련 미해소 항목 (20260516-full-review W-19).
- **상세**: 이번 PR 은 `frontend/src/lib/i18n/dict/ko/integrations.ts` 와 `en/integrations.ts` 에 신규 키를 추가한다. `harness-i18n-userguide-gap.md` 가 추적하는 parity 가드 메커니즘이 main 에 병합 완료되었는지 여부와 무관하게, 이번 PR 에서 ko/en 동시 추가하면 parity 는 유지된다. 단, parity 가드가 미병합 상태라면 가드 없이 불일치가 생길 수도 있으므로 확인 권장.
- **제안**: PR 제출 전 `harness-i18n-userguide-gap.md` 또는 main branch 에서 i18n parity 가드 병합 여부를 확인한다. 미병합이라도 이번 PR 에서 ko/en 키를 함께 추가하는 것으로 충분히 대응 가능.

---

## 요약

이번 구현(`integration-token-ui-autorefresh-a3f9b2`) 에서 가장 중요한 정합성 문제는 **spec 갱신 선행 요건이 충족되지 않은 상태에서 spec 에 정의되지 않은 `autoRefresh` 필드 추가와 `computeStatus` 분기 변경을 동시에 진행하려 한다는 점**이다. `spec-update-integration-autorefresh.md` 는 이 spec 변경이 project-planner 합의를 필요로 한다고 명시하고 있으며, 이 체크박스는 아직 미완 상태다. 결과적으로 이번 PR 의 백엔드 DTO 변경과 프론트엔드 `computeStatus` 수정은 현재 spec §9.1·§2.2 와 직접 충돌한다(CRITICAL 2건). 해소 경로는 spec 갱신 먼저 (project-planner 경유) → 구현 진행 이다. 단, `computeStatus` 분기를 제외하고 순수 표현 레이어(subLabel 렌더, InfoRow tooltip)만으로 이번 PR 범위를 축소하면 CRITICAL 중 일부를 회피할 수 있다. WARNING 2건은 후속 PR 계획 수립 시 추적이 필요한 항목이다.

---

## 위험도

**HIGH**
