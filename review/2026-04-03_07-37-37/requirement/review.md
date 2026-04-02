## 발견사항

### **[CRITICAL]** `layout` 기본값 불일치 — 스펙/프론트엔드 `card` vs 핸들러 `horizontal`
- **위치**: `carousel.handler.ts:57`, `spec/4-nodes/6-presentation-nodes.md` §1.1, `presentation-configs.tsx` layout SelectField
- **상세**: 스펙은 `layout` 기본값을 `card`로 정의하고, 프론트엔드도 `"card"`를 기본값으로 사용한다. 그러나 핸들러는 `'horizontal'`을 기본값으로 사용하며, 이 값은 스펙의 허용 값(`card` / `image` / `minimal`) 목록에도 포함되지 않는다. 테스트 역시 `'horizontal'`을 기대하도록 잘못 작성되어 있어 스펙 위반을 검증하지 못한다.
- **제안**: 핸들러를 `?? 'card'`로 수정하고, 테스트도 `'card'`를 기대하도록 수정

---

### **[WARNING]** Dynamic 모드에서 `descriptionField` 유효성 검증 누락
- **위치**: `carousel.handler.ts:validate()`, spec §1.1 Config 표
- **상세**: 스펙은 `descriptionField`를 dynamic 모드에서 필수(`✓`)로 정의하지만, `validate()`는 `titleField`만 검증한다. `descriptionField` 미지정 시 execute에서 빈 문자열로 처리되어 조용히 통과되며, 설정 오류가 조기에 노출되지 않는다.
- **제안**: dynamic 모드 validate 블록에 `descriptionField` 존재 및 string 타입 검사 추가

---

### **[WARNING]** Dynamic 모드 배열 자동 탐색 미구현
- **위치**: `carousel.handler.ts:execute()` dynamic 분기, spec §1.3 실행 로직 3-1
- **상세**: 스펙은 "최상위가 배열이 아닌 경우 배열 필드 자동 탐색"을 명시하지만, 구현은 단순히 `[input]`으로 래핑한다. 예를 들어 `{ items: [...] }` 형태의 입력이 들어오면 슬라이드가 1개짜리 배열로 잘못 처리된다.
- **제안**: 입력이 객체인 경우 값이 배열인 첫 번째 키를 자동 탐색하는 로직 추가, 또는 스펙에서 이 요구사항을 명시적으로 완화

---

### **[WARNING]** 캔버스 요약 포맷 — Static 모드 미정의
- **위치**: `spec/4-nodes/6-presentation-nodes.md` §7 캔버스 요약
- **상세**: 스펙 §7의 Carousel 요약 포맷은 `{layout} · {titleField}`로 정의되어 있어 dynamic 모드에만 적용 가능하다. Static 모드에서는 `titleField`가 없으므로 캔버스 요약 렌더링이 빈 값 또는 예외 상황이 된다. 스펙과 구현 모두 이 케이스를 다루지 않는다.
- **제안**: 스펙 §7에 static 모드 요약 포맷 추가 (예: `{layout} · {N} items`), 프론트엔드 캔버스 요약 컴포넌트에 반영

---

### **[INFO]** `execute()` 시그니처에서 `_context` 미사용 의도적 처리
- **위치**: `carousel.handler.ts:execute()`
- **상세**: static 모드의 표현식 해석은 "실행 엔진이 사전 해석"한다는 스펙에 따라 핸들러 내에서 context를 사용하지 않는 것은 설계상 의도된 것이다. eslint disable 주석으로 명시되어 있어 문제없다.

---

### **[INFO]** `execution-engine.service.spec.ts` — eslint 주석 정리만 포함
- **위치**: 파일 전체
- **상세**: 변경 내용은 불필요한 eslint-disable 주석 제거뿐이며 기능에 영향 없다.

---

## 요약

이번 변경은 Carousel 노드에 Static/Dynamic 이중 모드를 추가하는 기능으로, 스펙·핸들러·프론트엔드·테스트가 전반적으로 잘 정합되어 있다. 그러나 `layout` 기본값이 스펙(`card`)과 구현(`horizontal`) 사이에 불일치하며, `horizontal`은 허용 값 목록에도 없어 런타임에서 예상치 못한 렌더링이 발생할 수 있다. 추가로 dynamic 모드에서 `descriptionField` 유효성 검증 누락, 배열 자동 탐색 미구현, static 모드의 캔버스 요약 미정의 등 스펙과 구현 간 공백이 존재한다.

## 위험도

**HIGH**