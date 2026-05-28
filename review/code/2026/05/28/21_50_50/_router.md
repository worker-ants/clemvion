{
  "router_version": 2,
  "decided_at": "2026-05-28T21:55:30Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "Webhook 인증 4가지 방식(HMAC/Bearer/API Key/Basic) 정의, 타이밍 공격 방지(timingSafeEqual), 단일 실패 메시지, IP 화이트리스트, 암호화 정책 — 보안 영향 큼"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "fire-and-forget 갱신 언급만 있고 성능 임계값·최적화 변경 없음"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "Webhook 인증 진입점을 AuthConfig 로 통일(단일 SoT), inline auth path 제거, 모듈 책임 분리(secret store vs direct transformer) — 아키텍처 경계 변경"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): spec 본문 변경으로 요구사항 일관성 검증 필수"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): spec 변경의 의도 범위(webhook auth 정의) vs 실제 영향(AuthConfig, trigger 데이터모델) 검증"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): 클린업 migration V065(inline auth 제거), trigger.auth_config_id FK 유입, auth_config.last_used_at 갱신 부작용 검증"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): 인증 검증 로직 중앙화(AuthConfig), 문서화 충분성, 신규 타입(api_key/basic_auth) 스키마 명확성"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): 신규 인증 방식 4종·IP 화이트리스트·fire-and-forget 갱신·V065 마이그레이션 등 복합 테스트 시나리오 필요"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): spec 4건 변경(auth.md, webhook.md, secret-store.md, data-flow/triggers.md)"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json/requirements 변경 없음"
    },
    {
      "name": "database",
      "selected": true,
      "reason": "V065 마이그레이션(trigger.config 정리), AuthConfig SELECT(decrypt config) + UPDATE(last_used_at), 스키마 이해도 필요 — 데이터베이스 검토"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "fire-and-forget 업데이트는 비동기·락 없음(last-write-wins), 동시성 보호 로직 변경 없음"
    },
    {
      "name": "api_contract",
      "selected": true,
      "reason": "Webhook auth 응답 코드(202/401), 단일 메시지 AUTH_FAILED(enumeration 방지), IP 화이트리스트 동작 명세 — API 계약 변경"
    },
    {
      "name": "user_guide_sync",
      "selected": false,
      "reason": "PROJECT.md 갱신 매트릭스 trigger-dir와 매칭되나, 本PR 은 spec-only(구현 없음) — 실제 코드 변경 후 동반 필요"
    }
  ],
  "selected_count": 10,
  "skipped_count": 4,
  "forced": [
    "documentation",
    "requirement",
    "scope",
    "side_effect",
    "maintainability",
    "testing"
  ]
}
