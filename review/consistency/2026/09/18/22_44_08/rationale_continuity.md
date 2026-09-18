# Rationale 연속성 검토 — FK 인덱스 서른한 개 처분 (spec/conventions/ impl-prep)

## 검토 범위 요약

target 은 `spec/conventions/` 전 디렉토리(대부분 예산 절단으로 헤더만 남음, 완전 포함은
`migrations.md`·`audit-actions.md`·cafe24-api-catalog 일부)이고, "관련 Rationale 발췌"로
`spec/1-data-model.md`·`spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,10-triggers,
11-workflow,12-workspace}.md` 의 `## Rationale` 전문이 함께 실려 있다. 실질적으로 검토
대상이 되는 신규 결정은 방금 커밋된(`4dfc5787b`) `spec/1-data-model.md` Rationale 신규 절
**"쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)"**과 그 근거 트래커
`plan/in-progress/spec-draft-fk-remaining-dispositions.md` (V121~V130 예정, 아직 미구현 —
`codebase/backend/migrations/`에 V120까지만 존재함을 확인) 이다. `spec/conventions/` 자체에는
이번 diff 가 없다.

## 발견사항

- **[INFO]** 신규 처분 기준이 이전 절의 "ms 단일 문턱" 방식을 대체하면서 교차 정정을 명시적으로 수행함 — 위반 아님, 모범 사례로 기록
  - target 위치: `spec/1-data-model.md` `## Rationale` "쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)" 절, "처분 기준" 문단
  - 과거 결정 출처: 같은 문서 `## Rationale` "삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)" 절 — "그중 선두 인덱스가 없는 `alert_rule.workflow_id` · `edge.target_node_id` 는 작은 테이블이라 넣지 않았다"
  - 상세: 신규 절은 "호출당 ms 문턱 하나로 자르면 규모가 바뀔 때마다 결론이 바뀐다"며 앞 절의 기준을 사실상 폐기하고 "자식 테이블 크기 × 연쇄로 지워지는 부모 행 수 곱의 어느 쪽이 사용자 데이터로 자라는가"로 교체했다. `edge.target_node_id` 는 그 결과 비대상 → V121 대상으로 뒤집혔다. 이는 규칙 3(무근거 번복 금지)이 요구하는 "번복 시 새 Rationale 동반"을 충족한다 — 플랜(`plan/in-progress/spec-draft-fk-remaining-dispositions.md`) S3 절이 "앞 절 정정 네 곳(무근거 번복이 되지 않도록 명시)"라는 제목 아래 이 정정문을 원문 절 옆에 삽입하도록 명시했고, 실제 커밋된 `spec/1-data-model.md` 본문에서도 "그 측정의 엣지는 약 1만 행이었다" 라는 정정 각주가 원문 옆에 살아있다(취소선은 아니지만 원문을 보존하며 조건을 한정하는 방식).
  - 제안: 조치 불요. 다만 사소한 개선으로, 정정 각주가 취소선(`~~~~`) 없이 원문 문장 뒤에 이어 붙는 형식이라 "폐기·정정된 과거 서술 (이력)" 절(`spec/data-flow/6-knowledge-base.md`)이 쓰는 취소선 스타일과 다르다 — 문서 내 정정 표기 스타일을 통일하고 싶다면 향후 편집에서 고려.

- **[INFO]** `plan/complete/spec-draft-fk-remaining-dispositions.md` 로의 순방향 인용 — 아직 `plan/in-progress/`
  - target 위치: `spec/1-data-model.md` `## Rationale` 신규 절 말미 "> 출처: … 실측 절차와 31개 처분 표는 `plan/complete/spec-draft-fk-remaining-dispositions.md`, 구현은 V121~V130."
  - 과거 결정 출처: 해당 없음(Rationale 위반이 아니라 lifecycle 시점 문제) — 참고로 같은 문서의 선행 절들(예: "삭제 연쇄의 FK 인덱스 다섯")은 구현(V112~V116)이 이미 merge 된 뒤에 같은 형식으로 `plan/complete/...`를 인용하고 있어, 이 저장소의 정상 패턴은 "구현 완료 후 plan 이동 + 인용"이다.
  - 상세: 이번 커밋 시점에는 V121~V130 이 아직 코드베이스에 없고(`ls codebase/backend/migrations` 확인, V120까지만 존재) `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 의 frontmatter 도 `status: in-progress` 다. 즉 Rationale 문장이 가리키는 `plan/complete/...` 경로는 이 스펙 커밋 시점에는 아직 존재하지 않는 상태를 전제한다. 이는 --impl-prep 워크플로(planner 가 spec 을 먼저 확정하고 developer 가 뒤이어 구현 후 plan 을 이동)에서 통상적으로 나타나는 선행 인용이라 결함으로 보지 않으나, developer 가 V121~V130 을 구현하고 plan 을 `plan/complete/`로 옮기는 마무리 커밋을 빠뜨리면 이 인용이 영구히 깨진 링크로 남는다.
  - 제안: `--impl-done` 검토(구현 완료 후) 시 이 인용 경로가 실제로 존재하는지, 그리고 plan 이동이 수행됐는지 확인 항목으로 남길 것.

- **[INFO]** migrations.md 의 CONCURRENTLY DROP-선행 불변식 — 이번 target 문서에는 재확인 문구 없음(선례로 충분)
  - target 위치: 신규 절 전체(및 트래커 plan) — V121~V130 의 실제 SQL 내용은 아직 작성 전이라 이 문서들에 명시 안 됨
  - 과거 결정 출처: `spec/conventions/migrations.md` §5 각주 — "`CREATE` 앞에 invalid 잔재 정리(`DROP INDEX CONCURRENTLY IF EXISTS <새 인덱스 이름>`)를 둔다 … 그것만으로는 실패 후 재실행이 교체에서는 쓸 수 있는 인덱스를 0개로 만들고(V056) 신규 추가에서는 invalid 인덱스를 영영 유효하지 않게 남긴다(V106)."
  - 상세: 규칙 4(암묵적 가정 충돌) 관점에서, 이 convention 은 이번 처분에 직접 걸리는 불변식이다(V121~V130 전부가 `CREATE INDEX CONCURRENTLY`). 위반은 아직 일어나지 않았고(파일 미작성), 직전 선례인 V111~V120(`codebase/backend/migrations/V112__node_execution_node_id_index.sql` 확인)이 이 패턴(`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, `.conf` 로 `executeInTransaction=false`)을 정확히 따르고 있어 선례 신뢰도가 높다. 다만 target 문서(spec 신규 절·plan)는 이 불변식을 다시 언급하지 않으므로, 검토자가 이 절만 보고 구현에 들어가면 별도로 `migrations.md`/README.md §5 를 참조해야 한다는 점만 남긴다.
  - 제안: 조치 불요(선례가 강함) — 다만 developer 가 V121~V130 을 실제로 작성할 때 `--impl-done` 게이트에서 각 파일이 이 패턴을 지키는지(10개 전부) 기계적으로 대조할 것을 권고.

## 요약

이번 target(스펙 신규 Rationale 절 + 그 근거 트래커)은 Rationale 연속성 관점에서 결함이 아니라 오히려 모범적으로 운용되고 있다 — (1) 기각된 대안 재도입 없음(부분 인덱스 nullable 규약·predicate-선두 인덱스 원칙 등 기존 합의를 그대로 따름), (2) 원칙 위반 없음(측정 우선 결정 관행을 그대로 유지, "user 삭제 경로 없음" 전제도 코드 grep 으로 재확인됨 — 여전히 참), (3) 결정 번복 시 반드시 새 Rationale 을 동반함(플랜 S3 절이 "앞 절 정정 네 곳"을 명시적으로 나열하고 실제 커밋에 반영됨), (4) 시스템 invariant 우회 없음. 유일하게 주목할 점은 `plan/complete/...`로의 순방향 인용과 `migrations.md` CONCURRENTLY 불변식이 이번 커밋 시점엔 아직 실현되지 않은 미래 상태를 가리킨다는 것인데, 둘 다 --impl-prep → 구현 → --impl-done 흐름에서 통상적으로 해소되는 것들이라 지금 시점의 결함은 아니며 후속 게이트에서 확인할 체크리스트로 남긴다.

## 위험도

LOW
