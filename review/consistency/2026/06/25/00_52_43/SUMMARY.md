# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하이며 차단 사유에 해당하지 않는다.

## 전체 위험도
**MEDIUM** — Rationale 갱신 누락 2건(WARNING)이 미래 독자의 설계 맥락 파악을 저해할 수 있으나, 기능 동작·계약·규약 직접 위반은 없다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Rationale Continuity | `getStatus()` null→실값 번복의 설계 근거(race window, SSE 역할 분담) Rationale 미기록 | `spec/5-system/14-external-interaction-api.md` §5.3 및 Rationale R1~R16 | 과거 "currentNode/context 항상 null" 결정(git show 5b468d37) | R17 항목 추가 — (a) 과거 null 고정 이유, (b) race window 번복 배경, (c) SSE replay와의 역할 분담, (d) conversationThread 는 SSE 권위 유지 이유 |
| W2 | Rationale Continuity | `NodeExecution.outputData` 공개 EIA 표면 노출 보안 제약이 코드 JSDoc 에만 존재, spec Rationale 미기록 | `interaction.service.ts` getStatus() JSDoc / `node-execution.entity.ts` @Index JSDoc | `spec/5-system/14-external-interaction-api.md` §8 보안 섹션 및 Rationale | EIA Rationale(또는 `spec/conventions/`)에 "outputData 허용/금지 데이터 유형 및 노드 핸들러 의무" 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `data-flow/15-external-interaction.md` §1.2 "만 반환" 문구가 EIA §5.3 최신 동작과 불일치 | `spec/data-flow/15-external-interaction.md` 123~124행 | "만 반환" → `waiting_for_input` 시 `currentNode`/`context` 동봉 설명으로 보완 또는 EIA §5.3 cross-link 대체 |
| I2 | Cross-Spec | `1-widget-app.md` §3 상태기계에 race 보정(getStatus 시드 + `openStream("0")`) 미기술 | `spec/7-channel-web-chat/1-widget-app.md` §3 / §R6 | "start 완료 후 getStatus 1회 시드 → openStream(lastEventId=0)" 순서를 짧게 추가, `5-admin-console.md §5` 와 cross-link |
| I3 | Cross-Spec | `external-interaction.module` 의 NodeExecution TypeORM forFeature 등록이 spec §10에 미기재 | `spec/5-system/14-external-interaction-api.md` §10 | 선택적 — `interaction.service.ts` 항목 주석에 "(NodeExecution 직접 조회 — getStatus waiting 표면 복원)" 추가 |
| I4 | Rationale Continuity | `@Index(['executionId','status'])` TypeORM 데코레이터와 Flyway V095 partial index 이중 출처 정당화 미기록 | `node-execution.entity.ts` @Index 데코레이터 | `spec/0-overview.md` 또는 `spec/conventions/migrations.md` 에 "TypeORM @Index = schema 인식 전용, DDL SoT 는 Flyway 유지" 한 단락 추가 |
| I5 | Rationale Continuity | `seedWaitingFromStatus` soft-fail 정책(HTTP 오류 시 console.warn 후 진행)이 Rationale 미기록 | `use-widget.ts` seedWaitingFromStatus JSDoc | R17 내에 "SSE replay 가 1차, REST 시드는 best-effort — 실패 시 SSE replay 로 복구 가능하므로 블로킹 안 함" 포함 |
| I6 | Convention Compliance | spec §5.3 에 `seq(항상 \`0\` placeholder)` 기술, 구현은 의미 명확한 `SSE_SEQ_PLACEHOLDER` 상수 사용 — 정보 비대칭 | `spec/5-system/14-external-interaction-api.md` §5.3 | spec §5.3 주석에 "REST 단발 응답에서는 in-memory SSE seq 에 접근 불가, SSE_SEQ_PLACEHOLDER 상수로 고정" 1문장 추가 |
| I7 | Convention Compliance | spec §10.1 에 `@ApiBearerAuth('interaction-token')` 재설명, `swagger.md §2-1` SoT cross-link 부재 | `spec/5-system/14-external-interaction-api.md` §10.1 | §10.1 첫 bullet 뒤에 `([Swagger 규약 §2-1](../conventions/swagger.md#2-1) 에 이미 등재됨)` 참조 추가 |
| I8 | Convention Compliance | `TOKEN_INVALID` / `TOKEN_EXPIRED` 가 interaction 레이어와 workspace-JWT 레이어에서 동일 문자열 사용, `error-codes.md §3` 미등재 | `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 | `spec/conventions/error-codes.md §3` 에 레이어 구분 SoT footnote 추가 |
| I9 | Plan Coherence | `spec-sync-external-interaction-api-gaps.md` 4번째 항목(getStatus currentNode/context 미구현)이 이번 구현으로 해소됐으나 체크박스 미체크 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 해당 항목에 부분 완료 표기 — currentNode/context 완료(이번 PR), seq 실값은 placeholder 유지(spec 합의) 로 분리 명기 |
| I10 | Plan Coherence | `eia-distributed-seq-load-verify.md` 내부 미결정 항목 확인 권장 (파일 직접 열람 미완료) | `plan/in-progress/eia-distributed-seq-load-verify.md` | 파일 열람 후 seq 0 placeholder 유지 결정과의 정합 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | data-flow §1.2 "만 반환" 문구 drift, 1-widget-app.md 상태기계 race 보정 미기술 (모두 INFO) |
| Rationale Continuity | MEDIUM | getStatus null→실값 번복 Rationale 미기록(W1), outputData 보안 제약 Rationale 미기록(W2) |
| Convention Compliance | NONE | 규약 직접 위반 없음, 3건 모두 INFO 수준 정보 보완 |
| Plan Coherence | LOW | 구현 plan 정합 확인됨, spec-sync-gaps plan 체크박스 추적 불일치(INFO) |
| Naming Collision | NONE | 충돌 없음 — 신규 식별자 모두 안전 |

## 권장 조치사항

1. **(W1 해소 — 최우선)** `spec/5-system/14-external-interaction-api.md` `## Rationale` 에 R17 추가: race window 로 인한 getStatus null→실값 번복 배경, SSE replay 와의 역할 분담(`SSE = seq/thread 권위, REST = 현재 표면 시드`), conversationThread 는 SSE 권위 유지 이유, seedWaitingFromStatus soft-fail 근거(I5 포함 통합).
2. **(W2 해소)** EIA `## Rationale` 또는 `spec/conventions/` 에 "outputData 허용/금지 데이터 유형 및 노드 핸들러 의무" 항목 추가 — 코드 JSDoc 의 보안 제약을 spec 레벨로 승격.
3. **(I1)** `spec/data-flow/15-external-interaction.md` §1.2 "만 반환" 문구를 EIA §5.3 최신 동작에 맞게 보완 또는 cross-link 대체.
4. **(I2)** `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계에 race 보정 흐름 추가.
5. **(I4)** `spec/0-overview.md` 또는 `spec/conventions/migrations.md` 에 TypeORM @Index = schema 인식 전용, DDL SoT = Flyway 원칙 명문화.
6. **(I9)** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 4번째 항목 부분 완료 표기 갱신.
7. (I6~I8, I3, I10) 선택적 개선 — 다음 spec 정기 동기화 시 일괄 처리 가능.