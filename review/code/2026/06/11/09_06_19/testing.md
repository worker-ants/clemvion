# Testing Review — auth-refresh-rotation-atomic (second pass)

## 발견사항

### [INFO] 핵심 테스트 4건 모두 추가됨 — 커버리지 요건 충족
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` lines 68–149 (신규 `it` 블록 4개)
- 상세: 이전 리뷰(08_45_18)에서 WARNING으로 지적한 두 케이스(만료 경로 트랜잭션 미호출, 롤백 에러 전파)와 추가 두 케이스(원자성 회귀 가드, affected=0 이중 회전 차단)가 모두 구현되었다. plan 체크리스트가 완료 처리되어 있고, RESOLUTION.md에 W3·W6이 fix 커밋(`98aee7fb`)에서 반영됐음이 명시된다.

### [INFO] mock 기본값 `{ affected: 1 }` 변경 — 설계 의도 적절
- 위치: `auth.service.spec.ts` line 38 (mock `update` 기본 반환값)
- 상세: 기존 `mockResolvedValue(undefined)`에서 `mockResolvedValue({ affected: 1 })`로 교체했다. 조건부 UPDATE가 `result.affected`를 읽으므로 기본 성공 케이스를 `affected:1`로 정의하고, 이중 회전 케이스만 `mockRejectedValueOnce`가 아닌 `mockResolvedValueOnce({ affected: 0 })`으로 오버라이드하는 패턴이다. 의도가 명확하다.

### [INFO] `getRepository` 분기 mock — 클로저 의존성 문서화 미흡
- 위치: `auth.service.spec.ts` lines 143–162 (`beforeEach` 내 DataSource mock)
- 상세: `entity === RefreshToken ? mockRefreshTokenRepo : { update: jest.fn() }` 패턴은 동작이 올바르나, `mockRefreshTokenRepo`가 `beforeEach` 지역 변수이고 동시에 `module.get(getRepositoryToken(RefreshToken))`과 같은 인스턴스임을 명시하는 주석이 없다. 미래에 `beforeEach` 내부를 재구성할 때 이 동일성이 깨지면 외부 단언(`expect(refreshTokenRepo.update).toHaveBeenCalledWith(...)`)이 조용히 실패한다.
- 제안: `// mockRefreshTokenRepo === module.get(getRepositoryToken(RefreshToken)) — 같은 인스턴스; 순서/선언 변경 시 주의` 한 줄 추가.

### [WARNING] 롤백 테스트가 revoke 호출 여부를 단언하지 않음
- 위치: `auth.service.spec.ts` lines 131–149 (`propagates failure when issuing the new token fails`)
- 상세: RESOLUTION.md(W6)는 "affected=0 거부 테스트(save 미호출 단언) 추가"를 반영 완료로 표시하고 있으나, 롤백 경로 테스트는 여전히 `rejects.toThrow('insert failed')`와 `transaction` 호출 횟수만 단언한다. 주석에 "단위 mock은 실제 DB 롤백 재현 불가 — 에러 전파만 검증"이 추가되어 한계를 명시하고 있는 점은 개선이다. 그러나 unit mock에서 가능한 추가 단언, 즉 `expect(refreshTokenRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'rt-1', isRevoked: false }), ...)` 으로 revoke가 호출됐음은 검증 가능하다. 이를 추가하면 테스트가 "revoke 호출 후 INSERT 실패 → 에러 전파" 흐름 전체를 서술적으로 커버한다.
- 제안: 롤백 테스트에 `expect(refreshTokenRepo.update).toHaveBeenCalled()` 또는 더 구체적인 `toHaveBeenCalledWith` 단언 추가. CRITICAL은 아니나 WARNING — 현재 테스트만으로는 "revoke는 시도됐으나 INSERT가 실패해서 에러 전파"라는 흐름 서술이 불완전하다.

### [INFO] `lastUsedIp: null` 단언 — 원자성 테스트에 부수 필드 검증 혼재
- 위치: `auth.service.spec.ts` lines 84–91 (`rotates revoke + issue inside a single transaction`)
- 상세: `expect(refreshTokenRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'rt-1', isRevoked: false }), expect.objectContaining({ isRevoked: true, lastUsedAt: expect.any(Date), lastUsedIp: null }))` 에서 `lastUsedIp: null`은 ctx 미전달 시의 기본값이 null임을 암묵적으로 가정한다. 테스트 이름이 "원자성(atomicity)" 검증임에도 IP 필드 값까지 단언하는 것은 테스트 관심사가 혼재되어 있다. 기능 오류는 없으나 미래에 IP 로직이 변경되면 원자성 테스트가 무관한 이유로 실패할 수 있다.
- 제안: `lastUsedIp: null` 단언을 `expect.anything()`으로 완화하거나, IP 관련 단언은 별도 `it` 블록으로 분리.

### [INFO] `refreshTokenRepo.findOne` mock 4회 중복 setup
- 위치: `auth.service.spec.ts` — 신규 4개 테스트 각각에 동일 findOne mock 반복
- 상세: 이전 리뷰(08_45_18 INFO 7)에서 지적한 `beforeEach` 공통 mock 추출이 이번 패스에서도 적용되지 않았다. 4개 테스트 중 3개(원자성, 만료경로, 롤백)는 동일한 findOne 반환값을 사용하며, 이중회전 케이스만 `isRevoked: false` 확인을 위해 같은 값을 쓴다. 전체가 동일하므로 `refresh` describe의 `beforeEach`에서 공통 setup을 추출하면 중복이 제거된다.
- 제안: `refresh` describe `beforeEach`에 공통 `refreshTokenRepo.findOne.mockResolvedValue({ id: 'rt-1', ... })` 추출. 필수는 아니나 유지보수성 개선.

### [INFO] 테스트 이름 스타일 불일치 — 이전 리뷰 지적 미반영
- 위치: `auth.service.spec.ts` lines 68, 95, 114, 131
- 상세: 이전 리뷰(INFO 6)에서 `should ...` 패턴 vs 현재 시제 동사(`rotates`, `rejects`, `does not open`, `propagates`) 불일치를 지적했으나 이번 패스에서 변경되지 않았다. RESOLUTION.md에서도 이 항목이 수용(현행 유지)으로 처리되지 않았다 — INFO 6·7이 "경미"로 분류되어 fix가 선택적 처리된 것으로 보인다. 기능 영향 없음.
- 제안: 프로젝트 관례로 `should ...` 통일이 바람직하나, 이미 RESOLUTION에서 경미로 처리된 사항이므로 현행 유지도 허용됨.

### [INFO] `affected=0` 이중 회전 케이스 — `save` 미호출 단언 위치 확인
- 위치: `auth.service.spec.ts` lines 95–112 (`rejects without issuing a token when the conditional revoke matches 0 rows`)
- 상세: `expect(refreshTokenRepo.save).not.toHaveBeenCalled()` 단언이 추가되어 affected=0 시 신규 토큰 미발급을 명시적으로 검증한다. 이는 이전 리뷰 W6의 핵심 요청이었으며 올바르게 구현되었다. 다만 `refreshTokenRepo.update.mockResolvedValueOnce({ affected: 0 })`이 `findOne` mock 이후에 오버라이드되는 순서가 명확한지 확인 필요 — `mockResolvedValueOnce`는 다음 한 번의 호출에만 적용되므로 `findOne`이 먼저 호출된 뒤 `update` 호출 시 affected:0 반환이 맞게 동작한다. 구조적으로 올바르다.

### [INFO] e2e 위임 명시 — 적절한 테스트 계층 분리
- 위치: `auth.service.spec.ts` lines 131–134 (주석), plan 체크리스트
- 상세: 롤백 테스트 주석이 "단위 mock은 실제 DB 롤백 재현 불가 — 에러 전파만 검증, revoke+INSERT 롤백은 dockerized e2e로 보장한다"로 명시되고, plan 체크리스트에 `e2e ✅ (188)`이 기록되어 있다. unit/e2e 계층 책임이 명확하게 분리되어 있으며 적절한 접근이다.

## 요약

이번 패스는 이전 리뷰(08_45_18)에서 WARNING으로 지적된 핵심 커버리지 갭 두 건(만료 경로 트랜잭션 미호출 검증, 롤백 주석-단언 불일치)을 포함해 총 4개의 새로운 회귀 가드 테스트를 추가했다. mock 기본값 `{ affected: 1 }` 변경과 `getRepository` 분기 라우팅, affected=0 거부 단언(`save` 미호출)은 모두 올바르게 구현되었다. e2e 위임 주석으로 unit/integration 계층 책임도 명확하게 문서화되었다. 남은 개선 여지는 롤백 테스트에서 revoke 호출 자체에 대한 단언 부재(단일 WARNING), `lastUsedIp` 단언이 원자성 테스트에 혼재되는 구조(INFO), findOne mock 반복 추출 미적용(INFO) 등이며, 어느 것도 기능적 정확성에는 영향이 없다. 테스트 커버리지 측면에서 C-1 시나리오의 핵심 경로는 모두 커버된다.

## 위험도

LOW
