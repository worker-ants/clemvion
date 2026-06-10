# 변경 범위(Scope) 리뷰

## 발견사항

### 발견 없음

모든 파일의 변경이 선언된 작업 범위(refactor 04 m-4: DB 연결 풀 자격증명 교체의 멀티 인스턴스 캐시 무효화 — Redis pub/sub bus 도입)와 직접 연결된다.

파일별 판단:

1. **`integration-cache-bus.service.ts`** (신규): 핵심 pub/sub bus 구현. 범위 내.
2. **`integration-cache-bus.service.spec.ts`** (신규): 위 서비스 단위 테스트. 범위 내.
3. **`redis.module.ts`**: `IntegrationCacheBus` 전역 provider 등록. bus 사용에 필요한 최소 모듈 수정. 범위 내.
4. **`node-handler-dependencies.provider.ts`**: `integrationCacheBus` 의존성 주입 추가. 핸들러에 bus 전달 경로. 범위 내.
5. **`node-component.interface.ts`**: `HandlerDependencies` 에 `integrationCacheBus` 필드 추가. 인터페이스 확장이 bus 연결에 필수. 범위 내.
6. **`database-query.component.ts`**: `integrationCacheBus` 를 핸들러 생성자에 전달. 범위 내.
7. **`database-query.handler.ts`**: 생성자에서 `integrationCacheBus.register` 호출. 범위 내. 기존 로직(resolvePgPool/resolveMysqlPool/execute 등) 변경 없음.
8. **`database-query.handler.spec.ts`**: bus 통합 시나리오 테스트 추가. 기존 테스트 불변. 범위 내.
9. **`integrations.service.ts`**: `rotate`/`remove` 이후 `broadcastCredentialChange` 호출. publish 지점 추가. 범위 내.
10. **`integrations.service.spec.ts`**: `rotate`/`remove` broadcast 시나리오 테스트 추가. 기존 테스트 불변. 범위 내.
11. **`integration-cache-invalidate.e2e-spec.ts`** (신규): rotate/remove 가 실 Redis 채널에 broadcast 하는지 검증하는 e2e 테스트. 범위 내.
12. **`spec/0-overview.md`**: Redis 데이터 계층 항목에 `integration:cache:invalidate` 채널 mention 추가. 단일 줄 수정, 아키텍처 개요 정합성 유지. 범위 내.
13. **`spec/4-nodes/4-integration/2-database-query.md`**: 풀 캐시 §4 에 멀티 인스턴스 무효화 설명 추가 + `## Rationale` 섹션 추가. spec frontmatter code 목록에 `integration-cache-bus.service.ts` 추가. 범위 내.
14. **`spec/5-system/4-execution-engine.md`**: Redis §9.2 에 pub/sub 채널 표 추가 및 기존 글로벌 키 설명에 채널 언급 보강. 범위 내.
15. **`spec/data-flow/5-integration.md`**: rotate/remove 이후 broadcast 흐름 callout 추가. 범위 내.

추가 검토 항목:

- **포맷팅/공백**: 변경된 모든 diff 에 의미 없는 공백·줄바꿈 변경 없음.
- **불필요한 리팩토링**: `database-query.handler.ts` 의 기존 `resolvePgPool`/`resolveMysqlPool`/`execute` 로직에 일체 손대지 않음.
- **임포트**: 모든 추가 import 가 실제 사용되는 항목임.
- **설정 변경**: 설정 파일(tsconfig, jest.config, package.json 등) 변경 없음.
- **기능 확장**: `broadcastCredentialChange` 메서드 래퍼가 추가됐으나, 이는 내부 private 메서드로 bus publish 를 단일 지점에서 호출하는 최소 캡슐화이며 공개 API 추가가 아님. over-engineering 아님.

## 요약

15개 파일 변경 전체가 "DB 연결 풀 자격증명 회전 시 멀티 인스턴스 캐시 무효화를 위한 Redis pub/sub bus 도입(refactor 04 m-4)"의 의도된 범위 내에 정확히 위치한다. 구현 코드(bus 서비스·모듈 등록·핸들러 주입·publish 호출 지점), 단위·e2e 테스트, spec 3개 파일(database-query.md, 0-overview.md, 4-execution-engine.md, data-flow/5-integration.md) 업데이트가 모두 해당 기능을 위한 최소 필요 변경으로 구성되어 있으며, 무관한 코드 정리·리팩토링·기능 추가·포맷팅 노이즈가 없다.

## 위험도

NONE
