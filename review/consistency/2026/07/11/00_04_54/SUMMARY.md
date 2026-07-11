# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

대상: `plan/in-progress/spec-fix-webchat-eia-drift.md` (spec draft 검토, `--spec` 모드)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, D-2(NAV-WC-06 상태 배지 승격)의 변경 범위가 좁아 서로 다른 두 checker(Cross-Spec·Convention Compliance)가 독립적으로 "이 drift-fix 가 없애려는 것과 동일한 클래스의 새 불일치를 다른 위치에 남긴다"는 WARNING 을 냈다 — spec 반영 전 실제로 손봐야 하는 실질적 갭.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | D-2(`NAV-WC-06` `🚧`→`✅` 승격)가 `spec/0-overview.md` §6.2 의 동일 stale 문구("위젯 co-deploy 후 증분 2")와 새 cross-doc 모순을 만든다 | target D-2 절 | `spec/0-overview.md:88` §6.2 Web Chat 위젯 행(§6.1 로 미승격) | D-2 범위에 `0-overview.md` §6.2 문구 제거 + §6.1 승격 포함, 또는 명시적 스코프 각주로 후속 분리 명시 |
| 2 | Convention Compliance | D-2 변경 범위가 같은 파일 내 사이드바 요약 미러와 동기화되지 않아 문서 내부 자기모순 발생 | target D-2 변경 범위 서술 | `spec/2-navigation/_product-overview.md:23` §2 사이드바 요약 "Web Chat" 행(`🚧 partial: 설치·스니펫✅/미리보기 증분2`) | D-2 범위에 `_product-overview.md:23` 사이드바 요약 갱신(`🚧`→`✅`) 명시 추가 |
| 3 | Convention Compliance | 체크리스트의 `/ai-review` 항목이 순수 spec-only 성격 및 동종 완료 plan 6건 전례와 불일치 | target `## 체크리스트` 마지막 항목 | `.claude/skills/project-planner/SKILL.md` 워크플로(`/consistency-check --spec` 만 의무) + `plan/complete/spec-fix-*` 6건 전례 | 코드 변경 미동반 시 `/ai-review` 항목 제거, 또는 "코드 변경 동반 시에만" 조건부 명시 |

> #1·#2 는 사실상 동일 근본원인(D-2 의 "복제 서술 정리" 범위가 실제로는 3곳 — 표 + 사이드바 + `0-overview.md` — 인데 target 은 표 1곳만 다룸)의 서로 다른 발현. 한 번의 편집으로 함께 해소 가능.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Plan Coherence | target 헤더가 소스 plan 을 `plan/complete/widget-presentation-restore.md` 로 인용하나 실제로는 아직 `plan/in-progress/` 에 있음 | target 상단 인용구(27-32행) | 경로를 `plan/in-progress/widget-presentation-restore.md` §5 로 정정하거나 착수 순서 노트 추가 (blocking 아님 — D-1/D-2/D-3 실증은 소스 plan 완료 여부와 무관) |
| 2 | Naming Collision | plan 내부 라벨 `D-1`~`D-3`/`R-D1`~`R-D3` 가 `cafe24-backlog-residual.md` 등 무관 문서의 동일 라벨과 표기상 겹침 | target 본문 섹션 헤더 / Rationale | 조치 불필요(문서-로컬 스코프). 교차 참조 시 파일명 병기 권장 |
| 3 | Convention Compliance | D-3 SoT 인용이 `swagger.md` 단독, `api-convention.md §5.1` 병기 권장 | target D-3 마지막 줄 | 실제 spec 반영 시 `api-convention.md §5.1`(계약) 도 함께 인용 |
| 4 | Convention Compliance | plan 파일명 `spec-fix-*` 컨벤션 정합 확인(문제 없음) | 파일 경로 | 조치 불필요 |
| 5 | Cross-Spec | Rationale R-D1 의 "SSE 동시 3/execution 은 EIA §5.2 소관" 인용이 부정확(실제 SoT 는 §8.4) | Rationale R-D1 괄호 문구 | "§8.4 표에 함께 있으므로" 로 정정하거나 §5.2 언급 제거 |
| 6 | Cross-Spec | D-3 "3곳" 산정이 실제 occurrence 4건(§3-① 안에 2건 포함)을 섹션 단위로 묶은 것 | D-3 목록 | 실 편집 시 §3-① 내 두 occurrence 모두 포함했는지 체크리스트에 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | D-2 flip 이 `0-overview.md` §6.2 stale 문구와 새 모순 생성(WARNING 1건); R-D1 §5.2/§8.4 인용, D-3 카운트 정밀도(INFO 2건). ※ 산출 파일이 디스크에 기록되지 않아(보고된 `status=success` 와 불일치) journal.jsonl 에서 복구 |
| Rationale Continuity | NONE | D-1/D-2/D-3 전부 기존 Rationale(EIA §8.4 구현 명시, `web-chat-console.md` Phase 1/3 완료, `swagger.md` 전역 wrap) 및 확립 원칙과 완전 정합, 위반 없음 |
| Convention Compliance | LOW | D-2 사이드바 요약 미동기화, `/ai-review` 체크리스트 전례 불일치(WARNING 2건); SoT 병기·파일명 확인(INFO 2건) |
| Plan Coherence | LOW | 소스 plan 인용 경로 오기재(`complete/` vs 실제 `in-progress/`, INFO 1건) 외 선행 plan 과의 결정 충돌·후속 누락 없음(D-1/D-2/D-3 선행조건 전부 이미 충족 확인) |
| Naming Collision | NONE | 신규 식별자(요구사항 ID·엔티티·endpoint·이벤트명 등) 창설 없음, 문서-로컬 라벨 재사용만(INFO 1건) |

## 권장 조치사항

1. D-2 변경 범위를 확대해 `spec/0-overview.md` §6.2 의 "위젯 co-deploy 후 증분 2" 문구를 함께 정정(§6.1 로 승격 또는 완료 문구로 교체) — Cross-Spec WARNING #1 해소.
2. D-2 변경 범위에 `spec/2-navigation/_product-overview.md:23` 사이드바 요약("Web Chat" 행) 동기화를 명시적으로 추가 — Convention Compliance WARNING #2 해소. (1·2 는 "복제 서술 정리" 라는 동일 편집 세션에서 표+사이드바+`0-overview.md` 3곳을 함께 처리하면 됨)
3. 체크리스트에서 `/ai-review` 항목을 제거하거나 "코드 변경이 동반될 경우에만" 조건부로 명시 — 동종 완료 plan 6건 전례와 정합.
4. (선택) target 헤더의 소스 plan 인용 경로를 `plan/in-progress/widget-presentation-restore.md` 로 정정.
5. (선택) Rationale R-D1 의 §5.2 → §8.4 인용 정정, D-3 "3곳" 표기에 "§3-① 내 2 occurrence 포함" 각주 추가.
6. 운영 참고: 본 세션의 `cross_spec` 체커 output 파일이 워크플로 실행 중 디스크에 기록되지 않았음(보고된 `status=success` 와 불일치, 과거 유사사례와 동일 클래스). 세션 journal.jsonl(`.../subagents/workflows/wf_e1b9daaa-1ef/journal.jsonl`)에서 원문을 복구해 `cross_spec.md` 로 재기록하고 본 통합에 반영했다. 워크플로 write 단계 신뢰성 재점검을 권장(위양성 BLOCK 은 아니었으나 데이터 유실 위험).