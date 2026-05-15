### 발견사항

- **[INFO]** 외부 패키지 추가 없음 — Levenshtein 로컬 구현
  - 위치: `shadow-workflow.ts` 하단 `levenshtein()` 함수
  - 상세: `fast-levenshtein`, `leven` 등 외부 패키지를 쓰지 않고 rolling two-row DP로 직접 구현. 코드 주석에도 "외부 패키지 의존을 피해 로컬 구현"으로 명시. 입력 문자열이 노드 타입명(< 30자) 수준이고 카탈로그도 수십 개라 O(m×n)의 비용이 미미하므로 적절한 판단.
  - 제안: 현 상태 유지. 라이브러리 도입이 필요한 수준의 복잡도가 아님.

- **[INFO]** 신규 내부 모듈 `review-workflow.ts` 도입
  - 위치: `workflow-assistant-stream.service.ts` import 블록
  - 상세: `review-workflow.ts`의 의존 그래프: `workflow-assistant-message.entity` + `shadow-workflow` + `detect-pending-user-config`. 셋 모두 기존 내부 모듈이며 순환 의존 없음. 서비스 레이어가 `collectPendingUserConfig`를 콜백으로 주입하는 DI 패턴을 써서 `review-workflow`가 서비스 자체를 역참조하지 않는 구조도 깔끔.
  - 제안: 현 상태 유지.

- **[INFO]** `node:crypto` (기존 의존)는 변경 없음
  - 상세: `randomUUID` 는 이미 사용 중이던 Node.js 내장 모듈. 이번 변경으로 추가 사용처 없음.

---

### 요약

이번 변경은 의존성 관점에서 완전히 안전하다. 외부 패키지가 단 하나도 추가되지 않았으며, Levenshtein 알고리즘을 로컬 구현으로 처리해 번들 크기·라이선스·취약점 이슈를 원천 차단했다. 신규 `review-workflow.ts` 모듈은 기존 내부 모듈만 의존하고 순환 참조가 없으며, DI 패턴으로 서비스 레이어와의 결합도도 낮게 유지된다.

### 위험도
**NONE**