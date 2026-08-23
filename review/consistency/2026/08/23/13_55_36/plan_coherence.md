# 발견사항

- **[WARNING]** `egress-masking.md §3` 정정 시 트래커 항목의 "동반 갱신" 지시를 표(§1)까지 정정했다는 근거가 tracker 자체에는 안 남는다
  - target 위치: 이 turn 의 target 은 `spec/5-system/` 이지만, 실제 spec_impact 는 `spec/conventions/egress-masking.md §3`(target 번들 밖, 직접 열어 확인함)
  - 관련 plan: `plan/in-progress/masking-gate-consolidation.md`(§"⚠️ 제가 예고한 규약 stale 은 발생하지 않는다") ↔ `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 미체크 항목 *"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합"* (2026-08-20 등재, `14_44_08` W4)
  - 상세: 트래커 항목은 "착수 시 [egress-masking §1 좌표계 표] 의 소비처 열이 stale 해진다 … 이 표를 동반 갱신한다"고 명시적으로 지시했다. masking-gate-consolidation plan 은 실측으로 이 전제를 반증한다(§1 표 2행 소비처는 여전히 `deepRedactSecrets`, 5행은 `stripExternalOnlyFields`이고 신규 헬퍼는 그 위에 얹힐 뿐이라 심볼이 안 바뀐다 — 코드(`redact-stored-error.ts`)로 직접 검증해 이 refutation 은 실제로 타당하다). 다만 plan 의 작업 목록은 "`egress-masking.md §3` 의 stale 트리거 문장 정정"만 명시하고, 트래커 항목을 닫을 때(작업 목록의 "트래커 항목 종결") **"§1 표는 왜 손대지 않았는가"를 tracker 자체에 기록하는 것**은 명시돼 있지 않다. 이 tracker 문서는 바로 이 패턴(전제가 반증됐는데 기록을 안 남겨 재지적당함)이 이미 여러 차례(`11_59_09`·`16_19_57`·`18_29_21` 등) 발생했다고 스스로 적어 둔 문서라서, 같은 형태의 누락이면 다음 리뷰 라운드가 §1 표 staleness 를 다시 문제 삼을 위험이 있다.
  - 제안: `plan/in-progress/masking-gate-consolidation.md` 의 "트래커 항목 종결" task 를 "§1 표는 무변경이며 그 근거(측정)를 tracker 블록쿼트에 남긴다"로 구체화하거나, 트래커 항목을 닫는 커밋에서 `spec-sync-external-interaction-api-gaps.md` 의 해당 블록쿼트에 반증 근거를 1~2문장 추가.

- **[INFO]** consolidation 이후에도 `toResponseExecution` 의 "정본" JSDoc 이 옛 개별 함수 심볼을 인용한다
  - target 위치: 코드 레벨(spec 번들 밖) — `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution` JSDoc (line ~1027-1028: `{@link redactStoredErrorForResponse}`/`{@link redactStoredDataForResponse}`)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 이미 종결된 항목 *"단일 관문 근거 서술이 소스 3곳에 흩어져 있다"*(2026-08-16 해소) — 이 JSDoc 블록을 명시적으로 "이 주석이 정본이다"로 지정한 자리
  - 상세: 현재 uncommitted diff 를 보면 `executions.service.ts` 는 이제 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 만 import 하고, 개별 함수 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 는 더 이상 이 파일에서 직접 쓰이지 않는데, "정본" JSDoc 은 여전히 그 개별 함수들을 관문으로 서술한다. 빌드는 깨지지 않지만(다른 파일에서 export 된 심볼이라 링크 자체는 유효), 이 문서가 정확히 "표면이 늘면 여기 한 곳만 갱신"을 약속한 자리이므로 새 간접 계층(헬퍼 파일)이 추가된 사실을 반영하지 않으면 미세한 정합성 드리프트가 남는다. 이는 target(spec) 과의 충돌이라기보다 impl 세부이므로 CRITICAL/WARNING 이 아니라 참고 메모로 남긴다.
  - 제안: `/ai-review` 라운드에서 이 JSDoc 참조 갱신 여부를 확인(계획 자체를 막을 사안은 아님).

미해결 결정과의 정면 충돌이나 미해소 선행 plan 은 발견되지 않았다 — 인접 in-progress plan(`ws-event-types-extract.md`, `eia-terminal-payload.md`, `eia-context-schema-followups.md`, `node-output-redesign/*`, `node-cancellation-residual-signal-propagation.md`, `ai-agent-tool-connection-rewrite.md` 등)을 확인했으나 `inputData`/`outputData`/`error` 마스킹 표면과 겹치지 않는다. 트래커의 "결정 항목"으로 남은 workflow-assistant 마스킹 우선순위 건(`explore-tools.service.ts`)도 이 plan 의 4개 호출부(`executions.service.ts`/`background-runs.service.ts`)와 파일이 달라 충돌하지 않는다.

# 요약

`plan/in-progress/masking-gate-consolidation.md` 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 미체크 항목을 정확히 집행하며, 그 트래커가 예고한 "`egress-masking.md` §1/§3 동반 갱신 필요" 전제를 코드로 직접 검증해 반증하고(§1 표의 소비처 심볼은 실제로 안 바뀜) §3 트리거 문장만 정정하는 것으로 범위를 좁혔다 — 이 refutation 자체는 내가 코드(`redact-stored-error.ts`, `executions.service.ts` diff)로 재검증해 타당함을 확인했다. 다만 그 반증 근거를 트래커 문서 자체에 남기는 작업이 plan 의 task 목록에 명시적으로 들어있지 않아, 이 저장소가 반복적으로 겪어 온 "반증된 전제를 기록 안 해 재지적당하는" 패턴이 재발할 여지가 있다. 그 외에 다른 in-progress plan 과의 충돌이나 미해소 선행 조건은 발견되지 않았다.

# 위험도
LOW
