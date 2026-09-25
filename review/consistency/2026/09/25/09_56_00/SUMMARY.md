# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

대상: `plan/in-progress/harness-probe-isolation.md` (pytest 하네스 프로브 격리, `spec_impact: none`, harness-only)

## 전체 위험도
**LOW** — Critical/위반 없음. plan 간 교차 참조 누락 1건과 신규 헬퍼 명명 근접 1건이 WARNING 으로 남아 구현·문서 정리가 권장된다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 같은 테스트 클래스(`test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest`)를 대상으로 한 미해결 후속 항목이 인용되지 않음 | §A 표 1번 행, §C "판별력이 약해지지 않는가" | `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다" 하위 `### 미해결` 2번째 항목(순위→생존 단언 전환 캐너리) | target §C 또는 §E 체크리스트에 해당 미해결 항목을 상호 참조로 추가하고, 새 캐너리가 들어갈 자리(같은 클래스 vs 별도 `ROOT` 기반 클래스)를 명시 |
| 2 | naming_collision | 신규 `make_probe_repo` 가 기존 `make_temp_git_repo` 와 이름·역할(둘 다 "임시 git 저장소 생성")이 겹침 | §C 처방 표 #1 (채택안) | `.claude/tests/_harness.py:119` `make_temp_git_repo(path, *, branch, initial_commit)` | `make_probe_repo` 구현 시 `make_temp_git_repo` 를 내부 위임하거나, docstring 에 두 함수의 상위집합 관계를 명시해 중복 유지보수 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/7-llm-client.md` 는 프로브가 우연히 건드리는 피해 대상으로만 등장, 그 문서 내용과는 무관 | §A 표 1행, §A 하단 | 조치 불필요. 테스트 코드 주석에 "예시 파일일 뿐 내용 미검증" 한 줄 남기면 향후 오인 방지(선택) |
| 2 | cross_spec | 번들 예산이 `spec/conventions/**` 를 전부 절단했으나 target 이 그 문서들과 상호작용하지 않아 결론에 영향 없음 | 프롬프트 메타(관련 spec 번들) | 조치 불필요(이 target 한정) |
| 3 | convention_compliance | bare `hh_mm_ss` (`01_31_05` W1) 리뷰 인용은 `review-citations.md` §3 이 `plan/**` 을 명시적으로 예외 처리해 위반 아님 | 본문 도입부 | 조치 불필요 |
| 4 | plan_coherence | 신설 `make_probe_repo` 가 기존 안전장치(`git_in`/`make_temp_git_repo`)를 재사용하는지 미명시 | §C 처방 표 #1 | 구현·코드리뷰 단계에서 `git_in` 경유 여부 확인, 확인되면 `harness-review-gate-followups.md` §13 "pre-existing 4곳" 잔여 해소 여부도 갱신 |
| 5 | naming_collision | "probe" 라는 단어가 `_shared/git_probe.py`(git 조회 유틸) 와 `make_probe_repo`(프로브 격리 헬퍼) 두 의미로 공존 | 문서 전반, §D 의 `git_probe.worktree_changed_files` 인용과 공존 | 조치 불필요. `make_probe_repo` docstring 첫 줄에 `_shared/git_probe.py` 와 무관함을 명시하면 grep 혼동 감소 |
| 6 | naming_collision | `CONSISTENCY_OUTPUT_DIR` 은 기존 env var 정의와 정확히 같은 의미로 (기각된 대안으로만) 인용됨 — 충돌 아님 | §C 처방 후보 #3 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | product spec 의 데이터모델·API·요구사항ID·상태전이·RBAC·계층책임 어느 것도 target 이 정의/변경하지 않음. 유일한 실제 spec 언급(`7-llm-client.md`)은 프로브 피해자로만 등장 |
| rationale_continuity | NONE | 번들 Rationale 은 무관한 제품 도메인 결정들이며 target 은 이를 재도입·번복·우회하지 않음. target 자신의 "기각한 대안" 서술도 실측 근거를 갖춰 기존 관행과 합치 |
| convention_compliance | NONE | API/DTO/출력포맷 등 대부분 규약이 적용 대상 밖. 유일하게 교차하는 review-citations.md 인용 규약도 plan/** 예외로 위반 아님 |
| plan_coherence | LOW | 트래커 대비 처방 선택은 정합적이나, 같은 테스트 클래스의 미해결 후속 항목(순위→생존 캐너리) 교차 참조 누락(WARNING) + 안전장치 재사용 여부 미명시(INFO) |
| naming_collision | LOW | 신규 식별자는 `make_probe_repo` 하나뿐, 실질 충돌 없음. 다만 기존 `make_temp_git_repo` 와 이름·역할 근접(WARNING), "probe" 단어 중의성(INFO) |

## 권장 조치사항
1. (구현 단계) `make_probe_repo` 가 `git_in`/`make_temp_git_repo` 를 내부적으로 재사용하도록 구현하고, docstring 에 두 헬퍼의 관계(상위집합)를 한 줄 명시한다.
2. target §C 또는 §E 체크리스트에 `harness-review-gate-followups.md` 의 미해결 "순위→생존 전환 캐너리" 항목을 상호 참조로 추가하고, 새 캐너리 배치 위치(같은 클래스 vs 별도 클래스)를 명시한다.
3. (선택) `make_probe_repo` docstring 첫 줄에 `_shared/git_probe.py` 와 무관함을 명시해 "probe" 단어 혼동을 예방한다.
4. (선택) 구현이 §13 "pre-existing 4곳" 중 `test_consistency_bundle_priority.py` 를 우연히 해소하면 `harness-review-gate-followups.md` 쪽 잔여 목록도 함께 갱신한다.

Critical 없음 — BLOCK 해소 대상 없음. 위 1~2번은 병합을 막지 않는 품질 개선 권고다.
