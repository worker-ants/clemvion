## 보안 코드 리뷰

### 발견사항

---

**[INFO]** 응답 구조 래핑 변경 (`{ success }` → `{ data: { success } }`)
- 위치: 전체 변경사항 공통
- 상세: 이번 변경의 핵심은 API 응답 구조를 일관되게 `{ data: ... }` 형태로 통일하는 것으로, 보안상 직접적인 영향은 없음
- 제안: 해당 없음

---

**[WARNING]** `continueExecution`에서 `formData`가 `unknown` 타입으로 검증 없이 전달됨
- 위치: `executions.controller.ts:44-46`
- 상세: `body?.formData`가 `unknown` 타입으로 선언되어 있고, 타입 검증이나 스키마 검증 없이 `executionEngineService.continueExecution(id, body?.formData)`로 그대로 전달됨. 이 데이터가 내부에서 어떻게 처리되는지에 따라 인젝션 위험 존재. 또한 `continueExecution` 호출이 `await` 없이 실행되어 오류가 클라이언트에 전달되지 않음
- 제안: `formData`에 대한 DTO 또는 Zod/class-validator 스키마 검증 적용. `await`를 추가하거나 fire-and-forget 의도임을 명시적으로 주석으로 기록

---

**[WARNING]** `testConnection` 에러 메시지가 클라이언트에 그대로 노출됨
- 위치: `llm.service.ts:77-79`
- 상세: `catch` 블록에서 `error.message`를 `{ data: { success: false, error: message } }` 형태로 반환함. 외부 LLM API의 오류 메시지에는 내부 엔드포인트, 인증 실패 세부사항, 스택 정보 등 민감 정보가 포함될 수 있음. 이 값이 프론트엔드(`llm-configs.ts`)까지 그대로 전달됨
- 제안: 에러 메시지를 사용자 친화적인 일반 메시지로 추상화하고, 상세 오류는 서버 로그에만 기록

```typescript
// 현재
return { data: { success: false, error: message } };

// 개선
this.logger.warn(`LLM connection test failed: ${message}`); // 이미 존재
return { data: { success: false, error: 'Connection test failed' } };
```

---

**[WARNING]** OAuth `state` 토큰이 서버에 저장되지 않아 CSRF 방어 불완전
- 위치: `integrations.service.ts:113-138`
- 상세: `state` 값을 생성하여 URL에 포함하지만, 서버 측(DB, 캐시 등)에 저장하지 않음. 콜백 핸들러에서 `state` 값을 검증하지 못하면 CSRF 공격이 가능함. 변경된 코드 범위 밖이지만 응답 구조를 다루는 같은 파일에 위치
- 제안: `state`를 Redis 또는 DB에 TTL과 함께 저장하고, OAuth 콜백에서 반드시 검증

---

**[WARNING]** `process.env` 값이 빈 문자열 fallback으로 OAuth URL에 노출
- 위치: `integrations.service.ts:128-131`
- 상세: `process.env[`${...}_CLIENT_ID`] || ''` 패턴 사용으로, 환경변수가 설정되지 않았을 때 `client_id=` 빈 값으로 OAuth URL이 생성되어 요청이 외부로 전송됨. 설정 누락을 런타임에서 침묵으로 처리함
- 제안: 환경변수 미설정 시 명시적 예외를 던져야 함

```typescript
const clientId = process.env[`${integration.serviceType.toUpperCase()}_CLIENT_ID`];
if (!clientId) {
  throw new Error(`OAuth client ID not configured for ${integration.serviceType}`);
}
```

---

**[INFO]** 프론트엔드의 이중 언래핑 패턴 (`data?.data ?? data`)
- 위치: `llm-configs.ts:67`
- 상세: 응답 구조 불일치를 `data?.data ?? data` 방어 코드로 처리. 이 패턴은 서버/클라이언트 간 계약이 모호함을 나타내며, 향후 응답 구조 변경 시 타입 불일치를 런타임까지 감지하지 못할 위험 존재
- 제안: 응답 타입을 명확히 정의하고, API 인터셉터 레벨에서 일관되게 언래핑하거나 타입을 `{ data: { success: boolean; error?: string } }`으로 명시

---

### 요약

이번 변경사항은 API 응답 구조를 `{ data: ... }` 형태로 통일하는 리팩터링으로, 변경 자체로 인한 신규 보안 취약점은 없습니다. 다만 코드 전반에 걸쳐 기존부터 존재하던 보안 우려사항이 확인됩니다: LLM 연결 테스트 실패 시 외부 서비스 오류 메시지가 클라이언트에 그대로 노출되는 정보 유출 위험, OAuth `state` 토큰이 서버에 저장되지 않아 CSRF 방어가 불완전한 문제, 환경변수 미설정 시 빈 값으로 OAuth 요청이 전송되는 설정 오류 무시 문제, 그리고 `formData`의 타입 검증 부재가 주요 개선 대상입니다.

### 위험도

**MEDIUM**