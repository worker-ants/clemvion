# RESOLUTION — audit-coverage-naming (cross-audit G-01 / G-02)

본 PR: cross-audit SUMMARY §2 audit 도메인 갭 **G-01**(AUDIT_ACTIONS 상수 + `AuditAction` 타입 강제 + 9 call site 상수화) · **G-02**(`re_run_initiated` → `execution.re_run` 개명). 사용자 결정 방향 = "spec 하향 + 코드 위생".

이 문서는 두 검토 산출물의 처분을 묶어 기록한다:
- **ai-review** `review/code/2026/06/11/20_54_08` (authoritative, diff-base = `origin/main..HEAD`) — RISK MEDIUM, Critical 0, **Warning 4**.
- **consistency** `review/consistency/2026/06/11/18_49_48` (`--impl-done`, scope G-01/G-02) — **BLOCK: NO**, Warning 4.

종합 판정: **차단 사유 없음. 코드 변경 불요.** 4개 ai-review Warning 은 모두 (a) 이미 spec 에 반영됐거나, (b) 변경 범위 밖 untouched 파일의 pre-existing 위생/커버리지 갭으로, G-01/G-02 의 정합성·정확성에 영향이 없다. substantive reviewer(security·architecture·requirement·scope)는 전원 **NONE**.

---

## 1. ai-review (20_54_08) Warning 처분

### W-1 (Testing) — 기존 테스트 raw 문자열 → 상수 미참조 — **DEFER (backlog)**
지적 위치: `integrations.service.spec.ts` L920·1054·1236·1282·1437, `workspaces.service.spec.ts` L719, `auth-configs.service.spec.ts` L472.

- **이 파일들은 모두 본 PR diff 밖 untouched 파일**이다 (내 diff 의 test 파일은 `executions*.spec.ts` 2개뿐). 변환 시 PR footprint 가 3개 무관 파일로 확장돼 scope-reviewer 가 범위 이탈로 잡을 사안 — scope reviewer 가 현 diff 를 **NONE("10개 파일 전체가 G-01·G-02 목표 내 수렴")** 으로 판정한 것과 상충한다.
- **correctness 갭 아님**: 이 테스트들은 raw 문자열로 service 가 emit 하는 action 값을 검증한다. 향후 상수 값이 바뀌면 service 가 새 값을 emit → 테스트는 **여전히 값 불일치로 실패**한다. 즉 드리프트를 잡는다(상수 무력화 아님). 단지 DRY 하지 않을 뿐인 maintainability nicety.
- 처분: audit SoT 위생 백로그로 이월(project 백로그). 본 PR 범위 아님.

### W-2 (Testing) — `integration.updated`·`integration.reauthorized` audit 경로 테스트 부재 — **DEFER (backlog)**
- 두 경로는 실제 emit 된다(`integrations.service.ts` L676 `INTEGRATION_UPDATED`, L1176 `INTEGRATION_REAUTHORIZED`). 그러나 이 테스트 부재는 **pre-existing 커버리지 갭**으로, G-01(상수화)·G-02(개명)이 도입한 것이 아니다. G-01 은 기존 record 호출의 문자열을 상수로 치환했을 뿐 동작을 바꾸지 않았고, 새 union 강제로 두 액션 값은 **컴파일 타임에 이미 검증**된다.
- `reauthorize()` 경로는 OAuth mock 셋업이 필요해 테스트 추가가 trivial 하지 않다. 커버리지 백로그로 이월.

### W-3 (Documentation) — `AuditLogDto.action` Swagger `enum` 미문서화 — **DEFER (backlog)**
- pre-existing doc 갭(`action` 필드는 본래 enum 미보유). 본 PR 은 해당 DTO 의 예시 1줄만 정정했다.
- **hard `enum` 부적절성**: `audit_log.action` 은 DB 레벨 자유 문자열(`VARCHAR(100)`, CHECK 없음 — `spec/data-flow/1-audit.md`)이며 **레거시 row 에 `re_run_initiated` 등 union 밖 값이 존재**한다(G-02 가 신규 row 부터만 적용). 따라서 응답 `action` 을 `Object.values(AUDIT_ACTIONS)` 로 hard-enum 화하면 과거 데이터를 정확히 표현하지 못한다 — 단순 추가가 아니라 표현 정확성 판단이 필요한 사안. DTO 타입도 `string` 유지가 옳다(reviewer INFO #9 도 동의).
- 처분: API 문서 개선 백로그로 이월. 응답 레이어 타입 좁히기는 레거시 값 호환을 함께 설계해야 함.

### W-4 (Documentation / Side Effect) — `re_run_initiated`→`execution.re_run` DB 값 변경 마이그레이션·backfill 부재 — **ALREADY RESOLVED (spec 반영, 검증완료) / partial-FP**
- reviewer 가 diff 만 보고 제기했으나 **spec 이 이미 의도된 결정으로 명문화**한다. `spec/data-flow/1-audit.md`:
  > 과거 `re_run_initiated` … cross-audit G-02 에서 `execution.re_run` 으로 정정됐다 **(신규 row 부터 적용; 기존 레거시 row 는 audit 불변 원칙상 그대로 둔다)**.
- **backfill 은 오히려 audit append-only 불변 원칙 위반**이다 — 수정 대상이 아니라 의도된 보존이다.
- **read-side OR 조회 불요 (검증)**: `grep` 결과 audit `action` 으로 필터/조회하는 read path 가 **존재하지 않는다** (검색된 `re_run*` 은 전부 `execution` 엔티티의 `re_run_of` 부모 체인 컬럼이지 audit action 이 아님). 따라서 레거시/신규 값 OR 결합 질의도 불필요.
- 처분: **조치 없음.** 본 검토 항목은 spec 으로 이미 해소.

### INFO (10건) — 조치 없음 / 선택적 백로그
주요 INFO 는 W-1~W-3 과 동일 계열(execution spec 의 in-diff raw 문자열 `EXECUTION_RE_RUN` 상수화 — 값은 정확하므로 nice-to-have, INFO #2), `auth-configs.service.ts` 의 기존 기술부채(CRUD `userId` 부재 — 이미 `plan/in-progress/auth-config-webhook-followups.md` 백로그 등재, INFO #1), crypto import 통일·매직넘버 등 pre-existing 위생(INFO #4·#5·#6·#7). 전부 본 PR 범위 밖. INFO #10(security): `AuditAction` union 강제로 임의 action 삽입을 컴파일 타임 차단 — **긍정 변경 확인**.

---

## 2. consistency (18_49_48, --impl-done) Warning 처분

### W-3 / W-4 — **main-baseline False Positive (git 반증 완료)**
checker 가 worktree base(origin/main = f2073c6d) 의 **옛 spec** 과 비교해 "spec 미갱신" 으로 오탐. branch HEAD 에는 이미 갱신돼 있다:
- `git show HEAD:spec/data-flow/1-audit.md` → L52 `execution.re_run` (origin/main 은 옛 `re_run_initiated`).
- `git show HEAD:spec/5-system/1-auth.md` → §4.1 integration 과거분사 6개 + execution.re_run 반영.
근거: [reference_consistency_check_main_baseline_fp]. **차단 사유 아님.**

### W-1 / W-2 — pre-existing 파생 문서 갭 — **DEFER (backlog, project-planner)**
`spec/4-.../14.3` · `spec/data-flow/5-integration` 의 integration audit 액션 목록 일부 누락(`integration.updated` 등). **내 diff 밖 파생 문서**이며 audit SoT(`audit-action.const.ts` + `1-auth.md §4.1`)와의 정합은 별건 spec 정비 사안. 본 PR scope 아님 → audit SoT 정합 백로그(project-planner)로 이월.

---

## 3. Superseded 검토 세션 (audit trail)
- `review/code/2026/06/11/11_04_53` — **rebase 이전** 실행. HEAD 가 #542 위로 rebase 되며 무효. 대체: 20_54_08.
- `review/code/2026/06/11/20_49_57` — diff-base 가 working-tree(이미 커밋된 변경 누락, untracked review 산출물만 포함)라 코드 미검토. 잘못된 base 미스파이어로 **삭제**(SUMMARY 미작성 상태였음). 대체: 20_54_08(`--range origin/main..HEAD`).
- `review/code/2026/06/11/10_56_27` — 부분 산출(requirement 만).
- **authoritative review = `20_54_08`** (정상 diff-base, reviewer 8명 완주).

---

## 4. 품질 게이트
- 직전 구현 세션에서 backend build clean · lint 0 errors · integrations+audit-logs 114 passed · executions 37 passed(execution.re_run 확인) 완료.
- **본 세션 코드 변경 없음** (working tree codebase/ 변경 0) → 게이트 재실행 불요, 직전 green 결과 유효.

## 5. 잔여 백로그 (본 PR 이후 별건)
- audit SoT 위생: W-1(타 모듈 spec 의 raw 문자열 → 상수), W-2(integration.updated/reauthorized 테스트), W-3(AuditLogDto Swagger 문서/타입 좁히기 — 레거시 값 호환 설계 포함).
- 파생문서 정합(consistency W-1/W-2): `4-integration §14.3` · `data-flow/5-integration` audit 액션 목록 ↔ SoT 동기화 (project-planner).
- cross-audit 잔여 V-04·V-05·V-09~V-14·V-18 처분 대기.
