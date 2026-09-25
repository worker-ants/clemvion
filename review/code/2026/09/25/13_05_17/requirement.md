# 요구사항(Requirement) 리뷰 — changelog-criteria

## 발견사항

- **[WARNING]** CHANGELOG.md 상단 기준 블록이 "성문화" 출처로 `plan/complete/changelog-criteria.md` 를 가리키지만, 실제 파일은 아직 `plan/in-progress/changelog-criteria.md` 에 있고(`status: in-progress`) 그 plan 의 `## C. 검증` 체크리스트에 미완료 항목이 둘 남아 있다(`- [ ] /ai-review`, `- [ ] 트래커 항목 닫기 + 재판정 후보 등재`).
  - 위치: `CHANGELOG.md:3`(신규 라인, diff 게이트 상 `3`) — 본문 "2026-09-25 성문화(`plan/complete/changelog-criteria.md`)". 대응 plan 파일은 `plan/in-progress/changelog-criteria.md:1-8`(frontmatter) 및 `:89-90`(미체크 항목).
  - 상세: `git log -S`/`ls` 로 확인한 결과 `plan/complete/changelog-criteria.md` 는 아직 존재하지 않는다. 같은 CHANGELOG.md 안의 다른 항목들은 이 관례를 정확히 지킨다 — 아직 끝나지 않은 plan 은 `plan/in-progress/...`(예: `:1096`, `:1372`, `:2098`, `:2157`, `:2208`, `:3159`, `:3176`)를, 실제로 완료·이동된 plan 만 `plan/complete/...`(`:671` → `plan/complete/spec-draft-rotate-conflict.md`, `:3105` → `plan/complete/auth-workspace-membership-guard.md`, 둘 다 실재 확인)를 가리킨다. 이번 신규 항목만 아직 일어나지 않은 이동을 기정사실처럼 적어 그 관례를 깬다. CLAUDE.md 의 plan 라이프사이클 규칙("체크와 `complete/` 이동은 한 동작")대로라면 이 문장은 plan 이 실제로 `plan/complete/` 로 옮겨진 커밋에서만 참이 된다 — 지금 시점엔 검증되지 않은 forward reference 다. 이 리뷰(`/ai-review`) 뒤 tracker 항목 닫기까지 같은 세션에서 이어지면 자연히 참이 되지만, 이 PR 이 그 상태로 머지되면 CHANGELOG 의 역사적 기록이 깨진 링크를 영구히 담게 된다.
  - 제안: (a) 이 문구를 실제 위치(`plan/in-progress/changelog-criteria.md`)로 바꾸거나, (b) 이번 세션에서 plan 을 실제로 `plan/complete/` 로 옮기는 마무리 커밋까지 완료한 뒤 CHANGELOG 문구와 실제 위치를 함께 확정한다. 둘 중 하나 없이 병합하면 안 된다.

- **[INFO]** `review/consistency/2026/09/25/12_52_34/_retry_state.json` 이 5개 checker 모두 성공해 `SUMMARY.md`·개별 리포트가 실재함에도 `"agents_pending"` 에 5개 전부, `"agents_success": []` 로 커밋돼 있다.
  - 위치: `review/consistency/2026/09/25/12_52_34/_retry_state.json` (파일 끝 `agents_pending`/`agents_success` 필드).
  - 상세: 이 세션은 fallback 평문 fan-out 경로로 수행된 것으로 보이며, 그 경로는 `_retry_state.json` 을 사후 갱신하지 않아 디스크에 남은 상태가 최초 dispatch 시점 스냅샷 그대로다. `--resume` 이 이 파일을 신뢰해 재실행을 시도하면 이미 끝난 5개 checker 를 다시 부르려 들 수 있다(`feedback_workflow_disk_write_gap_false_counts.md` 급의 상태-불일치 클래스). 이 PR 자체의 기능(CHANGELOG 기준·리뷰어 문구)과는 무관한 부수 아티팩트라 CRITICAL 로 보지는 않는다.
  - 제안: 커밋 전 `_retry_state.json` 을 실제 완료 상태로 갱신하거나, fallback 경로 산출물은 애초에 `_retry_state.json` 을 쓰지 않도록 스킬 문서에 명시.

## 검증 근거 (문제 없음으로 확인된 항목)

- `documentation-reviewer.md:21` 과 `role_instructions.py:141` 의 관점 6 문구는 byte 단위로 동일 — 사전 consistency 검토 WARNING #2(“두 곳 중 한 곳만 갱신”)가 실제로 해소됐다(양쪽 diff 모두 확인).
- `test_agent_consistency.py` 는 설계상 checklist 문구를 가드하지 않는다(레지스트리 수준만 검사) — plan 이 "문구를 고정하는 테스트는 없다" 고 적은 진술과 코드가 일치.
- CHANGELOG 백필 표의 V110~V130(21개 마이그레이션), PR 번호(`#1285`·`#1349`~`#1352`), 각 실측 수치(예: "스케줄 목록 5.99 → 0.30 ms", "캔버스 노드 삭제 29 → 0.15 ms")를 `git log --oneline` 커밋 제목과 대조해 모두 일치함을 확인. `V110__schedule_workspace_next_run_index.conf`/`.sql` 도 `executeInTransaction=false` + `DROP INDEX CONCURRENTLY IF EXISTS` 선행을 실제로 포함.
- CHANGELOG.md 전체에서 `## Unreleased` 아닌 헤딩이 0건(153/153) — A-1 이 지적한 유일한 이탈(`## 부수 — …`)이 실제로 고쳐졌다.
- `spec_impact: none` (bare) 프론트매터 형식이 컨벤션(list 또는 bare `none`)을 지킨다.
- 이 변경 영역(`CHANGELOG.md` 상단 기준, 리뷰어 checklist 문구)은 `spec/**` 로 정의된 제품 명세가 아니라 저장소 운영 규칙이라 spec fidelity 점검(관점 9)은 해당 없음 — CLAUDE.md §정보 저장 위치와의 위치 불일치는 이미 사전 consistency 검토(WARNING #1)가 지적했고, plan 본문이 그 사유(판정 시점에 기준이 있어야 함)를 명시적으로 남겨 해소했다.

## 요약

이 PR 의 핵심 기능(“CHANGELOG 판정 기준을 성문화하고 documentation 리뷰어 두 사본을 동기화하며 미기록 인덱스 마이그레이션 21개를 백필한다”)은 실측(git log, migration 파일, .conf 설정)과 대조해 정확하고 완전하다 — 수치·PR 번호·헤딩 형식 정정 전부 코드/이력과 일치하며, 사전 consistency 검토가 낸 WARNING 2건도 diff 안에서 실제로 해소됐다. 다만 CHANGELOG 신규 항목이 자신의 근거 plan 을 `plan/complete/`(아직 도달하지 않은 상태)로 인용하는 하나의 사실 오류가 있다 — 같은 파일의 다른 항목들이 지키는 "실제 위치 인용" 관례를 깨는 forward reference 로, 이번 세션이 예정대로 plan 을 완료·이동시키지 않은 채 병합되면 영구적으로 깨진 참조가 된다. 부가적으로 커밋된 consistency 세션의 `_retry_state.json` 이 실제 완료 상태를 반영하지 못해 향후 `--resume` 오작동 소지가 있다(INFO).

## 위험도

LOW
