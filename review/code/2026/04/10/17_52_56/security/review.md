## 보안 코드 리뷰 결과

---

### 발견사항

- **[INFO]** 런타임 타입 검증 없는 `as` 캐스팅
  - 위치: `custom-node.tsx` — `data.config.mode as string`, `data.config.conditions as Array<{...}>`, `data.config.cases as Array<{...}>`
  - 상세: TypeScript 타입 단언은 컴파일 타임에만 동작하며, 런타임에 실제 타입을 보장하지 않습니다. 외부 소스(API, 로컬스토리지 등)에서 유입된 `config` 객체가 기대와 다른 타입을 가질 경우 런타임 오류나 예기치 않은 동작이 발생할 수 있습니다.
  - 제안: `mode` 값은 `["single_turn", "multi_turn"].includes(mode)` 등으로 허용 목록 검증 추가. `conditions` 배열은 각 항목의 `id`, `label` 필드 존재 여부를 확인하는 런타임 가드 적용 권장.

- **[INFO]** 조건 ID를 DOM 속성에 직접 사용
  - 위치: `custom-node.tsx` — `<Handle id={port.id} ...>`, `data-testid={handle-${id}}`
  - 상세: 조건의 `id`(UUID 형식)가 ReactFlow Handle ID와 `data-testid` 속성에 직접 삽입됩니다. React가 JSX 내 문자열을 자동 이스케이프하므로 XSS 위험은 없으나, 비정상적인 ID 값(예: UUID가 아닌 임의 문자열)이 들어올 경우 CSS 선택자나 테스트 쿼리가 의도치 않게 동작할 수 있습니다. 스펙에서 `id`는 UUID v4로 정의되어 있으나 이것이 강제되지 않습니다.
  - 제안: 스펙 상 id는 UUID이므로, 사용 전 UUID 형식 검증(`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)을 적용하거나, 예약 포트 ID 충돌 방지를 위한 화이트리스트/블랙리스트 체크를 컴포넌트 레벨에서도 수행.

- **[INFO]** 스펙 문서 내 민감 데이터 노출 위험
  - 위치: `spec/4-nodes/3-ai-nodes.md` — `_turnDebugHistory` 섹션
  - 상세: 디버그 데이터의 `requestPayload`에 시스템 프롬프트와 전체 대화 이력이 포함되며, 스펙은 "워크플로우 소유자만 조회 가능"이라고 명시합니다. 그러나 이 접근 제어는 API/백엔드 레이어에서 강제되어야 하며, 프론트엔드 단에서만 숨기는 방식은 충분하지 않습니다.
  - 제안: 백엔드에서 `_turnDebugHistory` 응답 시 요청자의 소유권을 검증하는 미들웨어 또는 가드가 구현되어 있는지 확인. 민감 필드(시스템 프롬프트 내 API 키, 개인정보 등)에 대한 로깅/저장 정책을 명확히 문서화.

- **[INFO]** `mode` 기본값 폴백의 암묵적 행동
  - 위치: `custom-node.tsx` — `const mode = (data.config.mode as string) ?? "single_turn";`
  - 상세: `mode`가 `undefined`이거나 `"multi_turn"`, `"single_turn"` 외의 값일 때 조건 없이 single_turn 기본 포트 배열로 폴백됩니다. 이는 기능적으로 안전하지만, 잘못된 설정값이 조용히 무시되어 디버깅을 어렵게 할 수 있습니다.
  - 제안: 알 수 없는 `mode` 값에 대해 콘솔 경고(`console.warn`) 또는 개발 환경에서 명시적 오류를 발생시켜 잘못된 설정을 조기에 감지.

---

### 요약

이번 변경사항은 AI Agent 노드의 Multi Turn 모드에서 조건 없는 경우의 포트 렌더링 로직을 수정한 것입니다. 보안 관점에서 심각한 취약점(CRITICAL/HIGH)은 발견되지 않았습니다. 변경된 코드는 React JSX를 통해 XSS로부터 보호되며, 하드코딩된 시크릿이나 인증 우회 요소도 없습니다. 다만 런타임 타입 검증 부재와 UUID 형식이 강제되지 않는 조건 ID 처리가 잠재적 정보 흐름 이슈로 이어질 수 있으며, 스펙에 기술된 디버그 데이터의 민감 정보 접근 제어는 백엔드 구현 수준에서 반드시 검증이 필요합니다.

---

### 위험도

**LOW**