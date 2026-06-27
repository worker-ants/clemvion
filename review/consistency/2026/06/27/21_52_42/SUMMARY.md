# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 2건이 있어 호출자가 차단해야 한다

---

## 전체 위험도

**HIGH** — CRITICAL 2건(spec 이 존재하지 않는 보안 강제·미구현 서비스를 구현된 사실로 선언), WARNING 5건(규약 누락·카탈로그 불일치·계획 미체크)

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Cross-Spec | `spec/data-flow/10-triggers.md` Rationale 가 `endpointPath` 에 `@IsUUID('4')` 서버 강제가 적용된다고 선언하지만, `create-trigger.dto.ts` / `update-trigger.dto.ts` 의 `endpointPath` 필드에는 `@IsString()` + `@MaxLength(255)` 만 선언되고 `@IsUUID()` 는 없다. 예시값 자체가 `'/hooks/my-integration'` 으로 비-UUID. | `spec/data-flow/10-triggers.md` §Rationale "Webhook `endpoint_path` 의 UNIQUE 범위" | `create-trigger.dto.ts`·`update-trigger.dto.ts` 의 `endpointPath` 필드; `spec/5-system/12-webhook.md` WH-MG-02("UUID 자동 생성"만 기술, 서버 강제 언급 없음) | (A) spec 문장을 원래 "서버는 UUID 형식을 강제하지 않는다"로 되돌린다. 또는 (B) `endpointPath` 에 실제로 `@IsUUID('4')` 를 추가 구현한 뒤 `spec/5-system/12-webhook.md` WH-MG-02 에도 서버단 UUID 강제 사실을 명시하고 spec 을 동기화한다. plan W1 체크박스도 함께 갱신. |
| C-2 | Cross-Spec | `spec/data-flow/12-workspace.md` §1.2·§3.1 이 `WorkspaceInvitationsPrunerService` BullMQ repeatable 잡이 매일 04:00 Asia/Seoul 에 실행된다고 현재형으로 선언하지만, 해당 서비스 클래스·BullMQ 큐·`MONITORED_QUEUES` 항목이 codebase 어디에도 없다. `spec/data-flow/0-overview.md §4` 카탈로그도 이 큐를 포함하지 않아 내부 모순(카탈로그 "16개" vs 주장 "17개")이 발생한다. | `spec/data-flow/12-workspace.md` §1.2, §3.1 | `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그(16개 선언); `system-status.constants.ts` `MONITORED_QUEUES`(해당 큐 없음); codebase 전체(`WorkspaceInvitationsPrunerService` 클래스 미존재) | (A) 구현 완료 시: 서비스 클래스 + BullMQ 등록 코드 구현, `spec/data-flow/0-overview.md §4` 카탈로그에 큐 행 추가(큐 이름·모듈·스케줄·작업 단위), `spec/data-flow/12-workspace.md §4 외부 의존` 에 BullMQ 항목 추가, `MONITORED_QUEUES` 동기화, plan W7 체크박스 갱신. (B) 미구현이면: §1.2·§3.1 의 해당 문단을 "미구현" 상태로 되돌리거나 "(Planned)" 마커 추가. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `agent-memory-extraction` 큐가 `spec/data-flow/0-overview.md §4` 카탈로그에는 등재됐으나 `MONITORED_QUEUES` 에 없다(15개). 카탈로그 주석이 "MONITORED_QUEUES 는 본 표를 SoT 로 삼는다"고 선언해 gap 이 명시 위반이다. | `spec/data-flow/0-overview.md §4` (`agent-memory-extraction` 행) | `system-status.constants.ts` `MONITORED_QUEUES` | `MONITORED_QUEUES` 에 `agent-memory-extraction` 을 추가하거나, 카탈로그에 "시스템 상태 모니터링 제외 — fire-and-forget" 주석을 달아 의도적 제외를 명시한다. |
| W-2 | Cross-Spec | `spec/data-flow/0-overview.md §5` HNSW 인덱스 항목이 `document_chunk` 테이블(V022/V030~V033)만 기술하고, 동일 패턴의 `agent_memory` HNSW partial index(V074~V079)를 누락했다. | `spec/data-flow/0-overview.md §5` "HNSW 인덱스" 항목 | `spec/data-flow/13-agent-memory.md §2.1` (V074~V079 차원별 partial index 명시) | §5 를 "document_chunk (V022/V030~V033) 및 agent_memory (V074~V079) 모두 차원별 partial index" 로 보완한다. |
| W-3 | Convention Compliance | `workspace_type_mismatch`, `already_a_member`, `invitation_already_pending`, `invitation_already_accepted` 4종의 `lower_snake_case` 에러 코드가 실제 코드에서 발행 중이나 `error-codes.md §3` Historical-artifact 예외 레지스트리에 미등재됐다. | `spec/data-flow/12-workspace.md` §1.2, §1.8 | `spec/conventions/error-codes.md §3`(초대 흐름 등재 코드 6종, 위 4종 누락) | `error-codes.md §3` 에 4종 행을 추가해 레지스트리를 완성한다. UPPER_SNAKE 정규화는 프론트엔드 분기 확인 후 결정. |
| W-4 | Convention Compliance | "이미 멤버" 동일 조건에 대해 초대 경로(`workspace-invitations.service.ts:105` → `already_a_member`, lowercase)와 직접 추가 경로(`workspaces.service.ts:246` → `ALREADY_A_MEMBER`, UPPER_SNAKE)가 다른 케이스 체계를 사용하며, spec 이 이를 설계 의도인지 historical artifact 인지 명시하지 않는다. | `spec/data-flow/12-workspace.md` §1.2 vs §1.9 | `spec/conventions/error-codes.md §1`(의미 기반 명명 + UPPER_SNAKE_CASE) | `spec/data-flow/12-workspace.md` §1.2 주석에 "`already_a_member` 는 invitation 흐름 전용 historical artifact — §1.9 의 `ALREADY_A_MEMBER` 와 별개 코드"임을 명시. `error-codes.md §3` 등재 시 설계 의도 차이도 명시. |
| W-5 | Plan Coherence | `spec-sync-data-flow-8-notifications-gaps.md` 의 7개 미구현 항목(notify() 단일 표면·이메일 발송 경로·WebSocket emit 등)이 `spec/data-flow/8-notifications.md` 에서 현재형으로 기술됐을 가능성이 있으나 직접 확인 불가(scope 내 파일이나 checker 에 전문 미제공). | `spec/data-flow/8-notifications.md`(추정) | `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`(7건 미체크) | `spec/data-flow/8-notifications.md` 를 직접 열람해 미구현 항목이 현재형으로 기술됐는지 확인한다. 해당 시 "(Planned)" 마커 추가 또는 plan 체크. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Rationale Continuity | 3-tier job priority 임시 편차(현재 2-tier 구현)의 Rationale 부재 — "의도된 임시" inline 주석은 있으나 허용 근거 문서화 없음 | `spec/data-flow/10-triggers.md` §2.2, `spec/5-system/4-execution-engine.md §4` | `10-triggers.md §Rationale` 에 "현재 2-tier 임시 구현 허용 근거(schedule latency tolerance 등)" 항목 추가 |
| I-2 | Rationale Continuity | `@Unique(['ownerId', 'type'])` 제거 번복 기록은 있으나 원래 도입 결정의 Rationale 출처 없어 "번복 vs 오류 정정" 추적 어려움 | `spec/data-flow/12-workspace.md §Rationale` | Rationale 에 "(구 데코레이터는 원래 도입 Rationale 없이 코드로만 존재 — 의미상 부정확한 채로 미적용 상태였음)" 한 줄 추가 |
| I-3 | Rationale Continuity | `spec/data-flow/1-audit.md` Rationale 의 "cross-cutting concern 서술 폐기" 원출처 명시 부재 | `spec/data-flow/1-audit.md §Rationale` | Rationale 에 "과거 서술은 `spec/5-system/1-auth.md §4.1` 감사 커버리지 목표 카탈로그와 혼동된 것" 출처 명시 |
| I-4 | Cross-Spec | `spec/data-flow/0-overview.md` Rationale "S3 key 의 코드/spec 불일치" 설명이 stale — `spec/0-overview.md §2.7` 은 이미 코드와 수렴된 상태(`kb/{kbId}/{docId}/{filename}`)라 기술된 불일치가 더 이상 존재하지 않음 | `spec/data-flow/0-overview.md §Rationale` | "spec/0-overview.md §2.7 와의 불일치는 이미 해소됐다" 명시 또는 stale 비교 문단 제거 |
| I-5 | Plan Coherence | `spec-sync-data-flow-12-workspace-gaps.md` 결정 1~4(워크스페이스 전환·JWT 클레임명·DB UNIQUE·audit 범위) 미확정이나, target spec 은 미결 상태를 그대로 유지 중 — 일방적 결정 우회 없음 | `spec/data-flow/12-workspace.md` §1.5, Rationale | 충돌 없음. 미결정 해소 시 target spec 갱신 필요. |
| I-6 | Naming Collision | `WorkspaceInvitationsPrunerService` vs `WorkspaceInvitationsService` 명칭 유사 — `Pruner` 접미사로 역할 구분 명확, 혼동 위험 낮음 | `spec/data-flow/12-workspace.md` | 추가 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | CRITICAL 2건: `endpointPath` UUID 강제 오선언, `WorkspaceInvitationsPrunerService` 미구현 오선언. WARNING 2건: agent-memory-extraction MONITORED_QUEUES 누락, HNSW 설명 agent_memory 누락 |
| Rationale Continuity | LOW | INFO 3건: 3-tier priority 임시 편차 Rationale 부재, 데코레이터 제거 원출처 부재, audit 폐기 출처 부재 |
| Convention Compliance | LOW | WARNING 2건: lowercase 에러코드 4종 예외 레지스트리 미등재, already_a_member 대소문자 불일치 미명시 |
| Plan Coherence | MEDIUM | WARNING 2건(C-1·C-2 와 중복): W1 미체크(UUID 강제 오기술), W7 미체크(Pruner service 미구현). INFO 2건: 미결 결정 충돌 없음, notifications 미확인 |
| Naming Collision | LOW | WARNING 1건(C-2 와 중복): workspace-invitations-pruner 큐 BullMQ 마스터 카탈로그 미등재. INFO 2건: 명칭 유사성 무해, 기타 식별자 충돌 없음 |

---

## 권장 조치사항

1. **[BLOCK 해소 — C-1]** `spec/data-flow/10-triggers.md` Rationale 의 `@IsUUID('4')` 강제 선언을 코드 사실에 맞게 수정한다. (A) 실제 구현이 없다면 "서버는 UUID 형식을 강제하지 않는다"로 되돌린다. (B) 강제를 구현한다면 `create-trigger.dto.ts`·`update-trigger.dto.ts` 의 `endpointPath` 에 `@IsUUID('4')` 를 실제 추가하고 `spec/5-system/12-webhook.md` WH-MG-02 동기화 후 plan W1 체크.
2. **[BLOCK 해소 — C-2]** `spec/data-flow/12-workspace.md` §1.2·§3.1 의 `WorkspaceInvitationsPrunerService` 기술을 코드 사실에 맞게 정정한다. (A) 구현 완료 시: 서비스 클래스 + BullMQ 큐 등록 코드 추가, `spec/data-flow/0-overview.md §4` 카탈로그 갱신(16→17개), `spec/data-flow/12-workspace.md §4 외부 의존` BullMQ 항목 추가, `MONITORED_QUEUES` 동기화, plan W7 체크. (B) 미구현이면: §1.2·§3.1 을 "미구현" 또는 "(Planned)"으로 되돌린다.
3. **[WARNING 해소 — W-3/W-4]** `spec/conventions/error-codes.md §3` 에 `workspace_type_mismatch`·`already_a_member`·`invitation_already_pending`·`invitation_already_accepted` 4종을 추가 등재한다. `already_a_member` vs `ALREADY_A_MEMBER` 설계 의도 차이를 spec 주석에 명시한다.
4. **[WARNING 해소 — W-1]** `system-status.constants.ts` `MONITORED_QUEUES` 에 `agent-memory-extraction` 큐를 추가하거나, `spec/data-flow/0-overview.md §4` 카탈로그에 "모니터링 제외" 주석을 달아 의도적 제외를 명시한다.
5. **[WARNING 해소 — W-2]** `spec/data-flow/0-overview.md §5` HNSW 항목을 "document_chunk (V022/V030~V033) 및 agent_memory (V074~V079) 모두 차원별 partial index" 로 보완한다.
6. **[WARNING 확인 — W-5]** `spec/data-flow/8-notifications.md` 를 열람해 `spec-sync-data-flow-8-notifications-gaps.md` 의 7개 미구현 항목이 현재형으로 기술됐는지 확인하고, 해당 시 "(Planned)" 마커 추가.
7. **[INFO 개선]** `spec/data-flow/10-triggers.md §Rationale` 에 3-tier priority 임시 편차 허용 근거를 추가하고, `spec/data-flow/0-overview.md §Rationale` S3 key stale 비교 문단을 갱신한다.