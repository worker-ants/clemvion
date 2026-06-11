# Scope Review

## 발견사항

변경 범위 관점에서 이슈로 판단되는 항목이 없다.

### 파일 1: `codebase/backend/src/modules/auth/auth.service.spec.ts`

- **[INFO]** 기존 `DataSource.transaction` mock 의 `getRepository` 구현 교체
  - 위치: 라인 141-51 (diff 기준)
  - 상세: 기존 단순 generic mock 을 `entity === RefreshToken` 분기로 교체했다. 이는 테스트 대상 구현(`refresh()` 내 `manager.getRepository(RefreshToken)`)이 트랜잭션 manager 를 통해 `refreshTokenRepo` mock 을 참조해야 외부 `expect(refreshTokenRepo.update).toHaveBeenCalledWith(...)` 단언이 통과하므로, 구현 변경에 직접 대응하는 필수 수정이다. 불필요한 리팩토링이 아니다.

- **[INFO]** 신규 테스트 케이스 2개 추가 (`rotates revoke + issue inside a single transaction`, `propagates failure ...`)
  - 위치: 라인 57-96 (diff 기준)
  - 상세: plan `auth-refresh-rotation-atomic.md` 체크리스트 항목 "트랜잭션 중간 실패 주입 시 구 토큰 `is_revoked=false` 유지 + 기존 refresh/reuse green" 을 직접 커버하는 테스트다. 의도된 범위 내.

### 파일 2: `codebase/backend/src/modules/auth/auth.service.ts`

- **[INFO]** `EntityManager` import 추가
  - 위치: 라인 1033 (diff 기준)
  - 상세: `generateTokens` 에 `manager?: EntityManager` 파라미터 추가를 위한 필수 import. 불필요한 import 추가가 아니다.

- **[INFO]** `generateTokens` 시그니처에 optional `manager` 파라미터 추가
  - 위치: 라인 715-1077 (diff 기준)
  - 상세: 기존 호출처(`login`, `verifyEmail`, `loginWithTotp`, `issueTokensAfterMfa`, `issueTokensForOauthUser`, `registerWithInvitation`)는 모두 `manager` 인자를 전달하지 않아 동작이 변경되지 않는다. `refresh()` 경로만 manager 를 전달해 트랜잭션에 합류. 호출처 무변경이 코드에서 확인된다.

- **[INFO]** `refresh()` 정상 회전 분기의 revoke + INSERT 를 `dataSource.transaction` 으로 묶음
  - 위치: 라인 569-1065 (diff 기준)
  - 상세: reuse-detection 분기, `logout`, `resetPassword`, `verifyEmail`, `register` 등 다른 경로는 전혀 변경되지 않았다. 수정 범위가 `refresh()` 의 정상 회전 분기에만 집중돼 있다.

### 파일 3: `plan/in-progress/auth-refresh-rotation-atomic.md`

- **[INFO]** 신규 plan 파일 생성
  - 상세: 작업 추적 목적의 신규 파일로, CLAUDE.md 규약("진행 중 작업 → `plan/in-progress/<name>.md`")에 부합한다.

### 파일 4: `spec/data-flow/2-auth.md`

- **[INFO]** §1.4 시퀀스 다이어그램에 `rect` 블록 + 설명 노트 추가
  - 상세: plan 에 "회전 시퀀스의 revoke+INSERT 를 단일 트랜잭션 박스로 + 원자성 노트" 로 명시된 spec 갱신 작업이다. 변경 내용은 그 항목과 1:1 대응하며, 다른 섹션(§1.1~§1.3, §1.5~§4)은 일절 수정되지 않았다.

## 요약

4개 파일 모두 plan `auth-refresh-rotation-atomic.md` 에 정의된 범위(refresh 회전 원자화: `auth.service.ts` 구현 + 대응 테스트 + `spec/data-flow/2-auth.md` §1.4 갱신 + plan 파일 생성)에 정확히 맞아 떨어진다. 의도하지 않은 리팩토링, 기능 확장, 무관 파일 수정, 불필요한 포맷팅/주석/import 변경은 발견되지 않았다.

## 위험도

NONE
