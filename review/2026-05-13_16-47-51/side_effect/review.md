### 발견사항

- **[INFO]** `record()` 의 예외 격리가 `await` 전환 후에도 유효한지 검증 필요
  - 위치: `login-history.service.ts:75` (`record()` try/catch 블록)
  - 상세: `record()` 내부에서 모든 예외를 catch 하므로 `await` 로 바꿔도 호출부로 예외가 전파되지 않는다. 현재 코드는 이 불변식을 유지하고 있어 안전하다. 단, `this.repository.save()` 이전에 동기 코드(`this.repository.create(...)`)가 있어 그 경로는 try/catch 안에 포함되어 있음도 확인된다.

- **[INFO]** 에러 응답 경로의 레이턴시 증가
  - 위치: `auth.service.ts:227–243` (USER_NOT_FOUND, ACCOUNT_LOCKED 등)
  - 상세: 실패 경로(`throw` 직전)에서도 `await record()` 가 삽입됐으므로, 실패 응답 레이턴시도 INSERT 1회(~1–5 ms)만큼 증가한다. plan 문서는 성공 경로 latency 만 언급했으나 실패 경로도 동일하게 영향 받는다. 보안 감사가 목적이므로 의도된 트레이드오프이지만 명시적으로 인지할 필요가 있다.

- **[INFO]** `registerWithInvitation` — loginHistory.record 가 트랜잭션 외부에 있음
  - 위치: `auth.service.ts:141–148`
  - 상세: `dataSource.transaction(...)` 커밋 이후에 `await loginHistory.record(...)` 가 호출된다. 이는 변경 전·후 모두 동일한 구조로, `await` 전환이 기존 설계를 바꾸지 않는다. 트랜잭션 롤백 시 login_history row 가 남지 않는 구조도 유지된다.

- **[INFO]** 함수 시그니처·공개 API 변경 없음
  - 위치: 전 파일
  - 상세: `record(): Promise<void>` 시그니처는 변경 없음. 호출부가 `void`→`await` 로 바뀌었을 뿐이므로, 다른 호출자가 추가로 생겨도 기존 계약을 위반하지 않는다.

---

### 요약

이번 변경은 `void loginHistory.record(...)` → `await loginHistory.record(...)` 의 단순 교체로, 함수 시그니처·반환 타입·전역 상태·환경변수·네트워크 호출·이벤트 구조를 일절 바꾸지 않는다. `record()` 내부 try/catch 가 예외를 삼켜주기 때문에 `await` 로 전환해도 인증 흐름에 새로운 실패 모드가 생기지 않는다. 유일한 관측 가능한 부작용은 각 인증 엔드포인트의 응답 시간이 INSERT 1회(~1–5 ms) 만큼 증가하는 것이며, 성공 경로와 동일하게 실패 경로(USER_NOT_FOUND 등)에도 동일한 레이턴시가 추가된다는 점은 plan 문서에 추가해 두면 좋다.

### 위험도

**LOW**