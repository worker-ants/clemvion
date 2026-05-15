### 발견사항

**[INFO] 프롬프트 인젝션 표면 — `truncateReviewOriginalRequest` (기존 코드, diff 외)**
- 위치: `stream.service.ts`, `truncateReviewOriginalRequest()` + `evaluateReviewGuard()` 내 `originalRequest: truncateReviewOriginalRequest(originalRequest)`
- 상세: 사용자 원문(`dto.content`)을 200자로 자른 뒤 `WORKFLOW_REVIEW_REQUIRED` tool result에 그대로 삽입하여 LLM에게 재주입한다. 코드 주석도 "프롬프트 인젝션 표면이 된다"고 명시하고 있으나, 완화 수단이 길이 제한뿐이다. 공격자가 메시지 앞 200자를 LLM 지시문으로 구성하면 review guard 발동 시 해당 지시가 LLM context에 삽입된다.
- 제안: 인젝션 리스크를 완전히 제거하려면 이 필드를 제거하거나, `planTitle` 같은 서버 내부값으로 대체하는 것이 이상적이다. 현재 구조 유지 시에는 `<`, `>`, backtick, XML 제어 패턴 등 LLM 제어 토큰을 strip하는 sanitizer를 추가해야 한다.

---

**[INFO] `planForTurn.approvedAt` 우회 가능성 분석 (변경된 guard 로직)**
- 위치: `stream.service.ts` diff, `planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt`
- 상세: `planForTurn`은 LLM의 `propose_plan` 호출 결과를 `buildPlanFromArgs()`로 파싱하여 생성된다. `buildPlanFromArgs`는 `approvedAt` 필드를 명시적으로 매핑하지 않으므로, LLM이 arguments에 `approvedAt`을 포함시켜도 반영되지 않는다 — guard 우회 불가.
- 상세: `approvedAt`이 세팅된 plan은 history에서 load된 경우뿐이며, 해당 경우 `planForTurn === null`이라 가드 자체가 발동하지 않는다. 로직 일관성 확인됨.
- 제안: 이슈 없음. 다만 `AssistantPlanRecord` 타입에 `approvedAt`이 추가될 경우 `buildPlanFromArgs`에서 명시적으로 제외하는 주석/lint 규칙을 유지할 것.

---

**[INFO] 리소스 고갈 방어 (변경 사항의 보안 효과)**
- 위치: `stream.service.ts` diff, `shouldContinueLoop` 앞의 신규 guard
- 상세: `MAX_TOOL_LOOP_ROUNDS(50)` 도달 전에 plan-only 턴을 강제 종료하여 LLM 핑퐁 루프에 의한 연산 낭비 및 비용 폭주를 차단하는 방어적 변경이다. 기존 DoS 벡터 제거.

---

**[INFO] 테스트 픽스처 식별자**
- 위치: `spec.ts` 전반 (`'sess-1'`, `'ws-1'`, `'u-1'`, `'gpt-4o'`)
- 상세: 하드코딩된 값들은 실제 credential이 아닌 테스트 픽스처이다. 실제 API 키·토큰 누출 없음.

---

### 요약

이번 diff의 핵심 변경(plan-only 턴 강제 종료 guard)은 보안 관점에서 **방어적 개선**에 해당한다. `planProposedPendingApproval` 가드는 LLM 인수로 `approvedAt`을 주입하여 우회하는 경로가 차단되어 있고, 리소스 고갈(MAX_TOOL_LOOP_ROUNDS) 방어도 강화되었다. 주목할 기존 취약점은 `evaluateReviewGuard`에서 사용자 원문을 LLM tool result에 truncation만으로 재삽입하는 prompt injection 표면이며, 이는 이번 diff와 무관하게 사전 존재하는 위험이다. 새로 도입된 코드에서 인증 우회, SQL 인젝션, 하드코딩 시크릿, XSS 등의 신규 취약점은 발견되지 않았다.

### 위험도

**LOW** (변경 자체는 보안 개선; 기존 prompt injection 표면은 영향도 제한적)