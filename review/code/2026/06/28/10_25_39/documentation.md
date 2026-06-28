### 발견사항

- **[INFO]** `endpointPath` 예시값이 placeholder에서 실제 UUID 형식으로 개선됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` 라인 36 / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 라인 198
  - 상세: `"uuid-or-slug"` → `"550e8400-e29b-41d4-a716-446655440000"` 으로 교체되고 인라인 주석 `// v4 UUID only (server-enforced)` (영문) / `// v4 UUID 전용 (서버가 형식 강제)` (한국어)가 추가됐다. 이 변경은 API 제약사항(서버가 UUID 형식을 강제 검증)을 문서 수준에서 명확히 드러낸다. 양 언어 파일이 동기화되어 있다.
  - 제안: 이 제약이 이전에 허용되던 `slug` 형식을 breaking change로 제거한 것이라면, 해당 변경의 배경(Rationale)이나 마이그레이션 안내가 본 문서 또는 spec에 없다. 기존 slug 기반 트리거를 사용하는 독자가 혼란을 겪지 않도록, `uuid-or-slug`가 v4 UUID 전용으로 좁혀진 시점과 이유를 한 줄 callout 또는 spec Rationale 섹션에 추가하는 것을 권장한다.

- **[INFO]** `workspace-invitations-pruner` 큐가 spec 레지스트리에 추가됨
  - 위치: `spec/5-system/16-system-status-api.md` 라인 26 (삽입)
  - 상세: 새 cron 큐가 `system` 그룹, concurrency 1(기본), `0 4 * * *` Asia/Seoul 스케줄로 등재됐다. 비고에 목적(`만료·미수락 workspace_invitation prune`)과 스케줄이 함께 기재되어 있어 정보 밀도가 적절하다.
  - 제안: 기존 다른 `repeatable cron` 항목 중 스케줄이 명시된 것은 `terminal-revoke-reconcile`(1분), `integration-expiry-scanner`(6h), `alerts-evaluator`(5분) 등이다. `login-history-pruner`, `notification-secret-rotator`, `chat-channel-token-rotator`는 스케줄이 비고에 없다. 일관성 관점에서 해당 항목에도 스케줄을 병기하거나, 스케줄 명시 기준을 spec Rationale에 설명하면 좋다. 이 이슈는 이번 변경에 새로 도입된 것이 아니나, 이번 추가로 불일치가 한 건 더 드러났다.

- **[INFO]** `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그와의 동기화 여부 확인 필요
  - 위치: `spec/5-system/16-system-status-api.md` SoT 주의 박스
  - 상세: 문서 자체가 "큐 목록의 단일 진실은 `spec/data-flow/0-overview.md §4` 다"라고 명시하고 있다. 이번에 추가된 `workspace-invitations-pruner`가 카탈로그(`§4`)와 코드 `MONITORED_QUEUES`에도 반영됐는지 이번 diff에서는 확인되지 않는다.
  - 제안: `spec/data-flow/0-overview.md §4` 및 `codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES`에도 동일 큐가 등재됐는지 검증이 필요하다. 미등재 시 기존 구현 갭 경고(agent-memory-extraction 선례)와 동일한 상황이 반복된다.

### 요약

이번 변경은 세 파일에 걸친 소규모 문서 개선이다. 영문·한국어 두 MDX 파일에서 `endpointPath` 예시가 실제 UUID 형식으로 교체되고 서버 강제 사항을 인라인 주석으로 명시한 것은 명확성 향상에 기여한다. spec 레지스트리에 `workspace-invitations-pruner` 큐를 추가한 변경은 스케줄·목적이 잘 기술되어 있으나, SoT인 `spec/data-flow/0-overview.md §4` 카탈로그 및 코드 상수와의 동기화 확인이 후속으로 필요하다. 전반적으로 독스트링·API 문서·인라인 주석 품질은 양호하며 Critical/Warning 수준의 문서화 결함은 없다.

### 위험도

LOW
