---
worktree: trigger-schedule-sync-f88604
started: 2026-06-10
owner: resolution-applier
---
# Spec Update Draft — spec 문서 스타일 개선 (Warning #9/#10)

## 분류
SPEC-DRIFT (spec 문서 가독성/중복 제거)

## 원본 발견사항
- SUMMARY Warning #9: `spec/data-flow/13-agent-memory.md` Overview 코드 진입점 목록 — 일부 bullet 에 설명 접미어 인라인 혼용, 2줄 넘는 설명 포함. "한 bullet = 파일 경로 + 1줄 책임 요약" 원칙 위반.
- SUMMARY Warning #10: `spec/data-flow/7-llm-usage.md §1.3` 과 Rationale 에 동일 attribution 갭 인과 흐름 이중 서술 — 향후 사실 변경 시 두 곳 수정 필요.

## 제안 변경

### W9: `spec/data-flow/13-agent-memory.md` Overview 코드 진입점 목록

- 2줄 이상인 bullet 의 상세 설명을 `§1.x` 본문으로 이동
- 각 bullet 을 `파일 경로` + 1줄 책임 요약 패턴으로 통일
- 설명 접미어를 일관되게 대시(`—`) 로 구분

### W10: `spec/data-flow/7-llm-usage.md §1.3 + Rationale`

**Before (§1.3 note 에 인과 상세 기술 + Rationale 에 동일 내용 재서술):**
- §1.3 에 attribution NULL 원인·증상·영향 상세
- Rationale 에 동일 인과 흐름 재서술

**After:**
- §1.3 note 를 "Rationale 참조" 1-2줄로 압축
- 인과 상세는 Rationale 에 일원화 (단일 진실 원칙)

예시:
```markdown
<!-- §1.3 note -->
> **[WARNING#5 수정 완료]** attribution 갭은 2026-06-10 커밋(639be831)으로 해소됨.
> 인과 흐름 및 이전 갭 상세: [Rationale §attribution-gap](#rationale) 참조.
```
