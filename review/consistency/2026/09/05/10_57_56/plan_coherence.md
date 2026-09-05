# Plan 정합성 검토 — `spec/conventions/` (--impl-done)

## 발견사항

- **[WARNING]** README 의 새 서술이 in-progress plan 의 미해결 "V110 헤더" 항목을 사실상 답했는데 plan 이 갱신되지 않았다
  - target 위치: `codebase/backend/migrations/README.md` §5 신설 절 "인덱스 교체는 DROP-먼저" 표 — *"CREATE 성공 후 2) DROP(old) 이 실패 → 마이그레이션 전체가 실패로 기록 → `repair` + 재실행 | **발생** | ... — **"정상 흐름 밖" 이 아닙니다**"*. 같은 절이 "선례: `V110__schedule_workspace_next_run_index.sql`" 로 그 파일을 명시 지목한다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 "**`V110` 헤더의 '정상 흐름에서는 발생하지 않는다' 서술**" (2026-09-05 등재, 아직 `[ ]` 미체크) — (a) 그대로 둔다 vs (b) README/migrations.md 에 "V110 헤더 문장은 이후 정정됐다" 한 줄을 남긴다, 둘 중 결정 필요라고 명시.
  - 상세: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` 자신의 헤더 주석은 여전히 *"Flyway 는 성공한 마이그레이션을 다시 돌리지 않으므로 **정상 흐름에서는 발생하지 않고**"* 라고 적고 있다(append-only 라 미수정, 확인됨). 그런데 이번에 새로 쓴 README §5 는 바로 그 시나리오(CREATE 성공 후 DROP(old) 실패 → `repair`+재실행 → 재빌드)를 **"정상 절차 안에 있다"** 고 명시적으로 반박한다 — 이는 `plan/complete/spec-draft-migration-rerun-and-citations.md` §1.4 가 이미 `review/code/2026/09/05/10_20_57` W1 을 반영해 결정한 내용과 같다. 즉 완료된 planner 세션이 이 사실관계를 이미 확정했고 그 내용이 README 에 실렸는데, **자매 in-progress plan(`spec-draft-nullable-notation-followups.md`)의 해당 체크박스는 이 사실을 모른 채 여전히 "결정 미정"으로 남아 있다.** README 를 그대로 신뢰하고 V110 헤더를 함께 읽는 사람은 같은 사실에 대해 서로 다른 두 문장을 만나게 된다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 해당 항목을 닫거나(예: "README §5 신설로 사실상 (b) 방향으로 답이 실렸다 — V110 헤더 자체는 append-only 라 미수정, 규약 SoT 는 README" 로 정리) 최소한 옵션 (b)를 formal 하게 집행해 migrations.md/README 에 "V110 헤더의 그 문장은 이후 정정됐다" 한 줄을 명시적으로 추가한다. 둘 중 하나를 택해 plan 체크박스와 실제 문서 상태를 다시 맞출 것.

## 요약

이번 `spec/conventions/` 변경(migrations.md 포인터 추가, `codebase/backend/migrations/README.md` "인덱스 교체는 DROP-먼저" 절 신설, `review-citations.md` 신설, `spec-impl-evidence.md` §2.1 예외 조항)은 `plan/complete/spec-draft-migration-rerun-and-citations.md` 가 이미 실측·기각 근거를 정리해 둔 결정을 그대로 옮긴 것으로, 그 출처 plan 및 자매 in-progress plan(`spec-draft-nullable-notation-followups.md`)의 다른 열린 항목들(`mixed=true` 도입 여부, bare 인용 8건 해소)과는 충돌 없이 "결정 보류" 상태를 그대로 존중하고 있다. 다만 한 가지 — README 에 새로 실린 "CREATE 성공 후 DROP(old) 실패 경로는 정상 절차 안"이라는 서술이, 같은 세션이 별도로 열어 둔 "V110 헤더 문장 정정 여부" 결정 항목을 사실상 선점해 답해 버렸는데 그 plan 체크박스는 갱신되지 않았다. 결정을 뒤집거나 어기는 CRITICAL 성격은 아니고, plan 트래커와 실제 spec/코드 상태 간의 드리프트이므로 WARNING 하나로 정리했다.

## 위험도

LOW
