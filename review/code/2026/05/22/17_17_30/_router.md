{
  "router_version": 2,
  "decided_at": "2026-05-22T17:17:30Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 — 코드 변경 시 항상 적용"
    },
    {
      "name": "performance",
      "selected": true,
      "reason": "JSON 파싱·1MB cap tail truncate·defaults deep-merge 작업 — 성능 영향 검토 필요"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "신규 RenderToolProvider 클래스·AgentToolProvider 인터페이스 확장·dispatcher 5-prefix 분류 체계 신설"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): spec 본문 변경 + 소스 코드 변경 — 요구사항 일관성 검증 필수"
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
      "reason": "agents_forced (router_safety): 문서 파일(.md/.mdx) 변경 — 14건 (spec/4-nodes/*, plan/*, codebase/frontend/src/content/docs/*)"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json / requirements*.txt / go.mod 등 의존성 선언 파일 변경 없음"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "migrations/ / *.sql / prisma/schema* / repository/ORM 호출 변경 없음"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/await·Promise·락·뮤텍스·워커·큐 코드 변경 없음 — dispatcher 분류·zod validate·defaults merge는 동기 작업"
    },
    {
      "name": "api_contract",
      "selected": false,
      "reason": "HTTP route/controller·GraphQL schema·swagger/openapi 변경 없음 — WebSocket spec 갱신은 plan 단계만"
    },
    {
      "name": "user_guide_sync",
      "selected": true,
      "reason": "PROJECT.md §변경 시 동반 갱신 매트릭스의 AI Agent trigger 디렉토리 변경 (codebase/backend/src/nodes/ai/ai-agent/**, spec/4-nodes/3-ai/1-ai-agent.md)"
    }
  ],
  "selected_count": 11,
  "skipped_count": 3,
  "forced": [
    "security",
    "requirement",
    "scope",
    "side_effect",
    "maintainability",
    "testing",
    "documentation"
  ]
}
