## 발견사항

### **[WARNING]** 프론트엔드 `STALL_MAX_ATTEMPTS` 상수가 백엔드 `MAX_STALL_ROUNDS`를 하드코딩으로 복제
- **위치:** `frontend/src/lib/stores/assistant-store.ts:64` (`const STALL_MAX_ATTEMPTS = 2`)
- **상세:** rehydrate 시 `hydrateMessage`가 `STALL_MAX_ATTEMPTS`를 `max` 값으로 사용한다. 실시간 스트리밍에서는 SSE `auto_resume.data.max`로 올바르게 전달되지만, 세션 재접속 시에는 이 상수만 의존한다. 백엔드에서 `MAX_STALL_ROUNDS`를 변경하고 프론트엔드 배포가 지연되면 "1/2", "2/2" 진행도 표기가 실제와 달라진다.
- **제안:** `autoResumeAttempt`와 함께 `autoResumeMax`도 DB에 persist하거나, 최소한 두 값이 반드시 동기화되어야 함을 migration 주석이 아닌 체크리스트 외에도 컴파일 타임에서 강제할 방법을 검토.

---

### **[WARNING]** `autoResumeReason` 타입 캐스트가 silent fail 위험 내포
- **위치:** `frontend/src/lib/stores/assistant-store.ts:155` (`msg.autoResumeReason as "stall_pending_steps"`)
- **상세:** DB는 `VARCHAR(40)`로 임의 문자열을 저장할 수 있지만 프론트는 단순 `as` 캐스트로 리터럴 타입으로 강제한다. 향후 새 `reason` 값이 추가될 때 TypeScript 컴파일러가 경고를 주지 않아 렌더 시 타입 불일치가 런타임에만 발견된다.
- **제안:** `const VALID_RESUME_REASONS = ['stall_pending_steps'] as const;`로 검증 후 캐스트하거나, `autoResumeReason`의 타입을 `string | null`로 유지하고 `autoResume.reason`을 `string`으로 완화하는 것이 더 안전.

---

### **[WARNING]** 에러 경로에서 `assistantId`(원본)와 `currentAssistantId`(갱신값) 불일치
- **위치:** `frontend/src/lib/stores/assistant-store.ts:358` (catch 블록 `m.id === assistantId`)
- **상세:** stall 복구가 1회 이상 발생한 뒤 에러가 나면, `currentAssistantId`는 새 버블 ID로 교체되어 있지만 catch 블록은 원본 `assistantId`를 기준으로 `streaming: false`를 설정한다. 원본 버블은 이미 `applyAutoResumeEvent`에서 확정되었으므로 이 set은 no-op이고, 새 버블은 streaming 상태로 남는다. 이후 안전망(`m.streaming ? { ...m, streaming: false } : m`)이 처리하긴 하지만, catch 블록의 의도와 실제 동작이 어긋난다.
- **제안:** `currentAssistantId`를 catch 블록 스코프에서 접근 가능하도록 `try` 바깥으로 선언, 또는 catch 내 cleanup도 `m.streaming` 전체 스캔으로 통일.

---

### **[INFO]** `autoResumed` REST 응답 필드의 옵셔널 타입 선언 불일치
- **위치:** `frontend/src/lib/api/assistant.ts:33` (`autoResumed?: boolean`)
- **상세:** DB 컬럼은 `NOT NULL DEFAULT FALSE`이므로 서버 응답에서 항상 존재한다. 그러나 프론트 타입은 `?` (optional)로 선언되어, API를 소비하는 다른 컨슈머가 실제로 nullable이라고 오해할 수 있다. `hydrateMessage`의 `msg.autoResumed && msg.autoResumeReason` 가드는 `undefined` 케이스를 방어하므로 기능상 문제는 없다.
- **제안:** `autoResumed: boolean`으로 non-optional 선언을 권장. 하위 호환성을 위해 `?` 유지 시 주석으로 "서버는 항상 전달" 명시.

---

### **[INFO]** `finishReason = 'auto_resume_pending'` 신규 마커 값이 API 스키마에 미반영
- **위치:** `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (stall 복구 블록)
- **상세:** 기존 `finishReason`은 `'stop'` | `'tool_calls'` | `'error'` | `null` 범위로 소비자가 이해하고 있을 수 있다. 새 `'auto_resume_pending'` 값은 spec §6.0에 문서화되었지만, TypeORM entity나 API DTO에는 enum/union 제약이 없어 타입 시스템에서 이 값이 명시적으로 노출되지 않는다.
- **제안:** 당장 breaking change는 아니나, `finishReason`을 리터럴 유니온 타입(`'stop' | 'tool_calls' | 'error' | 'auto_resume_pending' | null`)으로 명시하면 프론트와 백엔드 양측에서 계약이 자명해진다.

---

### **[INFO]** SSE `auto_resume` 이벤트에 별도 NestJS DTO/파이프 검증 없음
- **위치:** `workflow-assistant-stream.service.ts` (yield 지점)
- **상세:** 설계 의도(controller가 JSON.stringify로 직렬화)상 별도 DTO가 없는 점은 인지된 상태이나, `reason` 필드가 현재 리터럴 `'stall_pending_steps'` 한 종류임에도 런타임 schema 검증 레이어가 없다. 향후 다른 reason 추가 시 컴파일 타임 체크 외에 런타임 validation 경로가 부재.
- **제안:** 현재 규모에서는 허용 가능. 단, `reason`이 확장될 경우 `class-validator` enum 검증 추가를 고려.

---

## 요약

이번 변경은 SSE 스트림에 `auto_resume` 이벤트를 추가하고 REST 응답에 `autoResumed` 계열 필드 3개를 선택적으로 추가하는 전형적인 **additive 확장**이다. DB 마이그레이션은 `DEFAULT FALSE / NULL`로 기존 row 호환성을 유지하고, 프론트의 `hydrateMessage`도 `undefined/false` 케이스를 명시적으로 방어하므로 하위 호환성 파괴는 없다. 주된 계약 리스크는 두 가지: 프론트 `STALL_MAX_ATTEMPTS` 상수가 백엔드 값과 수동 동기화를 요구하는 점(rehydrate 시 "N/M" 표기 오류 가능성)과, `autoResumeReason`의 silent type cast가 향후 reason 확장 시 타입 시스템 보호를 우회할 수 있는 점이다. 그 외 사항은 기능 정확성에 영향 없는 타입 선언 개선 권고 수준이다.

## 위험도

**LOW**