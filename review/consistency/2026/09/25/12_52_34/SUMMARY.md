# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — spec 표면 접촉 없음(cross-spec/rationale/plan-coherence 모두 NONE). CHANGELOG 기준 신설 위치가 CLAUDE.md 저장 원칙과 어긋날 수 있는 점, 그리고 리뷰어 checklist 문구가 두 파일에 미동기화 사본으로 존재하는 점, 두 건이 WARNING.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | "정식 규약"(CHANGELOG 판정 기준)을 `spec/conventions/` 가 아니라 `CHANGELOG.md` 본문에 직접 신설하려는 처방 | `## B. 처방` 표 1행 (CHANGELOG.md 상단 기준 블록) | CLAUDE.md §정보 저장 위치(단일 진실 원칙) — "정식 규약 → `spec/conventions/<name>.md`" | (a) 기준 본문을 `spec/conventions/changelog-criteria.md` 로 신설하고 `CHANGELOG.md` 엔 pointer 만 남기거나, (b) `CHANGELOG.md` 를 SoT 로 유지하기로 한 이유를 plan `## Rationale`/본문에 한 줄 명시해 CLAUDE.md 표와의 불일치가 의도임을 드러낸다 |
| 2 | naming_collision | `documentation` 리뷰어 "관점 6" 문구가 `.claude/agents/documentation-reviewer.md` 와 `.claude/skills/code-review-agents/lib/role_instructions.py:141` 두 곳에 byte 단위 동일 사본으로 존재하는데, target 은 전자만 갱신 대상으로 표에 올리고 "저장소 안 유일한 기준 언급" 이라고 전제 — 이 전제가 grep 실측과 어긋남 | `## B. 처방` 표 4행 | `role_instructions.py:136-143` `documentation.checklist` 항목 6 (미동기화 사본 — orchestrator 가 생성하는 프롬프트 본문에 reinforcement 목적으로 병행 주입됨) | `role_instructions.py` 의 해당 checklist 항목 6도 같은 턴에 동반 갱신 대상으로 B절 표에 추가하거나, 최소한 "유일한 기준 언급" 문구를 "system-prompt 와 orchestrator checklist 두 곳에 동일 사본이 있다"로 정정. `role_instructions.py` 는 harness 코드/도구 축(developer 소유)이라 같은 PR 에서 처리 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 마이그레이션 백필 대상(V110~V130)이 `spec/1-data-model.md` `## Rationale` 이 실제로 구현했다고 밝힌 V-번호 범위(V117~V120, V121~V130)와 정합 — 재도입·번복 아님 | `CHANGELOG.md` 백필 행 | 조치 불필요. PR 번호(`#1285`·`#1349`~`#1352`)와 V-번호가 어긋나지 않는지는 구현 단계에서 실측 확인 |
| 2 | rationale_continuity | "가드를 느슨하게 하는 변경도 CHANGELOG 항목" 원칙이 `spec/1-data-model.md` 의 "가드 약화 감지"(`--impl-done` 대조) 원칙과 방향이 같은 보강 관계 | `## B. 처방` "가드 · 제품 경계의 정의" | 조치 불필요. 향후 `spec/conventions/` 정식화 시 두 장치를 상호 참조해 두면 다음 사람이 관계를 재추론할 필요가 없음 |
| 3 | convention_compliance | 신설 기준 블록에 heading 표기 규칙(`## Unreleased — <요약>`, 접두 필수)이 성문화되지 않음 — A-1 이 실측한 유일한 이탈 사례(`## 부수 — …`)를 개별 수정만 하고 일반 규칙으로는 편입 안 함 | `## B. 처방` 표 1행(기준 블록 내용) | 기준 블록에 heading 표기 형식 한 줄을 함께 명문화해 재발 방지 규칙으로 편입 |
| 4 | convention_compliance / plan_coherence (중복 통합) | `.claude/agents/**` 편집 권한 축이 CLAUDE.md harness 두 축 표(코드·도구=developer / 거버넌스 문서=planner)에 명시돼 있지 않음 — target 은 선례(`#991`, 실측 확인됨)만으로 developer 소유를 정당화 | `## B. 처방` 표 4행 | target 을 막을 사유는 아님. CLAUDE.md harness 표에 `.claude/agents/**` 를 developer 축(harness 실행물)으로 명시 편입할지는 별도 planner 턴에서 검토 |
| 5 | plan_coherence | 재판정 후보 10건(`#1364`·`#1354`·`#1358`·`#1206`·`#1261`·`#1262`·`#1263`·`#1245`·`#1238`·`#1270`)의 신규 등재가 원 트래커 항목(`spec-draft-nullable-notation-followups.md:5159`) 체크와 같은 커밋에서 이뤄지지 않으면 이력이 in-progress 문서에만 남아 `complete/` 이동 시 소실될 수 있음 | `## B. 처방` 하단 / `## C. 검증` 체크리스트 | 구현 커밋에서 (a) 5159행 체크, (b) 10건 신규 등재를 같은 turn 에 수행 — target `## C` 항목이 이미 이렇게 지시하므로 실행 시 누락 없는지만 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target 은 `spec/**` 를 전혀 건드리지 않음(`spec_impact: none`, 처방 대상은 `CHANGELOG.md`·`.claude/agents/**`) — 6개 점검 관점 모두 접촉점 없음 |
| rationale_continuity | NONE | 확인 가능했던 5개 spec Rationale 과 상충 없음(V-번호 백필·가드 개념 모두 보강 관계). 78개 파일은 예산 절단으로 미검토(한계) |
| convention_compliance | LOW | "정식 규약" 신설 위치가 CLAUDE.md 저장 원칙과 어긋날 수 있음(WARNING), heading 명명 규칙 누락·harness 권한 표 공백(INFO) |
| plan_coherence | NONE | 다른 in-progress plan 39개(그중 CHANGELOG 언급 12개) 대조 결과 충돌·미해결 선행 조건 없음. `.claude/agents/**` 권한 축·재판정 후보 등재 시점만 INFO |
| naming_collision | LOW | 리뷰어 "관점 6" 문구가 `.claude/agents/documentation-reviewer.md` 와 `role_instructions.py` 두 곳에 미동기화 사본으로 존재 — target 의 "유일한 기준 언급" 전제가 실측과 불일치(WARNING) |

## 권장 조치사항
1. `role_instructions.py:136-143` `documentation.checklist` 항목 6을 B절 처방 표에 동반 갱신 대상으로 추가 — 안 하면 다음 documentation 리뷰 세션에서 두 사본이 어긋난 채 동시 주입된다 (WARNING #2 해소).
2. CHANGELOG 기준 블록을 `CHANGELOG.md` 에 직접 두기로 한 이유(spec/conventions/ 대신)를 plan Rationale/본문에 한 줄 명시 — CLAUDE.md 저장 원칙과의 불일치가 의도임을 드러낸다 (WARNING #1 해소).
3. 기준 블록에 heading 표기 형식(`## Unreleased — <요약>`, 접두 필수)을 명문화해 A-1 이탈 사례를 재발 방지 규칙으로 편입 (INFO #3).
4. 구현 커밋에서 재판정 후보 10건 신규 등재와 원 트래커 5159행 체크를 같은 turn 에 수행 (INFO #5).
5. (선택, 별도 planner 턴) CLAUDE.md harness 두 축 표에 `.claude/agents/**` 를 developer 축으로 명시 편입할지 검토 (INFO #4).
