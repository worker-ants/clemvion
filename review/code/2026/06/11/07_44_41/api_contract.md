# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

변경 파일 10개 전체가 내부 Redis pub/sub 캐시 무효화 인프라(`IntegrationCacheBus`)와 그 테스트, 그리고 `DatabaseQueryHandler`에 bus를 주입하는 DI 배선에 관한 것이다.

- HTTP 엔드포인트, 컨트롤러, DTO, 라우트 정의, OpenAPI 스키마 변경 없음.
- `IntegrationsService.rotate` / `IntegrationsService.remove` 의 공개 시그니처(파라미터·반환 타입)는 변경 없음 — `broadcastCredentialChange` 는 private 메서드로 추가된 내부 부수효과.
- 클라이언트(프론트엔드·외부 API 소비자)가 관찰하는 응답 형식·HTTP 상태 코드·URL 경로에 영향 없음.

## 요약

이번 변경은 서버 인스턴스 간 credential 캐시 무효화를 위한 Redis pub/sub 내부 버스 도입이다. 공개 HTTP API 계약(엔드포인트, 요청/응답 스키마, 상태 코드, 버전)에 변경이 없으므로 API 계약 관점에서 검토할 사항이 없다.

## 위험도

NONE
