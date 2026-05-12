### 발견사항

- **[WARNING]** `invite()` 동시 재발급 시 유효하지 않은 토큰 메일 발송
  - 위치: `workspace-invitations.service.ts` — `invite()` 내 pending 분기
  - 상세: 두 개의 동시 `invite()` 요청이 같은 `(workspaceId, email)` pending 행을 동시에 읽으면, 두 호출 모두 `pending.token = generateToken()` 후 `save()`를 실행한다. TypeORM `save()`는 PK 기준 UPDATE이므로 두 UPDATE 모두 성공하지만, 마지막 write가 이긴다. 두 개의 이메일이 발송되나 첫 번째 이메일의 링크 토큰은 이미 덮어써져 즉시 dead link가 된다. `resend()`도 동일 구조라 같은 문제가 발생한다.
  - 제안: `invite()` 전체 로직(pending 조회 → 토큰 발급 → save → 메일 발송)을 트랜잭션으로 감싸고, pending 행 조회에 `SELECT FOR UPDATE` (TypeORM: `setLock('pessimistic_write')`)를 사용하거나, DB-level 부분 UNIQUE 인덱스에 대한 `INSERT ... ON CONFLICT DO UPDATE` (upsert)로 교체한다.

- **[WARNING]** `invite()` 신규 행 동시 삽입 시 constraint violation이 application 계층에서 미처리
  - 위치: `workspace-invitations.service.ts` — `invite()`, pending이 null인 경우의 else 분기
  - 상세: 두 concurrent 요청이 모두 `findOne(..., acceptedAt: null)` 결과를 null로 받으면, 둘 다 INSERT를 시도한다. DB의 partial UNIQUE 인덱스(`idx_workspace_invitation_pending_unique`)가 두 번째 INSERT를 막지만, 이 예외가 NestJS의 `ConflictException`으로 매핑되지 않고 500으로 surfacing된다.
  - 제안: `invitationRepository.save()` 호출 주변에서 TypeORM `QueryFailedError`의 unique violation(`23505`)을 catch하여 `ConflictException`으로 변환한다.

- **[INFO]** `accept()` pre-flight 조회가 트랜잭션 밖에서 실행
  - 위치: `workspace-invitations.service.ts` — `accept()` (line ~253 이후)
  - 상세: invitation 존재/만료/acceptedAt 검사가 트랜잭션 외부에서 실행되고, 실제 원자적 보호는 `applyAccept()`의 CAS(`WHERE id = :id AND accepted_at IS NULL`)에 의존한다. pre-flight가 "통과"한 직후 다른 요청이 토큰을 소비하면 CAS에서 올바르게 GoneException이 발생하므로 기능상 정확하다. 단, pre-flight의 early-return 최적화와 실제 보호 지점이 분리되어 있어 코드 읽는 사람이 혼동할 수 있다.
  - 제안: 주석으로 "pre-flight check, CAS is the real guard" 를 명시하거나, `dataSource.transaction()` 안에서 re-read + CAS를 하나로 통합한다. 현재 상태로도 정확성에는 문제 없다.

- **[INFO]** `resolveTokenWorkspaceContext()` 비트랜잭션 다중 읽기
  - 위치: `auth.service.ts` — `resolveTokenWorkspaceContext()`
  - 상세: `findPersonalWorkspace` → `listForUser` → `findOrCreatePersonalWorkspace` 세 단계가 트랜잭션 밖에서 순차 실행된다. 초대 토큰 가입 직후 호출되므로 해당 사용자에 대한 동시 멤버십 변경이 실제로 발생할 확률은 매우 낮다. 그러나 이론상 두 번째 읽기(listForUser) 전에 다른 워크스페이스 멤버십이 추가/제거되면 토큰의 `workspaceId` claim이 의도와 다를 수 있다.
  - 제안: 허용 가능한 수준의 risk이므로 즉각 수정보다 주석 추가로 설계 의도를 명시하면 충분하다.

- **[INFO]** `void this.loginHistory.record()` fire-and-forget
  - 위치: `auth.service.ts` — `registerWithInvitation()` (~line 132)
  - 상세: 로그인 이력 기록이 `void` 키워드로 의도적으로 fire-and-forget 처리된다. 실패 시 에러 전파가 없다. 기능상 의도된 설계지만, 실패 로깅이 없으므로 SMTP/DB 문제 디버깅 시 blind spot이 된다.
  - 제안: `loginHistory.record()` 내부에서 catch + logger.warn을 보장하거나, 이미 처리되어 있다면 현 상태 유지.

---

### 요약

이번 변경의 핵심 동시성 보호 메커니즘인 초대 수락 CAS(`WHERE id = :id AND accepted_at IS NULL`) 패턴과 `consumeForRegistration()`을 외부 트랜잭션 manager 에 위임하는 설계는 올바르게 구현되었다. 중복 수락 경합은 DB 원자적 UPDATE로 정확히 차단된다. 주요 취약점은 `invite()`/`resend()`의 토큰 교체 구간으로, 동시 호출 시 유효하지 않은 토큰이 담긴 이메일이 발송될 수 있고, 신규 삽입 경합 시 constraint violation이 application 레벨에서 깔끔하게 처리되지 않는다. 두 문제 모두 트랜잭션 + pessimistic lock 또는 upsert로 해결할 수 있으며, acceptance/registration critical path는 이미 안전하게 보호되어 있다.

### 위험도

**LOW**