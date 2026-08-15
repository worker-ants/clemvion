# Rationale 연속성 검토 결과

## 검토 범위 확인

- diff-base `origin/main` 대비 실제 변경된 spec 파일은 2개뿐이다: `spec/5-system/14-external-interaction-api.md`(+16/-4), `spec/conventions/node-cancellation.md`(+20/-1, 스코프 밖이지만 직접 관련되어 함께 확인).
- 코드 변경은 `execution-engine.service.ts`(`finalizeCancelledExecution` emit 판정 로직) · `retry-turn.service.ts`(`finalizeGuarded` CANCELLED 분기에 `RETURNING` 추가) · `terminal-duration.ts`(`toPersistedDate` 헬퍼) · `execution-status-response.dto.ts`/`interaction.service.ts`(`durationMs` 필드 노출)에 집중.
- worktree 이름(`eia-r8-cache-scope`)과 달리 실제 checkout 브랜치는 `claude/eia-db-wire-invariant`이며, diff 도 R8(Idempotency-Key 캐시 스코프)과 무관하다 — R8 관련 코드(`interaction.controller.ts`의 idempotency interceptor 등)는 이번 diff에서 건드리지 않았다. worktree 이름에 낚여 R8을 검토 대상으로 오인하지 않도록 확인 완료.

## 발견사항

없음 (CRITICAL/WARNING 없음). 아래는 확인 과정에서 검증한 사항과 INFO 성격의 관찰이다.

- **[INFO] `durationMs` GET status 노출에 전용 Rationale 서브섹션 없음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 EIA-IN-04 표·응답 예시(라인 ~482-491), `## Rationale` 섹션(라인 1180-1553)
  - 과거 결정 출처: 같은 문서 `### R17` — "`getStatus` 의 `currentNode`/`context` 실값 노출 (null placeholder 부분 번복)" 및 그 2026-07-09 `conversationThread` 확장. R17은 getStatus 응답 필드를 추가할 때마다 "경위 → 번복 배경 → 기각 대안" 형식의 전용 Rationale 서브섹션을 쓰는 관행을 확립했다.
  - 상세: 이번 PR은 EIA-IN-04(`GET /api/external/executions/:executionId`)에 `durationMs` 필드를 새로 추가했다. §6 종결 이벤트 필드표(라인 581)에 이미 정의된 값을 그대로 재노출하는 것이라 R17 처럼 신규 민감 표면·보안 트레이드오프를 수반하지 않으므로 R17 급의 전용 Rationale이 필수는 아니다. 다만 R17이 세운 "getStatus 필드 확장은 Rationale에 남긴다" 관행과 완전히 대칭이 되게 하려면 짧은 포인터가 있으면 좋다.
  - 제안: 선택 사항. `## Rationale`에 1-2문장짜리 R20 항목(또는 R17 말미에 후속 각주)으로 "durationMs는 §6 종결 이벤트 필드의 재노출이며 신규 표면이 아니다"를 명시하면 R17 관행과의 정합이 완전해진다. 차단 사유는 아님.

## 확인했으나 위반이 아니었던 항목 (참고용)

- **`finalizeCancelledExecution`의 emit 판정 로직 변경** (guarded UPDATE 0행 시 "무조건 skip" → "DB 재조회 후 CANCELLED면 emit") — 언뜻 `finalizeFailedExecution`과의 "형제 함수 대칭"을 깨는 것처럼 보이나, 실제로는 `spec/conventions/node-cancellation.md`가 **이미 이 diff 안에서** `## Rationale` → "왜 취소 시각 보존 메커니즘이 두 가지인가" 항목에 "2026-08-15에 두 번 정정됐다 — 두 번째가 첫 번째를 뒤집는다"는 형태로 전체 반증 이력(① 원문 → ② 1차 정정(사용자 Stop이 무음이 됨) → ③ 최종)을 정직하게 남기며 갱신되어 있다. 이는 검토 관점 3("결정의 무근거 번복")이 요구하는 "번복 시 새 Rationale 동반"의 모범 사례이지 위반이 아니다. 구현 매트릭스 표에도 `finalizeCancelledExecution` 행이 신규 추가되어 자매 `finalizeFailedExecution`과 극성이 다름을 명시했다.
  - 다만 이 갱신은 review 대상 스코프(`spec/5-system/`) 밖 파일(`spec/conventions/node-cancellation.md`)에 있어 이번 target 번들에는 포함되지 않았다 — orchestrator가 스코프를 산정할 때 관련 convention 문서를 놓치지 않았는지는 별도 확인 가치가 있으나, 실제 내용은 정합이었다.
- **retry-turn `COALESCE` UPDATE에 `RETURNING` 추가** (durationMs/finishedAt DB-wire 불일치 해소) — `spec/5-system/14-external-interaction-api.md` §6 도입부의 "raw UPDATE는 JS에서 계산할 수 없다. UPDATE 문 안에서 SQL로 계산하고 RETURNING으로 되받아 싣는다"는 기존 invariant를 그대로 따른 수정이며, "알려진 예외 1건"을 삭제가 아니라 취소선 + "(2026-08-15 해소)" 주석으로 이력을 보존한 방식은 같은 문서가 R14/R17/§6.4에서 이미 쓰는 "알려진 갭은 invariant 옆에 적는다" 관행과 동형이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 대응 항목도 체크 완료로 갱신되어 plan-spec 간 정합도 확인됨.
- **EIA-IN-04 필드 집합 확장(durationMs)이 §6 "필드 집합은 이 표가 전부다" 원칙과 충돌하는가** — 충돌하지 않는다. 그 문장은 outbound 종결 이벤트(webhook/SSE/WS) payload에 대한 닫힌 목록 선언이고, GET status(§5.3)는 별도 표면이다. 오히려 §6 "삭제된 약속" 콜아웃이 "풍부한 종결 데이터가 필요하면 §5.3 단발 상태 조회를 쓰라"고 명시적으로 이 방향을 유도하고 있어, 이번 확장은 기존 설계 의도와 정합적이다.
- **R8(Idempotency-Key 캐시 스코프, `interaction:idempotency:<executionId>:<route>:<key>`)** — 이번 diff가 건드리지 않음. 재도입·번복 없음.

## 요약

diff-base 대비 spec 변경은 `spec/5-system/14-external-interaction-api.md`와 `spec/conventions/node-cancellation.md` 두 파일뿐이며, 둘 다 과거 Rationale(R14/R17/§6/§2.4 DB-관측 invariant)이 요구하는 패턴 — 필드 확장은 좁게, 알려진 갭 해소는 취소선+이력 보존, 결정 번복은 새 Rationale 동반 — 을 그대로 따르고 있다. 특히 `finalizeCancelledExecution`의 emit 판정 로직이 두 차례 정정된 과정은 node-cancellation.md `## Rationale`에 반증 이력째로 투명하게 기록되어 있어, 이 저장소가 요구하는 "결정 번복 시 근거 동반" 기준을 충족한다. 기각된 대안의 무단 재도입, 합의 원칙 위반, 시스템 invariant 우회는 발견되지 않았다. durationMs의 GET status 노출에 R17 급 전용 Rationale 서브섹션이 없는 점만 INFO로 남긴다(차단 사유 아님).

## 위험도
NONE
