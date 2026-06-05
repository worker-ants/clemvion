---
reviewer: convention-compliance (subagent)
target_diff: git diff 84dd7314..HEAD
worktree: agent-memory-scope-index-6b4a98
date: 2026-06-05T15:28:00
---

# 정식 규약 준수 검토 — convention_compliance

대상: `git diff 84dd7314..HEAD` (merge-base: `84dd7314`, HEAD: `faa464b8`)  
핵심 변경: V086 마이그레이션 신설 + spec 인덱스 표 갱신 + plan complete 이동

---

## CRITICAL

해당 없음.

---

## WARNING

### [WARNING] spec/5-system/17-agent-memory.md — pending_plans 에 삭제된 plan 항목 잔류

- **target 위치**: `spec/5-system/17-agent-memory.md` frontmatter `pending_plans` 8~9행
- **위반 규약**: CLAUDE.md "정보 저장 위치" + `.claude/docs/plan-lifecycle.md §3` "spec/ 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신"
- **상세**: `pending_plans` 에 `plan/in-progress/agent-memory-admin-ui.md` 와 `plan/in-progress/agent-memory-summary-model.md` 두 항목이 남아 있다. 이번 diff 이전 커밋들(#477·#480)에서 이 두 파일이 삭제(deleted)되어 있음이 diff 에서 확인된다. 이번 V086 변경에서 `17-agent-memory.md` 의 다른 내용(§3·§6·§7 섹션 대규모 revert)은 수정됐으나, 이 두 `pending_plans` 항목은 제거되지 않았다. spec 파일의 `pending_plans` 는 살아있는 링크여야 하며, plan 이 삭제·완료 처리된 시점에 동시에 갱신되어야 한다(`plan-lifecycle.md §3`). 단, 현재 worktree(`agent-memory-scope-index-6b4a98`)의 `plan/in-progress/` 에 해당 두 파일이 여전히 존재함이 확인됐다 — 이는 이전 커밋에서의 삭제가 이 worktree 에 아직 반영되지 않은 rebase/merge 지연 상태이거나, 해당 plan 이 실제로 아직 진행 중임을 의미한다. 전자(삭제된 plan 을 참조)라면 dangling link, 후자(실제 in-progress)라면 현 상태가 정상이다.
- **제안**: `plan/in-progress/agent-memory-admin-ui.md` 와 `plan/in-progress/agent-memory-summary-model.md` 의 현재 상태를 확인한다. 해당 plan 이 이미 완료·삭제됐다면 `17-agent-memory.md` frontmatter 에서 두 줄을 제거한다. 아직 `in-progress` 상태라면 현재 spec frontmatter 내용은 정상 — 별도 조치 불필요.

---

### [WARNING] plan/complete/agent-memory-scope-index.md — `spec` 필드와 `spec_impact` 필드 중복 선언

- **target 위치**: `plan/complete/agent-memory-scope-index.md` frontmatter 8~13행
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` Gate C (`spec_impact` 가 완료 plan 의 spec 정합 선언 정식 필드, `spec` 는 비정식)
- **상세**: 동일한 경로 목록이 `spec_impact` 와 `spec` 두 키에 중복 선언돼 있다.

  ```yaml
  spec_impact:
    - spec/5-system/17-agent-memory.md
    - spec/1-data-model.md
  spec:
    - spec/5-system/17-agent-memory.md
    - spec/1-data-model.md
  ```

  `spec_impact` 는 `plan-lifecycle.md §4 Gate C` 의 정식 필드이며 build guard(`spec-plan-completion.test.ts`)가 검사한다. `spec` 는 `plan-lifecycle.md §4` 에 없는 비정식 필드로, 동일 경로를 반복해 혼동을 유발한다. Gate C 요건은 `spec_impact` 단독으로 충족된다.
- **제안**: `spec` 필드 7행을 제거하고 `spec_impact` 만 유지한다. 기타 다른 plan 파일들에서도 동일 중복 패턴이 있다면 정리 대상.

---

## INFO

### [INFO] V086 인덱스 명 `idx_agent_memory_scope_updated` — 동일 테이블 내 prefix 미세 불일치

- **target 위치**: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` 15행
- **위반 규약**: `spec/conventions/migrations.md §1` (snake_case 권장 집합 — 영문 소문자+숫자+`_`)
- **상세**: 명명 규약(snake_case, 영소문자+숫자+`_`) 위반은 아니다. V073 의 `idx_agent_memory_scope` 와 이름 체계가 자연스럽게 이어진다(`_updated` suffix). 단, V074~V079 HNSW 인덱스가 `idx_agent_mem_emb_*`(약어 `agent_mem`)를 쓰는 데 비해 이번 인덱스는 `idx_agent_memory_*`(전체어)를 써서 미세한 스타일 불일치가 있다. 기능 범주(B-tree 정렬 커버 vs. pgvector HNSW)가 달라 의도적 차이로 해석 가능하므로 INFO 수준.
- **제안**: 현재 명명 유지 허용. 향후 동일 테이블에 B-tree 인덱스를 추가할 때는 `idx_agent_memory_*` 계열을 표준으로 삼는 것을 권장.

---

### [INFO] plan/complete/agent-memory-scope-index.md — `title` 비필수 추가 필드

- **target 위치**: `plan/complete/agent-memory-scope-index.md` frontmatter 2행
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` (추가 필드 허용 명시)
- **상세**: `title` 필드는 `plan-lifecycle.md §4` 에서 "추가 필드는 허용"으로 명시되어 있으므로 위반 아님. 정보성 언급.
- **제안**: 유지 또는 제거 모두 허용 — 규약상 무방.

---

## 요약

이번 diff(`84dd7314..HEAD`)의 핵심 변경인 V086 마이그레이션은 정식 규약을 충실히 준수한다. 파일명(`V086__agent_memory_scope_updated_index.sql` / `.conf`) 이 `spec/conventions/migrations.md §1` 명명 규약을 따르고, `.conf` 페어링과 base name 일치도 정확하다. `executeInTransaction=false` 가 올바르게 선언됐고, SQL 본문도 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + DOWN 주석 패턴을 V074~ 미러와 동일하게 따른다. V번호 연속성(V085 다음 V086)도 gap·alphanumeric suffix 없이 단조 증가 규약을 준수한다. plan frontmatter 는 Gate C `spec_impact` 를 선언하고 `status: complete` 가 정확히 기재됐다. 두 가지 WARNING 이 발견됐다. 첫째, `17-agent-memory.md` frontmatter 의 `pending_plans` 항목 두 개가 이미 삭제된 plan 파일을 참조할 가능성(worktree 상태에 따라 dangling). 둘째, plan frontmatter 에서 `spec_impact` 와 `spec` 두 키가 동일 목록을 중복 선언. CRITICAL 발견사항은 없다.

## 위험도

LOW

## BLOCK: NO
