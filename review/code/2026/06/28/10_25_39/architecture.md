# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### 파일 1 & 2: triggers.en.mdx / triggers.mdx

- **[INFO]** `endpointPath` 예시값을 `"uuid-or-slug"` 에서 실제 v4 UUID 형식인 `"550e8400-e29b-41d4-a716-446655440000"` 으로 교체하고 서버 강제 사항임을 주석으로 명시한 변경
  - 위치: triggers.en.mdx L234, triggers.mdx L199
  - 상세: 아키텍처 관점에서 이 변경은 "API 계약이 slug를 허용하는가, UUID만 허용하는가" 라는 **계약 경계 정의** 수정이다. 기존 `"uuid-or-slug"` 표현은 두 형식을 모두 허용하는 것처럼 읽혔으나, 실제 서버는 v4 UUID만 강제한다는 사실을 문서가 잘못 기술하고 있었다. 이번 수정으로 문서가 구현 계약과 정합해진다. 확장성 관점에서도 slug 지원을 열어 두는 것처럼 읽히면 추후 "왜 slug가 안 되는가" 라는 오해 기반 구현 요청을 방지할 수 있으므로 정확한 표현이다.
  - 제안: 추가 조치 불필요. 다만 `spec/5-system/12-webhook.md` 의 `endpointPath` 포맷 제약 조항(UUID-only 강제 근거)과 본 문서 설명이 일치하는지 스펙 수준에서 교차 확인 권장.

### 파일 3: spec/5-system/16-system-status-api.md

- **[INFO]** `workspace-invitations-pruner` 큐를 `system` 그룹 레지스트리에 추가
  - 위치: spec/5-system/16-system-status-api.md, 큐 레지스트리 표 신규 행
  - 상세: 아키텍처 관점에서 이 큐의 성격과 그룹 배치는 올바르다. `workspace_invitation` 만료·미수락 정리는 순수 내부 정합 보강(reconciliation) 성격이고 외부 연동 호출이 없으므로 `system` 그룹이 적합하다. `login-history-pruner` 와 동일한 패턴(repeatable cron, system group)을 따르므로 기존 설계 일관성이 유지된다. cron 표현식 `0 4 * * *` Asia/Seoul 시간대 명시는 운영 맥락에서 유용한 정보다.
  - 제안: 추가 조치 불필요. 단, spec 자체의 SoT 주의(`QueueRegistry` 의 단일 진실은 `spec/data-flow/0-overview.md §4`)에 따라, `data-flow/0-overview.md §4 BullMQ 큐 카탈로그` 에 `workspace-invitations-pruner` 가 이미 등재되어 있는지 확인하는 것이 원칙이다. 본 변경이 카탈로그 선행 갱신 없이 레지스트리 요약에만 추가된 경우 SoT 역전 위험이 있다.

- **[WARNING]** 신규 큐 `workspace-invitations-pruner` 가 기존 구현 갭 추적 주석(`⚠ 구현 갭`) 범위에 포함되어 있는지 미명시
  - 위치: spec/5-system/16-system-status-api.md L1076 (`⚠ 구현 갭` 주석)
  - 상세: 현재 `⚠ 구현 갭` 주석은 `agent-memory-extraction`의 `MONITORED_QUEUES` 미등재를 추적한다. 신규 `workspace-invitations-pruner` 가 코드 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 이미 등재되었는지 여부가 본 변경에서 명확하지 않다. 등재 누락 시 모니터링 사각지대가 생긴다.
  - 제안: 코드 `codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES` 배열에 `workspace-invitations-pruner` 가 포함되었는지 확인한다. 미포함 시 `⚠ 구현 갭` 주석에 해당 큐도 함께 나열하거나, 코드 동기화 작업을 진행한다.

## 요약

이번 변경은 세 파일 모두 소규모 명세/문서 수정이며, 아키텍처 구조 자체를 변경하지 않는다. `triggers.*.mdx` 의 `endpointPath` 예시 수정은 API 계약 경계를 문서와 구현 간에 정합시키는 정확한 수정으로 아키텍처 관점에서 문제가 없다. `16-system-status-api.md` 의 큐 레지스트리 신규 항목은 기존 `system` 그룹 패턴을 일관되게 따르며 책임 구분도 적절하다. 다만 spec 문서의 "SoT 주의" 원칙에 따라 `data-flow/0-overview.md §4` 카탈로그가 선행 갱신되었는지, 그리고 코드 `MONITORED_QUEUES` 동기화가 완료되었는지 실행 수준에서 교차 확인이 필요하다.

## 위험도

LOW
