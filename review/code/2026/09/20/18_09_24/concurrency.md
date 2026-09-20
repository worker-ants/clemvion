# 동시성(Concurrency) 코드 리뷰

## 스코프 메모

이번 라운드(18_09_24)의 diff 는 직전 라운드(17_35_12)에서 이미 전량 리뷰한 핵심 lost-update 수정
(`5c694cc5f`/`f3ea25d02`, `pessimistic_write` 락 안 재읽기)에 대한 **후속 조치 커밋 3건**이다:

- `ab0988f7f` — 단위 테스트에 `workspaceId` 스코핑 단언·`freshErrors` 재검증 단언 추가 (뮤테이션 커버리지)
- `af6cc0d2c` — 락 전/후로 복제돼 있던 "권한 재검사"·"머지+구조검증" 로직을 `assertCanRotate`/
  `mergeAndValidateCredentials` private 헬퍼로 통일
- `154e17d31` — 신규 e2e(`integration-rotate-concurrency.e2e-spec.ts`)의 `BEGIN`~`COMMIT` 구간을
  `try/finally` 로 감싸 assertion 실패 시 트랜잭션·pending 요청이 새는 것을 막음

나머지 파일(`CHANGELOG.md`, `plan/**`, `review/consistency/**`, `review/code/17_35_12/**` 자체)은
문서·이전 리뷰 산출물이라 동시성 코드 리뷰 대상이 아니다. 실제 프로덕션 락/트랜잭션 로직
(`integrations.service.ts` `rotate()`)은 이번 diff 로 **동작이 바뀌지 않았다** — `git diff
f3ea25d02..HEAD`로 직접 대조해 트랜잭션 경계·락 모드·재읽기 순서·`workspaceId` 스코핑이 리팩터 전후
동일함을 확인했다(추출된 두 헬퍼는 순수 동기 함수이고 `await` 를 포함하지 않아 새 인터리빙 지점을
만들지 않는다).

## 발견사항

- **[INFO]** e2e `try/finally` 추가는 실제 리소스 누수 경로를 정확히 닫는다 — 새 결함 없음
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:86-160` (`locker.query('BEGIN')` ~
    `finally` 블록)
  - 상세: 수정 전에는 `BEGIN` 과 `COMMIT` 사이의 어떤 `expect(...)` 든 실패하면 예외가 그대로
    던져져 `locker` 커넥션이 트랜잭션이 열린 채(행 락을 쥔 채) `afterAll` 까지 남고, 그 락을 기다리던
    `pending`(요청 B, 서버 쪽 DB 커넥션 하나를 점유)도 테스트 프로세스가 끝날 때까지 풀리지 않는다 —
    커넥션 풀 관점(점검 관점 8)의 실질적 누수다. 수정된 코드는 `finally` 에서 **먼저 `ROLLBACK`(락 해제) →
    다음 `pending` 을 드레인**하는 순서를 지켜, 실패 시에도 잠긴 행과 대기 중인 서버 커넥션을 정상적으로
    되돌린다. 정상 경로(이미 `COMMIT` 된 뒤)에 추가로 실행되는 `ROLLBACK` 은 Postgres 가 "트랜잭션 없음"
    경고만 내고 no-op 으로 처리하므로(`.catch(() => undefined)` 로 방어까지 돼 있음) 부작용이 없다.
    `pending` 이 `try` 블록 진입 직후(`BEGIN` 이후, 요청 B 를 보내기 **전**)의 실패 경로에서는 아직
    `undefined` 라 `pending?.catch(...)` 가 안전하게 스킵된다.
  - 제안: 조치 불요 — 검증만 하고 기록.

- **[INFO]** 락 전/후 검증 로직을 `assertCanRotate`/`mergeAndValidateCredentials` 헬퍼로 추출한 리팩터는
  동시성 관점에서 행동 불변(behavior-preserving)임을 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1082-1119` (헬퍼 정의),
    `:1136,1138`(락 전 호출) · `:1179,1182-1185`(트랜잭션 콜백 안 호출)
  - 상세: 두 헬퍼 모두 동기 함수이며 인스턴스 필드를 읽거나 쓰지 않고 인자로 받은 `row`/`patch`/`userRole`
    만으로 순수 계산한다 — `await` 가 없으므로 두 헬퍼 호출 사이에 이벤트 루프가 다른 요청에 양보할 지점이
    생기지 않는다. 즉 이 리팩터로 새로운 TOCTOU 창이나 인터리빙 지점이 생기지 않았고, 트랜잭션 콜백 안에서
    호출되는 `assertCanRotate(fresh, ...)`/`mergeAndValidateCredentials(fresh, ...)` 는 여전히 `pessimistic_write`
    락이 걸린 뒤 재읽은 `fresh` 를 대상으로 한다(락 전 호출은 여전히 `entity` 대상). `repo.update({ id: entity.id
    }, changes)`(:1199)의 `workspaceId` 미포함도 리팩터 전과 동일 — 같은 트랜잭션 안에서 이미 `where: { id,
    workspaceId }` 로 락을 확인한 뒤의 쓰기라 안전하며, 이 diff 가 만든 변화가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 단위 테스트(workspaceId 스코핑 단언, `freshErrors` 재검증 단언)는 시퀀셜 mock 기반이라
  동시성 자체를 검증하지 않지만, 각각 겨냥한 뮤턴트를 정확히 잡는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1402-1406`(`lockedRead?.where`
    단언), `:1428-1454`(락 안 재검증 실패 테스트)
  - 상세: RESOLUTION.md 가 기록한 뮤테이션 결과(두 뮤턴트 각각 1건씩 RED)와 코드를 대조해 판별력을
    확인했다 — `where` 에서 `workspaceId` 를 빼는 뮤턴트, `freshErrors` 재검증 블록을 통째로 삭제하는
    뮤턴트가 각각 새 단언 하나씩만 죽인다(표면이 겹치지 않음). 동시성 시나리오 자체(실제 겹침)는 e2e 가
    담당하고 이 unit 은 락 안 재읽기 호출부의 인자·재검증 로직만 고정하므로 역할 분담이 적절하다.
  - 제안: 조치 불요.

## 검증 메모 (뮤테이션 없이 정적 확인)

- `git diff f3ea25d02..HEAD -- integrations.service.ts integrations.service.spec.ts
  integration-rotate-concurrency.e2e-spec.ts` 로 직전 라운드 리뷰 시점 이후의 순변경만 골라 대조했다 —
  트랜잭션 경계(`this.dataSource.transaction(...)`)·락 모드(`pessimistic_write`)·재읽기 `where` 조건은
  문자 그대로 동일하고, 바뀐 것은 (a) 중복 로직의 헬퍼 추출 (b) 테스트 커버리지 보강 (c) e2e 정리 로직뿐이다.
- 저장소를 뮤테이션하지 않았다 — `Read`/`git diff`/`git log` 만 사용, `git status --short` 확인 결과 세션이
  만든 것은 `review/code/2026/09/20/18_09_24/`(harness 산출물)뿐이다.

## 요약

이번 라운드의 diff 는 직전 라운드에서 이미 LOW 로 판정한 rotate() lost-update 수정의 **핵심 락/트랜잭션
로직을 바꾸지 않는다** — 락 전/후 중복 로직을 순수 동기 헬퍼로 통일한 리팩터, 뮤테이션 커버리지를 메우는
단위 테스트 2건, 그리고 assertion 실패 시 e2e 가 트랜잭션·대기 중인 요청을 흘리던 것을 막는 `try/finally`
정리 로직으로 구성된다. 세 변경 모두 검증 결과 동시성 관점에서 새 결함을 만들지 않았고, 특히 e2e
try/finally 는 실패 경로에서 DB 행 락과 서버 커넥션이 테스트 종료 후까지 새는 실제 리소스-풀 문제를 올바른
순서(락 해제 → pending 드레인)로 닫는 개선이다. Critical/Warning 급 동시성 결함은 발견하지 못했다.

## 위험도

LOW
