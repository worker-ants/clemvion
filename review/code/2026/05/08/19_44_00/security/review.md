## 발견사항

### **[INFO]** 미해결 표현식 탐지 정규식이 멀티라인 미처리
- **위치**: `coerce-container-param.ts:12`
- **상세**: `/\{\{.*\}\}/` 패턴은 `s` 플래그 없이 `.`가 줄바꿈을 매칭하지 않음. `{{\nvalue\n}}` 형태의 입력은 미해결 표현식으로 감지되지 않아 `coerceContainerNumber`의 `Number()` 경로로 진입함. 실제로는 표현식 리졸버가 먼저 처리하는 마지막 방어선이므로 즉각적 위협은 낮으나 방어 논리가 불완전.
- **제안**: `/\{\{[\s\S]*?\}\}/` 또는 `value.includes('{{') && value.includes('}}')`으로 강화

---

### **[INFO]** 에러 메시지에 사용자 입력값 그대로 직렬화
- **위치**: `coerce-container-param.ts:17-22`, `coerceContainerNumber`, `coerceContainerBoolean` throw 구문
- **상세**: `JSON.stringify(value)` 로 에러 메시지를 구성. `count`, `branchCount` 같은 컨테이너 파라미터는 민감하지 않으나, 향후 이 헬퍼가 다른 컨텍스트에서 재사용될 경우 시크릿이 포함된 값이 로그에 평문으로 남을 수 있음.
- **제안**: 에러 메시지 내 직렬화 값을 100자 이하로 truncate (`String(JSON.stringify(value)).slice(0, 100)`)

---

### **[INFO]** `engineResolvedConfigCache` TypeScript 단계 readonly 미적용
- **위치**: `node-handler.interface.ts` — 신규 필드 선언
- **상세**: 스펙 문서와 코드 주석은 "expression context에 노출하지 않음", 핸들러는 읽기 전용으로 다뤄야 한다고 명시하지만 인터페이스 타입이 `Record<string, Record<string, unknown>>`으로 가변(mutable). 핸들러가 이 캐시에 직접 기록해도 컴파일 타임에 차단되지 않음.
- **제안**: `Readonly<Record<string, Readonly<Record<string, unknown>>>>` 으로 변경하여 핸들러 경계에서 컴파일 타임 강제

---

### **[WARNING]** 캐시 미스 시 raw node.config 폴백이 예상치 못한 실행 실패 유발 가능
- **위치**: `execution-engine.service.ts` — `runParallel`, `runContainerInner` 진입부
- **상세**:
  ```ts
  const engineResolvedConfig =
    context.engineResolvedConfigCache?.[nodeId] ??
    parallelNode.config ?? {};
  ```
  정상 흐름에서는 캐시가 항상 채워져 있어야 하나, Resume/multi-turn 재진입 등 엣지 케이스에서 캐시 미스가 발생하면 DB의 raw `node.config`(`{{3}}` 같은 미평가 문자열)가 `coerceContainerNumber`로 전달되어 `INVALID_CONTAINER_PARAM` throw. 이는 정상 워크플로우가 silent failure(NaN 0회 루프) 대신 명시적 에러로 실패하는 것이라 보안적으로는 개선이나, 폴백 진입 여부가 로그에 기록되지 않아 진단 어려움.
- **제안**: 폴백 진입 시 `this.logger.warn('engineResolvedConfigCache miss for node %s', nodeId)` 추가

---

### **[INFO]** 컨텍스트 Map 크기 제한 없음 (기존 패턴 계승)
- **위치**: `execution-context.service.ts` — `contexts` Map
- **상세**: `engineResolvedConfigCache` 추가로 실행당 메모리 사용량 증가. `deleteContext`가 `finally`에서 호출되지 않는 예외 경로가 있을 경우 컨텍스트 누수 발생 가능. 기존 문제를 계승하는 수준으로 이번 PR이 새로 도입한 취약점은 아님.
- **제안**: 최대 컨텍스트 수 초과 시 가장 오래된 항목 제거 또는 TTL 기반 만료 고려 (장기 과제)

---

## 요약

이번 변경은 raw echo 채널과 엔진 동작 파라미터 채널을 분리하는 설계 수정으로, 보안 관점에서는 **net positive**이다. 기존의 silent fallback(NaN 루프 0회, 잘못된 branchCount 2 고정)은 의도치 않은 동작을 유발할 수 있었는데, `coerce-container-param.ts`의 명시적 검증으로 대체되어 오류가 즉각 드러나게 되었다. `JSON.stringify(value)` 에러 메시지 노출과 미해결 표현식 정규식의 멀티라인 맹점은 주의 사항이나 현재 컨텍스트에서의 실질적 위협은 낮다. `engineResolvedConfigCache`의 TypeScript readonly 미적용은 향후 핸들러가 이 캐시를 오염시킬 수 있는 리스크로, 컴파일 타임 강제가 권장된다. 인증·인가·주입 취약점·하드코딩 시크릿은 발견되지 않았다.

## 위험도

**LOW**