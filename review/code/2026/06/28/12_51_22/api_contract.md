### 발견사항

- **[INFO]** Webhook 본문 크기 제한 분기 문서화 — 하위 호환성 고려 필요
  - 위치: `triggers.en.mdx` L39 / `triggers.mdx` L83
  - 상세: 공개 webhook 32KB vs 인증 webhook 1MB(미구현)로 분기됨. 에러 코드가 `413 Payload Too Large` + `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 신규 도입. 기존 클라이언트가 단순 413으로만 처리하던 경우 에러 코드 파싱이 달라질 수 있으나, HTTP 상태코드 자체(413)는 동일하게 유지되므로 프로토콜 레벨 breaking change 없음. 단, 클라이언트가 에러 봉투의 code 필드로 분기하는 경우 신규 code 값 처리 필요.
  - 제안: API 가이드에 에러 봉투 스키마(`{ code, message }`)가 명시되어 있는지 확인. 에러 코드 열거형에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 추가 여부를 클라이언트 SDK·문서에 반영 검토.

- **[INFO]** 429 rate limit 수치 변경(per-trigger 60 → global 100 req/min)
  - 위치: `triggers.en.mdx` L49 / `triggers.mdx` L93
  - 상세: 정책 범위(per-trigger → instance-wide global)와 수치(60 → 100)가 모두 변경됨. HTTP 상태코드 429는 유지되므로 프로토콜 breaking change 없음. 단, 클라이언트가 per-trigger 60 가정으로 버스팅 로직이나 Retry-After 계산을 구현했다면 동작이 달라질 수 있음. 현재 문서 및 응답에 `Retry-After` 헤더·limit scope 정보가 없어 클라이언트가 새 정책을 자동 감지하기 어려움.
  - 제안: 429 응답에 `Retry-After` 헤더 또는 응답 본문에 `rateLimit: { scope, limit, resetAt }` 정보 추가 검토. 단기적으로 문서에 "instance-wide, 100 req/min" 명시는 이번 변경으로 완료됨.

- **[INFO]** Inbound command 429 RATE_LIMITED 미구현(Planned) 마킹
  - 위치: `triggers.en.mdx` L59 / `triggers.mdx` L103
  - 상세: 문서에 "(Planned — not yet implemented)" 명시 추가는 현재 미구현 사실의 정직한 반영. API 계약 관점에서 클라이언트가 이 상태코드를 신뢰하고 구현해도 현재는 발생하지 않는다는 점이 명확히 전달됨. 향후 구현 시 문서·spec 수치(60건/분) 재검토 필요.
  - 제안: 구현 plan(`spec-sync-external-interaction-api-gaps.md`)에 "EIA inbound rate-limit 구현 시 문서 수치 재검토 의무" 체크리스트 항목 확인.

### 요약

이번 변경은 실제 API 코드가 아닌 사용자 문서(MDX) 수정에 한정된다. 변경된 세 항목(webhook 본문 크기 분기, 429 rate limit 정책, inbound RATE_LIMITED 미구현 마킹) 모두 HTTP 상태코드 계약은 그대로 유지하고 있어 프로토콜 레벨 breaking change는 없다. 단, `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 에러 코드 신규 도입과 rate limit 정책 변경(scope + 수치)은 클라이언트 측 에러 처리 로직·버스팅 로직에 영향을 줄 수 있으므로, `Retry-After` 헤더 및 에러 봉투 스키마 문서화를 추가 검토하는 것이 권장된다. 전반적으로 API 계약 위험도는 낮다.

### 위험도
LOW
