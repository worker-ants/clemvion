{
  "router_version": 2,
  "decided_at": "2026-05-25T02:13:28Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "ExecutionRouting Map/shallow-merge 는 O(1), 반복문·I/O 변경 없음"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "ExecutionRoutingContext 인터페이스 신설 + Map 레지스트리 패턴 도입 — 이벤트 아키텍처 보강"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): 문서 파일 변경 (plan + consistency 보고서)"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json / requirements.txt 등 의존성 파일 변경 없음"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "migrations / SQL / ORM repository 호출 변경 없음"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/await·Promise·Lock/뮤텍스·워커/큐·setInterval 변경 없음; RxJS Subject 은 기존 메커니즘"
    },
    {
      "name": "api_contract",
      "selected": false,
      "reason": "HTTP route·GraphQL·Swagger·wire envelope 변경 없음; 내부 fanout envelope 만 추가"
    },
    {
      "name": "user_guide_sync",
      "selected": false,
      "reason": "backend 회귀 fix only — wire envelope shape 보존 (WS spec §4.4), 사용자 가시 변경 없음"
    }
  ],
  "selected_count": 9,
  "skipped_count": 5,
  "forced": [
    "security",
    "maintainability",
    "requirement",
    "scope",
    "side_effect",
    "testing",
    "documentation"
  ]
}
