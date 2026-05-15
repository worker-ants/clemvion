# Testing Review — kb-stats.helper dead-path removal

## 발견사항

- **[INFO]** `refresh()` 의 반환값(RETURNING 결과)을 테스트가 검증하지 않음
  - 위치: `kb-stats.helper.spec.ts` L51-65 (첫 번째 it 블록)
  - 상세: 구현부는 `await this.dataSource.query(...)` 의 결과를 버린다(`void` 반환). 첫 번째 테스트는 `rows[0]?.entity_count` 등 반환값을 검증하지 않고 SQL 패턴과 파라미터만 확인한다. 이는 현재 구현과 일치하며 올바르다. 그러나 테스트 이름이 "returns the new values" 라고 선언하고 있어 실제로 반환값을 단언하는 코드가 없음에도 반환을 검증하는 것처럼 오해를 유발한다.
  - 제안: 테스트 이름을 `"runs a single atomic UPDATE that recounts entity + relation"` 정도로 수정하거나, 의도적으로 void 반환임을 명시(`returns void — result is discarded`)한다.

- **[INFO]** `knowledgeBaseId` 가 빈 문자열이거나 null-like 값일 때의 동작 테스트 없음
  - 위치: `kb-stats.helper.spec.ts` — 엣지 케이스 전반
  - 상세: `refresh('')` 처럼 빈 ID 를 넘기면 DB에서 0-row 업데이트가 일어날 가능성이 있다. mock 환경에서도 파라미터 검증 테스트를 추가해두면 향후 가드 로직이 생겼을 때 회귀를 잡기 쉽다. 다만 현재 구현이 DB에 위임하는 단순 helper 이므로 Critical 레벨은 아니다.
  - 제안: `it('passes the knowledgeBaseId directly as $1 without transformation', ...)` 수준의 파라미터 동일성 케이스 1건 추가를 고려한다.

- **[INFO]** `WebsocketService` 의존성 제거에 대한 회귀 관점 단언 부재
  - 위치: `kb-stats.helper.spec.ts` — provider 설정 (L44-46)
  - 상세: 이번 변경의 핵심은 `WebsocketService` 의존성 제거이다. 테스트 모듈에 `WebsocketService` 가 제공되지 않아도 `module.compile()` 이 성공하는 것이 암묵적으로 검증되지만, 이 사실이 명시적 단언으로 드러나지 않는다. 현재 구조상 NestJS `Test.createTestingModule` 이 불필요한 provider 가 없어도 compile 하므로, 테스트가 통과하면 의존성 제거 회귀는 자동으로 잡힌다. 추가 단언이 필수는 아니나, 코드 리뷰어 입장에서 의도가 더 명확했으면 좋겠다.
  - 제안: 주석 한 줄(`// WebsocketService is intentionally absent — dependency was removed`)을 추가하면 충분하다.

## 요약

테스트 관점에서 이번 변경은 전반적으로 양호하다. `kb-stats.helper.spec.ts` 는 신규 작성 파일로, dead path 제거 후 남은 핵심 동작(atomic UPDATE SQL 구조, 파라미터 바인딩, empty RETURNING 허용, DB 에러 전파)을 3개의 독립적인 케이스로 깔끔하게 커버한다. NestJS `TestingModule` 을 통한 DI 방식은 실제 컨테이너 해결 과정을 검증하므로 mock 적절성도 우수하다. 테스트 간 상태 공유 없이 `beforeEach` 로 격리가 보장된다. 단점은 첫 번째 테스트 이름이 "returns the new values" 라고 선언하나 실제 반환값 단언이 없어 가독성에 작은 불일치가 있는 것과, 빈 ID 등 파라미터 엣지 케이스가 누락된 것이다. 모두 낮은 우선순위의 개선 사항이며 현재 기능 요구사항 검증에는 지장이 없다.

## 위험도

LOW
