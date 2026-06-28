# API 계약 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** 웹훅 엔드포인트 rate limit 정책 변경: per-trigger 60 req/min → global 100 req/min
  - 위치: `triggers.en.mdx` L39, `triggers.mdx` L537 (diff 기준)
  - 상세: `429 Too Many Requests` 의 의미가 "per-trigger 분당 60건" 에서 "global 분당 100건" 으로 변경되었습니다. 이는 기존 클라이언트에게 breaking change 로 보일 수 있으나, rate limit 응답 자체(HTTP 상태 코드 429)는 동일하므로 프로토콜 수준의 breaking change 는 아닙니다. 다만, 기존에 per-trigger 60건 제한을 전제로 버스팅 로직을 구현한 클라이언트는 예상치 못한 rate limit 를 받을 수 있습니다.
  - 제안: `Retry-After` 헤더 또는 응답 본문에 limit 값/scope 정보를 포함해 클라이언트가 프로그래매틱하게 확인할 수 있도록 권장. 현재 문서에는 429 응답 바디 형식이 명시되지 않으므로 추가 스펙화 검토를 권장합니다.

### 발견사항 2
- **[INFO]** Inbound commands `429 RATE_LIMITED` 에 "(Planned — not yet implemented)" 마킹 추가
  - 위치: `triggers.en.mdx` L48, `triggers.mdx` L546 (diff 기준)
  - 상세: `POST /api/external/executions/{executionId}/interact` 에 대한 `429 Too Many Requests` 응답이 "미구현 예정" 으로 명시되었습니다. 이 자체는 투명성 측면에서 긍정적이나, 해당 코드가 실제로 서버에서 절대 반환되지 않는지 검증이 필요합니다. 만약 서버가 인프라 레이어(리버스 프록시, API 게이트웨이)에서 429 를 반환한다면 클라이언트가 `RATE_LIMITED` 코드를 기대하지 않아 혼동이 생길 수 있습니다.
  - 제안: 인프라 레이어의 generic 429 와 애플리케이션 레이어의 `RATE_LIMITED` 코드 구분을 문서에 명시하거나, 미구현 항목 제거를 고려하세요.

## 요약

이번 변경은 순수 문서(MDX) 레벨의 수정으로, 실제 API 엔드포인트 코드나 스키마에 대한 변경은 없습니다. 변경된 두 항목 모두 기존 HTTP 상태 코드(429)는 유지되므로 프로토콜 수준의 breaking change 는 없습니다. 다만 rate limit 정책이 per-trigger 에서 global 로 변경된 점은 클라이언트가 구현 상 가정하고 있을 수 있으므로 참고 정보로 기록합니다. 전반적으로 API 계약 관점에서 위험 요소는 경미합니다.

## 위험도
NONE
