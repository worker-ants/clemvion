# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] 413 에러 응답의 분기 — 미구현 상태를 문서에 혼재
- 위치: `triggers.en.mdx` line 39/49, `triggers.mdx` line 548/558
- 상세: 공개 웹훅 32KB 한도(`PUBLIC_WEBHOOK_BODY_TOO_LARGE`)는 실제 구현된 행동이고, 인증 웹훅 1MB 한도는 "Planned — not yet implemented"로 표기됨. 동일한 413 상태 코드 행에 "구현됨"과 "미구현 예정"이 혼재하면 API 클라이언트 개발자가 어떤 케이스에서 413을 실제로 받을 수 있는지 혼동할 수 있음.
  - 특히 인증 웹훅 클라이언트 입장에서 "1MB 초과해도 현재는 통과하지만 언젠가 막힌다"는 사실이 명확히 전달되지 않으면, 추후 1MB 한도 시행 시 기존 클라이언트에 breaking change로 작용함.
- 제안: 413 응답 코드 테이블을 두 행으로 분리하거나, 인증 웹훅 1MB 한도 행에 명시적 "(현재 미시행 — 구현 후 enforced)" 주석을 추가. 또한 "Planned" 기능이 실제 배포될 때 문서 갱신 누락을 방지하도록 TODO 트래킹(예: spec 연결) 권장.

### [WARNING] 429 rate limit 수치 변경 — 기존 60 req/min → 글로벌 100 req/min (webhook 엔드포인트)
- 위치: `triggers.en.mdx` line 50, `triggers.mdx` line 559
- 상세: 이전 문서는 "per-trigger 60 req/min"이었고 변경 후 "global 100 req/min"으로 기재됨. 이는 단순 문서 표현 수정이 아닌 rate limit 정책 변경(주체: per-trigger → global, 수치: 60 → 100)을 의미. 
  - "global" rate limit이 워크스페이스 전체인지, 서버 전체인지, 엔드포인트 그룹인지 범위가 불명확.
  - 기존 클라이언트가 per-trigger 60 req/min을 기준으로 재시도 로직을 설계했다면, 실제 서버 동작이 변경되지 않은 상태에서 문서만 바뀐 경우 오해를 유발함.
- 제안: "글로벌"의 범위(워크스페이스 레벨인지, 인스턴스 레벨인지)를 명시. 실제 서버 구현과 문서의 수치가 일치하는지 스펙(`spec/5-system/12-webhook.md`)과 대조 확인 필요.

### [WARNING] inbound command 429 `RATE_LIMITED` — "Planned — not yet implemented" 표기 추가
- 위치: `triggers.en.mdx` line 59, `triggers.mdx` line 568
- 상세: inbound commands의 `429 RATE_LIMITED`(60 req/min per execution)에 "Planned — not yet implemented" 표기가 추가됨. 즉 현재 이 rate limit은 실제로 시행되지 않음을 명시. 
  - API 클라이언트가 현재 429를 받지 않는다는 사실을 몰랐다면 불필요한 재시도 로직을 구현했을 수 있음(기존 문서 기준). 반대로 지금 공개 문서에 "구현 예정"이라고 명시하면 API 클라이언트는 미래 행동을 대비해야 함.
  - 문서에 응답 코드로 등록된 상태이지만 실제로 반환되지 않는 코드가 존재한다는 점이 API 계약 일관성 훼손.
- 제안: 미구현 상태의 응답 코드는 별도 "예정 응답 코드" 섹션으로 분리하거나, 각 코드 옆에 일관된 표기(`[Planned]` 뱃지 등)를 추가해 현재 실제 반환 여부를 명확히 구분.

### [INFO] `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 에러 코드 신규 도입 — 기존 클라이언트 영향
- 위치: `triggers.en.mdx` line 39, `triggers.mdx` line 548
- 상세: 기존 413 에러는 제네릭 `Payload Too Large` 메시지였으나, 이제 공개 웹훅은 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 코드를 포함한 응답을 반환. 기존에 413 상태 코드만 처리하던 클라이언트에는 문제 없으나, 응답 바디의 에러 코드를 파싱하는 클라이언트라면 새 코드를 처리해야 함.
- 제안: 에러 응답 바디 구조(`{ code: "PUBLIC_WEBHOOK_BODY_TOO_LARGE", ... }`)를 문서에 명시하면 클라이언트 개발자의 적응이 쉬워짐. 기존 클라이언트 영향 범위는 낮으나 문서 보완 권장.

### [INFO] 413 공개 웹훅 32KB 한도 — 기존 1MB 기준 클라이언트에 대한 breaking change 가능성
- 위치: `triggers.en.mdx` line 39
- 상세: 기존 문서는 모든 웹훅에 1MB 한도를 적용했으나, 실제로는 공개 웹훅이 32KB로 제한됨. 만약 이 변경이 문서 수정이 아닌 서버 동작의 신규 제한이라면, 공개 웹훅으로 32KB~1MB 페이로드를 보내던 기존 클라이언트에게는 breaking change임.
- 제안: 32KB 제한이 신규 도입인지 기존부터 적용 중이었는지 스펙 이력 확인 필요. 신규 도입이라면 마이그레이션 가이드 또는 deprecation 공지 필요.

## 요약

이번 변경은 두 MDX 문서(`triggers.en.mdx`, `triggers.mdx`)에서 webhook 본문 크기 제한 및 rate limit 정책을 갱신한 순수 문서 변경이다. 코드 변경은 없으나 API 계약 관점에서 세 가지 우려가 있다. 첫째, 구현된 32KB 공개 웹훅 한도와 미구현 예정인 1MB 인증 웹훅 한도가 동일한 413 응답 행에 혼재해 클라이언트 혼동을 유발한다. 둘째, 웹훅 429 rate limit가 per-trigger 60 req/min에서 global 100 req/min으로 변경되었는데 "global"의 범위가 불명확하고 실제 서버 구현과의 정합성 확인이 필요하다. 셋째, inbound command 429 `RATE_LIMITED`가 미구현임을 명시했는데, 미구현 상태인 응답 코드가 응답 테이블에 포함되어 있어 API 계약 일관성에 혼선을 줄 수 있다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 신규 에러 코드 도입은 기존 클라이언트에 미치는 영향이 작으나 응답 바디 구조 명시 보완이 권장된다.

## 위험도

MEDIUM
