# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/4-nodes/4-integration)
검토 대상: spec/4-nodes/4-integration (0-common.md, 1-http-request.md, 2-database-query.md, 3-send-email.md, 4-cafe24.md 포함)

---

## 발견사항

### [INFO] spec-sync-integration-common-gaps.md 의 미해결 "Missing integration 배지" 결정이 target 에 미반영

- target 위치: `spec/4-nodes/4-integration/0-common.md §5` — "계획 (미구현): Integration 노드에서 연결된 Integration이 삭제된 경우 `⚠ Missing integration` (앰버색) 배지 표시"
- 관련 plan: `plan/in-progress/spec-sync-integration-common-gaps.md` — 옵션 A/B/C/D 4개가 제시되어 있고 "권장안 — 옵션 A" 로 기울었으나 **사용자 공식 결정이 없음** (체크박스 미해소). "결정 옵션 (2026-06-13)" 섹션에 "[ ] §5 ⚠ Missing integration 배지 (티어3, 아키텍처 결정)" 미완료 상태.
- 상세: target spec 은 배지를 "계획 (미구현)" 으로 표기만 했을 뿐, 어느 구현 경로(A/B/C/D)를 채택할지 spec 에 명시되지 않은 채 plan 에 개방되어 있다. 구현 착수 시 이 항목은 spec 본문을 아직 확정하지 않은 상태라 구현 방향이 불명확하다.
- 제안: plan `spec-sync-integration-common-gaps.md` 에서 옵션을 사용자와 확정 후 `spec/4-nodes/4-integration/0-common.md §5` 에 채택 방식을 명문화. 구현 착수는 그 이후. (단, 0-common 의 나머지 내용 구현에 본 배지 항목이 선행 필요는 아님 — 독립 항목)

---

### [INFO] node-output-redesign/http-request.md 의 P3 미이행 항목이 target 과 공존

- target 위치: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` — `output.response: { error: "ECONNREFUSED" }` 가 transport 실패 케이스의 공식 예시로 남아 있음; 하단 필드 설명에 "**Deprecated (legacy 호환 잔재)**" 로 표기됨
- 관련 plan: `plan/in-progress/node-output-redesign/http-request.md` §"종합 개선안" — `[ ]` (spec) `1-http-request.md §5.3.2 JSON 예시에서 output.response.error 줄 제거` 및 `[ ]` (impl) transport 실패 분기 output.response legacy 제거 가 미완료 체크박스로 존재. 인덱스 `node-output-redesign/README.md` 의 Phase E P3 에도 동일 항목 잔여.
- 상세: target spec 에 deprecated 필드가 공식 JSON 예시에 포함된 채 구현 착수하면, 구현자가 이를 유지해야 하는지 제거해야 하는지 혼선이 생길 수 있다. plan 은 이 항목이 별도 PR 대상임을 명시했으므로 본 구현 범위에는 포함되지 않는다는 점을 확인하는 차원의 추적 메모.
- 제안: 구현 착수 시 이 `output.response: { error }` legacy 필드는 "현재 spec 이 deprecated 표기는 했으나 제거 PR 미착수" 상태임을 구현자가 인지하면 충분. 본 구현(impl-prep)에서 새로 이 필드를 만들거나 의존해서는 안 됨.

---

### [INFO] node-output-redesign 의 Cafe24/MakeShop 관련 미완료 spec 항목이 target 범위에 걸림

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` (prompt 에 포함; MakeShop `5-makeshop.md` 도 `0-common.md §7` 에서 참조됨)
- 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` (P2) — Cafe24 §1 pagination `cursor?: string` spec 잔재 정정이 미완료 체크박스. `node-output-redesign/README.md` Phase E P2 에 "Cafe24 §1 pagination `cursor?: string` spec 정정" 잔여.
- 상세: target spec 에 pagination cursor 폐기 잔재가 있다면 구현 착수 시 혼선이 있을 수 있으나, 이는 spec 본문 정정(planner 영역) 미완료 항목으로 구현 착수를 차단하는 선행 조건은 아님. 단, 구현자가 cursor 필드를 구현 범위에 포함시키면 안 된다.
- 제안: Cafe24 구현 착수 전 pagination cursor 관련 spec 정정 PR 이 완료되었는지 확인 권장. 미완료면 cursor 필드는 "spec 정정 대기 중" 으로 구현 제외 처리.

---

### [INFO] http-ssrf-all-auth-followups.md 의 미완료 항목 중 일부가 target spec 에 영향

- target 위치: `spec/4-nodes/4-integration/1-http-request.md §4` (SSRF 가드 전 인증 방식 공통 적용), `0-common.md §4.1 step 8` 맥락
- 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` — `[ ]` SSRF 에러 메시지 클라이언트 일반화(http-safety.ts 의 `SSRF_BLOCKED: hostname "..."` 메시지가 차단 host/IP 를 노출하는 정찰 면) 미완료. `[ ]` `0-overview §6.1·mcp-client §3.2·4-execution-engine §10` SSRF 전 인증 공통/meta.durationMs 동기화 보류.
- 상세: SSRF 메시지 일반화 항목은 target spec 에서 "클라이언트 노출 메시지는 차단 host/IP 를 포함하지 않는 일반화 문구" (`spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드` 참조) 로 이미 spec 에 반영되어 있으나, http-request 의 `http-safety.ts` 구현 메시지 일반화가 미완료인 상태. spec 과 구현 간 갭.
- 제안: 구현 착수 시 SSRF 에러 메시지가 host/IP 를 포함하지 않는지 확인 필요. `http-ssrf-all-auth-followups.md` 의 해당 항목이 선행 완료되어야 target spec 의 "일반화 문구" 약속이 구현에서 충족됨.

---

## 요약

Plan 정합성 관점에서 `spec/4-nodes/4-integration` 는 전반적으로 정합하다. 가장 중요한 미해결 항목은 `spec-sync-integration-common-gaps.md` 의 "Missing integration 배지" 구현 방식 결정으로, 이는 사용자 공식 결정이 없는 상태이나 배지 항목은 다른 Integration 노드 기능 구현과 독립적이라 차단 요인은 아니다. 나머지 발견사항(HTTP transport legacy 잔재, Cafe24 cursor 잔재, SSRF 메시지 일반화)은 모두 현재 진행 중인 별도 plan 에서 추적 중이며 본 구현 착수를 직접 차단하는 미해결 결정과의 충돌은 없다. target spec 이 plan 에서 "결정 필요" 로 남겨둔 항목을 일방적으로 결정하는 경우는 발견되지 않았다.

## 위험도

LOW
