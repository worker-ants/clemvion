# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `as unknown as RedisConnectionProvider` 이중 캐스트 — 인터페이스 분리 설계 기회
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 99–102
  - 상세: `ExecutionSeqAllocator` 생성자가 구체 클래스 `RedisConnectionProvider`(private 멤버 포함)를 직접 주입받기 때문에, 테스트 어댑터(`makeProvider` 반환값)가 구조적 매칭에 실패하여 `as unknown as` 이중 캐스트가 필수적이다. 이번 변경은 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 으로 어댑터 타입을 명시하여 메서드 시그니처 드리프트는 컴파일 시점에 잡히게 했다 — 이는 이전 `as never` 대비 명백한 개선이다. 그러나 근본 원인(`ExecutionSeqAllocator`가 인터페이스 대신 구체 클래스에 직접 의존)은 프로덕션 코드에 남아 있다. ISP/DIP 관점에서 `IRedisCommandClient { getClient(): Redis; getClientOrNull(): Redis | null; }` 같은 인터페이스를 추출하면 테스트 캐스트가 불필요해지고 의존성 방향도 역전된다. 이 리팩토링은 이번 변경 범위 밖이며 기존 행동에 영향을 주지 않아 현재 상태로 안전하다.
  - 제안: 후속 리팩토링으로 `RedisConnectionProvider` 의 command-only 표면을 좁은 인터페이스(`IRedisCommandClient` 또는 유사)로 추출하고, `ExecutionSeqAllocator` 가 그 인터페이스에 의존하도록 변경. 이렇게 하면 e2e 어댑터의 구조적 매칭이 자연히 성립하여 캐스트가 전부 제거된다. 현 PR 범위는 아님.

- **[INFO]** `docker-compose.e2e.yml` YAML anchor `x-redis-env` — 설정 단일 진실 개선
  - 위치: `docker-compose.e2e.yml` `x-redis-env` 블록 + `<<: *redis-env` 두 곳
  - 상세: `backend-e2e`(앱)와 `backend-e2e-runner`(실 Redis 직결 e2e) 두 서비스가 동일한 `REDIS_HOST`/`REDIS_PORT` 쌍을 중복 선언하던 것을 YAML anchor로 DRY화했다. `x-` 접두 top-level 키는 docker-compose가 서비스로 해석하지 않으므로 사이드이펙트가 없다. 아키텍처상 "설정 단일 진실 원칙" 적용의 긍정적 사례다.
  - 제안: 현재 패턴 유지. 향후 `DB_*` 자격증명도 같은 패턴(`x-db-env`)으로 통합하면 일관성이 더 높아진다(선택 사항).

- **[INFO]** `makeProvider` 어댑터 — 어댑터 패턴의 적절한 적용
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 176–183
  - 상세: 실 `ioredis` 연결을 `ExecutionSeqAllocator` 가 기대하는 표면으로 감싸는 최소 어댑터 패턴이다. 반환 타입을 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 명시함으로써 어댑터가 구현해야 할 계약이 코드에 명시되었다. 이는 테스트-픽스처 어댑터의 올바른 패턴이며 레이어 책임 분리(테스트 인프라 vs 비즈니스 로직)도 잘 지켜진다.
  - 제안: 현재 패턴 유지.

- **[INFO]** `plan/complete/spec-draft-eia-seq-nfr.md` `spec_impact` 스칼라 → 리스트 정정
  - 위치: `plan/complete/spec-draft-eia-seq-nfr.md` frontmatter `spec_impact` 필드
  - 상세: Gate C 규약(spec-plan-completion.test.ts)이 `spec_impact`를 YAML 리스트 또는 `none`/`없음` 으로 요구하는데, bare string이 유입되어 테스트가 실패했다. 이를 리스트로 정정한 것은 plan-spec 레이어 규약 준수다. 아키텍처상 "메타데이터 스키마 규약"의 단일 진실 위반을 수정한 것으로 올바른 처리다.
  - 제안: 현재 수정 유지. 향후 spec-only PR(#733 유형)에서 frontmatter 스키마를 린터로 사전 검증하면 동일 회귀를 방지할 수 있다.

## 요약

이번 변경은 동작 변경 없는 cleanup 커밋이다. `makeProvider` 반환 타입을 `Pick<RedisConnectionProvider, ...>` 으로 명시한 것은 블라인드 `as never` 캐스트 대비 시그니처 드리프트를 컴파일 타임에 검출할 수 있게 한 유의미한 개선이다. `P95_PERCENTILE` 상수화와 YAML anchor DRY화 모두 가독성·유지보수성을 높이는 작은 구조 개선이다. 아키텍처 관점의 근본 개선 기회(DIP — `ExecutionSeqAllocator`가 구체 클래스 대신 인터페이스에 의존)는 이번 변경 범위 밖에 남아 있지만, 이번 `Pick` 타입 도입이 그 방향의 첫 단계로 기능한다. 전반적으로 설계 퇴행 없이 기존 아키텍처를 점진적으로 개선한 변경이다.

## 위험도

NONE
