## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `WARNING` 상수 및 null 폴백 경로가 사실상 Dead Code**
- 위치: `node-config-summary.ts:36` 및 `getConfigSummary` 내 `if (!result) return { ...WARNING }` 분기
- 상세: 이번 변경으로 FORMATTERS에 등록된 모든 formatter가 `ConfigSummaryResult`(non-null)를 반환하도록 바뀌었다. `carouselSummary`는 여전히 반환 타입이 `| null`이지만 실제 구현에서 null을 반환하는 코드 경로가 존재하지 않는다. 결과적으로 `const WARNING = ...`와 `if (!result) return { ...WARNING }` 분기는 절대 실행되지 않는 Dead Code가 되었다. 이는 미래 개발자에게 오해를 유발할 수 있다.
- 제안:
  ```typescript
  // WARNING 상수 제거
  // carouselSummary 반환 타입을 ConfigSummaryResult | null → ConfigSummaryResult 로 수정
  // getConfigSummary의 null 폴백 분기 제거
  const result = formatter(config);
  return result; // null 체크 불필요
  ```

---

**[WARNING] FORMATTERS 레지스트리 타입과 실제 formatter 시그니처 불일치**
- 위치: `node-config-summary.ts` — `FORMATTERS` 선언부
- 상세: `const FORMATTERS: Record<string, (config: NodeConfig) => ConfigSummaryResult | null>` 로 선언되어 있으나, `carouselSummary`를 제외한 24개 formatter는 이번 변경으로 모두 `ConfigSummaryResult`(non-null)를 반환한다. 레지스트리 타입이 실제 계약보다 느슨하게 선언되어 있어 타입 시스템이 null 반환 가능성을 허용하는 것처럼 보인다.
- 제안: `carouselSummary`의 반환 타입을 `ConfigSummaryResult`로 통일한 뒤, FORMATTERS 타입을 `Record<string, (config: NodeConfig) => ConfigSummaryResult>`로 좁혀 컴파일 타임에 null 반환을 차단한다.

---

**[INFO] `warning()` (구현) / `warningOf()` (테스트) 병렬 헬퍼의 명명 불일치**
- 위치: `node-config-summary.ts:37`, `node-config-summary.test.ts:7`
- 상세: 구현의 `warning(detail)` 과 테스트의 `warningOf(detail)` 은 동일한 역할이나 이름이 다르다. 기능은 적절히 분리되어 있으나, 미래 유지보수자가 두 함수의 관계를 추론해야 하는 인지 부하가 생긴다.
- 제안: 테스트 헬퍼를 `warning(detail)` 과 동일한 이름으로 맞추거나, 주석으로 "mirrors `warning()` in implementation" 등을 명시한다.

---

**[INFO] `custom-node.test.tsx` 의 regex 매처(`/^⚠/`)가 상위 레이어 책임에 부합**
- 위치: `custom-node.test.tsx:122`, `148`, `178`
- 상세: 컴포넌트 테스트에서 정확한 메시지 대신 `⚠` 시작 여부만 검증하도록 변경한 것은 올바른 레이어 책임 분리다. 정확한 메시지 검증은 `node-config-summary.test.ts` (유틸 레이어)의 몫이고, 컴포넌트 테스트는 "경고가 올바른 위치(헤더 아이콘)에 표시되는지"에만 집중한다. 아키텍처 관점에서 권장할 만한 패턴이다.

---

**[INFO] `getConfigSummary` 의 `manual_trigger` 예외 처리가 레지스트리 외부 하드코딩**
- 위치: `node-config-summary.ts` — `getConfigSummary` 함수 내 `if (nodeType === "manual_trigger") return null`
- 상세: 이미 기존 코드에 존재하는 문제로 이번 변경이 도입한 것은 아니다. 그러나 FORMATTERS 레지스트리 패턴이 OCP(개방-폐쇄 원칙)를 지향함에도, 특정 노드 타입의 예외가 레지스트리 외부에 분산되어 있다. 새로운 "요약 없는 노드"가 추가될 때마다 조건이 누적될 수 있다.
- 제안: `FORMATTERS` 에 `manual_trigger: () => null` 을 등록하거나, `null`을 반환하는 sentinel formatter를 등록해 dispatcher 내 하드코딩을 제거한다.

---

### 요약

이번 변경은 단일 `"⚠ Not configured"` 메시지를 노드별 구체적 경고 메시지로 교체하는 기능적으로 명확한 리팩터링이다. `warning(detail)` 팩토리 함수 도입으로 경고 포맷의 단일 변경점을 확보했고, `FORMATTERS` 레지스트리 패턴을 통해 OCP가 잘 유지되고 있다. 테스트-구현 레이어 경계도 적절히 분리되어 있다. 주요 아키텍처 부채는 리팩터링 후 정리되지 않은 Dead Code(`WARNING` 상수, null 폴백 분기)와 그에 따른 타입 불일치로, 이를 해소하면 전반적으로 깔끔한 설계가 완성된다.

### 위험도

**LOW**