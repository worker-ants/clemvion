# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target 범위: `spec/5-system/` (전체 파일)

---

## 발견사항

### [INFO] 1-auth.md §1.3 LDAP/SAML — pending_plans 정상 연결됨

- target 위치: `spec/5-system/1-auth.md` §1.3, frontmatter `pending_plans`
- 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
- 상세: §1.3 은 LDAP/SAML 을 미구현·Planned 로 명시하고 있으며, plan 도 해당 항목만 open 상태로 일치. 충돌 없음.
- 제안: 없음 (정상 연결).

---

### [WARNING] spec-code-cross-audit 잔여 위반 V-09 — auth §1.5.3 초대 수락 자동화 결정 미확정

- target 위치: `spec/5-system/1-auth.md` §1.5.3 (이미 가입한 사용자의 초대 수락 흐름 — GET 토큰 메타 → [수락] 버튼 → 이메일 불일치 시 로그아웃 UI)
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-09 (잔여 미해결 항목)
- 상세: `spec-code-cross-audit` plan 이 V-09 (초대 수락 자동수락 vs spec 확인 단계) 를 major 미결 위반으로 기재하고 있다. 코드(`accept-invitation-content.tsx`)가 마운트 즉시 `acceptInvitation` 을 자동 호출하는 반면 spec §1.5.3 은 GET 메타 → [수락] 버튼 → 이메일 불일치 로그아웃 UI 흐름을 규정한다. "코드 구현 vs spec 하향" 결정이 아직 내려지지 않은 상태다. 구현자가 spec 을 읽으면 [수락] 버튼 UI 흐름을 구현해야 한다고 판단할 수 있으나 실제 코드는 이미 반대 방향으로 동작 중이다.
- 제안: 구현 착수 전 `spec-code-cross-audit-2026-06-10.md` §V-09 의 결정을 먼저 내린 후 spec 또는 코드를 정합화할 것.

---

### [WARNING] spec-code-cross-audit 잔여 위반 V-14 — 13-replay-rerun §10.2 Re-run 모달 결정 미확정

- target 위치: `spec/5-system/13-replay-rerun.md` §10.2 (Re-run 모달 — 원본 ID 링크 + typed 동적 폼)
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-14 (잔여 미해결 항목)
- 상세: §10.2 가 원본 실행 ID 를 새 탭 링크로, manual_trigger 스키마 기반 typed 폼을 명시하고 있으나 코드는 ID 를 링크 없는 `<span>` 으로, 폼을 텍스트 Input 으로 렌더 중이다. "코드 구현 vs spec 하향" 결정이 pending 상태이다. spec 을 읽고 구현에 착수하면 불필요한 typed 폼 구현을 시작할 수 있다.
- 제안: V-14 결정 확정 후 target spec 혹은 코드를 정합화할 것. spec 본문에 "V-14 결정 대기" 단서 추가를 권장.

---

### [WARNING] http-ssrf-all-auth-followups — mcp-client §3.2, 4-execution-engine §10 SSRF 동기화 항목 보류 중

- target 위치: `spec/5-system/11-mcp-client.md` §3.2, `spec/5-system/4-execution-engine.md` §10
- 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` Spec 항목 "0-overview §6.1·mcp-client §3.2·4-execution-engine §10 동기화" — 보류 상태 (open checkbox)
- 상세: SSRF 전 인증 공통/`meta.durationMs` 동기화가 "별도 cross-spec 동기화 항목, 그룹2a 범위 밖" 으로 보류 중이다. 구현자가 `11-mcp-client.md` §3.2 또는 `4-execution-engine.md` §10 을 읽을 경우 SSRF 인증 처리 서술이 최신 구현과 다를 수 있어 혼동이 생긴다.
- 제안: 구현 착수 전 해당 보류 항목을 spec 에 반영하거나, spec 본문에 "SSRF 전 인증 동기화 예정" 단서를 추가할 것.

---

### [WARNING] spec-sync-structural-followups — console.warn 처방 stale (14-external-interaction-api.md)

- target 위치: `spec/5-system/14-external-interaction-api.md` (≈ L1108) — "HTTP 오류 시 console.warn 후 진행" 처방
- 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` §"console.warn 처방 stale 정정 (refactor 03 m-1 후속, 2026-06-26)" — open checkbox
- 상세: 코드는 이미 NestJS Logger 를 사용하나 spec 본문은 `console.warn(...)` 을 처방해 구현자가 `console.warn` 을 찾거나 작성하도록 오도할 수 있다. `data-flow/1-audit.md` 는 동일 plan 에서 완료됐으나 `14-external-interaction-api.md` 는 여전히 open.
- 제안: spec `14-external-interaction-api.md` 의 `console.warn` 처방을 `logger.warn` 또는 방법론 중립 표현으로 갱신하는 작업을 완료할 것 (plan 의 open 체크박스 처리).

---

### [INFO] spec-sync-mcp-client-gaps — 11-mcp-client.md §3.3 캐시 선행 조건 미해소 명시

- target 위치: `spec/5-system/11-mcp-client.md` §3.3 (capability 캐시 — "보류 (infra)")
- 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md`
- 상세: spec 본문은 §3.3 을 Planned(캐시는 hint, 실행 시 재조회)로 표기하고 있으며, plan 도 "Integration 엔티티 credentials JSONB 구조 변경 + preview test 저장 경로" 가 선행 조건(infra)으로 미해소임을 명시 중이다. 정합하나 선행 조건 미완료를 인지해야 한다.
- 제안: §3.3 캐시 구현 착수 전 Integration 엔티티 선행 변경이 완료됐는지 확인할 것.

---

### [INFO] ai-context-memory-followup-v2 — 17-agent-memory.md watermark 경로 정정 미완

- target 위치: `spec/5-system/17-agent-memory.md` (및 연계 `3-information-extractor.md`)
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` §"Batch 2 후속 — 별건 spec PR" — open (watermark 참조 `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq` 정정 미완)
- 상세: Batch 2 구현 이후 코드는 `memoryState.lastExtractionTurnSeq` 네임스페이스를 사용하지만, spec 에는 아직 구 경로(`lastExtractionTurnSeq`)가 남아 있을 수 있다. 이 정정이 `17-agent-memory.md` 의 AGM-08 canonical 항목과도 맞는지 착수 전 확인이 필요하다.
- 제안: `17-agent-memory.md` 참조 경로가 Batch 2 이후 코드와 일치하는지 착수 전 확인할 것.

---

### [INFO] rag-dynamic-cut / rag-rerank-followup — 9-rag-search.md 후속 plan 정상 연결

- target 위치: `spec/5-system/9-rag-search.md` frontmatter `pending_plans`
- 관련 plan: `plan/in-progress/rag-dynamic-cut.md`, `plan/in-progress/rag-rerank-followup.md`
- 상세: 두 plan 모두 in-progress 폴더에 존재하며, spec 은 해당 항목을 Planned 로 표기 중이다. 정합.
- 제안: 없음.

---

### [INFO] spec-code-cross-audit 잔여 위반 V-04, V-05, V-10, V-12, V-13, V-18 — spec/5-system 범위 밖

- target 위치: 해당 위반은 `spec/2-navigation`, `spec/3-workflow-editor`, `spec/7-channel-web-chat` 등 `spec/5-system/` 외부 영역에 속함
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §잔여 V-04·V-05·V-10·V-12·V-13·V-18
- 상세: `spec/5-system/` 구현 착수에는 직접 영향이 없으나, 미결 결정이 많은 cross-audit plan 이 존재함을 인지.
- 제안: 없음 (`spec/5-system/` 범위 밖).

---

## 요약

`spec/5-system/` 전체에서 CRITICAL(미해결 결정 우회) 수준의 정합성 문제는 발견되지 않았다. 주요 우려는 두 가지다. 첫째, `spec-code-cross-audit-2026-06-10.md` 의 잔여 위반 V-09(auth §1.5.3 초대 수락 자동화)와 V-14(13-replay-rerun §10.2 Re-run 모달)가 "코드 구현 vs spec 하향" 결정 미확정 상태에서 spec 이 그대로 남아 있어, 구현자가 spec 을 읽으면 현재 코드 방향과 다른 구현에 착수할 위험이 있다(WARNING). 둘째, `http-ssrf-all-auth-followups.md` 의 SSRF 전 인증 동기화(11-mcp-client §3.2, 4-execution-engine §10) 가 보류 상태이며 spec 과 코드 사이 서술 불일치가 잠재하고 있다(WARNING). 추가로 `14-external-interaction-api.md` 의 `console.warn` stale 처방 정정이 plan 에서 open 상태로 남아 있어 구현자 혼동 소지가 있다(WARNING). 나머지 항목은 INFO 수준으로 plan-spec 연결은 전반적으로 정합하다.

## 위험도

MEDIUM
