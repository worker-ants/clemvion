{
  "router_version": 2,
  "decided_at": "2026-05-25T12:57:33Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "순동기 문자열 처리 — I/O·반복·집계 없음"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "신규 shared helper modules (execution-failure-classifier, language-hint-defaults) 추가 — 멀티 provider 간 의존 구조"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 + spec 본문 변경"
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
      "reason": "agents_forced (router_safety): 소스 코드 변경 + 신규 test spec 파일"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): .mdx/.md 문서 파일 변경"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json/lock 파일 변경 없음"
    },
    {
      "name": "database",
      "selected": false,
      "reason": "DB 마이그레이션·SQL·ORM 호출 변경 없음"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/await·Promise·락·워커 코드 없음 — 순동기만"
    },
    {
      "name": "api_contract",
      "selected": true,
      "reason": "ChatChannelConfigDto 에 languageLocale 필드 추가 + REST API DTO 검증 로직 변경"
    },
    {
      "name": "user_guide_sync",
      "selected": true,
      "reason": "integrations-config 제공자 문서(discord/slack/telegram.mdx) 신규 섹션 7 추가 — 동반 i18n dict 커버리지 검증 필요"
    }
  ],
  "selected_count": 10,
  "skipped_count": 4,
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
