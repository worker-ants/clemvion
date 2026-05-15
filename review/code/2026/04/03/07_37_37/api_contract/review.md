### 발견사항

- **[WARNING]** Dynamic 모드에서 `image` 필드 타입 변경 (빈 문자열 → `undefined`)
  - 위치: `carousel.handler.ts`, execute 메서드 dynamic 분기
  - 상세: 기존에는 `imageField`가 설정되었으나 값이 없을 때 `image: ''`(빈 문자열)을 반환했습니다. 변경 후 `toStr(item[imageField]) || undefined` 패턴으로 `undefined`를 반환합니다. 출력 스키마에서 `image` 키 자체가 사라지므로, `typeof item.image === 'string'`과 같이 타입을 검사하거나 `image: ''`를 명시적으로 처리하는 다운스트림 소비자가 있다면 동작이 달라집니다.
  - 제안: 스펙의 출력 형식에 `image` 필드가 optional(`string | undefined`)임을 명시하거나, 이전처럼 빈 문자열을 유지하는 방향으로 일관성을 결정해야 합니다.

- **[WARNING]** `toStr()` 도입으로 인한 객체 필드 직렬화 방식 변경
  - 위치: `carousel.handler.ts`, `toStr` 함수
  - 상세: 기존 코드는 `item[titleField] ?? ''`로 객체 값이 들어오면 `[object Object]`를 반환했습니다. 변경 후 `JSON.stringify(value)`를 사용하므로 필드 값이 중첩 객체인 경우 출력 문자열이 달라집니다. 이는 동일 데이터를 사용하는 기존 실행 결과와 차이가 발생할 수 있습니다.
  - 제안: 스펙에 비문자열 필드 처리 정책을 명시하거나, `toStr`의 동작을 문서화하세요.

- **[WARNING]** Spec과 validate 코드 간 `descriptionField` 필수 여부 불일치
  - 위치: `spec/4-nodes/6-presentation-nodes.md` 1.1절, `carousel.handler.ts` validate 메서드
  - 상세: 스펙은 dynamic 모드에서 `descriptionField`를 필수(`✓`)로 정의하지만, `validate()` 메서드는 `descriptionField`를 검증하지 않습니다. 이는 이번 변경 이전부터 존재하던 불일치이나, 스펙이 갱신된 지금이 교정 시점입니다.
  - 제안: `validate()` 에 dynamic 모드 `descriptionField` 검증을 추가하거나, 스펙에서 optional(`✗`)로 수정하세요.

- **[INFO]** 캔버스 요약 포맷(§7)이 static 모드를 반영하지 않음
  - 위치: `spec/4-nodes/6-presentation-nodes.md` 7절
  - 상세: 캔버스 요약 포맷이 `{layout} · {titleField}`로 정의되어 있어 static 모드에서는 `titleField`가 없으므로 의미 있는 요약을 표시할 수 없습니다.
  - 제안: static 모드 요약 포맷을 별도로 정의하세요 (예: `{layout} · {N} items`).

- **[INFO]** 출력 스키마에 `layout` 필드가 포함되나 스펙 출력 형식 예시에 누락
  - 위치: `spec/4-nodes/6-presentation-nodes.md` 1.3절 출력 형식
  - 상세: `carousel.handler.ts`는 `{ type, items, layout, rendered }`를 반환하지만 스펙 출력 형식 예시에는 `layout` 필드가 없습니다.
  - 제안: 스펙 출력 형식 예시에 `"layout": "card"` 필드를 추가하세요.

---

### 요약

이번 변경은 Carousel 노드에 static/dynamic 이중 모드를 추가하는 내용으로, `mode` 기본값을 `dynamic`으로 설정해 기존 config와의 하위 호환성을 유지한 점은 올바릅니다. 그러나 dynamic 모드에서 `image` 필드가 빈 문자열에서 `undefined`로 바뀌는 출력 스키마 변화와, `toStr()`의 객체 직렬화 방식 차이는 다운스트림 소비자(Run Results Drawer 렌더러, 후속 노드)에 영향을 줄 수 있는 암묵적 breaking change입니다. 또한 스펙과 validate 코드 사이의 `descriptionField` 필수 여부 불일치는 계약 신뢰도를 낮추므로 조정이 필요합니다.

### 위험도

**LOW**