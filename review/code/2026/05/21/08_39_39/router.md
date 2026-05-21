{
  "router_version": 2,
  "decided_at": "2026-05-21T08:45:12Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "메타데이터 배열 추가만, 반복문/I/O/캐시 변경 없음"
    },
    {
      "name": "architecture",
      "selected": false,
      "reason": "동일 구조 내 메타데이터 row 추가, 모듈 경계/인터페이스 변경 없음"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): 문서 파일(.md) 변경 포함 — spec 카탈로그 + plan + consistency review 11건"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json/package-lock.json 변경 없음"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "마이그레이션/ORM 호출 변경 없음"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/await, Promise, 락/뮤텍스 코드 변경 없음"
    },
    {
      "name": "api_contract",
      "selected": true,
      "reason": "Cafe24 API operation metadata 236개 추가 — HTTP 메서드/경로/응답 스키마 정의 변경"
    }
  ],
  "selected_count": 8,
  "skipped_count": 5,
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
