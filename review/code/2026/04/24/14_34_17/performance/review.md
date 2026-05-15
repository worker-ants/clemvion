## 발견사항

### [INFO] `t()` 번역 함수 이중 호출
- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx`, auto-resume divider 블록
- **상세**: `t("assistant.autoResumedHint", { attempt, max })`가 `aria-label`과 `<span>` 렌더에서 동일 인자로 두 번 호출된다. 번역 함수가 포맷 문자열 치환을 수행하므로 불필요한 중복 연산이다.
- **제안**:
  ```tsx
  const resumedLabel = t("assistant.autoResumedHint", {
    attempt: message.autoResume.attempt,
    max: message.autoResume.max,
  });
  // aria-label={resumedLabel}  /  <span>{resumedLabel}</span>
  ```

---

### [INFO] `persistAssistantTurn` 기본값 파라미터가 호출마다 새 객체 생성
- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`, `persistAssistantTurn` 시그니처
- **상세**: TypeScript 기본 파라미터 `resumeMeta = { autoResumed: false, ... }`는 함수 호출마다 새 객체를 생성한다. 이 함수는 한 턴에 최대 `MAX_STALL_ROUNDS + 1 = 3`번 호출되므로 GC 부담은 무시 가능하지만, sentinel 상수를 사용하면 명확하다.
- **제안**: `const DEFAULT_RESUME_META = { autoResumed: false, autoResumeReason: null, autoResumeAttempt: null } as const;`로 모듈 레벨 상수 선언 후 기본값으로 참조.

---

### [INFO] 오류 경로에서 동일한 `resumeMeta` 조건 객체가 두 곳에 중복
- **위치**: `workflow-assistant-stream.service.ts`, 두 개의 error-path `persistAssistantTurn` 호출 블록 (+386, +780)
- **상세**: `consecutiveStallRounds > 0 ? { autoResumed: true, ... } : { autoResumed: false, ... }` 삼항이 두 에러 경로에서 동일하게 반복된다. 런타임 비용은 미미하지만 추후 필드 추가 시 두 곳을 동시에 수정해야 하는 유지보수 부담이 된다.
- **제안**: 인라인 헬퍼 `buildResumeMeta(consecutiveStallRounds)` 함수로 추출.

---

### [INFO] `hydrateMessage`에서 빈 객체 스프레드
- **위치**: `frontend/src/lib/stores/assistant-store.ts`, `hydrateMessage` 반환부
- **상세**: `...(autoResume ? { autoResume } : {})` 패턴은 falsy 경로에서 빈 객체를 생성 후 즉시 스프레드한다. V8 엔진이 빈 객체 스프레드를 최적화하지만 의도가 불명확하다.
- **제안**: `...(autoResume && { autoResume })`로 교체하면 falsy 시 `false`를 스프레드해 객체 할당을 방지하고 의도가 명확해진다.

---

### [INFO] `STALL_MAX_ATTEMPTS` 프론트 상수가 백엔드 `MAX_STALL_ROUNDS`와 수동 동기화 필요
- **위치**: `frontend/src/lib/stores/assistant-store.ts:56`
- **상세**: `const STALL_MAX_ATTEMPTS = 2`는 백엔드 상수의 복제본이다. `auto_resume` SSE 이벤트에 `max` 필드가 이미 포함되어 실시간에는 서버 값이 사용되지만, rehydrate 경로는 이 프론트 상수를 사용해 백엔드 변경 시 조용한 불일치가 생길 수 있다.
- **제안**: `hydrateMessage`에서 `max: STALL_MAX_ATTEMPTS` 대신 `max: msg.autoResumeAttempt ?? 1`을 상한으로 사용하거나, API 응답에 `autoResumeMax` 필드를 추가해 서버가 항상 정답을 내려보내도록 한다.

---

## 요약

이번 변경은 `MAX_STALL_ROUNDS = 2`로 재시도 횟수가 하드 캡되어 있어 추가 DB 쓰기·메시지 배열 복사 등 새로운 연산이 모두 상한이 보장된다. 기존 인덱스 `(session_id, created_at)`으로 조회가 커버되므로 마이그레이션에서 별도 인덱스는 불필요하다. 발견된 이슈는 모두 INFO 수준의 미세 최적화로, 실제 운영 성능에 영향을 주는 병목은 없다.

## 위험도

**LOW**