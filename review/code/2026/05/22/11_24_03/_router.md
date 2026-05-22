{
  "router_version": 2,
  "decided_at": "2026-05-22T11:24:03Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "SecretResolver 호출은 필요 지점에만 — I/O 루프·캐싱 문제 없음"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "SecretStoreModule 신규 + ChatChannelModule/ExternalInteractionModule 에 import — 모듈 경계 변경"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): spec 변경 + 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): ChatChannelConfig/SetupResult 시그니처 변경 + 모듈 import 추가"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 소스 코드 변경 시 항상 적용"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 신규 src 코드 + 광범위 spec 파일 변경"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): package-lock.json 동반 + spec/plan 문서 변경"
    },
    {
      "name": "dependency",
      "selected": true,
      "reason": "agents_forced (router_safety): package-lock.json 변경 — chokidar/glob-parent/readdirp/uglify-js"
    },
    {
      "name": "database",
      "selected": true,
      "reason": "agents_forced (router_safety): V063__secret_store.sql 마이그레이션 + SecretStore entity"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/await 패턴 표준적 — 락/뮤텍스/워커/큐 변경 없음"
    },
    {
      "name": "api_contract",
      "selected": false,
      "reason": "HTTP 라우트 변경 없음 — 내부 helper 패턴만 변경 (setupChannel/teardownChannel 반환값 분리)"
    },
    {
      "name": "user_guide_sync",
      "selected": true,
      "reason": "SECRET_STORE 신규 모듈 + chat-channel 기능 확대 — PROJECT.md 매트릭스 검증 필요"
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
    "documentation",
    "dependency",
    "database"
  ]
}
