# Testing Review — auth-refresh-rotation-atomic (05 C-1)

## 발견사항

### [INFO] 테스트 존재 여부 — 핵심 4개 케이스 모두 추가됨
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` lines 547–634
- 상세: 변경된 `refresh()` 분기 3개(정상 회전 원자성, 동시 회전 affected=0 거부, 만료 토큰 트랜잭션 미진입)와 롤백 에러 전파에 대한 단위 테스트가 모두 추가됐다. 기존 `'should refresh tokens with valid refresh token'` 테스트도 유효하게 유지된다. 커버리지 측면에서 신규 분기에 대한 누락은 없다.
- 제안: 없음.

### [INFO] 커버리지 갭 — `stored.user === null` 정상 회전 분기 null 가드 테스트 부재
- 위치: `auth.service.ts` lines 580–588 (신규 추가된 `if (!user)` 가드), `auth.service.spec.ts` `describe('refresh')`
- 상세: `auth.service.ts` 에 `stored.user` null 가드가 신규 추가됐으나 이 경로를 검증하는 테스트 케이스가 없다. `stored.isRevoked === false`이고 `expiresAt > now`인 상태에서 `user` 관계가 `null`인 경우 `TOKEN_INVALID`로 거부됨을 테스트해야 한다. reuse 분기(isRevoked=true)와 정상 회전 분기(isRevoked=false) 모두에서 동일 방어 패턴이 있으나, 정상 회전 경로의 null 가드만 테스트가 빠져 있다.
- 제안: 다음 케이스 추가 — `findOne`이 `user: null`인 토큰을 반환할 때 `TOKEN_INVALID`로 거부되고 `dataSource.transaction`이 호출되지 않음을 단언.

### [INFO] 커버리지 갭 — `affected: undefined/null` 드라이버별 동작 분기 미검증
- 위치: `auth.service.ts` line 613 (`if (!result.affected)`), `auth.service.spec.ts` lines 574–591
- 상세: 코드 주석에 "affected 가 0/undefined/null 이면(드라이버별)" 처리한다고 명시했으나, 테스트는 `{ affected: 0 }` 케이스만 검증한다. `{ affected: undefined }` 와 `{ affected: null }` 케이스에서도 신규 토큰 미발급 + 거부가 일어나는지 단언이 없다. DB 드라이버 차이를 단위 테스트에서 검증해두면 회귀 가드로서 가치가 있다.
- 제안: `affected: undefined` 또는 `affected: null` 로 `mockResolvedValueOnce`를 추가하는 케이스 2개. 또는 기존 케이스의 파라미터화로 처리 가능.

### [WARNING] Mock 적절성 — DataSource.transaction mock 이 실제 트랜잭션 격리를 재현하지 못함 (문서화 필요)
- 위치: `auth.service.spec.ts` lines 143–162, lines 610–634 (`propagates failure` 테스트)
- 상세: `transaction` mock 은 콜백을 즉시 실행하지만 TypeORM의 실제 트랜잭션처럼 예외 발생 시 롤백을 수행하지 않는다. `propagates failure` 테스트에서 `refreshTokenRepo.update`(revoke)가 호출됐음을 단언하고 "실 DB에선 롤백된다" 고 주석으로 설명하지만, 이 단언은 실제로 **롤백이 되지 않는다는 사실을 드러낸다** — 즉 mock 단위에서는 revoke가 완료된 상태에서 save만 실패한 것처럼 보인다. 이는 mock 고유의 한계이나 이 사실이 테스트 코드 단계에서 혼란을 줄 수 있다. 현재 주석은 "에러 전파만 검증" 으로 충분히 설명돼 있으나, "unit mock에서 update가 호출됐음을 단언하는 것이 rollback 검증이 아니라 sequence 검증임" 을 명시하면 더 명확하다.
- 제안: `propagates failure` 테스트의 `refreshTokenRepo.update` 단언에 주석 보완: "이 단언은 롤백 검증이 아님 — unit mock 은 commit/rollback 없이 콜백을 직접 실행하므로 update(revoke) 호출 시퀀스를 확인하는 것. 실제 롤백은 e2e 레이어 보장."

### [INFO] 테스트 격리 — `beforeEach`와 `mockResolvedValueOnce` 조합으로 격리 적절
- 위치: `auth.service.spec.ts` lines 55–188 (`beforeEach`), lines 585, 622
- 상세: 각 테스트는 `beforeEach`에서 `mockRefreshTokenRepo`를 새로 생성하고 `TestingModule`을 재컴파일한다. `affected: 0` 케이스와 `save` 실패 케이스는 `mockResolvedValueOnce`로 오버라이드해 다른 테스트에 영향을 주지 않는다. 테스트 간 상태 공유 문제는 없다.
- 제안: 없음.

### [INFO] 테스트 가독성 — 공통 `findOne` mock 반복 4회 (기존 지적 수용 미완)
- 위치: `auth.service.spec.ts` lines 533–540, 549–556, 577–584, 614–621 (신규 케이스 포함 총 4회)
- 상세: `refresh describe` 내 4개 테스트 중 3개(정상 회전, affected=0, 롤백)가 동일한 `findOne` mock 설정(`id: 'rt-1'`, `familyId: 'family-1'`, `isRevoked: false`, `expiresAt: now+86400000`, `user: mockUser`)을 반복한다. 이전 리뷰(SUMMARY.md INFO 7)에서도 지적됐으나 RESOLUTION.md에서 "선택 사항"으로 수용됐다. 기능적 문제는 없으나 공통 setup을 `refresh describe` 내부 `beforeEach`로 추출하면 신규 케이스 추가 시 setup 누락 실수를 방지할 수 있다.
- 제안: `describe('refresh')` 내에 `beforeEach`를 추가하고 `isRevoked: false` 기본 setup을 공통화. `reuse detection` 테스트만 `isRevoked: true`로 오버라이드.

### [INFO] 테스트 가독성 — 기존 `'should refresh tokens with valid refresh token'` 케이스의 역할 중복
- 위치: `auth.service.spec.ts` lines 532–545
- 상세: 이 기존 케이스는 `refreshTokenRepo.update`가 호출됐음을 단언하지만, 이제 `'rotates revoke + issue inside a single transaction'` 케이스가 동일 사실을 더 정밀하게(조건부 UPDATE 파라미터, `transaction` 호출, `save` 호출 포함) 검증한다. 두 테스트가 겹치며 기존 케이스의 단언(`update`가 호출됐는가)은 신규 케이스의 부분집합이다. 제거할 필요는 없지만 기존 케이스를 "smoke test" 수준으로 명시하거나, 신규 케이스로 완전 대체하는 것도 고려할 수 있다.
- 제안: 기존 케이스에 주석 추가: "기본 연동 smoke. 상세 원자성 단언은 '05 C-1 atomicity' 케이스 참조."

### [INFO] 테스트 용이성 — `generateTokens`의 `manager` 파라미터 경로 직접 테스트 부재
- 위치: `auth.service.ts` lines 744–802 (`generateTokens`), `auth.service.spec.ts`
- 상세: `generateTokens`는 `private`이므로 직접 테스트가 불가하고 `refresh()` 경유 간접 테스트로 커버된다. `manager` 전달 경로(트랜잭션 내 `refreshRepo = manager.getRepository(RefreshToken)`)는 `rotates revoke + issue` 케이스에서 간접적으로 검증된다(`refreshTokenRepo.save`가 호출됨 = manager를 통한 repo가 동일 mock으로 라우팅됨). 이 커버리지는 현재 mock 구조(entity===RefreshToken 분기)에 의존하므로, mock 구조가 바뀌면 테스트가 의도치 않게 통과할 수 있다.
- 제안: 추가 테스트 불필요. 단, mock의 `getRepository` 분기 로직을 변경할 경우 `rotates revoke + issue` 케이스를 통해 `manager.getRepository`가 `RefreshToken`으로 호출됐는지 별도 단언 추가를 고려.

### [INFO] 테스트 이름 스타일 불일치 (RESOLUTION 수용 항목 재확인)
- 위치: `auth.service.spec.ts` lines 547, 574, 593, 610
- 상세: 이전 리뷰(INFO 6)에서 지적된 `should ...` vs 현재시제 동사 혼용이 신규 케이스 4개 모두 현재시제(`rotates`, `rejects`, `does not open`, `propagates`)를 사용해 일관되게 적용됐다. 기존 테스트(`should refresh tokens`, `should revoke family`)와의 스타일 혼용은 여전히 존재하나 RESOLUTION에서 "선택 사항"으로 수용된 사안이다.
- 제안: 없음 (RESOLUTION 수용 항목).

### [INFO] 회귀 테스트 — reuse detection 경로 기존 테스트 유효성 확인
- 위치: `auth.service.spec.ts` lines 636–665 (`'should revoke family on reuse detection'`)
- 상세: reuse detection 분기는 이번 변경에서 코드가 수정되지 않았고(`auth.service.ts` lines 552–570), 기존 테스트도 변경 없이 유지된다. `refreshTokenRepo.update`의 기본 mock이 `{ affected: 1 }`로 바뀌었으나 reuse detection 경로에서 `update`는 `affected`를 읽지 않으므로 기존 테스트 동작에 영향이 없다. 회귀 위험 없음.
- 제안: 없음.

## 요약

이번 변경(05 C-1 refresh 토큰 회전 원자화)의 테스트 커버리지는 전체적으로 양호하다. 핵심 시나리오(단일 트랜잭션 원자성, 동시 회전 affected=0 거부, 만료 경로 트랜잭션 미진입, 롤백 에러 전파)에 대한 회귀 가드 테스트가 모두 추가됐고, mock 기본값 변경(`update → { affected: 1 }`)과 DataSource.transaction mock의 getRepository 분기 처리도 적절하다. 개선 여지는 세 가지다: (1) 신규 추가된 `stored.user === null` null 가드 경로에 대한 테스트 케이스 누락(커버리지 갭), (2) `affected: undefined/null` 드라이버별 분기 미검증, (3) 동일 findOne mock setup의 4회 반복으로 인한 유지보수 부담. `propagates failure` 테스트의 rollback 미재현 한계는 주석으로 충분히 명시됐으나 "unit 단언이 rollback 검증이 아니라 sequence 검증임" 을 한 줄 더 명시하면 오해를 줄일 수 있다.

## 위험도

LOW

STATUS: SUCCESS
