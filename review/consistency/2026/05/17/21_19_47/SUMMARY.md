# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 구현 착수 가능

검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`cafe24-call-401-retry-after-spec`)
검토 일시: 2026-05-17T21:19:47

---

## 전체 위험도

**LOW** — CRITICAL 0건, WARNING 1건(2개 checker 발견 통합), INFO 5건. 구현 차단 사유 없음.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec + Rationale Continuity (통합) | `spec/2-navigation/4-integration.md §6` 상태 전이 표의 `connected → error(auth_failed)` 행이 "노드 실행 중 **401**" 을 직접 트리거로 기술해 새 정책(refresh + 1회 재시도 후에도 401일 때만 격하)과 표면적 불일치. 동시에 `spec/5-system/11-mcp-client.md §8.4` 본문 마지막 문장("단일 실패로 status 가 전환되는 점은 의도적")이 외부 MCP 서버 한정임을 본문에서 명시하지 않아 Internal Bridge 예외 단락과 scope 경계 모호 | `spec/2-navigation/4-integration.md §6` 상태 전이 표 / `spec/5-system/11-mcp-client.md §8.4` 마지막 문장 | `spec/4-nodes/4-integration/4-cafe24.md §6.1` 새 401 회복 정책 / `spec/5-system/11-mcp-client.md §8.4` Internal Bridge 예외 단락 | (a) §6 상태 전이 표 행의 401 기술을 "401 *(refresh + 재시도 후에도 401)*" 으로 정밀화. (b) §8.4 마지막 문장 앞에 "*(외부 MCP 서버 한정)*" 범위 주석 한 줄 추가. 구현 착수 전 project-planner 에게 위임. |

> 통합 근거: Cross-Spec checker 발견사항 #1 과 Rationale Continuity checker WARNING 이 동일 원인("새 정책 도입 후 구 표현 잔류")을 각도만 달리해 지적했으므로 하나의 WARNING 으로 통합. 강한 등급(WARNING) 적용.

> 해소 commit: `3e8182b8 docs(spec): cafe24 401 자가 회복 — 후속 정밀화` (본 세션 직후 처리).

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 에러 처리 spec과의 도메인 분리 확인 — Clemvion JWT 기반 프론트엔드 401 처리와 Cafe24 백엔드 401 회복 경로가 분리되어 충돌 없음. 향후 `CAFE24_AUTH_FAILED` 가 노드 error 포트에 도달하는 경우 에디터 인라인 에러 경로를 spec 이 보충 서술 여지 있음 | `spec/2-navigation/11-error-empty-states.md §1.3`, `spec/5-system/3-error-handling.md §5.1` | 현재 충돌 없음. 참고 기록. |
| 2 | Cross-Spec | `pingConnection()` 403 격하 정책이 `call()` 경로(§6.1)와 의도적으로 다른 점이 §5.8 본문에 명시되지 않아 구현 혼동 여지 | `spec/4-nodes/4-integration/4-cafe24.md §5.8` | §5.8 에 "403의 status 격하는 이 경로에서 비활성 — call() 경로(§6.1)와 의도적으로 다름" 주석 추가 검토. 구현 차단 수준 아님. |
| 3 | Rationale Continuity | "재시도 1회 상한" invariant 유지 확인 — §6.1 + §10.5 양쪽에 명시, 기각 대안 (B) 처리 완료. BullMQ dedup 보호·DB Enum 비확장 원칙 모두 준수 | `spec/4-nodes/4-integration/4-cafe24.md §6.1`, `spec/2-navigation/4-integration.md §10.5` | 이미 적절히 처리됨. |
| 4 | Plan Coherence | `cafe24-backlog-residual.md` B-5-8 alt 착수 시 `cafe24-api.client.ts` 동시 수정 경합 가능성. B-5-8 alt worktree 는 TBD로 미착수 | `plan/in-progress/cafe24-backlog-residual.md §B-5-8 alt` | `cafe24-backlog-residual.md` 에 "B-5-8 alt 착수 전 `cafe24-401-refresh-a3f2c1` worktree merge 완료 여부 확인" 메모 추가 권장. |
| 5 | Plan Coherence | `spec-update-cafe24-test-connection.md §5.8` 의 401 회복 기술이 이미 처리된 §10.5와 중복될 수 있음 | `plan/in-progress/spec-update-cafe24-test-connection.md §5.8` | 선행 의존성 3건 해소 후 spec 내용 중복 여부 머지 전 검토. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 상태 전이 표 §6 의 401 기술이 새 정책과 표면적 불일치(WARNING). CRITICAL 없음 |
| Rationale Continuity | LOW | §8.4 마지막 문장의 외부 MCP 서버 한정 범위가 본문에 미명시(WARNING). 기각 대안·불변 원칙 전부 준수 |
| Convention Compliance | NONE | 명명·출력 포맷·문서 구조·API·금지 항목 전 관점 위반 없음 |
| Plan Coherence | LOW | CRITICAL/WARNING 없음. B-5-8 alt 경합 가능성 및 spec-update §5.8 중복 확인 권장(INFO) |
| Naming Collision | NONE | 외부 노출 식별자 신규 도입 없음. 내부 private 메서드 후보 충돌 0건 |

---

## 권장 조치사항

1. **[WARNING 해소 — 완료]** `spec/2-navigation/4-integration.md §6` 상태 전이 표의 `connected → error(auth_failed)` 행 정밀화 + `spec/5-system/11-mcp-client.md §8.4` 마지막 문장에 "외부 MCP 서버 한정" 주석 추가. → commit `3e8182b8` 에서 처리됨.
2. **[INFO]** plan 의 코드 항목에 `withIntegrationLock` 내부 retry 안전성 근거를 명시하여 구현자 혼동을 예방 (이미 본 plan `cafe24-call-401-retry.md` 비목표 절에 명시됨).
3. **[INFO — B-5-8 alt 착수 시]** `cafe24-backlog-residual.md` B-5-8 alt 착수 전 `cafe24-401-refresh-a3f2c1` worktree merge 완료 여부 확인 메모 추가.
4. **[INFO — merge 시점]** `spec-update-cafe24-test-connection.md` 선행 의존성 해소 후 §5.8 내용이 기 처리된 §10.5와 중복되지 않는지 검토.
