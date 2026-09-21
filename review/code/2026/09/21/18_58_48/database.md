# 데이터베이스(Database) 리뷰

## 대상 요약

`WebAuthnService.deleteCredential()`(`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`)이
잠금 없는 `findOne` 뒤 `credentialRepo.delete({ id, userId })`(원자적 단일 UPDATE/DELETE 문)를 실행하고,
그동안 버려지던 `affected` 반환값을 `affected === 0` 명시 비교로 판정해 동시 삭제 진 쪽을 404 로 끝내도록
고쳤다. 조건절에 `userId` 를 추가해 소유권 검증을 애플리케이션 레이어(JS 비교)에서 DB WHERE 절로 내렸다.
스키마·마이그레이션 변경은 없다.

## 발견사항

- **[INFO]** `deleteCredential()` 은 여전히 `DELETE`(캐너리 대상) → `countCredentials()`(`SELECT COUNT`) →
  조건부 `usersService.update()`(`UPDATE user`) 세 문장을 트랜잭션 없이 순차 실행한다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()` 561~574행
    (`const { affected } = await this.credentialRepo.delete(...)` 부터 `return { remaining };` 까지).
  - 상세: 이번 diff 가 만든 문제는 아니다 — 세 문장 비원자성은 diff 이전부터 있던 구조이고, 이번 변경은
    그 위에 `affected === 0` 판정만 추가했다. 같은 세션의 이전 리뷰(`review/code/2026/09/21/18_03_54`)가
    "서로 다른 credential 두 개를 동시 삭제하면 두 `countCredentials` 가 서로 상대의 커밋 전 스냅샷을
    읽어 둘 다 `remaining===1` 로 오판할 수 있다"는 경합을 지적했고, `RESOLUTION.md` 의 WARNING #4 가
    커밋 순서 논증(`deleteCredential` 은 트랜잭션이 없어 각 DELETE 가 그 자리에서 즉시 커밋되므로 나중에
    커밋하는 쪽은 항상 최신 count 를 본다)으로 그 특정 경합을 반증하고 e2e 캐너리
    (`webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 case)로 고정했다. `this.dataSource.transaction`
    이 같은 파일 338행 부근에서 실제로 쓰이고 있어(예: 등록 검증 플로우), "트랜잭션이 없으므로 즉시
    커밋된다"는 그 논증의 전제(오토커밋)는 코드상으로도 확인된다 — 이 부분에 한해 반증이 유효하다.
  - 다만 그 논증은 **DELETE-DELETE(같은 유저, 다른 credential)** 경합만 다루며, DELETE 진행 중 **같은
    유저가 새 credential 을 등록(INSERT)** 하는 인터리빙까지는 다루지 않는다. 예: (a) 마지막 credential
    삭제 중 `DELETE` 커밋 → (b) 동시 등록 요청의 `INSERT` 커밋 → (c) 삭제 쪽 `countCredentials()` 가 그
    새 row 를 보고 `remaining===1` 로 복구 코드를 보존(정상) — 이 순서는 문제 없다. 반대로 (a) 삭제
    `DELETE` 커밋 → (b) 삭제 쪽 `countCredentials()` 가 `0` 을 봄 → (c) 등록 `INSERT` 커밋 → (d) 삭제 쪽이
    `usersService.update(webauthnRecoveryCodes: null)` 를 실행 — 이 순서면 신규 credential 이 이미 존재함에도
    복구 코드가 NULL 화된다. 좁은 타이밍 윈도우이고 이번 diff 가 만들지도, 넓히지도 않았다(변경 전
    구조 그대로).
  - 이미 `RESOLUTION.md` 「보류·후속 항목」이 "WARNING #4 의 근본 원인(비원자적 delete+count+recovery-
    code-NULL 시퀀스 자체)은 이번 PR 범위 밖" 이라고 명시하고 후속 트래커로 넘겼으므로, DELETE-INSERT
    인터리빙 역시 그 후속(트랜잭션+행 락 개선) 범위에 포함시킬 사안으로 본다.
  - 제안: 이번 PR 착수·병합을 막을 사유는 아니다. 후속 트랜잭션 개선 작업 시 DELETE-DELETE 뿐 아니라
    "삭제 진행 중 신규 등록" 인터리빙도 시나리오에 포함해 두면 좋다(신규 이슈 등록 불필요 — 기존
    후속 항목 범위 확장으로 충분).

- **[INFO]** `credentialRepo.delete({ id: credentialUuid, userId })` 는 PK(`id`)로 단일 행을 특정하고
  `user_id` 컬럼에는 `idx_webauthn_credential_user` 인덱스가 존재해(`entities/webauthn-credential.entity.ts:20-22`)
  인덱스 관점 리스크 없음. 파라미터화된 TypeORM 쿼리 빌더 경로만 사용해 SQL 인젝션 벡터 없음. 반복문 내
  개별 쿼리(N+1)나 대량 데이터 페이지네이션 이슈도 해당 없음 — 단일 사용자 스코프의 단건 조회/삭제.

- **[INFO]** `affected === 0` 명시 비교(대신 `!affected`) 채택은 DB 드라이버 계약 관점에서 올바르다 —
  `DeleteResult.affected` 가 `undefined`/`null` 인 것(드라이버 미보고)과 `0`(실제 미삭제)을 구분해야
  정상 삭제 경로가 오탐 404 로 뒤집히지 않는다. 회귀 테스트(`webauthn.service.spec.ts` `it.each([[undefined],
  [null]])`)가 이 구분을 대조군으로 보증한다.

## 요약

이번 diff 의 핵심 변경(`credentialRepo.delete()` 의 `affected` 판정 도입 + WHERE 절에 `userId` 추가)은
DB 관점에서 견고하다 — 파라미터화 쿼리, 인덱스된 컬럼 사용, `affected` 값의 명시적(0 vs null/undefined)
구분, 그리고 동시 삭제 진 쪽이 조기에 예외를 던져 이후 `countCredentials`·`usersService.update` 를 건너뛰게
한 제어 흐름 모두 타당하다. 스키마·마이그레이션 변경이 없어 무중단 배포 리스크도 없다. 유일하게 남는 것은
`deleteCredential()` 이 여전히 DELETE→COUNT→UPDATE 세 문장을 트랜잭션 없이 순차 실행하는 기존 구조이며,
이번 세션이 이미 DELETE-DELETE 경합은 반증·캐너리로 닫았지만 DELETE 진행 중 신규 등록(INSERT) 인터리빙까지는
다루지 않았다 — 다만 이는 이번 diff 가 새로 만들거나 넓힌 문제가 아니고 이미 후속 트래커로 분류돼 있어
착수·병합을 막을 사유는 아니다.

## 위험도

LOW
