# 문서 관리 구조 통합 (prd/spec/memory/user_memo → spec/)

## Context

현재 프로젝트의 정보는 5개 디렉토리(`prd/`, `spec/`, `plan/`, `memory/`, `user_memo/`)에 분산되어 있다. 사실 기반 조사 결과 다음 문제가 확인됨:

- **prd/(11파일·1.8K줄) ↔ spec/(76파일·20K줄) 책임 중복**: spec이 PRD를 11배 상회하면서 동일 주제(예: AI Agent 포트, 노드 시스템)를 양쪽에서 기술. 변경 시 양쪽을 동기화해야 함.
- **memory/ ↔ plan/complete/ 결정 기록 중복**: 같은 결정이 양쪽에 기록된 사례 존재(예: `memory/engine-raw-config-decision.md` ↔ `plan/complete/engine-raw-config-exposure.md`).
- **user_memo/ 고아 문서**: 21개 중 `CONVENTIONS.md`만 spec/에서 36회 정식 참조됨. 나머지는 1회성·역사 문서.
- **skill 권한 모호**: project-planner는 prd/spec을 "사용자 대화로만 작성"이라 하면서 실제로는 직접 작성 중. developer는 read-only지만 "구현 중 명확화 사항 반영" 책임이 명시되어 경계 불명확.

**목표**: 5종 → 2종(`spec/`, `plan/`)으로 통합. spec/은 제품의 **유일한 최종 진실(single source of truth)**, plan/은 작업 추적 라이프사이클로 역할을 분리.

## 결정 사항

| 항목 | 결정 |
| --- | --- |
| 통합 강도 | **중간 통합** — prd/+spec/ → spec/, memory/ → spec/ inline, user_memo/CONVENTIONS → spec/ |
| PRD 처리 | prd/의 사용자 가치/비전 내용을 spec/의 각 영역 상단 "Overview" 섹션으로 흡수 |
| memory/ 처리 | 살아있는 결정은 spec/ 본문 "Rationale" 섹션으로 inline. 폐기된 대안·1회성 분석은 `plan/complete/archive/` 로 이동 |
| user_memo/ 처리 | CONVENTIONS.md → `spec/conventions/node-output.md`. INCONSISTENCY_MATRIX 등 1회성은 `plan/complete/archive/`로. 나머지 빈 디렉토리 제거 |
| skill 갱신 | project-planner / developer / code-review-agents 의 SKILL.md를 새 구조에 맞춰 동시 갱신 |
| CLAUDE.md 갱신 | 5종 디렉토리 정의 → 2종으로 단순화. skill 권한표도 명확화 |

## 최종 디렉토리 구조 (Before / After)

**Before**
```
prd/                  # 사용자 가치 (11파일)
spec/                 # 기술 명세 (76파일)
plan/in-progress/     # 진행 작업 (13파일)
plan/complete/        # 완료 작업 (85파일)
memory/               # 결정 기록 (13파일)
user_memo/            # 사용자 자료 (21파일)
review/               # 리뷰 산출물
```

**After**
```
spec/                          # 제품의 단일 진실 (PRD + Spec + ADR 통합)
  ├ 0-overview.md              # 제품 비전·목표·타겟 (prd/0-overview.md 흡수)
  ├ 1-data-model.md
  ├ 2-navigation/
  ├ 3-workflow-editor/
  ├ 4-nodes/                   # 각 노드 spec 본문에 "Rationale" 섹션으로 ADR 흡수
  ├ 5-system/
  ├ 6-brand.md                 # prd/brand.md 이동
  └ conventions/
      └ node-output.md         # user_memo/.../CONVENTIONS.md 이동

plan/
  ├ in-progress/               # 진행 중 작업 (기존 그대로)
  └ complete/
      ├ ...                    # 기존 완료 plan
      └ archive/               # 1회성·역사 문서 보관
          ├ from-user-memo/    # INCONSISTENCY_MATRIX 등
          └ from-memory/       # spec에 흡수되지 않은 분석 문서

review/                        # 그대로
```

## 파일별 이전 매핑

### prd/ → spec/
| 원본 | 목적지 | 처리 방식 |
| --- | --- | --- |
| `prd/0-overview.md` | `spec/0-overview.md` | 머지 (PRD의 "비전·목표·타겟" 섹션을 spec 상단에 추가) |
| `prd/1-navigation.md` | `spec/2-navigation/` 각 파일 상단 | 화면별로 분배·흡수 |
| `prd/2-workflow-editor.md` | `spec/3-workflow-editor/` 각 파일 상단 | 흡수 |
| `prd/3-node-system.md` | `spec/4-nodes/` 공통 + 카테고리별 0-common.md | 흡수. CONVENTIONS 참조 경로 업데이트 |
| `prd/4-integration.md` | `spec/4-nodes/4-integration/0-common.md` 상단 | 흡수 |
| `prd/5-non-functional.md` | `spec/5-system/` 해당 파일 | 흡수 |
| `prd/6-phase2-ai.md` | `spec/4-nodes/3-ai/` 각 파일 상단 | 흡수 |
| `prd/7-execution-history.md` | `spec/5-system/` 해당 파일 | 흡수 |
| `prd/8-webhook.md` | `spec/5-system/` 해당 파일 | 흡수 |
| `prd/9-graph-rag.md` | `spec/5-system/` 해당 파일 | 흡수 |
| `prd/brand.md` | `spec/6-brand.md` | 단순 이동 (`git mv`) |

### memory/ → spec/ inline + archive
| 원본 | 목적지 | 비고 |
| --- | --- | --- |
| `engine-raw-config-decision.md` | `spec/5-system/` 해당 파일에 Rationale 섹션 | 살아있는 결정 |
| `graph-rag-decisions.md` | `spec/5-system/graph-rag.md` Rationale | 살아있는 결정 |
| `kb-embedding-model-selection.md` | `spec/5-system/graph-rag.md` Rationale | 살아있는 결정 |
| `swagger-pattern.md` | `spec/conventions/swagger.md` 신설 | 정식 규약화 |
| `workflow-ai-assistant-*.md` (7개) | `spec/3-workflow-editor/4-ai-assistant.md` Rationale | 통합 흡수 |
| `execution-engine-analysis.md` | `plan/complete/archive/from-memory/` | 1회성 분석 |
| `node-specs-improvement-progress.md` | `plan/complete/archive/from-memory/` | 작업 진행 로그 (이미 종료) |

### user_memo/ → spec/ + archive
| 원본 | 목적지 | 비고 |
| --- | --- | --- |
| `node-specs-improvement/CONVENTIONS.md` | `spec/conventions/node-output.md` | 정식 규약화. spec/에서 참조 36건 일괄 경로 업데이트 |
| `node-specs-improvement/README.md` | `plan/complete/archive/from-user-memo/` | 프로젝트 개요 (역사) |
| `node-specs-improvement/INCONSISTENCY_MATRIX.md` | `plan/complete/archive/from-user-memo/` | 시점 기반 매트릭스 |
| `node-specs-improvement/<category>/*.md` | `plan/complete/archive/from-user-memo/` | 노드별 개선안 (이미 spec에 반영됨) |
| `node-specs/1-init.md`, `1-init.md` | `plan/complete/archive/from-user-memo/` | 초기 기획 (역사) |

## 실행 순서 (단계별 커밋)

각 단계는 독립 커밋. 단계 간 spec/ 자체 검증(`grep -r "user_memo\|prd/"`) 수행.

1. **archive 폴더 생성 + 1회성 문서 이동**
   - `plan/complete/archive/from-memory/`, `from-user-memo/` 생성
   - `git mv` 로 archive 대상 13개 파일 이동
   - 커밋: `chore(docs): archive one-shot documents to plan/complete/archive`

2. **CONVENTIONS 이동 + 참조 경로 일괄 업데이트**
   - `git mv user_memo/node-specs-improvement/CONVENTIONS.md spec/conventions/node-output.md`
   - spec/ 내 36개 참조 경로를 `../user_memo/...` → `../conventions/node-output.md`로 일괄 치환
   - 커밋: `refactor(docs): promote CONVENTIONS to spec/conventions/node-output.md`

3. **memory/ 살아있는 결정 → spec/ inline**
   - 매핑 표에 따라 각 spec 문서 하단에 "## Rationale" 섹션 추가
   - 흡수 완료된 memory 파일 삭제
   - 커밋: `refactor(docs): inline architectural rationale into spec/`

4. **prd/brand.md → spec/6-brand.md**
   - 단순 `git mv`
   - 커밋: `refactor(docs): move brand to spec/`

5. **prd/ 나머지 → spec/ 흡수**
   - 영역별로 prd → spec 머지 (사용자 가치 섹션을 spec 상단 Overview로 통합)
   - 흡수 완료된 prd 파일 삭제
   - 커밋 분할: 영역별로 2-3개 커밋 (`refactor(docs): merge prd/navigation into spec/2-navigation`, …)

6. **빈 폴더 제거**
   - `prd/`, `memory/`, `user_memo/` 모두 삭제
   - 커밋: `chore(docs): remove emptied folders prd/memory/user_memo`

7. **CLAUDE.md 갱신**
   - 폴더 구조 다이어그램 수정 (2종)
   - skill 권한표 갱신
   - 라이프사이클 규약 명확화
   - 커밋: `docs(claude-md): update folder layout to consolidated 2-folder structure`

8. **skill 문서 갱신**
   - `.claude/skills/project-planner/SKILL.md`:
     - prd/+spec/ → spec/만 다루도록 수정
     - "사용자 대화로만 작성" 모호 표현 제거, "spec/에 직접 작성 + 연관 문서 동기화"로 명시
     - memory/ 작업 항목 제거, "Rationale은 spec/ 본문에 inline" 명시
   - `.claude/skills/developer/SKILL.md`:
     - spec/ Read-only 유지, prd/ 권한 행 제거
     - memory/ 항목 제거 (대신 plan/in-progress/ 에서 작업 노트 관리)
     - DOCUMENTATION 단계의 "구현 명확화 사항 반영" 절차를 "spec/ 수정 제안 메모를 plan/in-progress/ 에 남기고 project-planner에 위임"으로 구체화
   - `.claude/skills/code-review-agents/SKILL.md`:
     - review/ 산출물 경로는 그대로. spec/ 참조 시 prd/ 경로 언급 모두 제거
   - 커밋: `docs(skills): update skill instructions for consolidated docs structure`

9. **검증 + plan 문서 이동**
   - `grep -r "prd/\|memory/\|user_memo/" spec/ plan/in-progress/ .claude/skills/ CLAUDE.md` 가 0건
   - `find prd memory user_memo -type d 2>/dev/null` 가 빈 결과
   - 본 plan 문서를 `plan/complete/`로 `git mv`
   - 커밋: `chore(plan): complete docs-consolidation`

## 위험 요소

- **spec/의 비대화**: 76파일 + PRD 흡수 + Rationale 추가 → 일부 파일이 매우 길어질 수 있음. → 가독성을 위해 각 spec 문서를 "Overview / Spec / Rationale" 3섹션 표준으로 강제.
- **참조 깨짐**: spec/ 내부 36건 user_memo 참조 외에 외부에서 prd/·memory/ 경로를 참조할 수 있음. → 9단계 검증에서 grep 일괄 확인.
- **plan/complete/archive/ 의 비대**: 30+ 파일이 들어옴. → README.md를 archive/ 에 두어 "왜 보관하는지" 명시.
- **단계 중단**: 중간에 멈추면 spec/이 중복 상태로 남음. → 각 단계는 독립 커밋이라 rollback 가능. PR 단위로 8-9단계를 묶어 처리하거나, 모든 단계 완료 전에는 in-progress/ 유지.

## 검증 (완료 기준)

- `ls prd/ memory/ user_memo/ 2>/dev/null | wc -l` = 0
- `grep -rl "prd/\|memory/\|user_memo/" spec/ .claude/skills/ CLAUDE.md` = 빈 결과
- `find spec -name "*.md" | xargs grep -l "^## Rationale" | wc -l` ≥ 5 (Rationale 섹션이 실제로 inline 되었는지)
- `spec/conventions/node-output.md` 존재 + spec/4-nodes/ 내 참조가 새 경로로 갱신
- skill 문서들이 새 구조 기준으로 갱신되어, "prd/" 또는 "memory/" 단어가 정의 문장에 등장하지 않음
- 본 plan 문서가 `plan/complete/`로 이동

## 핵심 파일

수정 대상 (직접 편집):
- `/Volumes/project/private/clemvion/CLAUDE.md`
- `/Volumes/project/private/clemvion/.claude/skills/project-planner/SKILL.md`
- `/Volumes/project/private/clemvion/.claude/skills/developer/SKILL.md`
- `/Volumes/project/private/clemvion/.claude/skills/code-review-agents/SKILL.md`
- `/Volumes/project/private/clemvion/spec/**/*.md` (PRD/memory 내용 흡수)

이동 대상 (`git mv` 또는 삭제):
- `/Volumes/project/private/clemvion/prd/` 전체
- `/Volumes/project/private/clemvion/memory/` 전체
- `/Volumes/project/private/clemvion/user_memo/` 전체

신설:
- `/Volumes/project/private/clemvion/spec/conventions/node-output.md`
- `/Volumes/project/private/clemvion/spec/conventions/swagger.md`
- `/Volumes/project/private/clemvion/spec/6-brand.md`
- `/Volumes/project/private/clemvion/plan/complete/archive/from-memory/`
- `/Volumes/project/private/clemvion/plan/complete/archive/from-user-memo/`
- `/Volumes/project/private/clemvion/plan/complete/archive/README.md` (보관 이유 명시)
