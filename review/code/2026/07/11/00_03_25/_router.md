{
  "router_version": 2,
  "decided_at": "2026-07-11T04:30:00Z",
  "decisions": [
    {
      "name": "security",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제"
    },
    {
      "name": "performance",
      "selected": false,
      "reason": "DB lookup 1건 추가는 minor overhead, 성능 이슈 미감지"
    },
    {
      "name": "architecture",
      "selected": true,
      "reason": "신규 순수 모듈 `waiting-surface-guard.ts` + `resolveWaitingNodeExecutionId` 시그니처 확장"
    },
    {
      "name": "requirement",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제"
    },
    {
      "name": "scope",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제"
    },
    {
      "name": "side_effect",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제 — 시그니처 변경, 에러 처리 흐름 변경"
    },
    {
      "name": "maintainability",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제"
    },
    {
      "name": "testing",
      "selected": true,
      "reason": "agents_forced (router_safety): src 변경 시 강제 + 신규 spec 파일 추가"
    },
    {
      "name": "documentation",
      "selected": true,
      "reason": "agents_forced (router_safety): plan/in-progress + review/consistency 문서 변경"
    },
    {
      "name": "dependency",
      "selected": false,
      "reason": "package.json 또는 의존성 파일 변경 없음"
    },
    {
      "name": "database",
      "selected": true,
      "reason": "repository 호출 변경 — nodeRepository.findOne() 신규 조회 추가"
    },
    {
      "name": "concurrency",
      "selected": false,
      "reason": "async/락/뮤텍스 새로운 동시성 변경 없음 (async 함수는 기존)"
    },
    {
      "name": "api_contract",
      "selected": true,
      "reason": "interaction.controller.ts API 응답 설명 변경(409 조건 확장), EIA 에러 표면 확대"
    },
    {
      "name": "user_guide_sync",
      "selected": false,
      "reason": "매트릭스 trigger 디렉토리 미매칭, 실제 사용자 가이드 문서 변경 없음"
    }
  ],
  "selected_count": 10,
  "skipped_count": 4,
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
