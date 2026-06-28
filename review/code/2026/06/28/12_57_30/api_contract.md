# API 계약(API Contract) 리뷰 결과

## 발견사항

이번 변경은 두 개의 MDX 사용자 문서 파일(`triggers.en.mdx`, `triggers.mdx`)과 이전 리뷰 세션의 산출물 파일들(SUMMARY.md, RESOLUTION.md, 상태 JSON 등)만 수정하였다. 실제 API 엔드포인트 코드, 라우터, 컨트롤러, DTO, 스키마 변경은 포함되지 않는다.

### 발견사항 1
- **[INFO]** Webhook 엔드포인트 rate limit 정책 문서 수정: per-trigger 60 req/min → global 100 req/min
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` diff line +39, `triggers.mdx` diff line +94
  - 상세: `429 Too Many Requests` 의 의미가 "per-trigger 분당 60건" 에서 "인스턴스 전역 분당 100건" 으로 문서상 변경되었다. HTTP 상태 코드 429 자체는 유지되므로 프로토콜 수준의 breaking change 는 없다. 다만 기존 클라이언트가 per-trigger 60건 가정으로 버스팅 로직을 구현했다면 실제 동작 차이가 발생할 수 있다. `Retry-After` 헤더가 문서에 추가된 점은 긍정적이나, 429 응답 바디의 정확한 스키마(에러 코드 필드 존재 여부 등)는 문서에 명시되지 않았다.
  - 제안: 추가 조치 불필요(문서 보정 수준). 향후 rate limit 응답 바디 스키마 스펙화 고려.

### 발견사항 2
- **[INFO]** Inbound commands 429 RATE_LIMITED 에 "(Planned — not yet implemented)" 마킹 추가
  - 위치: `triggers.en.mdx` diff line +59, `triggers.mdx` diff line +103
  - 상세: `POST /api/external/executions/{executionId}/interact` 에 대한 `429 RATE_LIMITED` 응답이 미구현 예정으로 명시되었다. 인프라 레이어(리버스 프록시, API 게이트웨이)에서 generic 429 가 반환될 가능성과 애플리케이션 레이어 `RATE_LIMITED` 코드 구분이 문서에 명시되지 않아 클라이언트 혼동 여지가 있다.
  - 제안: 추가 조치 불필요(기존 plan 에서 추적 중). inbound rate-limit 구현 시 두 레이어 구분 문서화 권장.

### 발견사항 3
- **[INFO]** Webhook 본문 크기 제한 문서 정정: 1MB → 공개 32KB / 인증 1MB(Planned)
  - 위치: `triggers.en.mdx` diff line +39 (body size 부분), `triggers.mdx` diff line +83
  - 상세: 공개 webhook 에 대해 새로운 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 가 문서에 도입되었다. 이 에러 코드가 실제 서버 응답에서 일관되게 반환되는지, 표준 에러 봉투 형식(예: `{ "error": { "code": "PUBLIC_WEBHOOK_BODY_TOO_LARGE", ... } }`)을 따르는지는 이번 diff 범위 내에서 확인되지 않는다.
  - 제안: 추가 조치 불필요(문서 보정 수준, spec WH-NF-02/옵션C 결정 완료 기준). 구현 시 에러 코드 봉투 형식 일관성 확인 필요.

## 요약

이번 변경은 순수 문서(MDX) 레벨 수정으로, 실제 API 엔드포인트 코드나 스키마에 대한 변경은 없다. HTTP 상태 코드(429, 413)는 모두 유지되므로 프로토콜 수준의 breaking change 는 없다. rate limit 정책(per-trigger 60 → global 100 req/min) 변경은 클라이언트 버스팅 로직에 영향을 줄 수 있으나 이는 문서 보정이며 spec SoT 와 정합하는 변경이다. 새로운 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 가 문서에 등장했으나 구현 일관성 확인은 이번 diff 범위 외다. 전반적으로 API 계약 관점에서 즉각 차단이 필요한 위험 요소는 없다.

## 위험도
NONE
