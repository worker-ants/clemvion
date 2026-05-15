## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `escapeHtml` 메서드의 연속 문자열 교체 비효율
- **위치**: `carousel.handler.ts` — `escapeHtml()` (라인 ~115)
- **상세**: 4번의 순차적 `.replace()` 호출이 매번 새 문자열을 생성함. 대량 데이터나 긴 텍스트가 포함된 캐러셀에서는 메모리 할당이 4배로 발생.
- **제안**: 단일 정규식 + 맵 방식으로 대체
  ```ts
  private escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return text.replace(/[&<>"]/g, (c) => map[c]);
  }
  ```

---

**[WARNING]** React 리스트 `key={i}` (인덱스 기반 키) 사용
- **위치**: `presentation-configs.tsx` — static mode items 렌더링 (라인 ~47)
- **상세**: 아이템 제거/재정렬 시 React가 잘못된 DOM을 재사용하여 불필요한 re-render 발생. 예: 3개 아이템 중 첫 번째 제거 시, key가 0→0, 1→1로 유지되어 React는 마지막 아이템이 삭제된 것으로 인식하고 나머지 2개를 전부 업데이트.
- **제안**: 아이템에 고유 ID 추가 또는 content 기반 stable key 사용
  ```ts
  const addItem = () =>
    onChange({ ...config, items: [...items, { id: crypto.randomUUID(), title: "", ... }] });
  // JSX: key={item.id}
  ```

---

**[INFO]** static 모드에서 `String()` 강제 변환 중복
- **위치**: `carousel.handler.ts` — `execute()` static 분기 (라인 ~66)
- **상세**: `validate()`에서 이미 `title`이 `string`임을 검증했음에도 `String(item.title ?? '')` 호출. 불필요한 런타임 강제 변환.
- **제안**: `item.title ?? ''` 만으로 충분 (타입 단언 후).

---

**[INFO]** 동기 함수를 `Promise.resolve()`로 래핑
- **위치**: `carousel.handler.ts` — `execute()` 반환값 (라인 ~87)
- **상세**: 함수 전체가 동기 연산임에도 `Promise.resolve({ ... })`로 감쌈. `async`/`await` 오버헤드보다는 낫지만, 마이크로태스크 큐를 거치는 불필요한 비동기 래핑. 성능 임팩트는 미미하나 인터페이스 계약상 `Promise` 반환이 필요하다면 유지.
- **제안**: `NodeHandler` 인터페이스가 `Promise<unknown>` 반환을 강제한다면 현 방식 유지. 인터페이스가 동기 반환을 허용한다면 래핑 제거 검토.

---

**[INFO]** `updateItem` 함수의 선형 탐색 패턴
- **위치**: `presentation-configs.tsx` — `updateItem` (라인 ~24)
- **상세**: `items.map((item, idx) => idx === i ? ... : item)` — O(n) 탐색. 캐러셀 아이템 수가 수십 개 수준이므로 실질적 영향 없음.
- **제안**: 현재 사용 규모에서는 변경 불필요.

---

### 요약

전반적으로 이번 변경사항은 성능에 큰 영향을 미치지 않는다. `carousel.handler.ts`는 `async` 제거로 불필요한 비동기 오버헤드를 줄인 점은 긍정적이며, `toStr()` 헬퍼 도입으로 타입 변환 로직을 일원화했다. 다만 `escapeHtml()`의 다중 문자열 교체 패턴은 대용량 텍스트 처리 시 비효율이 발생할 수 있어 단일 정규식으로 개선을 권장한다. 프론트엔드에서는 인덱스 기반 `key` 사용이 React 재조정 성능에 영향을 줄 수 있으므로 안정적인 고유 키 도입이 필요하다.

### 위험도

**LOW**