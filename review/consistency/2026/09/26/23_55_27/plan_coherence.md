# Plan 정합성 검토 — `spec/3-workflow-editor/` (impl-prep)

## 검토 범위

- Target: `spec/3-workflow-editor/5-version-history.md`(주 대상) + bundle 로 포함된 `0-canvas.md`·`2-edge.md`·`3-execution.md`·`4-ai-assistant.md`·`_product-overview.md`·`1-node-common.md`
- 실제 작업 plan: `plan/in-progress/workflow-version-creator.md` (owner: developer, spec_impact: none) — `WorkflowVersion*Dto.creator`/`changeSummary` 의 §5.4 금지 조합 정정 + 공유 `select` 상수화
- 대조한 `plan/in-progress/**`: `spec-draft-nullable-notation-followups.md`(트래커, 해당 두 체크리스트 항목의 출처), `ai-agent-tool-connection-rewrite.md`·`eia-terminal-payload.md`·`harness-review-gate-followups.md`·`spec-draft-eia-notification-payload-contract.md`·`spec-update-node-cancellation-shutdown-classification.md`(파일 매칭은 됐으나 전부 `0-canvas.md`/`2-edge.md`/`3-execution.md`의 무관한 항목 — Tool Area 재작성, EIA 페이로드, force-kill 분류 등. `workflow-version-creator.md` 의 작업(버전 DTO 선언)과 교집합 없음)

## 발견사항

- **[INFO]** 프런트엔드 미러 미변경 결정의 트래커 반영 필요
  - target 위치: `plan/in-progress/workflow-version-creator.md` §실측 마지막 항목 ("프런트엔드 미러... → **바꾸지 않는다.**")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1052-1054` — `creator` 항목이 "`lib/api/workflows.ts` 의 손수 맞춘 미러도 같은 턴에 봐야 한다" 라고 명시
  - 상세: `workflow-version-creator.md` 는 이 지시를 실제로 검토했고("소비처가 방어 코드+테스트를 갖는다", "넓은 쪽이 런타임에 안전하다") 변경하지 않기로 결정했다 — "봐야 한다"(검토)는 이행했지만 "바꾼다"는 아니다. 이 판단은 트래커의 선행 완료 항목(`:941-960`, 배치 B-8 — "두 타입은 실제로 형태가 다르다... 합치지 않았다")과 방향이 같아 새로운 충돌은 아니다. 다만 `workflow-version-creator.md` 의 체크리스트는 "트래커 두 항목 닫기"만 적고, 트래커 쪽에 이 프런트엔드 결정(변경 안 함 + 근거)을 기록하는 단계가 명시돼 있지 않다. 트래커의 다른 완료 항목들은 전부 `> **완료 (...)**` 각주로 실제 처리 내용을 남기는 관례이므로, 이 항목만 그 관례 없이 체크박스만 닫히면 "프런트엔드 미러는 검토 안 됐다"는 오독을 다음 사람이 할 수 있다.
  - 제안: `--impl-done` 이후 트래커 항목을 닫을 때, "프런트엔드 미러는 의도적으로 유지 — 근거: 방어 코드/테스트 의존, JSDoc 유효" 를 완료 각주로 남길 것. spec/plan 어느 쪽도 지금 당장 갱신할 필요는 없음(차단 아님).

## 요약

`workflow-version-creator.md` 가 닫으려는 두 항목(`creator` §5.4 조합 정정, 공유 `select` 상수화)은 `spec-draft-nullable-notation-followups.md` 트래커에 developer 소유로 명시 등재된 항목과 정확히 일치하며, 선행 조건(#1292 의 `creator` 런타임 3필드 고정, `daff47a6b`/`4691166fb`/`e20756844`/`7e617acd6` 머지)도 이미 충족돼 있다. `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행 존재도 코드에서 확인했다. bundle 에 포함된 `0-canvas.md`·`2-edge.md` 등을 겨냥한 다른 in-progress plan(`ai-agent-tool-connection-rewrite.md` 등)은 Tool Area 재작성 등 완전히 다른 관심사라 교집합이 없다. 프런트엔드 `lib/api/workflows.ts` 를 건드리지 않기로 한 결정은 트래커의 과거 완료 항목(배치 B-8, "두 타입은 실제로 형태가 다르다")과 방향이 같아 미해결 결정을 우회하는 것으로 보이지 않는다. 다만 트래커 항목을 닫을 때 이 결정을 완료 각주로 남기는 절차가 빠지지 않도록 INFO 로 남긴다. CRITICAL/WARNING 급 충돌은 발견하지 못했다.

## 위험도

LOW
