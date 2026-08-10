{
  "router_version": 2,
  "decided_at": "2026-08-10T10:54:59Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "모듈 조직 변경만, 반복문·I/O·캐시 변경 없음"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "모듈 경계 변경 — 공유 심볼을 중립 모듈로 이관, 두 가드 간 결합 제거"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 신규 소스 코드 + 74건 테스트 추가"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): plan 문서 변경 (실측 결과 및 진행 현황)"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json·lock 파일 변경 없음"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "마이그레이션·쿼리·ORM 호출 변경 없음"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/Promise/락/큐/타이머 변경 없음"
    },
    {
      "name": "api_contract",
      "selected": false,
      "reason": "HTTP route·GraphQL·swagger 변경 없음, 내부 헬퍼만"
    },
    {
      "name": "user_guide_sync",
      "selected": false,
      "reason": "내부 헬퍼·테스트 파일 변경만, doc-sync-matrix trigger 매칭 없음"
    }
  ],
  "selected_count": 8,
  "skipped_count": 6,
  "forced": [
    "documentation",
    "maintainability",
    "requirement",
    "scope",
    "security",
    "side_effect",
    "testing"
  ]
}
