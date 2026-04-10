# Code Review 이슈 조치 내용

## Critical

### 1. 기존 워크플로우 엣지 호환성 (하위 호환성 / 데이터 파손)
- **조치**: DB 마이그레이션 스크립트 `V007__merge_node_single_input_port.sql` 추가
  - `in_0`, `in_1` 등의 엣지 target_port를 `in`으로 일괄 변환
  - 기존 config의 `inputCount` 필드 제거

## Warning

### 3. Prototype Pollution 방어 (보안)
- **조치**: `merge.handler.ts`의 `merge_object` 포맷에서 `Object.create(null)` 기반 객체 사용 및 `__proto__`, `constructor`, `prototype` 키 필터링 적용
- **테스트**: `merge.handler.spec.ts`에 Prototype Pollution 방어 테스트 2건 추가

### 8. indexed 키 스펙/코드 불일치 (스펙-테스트 불일치)
- **조치**: 스펙의 `{ "0": input0, "1": input1 }` 예시를 코드와 일치하도록 `{ "in_0": input0, "in_1": input1 }`로 수정

## 보류/미조치 사유

### 1. partialOnTimeout UI 누락
- 기존부터 미구현 상태인 기능으로, 이번 변경 범위(포트 단순화)와 무관. 별도 태스크로 처리 예정.

### 2. timeout 검증 테스트 누락
- `MergeHandler`에 timeout 로직이 구현되어 있지 않음 (실행 엔진 레벨에서 처리). 핸들러 단위 테스트에서 검증할 대상이 아님.

### 4. 캔버스 요약 N 산출 기준
- 캔버스 요약 렌더링은 이번 변경 범위 외. 연결된 엣지 수 기반으로 런타임 집계하도록 별도 대응 예정.

### 5-6, 9-10. 실행 엔진 입력 계약 문서화, append 전략 차별성, 동시성
- 실행 엔진의 `gatherNodeInput()`이 입력을 집계 후 단일 호출하는 구조이므로 동시성 이슈 없음. 계약 문서화는 실행 엔진 스펙에서 별도 대응 예정.
