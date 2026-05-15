# Code Review 조치 내용

## Critical 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `ALTER TYPE ADD VALUE` 트랜잭션 블록 실행 불가 | `-- flyway:nonTransactional` 주석 추가 + `IF NOT EXISTS` 적용 |

## Warning 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `@UseGuards(JwtAuthGuard)` 미선언 | 컨트롤러 레벨에 `@UseGuards(JwtAuthGuard)` 명시적 추가 |
| 2 | user not found 시 200 + null 반환 | `throw new NotFoundException()` 사용으로 변경 |
| 3 | `IF NOT EXISTS` 없음 | Critical #1과 함께 적용 완료 |
| 4 | 컨트롤러 직렬화 책임 | 현재 단순 엔드포인트이므로 유지. 복잡해질 경우 DTO 도입 예정 |
| 5 | trigger 카테고리 통합 테스트 없음 | 기존 manual-trigger handler 테스트에서 이미 검증 중. DB 통합 테스트는 추후 추가 |
| 6 | 인증 실패 테스트 누락 | 인증 guard 통합은 글로벌 guard 테스트에서 검증. 컨트롤러 단위 테스트에 서비스 예외 전파 테스트 추가 |
| 7 | 서비스 예외 전파 테스트 누락 | `mockRejectedValue` 케이스 추가 완료 |
| 8 | Swagger 데코레이터 누락 | Phase 1에서는 Swagger 미사용. 추후 API 문서화 단계에서 추가 예정 |

## Info 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 4 | `as never` 타입 캐스팅 | `as User` 명시적 타입으로 변경 완료 |
| 5 | 민감 필드 제외 검증 부재 | `not.toHaveProperty('passwordHash')` 등 assertion 추가 완료 |
| 6 | 과도한 test mock | 최소 필드만 포함하도록 mockUser 경량화 완료 |
| 10 | locale/theme null 시 기본값 | `?? 'ko'`, `?? 'light'` 기본값 적용 + 테스트 케이스 추가 |

## 미조치 사항 (낮은 우선순위)

- SELECT 프로젝션 최적화 / Redis 캐시: Phase 1에서는 불필요, 성능 이슈 발생 시 적용
- spec 문서에 엔드포인트 반영: API 문서화 단계에서 일괄 처리
- enum → VARCHAR 전환 검토: 장기 과제로 기록
