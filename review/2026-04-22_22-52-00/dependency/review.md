### 발견사항

- **[INFO]** 새 내부 모듈 `recover-leaked-plan.ts` 추가
  - 위치: `backend/src/modules/workflow-assistant/tools/recover-leaked-plan.ts`
  - 상세: 완전히 standalone 순수 함수 모듈. `import` 문이 전혀 없고, 표준 JS 내장(`JSON.parse`, `Set`, string 연산)만 사용. 번들 크기·빌드 시간 영향 없음.
  - 제안: 현 상태 유지 적절

- **[INFO]** `workflow-assistant-stream.service.ts` → `./tools/recover-leaked-plan` 내부 의존 추가
  - 위치: `workflow-assistant-stream.service.ts:30`
  - 상세: 단방향 의존 (`service → tool`). `recover-leaked-plan.ts`가 어떤 모듈도 import하지 않으므로 순환 의존 가능성 없음. `tools/` 디렉토리에 위치하는 것은 기존 패턴(shadow-workflow, active-plan-context 등)과 일관됨.
  - 제안: 문제 없음

- **[INFO]** `recoverLeakedPlan` 호출 위치 중복 외관
  - 위치: diff `+637` 영역과 전체 파일 컨텍스트 내 동일 로직
  - 상세: diff에 같은 블록이 두 번 나타나지만, 전체 파일 컨텍스트 기준으로는 단일 위치(턴 종료 직전)에서만 한 번 호출됨. 의존성 중복은 아님.
  - 제안: 확인 완료, 실제 중복 아님

---

### 요약

이번 변경에서 새로 추가된 외부 패키지·라이브러리는 전혀 없다. 유일한 의존성 변화는 `recover-leaked-plan.ts`라는 내부 유틸 모듈 신설과 이를 `workflow-assistant-stream.service.ts`에서 import하는 것뿐이며, 해당 모듈은 외부 의존성 없이 표준 JS만으로 구현된 순수 함수다. 내부 의존 그래프는 단방향이고 순환이 없으며 기존 `tools/` 디렉토리 패턴과 일치한다.

### 위험도

**NONE**