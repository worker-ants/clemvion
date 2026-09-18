# 요구사항(Requirement) 리뷰 — FK 인덱스 V121~V130 (쓸 인덱스가 없는 FK 서른하나의 처분)

## 검증 방법 메모

저장소 파일 변경(뮤테이션)은 하지 않았다 — 모든 검증은 `Read`/`Grep`/`grep`/`python3 scripts/check-migration-versions.py`
등 read-only 명령으로 수행했다. 세션 시작 시점과 `git status --short` 가 동일함을 확인했다(`plan/*` 3개 수정,
`review/code/.../23_03_16/` 신규 — 이 리뷰 자신의 산출물 디렉터리).

핵심 확인 절차:
- V121~V130 SQL/`.conf` 10쌍 전부를 `codebase/backend/migrations/README.md` §5("신규 추가에도 0) 을 둡니다",
  DROP-먼저 · CREATE 정확히 1개 · `.conf executeInTransaction=false`) 패턴과 문자 단위로 대조.
- 각 SQL 헤더 주석이 주장하는 FK 제약(이름·`ON DELETE` 종류)을 `codebase/backend/migrations/V001__initial_schema.sql`
  등 실제 `REFERENCES ... ON DELETE ...` 정의와 대조(전 10건 grep 재확인, 아래 상세).
- `deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 배열 10개 신규 항목을 실제 `CREATE INDEX` 문(컬럼·`WHERE` 조건)과
  regex 단위로 대조.
- `spec/1-data-model.md` §3 표 10행 + `## Rationale` 신규 절, `spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,
  10-triggers,11-workflow,12-workspace}.md` 미러 행을 migration SQL과 대조.
- `python3 scripts/check-migration-versions.py --base origin/main` 실행 → `OK: 130 migration(s), max V130` (plan
  체크리스트의 실측 주장과 일치).
- 두 차례 consistency-check(`22_33_00` --spec, `22_44_08` --impl-prep) 산출물을 읽고, 첫 라운드 WARNING(Trigger
  `(workflow_id)` 인덱스 절의 "나머지 여섯" 교차참조 미갱신)이 현재 `spec/1-data-model.md` diff 에서 실제로 해소됐는지
  직접 대조(해소 확인, 아래 상세).

## 발견사항

- **[INFO]** consistency-check 1라운드(`22_33_00`)가 지적한 WARNING — 이미 해소됨, 재-flag 아님을 명시
  - 위치: `spec/1-data-model.md` (`## Rationale` → `### Trigger (workflow_id) 인덱스 (2026-09-18)` 절, "나머지 여섯" 문단 뒤)
  - 상세: `cross_spec.md`/`rationale_continuity.md`(22_33_00)는 "V127·V128 이 그 절의 «나머지 여섯» 중 둘을 인덱스화하는데
    그 절에 상호참조 각주가 없다"는 WARNING/INFO를 냈다. 이번 diff의 `spec/1-data-model.md` 실제 변경분을 직접 읽으면
    (`@@ -1076,7 +1154,10 @@` hunk) "그 여섯의 처분: `integration_usage_log.workflow_id` 는 … `auth_config.workspace_id` ·
    `knowledge_base.workspace_id` 는 위 «쓸 인덱스가 없는 FK 서른하나의 처분» 절이 조회 경로 이유로 인덱스를 뒀다(V127 ·
    V128). `alert_rule.workflow_id` 와 `integration_oauth_state` · `integration_oauth_preview` 의 `workspace_id` 는 같은
    절이 비대상으로 남겼다. 이 문단은 V111 시점 결정 범위에서 그대로 참이다." 라는 각주가 정확히 추가되어 있다 — 지적된
    갭이 이미 메워졌다. 후속 리뷰어가 같은 파일을 22_33_00 시점 스냅샷으로 오인해 재차 지적하지 않도록 기록해 둔다.
  - 제안: 조치 불필요(이미 반영됨).

- **[INFO]** plan 체크리스트의 잔여 항목(`/ai-review`·`--impl-done`·트래커 반영·`complete/` 이동)은 정상적인 미완료 상태
  - 위치: `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 체크리스트 마지막 4항목
  - 상세: 두 번째 consistency 라운드(`22_44_08`)의 INFO들("`plan/complete/...` 순방향 인용이 아직 실현 안 됨" 등)은
    "구현 완료 → `--impl-done` → `complete/` 이동" 순서에서 통상 해소되는 상태라고 스스로 명시했다. 실측 결과 코드
    (migrations, e2e)는 이미 구현·검증(`lint · unit · build · e2e — 전부 PASS`, 체크리스트 `[x]`)되어 있고 지금이 바로
    `/ai-review` 단계다 — 이 리뷰 자체가 그 다음 단계를 수행 중이므로 순서상 이상 없음. 코드 결함 아님.
  - 제안: 조치 불필요 — 이 리뷰가 Critical/Warning 0으로 종결되면 developer 가 `--impl-done` → 트래커 반영 → `complete/`
    이동을 이어서 수행하면 된다.

## 세부 대조 근거 (요약)

| 마이그레이션 | 컬럼 · WHERE | 헤더가 주장하는 FK(이름/ON DELETE) | 실제 제약(V001 등) | spec §3 행 | e2e regex |
|---|---|---|---|---|---|
| V121 | `edge(target_node_id)` | `edge_target_node_id_fkey` CASCADE | `REFERENCES node(id) ON DELETE CASCADE`(V001:129, 자동명) | 일치 | 일치 |
| V122 | `llm_usage_log(llm_config_id)` WHERE NOT NULL | `llm_usage_log_llm_config_id_fkey` SET NULL | `REFERENCES llm_config(id) ON DELETE SET NULL`(V014:10, 자동명) | 일치 | 일치 |
| V123 | `workflow(folder_id)` WHERE NOT NULL | `workflow_folder_id_fkey` SET NULL | `REFERENCES folder(id) ON DELETE SET NULL`(V001:85, 자동명) | 일치 | 일치 |
| V124 | `folder(parent_id)` WHERE NOT NULL | `folder_parent_id_fkey` CASCADE | `REFERENCES folder(id) ON DELETE CASCADE`(V001:68, 자동명) | 일치 | 일치 |
| V125 | `workflow_assistant_session(llm_config_id)` WHERE NOT NULL | `workflow_assistant_session_llm_config_id_fkey` SET NULL | `REFERENCES llm_config(id) ON DELETE SET NULL`(V019:19, 자동명) | 일치 | 일치 |
| V126 | `trigger(auth_config_id)` WHERE NOT NULL | `fk_trigger_auth_config`(명시적 이름) SET NULL | `ALTER TABLE trigger ADD CONSTRAINT fk_trigger_auth_config ... ON DELETE SET NULL`(V001:209-210) | 일치 | 일치 |
| V127 | `auth_config(workspace_id)` | `auth_config_workspace_id_fkey` CASCADE | `REFERENCES workspace(id) ON DELETE CASCADE`(V001:197, 자동명) | 일치 | 일치 |
| V128 | `knowledge_base(workspace_id)` | `knowledge_base_workspace_id_fkey` CASCADE | `REFERENCES workspace(id) ON DELETE CASCADE`(V001:268, 자동명) | 일치 | 일치 |
| V129 | `workspace_member(user_id)` | `workspace_member_user_id_fkey` CASCADE | `REFERENCES "user"(id) ON DELETE CASCADE`(V001:54, 자동명) | 일치 | 일치 |
| V130 | `model_config(workspace_id, kind)` | `llm_config_workspace_id_fkey`(구 테이블명 잔존 — `ALTER TABLE RENAME` 은 제약명을 안 바꾼다) CASCADE | `REFERENCES workspace(id) ON DELETE CASCADE`(V001:303, `llm_config`→V088에서 `RENAME TO model_config`, 제약명 불변 확인) | 일치 | 일치 |

특히 V130 헤더의 "FK `llm_config_workspace_id_fkey`"라는 옛 이름 표기는 오기가 아니라 정확한 관찰이다 — `V088__model_config_rename_kind.sql`
을 직접 읽어 `ALTER TABLE llm_config RENAME TO model_config`만 수행하고 제약 재명명 없음을 확인했다.

partial 인덱스 5개(V122~V126)의 `WHERE <col> IS NOT NULL` 조건도 대상 컬럼이 실제로 nullable(`UUID` — NOT NULL 없음)임을
V001/V014/V019 원문에서 확인해 조건이 과도하거나 부족하지 않다.

`spec/1-data-model.md` 의 AssistantSession 인덱스 정정(`(workflow_id, status, last_interaction_at DESC)` →
`(workflow_id, user_id, status, last_interaction_at DESC)`)도 `V019__workflow_assistant.sql:32-33` 의 실제
`CREATE INDEX idx_workflow_assistant_session_wf_user_active ON workflow_assistant_session (workflow_id, user_id, status,
last_interaction_at DESC)` 와 정확히 일치 — 기존 spec 오기를 바로잡는 정당한 정정이며 이번 diff 범위의 사이드이펙트가 아니다.

TODO/FIXME/HACK/XXX 마커: V121~V130 `.sql`/`.conf` 20개 파일 전수 grep 0건.

`check-migration-versions.py --base origin/main` 재실행 결과 `OK: 130 migration(s), max V130` — plan 체크리스트의
실측 주장과 일치, gap·중복 없음.

## 요약

FK 인덱스 마이그레이션 V121~V130(10쌍 `.sql`/`.conf`) 은 기존 V111~V120 이 세운 DROP-먼저·단일 CREATE·`.conf` 비-트랜잭션
컨벤션을 예외 없이 따르고, 각 헤더 주석이 주장하는 FK 제약 이름·`ON DELETE` 종류·partial 조건을 실제 스키마(V001/V014/V019/V088)와
전수 대조한 결과 모두 정확했다 — 특히 V130 의 "옛 테이블명 잔존 제약명" 서술은 `RENAME TO` 가 제약명을 바꾸지 않는다는 세부까지
정확히 반영한 것으로 확인됐다. e2e 스펙(`deletion-cascade-indexes.e2e-spec.ts`)은 `indisvalid` 까지 검증하는 기존 패턴을 유지하며
10개 신규 단언의 정규식이 실제 `CREATE INDEX` 문(컬럼·WHERE)과 정확히 일치한다. `spec/1-data-model.md` §3 표·`## Rationale` 신규
절과 6개 data-flow 미러 문서는 migration 정의와 line-level 로 완전히 일치하며, 앞선 두 차례 consistency-check 라운드가 지적한
유일한 WARNING(인접 Rationale 절의 교차참조 누락)은 실제 diff 에서 이미 해소되어 있음을 직접 확인했다. TODO/FIXME 류 미완성
표식, spec-code 불일치, 에러 시나리오 누락, 반환값 누락에 해당하는 결함은 발견하지 못했다. 남은 항목(`/ai-review`·`--impl-done`·
트래커 반영·`complete/` 이동)은 코드 결함이 아니라 정상적인 워크플로 잔여 단계다.

## 위험도

NONE
