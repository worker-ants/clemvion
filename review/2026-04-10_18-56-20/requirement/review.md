## 발견사항

### [WARNING] `timeout` 및 `partialOnTimeout` 설정 필드가 UI에 누락
- **위치**: `logic-configs.tsx` - `MergeConfig` 컴포넌트
- **상세**: 스펙(`spec/4-nodes/1-logic-nodes.md` §11)에는 `timeout`(기본값: 300초) 및 `partialOnTimeout` 필드가 정의되어 있으나, `MergeConfig` UI에는 `timeout`만 있고 `partialOnTimeout` 체크박스가 없음. 스펙상 "타임아웃 시 부분 병합 수행 여부"는 `false` 시 `MERGE_TIMEOUT` 에러가 발생하는 중요한 동작 분기를 제어하는 필드임.
- **제안**: `CheckboxField`로 `partialOnTimeout` 옵션을 `MergeConfig`에 추가:
  ```tsx
  <CheckboxField
    label="Partial merge on timeout"
    checked={(config.partialOnTimeout as boolean) ?? false}
    onChange={(v) => onChange({ ...config, partialOnTimeout: v })}
  />
  ```

---

### [WARNING] 테스트에서 `timeout` / `partialOnTimeout` 검증 누락
- **위치**: `merge.handler.spec.ts`
- **상세**: 스펙에서 `timeout`은 핵심 동작 제어 필드(기본 300초)이며, `partialOnTimeout`은 `MERGE_TIMEOUT` 에러 발생 여부를 결정함. 그러나 `validate` 테스트에서 `timeout` 값의 유효성 검증(예: 음수, 0 불가) 및 `partialOnTimeout` 플래그 처리에 대한 테스트 케이스가 없음.
- **제안**: 아래 케이스 추가:
  ```ts
  it('should return invalid for non-positive timeout', () => {
    const result = handler.validate({ strategy: 'wait_all', outputFormat: 'array', timeout: 0 });
    expect(result.valid).toBe(false);
  });
  ```

---

### [WARNING] 캔버스 요약(§13) 스펙과 현재 포트 구조 불일치
- **위치**: `spec/4-nodes/1-logic-nodes.md` §13 캔버스 요약 테이블
- **상세**: 캔버스 요약 포맷이 `"{N} inputs · {strategy}"`로 정의되어 있음. 하지만 포트가 단일 `in`으로 변경되어 "N inputs"는 런타임에 수신된 다중 엣지 수를 의미하는 것인지, 아니면 정적 포트 수를 의미하는 것인지 모호함. 스펙 내에서 요약 포맷의 `N`이 무엇을 기준으로 계산되는지 명시되지 않음.
- **제안**: 스펙 §13의 Merge 행에 `N`의 기준을 명시: 예) `"{N} inputs · {strategy}" — N은 연결된 엣지 수 (런타임)`

---

### [INFO] 입력 포트 변경에 따른 기존 워크플로우 마이그레이션 고려 필요
- **위치**: `index.ts` - Merge 노드 정의
- **상세**: 기존 워크플로우에서 `in_0`, `in_1` 포트로 저장된 엣지 연결 데이터가 있다면, 포트 ID가 `in`으로 변경됨에 따라 해당 연결이 무효화될 수 있음. 스펙 변경이 DB에 저장된 워크플로우 데이터에 미치는 영향에 대한 처리(마이그레이션 스크립트 또는 하위 호환 로직)가 코드 변경에 포함되지 않음.
- **제안**: 워크플로우 저장 데이터 로드 시 `in_0`/`in_1` → `in` 포트 ID 매핑 처리 또는 DB 마이그레이션 스크립트 작성 여부 확인.

---

### [INFO] `merge.handler.spec.ts`에 `partialOnTimeout` 동작 시나리오 테스트 없음
- **위치**: `merge.handler.spec.ts` - `execute` describe 블록
- **상세**: `partialOnTimeout=true`일 때 일부 입력만 도착한 상태에서 출력하는 시나리오, `partialOnTimeout=false`일 때 `MERGE_TIMEOUT` 에러를 던지는 시나리오가 테스트되지 않음. 이는 스펙에서 명시적으로 정의된 동작임.
- **제안**: 타임아웃 시나리오 테스트 추가 (mock timer 또는 짧은 timeout 값 사용).

---

## 요약

이번 변경은 Merge 노드의 입력 포트를 동적 다중 포트(`in_0`, `in_1`, ...)에서 단일 포트(`in`, 다중 엣지 수신)로 단순화하고, 관련 UI와 스펙을 일관되게 정리한 것으로 방향성은 적절합니다. 다만 스펙에 정의된 `partialOnTimeout` 설정 필드가 UI(`MergeConfig`)에 누락되어 있고, 테스트에서도 `timeout`/`partialOnTimeout` 관련 검증이 빠져 있어 스펙과 구현 간 불완전한 대응이 존재합니다. 또한 포트 ID 변경(`in_0`→`in`)에 따른 기존 저장 데이터 하위 호환 처리가 누락되어 있어 프로덕션 환경에서 데이터 정합성 문제가 발생할 수 있습니다.

## 위험도

**MEDIUM**