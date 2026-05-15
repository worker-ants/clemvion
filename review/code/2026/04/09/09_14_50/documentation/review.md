### 발견사항

---

**[INFO]** `validateItemButtons` 함수에 JSDoc 없음
- 위치: `carousel.handler.ts` — `validateItemButtons` 함수
- 상세: `prefix` 파라미터의 의도(에러 메시지 접두사)가 함수 시그니처만으로 불명확. 내부 유틸 함수이나 복잡한 검증 로직을 포함함.
- 제안: 현재 수준으로 충분. 함수명이 자기설명적이므로 낮은 우선순위.

---

**[INFO]** `unwrap<T>` 헬퍼 함수의 조건 로직 설명 부족
- 위치: `executions.ts` — `unwrap` 함수
- 상세: `!Array.isArray(data.data)` 조건이 왜 필요한지(배열 응답은 래핑 안 됨) 주석 없음. 유지보수 중 삭제 실수 가능.
- 제안:
  ```ts
  // Arrays are never wrapped; only unwrap object-shaped { data: T } responses
  ```

---

**[INFO]** `POLL_INTERVAL_WAITING_MS` 상수 주석 변경 — 정확성 개선
- 위치: `use-execution-events.ts` L22
- 상세: `// Slower polling when waiting for form input` → `// Same interval when waiting for user input`으로 변경. 값도 10000 → 2000으로 변경되어 주석과 코드가 일치. 긍정적 변경.

---

**[INFO]** `previewOnly` prop 문서화는 있으나 `onSelectItem`은 없음
- 위치: `conversation-inspector.tsx` — `SummaryView` props
- 상세: `previewOnly?: boolean`은 JSDoc으로 설명됨. 그러나 `onSelectItem?: (index: number) => void`는 타입만 있고 의도(previewOnly 모드에서만 사용) 설명 없음.
- 제안: `/** Called when a conversation item is clicked; only used in previewOnly mode */`

---

**[INFO]** `buttonItemMap` 구조의 인라인 설명 부재
- 위치: `execution-engine.service.ts` — `buttonItemMap` 생성 블록
- 상세: `buttonItemMap: Record<string, number>`가 "버튼ID → 아이템인덱스" 매핑임을 설명하는 주석이 없음. 리뷰어 입장에서 값의 의미를 즉시 파악하기 어려움.
- 제안: `// buttonItemMap: { [buttonId]: itemIndex } — used to resolve selectedItem on click`

---

**[INFO]** PRD 문서 업데이트 적절
- 위치: `prd/3-node-system.md`, `prd/7-execution-history.md`
- 상세: 새 기능(ND-CL-08~10, 실행 내역 페이지)에 대한 PRD가 정상적으로 추가됨. 요구사항 테이블 형식도 일관성 있음. 긍정적.

---

**[INFO]** `execution-status.ts` 공유 모듈에 모듈 수준 JSDoc 없음
- 위치: `frontend/src/lib/utils/execution-status.ts`
- 상세: 두 페이지에서 공유하기 위해 추출한 유틸 모듈임을 설명하는 파일 상단 주석 없음. 규모가 커지면 중복 추출 시도가 발생할 수 있음.
- 제안: 파일 최상단에 `/** Shared execution status constants and formatters used across execution list and detail pages */` 추가.

---

**[INFO]** `execution-status.test.ts`의 `formatDuration(59999)` 경계값 테스트 결과가 직관에 반함
- 위치: `execution-status.test.ts` L44
- 상세: `59999ms` → `"60.0s"` 테스트는 `toFixed(1)` 반올림 동작을 검증하는데, 이 동작이 의도적임을 테스트 설명이나 주석으로 명시하지 않음. 미래 유지보수자가 버그로 오해할 수 있음.
- 제안: `it("rounds 59999ms to 60.0s (toFixed rounding)", ...)`로 테스트 이름 변경.

---

**[WARNING]** `_selectedPort` 스트리핑 동작이 테스트 주석으로만 문서화됨
- 위치: `execution-engine.service.spec.ts` L1194
- 상세: `// _selectedPort is stripped before passing as input to downstream nodes` 주석이 스펙 파일이나 서비스 코드가 아닌 테스트 파일에만 있음. 이 동작은 중요한 비즈니스 로직이나 실제 구현부에 대응하는 주석이 없음.
- 제안: `execution-engine.service.ts`의 관련 로직(다운스트림 입력 전달 부분)에 `// Strip _selectedPort from downstream input to avoid leaking internal routing state` 추가.

---

**[INFO]** 캐러셀 `source` 필드의 표현식 평가 시점이 핸들러 주석으로만 설명됨
- 위치: `carousel.handler.ts` L160
- 상세: `// source is resolved by the expression engine before reaching the handler` 주석이 있어 좋음. 그러나 스펙 문서(`spec/`)에는 이 동작이 반영되어 있는지 확인 불가.

---

### 요약

전반적으로 이번 변경은 문서화 수준이 양호하다. PRD 신규 파일(`prd/7-execution-history.md`)과 PRD 업데이트(`prd/3-node-system.md`)가 구현과 함께 작성되었고, `execution-status.ts` 추출 및 `POLL_INTERVAL_WAITING_MS` 주석 수정 등 기존 문서화 부채를 일부 해소했다. 주요 미흡 사항은 `_selectedPort` 스트리핑이라는 중요한 비즈니스 로직 동작이 테스트 주석에만 설명되고 구현부에는 없다는 점이며, `unwrap<T>` 헬퍼의 배열 예외 처리 조건과 `buttonItemMap` 구조의 의미도 인라인 주석으로 보완하면 유지보수성이 높아진다. 전반적 위험도는 낮다.

### 위험도
**LOW**