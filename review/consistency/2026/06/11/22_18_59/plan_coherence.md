# Plan 정합성 검토 결과

## 발견사항

### [WARNING] spec/2-navigation/6-config.md — PR #545 와 동일 파일 동시 편집 (active worktree 경합)
- **target 위치**: `spec-update-embedding-testconnection.md` — 변경 §3(§B.3 embedding probe 추가), §4(§B.5 dimension 행 교체), §5(§3 API 표 test 엔드포인트 응답 shape 주석)
- **관련 plan**: `plan/in-progress/unified-model-management.md` / `plan/in-progress/spec-draft-unified-model-management.md` — worktree `unified-model-mgmt-5af7ee`, branch `claude/unified-model-mgmt-pr4`, **PR #545 OPEN**
- **상세**: PR #545 는 `spec/2-navigation/6-config.md` 에서 frontmatter `code:` 경로 7줄 제거 + 라인 ~278 deprecation 주석을 "제거 완료" 문구로 교체하는 변경을 포함한다. target plan 은 동일 파일의 §B.3(라인 ~181-186), §B.5 `dimension` 행(라인 ~209), §3 API 표(라인 ~283 영역)를 수정 예정이다. 서로 다른 라인 영역이라 **내용 충돌은 없지만**, 두 브랜치 모두 같은 파일을 main 에서 분기하여 수정 중이므로 나중에 spec 에 반영할 때 git merge conflict 가 발생할 수 있다. target plan 본문 §우선순위 및 연동에서 이미 인지하고 "PR #545 와 base 정렬 후 반영 권고"를 명시한 상태다. WARNING 으로 처리하되, PR #545 merge 전에 target 의 spec 반영 작업을 착수하지 않도록 주의가 필요하다.
- **제안**: spec 파일 반영 시 PR #545 의 merge 여부를 먼저 확인한다. PR #545 가 merge 된 main 을 base 로 rebase/cherry-pick 후 spec 작업을 진행하면 충돌을 줄일 수 있다. 현재 target plan 의 해당 주의사항(§우선순위 및 연동 첫 번째 항목)은 올바르게 기술돼 있으므로 plan 자체 갱신 불필요.

---

### [WARNING] spec/1-data-model.md — PR #545 와 동일 파일 동시 편집 (active worktree 경합)
- **target 위치**: `spec-update-embedding-testconnection.md` 변경 §6 — `§2.16 ModelConfig.dimension` 필드 설명에 1줄 주석 추가
- **관련 plan**: `plan/in-progress/unified-model-management.md` — PR #545 는 `spec/1-data-model.md` 의 라인 ~334-335(LEGACY 태그 "V092" → "PR4b"), 라인 ~536-539("구현 상태" 문구 갱신)를 수정
- **상세**: target 이 추가하려는 1줄 주석은 라인 ~552 의 `dimension` 필드 행이며, PR #545 변경 라인(334-335, 536-539)과 겹치지 않는다. 내용 충돌은 없으나 동일 파일 편집이라 merge conflict 위험이 있다.
- **제안**: 위 §B.3 WARNING 과 동일 — PR #545 merge 후 base 정렬 권고. target plan 에 이 파일도 "PR #545 merge 후 base 정렬" 명시 보강을 권장한다(현재 §우선순위 및 연동에 `6-config.md` 만 언급, `1-data-model.md` 는 미언급).

---

### [INFO] unified-model-management.md §7 W4 백로그와의 참조 정합
- **target 위치**: `spec-update-embedding-testconnection.md` §레이어 구분 및 §제안 변경 1·2 — `LlmModule → ModelConfigModule` forwardRef 순환 의존을 W4 백로그로 명시
- **관련 plan**: `plan/in-progress/unified-model-management.md §7 W4` — "forwardRef 순환(LlmConfigModule↔ModelConfigModule): `preview-llm-models.dto` 이동으로 근본 원인 해소 — PR4 alias 모듈 제거 시 함께 처리"로 기록
- **상세**: target plan 이 W4 백로그를 정확히 참조하고 있으며 충돌 없음. 단, `unified-model-management.md §7 W4` 가 PR4 에서 alias 모듈 제거 시 해소된다고 기술하는데, PR #545 (PR4 = cleanup) 가 OPEN 상태이므로 W4 는 아직 미해소 상태다. target plan 의 "forwardRef 순환 정리는 백로그 W4" 기술은 현황에 부합한다.
- **제안**: 추가 조치 불필요. spec 본문 반영 시 W4 해소 여부에 따라 관련 Rationale 주석을 업데이트할 것을 메모해 두는 정도면 충분.

---

### [INFO] spec/5-system/7-llm-client.md — 다른 active worktree 의 변경 없음
- **target 위치**: `spec-update-embedding-testconnection.md` 변경 §1·§2 — `7-llm-client.md §8.3` + Rationale 추가
- **관련 plan**: `plan/in-progress/unified-model-management.md` / PR #545
- **상세**: `git diff main...claude/unified-model-mgmt-pr4 -- spec/5-system/7-llm-client.md` 결과 변경 없음. `7-llm-client.md` 는 target plan 의 단독 편집 영역이다. §8.3 의 `// 기존 chat / testConnection / resolveConfig 유지` 주석이 있는 코드 블록에 testConnection probe 표를 추가하는 것은 기존 내용(인터페이스 §3.1 불변 원칙)과 충돌하지 않는다.
- **제안**: 추가 조치 불필요.

---

### [INFO] 선행 plan 정합 — `spec-update-pr2-embedding.md` 완료 확인
- **target 위치**: `spec-update-embedding-testconnection.md` 전반 — PR2 embedding 1급화가 완료된 것을 전제로 `ModelConfigService.findEntity` 경로, `ModelConfig.dimension` SoT 를 기술
- **관련 plan**: `plan/in-progress/spec-update-pr2-embedding.md` (worktree `unified-model-mgmt-5af7ee`)
- **상세**: `spec/1-data-model.md` 의 `embedding_model_config_id`, `embedding_llm_config_id [LEGACY]` 필드가 main HEAD 에 이미 반영되어 있고, `spec-update-pr2-embedding.md` 가 기술한 내용과 일치한다. target plan 이 가정하는 선행 조건(PR2 spec 반영)은 해소된 상태다.
- **제안**: 추가 조치 불필요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목: **0건**

검토한 후보 worktree:
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-pr4`) — Step 1 ancestor 검사: ACTIVE (main 의 조상 아님). Step 2 PR 상태: PR #545 `OPEN`. active 로 분류 → WARNING 으로 보고.
- `fix-embedding-test-dimension-a3d42a` (branch `claude/fix-embedding-test-dimension-a3d42a`) — target plan 자신의 worktree. Step 2 PR 검색: 결과 없음(PR 미생성). Step 3 fallback: active 로 간주.

---

## 요약

target plan `plan/in-progress/spec-update-embedding-testconnection.md` 은 PR #541 후속 회귀 수정(embedding testConnection dimension 자동감지, kind-agnostic 설정 조회, frontend UX)을 spec 에 반영하는 SPEC-DRIFT 작업이다. 핵심 위험은 `spec/2-navigation/6-config.md` 와 `spec/1-data-model.md` 가 active PR #545(`claude/unified-model-mgmt-pr4`)의 변경 파일과 겹친다는 점으로, target plan 자체가 §우선순위 및 연동에서 이 충돌 위험을 인지하고 "PR #545 와 base 정렬 후 반영 권고"를 명시하고 있다. 내용 수준의 결정 충돌은 없으며(편집 라인이 다름), 미해결 결정과의 우회, 선행 plan 미해소, 후속 항목 누락 등 구조적 문제도 없다. 운영 상 필요한 조치는 spec 파일 실제 반영 시 PR #545 merge 선행(또는 해당 커밋 cherry-pick 후 rebase) 뿐이다. `1-data-model.md` 도 PR #545 변경 파일임을 target plan §우선순위 및 연동에 추가 명시하면 더 완전하다. worktree 충돌 후보 2건 중 stale 0건 skip, active 1건(PR #545) 분석.

---

## 위험도

LOW
