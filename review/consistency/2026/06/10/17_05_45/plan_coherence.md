# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-unified-model-management.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] V088 마이그레이션 번호 경합 가능성
- **target 위치**: 변경 0 — V088 `llm_config→model_config rename + kind/dimension 추가`
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` line 51 — "**`queued_at` 신설 확정(V088)**" (PR2b: `execution.queued_at` 컬럼)
- **상세**: target draft는 "V088~V092는 현시점(max V087) 기준 예시이며, 구현 착수 시 당시 max+1부터 순차 재할당한다"는 동적 번호 caveat를 명시한다. 그러나 `exec-intake-queue-impl.md`는 V088을 `queued_at` 컬럼 전용으로 확정(결정 기록)하고 있으며, 이 plan에는 같은 동적 재할당 caveat가 없다. 두 plan 중 하나가 먼저 착수하면 상대방이 renumber를 강제당한다. spec/conventions/migrations.md §5 절차가 race를 감지·해소하지만, target draft의 caveat와 exec-intake plan의 "확정" 표기가 불일치하여 후발 구현자가 혼선을 겪을 수 있다.
- **제안**: target draft의 변경 0 주석에 "exec-intake-queue-impl PR2b(queued_at)도 V088을 예약하고 있어 번호 race가 실제로 발생할 가능성이 높다. 어느 쪽이 먼저 착수하든 max+1 재할당이 필요하다"를 1줄 추가. `exec-intake-queue-impl.md` PR2b 항목에도 동일한 동적 재할당 caveat 추가 권장.

---

### [WARNING] `rag-rerank-followup.md` — `/api/rerank-configs` spec 항목을 target이 deprecation으로 전환
- **target 위치**: 변경 2 §3 API / 변경 6-D — `/api/rerank-configs`에 deprecation 주석 + 제거 시점 = 본 plan PR4 명시
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` line 25 — `spec/2-navigation/6-config.md` 에 `/api/rerank-configs` CRUD 절 추가 (`[x]` 완료)
- **상세**: `rag-rerank-followup.md`는 `/api/rerank-configs` CRUD 절을 `spec/2-navigation/6-config.md`에 정식 추가(완료)했다. target draft는 이 절에 deprecation alias 표기를 덮어씌우고 PR4에서 제거하기로 결정하고 있다. 이 자체는 후속 작업이지만, `rag-rerank-followup.md`의 모든 항목이 `[x]` 완료 상태임에도 plan이 `complete/`로 이동하지 않은 채로 있어, target 착수 후 `rag-rerank-followup.md`의 "완료된 spec 항목"과 실제 spec 간에 내용 역전이 발생한다. 또한 `rag-rerank-followup.md`의 §비고("모든 surface 구현 시 complete/로 이동") 조건이 충족됐음에도 이동이 이뤄지지 않아 추적이 불분명해진다.
- **제안**: target draft landing 전 또는 직후에 `rag-rerank-followup.md`를 `plan/complete/`로 이동. 이동 전 §비고에 "deprecation alias는 unified-model-mgmt PR4에서 제거됨 — spec 참조 갱신"을 1줄 추가.

---

### [WARNING] `related_plan` frontmatter dead link
- **target 위치**: 파일 상단 frontmatter `related_plan: plan/in-progress/unified-model-management.md`
- **관련 plan**: 해당 파일이 `plan/in-progress/`에도 `plan/complete/`에도 존재하지 않음
- **상세**: target draft frontmatter의 `related_plan`이 가리키는 `plan/in-progress/unified-model-management.md`는 repo 어디에도 없다. plan-lifecycle 규약상 `related_plan`은 유효한 파일 경로여야 한다.
- **제안**: target draft frontmatter에서 dead link를 제거하거나, 실제 구현 plan 파일이 별도로 있다면 그 경로로 교체.

---

### [INFO] `kb-model-change-reembed-followup.md` — 미해결 정책 결정과의 부분 접촉
- **target 위치**: 변경 2 Part B Embedding 탭 — "차원 변경 차단(재임베딩 가드 — `kb-model-change-reembed-followup` 규칙 참조)"
- **관련 plan**: `plan/in-progress/kb-model-change-reembed-followup.md` — 선택지 1·2·3(자동 트리거 / 강제 모달 / 노출 강화)이 미결, `spec/5-system/8-embedding-pipeline.md §7.3` + `spec/2-navigation/5-knowledge-base.md §2.2` 갱신이 선행 필요로 명시되어 있음
- **상세**: target draft는 "차원 변경 차단 가드의 존재만 선언"(W#8 처리 기록)하고 구체적 정책(선택지 1/2/3)은 `kb-model-change-reembed-followup`에 위임하고 있다. 이 처리 방향 자체는 올바르나, `embedding_model_config_id` FK 전환 후에는 "모델 변경" 감지 로직이 기존 문자열 비교에서 FK 참조 비교로 바뀐다. `kb-model-change-reembed-followup`의 §배경("embedding 모델을 바꾸면 embedding_dimension을 NULL로 초기화하지만")은 아직 `KB.embedding_model` 문자열 컬럼 기반 서술로 되어 있어, target landing 후 이 plan의 배경 설명이 구식이 된다.
- **제안**: target 착수 확정 후 `kb-model-change-reembed-followup.md` §배경을 `embedding_model_config_id` FK 기반으로 갱신(착수 전에 project-planner 반영). 단 이 변경 전에 정책 결정이 선행되어야 하므로 순서: 정책 결정 → spec 갱신 → 배경 갱신.

---

### [INFO] `spec-sync-config-gaps.md` — §3 API 표 항목과 비충돌 확인
- **target 위치**: 변경 2 §3 API 표 전면 교체 (`/api/model-configs` SoT)
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` (worktree: spec-sync-audit = STALE) — "§3 API 표 … 코드와 1:1 정합 — 강등 대상 아님" 기록
- **상세**: spec-sync-config-gaps의 미해결 항목은 모두 §A(AuthConfig, IP Whitelist/Header 이름/이력 기간 분해)이며, §3 API 표에 대한 미해결 결정은 없다. 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무 — 실제 발견됨)

worktree 충돌 후보 중 §worktree stale 판정으로 skip된 항목:

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2 PR state: MERGED. 이 worktree는 `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/data-flow/6-knowledge-base.md`를 포함하나 이미 main에 머지됨.
- `kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`) — Step 2 PR state: MERGED. spec 파일 변경 없음 확인.
- `kb-lifecycle-groom-57cc46` (branch `claude/kb-lifecycle-groom-57cc46`) — Step 2 PR #513 MERGED. `spec/2-navigation/5-knowledge-base.md`만 수정, main에 포함됨.

위 3개의 worktree 디렉토리가 `.claude/worktrees/`에 체크아웃된 채로 남아 있다. 정리 권장: `./cleanup-worktree-all.sh --yes --force`

---

## 요약

`spec-draft-unified-model-management.md`는 전반적으로 in-progress plan들과 정합적이다. CRITICAL 충돌(미해결 결정 우회, active worktree 동시 파일 경합)은 발견되지 않았다. 주요 위험은 두 개의 WARNING이다: (1) V088 마이그레이션 번호를 `exec-intake-queue-impl.md`(queued_at)와 target draft(model_config rename) 양쪽에서 예약·확정 표기하고 있어 구현 착수 시 실제 renumber race가 높은 확률로 발생할 것이며, (2) `rag-rerank-followup.md`의 모든 항목이 완료(`[x]`)임에도 plan이 `complete/`로 이동되지 않아 target landing 후 해당 plan의 spec 서술이 역전된다. `related_plan` dead link는 frontmatter 교정이 필요하다. worktree 충돌 후보 3건 모두 stale(MERGED) skip, active worktree 충돌 0건 분석.

## 위험도

LOW
