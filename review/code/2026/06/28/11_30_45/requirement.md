# Requirement Review — trigger-endpoint-validate-bb15e3

## 발견사항

### **[INFO]** V103 pre-flight 가드: NULL 조건 포함 정합 확인 (이상 없음)
- 위치: `V103__trigger_endpoint_path_uuid_validate.sql` 라인 56-57
- 상세: pre-flight SELECT 는 `endpoint_path IS NOT NULL AND endpoint_path !~* ...` 로 NULL 행을 제외한다. V102 의 CHECK 제약 역시 `endpoint_path IS NULL OR ...` 조건이므로 NULL 허용 의미가 동일하게 유지된다. 정합.

### **[INFO]** V103 pre-flight UUID 정규식 — V102 제약과 완전 일치
- 위치: `V103__trigger_endpoint_path_uuid_validate.sql` 라인 57 vs `V102__trigger_endpoint_path_uuid_check.sql` 라인 32
- 상세: V102 constraint regex `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`와 V103 pre-flight의 부정 매치 regex가 동일하다. 정합.

### **[INFO]** 제약명 일치 확인
- 위치: `V103__trigger_endpoint_path_uuid_validate.sql` 라인 65
- 상세: `VALIDATE CONSTRAINT chk_trigger_endpoint_path_uuid` 가 V102 에서 정의한 `ADD CONSTRAINT chk_trigger_endpoint_path_uuid` 와 동일명. 오탈 없음.

### **[INFO]** plan in-progress 체크리스트 — build·e2e·/ai-review·/consistency-check 미완료
- 위치: `plan/in-progress/trigger-endpoint-path-uuid-validate.md` 라인 305-309
- 상세: `TEST: build·e2e`, `/ai-review`, `/consistency-check --impl-done` 이 아직 미체크([ ]) 상태이다. 마이그레이션 실제 적용 후 이 단계들을 완료해야 PR 이 게이트를 통과한다. 현재 리뷰 시점에서 in-progress 임을 감안하면 비차단이지만, PR push 전 모두 체크 완료 필요.

### **[INFO]** plan frontmatter `worktree` 필드 포맷 — 경로 prefix 없음
- 위치: `plan/in-progress/trigger-endpoint-path-uuid-validate.md` 라인 2
- 상세: `worktree: trigger-endpoint-validate-bb15e3` 로 `.claude/worktrees/` prefix 없이 slug만 기재됐다. `plan-lifecycle.md §1` 예시(`worktree: .claude/worktrees/webchat-spec-polish-followups-0fd355`)와 형식이 다르다. 단, `webchat-usewidget-split.md` 와 동일 파일에서도 prefix 없는 형식을 혼용하는 것이 관찰되며(`webchat-spec-polish-followups.md`는 prefix 포함), 이는 프로젝트 내 기존 혼용 패턴이다. build guard(`plan-frontmatter.test.ts`)가 prefix 유무를 강제하는지 spec 에서 확인되지 않아 INFO 처리.

### **[INFO]** spec 침묵 — V103 VALIDATE 승격에 대한 spec 명세 없음
- 위치: `spec/5-system/12-webhook.md` WH-MG-02 / `spec/1-data-model.md`
- 상세: WH-MG-02 는 DTO 레벨 `@IsUUID('4')` 강제만 명시하고, V102 의 NOT VALID CHECK 제약 추가 또는 V103 의 VALIDATE 승격에 대한 DB 레벨 이중 방어 단계는 spec 본문에 없다. V102 SQL 헤더는 "이중 방어" 의도를 인라인 주석으로 설명하나 spec 에 요구사항 ID 로 명세돼 있지 않다. 코드(migration 주석)는 WH-SC-01·WH-MG-02 를 인용하며 합리적 동기를 갖추고 있다. spec 누락이나 코드 버그가 아닌 spec 본문 침묵 영역이므로 INFO.

### **[INFO]** DOWN 절차 코멘트만 제공 — 실행 가능한 DOWN 스크립트 없음
- 위치: `V103__trigger_endpoint_path_uuid_validate.sql` 라인 67-71
- 상세: PostgreSQL 에는 `VALIDATE CONSTRAINT` 를 NOT VALID 로 되돌리는 표준 DDL 이 없다는 사실이 코멘트에 명시됐고, 롤백 절차(DROP 후 V102 NOT VALID 정의 재적용)도 주석으로 안내되어 있다. 운영상 한계에 대한 충분한 설명이 있으며, 의도적 설계다.

---

## 요약

V103 마이그레이션의 핵심 기능(pre-flight 위반 row 가드 + VALIDATE CONSTRAINT 승격)은 의도한 요구사항을 완전히 충족한다. pre-flight SELECT 의 NULL 처리와 UUID 정규식이 V102 제약 정의와 정확히 대칭 일치하며, 제약명도 정확하게 참조된다. 멱등성(이미 VALID 이면 PostgreSQL no-op)과 운영 안전(SHARE UPDATE EXCLUSIVE lock, 배포 직전 재확인 가드)도 구현됐다. 부수 수정인 Gate C 회귀 2건(`spec_impact: []` → `none`, `webchat-spec-polish-followups.md` spec_impact 누락 추가)은 메모리 `feedback_spec_impact_gate_c_list` 의 규칙을 정확히 따른다. 관련 spec(WH-MG-02, WH-SC-01)은 DTO 레벨 강제만 명시하며 DB 레벨 이중 방어는 spec 침묵 영역이지만 코드 주석에서 충분히 근거를 밝히고 있다. 체크리스트에 build·e2e·review 단계가 미완료 표시이나 이는 in-progress 진행 상태를 반영한 것으로 PR push 전 완료 필요 사항이다. CRITICAL 또는 WARNING 발견사항 없음.

## 위험도

LOW
