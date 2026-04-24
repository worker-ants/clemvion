## 발견사항

### [INFO] SSE `auto_resume` 이벤트 데이터 클라이언트 측 검증 없음
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `applyAutoResumeEvent` 함수
- **상세**: `event.data.attempt`, `event.data.max`가 서버에서 온 SSE 페이로드를 그대로 신뢰하고 범위 검증 없이 상태에 저장됩니다. 동일 출처의 백엔드가 제어하므로 실질 위험은 낮지만, 네트워크 레이어에서 SSE 스트림이 조작될 경우 `Infinity`, `-1`, `NaN` 같은 값이 UI에 표시될 수 있습니다(`"Auto-resumed (Infinity/Infinity)"`).
- **제안**: `applyAutoResumeEvent` 진입부에 간단한 경계 검사를 추가하세요:
  ```ts
  if (
    typeof event.data.attempt !== 'number' || event.data.attempt < 1 ||
    typeof event.data.max !== 'number' || event.data.max < 1
  ) return currentAssistantId;
  ```

---

### [INFO] `autoResumeReason` 런타임 타입 캐스팅
- **위치**: `frontend/src/lib/stores/assistant-store.ts:160` — `hydrateMessage`
- **상세**: `msg.autoResumeReason as "stall_pending_steps"`는 TypeScript 컴파일 타임 캐스트일 뿐 런타임 검증이 없습니다. DB에 예상 외 값이 저장된 경우 타입 시스템이 틀린 보장을 줍니다. 현재 렌더링에서 `reason`은 `aria-label`/`span` 텍스트에 직접 삽입되지 않으므로 XSS는 아니지만, 향후 `reason`을 분기 로직에 사용할 때 문제가 될 수 있습니다.
- **제안**: 값을 화이트리스트로 확인 후 할당:
  ```ts
  const validReasons = ['stall_pending_steps'] as const;
  const reason = validReasons.includes(msg.autoResumeReason as any)
    ? (msg.autoResumeReason as typeof validReasons[number])
    : undefined;
  ```

---

### [INFO] 프론트엔드 `STALL_MAX_ATTEMPTS` 상수 이중 관리
- **위치**: `frontend/src/lib/stores/assistant-store.ts:68` / `workflow-assistant-stream.service.ts`의 `MAX_STALL_ROUNDS`
- **상세**: 백엔드의 `MAX_STALL_ROUNDS = 2`와 프론트의 `STALL_MAX_ATTEMPTS = 2`가 분리된 파일에서 독립적으로 관리됩니다. rehydrate 경로에서 `max` 값을 SSE 이벤트로 받아 저장하지 않고 이 상수에서 재구성하기 때문에, 백엔드 값이 변경될 때 프론트 상수가 sync되지 않으면 divider에 잘못된 "N/M" 비율이 표시됩니다(보안 이슈는 아니나, 기능 정합성 위험).
- **제안**: API 응답의 `autoResumeAttempt` 외에 `autoResumeMax`도 DB에 persist하거나, rehydrate 전용 API가 `max` 값을 포함해 내려주도록 설계를 개선하세요.

---

### [INFO] `VARCHAR(40)` 제약이 서비스 계층에서 미검증
- **위치**: `V020__assistant_message_auto_resume.sql` / `workflow-assistant-stream.service.ts`
- **상세**: `auto_resume_reason` 컬럼은 DB 레벨에서 `VARCHAR(40)` 제약을 가지지만, 서비스 계층에서는 문자열 길이 검증 없이 `persistAssistantTurn`에 직접 전달됩니다. 현재는 하드코딩된 리터럴 `'stall_pending_steps'`(18자)만 사용되므로 실제 위험은 없으나, 향후 `reason` 종류를 동적으로 구성하면 DB 제약 위반 에러가 발생할 수 있습니다.
- **제안**: `persistAssistantTurn`의 `resumeMeta.autoResumeReason` 타입을 리터럴 유니온 `'stall_pending_steps'`로 제한하는 것이 현행 구조로 충분합니다(이미 TypeScript 레벨에서 적용됨). 유지보수 측면에서 안전.

---

## 요약

이번 변경은 stall 자동 복구 이력을 기록하는 DB 스키마 확장과 SSE 이벤트 추가로 구성됩니다. SQL 인젝션, XSS, 인증/인가 관련 신규 취약점은 발견되지 않았습니다. 신규 필드(`autoResumed`, `autoResumeReason`, `autoResumeAttempt`)는 TypeORM 파라미터 바인딩을 통해 안전하게 저장되고, 프론트엔드 렌더링은 React의 자동 이스케이프에 의해 XSS로부터 보호됩니다. 다만 SSE 클라이언트 측에서 `attempt`/`max`에 대한 런타임 범위 검증이 없고, `STALL_MAX_ATTEMPTS` 상수가 프론트-백엔드 간 이중으로 관리되는 점은 향후 유지보수 위험 요소입니다. 전반적으로 보안 설계는 적절합니다.

## 위험도

**LOW**