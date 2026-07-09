# Consistency Check 통합 보고서 (--impl-done, scope=spec/2-navigation/)

**BLOCK: NO** — 5개 checker 전량 수집 완료(cross_spec·plan_coherence 는 subagent write 격리로
워크플로가 파일 기록에 실패했으나, 결과가 journal `wf_5389c4d0-fd9` 에 온전히 남아 main 이
복원). Critical 0. cross_spec WARNING 1건은 **금번 코드 변경과 무관한 pre-existing spec-vs-spec
드리프트**로 project-planner 위임 대상(본 developer PR 비차단).

> 대상: 슬러그 라우팅 하드닝 B (커밋 `f2fd9c61d` + `4647d3486`, diff-base=origin/main).
> spec 본문 변경 0건인 순수 FE 코드 하드닝.

## 전체 위험도
**LOW** — Critical 0, WARNING 1(pre-existing·범위 밖), INFO 다수(문서 완결성). 코드 변경은
`_layout.md §2.2`·`9-user-profile.md §3`·`data-flow/12-workspace.md` 가 확립한
"URL slug = FE 라우팅 SoT ≠ backend 인가 SoT" 모델과 정확히 정합하며, 오히려 기존 slug-누락
latent 버그 3건을 원칙에 맞게 수정(spec-compliance 개선).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 처리 |
|---|---------|------|-------------|------|
| 1 | cross_spec | 요구사항 ID `EH-DETAIL-06` 이 영역 간 다른 범위·완료 상태로 사용 — `14-execution-history.md` 는 "단일 노드 Preview 탭 = ✅완료", `1-ai-agent.md`·`conversation-thread.md`·`data-hydration-surfaces.md` 는 동일 ID 를 "cross-node thread 재구성 = v2 미해결"로 지칭 | `spec/2-navigation/14-execution-history.md` §요구사항 EH-DETAIL-06 | **범위 밖·비차단**. 금번 diff 는 spec 무변경(코드만)이라 이 드리프트를 유발·악화하지 않음. spec ID 범위 조정은 developer 권한 밖 → **project-planner 후속 위임**(각주 추가 또는 신규 ID 발급) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `14-execution-history.md` §1 개요 표가 slug 접두 표기 생략(`_layout.md §2.2` 논리경로 컨벤션상 허용 범위지만 같은 문서 Overview 는 slug 명시) | `14-execution-history.md` §1 | (선택) §1 표에 "(활성 워크스페이스 slug 기준)" 각주 — planner |
| 2 | convention_compliance | `spec-area-index.test.ts` 의 `INDEX_RE` 가 `0-` 시작 파일 전부를 index 로 오인하는 blind spot(현재 링크 정상) | `spec/2-navigation/0-dashboard.md` | (선택) INDEX_RE 축소 or SKILL 예외 명문화 — planner |
| 3 | convention_compliance | 영역 내 Overview 섹션 존재 비일관(`14-execution-history.md` 만 자체 Overview) | `14-execution-history.md` | (선택) planner 통일 여부 판단 |
| 4 | convention_compliance | 폴더 API(`GET /api/folders`) 응답 envelope 가 §3.1 본문 미명시(구현은 swagger.md 준수) | `1-workflow-list.md` §3.1 | (선택) `{data: FolderDto[]}` 한 줄 명시 — planner |
| 5 | plan_coherence | plan/target·선행 plan(phase1 complete)·연결 plan 잔여항목 모두 정합, 갱신 불요 | `plan/in-progress/slug-routing-hardening.md` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 모두 정합. 유일 실질 이슈 = pre-existing EH-DETAIL-06 ID 드리프트(코드 무관). slug SoT 모델 정합 확인 |
| rationale_continuity | NONE | 순수 FE 리팩터가 "URL slug=FE 라우팅 SoT·backend 인가 SoT 분리·editor/docs phase-1 제외" 원칙과 충돌 없이 오히려 slug 누락 버그 3건 정합화. `resolveFallbackWorkspace` 불변 |
| convention_compliance | LOW | spec/2-navigation 본문 무변경(코드 전용 diff). INFO 4건(문서 완결성) |
| plan_coherence | NONE | plan 이 명시한 "spec/API/데이터모델 무변경 순수 FE 리팩터" 범위와 정확히 일치. 미해결 결정 우회·선행 plan 미해소·후속 누락 모두 없음 |
| naming_collision | NONE | 신규 식별자(`buildExecutionHref`/`toSafeInternalPath`/`isSafeInternalPath`/`safe-path.ts`/`types.ts`) 충돌 없음. `WorkspaceSummary`/`WorkspaceRole` 은 파일 이동+하위호환 re-export |

## 권장 조치사항

1. cross_spec WARNING(EH-DETAIL-06 ID 범위 드리프트)은 spec 편집이 필요한 pre-existing 이슈 →
   **project-planner 후속 위임**. 금번 developer PR 은 비차단(코드 무변경 영역).
2. INFO 는 전부 문서 완결성·선택 사항으로 비차단.
