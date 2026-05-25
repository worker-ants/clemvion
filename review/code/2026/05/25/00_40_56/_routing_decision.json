{
  "router_version": 2,
  "decided_at": "2026-05-25T00:40:56.000Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 인증 gate (shutdown 상태 검사) + graceful shutdown 으로 in-flight 실행 추적"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "반복 I/O·집계·캐시 변경 없음. Recovery stale threshold 는 성능 튜닝이 아닌 reliability logic"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "ShutdownStateService 신규 module 계층 추가 — DI 설정, 다중 인스턴스 coordination 패턴"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경. Spec 5-system/4-execution-engine.md 갱신으로 graceful shutdown / recovery 정책 변경"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경. Recovery 대상을 WAITING_FOR_INPUT 제외로 축소, shutdown lifecycle 추가"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경. SIGTERM 수신 시 새 execution 거부 (503), in-flight drain wait, 전역 shutdown state 도입"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경. 새 service (ShutdownStateService) + recovery 로직 재구성 + lifecycle hook 추가"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경. 신규 ShutdownStateService 테스트 + recoverStuckExecutions 테스트 갱신 필요"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): Plan/spec 문서 변경 29건 — workflow-resumable-execution 계획 및 spec Phase 0 반영 검토"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json / requirements 변경 없음. BullMQ 는 기존 인프라"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "DB migration 파일 없음. 쿼리 로직만 변경 (WAITING_FOR_INPUT 제외 추가) — schema 무변경"
    },
    {
      "name": "concurrency",
      "selected": true,
      "reason": "Graceful shutdown async/await orchestration — grace period 대기, in-flight drain, finally 블록 보장 + multi-instance coordination"
    },
    {
      "name": "api_contract",
      "selected": true,
      "reason": "HTTP 503 SERVICE_UNAVAILABLE gate 신설 + WS ack payload `queued: boolean` 필드 추가"
    },
    {
      "name": "user_guide_sync",
      "selected": true,
      "reason": "Plan self-hosting-deployment.md 에 Kubernetes `terminationGracePeriodSeconds` 설정 항목 추가 — PROJECT.md 매트릭스 trigger 확인 필요"
    }
  ],
  "selected_count": 12,
  "skipped_count": 2,
  "forced": ["security", "requirement", "scope", "side_effect", "maintainability", "testing", "documentation"]
}
