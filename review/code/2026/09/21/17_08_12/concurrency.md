# 동시성(Concurrency) 리뷰 — model-config 동시 DELETE 감사 중복 수정 (#1369~#1374 계열의 여덟 번째)

## 검토 범위

`ModelConfigService.remove()` 를 무락 `findEntity` → `repo.remove(config)`(0행이어도 예외
없음) → `notifyInvalidated` → `recordAudit` 순서에서, 무락 `findEntity`(kind 캡처용) →
원자적 `repo.delete({ id, workspaceId })` → `affected === 0` 명시 비교로 진 쪽 판별 →
(승자만) `notifyInvalidated` → `recordAudit` 로 바꾼 변경. 형제 일곱 자리(#1369~#1374, 워크플로
·워크스페이스·트리거·스케줄·통합·멤버 제거·인증 설정)와 같은 처방을 그대로 적용한 8번째다.

`codebase/backend/src/modules/model-config/model-config.service.ts:399-441`,
단위 테스트 `codebase/backend/src/modules/model-config/model-config.service.spec.ts`,
e2e `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` 를 실제 파일로
직접 열어 대조했다(프롬프트의 "전체 파일 컨텍스트"가 크기 제한으로 비어 있었음).

## 발견사항

- **[INFO]** 원자성 판별이 올바르다 — `affected === 0` 명시 비교
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:426-429`
  - 상세: 무락 `findEntity` (`:404`) 를 두 요청이 모두 통과할 수 있다는 TOCTOU 창을,
    새 락을 들이지 않고 `DELETE … WHERE id = $1 AND workspace_id = $2` 한 문장의 DB
    레벨 원자성으로 닫았다. 판별자를 `!affected` 가 아니라 `affected === 0` 로 명시
    비교한 것도 정확하다 — TypeORM `DeleteResult.affected` 는 드라이버가 행 수를
    보고하지 않으면 `null`/`undefined` 일 수 있는데, 이를 falsy 로 오판하면 정상
    삭제를 404 로 뒤집는 회귀가 생긴다(형제 자리 #1371 에서 이미 실측된 함정, 트래커에
    "같은 뮤턴트가 32건을 통과했다"고 기록됨). 이번 diff 는 대조군 테스트
    (`model-config.service.spec.ts:1128-1144`, `affected: undefined`/`null` 두 케이스)로
    이 함정을 명시적으로 막아 두었다.
  - 제안: 없음 — 형제 일곱 자리와 동일한 검증된 패턴이며 추가 조치 불필요.

- **[INFO]** 승자 전용 부수효과 순서는 사전조건 확인이 정확하다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:426-441`
  - 상세: `affected === 0` 이면 `notFound()` 를 던지고 함수가 끝나므로, 진 쪽은
    `notifyInvalidated`·`recordAudit` 어느 쪽도 도달하지 않는다. 단위 테스트
    (`model-config.service.spec.ts:1104-1120`)가 이를 직접 단언한다
    (`auditLogs.record`·`listener` 둘 다 `not.toHaveBeenCalled()`). `notifyInvalidated`
    자체가 멱등(리스너가 `LlmService.clearClientCache` 하나뿐, `llm.service.ts:81`)이라
    하더라도 "진 쪽이 아예 안 부른다"를 계약으로 삼은 것은 옳은 방향이다 — 멱등성에
    기대는 것보다 강한 보장이다.
  - 제안: 없음.

- **[INFO]** 승자 경로 내부의 `notifyInvalidated` → `recordAudit` 순서는 기존 패턴을 유지 (신규 회귀 아님)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:434-441`
  - 상세: 캐시 무효화 통지가 감사 기록보다 먼저 실행된다. `recordAudit` 이 실패하면
    (예: DB 일시 장애) 캐시는 이미 무효화됐는데 감사 행은 안 남는 비대칭이 이론상
    가능하다. 다만 이 순서는 이번 diff 가 새로 만든 것이 아니라 수정 전
    `repo.remove(config)` 이후에도 동일했던 기존 순서이고, `notifyInvalidated` 는
    각 리스너 호출을 개별 try/catch 로 격리하는 best-effort 설계(`:79-91`,
    "무효화는 best-effort 부수효과이지 mutation 성공의 전제가 아니다")로 이미
    문서화돼 있다. 이번 diff 범위의 회귀는 아니므로 조치 불요, 참고용으로만 기록.
  - 제안: 없음 (범위 밖).

- **[INFO]** e2e 동시성 재현 fixture는 형제 패턴을 정확히 재사용하고 공허성 가드도 갖췄다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts:85-115`
  - 상세: 별도 커넥션(`locker`)으로 `SELECT id FROM model_config WHERE id = $1 FOR UPDATE`
    를 잡아 두 DELETE 요청이 무락 `findEntity` 통과 뒤 원자적 DELETE 단계에서 실제로
    막히도록 강제한다(Postgres 는 DELETE 도 해당 행의 쓰기 락을 요구하므로 락 보유
    트랜잭션이 COMMIT/ROLLBACK 할 때까지 대기). `Promise.race` 로 "락을 놓기 전
    둘 다 아직 안 끝났는지" 를 먼저 관측하는 공허성 가드(`:96-104`)가 있어, fixture가
    실제로 겹침을 만들지 못하면 테스트 자체가 실패하도록 설계됐다 — 이 가드가 없으면
    "고치기 전 코드도 통과시키는" 거짓 GREEN 위험이 있는데 여기선 막혀 있다.
    `finally` 블록에서 `locker.query('ROLLBACK').catch(() => undefined)` 와
    `pending?.catch(() => undefined)` 로 예외 경로에서도 커넥션·pending promise 를
    정리해 리소스 누수를 방지한다.
  - 제안: 없음.

- **[INFO]** 로컬 취약 상태(mutation) 없이 리뷰 완료
  - 상세: 가설 검증을 위해 저장소 파일을 고치지 않았다(정적 대조 + 실제 소스 Read 로
    충분히 판별 가능했음). `git status --short` 기준으로 이 리뷰가 만든 변경은 없다.

## 요약

동시 DELETE 두 건이 무락 `findEntity` 를 모두 통과해 감사 행을 중복 기록하던 TOCTOU 결함을,
새 락(advisory/row lock) 도입 없이 단일 원자적 `repo.delete({ id, workspaceId })` 와
`affected === 0` **명시 비교**로 닫았다. 이는 이미 6~7차례 검증되어 병합된 형제 수정
(#1369~#1374)과 완전히 동일한, 검증된 패턴의 반복 적용이며, `null`/`undefined` vs `0`
구분(형제 #1371 에서 실측된 함정)을 막는 대조군 단위 테스트와 실제 DB 행 락으로 겹침을
강제하는 e2e 공허성 가드까지 갖췄다. 승자만 캐시 무효화 통지·감사 기록에 도달하도록
사전조건이 정확히 걸려 있고, 진 쪽은 도메인 고유 404(`MODEL_CONFIG_NOT_FOUND`)로 응답한다.
새로 도입된 동시성 위험은 발견되지 않았다.

## 위험도

NONE
