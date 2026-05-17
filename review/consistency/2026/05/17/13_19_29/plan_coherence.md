# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target 영역: `spec/2-navigation/`
검토 일시: 2026-05-17
현재 worktree: `integration-token-ui-autorefresh-a3f9b2`
현재 plan: `plan/in-progress/integration-token-ui-autorefresh.md`

---

### 발견사항

- **[INFO]** 진행 체크리스트 미완료 항목 — spec 위생 PR 선행 대기 중
  - target 위치: `plan/in-progress/integration-token-ui-autorefresh.md` §진행 체크리스트 라인 103~105
  - 관련 plan: `plan/in-progress/integration-token-ui-autorefresh.md`
  - 상세: 체크리스트에 `[ ]` 항목 2개가 명시적으로 남아있다. "선행(2차)" — `14-execution-history.md` 자기 참조 링크 제거 + `1-data-model.md §2.10` autoRefresh derived 주석 추가 — 의 spec 위생 PR 이 아직 merge 되지 않은 상태이며, 그 이후 consistency-check 재실행 → BLOCK: NO 확인 절차가 남아 있다. 본 검토 시점의 prompt 파일 하단 "변경 의도" 섹션에서 "PR #142 merge 후 이전 BLOCK 사유 모두 해소" 라고 기술하고 있으므로, 현재 상태는 PR #142 가 merge 된 상태에서의 3차 재실행임을 확인했다. 체크리스트 항목 갱신이 아직 plan 문서에 반영되지 않은 것이 유일한 잔여 사항이다.
  - 제안: 구현 착수 전 `plan/in-progress/integration-token-ui-autorefresh.md` 의 `[ ]` 항목 두 개를 `[x]` 로 갱신하고, 3차 consistency-check 세션 경로(`review/consistency/2026/05/17/13_19_29/`)를 기록해두면 추적성이 완결된다.

- **[INFO]** `cafe24-backlog-residual.md` C-3 와 동일 파일 수정 예고 — 순서 조율 메모는 있으나 plan 미갱신
  - target 위치: `plan/in-progress/integration-token-ui-autorefresh.md` §BLOCK 처리 W-3 메모
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` C-3 (`status-badge.tsx` 의 `isReauthorizeDisabled` 이동)
  - 상세: 현재 worktree(`integration-token-ui-autorefresh-a3f9b2`) 가 `status-badge.tsx` 를 수정 예정이고, `cafe24-backlog-residual.md` C-3 도 같은 파일의 `isReauthorizeDisabled` 이동을 예고한다. 본 PR merge 이후 C-3 를 진행하도록 "순서 조율 권고" 가 integration-token plan W-3 메모에 명시되어 있다. 그러나 `cafe24-backlog-residual.md` 에는 이 조율 메모가 아직 반영되지 않은 것으로 보인다(`worktree: TBD`로 미확정 상태). CRITICAL 수준은 아니다 — 두 작업이 동시에 진행되지 않는 순서(본 PR 먼저) 가 이미 plan W-3 에 명시되어 있기 때문이다.
  - 제안: `cafe24-backlog-residual.md` C-3 항목에 "본 PR(`integration-token-ui-autorefresh-a3f9b2`) merge 후 진행" 선행 조건 한 줄 추가.

- **[INFO]** 후속 PR의 `integrations.service.ts:250` 수정과 full-review RESOLUTION W-32 병합 처리 권고 메모 미추적
  - target 위치: `plan/in-progress/integration-token-ui-autorefresh.md` §BLOCK 처리 W-4 메모 / 프롬프트 §본 PR 범위 밖
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` W-32 (`EXPIRING_SOON_INTERVAL` 공유 상수 추출)
  - 상세: 본 PR 이후 진행될 "후속 PR (attention 술어 변경)" 은 `integrations.service.ts:248~275` 를 건드릴 예정이다. W-32 도 동일 위치를 대상으로 한다. "병합 처리 권고" 메모가 integration-token plan 과 full-review SUMMARY W-32 주석(항목 자체에 명시) 두 곳에 있으나, 후속 PR 기획 문서가 아직 없어 추적 주체가 불명확하다.
  - 제안: 후속 PR 기획 시 W-32 를 같이 처리하는 별도 plan 문서를 사전에 생성하거나, `integration-token-ui-autorefresh.md` 체크리스트에 "후속 PR에서 W-32 병합 처리" 항목을 추가.

---

### 요약

target(`spec/2-navigation/`) 과 `plan/in-progress/integration-token-ui-autorefresh.md` 의 정합성은 양호하다. spec 개정 PR #139 + 위생 PR #142 merge 이후의 3차 impl-prep 검토 시점에서, `spec/2-navigation/4-integration.md` 의 `autoRefresh` 관련 정의(§2.2·§2.3·§2.4·§4.1·§4.2·§9.1·§10.5·§11.4·Rationale) 가 구현 계획과 정합하며, 미해결 결정(BLOCK 사유) 도 해소된 상태다. 다른 in-progress plan 과의 worktree 충돌은 없다 — `cafe24-backlog-residual.md`(worktree TBD) 의 C-3 가 동일 파일을 건드릴 수 있으나, 순서 조율 메모가 명시되어 있고 동시 수정 상황은 아니다. 발견사항은 모두 INFO 수준의 추적 메모 권장 사항이며, 구현 착수를 차단해야 하는 CRITICAL 또는 WARNING 이슈는 없다.

### 위험도

NONE
