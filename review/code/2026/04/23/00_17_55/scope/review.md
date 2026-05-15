### 발견사항

- **[INFO]** 단일 PR에 3개의 독립적 서브피처 번들
  - 위치: 전체 변경
  - 상세: (A) UNKNOWN_NODE_TYPE/LABEL_CONFLICT/NODE_NOT_FOUND 에러 enrichment, (B) 2-stage finish self-review, (C) get_node_schema 중복 조회 가드가 하나의 변경에 묶여 있음. 각각은 독립적으로 배포·롤백 가능한 단위임
  - 제안: 기능 자체는 모두 동일한 메타 목표("LLM 낭비 라운드 감소")를 공유하므로 묶는 것이 수용 가능하나, 향후에는 커밋 단위로 분리하면 git blame·bisect가 용이

- **[INFO]** `recordFailedAddNode`가 `CONTAINER_INVALID_CHILD` 및 `INVALID_EXPRESSION` 케이스에도 호출됨
  - 위치: `shadow-workflow.ts` — `addNode` 내 `containerId` 체크 및 `exprCheck` 블록
  - 상세: 이 두 케이스는 노드가 실제로 생성되지 않으므로 이후 add_edge 실패 시 cascading hint를 주는 것은 기술적으로 올바름. 그러나 PR 설명이나 주석에 명시적으로 언급되지 않아 의도가 모호하게 보일 수 있음
  - 제안: 동작은 정확하므로 수정 불필요. 다만 `recordFailedAddNode` 호출 지점 주석에 "모든 add_node 실패 경로에서 호출됨"을 명시하면 명확성 향상

- **[INFO]** `levenshtein` 함수 로컬 구현 포함
  - 위치: `shadow-workflow.ts` 하단 (파일 내 module-level 함수)
  - 상세: 외부 패키지 의존을 피하기 위한 인라인 구현임이 주석에 명시되어 있어 의도적 선택임을 알 수 있음. 요청 기능을 지원하기 위한 필요 코드로 over-engineering에 해당하지 않음
  - 제안: 없음

- **[INFO]** `FinishGuardError` 타입이 `interface`에서 discriminated union으로 변경
  - 위치: `workflow-assistant-stream.service.ts:45-66`
  - 상세: `WORKFLOW_REVIEW_REQUIRED` 케이스 추가를 위한 필요 최소 변경. 기존 `PLAN_NOT_COMPLETE` 분기의 동작은 그대로 유지됨
  - 제안: 없음

- **[INFO]** `PENDING_USER_CONFIG_UNMENTIONED` 체크가 text가 비어있을 때의 엣지케이스
  - 위치: `review-workflow.ts` — `collectUnmentionedPendingUserConfig`
  - 상세: `if (text && text.includes(node.label)) continue;` — text가 빈 문자열("")이면 `&&` 단락평가로 includes를 건너뛰어 label이 언급되지 않은 것으로 처리됨. 이는 올바른 동작(텍스트가 없으면 언급 없음으로 취급)이나 의도가 명확하지 않을 수 있음
  - 제안: `if (text.includes(node.label)) continue;`로 단순화 가능 (빈 문자열의 includes는 항상 false이므로 동작 동일)

---

### 요약

8개 파일 변경 모두 "LLM 자체 오류 복구 능력 향상"이라는 단일 기능 목표에 직접 기여한다. 무관한 리팩토링, 불필요한 포맷팅 변경, 사용하지 않는 임포트, 의도 밖 파일 수정은 존재하지 않는다. 세 가지 서브피처(에러 enrichment / 2-stage finish review / schema 중복 조회 가드)가 하나의 변경에 번들되어 있으나, 동일 맥락 내에서 상호 보완적으로 설계되어 있어 범위 이탈보다는 피처 응집으로 평가된다. `review-workflow.ts`는 신규 파일로 기존 코드에 대한 불필요한 수정 없이 명확하게 분리되어 있다.

### 위험도

**NONE**