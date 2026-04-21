## 보안 코드 리뷰 결과

### 발견사항

---

**[INFO] width/height에 범위 제약 없음**
- 위치: `assistant-message-request.dto.ts` — `AssistantWorkflowNodeDto.width/height`
- 상세: `@IsNumber()`는 NaN/Infinity를 기본 거부하지만 `@Min()/@Max()`가 없어 음수(-∞)나 `Number.MAX_SAFE_INTEGER`급 값도 통과한다. 이 값들은 `JSON.stringify(current)`를 통해 LLM 시스템 프롬프트에 직접 삽입되므로, 조작된 치수가 LLM의 노드 배치 계산에 영향을 줄 수 있다.
- 제안:
  ```typescript
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  width?: number;
  ```

---

**[INFO] 클라이언트 제어 치수값이 LLM 프롬프트에 직접 노출**
- 위치: `system-prompt.ts:103` — `${JSON.stringify(current)}`, `workflow-assistant-stream.service.ts:742`
- 상세: 프론트엔드가 전송한 `width/height`가 검증 없이 `toWorkflowView → buildSystemPrompt` 경로를 통해 시스템 프롬프트의 "authoritative snapshot" JSON에 삽입된다. 숫자형이라 문자열 인젝션은 불가능하지만, 의도적으로 비현실적인 치수(예: `width: 9999`)를 전송하면 LLM이 잘못된 레이아웃 계산을 수행하도록 유도할 수 있다(Adversarial Layout Manipulation).
- 제안: 서버 측에서 치수값을 합리적인 범위로 clamp 처리 (위의 `@Max(10000)` 추가로 대응 가능).

---

**[INFO] 프론트엔드 타입 캐스트의 묵시적 실패 가능성**
- 위치: `assistant-panel.tsx:103-107`
- 상세: `(n as { measured?: { width?: number; height?: number } }).measured`는 런타임 검증 없는 타입 캐스트다. React Flow API 변경 시 조용히 `undefined`로 폴백하며, 이는 의도된 동작이긴 하나 미래 버전 대응 시 실수가 생길 수 있다.
- 제안: 현재 `?.` 체이닝으로 방어되어 있어 실용상 문제없으나, 향후 React Flow 버전 마이그레이션 시 타입 가드 재확인 필요.

---

### 긍정적 보안 설계 확인

- **프롬프트 인젝션 방어**: `sanitizeUserText()`가 `<`, `>`, 백틱, 마크다운 헤더, 연속 공백을 중화하고, 사용자 입력은 `<user-request>` XML fence로 격리 처리되어 있다. 신규 `width/height`는 숫자형으로만 처리되어 이 경로를 우회할 수 없다.
- **`typeof n.width === 'number'` 가드**: `null`/`undefined`/문자열이 스프레드되지 않도록 일관되게 적용되어 있다.
- **NaN/Infinity 차단**: `class-validator`의 `@IsNumber()` 기본 설정이 `allowNaN: false`, `allowInfinity: false`이므로 별도 설정 없이도 차단된다.
- **워크스페이스 경계**: 기존 스코핑 메커니즘이 신규 필드에도 그대로 적용된다.

---

### 요약

이번 변경은 React Flow의 렌더 측정값(`width/height`)을 LLM 레이아웃 힌트로 전달하는 기능으로, 보안 관점에서 전반적으로 양호하다. 신규 필드가 숫자형으로 처리되어 문자열 인젝션 경로가 없고, 기존 `sanitizeUserText`/`sanitizeLabel` 방어 체계도 손상되지 않았다. 주요 개선점은 DTO의 `width/height`에 `@Min(0)/@Max(10000)` 경계 검증을 추가하는 것으로, 클라이언트가 비현실적인 치수를 전송해 LLM 배치 로직을 교란하는 시나리오를 방지할 수 있다.

---

### 위험도

**LOW**