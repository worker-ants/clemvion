### 발견사항

---

**[WARNING] 백엔드/프론트엔드 layout 기본값 불일치**
- 위치: `carousel.handler.ts:57`, `presentation-configs.tsx:97`
- 상세: 백엔드는 `layout` 기본값을 `'horizontal'`로 처리하지만, 프론트엔드 UI와 스펙(§1.1)은 `'card'`를 기본값으로 명시. config에 `layout`이 없는 경우 렌더링 결과가 달라짐.
- 제안: 백엔드를 스펙에 맞게 `'card'`로 수정하거나, 공유 상수로 단일 소스 관리.

---

**[WARNING] React 리스트 key로 배열 인덱스 사용**
- 위치: `presentation-configs.tsx:49` — `key={i}`
- 상세: 아이템 삭제/재정렬 시 React가 DOM을 잘못 매칭하여 입력 상태가 엉킬 수 있음. 동일 패턴이 파일 내 `TableConfig`, `FormConfig`에도 존재하나 이번 변경에서 신규 추가된 Carousel 아이템 목록에서도 동일하게 반복됨.
- 제안: 아이템에 `id` 필드 추가 후 `key={item.id}` 사용, 또는 `crypto.randomUUID()`로 생성.

---

**[WARNING] `toStr` 유틸 함수가 핸들러 파일 내부에 정의됨**
- 위치: `carousel.handler.ts:7-14`
- 상세: 모듈 레벨 유틸 함수가 핸들러 파일에 직접 포함됨. 다른 presentation 핸들러(`table`, `chart` 등)에서 동일 변환이 필요할 경우 복사가 발생할 가능성이 높음.
- 제안: `handlers/presentation/utils.ts` 또는 `handlers/utils/` 경로로 추출하여 공유.

---

**[WARNING] `execute` 메서드의 `_context` 파라미터에 eslint-disable 주석**
- 위치: `carousel.handler.ts:57-58`
- 상세: 인터페이스 준수를 위해 불필요한 파라미터를 받으면서 lint 경고를 주석으로 억제. 현재 구현에서는 context가 전혀 활용되지 않음.
- 제안: 현재 구조는 인터페이스 요구사항이므로 어쩔 수 없으나, 주석 없이 타입 캐스팅 패턴보다 `NodeHandler` 인터페이스의 `execute` 시그니처에서 context를 optional로 변경하는 방향 검토.

---

**[INFO] `execute` 메서드 내 static/dynamic 분기 — 추출 고려**
- 위치: `carousel.handler.ts:55-91`
- 상세: static과 dynamic 브랜치가 각각 독립적인 로직을 가지며 메서드 길이가 증가함. 현재는 관리 가능한 수준이지만 두 모드 중 하나가 확장될 경우 복잡도가 급격히 증가할 수 있음.
- 제안: `private buildStaticItems()`, `private buildDynamicItems()` 로 분리하면 각 모드 테스트와 변경이 격리됨.

---

**[INFO] static/dynamic 모드 간 이미지 처리 패턴 불일치**
- 위치: `carousel.handler.ts:70`, `carousel.handler.ts:84`
- 상세: static 모드는 `item.image ? String(item.image) : undefined`, dynamic 모드는 `toStr(item[imageField]) || undefined`. 동작 결과는 동일하지만 코드 패턴이 달라 유지보수 시 혼란 가능.
- 제안: 두 모드 모두 `toStr()` + `|| undefined` 패턴으로 통일.

---

**[INFO] spec 캔버스 요약 포맷이 static 모드를 반영하지 않음**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §7 캔버스 요약
- 상세: Carousel 요약 포맷이 `{layout} · {titleField}` 로 명시되어 있으나 static 모드에서는 `titleField`가 없음. 구현 시 빈 문자열이나 오류 발생 가능.
- 제안: static 모드일 때 `{layout} · static ({N} items)` 형태 등으로 스펙 보완.

---

**[INFO] eslint-disable 주석 제거 (긍정적 변경)**
- 위치: `execution-engine.service.spec.ts:579, 596, 647, 675`
- 상세: 불필요한 lint 억제 주석이 제거되어 코드가 간결해짐. 다만 `@typescript-eslint/no-unsafe-assignment`는 여전히 남아 있어, private 필드 접근 패턴(`(service as any)['contextService']`)의 근본적 타입 안전성 문제는 미해결 상태.

---

### 요약

이번 변경은 Carousel 노드에 static/dynamic 모드를 추가하는 기능 확장으로, 전반적으로 스펙에 부합하고 테스트 커버리지도 잘 갖춰져 있습니다. 그러나 **백엔드 기본 layout 값(`'horizontal'`)과 프론트엔드/스펙의 `'card'` 불일치**가 가장 실질적인 버그로 즉시 수정이 필요하며, React 리스트의 `key={i}` 패턴도 아이템 삭제 UX에서 잠재적 결함을 유발할 수 있습니다. `toStr` 유틸의 내재화는 당장은 문제가 없으나 다른 핸들러 확장 시 중복 코드를 유발할 가능성이 있으므로 사전 추출을 권장합니다.

### 위험도
**MEDIUM**