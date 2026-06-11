# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-unified-model-management.md`
**Mode**: spec draft (--spec)
**Date**: 2026-06-10

---

## 발견사항

### [INFO] `worktree` 필드 값 prefix 불일치
- **target 위치**: frontmatter `worktree: claude/unified-model-mgmt-5af7ee`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — worktree 필드는 `<task_name>-<slug>` 디렉토리 이름 단독 기재가 관례 (`plan_coherence` checker 가 이 값을 worktree 디렉토리 basename 으로 매칭)
- **상세**: 실제 worktree 경로는 `.claude/worktrees/unified-model-mgmt-5af7ee` 이나 frontmatter 에는 `claude/unified-model-mgmt-5af7ee` 로 기록됨. `plan_coherence` checker 가 worktree 폴더 이름과 비교 시 불일치로 false alarm 을 일으킬 수 있음.
- **제안**: `worktree: unified-model-mgmt-5af7ee` 로 수정 (`.claude/worktrees/` prefix 제거, basename 만 기재).

---

### [INFO] `변경 5` 번호 누락 (변경 4 → 변경 6 으로 건너뜀)
- **target 위치**: 문서 본문 섹션 순서 — 변경 0/1/2/3/4 다음 바로 `변경 6`
- **위반 규약**: 명시적 번호 연속성 규약은 없으나 CLAUDE.md 의 문서 구조 일관성 권장.
- **상세**: 변경 5 가 존재하지 않음. 의도적 삭제인지 실수인지 판단 불가.
- **제안**: 의도적 생략이면 `<!-- 변경 5 삭제됨: <사유> -->` 주석 추가. 번호 오류라면 `변경 5` 로 renumber.

---

### [INFO] API endpoint 명명: `set-default` 동사형 경로 선택 근거가 규약 문서에 미반영
- **target 위치**: `변경 2 §3` — `PATCH /api/model-configs/:id/set-default`, `변경 6 §6-E`
- **위반 규약**: `spec/conventions/swagger.md` 에 동사형/명사형 서브경로 선택 규약 없음.
- **상세**: 6-E 에서 기존 선례 유지를 명시했으나 정식 규약 문서에는 해당 결정이 미반영. 다른 엔드포인트 작성자가 참조할 SoT 없음.
- **제안**: `spec/conventions/swagger.md` 에 동사형 서브경로 선례 패턴과 선택 근거 1절 추가 검토. 본 draft 채택 blocking 아님.

---

### [INFO] `related_plan` 필드는 비표준 frontmatter 키 (허용 범위 확인)
- **target 위치**: frontmatter `related_plan: plan/in-progress/unified-model-management.md`
- **위반 규약**: `plan-lifecycle.md §4` — 필수 필드 외 추가 필드는 허용. `related_plan` 은 명시 허용·명시 금지 어디에도 없음.
- **상세**: build guard(`plan-frontmatter.test.ts`)는 추가 필드를 거부하지 않으므로 위반 아님.
- **제안**: 관행으로 정착 시 `plan-lifecycle.md §4` 에 추가 필드 예시로 문서화 권장.

---

### [INFO] 마이그레이션 번호 예시 표기 — 규약 참조는 정합, 절차 준수 재확인 필요
- **target 위치**: `변경 0` 버전 표기 주의 callout
- **위반 규약**: 없음 — `spec/conventions/migrations.md §5` 절차를 올바르게 참조하고 있음.
- **상세**: "구현 착수 시 당시 max+1부터 순차 재할당" 명시 및 `migrations.md §5` 참조가 규약과 정합. 위반 아님.
- **제안**: 구현 PR 착수 시 실제 max V 확인 후 번호 확정 절차 준수 재확인으로 충분.

---

## 요약

`plan/in-progress/spec-draft-unified-model-management.md` 는 `plan-lifecycle.md §4` 의 필수 frontmatter 3개 필드(`worktree`/`started`/`owner`)를 갖추고 있으며, 마이그레이션 절차 참조(`migrations.md §5`)와 API endpoint 선례 유지 명시 등 핵심 규약 참조가 적절히 이루어지고 있다. 주요 지적 사항은 `worktree` 필드 값에 `claude/` prefix 가 붙어 있어 `plan_coherence` checker 에서 불일치가 발생할 수 있다는 점(INFO)과 변경 번호 5 건너뜀에 대한 주석 부재(INFO)이며, 둘 다 CRITICAL 수준이 아니다. `set-default` 동사형 경로 선택 근거의 규약 문서 미반영(INFO)은 중장기 일관성 risk 이나 현 draft 채택 blocking 아님. 전반적으로 정식 규약을 크게 벗어나는 항목이 없다.

## 위험도

LOW
