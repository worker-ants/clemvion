# Plan 정합성 검토 결과

검토 모드: --impl-done (scope: spec/2-navigation/4-integration.md, diff-base: origin/main)
맥락: PR #633 신규 후속 plan `plan/in-progress/integration-mcp-usage-followups.md` (⑤GIN인덱스 ⑥삭제다이얼로그 ⑦remove이중조회)

---

## 발견사항

### [WARNING] ⑥ 삭제 차단 다이얼로그 — spec 기재 요구사항이 구현 미완임을 후속 plan 이 추적하나, spec 상태(status: implemented)와 불일치

- target 위치: `plan/in-progress/integration-mcp-usage-followups.md` §⑥
- 관련 plan / spec: `plan/in-progress/spec-draft-integration-mcp-usage.md` edit D + `spec/2-navigation/4-integration.md` §4.7·§7.2
- 상세:
  - spec `spec/2-navigation/4-integration.md` 의 frontmatter 는 `status: implemented` 이며, §4.7("클릭 시 `GET /api/integrations/:id/usages` 확인 → 사용처 ≥ 1건: 차단 다이얼로그에 사용처 목록 표시")과 §7.2("다이얼로그의 MCP 노드 행도 `MCP` 배지로 구분 표시")가 모두 명시돼 있다.
  - 그러나 PR #633 구현은 삭제 `onError` 에서 toast 만 표시하며 사용처 목록 다이얼로그는 구현되지 않았다. 이 갭은 target plan ⑥ 에서 "기존부터 존재한 갭"으로 인식하고 후속 작업으로 분류했다.
  - 문제는 spec frontmatter 가 `status: implemented` 인데 §4.7·§7.2 의 삭제 차단 다이얼로그(사용처 목록 렌더) 요구사항이 미구현 상태라는 점이다. spec-impl 불일치가 후속 plan ⑥ 이 해소될 때까지 지속된다.
- 제안: `plan/in-progress/integration-mcp-usage-followups.md` ⑥ 에 "본 항목이 완료될 때까지 spec frontmatter `status` 를 `partial` 로 격하하거나, 미구현 사실을 spec §4.7·§7.2 에 `(미구현 — integration-mcp-usage-followups.md ⑥)` 주석으로 명시할 것"을 추가. 또는 spec frontmatter 에 `pending_plans: [integration-mcp-usage-followups.md]` 를 추가해 미완 추적.

---

### [INFO] ⑤ GIN 인덱스 — spec Rationale 에 "@> 는 GIN 인덱스를 탈 수 있다" 고 기술됐으나 마이그레이션 후속이 plan 에만 추적됨

- target 위치: `plan/in-progress/integration-mcp-usage-followups.md` §⑤
- 관련 plan / spec: `spec/2-navigation/4-integration.md` Rationale §"사용처 추적 — AI Agent MCP 참조 포함" + `plan/in-progress/spec-draft-integration-mcp-usage.md` Side-effect 절
- 상세:
  - spec Rationale 은 "`@>` 는 GIN 인덱스를 탈 수 있어 워크플로우 수 증가에도 확장 가능하다" 고 기술한다. 이것은 GIN 인덱스가 권장됨을 암시하지만 필수(normative) 표기는 아니다.
  - target plan ⑤ 는 "권장" 수준 후속으로 분류하고 있고, spec-draft 의 Side-effect 절에서도 "GIN 인덱스는 성능 옵션, 기능 전제 아님" 으로 명시했다.
  - 충돌 없음. 다만 plan ⑤ 가 이행될 때 `background-context-key-followups.md` 의 "V080a/b `CREATE INDEX CONCURRENTLY` 분리" 패턴 (ai-context-memory-followup-v2.md 참조) 과 동일한 TypeORM `executeInTransaction=false` 처리가 필요하다 — 이 주의사항이 target plan ⑤ 에 이미 기재돼 있어 누락은 없다.
- 제안: 현재 추적 충분. 별도 조치 불요. 착수 시 CONCURRENTLY 처리 주의사항은 plan ⑤ 에 이미 명시됨.

---

### [INFO] ⑦ `remove()` 이중 findById — `ai-agent-tool-connection-rewrite.md` 미해결 결정과 무관함 확인

- target 위치: `plan/in-progress/integration-mcp-usage-followups.md` §⑦
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 결정 기록 (TBD)
- 상세:
  - `ai-agent-tool-connection-rewrite.md` 는 MCP 도구(`mcp_*`)를 "영향받지 않는 정상 도구"로 명시하며, 미해결 결정은 일반 도구(`tool_*`) 등록 모델·시그니처 위치·호출 컨텍스트·결과 라우팅 등이다. 이 미결 결정들은 `remove()` 의 `getUsages()` 내부 이중 쿼리와 무관하다.
  - target plan ⑦ 의 "외부 API 계약(컨트롤러가 호출하는 `getUsages`) 은 유지" 선언은 `ai-agent-tool-connection-rewrite.md` 의 미결 결정과 충돌하지 않는다.
- 제안: 충돌 없음. 추적 메모 불요.

---

### [INFO] spec §4.7 사전 조회 방식 — target plan ⑥ 구현 방향이 spec 과 일치

- target 위치: `plan/in-progress/integration-mcp-usage-followups.md` §⑥ 후속 작업 기술
- 관련 spec: `spec/2-navigation/4-integration.md` §4.7
- 상세:
  - spec §4.7 은 "클릭 시 `GET /api/integrations/:id/usages` 를 확인하여" 라고 **사전 조회** 방식을 명시한다. target plan ⑥ 의 후속 작업도 "DangerTab 에서 `GET /api/integrations/:id/usages` 사전 조회 → 차단 시 사용처 목록 다이얼로그 렌더" 로 정확히 일치한다.
  - 결정 충돌 없음.

---

## 요약

Plan 정합성 관점에서 CRITICAL 발견사항은 없다. 가장 유의해야 할 항목은 WARNING 1건으로, spec `spec/2-navigation/4-integration.md` 가 `status: implemented` 인 상태에서 §4.7·§7.2 의 삭제 차단 다이얼로그(사용처 목록 렌더 + MCP 배지) 요구사항이 미구현 상태로 남아 후속 plan ⑥ 에 위임됐다는 점이다. 이는 target plan 이 미해결 결정을 **일방적으로 우회**한 것이 아니라 기존부터 존재하던 spec-impl 갭을 인식·추적한 것이나, spec frontmatter 의 `status: implemented` 가 실제 구현 상태를 오표할 수 있어 `pending_plans` 등재 또는 `partial` 격하로 추적을 명시화할 필요가 있다. 나머지 항목(⑤⑦)은 기존 in-progress plan 의 미해결 결정과 충돌하지 않으며 선행 plan 미해소 문제도 없다.

## 위험도

LOW

STATUS: DONE
