### 발견사항

---

**[WARNING] `integrationServiceType` 미검증 enum 필터 통과**
- 위치: `candidate-lookup.service.ts` – `lookupIntegrations()`, `detect-pending-user-config.ts` – `detectPendingUserConfig()`
- 상세: `integrationServiceType` 는 노드 스키마의 `propSchema.integrationServiceType` 를 그대로 읽어 `IntegrationsService.findAll()` 의 `serviceType` 필터 배열로 전달된다. 현재는 `'email'` / `'http'` / `'database'` 로 하드코딩된 서버 스키마에서만 유입되지만, 향후 커스텀 노드 지원 시 임의 문자열이 DB 쿼리 파라미터로 직결될 수 있다. TypeORM 파라미터 바인딩이 SQL 인젝션은 막지만, `serviceType IN ('arbitrary_type')` 으로 의도치 않은 Integration 집합이 노출될 수 있다.
- 제안: `lookupIntegrations()` 입구에서 허용 값 집합(`Set<string>`)으로 화이트리스트 검증하거나, `serviceType` 을 별도 enum 타입으로 선언해 정적 타입 체계로 강제할 것.

```typescript
const ALLOWED_SERVICE_TYPES = new Set(['email', 'http', 'database']);
if (serviceType && !ALLOWED_SERVICE_TYPES.has(serviceType)) {
  this.logger.warn(`Unknown serviceType hint: ${serviceType}`);
  serviceType = undefined;
}
```

---

**[WARNING] `CandidatePicker` – `settingsHref` 미검증 href 삽입**
- 위치: `candidate-picker.tsx` – `<a href={settingsHref}>` (line ~100)
- 상세: `settingsHref` prop은 `string | undefined` 로 선언되고 컴포넌트 내부에서 아무 검증 없이 `<a href>` 에 직접 삽입된다. 현재 호출 측(`assistant-message.tsx`)이 `SETTINGS_HREF` 테이블(상대 경로 고정)만 전달하므로 실제 위험은 없지만, 컴포넌트 자체가 `javascript:` URI 또는 외부 절대 URL을 막지 않아 미래 호출자나 테스트 경로에서 Open Redirect / XSS 진입점이 될 수 있다.
- 제안: 컴포넌트 내부에서 `href` 를 허용하기 전 `/` 시작 여부만 체크하는 guard를 추가할 것.

```tsx
const safeHref =
  settingsHref && settingsHref.startsWith('/') ? settingsHref : undefined;
```

---

**[WARNING] `updateNodeConfigField` – 동적 키를 통한 Prototype Pollution 가능성**
- 위치: `editor-store.ts` – `updateNodeConfigField()` (line ~480)
- 상세: `fieldPath` 를 `{ ...prevConfig, [fieldPath]: value }` 객체 스프레드의 동적 키로 사용한다. `fieldPath` 는 서버의 `PendingUserConfigField.field` 에서 유래하며 현재는 신뢰할 수 있는 서버 스키마 키다. 그러나 SSE 스트림 파싱 경로(`assistant.ts` – `parseSseRecord`)에 타입 캐스팅(`as AssistantSseEvent`)만 있을 뿐 런타임 검증이 없어, 악의적 SSE 응답이 `__proto__` 나 `constructor` 를 `fieldPath` 로 전달할 경우 React 상태 트리에 Prototype Pollution이 발생할 수 있다.
- 제안: `updateNodeConfigField` 입구에서 `__proto__`, `constructor`, `prototype` 을 포함하는 키를 거부하거나, `Object.create(null)` 을 사용해 프로토타입 없는 config 객체를 생성할 것.

```typescript
if (['__proto__', 'constructor', 'prototype'].includes(fieldPath)) return;
```

---

**[WARNING] Candidate ID·Name이 LLM 컨텍스트에 직접 노출**
- 위치: `workflow-assistant-stream.service.ts` – `collectPendingUserConfigWithCandidates()`, `evaluateReviewGuard()`
- 상세: 채워진 `candidates` 배열(워크스페이스 내 실제 리소스 ID·이름 포함)이 tool_result 로 LLM 대화 히스토리에 저장된다. 시스템 프롬프트는 "candidates를 UI-only로 취급하라"고 지시하지만, LLM이 지시를 무시하고 candidate ID를 다음 tool 호출 인자로 복사·삽입할 수 있다 (Prompt Injection 위험). 특히 히스토리가 DB에 영속화되면 이 ID들이 장기간 저장된다.
- 제안: 대화 히스토리 저장 전 `candidates` 필드를 제거하거나 개수만 남기고(`candidateCount: 2`), 프런트 렌더용 SSE 이벤트와 LLM 피드백용 tool_result 를 분리할 것. 최소한 시스템 프롬프트에 "candidates 배열의 id를 tool 인자에 절대 재사용 금지" 경고를 명시적으로 보강할 것.

---

**[INFO] `CandidateLookupService` – workspaceId 인가 검증 없음**
- 위치: `candidate-lookup.service.ts` – `fillCandidates()` 시그니처
- 상세: `workspaceId` 파라미터를 그대로 하위 서비스에 전달하고, 서비스 레이어 자체에는 "호출자가 이 workspace에 접근 권한이 있는지" 재검증이 없다. 현재는 컨트롤러/미들웨어에서 인증된 workspace 컨텍스트가 주입되는 것으로 신뢰하지만, 인가 로직이 서비스 레이어가 아닌 상위 레이어에만 집중되어 있어 내부 호출 경로 추가 시 우회될 수 있다.
- 제안: 주석 또는 가드 코드로 "workspaceId는 반드시 인증된 사용자 컨텍스트에서 주입되어야 함"을 명시하거나, NestJS `REQUEST` 스코프로 workspace 컨텍스트를 주입받아 검증하는 패턴을 고려할 것.

---

**[INFO] 에러 로그에서 내부 상세 노출 가능성**
- 위치: `candidate-lookup.service.ts` – `lookup()` catch 블록
- 상세: `err.message` 를 `warn` 레벨로 로깅한다. DB 연결 오류나 ORM 오류 메시지에 테이블명·쿼리 구조가 포함될 경우 로그 집계 시스템(ELK 등)에서 내부 스키마가 노출될 수 있다. 프런트엔드로는 노출되지 않으므로 실제 공격면은 제한적이다.
- 제안: 로그 레벨 유지는 적절하나, 프로덕션 환경에서는 `err.message` 대신 에러 코드(예: `err.code`)만 기록하도록 필터를 검토할 것.

---

### 요약

이번 변경(ED-AI-39 Candidate Picker)은 새로운 외부 공격면(인증되지 않은 엔드포인트, 암호화 우회 등)을 도입하지 않는다. 주요 위험은 세 가지로 집약된다: `integrationServiceType` 이 런타임 enum 검증 없이 DB 필터로 직결되는 점, Candidate ID가 LLM 대화 히스토리에 영속화됨으로써 LLM 명령 일탈 시 워크스페이스 리소스 정보가 다음 tool 인자로 재사용될 수 있다는 Prompt Injection 위험, 그리고 `updateNodeConfigField` 의 동적 키 삽입 경로가 현재는 서버 스키마로 제한되지만 Prototype Pollution 잠재 경로를 열어두고 있다는 점이다. 인가 모델 자체는 기존 미들웨어를 신뢰하는 구조로 유지되고 있어 심각한 인가 우회는 확인되지 않는다.

### 위험도

**MEDIUM**