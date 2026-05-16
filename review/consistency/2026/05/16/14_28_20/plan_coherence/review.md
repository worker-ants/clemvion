### 발견사항

- **[CRITICAL]** `spec/2-navigation/4-integration.md` Rationale 섹션에 대한 동시 worktree 경합
  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` Rationale 신설 항목 2개 ("Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)", "precheck endpoint — mall_id 입력 단계 사전 감지 UX")
  - 관련 plan: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` (worktree: `cafe24-hmac-raw-fix-b8e2d1`) — 변경 3: `spec/2-navigation/4-integration.md` Rationale 말미에 "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 추가. 해당 변경은 브랜치 `claude/cafe24-hmac-raw-fix-b8e2d1` 에 commit `30be2f94` 로 이미 적용된 상태이며, 아직 main 에 미병합.
  - 상세: 두 worktree(`cafe24-hmac-raw-fix-b8e2d1`, `cafe24-mall-dup-ux-a7f2c8`)가 동일 파일 `spec/2-navigation/4-integration.md` 의 `## Rationale` 섹션 말미를 동시에 수정한다. hmac-raw-fix 가 먼저 commit 을 만들었고 현재 PR 대기 중이므로, cafe24-mall-dup-ux 가 main 기반으로 Rationale 에 새 항목을 추가하면 merge 시 텍스트 충돌이 확정적으로 발생한다. 현재 main 에는 hmac-raw-fix 의 Rationale 변경이 포함되어 있지 않다.
  - 제안: `cafe24-hmac-raw-fix-b8e2d1` PR 을 먼저 main 에 병합한 뒤, 현재 worktree(`cafe24-mall-dup-ux-a7f2c8`) 를 `git rebase main` 또는 `git merge main` 으로 갱신하고 Rationale 추가를 진행한다. 두 PR 의 병렬 merge 가 불가피하면 `merge-coordinator` 를 경유해 conflict 를 사전 패치로 해소한다.

- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` 의 미완 spec 갱신과 target 이 `spec/2-navigation/4-integration.md` §9 / Rationale 를 공유
  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` §9.2 begin 표 수정 + Rationale 신설
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3` — 실제로 존재하지 않음) — 미체크 항목 `[ ] spec 갱신` 이 `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §6 / §9 / §10.2 / Rationale 전반을 수정 예정. worktree 가 소멸한 채 spec 갱신이 미완 상태로 남아 있음.
  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 `[ ] spec 갱신` 은 §9 (status 분기, request-scopes Private 응답 shape) 와 Rationale 를 포함한다. target 이 수정하는 §9.2 는 §9 내부에 있으므로 영역이 겹친다. 해당 plan 의 worktree 가 이미 소멸해 직접적인 git 충돌 위험은 낮으나, 어느 쪽이 먼저 §9 / Rationale 를 갱신하느냐에 따라 나중 작업자가 이전 변경을 모르고 덮어쓸 수 있다. 특히 Rationale 에 신규 항목을 순서 없이 두 군데서 추가하면 항목 순서 불일치가 생긴다.
  - 제안: `spec-update-cafe24-app-url-reuse.md` 를 담당할 작업자(또는 project-planner)에게 본 target 의 §9.2 변경 내용(public begin 가드 + precheck 행)이 먼저 병합됨을 알린다. 해당 plan 의 §9 갱신 시 target 의 변경 결과를 기반으로 작업하도록 plan 에 메모를 추가한다.

- **[WARNING]** `spec-update-cafe24-background-refresh.md` 의 §11 갱신이 target 과 같은 파일의 다른 섹션을 미완 상태로 대기 중
  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` §9.2 / §9.4 / Rationale
  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f` — 존재하지 않음) — `spec/2-navigation/4-integration.md` §11.1 의 스캐너 잡 목록 + §11.x 신규 소절 추가가 미완 상태 (`[ ] project-planner 진입해 위 4개 항목 작성`).
  - 상세: 두 plan 이 동일 파일의 서로 다른 섹션(§9 vs §11)을 손대므로 직접 텍스트 충돌 위험은 낮다. 그러나 두 변경이 순서 없이 PR 로 올라오면 §9 와 §11 이 서로 다른 상태의 파일을 base 로 만들어질 수 있다. worktree 소멸 상태에서 plan 이 미완이므로, 다음 담당자가 작업 시 target 의 Rationale/§9 변경이 이미 포함된 파일을 기반으로 시작해야 한다는 점을 plan 에 명시해야 한다.
  - 제안: `spec-update-cafe24-background-refresh.md` 에 "§9 / Rationale 변경은 `cafe24-mall-dup-ux-a7f2c8` PR 병합 이후 기준으로 작업 시작" 메모 추가. 반대로 target 의 project-planner 작업자도 `spec-update-cafe24-background-refresh.md` 가 §11 을 아직 추가하지 않은 상태라는 것을 인지하고, §11 근방을 건드리지 않도록 주의한다.

- **[WARNING]** 선행 조건인 `consistency-check --impl-prep` 가 아직 미체크
  - target 위치: `cafe24-mall-dup-ux.md` — `- [ ] consistency-check --impl-prep` (진행 상태 섹션)
  - 관련 plan: `cafe24-mall-dup-ux.md` 자체 (본 plan 의 체크리스트)
  - 상세: 개발자 skill 규약에 따라 구현 착수 **직전** 에 `--impl-prep` 호출이 의무이다. 현재 세션은 `spec/2-navigation/4-integration.md` 를 scope 로 하는 `--impl-prep` (구현 착수 전 spec 검토) 이지만, `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스가 미체크인 채로 구현 단계가 진행되면 규약 위반이 된다. 또한, 현재 이 consistency-check 가 그 `--impl-prep` 의 결과이기도 하므로, 본 세션 종료 후 체크박스를 체크하고 plan 을 갱신해야 한다.
  - 제안: 본 consistency-check 완료 후 `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 항목을 `[x]` 로 갱신한다.

- **[INFO]** `cafe24-mall-dup-ux.md` — `- [ ] Spec 위임 (project-planner)` 항목이 미처리 상태인데 target(spec-update-cafe24-public-dup-guard.md) 을 먼저 생성
  - target 위치: `cafe24-mall-dup-ux.md` — "Spec (5) — 별도 plan 노트로 위임" + `plan/in-progress/spec-update-cafe24-public-dup-guard.md` 생성
  - 관련 plan: `cafe24-mall-dup-ux.md` 자체
  - 상세: 개발 plan 이 spec 갱신을 project-planner 에게 위임한다는 내용과 위임 plan 을 직접 작성한 것은 정합하다. 다만 plan 항목 `- [ ] Spec 위임 (project-planner)` 이 체크되지 않은 채로 위임 plan 문서만 작성된 상태다. project-planner 가 실제로 spec 을 반영하기 전이므로 위임 자체는 미완이다. 이 관계를 명시적으로 연결해 두지 않으면 진행 상황 파악이 어렵다.
  - 제안: `cafe24-mall-dup-ux.md` 의 `Spec (5)` 항목을 "- [x] plan/in-progress/spec-update-cafe24-public-dup-guard.md 작성 완료 (위임 대기 중)" 으로 갱신하거나, `spec-update-cafe24-public-dup-guard.md` 가 project-planner 에 의해 처리 완료되는 시점에 양쪽 plan 을 동시에 갱신한다.

### 요약

검토 대상(`spec/2-navigation/4-integration.md`)을 수정하는 plan 은 현재 4개다. 이 중 `cafe24-hmac-raw-fix-b8e2d1`(worktree 활성, PR 대기) 이 같은 파일의 Rationale 섹션을 이미 commit 한 상태로, target 도 Rationale 에 신규 항목 2개를 추가하려 해 병합 시 텍스트 충돌이 확정적이다(CRITICAL). `spec-update-cafe24-app-url-reuse.md` 와 `spec-update-cafe24-background-refresh.md` 는 각각 §9 및 §11 의 수정이 미완 상태이지만 worktree 가 소멸해 직접 경합은 낮다(WARNING, 순서 관리 필요). `consistency-check --impl-prep` 체크박스 미갱신은 규약 준수 관점에서 즉시 처리가 필요하다(WARNING). `cafe24-hmac-raw-fix-b8e2d1` PR 의 main 병합을 선행하고, 현재 worktree 를 rebase 한 뒤 spec 갱신을 진행하는 것이 가장 안전한 직렬화 경로다.

### 위험도

HIGH
