# RESOLUTION — refresh 토큰 rotation 원자화 (05 C-1)

리뷰 세션: `review/code/2026/06/11/08_45_18/` · 위험도 **LOW** · Critical 0 · Warning 6 · INFO 14.
fix 커밋: `98aee7fb`.

## 조치 항목

| # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W2 | Security/TOCTOU | revoke 를 **조건부 UPDATE** (`{id, is_revoked:false, expires_at>now}`)로 — SELECT→검증→UPDATE 사이 동일 토큰 동시 refresh 의 이중 회전 창을 닫음. `affected=0` 시 신규 토큰 미발급 + `TOKEN_INVALID`. spec §1.4 노트도 갱신 | `98aee7fb` |
| W1 | Security | `generateTokens` JSDoc — `manager` 는 트랜잭션 컨텍스트 전파 전용 `@internal`, `public` 승격 금지 명시 | `98aee7fb` |
| W3 | Testing | 만료 토큰 경로가 트랜잭션을 열지 않음(`transaction not called`) 테스트 추가 | `98aee7fb` |
| W6 | Testing | 롤백 테스트 주석을 "단위 mock 은 실제 DB 롤백 재현 불가 — 에러 전파만 검증, 실 롤백은 e2e" 로 정정. affected=0 거부 테스트(save 미호출 단언) 추가 | `98aee7fb` |
| W5 | Maintainability | 신규 주석은 한국어로 통일(함수 내 기존 EN 인라인과 혼용 최소화) + 회귀 가드 주석 패턴(`// 05 C-1 회귀 가드:`) 적용(INFO12) | `98aee7fb` |
| INFO 4 | Architecture | refresh 정상 회전은 loginHistory 미기록(spec §1.4 의도) 주석 추가 | `98aee7fb` |
| INFO 5 | Requirement | 정상 회전 분기에 `stored.user` null 가드 추가(reuse 분기와 방어 통일) | `98aee7fb` |
| INFO 10 | Maintainability | spec §1.4 노트에서 구현 param 명(`EntityManager`) 직접 참조 제거 — 코드 참조 수준만 | `98aee7fb` |
| INFO 14 | Documentation | plan spec 경로를 `spec/` 루트 기준 full path 로 | `98aee7fb` |

## 수용(현행 유지) — 근거

| # | 판단 | 근거 |
| --- | --- | --- |
| W4 | 수용 | `resolveTokenWorkspaceContext` 실패는 트랜잭션이 **열리기 전**(generateTokens 초반 read) 발생해 DB 롤백 자체가 무관 — 별도 테스트 가치 낮음. 코드 흐름상 자명(트랜잭션 콜백 진입 후 generateTokens 가 첫 작업으로 context resolve, 그 실패는 INSERT 이전이라 revoke 도 롤백). INFO1 참조 |
| INFO 1 | scope 밖(후속) | `resolveTokenWorkspaceContext`(≤3 read)가 트랜잭션 안에서 실행돼 hold time 연장 — 분리하면 코드 복잡↑. refresh 빈도·트랜잭션 길이 모두 작아 실측 영향 미미. 트랜잭션 hold 최소화 리팩토링은 후속 |
| INFO 2 | 의도 | optional `EntityManager` 의 제한적 DIP 트레이드오프는 NestJS+TypeORM 관용구 — JSDoc 으로 의도 명시(W1) |
| INFO 3 | scope 밖 | `refreshTokenRepository.manager.getRepository(User)` 경유 User 조회는 기존 코드 패턴 — 본 PR 무관, 별 이슈 |
| INFO 8 | 후속 plan | `registerWithInvitation` 의 user 생성+token INSERT 부분 성공 가능성(05 C-1 철학 확장)은 본 PR 범위 밖 — 백로그 후속(아래 §보류) |
| INFO 9 | 후속 | `generateTokens` positional 5-param → `GenerateTokensOptions` 묶기는 다음 시그니처 변경 시점 |
| INFO 13 | scope 밖 | 트랜잭션 실패 시 `Error.message` 클라이언트 노출 — 글로벌 예외 필터 책임(기존), 본 변경이 새로 만든 노출 아님. UnauthorizedException(affected=0)은 의도된 코드 |
| INFO 6·7 | 경미 | 테스트 이름 스타일·findOne mock 중복 — 신규 테스트는 회귀 가드 주석 적용, 공통 beforeEach 추출은 선택 |

## TEST 결과

- **lint**: 통과 (eslint --fix, 변경 파일)
- **unit**: 통과 (backend 334 suites / 6509 tests; auth.service 193 — 조건부 revoke·affected=0·만료경로·롤백전파 신규 포함)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 188 — auth refresh 흐름이 실 DB 트랜잭션 경유)

## 보류·후속 항목

- `registerWithInvitation` 의 user 생성 + refresh token INSERT 부분 성공 가능성(INFO 8) — 동일 05 C-1 원자성 철학을 가입 경로에도 확장하는 후속 plan.
- `generateTokens` 트랜잭션 hold time 최소화(INFO 1) — context resolve 를 콜백 밖 선계산.
