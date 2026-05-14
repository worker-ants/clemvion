분석에 필요한 정보를 모두 확보했습니다.

---

## 발견사항

### [CRITICAL] 현재 워크트리에 매핑된 plan 문서 없음

- **target 위치**: 해당 없음 (plan 문서 부재)
- **관련 plan**: 없음 (`cafe24-data-model-strengthen-464de9` 워크트리를 frontmatter에 명시한 `plan/in-progress/*.md` 문서가 존재하지 않음)
- **상세**: CLAUDE.md 워크트리 운영 규칙 — "새 plan을 만들 때 frontmatter의 `worktree` 필드에 현재 worktree 이름을 기록한다." 현재 워크트리는 spec/1-data-model.md 수정, V044/V045 마이그레이션 파일 생성, entity·service 코드 수정 등 실질적 변경을 진행 중이나 이를 추적하는 plan이 없다.
- **제안**: `plan/in-progress/cafe24-data-model-strengthen.md` (또는 유사 이름)를 생성하고 `worktree: cafe24-data-model-strengthen-464de9` frontmatter를 명시해야 한다.

---

### [CRITICAL] 미결 결정 항목 2건이 plan 합의 없이 spec에 반영됨

- **target 위치**: `spec/1-data-model.md` §2.10 `install_token_issued_at` 컬럼 (V044) 및 `mall_id` 컬럼 (V045) 정의
- **관련 plan**:
  1. `plan/in-progress/cafe24-pending-polish-followup.md` §그룹 B:
     - `[ ] TTL 기준 분리. ... installTokenIssuedAt 컬럼 (V0XX 마이그레이션) 추가 후 TTL 기준을 옮긴다. 또는 재사용 분기에서 createdAt을 갱신한다 (간단). **트레이드오프 비교 후 결정.** (ai-review W5)`
     - `[ ] TOCTOU advisory lock 또는 mall_id plain 컬럼 분리. ... **mall_id O(N) decrypt 비용 측정 결과와 함께 결정.** (ai-review W4, I11)`
  2. `plan/in-progress/cafe24-pending-polish.md` §변경 3:
     - `[ ] TOCTOU race 방어: advisory lock 또는 mall_id plain 컬럼 분리 후 partial UNIQUE 인덱스 — **구현 시점 결정.**`
     - `[ ] mall_id O(N) decrypt 비용 검토: ... **mall_id를 plain 컬럼으로 분리하는 옵션 비교 (packages 측정 자료 첨부).**`
- **상세**: 두 plan 모두 이 항목들을 체크리스트 미완·결정 보류(`결정 필요`) 상태로 남겨두었다. `spec/1-data-model.md`는 이미 `install_token_issued_at`(V044), `mall_id`(V045) 필드와 인덱스를 확정 반영했고, 마이그레이션 SQL 주석에 결정 근거가 있으나, plan의 체크박스는 여전히 미체크다. plan이 "결정 필요"로 표시한 항목을 plan 업데이트 없이 spec이 일방적으로 결정한 형태다.
- **제안**: plan 두 곳(followup §그룹 B, polish §변경 3/4)의 해당 체크박스를 ✅로 표시하고, 선택한 접근법(installTokenIssuedAt 분리 컬럼 / mall_id plain 컬럼 + partial UNIQUE 인덱스)과 그 근거(migration SQL 주석 내용)를 plan의 결정 기록란에 추가해야 한다. 구현 착수 전 plan이 먼저 갱신되어야 한다.

---

### [WARNING] 선행 조건(PR #18 머지) 미확인

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` frontmatter — `worktree: (none — PR #18 머지 후 새 worktree 에서 진행)`, 본문 — "본 plan 진입 시점에는 PR #18이 머지된 main 기준으로 새 worktree를 만든다"
- **상세**: followup plan은 PR #18 머지를 필수 선행 조건으로 명시한다. `cafe24-pending-polish.md`는 여전히 `in-progress/`에 있으며 상태가 "PR #18 머지 대기 중"이다. 현재 워크트리(`cafe24-data-model-strengthen-464de9`)는 PR #18이 머지되었는지 확인되지 않은 상태에서 Group B 작업을 진행하고 있다. 만약 PR #18이 아직 main에 없다면 현재 변경이 PR #18의 코드 변경(특히 `createPrivatePendingIntegration` 재사용 로직)과 충돌할 수 있다.
- **제안**: PR #18 머지 여부를 확인한다. 미머지 상태라면 현재 워크트리의 base branch 설정을 점검하거나, PR #18 브랜치를 base로 stacking해야 할 수 있다.

---

### [WARNING] 두 plan의 동일 영역 중복 참조 — 완료 시 양쪽 모두 업데이트 필요

- **target 위치**: `spec/1-data-model.md` §2.10 mall_id / install_token_issued_at
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` §변경 3 + §변경 4 (mall_id, TTL 관련 미체크 항목들), `plan/in-progress/cafe24-pending-polish-followup.md` §그룹 B (동일 내용)
- **상세**: mall_id 분리와 TTL 기준 분리는 두 plan에 중복 등재되어 있다. 현재 구현이 완료되면 두 plan 모두 갱신해야 하는데, 추적 plan 자체가 없으므로 누락 위험이 높다.
- **제안**: plan 생성 시 두 plan의 어느 항목이 본 워크트리로 흡수되는지 명시하고, 완료 시 양쪽을 동시에 갱신한다.

---

### [INFO] `cafe24-pending-polish.md`의 이동 조건 충족 시점 확인 필요

- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — "PR #18 머지 후 본 plan은 `plan/complete/`로 이동"
- **상세**: PR #18이 머지되면 `cafe24-pending-polish.md`를 `plan/complete/`로 `git mv`해야 한다는 계획이 있으나, 현재 In-Progress 상태다. 본 워크트리 작업이 완료되어 PR이 생성·머지되는 시점에 이 이동도 함께 처리할지 별도로 처리할지 정의가 없다.

---

## 요약

`spec/1-data-model.md`의 `install_token_issued_at`(V044)·`mall_id`(V045) 추가는 기술적으로 타당하고, 마이그레이션 SQL에 충분한 근거가 담겨 있다. 그러나 이 결정들은 `cafe24-pending-polish.md`와 `cafe24-pending-polish-followup.md` 두 plan에서 **"결정 필요"로 미완 상태인 항목**이었으며, plan 합의·기록 없이 spec이 먼저 확정됐다. 또한 현재 워크트리를 추적하는 plan 문서가 없고, 선행 조건인 PR #18 머지 여부가 불명확하다. 구현 착수 전 plan 두 곳을 갱신하고(결정 기록 + 체크박스 완료 처리), 현재 워크트리 추적 plan을 생성해야 한다.

## 위험도

**HIGH** — plan에서 "결정 필요"로 명시된 항목 2건이 plan 업데이트 없이 spec에 확정 반영되었고, worktree-plan 결속도 없다. 구현 코드가 spec을 정확히 따르더라도 plan 정합성 규약 위반이다.