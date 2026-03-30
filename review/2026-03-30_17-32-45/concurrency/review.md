## 동시성 코드 리뷰

### 발견사항

- **[CRITICAL]** `findOrCreatePersonalWorkspace`의 TOCTOU 경쟁 조건
  - 위치: `workspaces.service.ts` — `findOrCreatePersonalWorkspace`
  - 상세: `findPersonalWorkspace` (조회)와 `createPersonalWorkspace` (생성) 사이에 원자성이 없음. 동일 사용자에 대해 두 요청이 동시에 진입하면 둘 다 `existing = null`을 얻고 워크스페이스를 중복 생성할 수 있음. `slug`의 `uuidv4()` 랜덤성으로 인해 DB 유니크 제약이 없다면 중복 워크스페이스가 실제로 저장됨.
  - 제안: DB 레벨 유니크 제약(`ownerId + type = personal`) 추가 후 삽입 충돌 시 기존 레코드를 반환하는 upsert 패턴 사용. 또는 `INSERT ... ON CONFLICT DO NOTHING` 방식 적용.

```typescript
// 권장 패턴
async findOrCreatePersonalWorkspace(...): Promise<Workspace> {
  try {
    return await this.createPersonalWorkspace(userId, userName, email);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return this.findPersonalWorkspace(userId)!;
    }
    throw err;
  }
}
```

---

- **[WARNING]** `verifyEmail` 트랜잭션과 `generateTokens` 호출의 분리
  - 위치: `auth.service.ts` — `verifyEmail`, 약 93~127행
  - 상세: 트랜잭션 내부에서 사용자 검증 및 워크스페이스 생성이 완료된 후, `generateTokens`가 트랜잭션 외부에서 `findOrCreatePersonalWorkspace`를 다시 호출함. 트랜잭션 커밋 직후 `generateTokens`가 실행되기 전 같은 사용자의 다른 요청이 `findOrCreatePersonalWorkspace`를 통해 워크스페이스를 중복 생성할 여지가 있음 (위 CRITICAL과 연계됨).
  - 제안: `generateTokens`에 워크스페이스 파라미터를 선택적으로 받도록 하거나, 트랜잭션에서 생성된 워크스페이스 ID를 직접 전달하여 불필요한 재조회를 방지.

---

- **[WARNING]** `findOrCreatePersonalWorkspace` 내 워크스페이스-멤버 생성의 비원자성
  - 위치: `workspaces.service.ts` — `createPersonalWorkspace`
  - 상세: 워크스페이스 저장 후 멤버 저장 전에 실패하면, 멤버가 없는 고아 워크스페이스가 생성됨. 트랜잭션으로 묶여 있지 않아 부분 실패 시 데이터 불일치 발생 가능.
  - 제안: `createPersonalWorkspace`를 트랜잭션으로 래핑하거나, `DataSource.transaction`을 주입받아 원자적으로 처리.

---

- **[INFO]** `verifyEmail` 트랜잭션 내 slug 생성의 충돌 가능성
  - 위치: `auth.service.ts` — `verifyEmail` 트랜잭션 블록
  - 상세: `uuidv4().substring(0, 4)` 기반 slug는 충돌 확률이 낮지 않음 (16^4 = 65536 경우의 수). 동일 이메일 로컬파트 사용자가 많아지면 slug 중복 삽입 오류 발생 가능.
  - 제안: slug에 더 긴 랜덤 suffix 사용 또는 충돌 시 재시도 로직 추가.

---

- **[INFO]** 테스트 코드에서 트랜잭션 모의의 비동시성 한계
  - 위치: `auth.service.spec.ts` — `DataSource` mock
  - 상세: 현재 mock은 직렬 실행만 검증하며 실제 동시 요청 시나리오(경쟁 조건)는 검증하지 않음. 기능 정확성 테스트로는 적절하나, 위의 TOCTOU 버그는 이 테스트로 잡히지 않음.
  - 제안: 통합 테스트 또는 실제 DB 환경에서 동시 요청 시나리오 테스트 추가 고려.

---

### 요약

가장 큰 위험은 `findOrCreatePersonalWorkspace`의 **TOCTOU(Time-of-check-to-time-of-use) 경쟁 조건**으로, DB 유니크 제약 없이 check-then-act 패턴을 사용해 동시 요청 시 중복 워크스페이스가 생성될 수 있음. `verifyEmail`에서 트랜잭션을 도입한 것은 올바른 방향이나, 트랜잭션 이후 `generateTokens`에서 워크스페이스를 재조회하는 구조와 `createPersonalWorkspace` 자체가 트랜잭션 없이 workspace→member 순서로 저장하는 비원자성 문제가 여전히 남아 있음. Node.js 단일 스레드 특성상 단순 부하에서는 문제가 드러나지 않지만, 이메일 인증 링크 중복 클릭이나 여러 세션 동시 로그인 등 실사용 시나리오에서 데이터 불일치로 이어질 수 있는 실질적 위험.

### 위험도
**HIGH**