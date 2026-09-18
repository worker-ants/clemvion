# 문서화(Documentation) 리뷰 — 웹훅 endpoint_path 전역 유일 (V131/V132)

## 발견사항

- **[WARNING]** 아직 존재하지 않는 `plan/complete/...` 경로를 영구 문서(마이그레이션 헤더 · spec Rationale)에 이미 박아 넣었다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:4`, `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:5`, `spec/1-data-model.md` 신설 Rationale 절 «Webhook `endpoint_path` 전역 유일 (2026-09-18)» 말미의 출처 blockquote
  - 상세: 세 곳 모두 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 를 근거 문서로 인용하지만, 실측 결과(`ls`) 이 경로는 현재 존재하지 않는다 — 그 draft 는 아직 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 에 있다(frontmatter `status: in-progress`). draft 자신의 체크리스트가 "트래커 반영 · 이 draft `complete/` 이동(마지막 커밋)"을 아직 미완료(`[ ]`)로 남겨 두고 있어 이 상태는 인지되고 있지만, 마이그레이션 SQL 파일은 이 저장소 컨벤션상 **append-only**(README §5 "append-only 라 둘 다 소급 수정 대상은 아니고")로 취급된다 — 즉 지금 이 인용이 틀린 채로 머지되면, spec 문서와 달리 SQL 헤더 주석은 나중에 고치기 어렵다(고치려면 별도 후속 커밋/사과 노트가 필요). `--impl-done`/`/ai-review`/`트래커 반영`/`complete/` 이동이 전부 이 draft 의 마지막 커밋 앞에서 순서대로 끝나야만 이 참조가 참이 된다.
  - 제안: `complete/` 로 이동하는 커밋과 이 세 참조가 가리키는 커밋을 **같은 커밋(또는 그 이전이 아닌 이후)** 으로 순서를 강제하거나, 최소한 마이그레이션 SQL 헤더는 이동 완료 후에 최종 확정하는 것으로 작업 순서를 명시한다. draft 체크리스트가 이미 "이동 뒤 `grep -rln` 으로 인용 전부가 실재 경로를 가리키는지 확인" 을 계획해 뒀으므로, 그 단계가 실제로 수행되는지만 놓치지 않으면 된다 — 지금 시점 diff 만 보면 dangling 이라는 점을 기록해 둔다.

- **[INFO]** V132 헤더의 "운영 절차 ①"(경쟁 시 V131 DO 블록 수동 재실행 → repair → migrate)은 `migrations/README.md` 의 기존 일반 절차(§5 "재실행이 일어나는 경로 두 가지" 표)와 형태가 다른 **새로운 복구 패턴**인데 README 에는 반영되지 않았다
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql` "운영 절차 ①" 단락(파일 헤더, gate 13~15행 부근)
  - 상세: README §5 표는 "CREATE 성공 후 DROP(old) 실패" 케이스만 다룬다. 이번 절차는 그것과 달리 **CREATE 자체가 실제 중복 데이터로 실패**하고, 복구를 위해 **이미 성공 처리된 별도 파일(V131)의 본문을 손으로 다시 실행**해야 하는 2-파일 협조 복구다. 이 절차 지식은 현재 V132 파일 헤더 한 곳에만 있다 — README 를 먼저 참고하는 운영자는 이 케이스를 찾지 못한다.
  - 제안: 이 패턴이 향후 "인덱스 교체 + 선행 정리 마이그레이션" 조합에서 재발할 수 있다고 보면 README §5/§6 에 "정리+교체 2-파일 조합에서 교체가 새 데이터로 실패하면 정리 파일을 수동 재실행 후 repair" 한 문장을 일반화해 추가할 가치가 있다. 이번 PR 범위에서는 필수는 아니며(V132 헤더에 충분히 상세히 적혀 있음), 다음에 같은 패턴이 또 나오면 반드시 일반화할 것.

- **[INFO]** 문서화 품질 자체는 이 변경 세트에서 이례적으로 높다 — 결함 아님, 참고로만 기록
  - 위치: `spec/1-data-model.md`(신설 Rationale), `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/7-channel-web-chat/5-admin-console.md`, `spec/data-flow/10-triggers.md`
  - 상세: `(workspace_id, endpoint_path)` / `idx_trigger_workspace_endpoint` / "동일 워크스페이스에 같은 endpointPath" 류의 옛 서술을 전수 grep 한 결과, 남아 있는 것은 전부 (a) 삭제된 옛 인덱스를 가리키는 정당한 역사적 참조(`triggers.service.spec.ts` B6 테스트의 "부재 확인" 대상, `triggers.service.ts` JSDoc 의 "V002 는 이랬다" 서술), (b) `spec/data-flow/10-triggers.md` 안에서 취소선(`~~...~~`)으로 명시적으로 보존한 원문 + 바로 뒤의 «정정 (2026-09-18)» 블록뿐이었다 — 즉 오래된 주석/스펙 문구가 방치된 곳이 하나도 없었다. Swagger `@ApiConflictResponse` 설명, JSDoc, e2e 테스트 인라인 주석(B5/B6), 마이그레이션 헤더 주석 모두 실제 동작(전역 UNIQUE, 다른 워크스페이스 트리거와도 충돌, 채팅 채널 상태 컬럼 미사용 등)과 정확히 일치했다. 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 항목도 체크박스 갱신 + "성능 항목이 아니라 보안 결함이었다"는 정정 문구를 남겨 향후 독자가 잘못된 등재 근거를 그대로 믿지 않도록 조치했다.

## 요약

핵심 코드/스펙 변경(마이그레이션 V131·V132, `triggers.controller.ts`/`triggers.service.ts`의 Swagger·JSDoc·에러 메시지, e2e 테스트, 7개 spec 문서)은 문서화 관점에서 매우 꼼꼼하다 — 독스트링·주석이 실제 동작과 정확히 일치하고, 옛 서술은 방치 없이 취소선+정정 또는 역사적 참조로만 남았으며, 4회에 걸친 consistency-check 반복(Critical 4건 전량 해소)이 spec 간 정합성까지 담보했다. 유일한 실질적 문서 결함은 마이그레이션 SQL 헤더와 신설 spec Rationale이 아직 `plan/in-progress/`에 있는 draft를 `plan/complete/...` 경로로 앞당겨 인용하는 dangling reference로, draft 자신의 체크리스트가 이 이동을 마지막 단계로 이미 추적하고 있어 완결 전 임시 상태로 보이지만 마이그레이션 파일은 append-only 관례상 사후 정정이 어려우므로 순서 보장이 필요하다. README 갱신 필요성은 낮음(신규 운영 절차가 인스턴스 문서에만 있으나 재발 시 일반화 권고).

## 위험도

LOW
