---
worktree: spec-sync-s-batch-b85f17
started: 2026-06-10
owner: resolution-applier
spec_impact:
  - spec/data-flow/7-llm-usage.md
  - spec/data-flow/13-agent-memory.md
---
# Spec Update Draft — spec 문서 스타일 개선 (Warning #9/#10)

> **완료 (2026-06-13, spec-sync-s-batch)**: W10 적용(§1.3 note 를 Rationale 참조로 압축, 인과 상세는
> Rationale "`llm_usage_log` nullable context" 항에 일원화). W9 는 점검 결과 13-agent-memory.md Overview
> 코드 진입점 목록이 이미 `경로 — 1줄 요약` 패턴을 준수(2줄 초과 bullet·인라인 혼용 없음) → 별도 변경 불요(no-op).

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

예시 (정정 — 2026-06-13: 아래 원본 예시는 attribution 갭을 "해소됨"으로 가정했으나, 현행 spec 은
여전히 "코드 수정 vs 집계 의미 재정의 결정 대기" 상태다. 실제 적용은 **결정 대기 상태를 보존**한 채
§1.3↔Rationale 중복만 제거하는 아래 형태로 했다):
```markdown
<!-- §1.3 note (실제 적용본) -->
> **attribution 갭**: 노드 발 LLM 호출은 `workflow_id` 가 NULL 이라 워크플로우별 비용 집계에서 누락된다
> (워크스페이스 집계는 정상). 원인·증상·결정 상태 상세는 [§Rationale](#rationale) 의
> "`llm_usage_log` 의 nullable context 컬럼들" 항에 일원화 — 단일 진실.
```
