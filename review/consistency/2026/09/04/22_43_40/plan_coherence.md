# Plan 정합성 검토 — `spec/1-data-model.md` §3 · `spec/data-flow/10-triggers.md` §2.1 (schedule 인덱스)

## 범위 확정

프롬프트의 target 은 `spec/` 전체로 명시됐으나, `origin/main..HEAD` 실측 결과 이 워크트리가 `spec/`
에 낸 변경은 정확히 커밋 `6143b8c9f` 하나이고 그 안에서 건드린 파일도 `spec/1-data-model.md`
(§3 인덱스 전략 표 Schedule 행) 와 `spec/data-flow/10-triggers.md`(§2.1 Schema 매핑 표 Schedule
행) 둘뿐이다(`git diff --stat origin/main..HEAD -- spec/` → `2 files changed, 3 insertions(+),
2 deletions(-)`). 실질 검토는 이 두 파일 변경 대 `plan/in-progress/spec-draft-schedule-index.md`
· `plan/in-progress/spec-draft-nullable-notation-followups.md` 두 plan 문서로 좁혀 수행했다 —
`plan/in-progress/` 전체에서 `next_run_at`/`idx_schedule` 를 언급하는 파일은 이 둘뿐임을
`grep -rl` 로 전수 확인했다(생략된 61개 plan 파일 중 겹치는 것 없음).

## 발견사항

없음.

이전 라운드(`review/consistency/2026/09/04/22_34_55/plan_coherence.md`)가 낸 WARNING —
"`spec-draft-schedule-index.md` 가 (c) 로 결론을 냈는데 출처 plan
(`spec-draft-nullable-notation-followups.md`) 의 해당 항목·종결 조건 표가 그 결론을
반영하지 못한 채 미체크로 남아 두 in-progress 문서가 같은 인덱스에 대해 서로 다른 상태를
주장한다" — 는 이번 커밋(`6143b8c9f`, 커밋 메시지 자체가 "`--spec` 22_34_55 BLOCK:NO ·
WARNING 2 전부 반영" 이라고 명시)에서 해소됐다. 실측:

- `plan/in-progress/spec-draft-nullable-notation-followups.md:379-392` 의 해당 항목이
  "`idx_schedule_next_run` — 실측 완료, 답은 (c). V110 적용만 남았다" 로 갱신되고
  `spec-draft-schedule-index.md` 를 링크한다.
- 같은 파일 `:430` 종결 조건 표의 행도 트랙을 `developer/DBA` → `developer`, 선행 조건을
  "EXPLAIN·테이블 크기" → "V110 마이그레이션 적용" 으로 정정했다(이전 WARNING 의 제안과 일치).

추가 확인한 것 — 새 결함 없음:

- 대체된 두 spec 자리(`1-data-model.md:914` · `data-flow/10-triggers.md:175`) 모두 갱신됐고,
  구 인덱스 정의(`(next_run_at, is_active)`)에 대한 stale 참조가 `data-flow/10-triggers.md`
  전체에 더 없다(`grep -n "next_run_at|is_active"` 로 그 파일 전수 확인 — §3.2 서술도
  일관됨).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 어디에도 `V110` 을 다른 의미로
  선점한 곳이 없고, 실물 migrations 디렉터리의 최신 번호는 `V109` 라 `V110` 번호 충돌은 없다.
- 새로 추가된 `Schedule | (trigger_id) | ... V106` 행은 실물 `V106__schedule_trigger_id_index.sql`
  의 DDL·주석과 정확히 일치한다 — 이미 구현된 인덱스를 spec 표에 뒤늦게 채워 넣은 것이라
  developer 후속 조건이 없다.
- `Schedule | (workspace_id, next_run_at) | ... CONCURRENTLY, V110` 행은 아직 존재하지 않는
  마이그레이션(`V110`)을 가리킨다 — 그러나 이는 plan 이 스스로 "구현(V110)은 같은 PR 의
  developer 단계에서 이어서 수행한다" 고 명시한 설계이자, 후속 체크리스트
  (`spec-draft-nullable-notation-followups.md:430`)에도 "잔여는 V110 마이그레이션 적용뿐" 로
  이미 등재돼 있다. `--impl-prep` 게이트가 통상 developer 착수 직전에 도는 지점과도 부합해
  누락이 아니라 정상 시퀀싱으로 판단했다 — WARNING 으로 올리지 않는다.

## 요약

이번 세션이 `spec/` 에 낸 유일한 변경(schedule 인덱스 전략 교체, 커밋 `6143b8c9f`)은 그
전제였던 `spec-draft-nullable-notation-followups.md` 의 열린 항목을 충족하며 나왔고, 직전
라운드가 지적한 두 in-progress 문서 간 상태 불일치(WARNING)도 같은 커밋에서 해소됐다.
`plan/in-progress/` 전체에서 이 인덱스를 언급하는 문서는 두 개뿐이며 둘 다 (c) 결론으로
동기화돼 있고, 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 할 파급도 발견하지
못했다. 남은 유일한 미완료 조각(V110 마이그레이션 실제 적용)은 plan 이 스스로 "같은 PR 의
developer 단계" 로 명시해 둔 정상적인 다음 단계이지 정합성 결함이 아니다.

## 위험도
NONE
