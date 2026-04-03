## 발견사항

### [INFO] `expressionContext`가 모든 핸들러에 노출되는 일반적 변경
- **위치**: `node-handler.interface.ts` - `ExecutionContext.expressionContext` 추가
- **상세**: 현재는 `TableHandler`만 이 필드를 사용하지만, 모든 핸들러가 접근 가능한 공용 인터페이스에 추가됨. 미래에 다른 핸들러들이 임의로 사용할 경우 추적이 어려울 수 있음
- **제안**: 의도된 설계(재사용 가능한 패턴)라면 JSDoc 주석으로 용도를 명시하는 것을 고려

### [INFO] Static mode에서 dot-path 및 label 표현식 미지원
- **위치**: `table.handler.ts` - `resolveColumnLabels()` 및 dynamic 분기 내 `getNestedValue` 사용
- **상세**: `resolveColumnLabels()`는 `mode !== 'dynamic'`이면 즉시 반환하고, dot-path(`getNestedValue`) 역시 dynamic 분기에만 적용됨. Static mode에서 `address.city` 같은 필드나 `{{ }}` 표현식 레이블은 평가되지 않음
- **제안**: 의도된 설계 제한이라면 스펙 문서나 주석에 명시 권장

### [INFO] `expression-exclusions.ts` 변경이 scope에 필수적으로 포함된 이유가 불명확
- **위치**: `expression-exclusions.ts` - `table: new Set(['columns'])` 추가
- **상세**: 변경 자체는 정확함(config 사전 해석을 막아 per-item 평가를 가능하게 함). 단, diff만 봐서는 이 변경이 per-item 평가의 전제 조건임을 파악하기 어려움
- **제안**: 코드 내 주석에 "columns는 TableHandler가 직접 per-item 평가를 수행하므로 사전 해석에서 제외"와 같은 설명 추가 권장

---

## 요약

6개 파일 전체가 "Table 노드의 per-item 표현식 평가 + dot-path 필드 접근" 기능을 구현하기 위해 일관된 목적 하에 수정되었으며, 불필요한 리팩토링이나 무관한 코드 변경은 발견되지 않음. `ExecutionContext`에 `expressionContext`를 추가한 것은 다소 범용적이지만, 재사용 가능한 아키텍처 패턴으로 볼 수 있어 과도한 엔지니어링으로 보기는 어려움. 모든 변경이 논리적 연쇄 관계(표현식 컨텍스트 타입 정의 → 인터페이스 확장 → 엔진 서비스 저장 → 핸들러 활용 → 제외 목록 등록 → 테스트 검증)를 형성하고 있어 scope가 잘 통제된 변경임.

## 위험도

**NONE**