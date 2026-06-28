# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능하나 WARNING 항목 해소 권장.

검토 모드: `--impl-prep`
대상 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md 외 전체)
검토 일시: 2026-06-28

---

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 5건(plan 미결 결정 2건 + SSRF 동기화 보류 + stale 처방 + historical-artifact 동기화 주의)이 구현자 혼동 및 spec-코드 불일치를 유발할 수 있음.

---

## Critical 위배 (BLOCK 사유)

_해당 없음._

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Naming Collision (통합) | `document:graph_error` — `5-knowledge-base.md` 가 실제 미emit 이벤트를 emit 되는 것처럼 기술. `6-websocket-protocol.md:739` 도 동일 이벤트를 6종 열거에 포함 | `spec/2-navigation/5-knowledge-base.md:182`, `spec/5-system/6-websocket-protocol.md:739` | `spec/5-system/10-graph-rag.md §6` (dead-declared 명시) | `5-knowledge-base.md:182` 의 `_error` 제거 또는 `(dead-declared, emit 없음)` 주석 추가. `6-websocket-protocol.md:739` 에도 동일 주석. `10-graph-rag.md §6` 가 SoT |
| W-2 | Plan Coherence | `spec-code-cross-audit` V-09 미결 — auth §1.5.3 초대 수락 흐름(spec: [수락] 버튼 UI)이 코드(자동 호출)와 상충하며 결정 미확정 | `spec/5-system/1-auth.md §1.5.3` | `plan/in-progress/spec-code-cross-audit-2026-06-10.md §V-09` | 구현 착수 전 V-09 결정(spec 하향 또는 코드 재구현) 확정 후 정합화 |
| W-3 | Plan Coherence | `spec-code-cross-audit` V-14 미결 — `13-replay-rerun.md §10.2` Re-run 모달(spec: 원본 ID 링크 + typed 폼)이 코드(`<span>` + 텍스트 Input)와 상충하며 결정 미확정 | `spec/5-system/13-replay-rerun.md §10.2` | `plan/in-progress/spec-code-cross-audit-2026-06-10.md §V-14` | V-14 결정 확정 후 정합화. spec 본문에 "V-14 결정 대기" 단서 추가 권장 |
| W-4 | Plan Coherence | `http-ssrf-all-auth-followups.md` SSRF 전 인증 동기화 항목 보류 중 — spec 과 코드 서술 불일치 잠재 | `spec/5-system/11-mcp-client.md §3.2`, `spec/5-system/4-execution-engine.md §10` | `plan/in-progress/http-ssrf-all-auth-followups.md` (open checkbox) | 착수 전 보류 항목 spec 반영 또는 spec 본문에 "SSRF 전 인증 동기화 예정" 단서 추가 |
| W-5 | Plan Coherence | `spec-sync-structural-followups` open — `14-external-interaction-api.md` `console.warn` 처방이 stale (코드는 NestJS Logger 사용) | `spec/5-system/14-external-interaction-api.md` (≈L1108) | `plan/in-progress/spec-sync-structural-followups.md` (open checkbox) | spec 의 `console.warn` 처방을 `logger.warn` 또는 방법론 중립 표현으로 갱신 |
| W-6 | Convention Compliance | `1-auth.md §1.5.4` lower_snake_case 에러 코드 historical-artifact 예외 — 신규 코드 추가 시 `error-codes.md §3` 동기 업데이트 의무 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §3` | 신규 초대 관련 에러 코드 추가 시 `error-codes.md §3` 동기 업데이트 반드시 수행 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | RBAC 매트릭스 표현 상이 — auth §3.2 CRUD 표기의 의미 불명확(Owner=상위 역할 포함인지 직접 CRUD인지) | `spec/5-system/1-auth.md §3.2` | auth §3.2 에 "세부 RBAC SoT 는 `4-integration.md §8`" footnote 추가 |
| I-2 | Cross-Spec | `16-system-status-api.md §1` `agent-memory-extraction` 큐 — spec 선언은 있으나 코드 `MONITORED_QUEUES` 미등재 | `spec/5-system/16-system-status-api.md §1` | 구현 착수 시 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `agent-memory-extraction` 추가 |
| I-3 | Cross-Spec | auth §4.1 `auth_config.*` 현재형 vs `user.*` 과거분사 비대칭 — 규약 준수이나 구현자 혼동 여지 | `spec/5-system/1-auth.md §4.1` | "auth_config.* 은 CRUD 현재형 예외 (conventions/audit-actions.md §2)" 주석 추가 권장 |
| I-4 | Rationale Continuity | byte-identical 조항 폐기(D1), rerank provider Dropped, per-node task queue 기각과 exec-park D6 구분, WebAuthn counter 삭제 정책, WS snapshot 모델 등 핵심 결정 — 모두 Rationale 갱신 정상 | `spec/5-system/` 전체 | 없음 |
| I-5 | Convention Compliance | `10-graph-rag.md` 독립 `## Rationale` 섹션 부재 (§4 인라인 기술만 존재) | `spec/5-system/10-graph-rag.md` | §4 결정 근거를 `## Rationale` 섹션으로 분리 권장(강제 아님) |
| I-6 | Convention Compliance | `16-system-status-api.md` 구현 갭 추적 방식 — 인라인 주석 vs 타 파일의 `pending_plans` frontmatter 불일치 | `spec/5-system/16-system-status-api.md §1` | `pending_plans` frontmatter 로 통일 권장(현 상태 유지 가능) |
| I-7 | Naming Collision | `WEBAUTHN_ALLOW_FALLBACK` — production fail-closed 가드 대상 목록 미포함 여부 불명확 | `spec/5-system/1-auth.md §1.4.3` / §Rationale | Rationale "Production fail-closed 가드" 에 포함 또는 의도적 비포함 사유 한 문장 기술 |
| I-8 | Plan Coherence | `spec-sync-mcp-client-gaps` — `11-mcp-client.md §3.3` 캐시 선행 조건(Integration 엔티티 변경) 미해소 | `spec/5-system/11-mcp-client.md §3.3` | §3.3 착수 전 Integration 엔티티 선행 변경 완료 여부 확인 |
| I-9 | Plan Coherence | `ai-context-memory-followup-v2` — `17-agent-memory.md` watermark 참조 경로 정정 미완(`lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq`) | `spec/5-system/17-agent-memory.md` | 착수 전 경로가 Batch 2 이후 코드와 일치하는지 확인 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `document:graph_error` dead-declared 불일치(W-1 통합), RBAC 표기 명확성(I-1), `agent-memory-extraction` 구현 갭(I-2) |
| Rationale Continuity | NONE | 핵심 결정 Rationale 연속성 전부 이상 없음 |
| Convention Compliance | LOW | historical-artifact 예외 등재 정합(W-6 주의), `10-graph-rag.md` Rationale 섹션 부재(I-5) |
| Plan Coherence | MEDIUM | V-09(auth 초대 수락 W-2)·V-14(replay-rerun 모달 W-3) 미결 결정, SSRF 동기화 보류(W-4), console.warn stale(W-5) |
| Naming Collision | NONE | 요구사항 ID·엔드포인트·에러코드 충돌 없음. `document:graph_error` 표현 불일치(W-1 통합) |

---

## 권장 조치사항

1. **(W-2 우선)** `plan/in-progress/spec-code-cross-audit-2026-06-10.md §V-09` 결정 확정 — `spec/5-system/1-auth.md §1.5.3` spec 하향 또는 `accept-invitation-content.tsx` 재구현 방향 결정 후 정합화.
2. **(W-3)** `spec-code-cross-audit-2026-06-10.md §V-14` 결정 확정 — `spec/5-system/13-replay-rerun.md §10.2` spec 하향 또는 UI 재구현 방향 결정. spec 에 "V-14 결정 대기" 단서 추가.
3. **(W-1 통합)** `spec/2-navigation/5-knowledge-base.md:182` 에서 `_error` 항목 제거 또는 `(dead-declared, emit 없음)` 주석 추가. `spec/5-system/6-websocket-protocol.md:739` 에도 동일 주석 추가.
4. **(W-4)** `spec/5-system/11-mcp-client.md §3.2` 및 `4-execution-engine.md §10` 에 "SSRF 전 인증 동기화 예정" 단서 추가하거나 `http-ssrf-all-auth-followups.md` open 항목 spec 반영 완료.
5. **(W-5)** `spec/5-system/14-external-interaction-api.md` 의 `console.warn` 처방을 `logger.warn` 또는 방법론 중립 표현으로 갱신 (`spec-sync-structural-followups.md` open 체크박스 처리).
6. **(I-2)** 구현 착수 시 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `agent-memory-extraction` 추가 (spec 변경 불요).
7. **(I-7)** `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 에 `WEBAUTHN_ALLOW_FALLBACK` 포함 여부 명시.