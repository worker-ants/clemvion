### 발견사항

- **[WARNING]** `buildReviewChecklist` docstring의 체크 수 불일치
  - 위치: `review-workflow.ts` — `buildReviewChecklist` 함수 JSDoc
  - 상세: 함수 설명에 "여섯 개 점검을 순차 실행" 이라고 쓰여 있고 열거 목록도 6개(`UNRESOLVED_FAILED_CALLS` → `REQUEST_COVERAGE_LOW`)인데, `NODE_CONFIG_WARNINGS` 추가로 실제 실행되는 점검은 7개다. 섹션 헤더(`점검 6) NODE_CONFIG_WARNINGS`, `점검 7) REQUEST_COVERAGE_LOW`)는 정확히 갱신됐지만 함수 docstring은 누락됨.
  - 제안: `buildReviewChecklist` docstring을 "일곱 개 점검"으로 수정하고 목록에 `6) NODE_CONFIG_WARNINGS` 항목을 삽입.

- **[WARNING]** `DANGLING_PORT_LABEL_MAX_LEN` 상수를 의미적으로 다른 컨텍스트에서 재사용
  - 위치: `review-workflow.ts` — `buildReviewChecklist` 내 `configWarnings` summary 빌드 구간
  - 상세: `DANGLING_PORT_LABEL_MAX_LEN`은 DANGLING_OUTPUT_PORTS 검사용으로 명명된 상수인데, NODE_CONFIG_WARNINGS의 `nodeLabel`·경고 메시지 truncation에도 그대로 사용된다. 기능적으로는 문제없으나 이름이 목적을 오도한다.
  - 제안: `configWarnings` 요약 전용 상수를 별도 선언하거나, 기존 상수를 `REVIEW_LABEL_MAX_LEN` 같은 범용 이름으로 rename.

- **[WARNING]** `workflow-assistant-stream.service.spec.ts` 전체 미검토
  - 위치: 파일 5
  - 상세: diff가 프롬프트 크기 제한으로 생략되어 해당 파일의 변경 범위 적정성을 판단할 수 없다. 스트림 서비스 스펙 파일은 NODE_CONFIG_WARNINGS와 직접 연결된 통합 테스트를 포함할 가능성이 높아 범위 이탈 여부 확인이 필요하다.
  - 제안: diff를 별도로 확인해 NODE_CONFIG_WARNINGS 관련 테스트 외에 무관한 수정이 섞여 있지 않은지 검증.

- **[INFO]** `system-prompt.ts` STATIC_BLOCK 내용이 크기 제한으로 일부 잘림
  - 위치: `system-prompt.ts` — STATIC_BLOCK_3 이후
  - 상세: `configWarnings` 교육 프롬프트가 실제로 포함됐는지 전체 파일을 확인할 수 없었다. `system-prompt.spec.ts`의 `'teaches the configWarnings → same-turn fix policy'` 테스트가 통과한다면 내용이 있다고 간주 가능하나 직접 확인 불가.
  - 제안: 파일 하단 STATIC_BLOCK_3~5를 직접 열람해 의도된 configWarnings 섹션이 존재하고 무관한 추가 변경이 없는지 확인.

- **[INFO]** `collectUnmentionedPendingUserConfig` 내 TODO(ED-AI-39) 주석
  - 위치: `review-workflow.ts` — `collectUnmentionedPendingUserConfig` 함수
  - 상세: 이번 변경 범위(`NODE_CONFIG_WARNINGS` 추가)와 무관한 기존 TODO 주석이지만, 코드 자체는 변경되지 않아 범위 이탈은 아니다. 단지 지저분한 이전 주석.
  - 제안: 해당 TODO가 이번 커밋에서 실수로 수정됐거나 새로 추가된 것인지 git blame으로 확인.

---

### 요약

변경의 핵심 범위 — `NODE_CONFIG_WARNINGS` 체크 추가(`review-workflow.ts`), 해당 테스트(`review-workflow.spec.ts`), 시스템 프롬프트 교육문 반영(`system-prompt.ts`·`system-prompt.spec.ts`) — 은 잘 격리되어 있고 의도와 무관한 리팩토링이나 기능 확장은 보이지 않는다. 주요 문제는 `buildReviewChecklist` docstring의 체크 수(6→7)가 갱신되지 않은 스테일 주석과, 범위 확인이 불가능한 `workflow-assistant-stream.service.spec.ts` 파일 두 가지다.

### 위험도

**LOW**