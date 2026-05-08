## 발견사항

### [INFO] 신규 외부 패키지 없음 — 순수 내부 리팩터링
- **위치**: 전체 diff
- **상세**: `coerce-container-param.ts`는 import 문이 전혀 없는 zero-dependency 유틸이다. `execution-engine.service.ts`가 추가한 유일한 import는 이 내부 모듈이다. `package.json` 변경 없음.
- **제안**: 없음. 신규 외부 의존성 0건 — 이상적인 상태.

---

### [INFO] 내부 의존 방향이 단방향으로 정리됨
- **위치**: `execution-engine.service.ts` 상단 추가 import
- **상세**: 의존 체인이 `execution-engine.service` → `utils/coerce-container-param` (단방향). `coerce-container-param`이 아무것도 import하지 않으므로 순환 의존 위험이 없다.
- **제안**: 없음.

---

### [INFO] `engineResolvedConfigCache` optional 선언 vs 항상 초기화 불일치 (하자 없음)
- **위치**: `node-handler.interface.ts` `ExecutionContext.engineResolvedConfigCache?: ...` / `execution-context.service.ts` `setEngineResolvedConfig` 내 방어 코드
- **상세**: 인터페이스에서는 `?`(optional)로 선언하나, `createContext`에서 항상 `{}`로 초기화한다. 따라서 `setEngineResolvedConfig`의 `if (!context.engineResolvedConfigCache)` 방어 분기는 실제로는 도달 불가다. optional 선언은 "이 필드가 없는 구 test fixture와의 하위 호환"을 위한 것으로, 인터페이스 주석과 일치한다.
- **제안**: 현재 구조 유지. 의도가 명확하므로 문제 없음. 향후 interface 단계적 정리 시 `Required`로 승격 고려 가능.

---

### [INFO] `ContainerErrorPolicy` 타입이 engine-local 유틸에 선언됨
- **위치**: `coerce-container-param.ts:82`
- **상세**: 현재 소비자가 `execution-engine.service.ts` 단 하나이므로 배치가 적절하다. 향후 ForEach executor나 다른 레이어가 이 타입을 직접 참조해야 한다면 더 중심적인 타입 파일로 이동이 필요할 수 있다.
- **제안**: 현재 유지. 소비자가 늘 경우 `node-handler.interface.ts` 또는 별도 `container-types.ts`로 이동.

---

### [INFO] `UNRESOLVED_EXPRESSION_PATTERN` greedy regex — 현재 용도에서는 안전
- **위치**: `coerce-container-param.ts:12`
- **상세**: `/\{\{.*\}\}/` 는 greedy `.*`를 사용한다. `"{{a}} {{b}}"` 같은 두 표현식이 혼재된 문자열에서 최장 매치(`{{a}} {{b}}` 전체)로 동작하나, 함수의 목적(미평가 표현식 탐지)에는 영향 없다. 이미 평가된 값이 이 경로에 도달하면 정상 숫자/boolean이므로 string 분기 자체에 진입하지 않는다.
- **제안**: 현재 용도에서는 문제 없음. 더 엄격한 탐지가 필요하다면 non-greedy(`/\{\{.*?\}\}/`) 또는 global flag(`/\{\{.*?\}\}/g`)를 고려할 수 있으나 불필요.

---

## 요약

이번 변경은 **외부 패키지를 단 하나도 추가하지 않은 순수 내부 리팩터링**이다. 신규 유틸 모듈 `coerce-container-param.ts`는 zero-import이며, 의존 방향이 단방향으로 정리되어 있어 순환 참조 위험이 없다. `node-handler.interface.ts`의 `ExecutionContext` 확장은 optional 필드 추가이므로 기존 소비자에 대한 하위 호환성이 유지된다. 라이선스, 버전 고정, 번들 크기, 보안 취약점 등 의존성 관련 리스크가 전혀 없는 변경이다.

## 위험도

**NONE**