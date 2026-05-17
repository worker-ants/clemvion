### 발견사항

- **[INFO]** `replay-rerun.md` PR1이 `spec/2-navigation/14-execution-history.md §3.7`을 이미 수정 완료
  - target 위치: `plan/in-progress/spec-draft-2-navigation-hygiene.md §3.1` — "줄 3 헤더 blockquote" 패치
  - 관련 plan: `plan/in-progress/replay-rerun.md` 헤더 주석 — "PR1 산출물: 14-execution-history §3.7 + EH-DETAIL-10/11 cross-link 갱신"
  - 상세: `replay-rerun.md` PR1은 §3.7 및 §5 API 표를 수정한 것이며, target plan은 줄 3(파일 최상단 헤더 blockquote)만 수정한다. 수정 범위가 서로 다른 섹션이므로 실질적 충돌은 없다. 단, `replay-rerun.md`에 worktree frontmatter가 없어 현재 해당 작업이 어느 worktree에서 진행 중인지 추적 불가.
  - 제안: 추적 목적으로 `replay-rerun.md` 에 `worktree` frontmatter 추가 권장 (INFO 수준).

- **[INFO]** `spec-update-impl-prep-findings.md` C1이 `spec/1-data-model.md §2.13`을 미해결 상태로 보유, target plan은 §2.10 수정
  - target 위치: `plan/in-progress/spec-draft-2-navigation-hygiene.md §3.2` — `spec/1-data-model.md §2.10 Integration` 표 직후 단락 추가
  - 관련 plan: `plan/in-progress/spec-update-impl-prep-findings.md` C1 — `spec/1-data-model.md §2.13 Execution` 컬럼 추가 (미완료 `[ ]`)
  - 상세: 두 plan 모두 `spec/1-data-model.md`를 수정하지만 서로 다른 섹션(§2.10 vs §2.13)을 건드린다. merge 충돌 가능성은 낮으나 두 worktree가 같은 파일을 동시에 수정 중인 구조다. `spec-update-impl-prep-findings.md`의 worktree는 `ai-thread-source-mark-7c4f2a`이며 현재도 활성 상태.
  - 제안: 섹션이 분리되어 있으므로 실질 위험은 낮다. 단, merge 순서를 명시적으로 기록하거나 두 plan 간 상호 참조 메모를 추가하면 충돌 예방에 도움이 된다.

- **[WARNING]** `integration-token-ui-autorefresh.md` 체크리스트 항목 103이 target plan을 선행 조건으로 명시하나, target plan은 이 연결을 후속 항목으로 기재
  - target 위치: `plan/in-progress/spec-draft-2-navigation-hygiene.md §5 후속` 및 `§6 체크리스트 [ ]` 항목들
  - 관련 plan: `plan/in-progress/integration-token-ui-autorefresh.md` 체크리스트 줄 103 — "선행(2차): 작은 spec 위생 PR 먼저 — `14-execution-history.md` 자기 참조 링크 제거 + `1-data-model.md §2.10` 에 `autoRefresh` derived 가상 필드 주석 추가"
  - 상세: `integration-token-ui-autorefresh.md`는 target plan의 merge를 "선행(2차)" 완료 후 main rebase → consistency-check → BLOCK: NO → 구현 진입 순서로 명시하고 있다. target plan의 §5 후속에서도 동일한 의존 관계를 기재하고 있어 양쪽 plan이 일관되게 직렬화를 명시한다. 다만 `integration-token-ui-autorefresh-a3f9b2` worktree는 이미 활성 상태로 열려 있으며 아직 체크리스트 항목이 미완료(`[ ]`)인 상태이므로, target plan이 완료되어야 그 worktree의 진입이 가능하다. 이 의존 관계가 양쪽 plan에 명시적으로 기록되어 있는 점은 긍정적이나, target plan의 §6 체크리스트에 "merge 후 `integration-token-ui-autorefresh-a3f9b2` 팀 진입 가능" 단계가 없어 연결 추적이 불완전하다.
  - 제안: target plan `§6` 체크리스트에 "PR merge 후 `integration-token-ui-autorefresh-a3f9b2` worktree 진입 해제" 항목을 추가해 선행 조건 해소 사실이 명확히 추적되도록 한다.

- **[INFO]** `spec-draft-integration-autorefresh.md`가 `spec/2-navigation/4-integration.md §9.1`에 `autoRefresh: boolean` 필드를 이미 추가 완료(PR #139 merge됨), target plan의 `spec/1-data-model.md §2.10` 주석은 이와 cross-ref 관계
  - target 위치: `plan/in-progress/spec-draft-2-navigation-hygiene.md §3.2` — `spec/1-data-model.md §2.10` 주석 본문에 `spec/2-navigation/4-integration.md §9.1` cross-ref 포함
  - 관련 plan: `plan/in-progress/spec-draft-integration-autorefresh.md` — 이미 merge된 PR. `spec/2-navigation/4-integration.md`의 `autoRefresh` 정의가 target plan의 cross-ref가 가리키는 목적지
  - 상세: `spec-draft-integration-autorefresh.md`의 PR #139가 이미 merge된 상태이므로 target plan이 참조하는 `spec/2-navigation/4-integration.md §9.1`의 `IntegrationDto.autoRefresh` 정의가 실제로 존재한다. cross-ref 타겟이 유효하다는 긍정적 확인이다.
  - 제안: 별도 조치 불필요. 단, target plan 패치 본문의 cross-ref 경로(`spec/2-navigation/4-integration.md#91-목록crud`)가 실제 헤딩 앵커와 일치하는지 spec 패치 적용 시 한 번 확인할 것.

### 요약

target plan(`spec-draft-2-navigation-hygiene.md`)은 수정 범위가 좁고(2개 파일, 2~3라인 패치) 의존 관계가 명확하게 문서화되어 있다. `integration-token-ui-autorefresh-a3f9b2` worktree가 target plan의 merge를 선행 조건으로 대기 중이며, 이 관계는 양쪽 plan에 모두 기록되어 있다. `spec/1-data-model.md`에 대한 다른 plan(`spec-update-impl-prep-findings.md`)의 미완료 작업은 §2.13(전혀 다른 섹션)을 다루므로 직접 충돌 위험은 낮다. `replay-rerun.md` PR1은 이미 완료된 `14-execution-history.md §3.7` 수정이며 target plan의 줄 3 패치와 섹션이 달라 경합이 없다. 전반적으로 worktree 충돌이나 미해결 결정 우회는 없으며, WARNING 1건(후속 연결 추적 누락)과 INFO 3건이 발견된다.

### 위험도

LOW
