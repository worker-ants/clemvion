# 문서화(Documentation) 리뷰 — CHANGELOG 판정 기준 성문화

## 발견사항

- **[WARNING]** CHANGELOG 상단이 아직 존재하지 않는 `plan/complete/changelog-criteria.md` 경로를 참조한다
  - 위치: `CHANGELOG.md:3`
  - 상세: 새로 추가된 기준 블록 첫 줄이 "2026-09-25 성문화(`plan/complete/changelog-criteria.md`)" 라고 적는다. 그러나 이번 diff 로 실제 추가되는 파일은 `plan/in-progress/changelog-criteria.md` 이고(파일 4), 저장소에는 아직 `plan/complete/changelog-criteria.md` 가 존재하지 않는다(직접 확인: `plan/complete/changelog-criteria.md` — No such file or directory). 해당 plan 파일의 `## C. 검증` 체크리스트(`plan/in-progress/changelog-criteria.md:89-90`)에도 `/ai-review` 와 "트래커 항목 닫기 + 재판정 후보 등재" 두 항목이 아직 `[ ]` 미완이고, **"plan 을 `plan/complete/` 로 이동"을 명시하는 체크리스트 항목 자체가 없다.** 이 저장소의 다른 CHANGELOG 항목들(예: `CHANGELOG.md:671`, `:3105`)은 실제로 plan 이 `plan/complete/` 로 옮겨진 뒤에 그 경로를 인용하는 패턴을 따르므로, 이번 항목도 같은 관례를 따르려는 의도로 보인다. 다만 "체크박스 완료 + `complete/` 이동" 은 한 커밋에서 함께 일어나야 하는 동작인데 그 이동이 체크리스트에 명시돼 있지 않아, 종결 커밋에서 누락되면 이 CHANGELOG 링크가 존재하지 않는 경로를 영구적으로 가리키게 된다.
  - 제안: (a) `plan/in-progress/changelog-criteria.md` 의 `## C. 검증`에 "plan 을 `plan/complete/` 로 이동" 항목을 명시적으로 추가하고, (b) 이 PR 을 병합하기 전 실제로 `plan/complete/changelog-criteria.md` 로 이동이 이뤄졌는지 확인한다. 이동이 이번 PR 범위 밖이라면 CHANGELOG 문구를 이동 시점까지 `plan/in-progress/changelog-criteria.md` 로 두거나 "추후 `plan/complete/`" 같은 표현으로 낮추는 것도 대안이다.

- **[INFO]** `documentation` 리뷰어 관점 6 문구는 두 SoT 파일(`.claude/agents/documentation-reviewer.md`, `.claude/skills/code-review-agents/lib/role_instructions.py`)에서 byte 단위로 동기화됨 — 확인 완료, 조치 불필요
  - 위치: `.claude/agents/documentation-reviewer.md`(diff 21행) / `.claude/skills/code-review-agents/lib/role_instructions.py`(diff 141행)
  - 상세: `plan/in-progress/changelog-criteria.md` 의 `## B. 처방` 표 4행 원문에는 취소선 처리된 옛 주장("~~지금 이 문장이 저장소 안의 유일한 기준 언급이다~~")이 남아 있고, 그 옆에 사전 consistency-check(`--plan`, `review/consistency/2026/09/25/12_52_34` naming_collision WARNING)가 반증한 사실이 함께 적혀 있다. 실제 diff 를 대조한 결과 두 파일의 관점 6 문구는 현재 완전히 동일한 텍스트로 갱신돼 있어, 그 WARNING 은 이번 코드 변경으로 이미 해소됐다. 문구를 고정하는 자동 가드(`test_agent_consistency.py`)는 없다는 점이 plan 본문에 이미 명시돼 있고, 그 갭은 developer 가 의도적으로 이번 PR 범위 밖으로 남긴 것이라 재지적하지 않는다.

- **[INFO]** CHANGELOG 백필 항목의 사실관계(마이그레이션 번호·PR 번호·`.conf` 트랜잭션 설정)를 직접 확인 — 일치
  - 위치: `CHANGELOG.md:24-39`(신규 백필 섹션), 대조 대상 `codebase/backend/migrations/V110~V130*.conf`
  - 상세: V110~V130 21개 `.conf` 파일 전부에 `executeInTransaction=false` 가 존재함을 확인했고(`grep -L` 0건), CHANGELOG 표가 인용하는 PR 번호 중 `#1285`(V110)는 `git log --diff-filter=A -- codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` 결과와 정확히 일치한다(`7eb9815ee perf(db): ... (#1285)`). 문서화된 배포 안내("CONCURRENTLY", "실패 시 DROP INDEX CONCURRENTLY IF EXISTS 선행")도 plan 파일(`plan/in-progress/changelog-criteria.md` `## C` 세 번째 체크 항목)이 이미 실측했다고 밝힌 내용과 부합한다. 문서 정확성 관점에서 결함 없음.

- **[INFO]** 이번 PR 자체는 새 기준의 "항목을 내지 않는다" 조건에 정합
  - 위치: `plan/in-progress/changelog-criteria.md`("이 PR 자신은 항목을 내지 않는다" 문단)
  - 상세: 이 PR 이 바꾸는 것은 리뷰어 프롬프트 문구와 CHANGELOG 상단 기준·백필 항목뿐이며, CHANGELOG.md 자체의 편집(기준 신설 + 과거 배포 이력 백필)은 신설 기준이 스스로 규정하는 예외("문서·spec·plan·리뷰 산출물만의 변경 — 항목 없음"이되, 이 편집은 문서가 아니라 §2(배포에 닿는다)에 해당하는 과거 사실의 사후 기록) 범주로 자기충족적이다. 이 편집이 새 `## Unreleased` 항목으로 또 등재돼야 하는지 여부에 대한 모순은 없다.

## 요약

이번 변경은 "CHANGELOG 에 무엇이 항목이 되는지"를 성문화하는 문서 전용 작업으로, 두 리뷰어 SoT 파일(`documentation-reviewer.md`/`role_instructions.py`)의 관점 6 문구를 byte 단위로 동기화하고, CHANGELOG 상단에 기준·예외·불완전성 고지를 추가하고, 실제로 빠져 있던 V110~V130 인덱스 마이그레이션 21건을 사실관계까지 검증된 상태로 백필했다. 사전 consistency-check 가 지적한 두 WARNING(정식 규약 저장 위치·리뷰어 문구 미동기화)은 각각 plan 본문의 Rationale 설명과 실제 두 파일 동기화로 해소됐다. 유일하게 남는 문서 정확성 문제는 CHANGELOG 가 아직 `plan/in-progress/` 에 있는 파일을 `plan/complete/` 경로로 미리 인용하면서, 그 이동을 보장하는 체크리스트 항목이 plan 자체에 없다는 점이다 — 종결 커밋에서 이동이 누락되면 깨진 참조가 영구히 남는다.

## 위험도
LOW
