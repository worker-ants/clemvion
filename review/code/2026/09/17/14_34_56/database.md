# 데이터베이스(Database) 리뷰

## 검토 범위

이 라운드(`review/code/2026/09/17/14_34_56`)의 diff(`origin/main..HEAD`, 3 commits)는 이미 두 차례
DB 리뷰를 거친 변경이다.

1. `0b43da885` — 핵심 DB 로직: `TriggersService.update()`(창 1)의 저장 대상을 "재읽은 엔티티 통째
   `save`"에서 "이 요청이 바꾸는 필드만 담은 부분 객체 `save`"로 좁힘
   (`codebase/backend/src/modules/triggers/triggers.service.ts`), 이를 실제 Postgres + TypeORM으로
   재현하는 신규 e2e(`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`), 관련
   mock/unit 테스트 조정 — `review/code/2026/09/17/13_44_39`(1라운드)가 LOW 로 평가.
2. `6d845d8a2` — 1라운드 처분 반영(payload 조립 단일화 `const patch`, 낡은 주석 정정, mock 재측정
   등) — `review/code/2026/09/17/14_11_48`(2라운드)가 새 DB 결함 없음으로 재확인, LOW.
3. `d60cc65aa` — **문서/주석 전용** 후속: `trigger-transaction-mock.ts` JSDoc 의 뮤턴트 RED 건수
   ("60")를 "형태 의존적이라 숫자를 고정하지 않는다"는 서술로 교체, `CHANGELOG.md`·plan 문서의
   CASCADE 실측 범위(`workflow`만 쟀고 `workspace`는 재지 않았다)를 정정한 것. `git show --stat`으로
   확인한 결과 이 커밋은 `codebase/backend/src/**` 프로덕션 코드를 전혀 건드리지 않는다.

핵심 DB 로직(부분 객체 `save`) 자체는 지난 두 라운드에서 12명 이상의 리뷰어가 실측 근거(Postgres+
TypeORM e2e 재현)와 함께 반복 검증했고, 이번 라운드의 유일한 신규 변경은 코드 동작에 영향이 없는
주석/문서 정정이다. 이번 라운드는 "새 DB 결함이 diff에 있는지"만 다시 확인했다.

## 발견사항

새로 발견된 CRITICAL/WARNING 급 DB 결함 없음. 아래는 확인 사항이다.

- **[정보]** `d60cc65aa`는 DB 동작에 영향 없음(문서/주석 전용)
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62-70`(JSDoc), `plan/in-progress/trigger-save-partial-patch.md`
  - 상세: `git show --stat d60cc65aa`로 대조한 결과 실제 쿼리·트랜잭션·스키마 코드 변경 없음. mock 파일도 `save`의 `async`/반환값 처리 로직(2라운드에서 이미 검토됨)은 그대로이고 JSDoc 텍스트만 바뀌었다.
  - 제안: 조치 불요.

- **[정보, 재확인 — 신규 아님]** 핵심 저장 로직(부분 객체 `save`)은 lost-update를 구조적으로 차단한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 트랜잭션 블록(`patch = { ...defined, config: mergedConfig }` → `m.save(Trigger, { id: target.id, ...patch })`)
  - 상세: 직접 소스를 재확인했다. advisory lock 안에서 재읽은 행을 기준으로 병합하되, 저장 시엔 넘기지 않은 컬럼이 `undefined`라 TypeORM `save`의 "엔티티와 DB 값의 차이만 UPDATE" 비교에서 빠져, 락 밖에서 커밋된 컬럼(`notification_secret_v2`·`last_triggered_at`·`chat_channel_token_v2` 등)이 되써지지 않는다. 저장(`patch`)과 응답 조립(`Object.assign(target, patch)`)이 같은 객체를 재사용해 필드 드리프트 위험도 1라운드 WARNING#5 해소로 제거된 상태 그대로다.
  - 제안: 조치 불요.

- **[정보, 재확인 — 신규 아님]** e2e(`trigger-update-save-window.e2e-spec.ts`)의 커넥션 관리·SQL 파라미터화는 적절
  - 위치: `beforeAll`(74행)에서 `DataSource`·`pg.Client` 각각 오픈, `afterAll`(102-104행)에서 `ds.destroy().catch(...)` → `db.end().catch(...)` 순으로 둘 다 정리. 모든 raw 쿼리(`db.query('DELETE FROM workflow WHERE id = $1', [...])` 등)가 `$1`/`$2` 바인딩 사용, 리터럴 문자열은 테스트 고정값이지 인젝션 표면 아님.
  - 제안: 조치 불요.

- **[정보, 재확인 — 신규 아님, 이미 트래킹됨]** 두 건의 비차단 갭이 여전히 남아 있으나 이번 diff가 만든 것이 아니고 새 리스크 증가도 없다
  1. `written.updatedAt` truthy 가드(`triggers.service.ts`, `if (written.updatedAt) target.updatedAt = written.updatedAt;`)의 falsy 분기는 회귀 테스트가 없다 — e2e ②c가 실제 Postgres 경로에서 항상 채워짐을 실측했으므로 운영 위험은 낮다.
  2. 재읽기 뒤 `workflow` FK CASCADE 삭제 경합은 여전히 일반 500(`INTERNAL_ERROR`)으로 마스킹된다 — `rethrowEndpointPathConflict`가 `endpointPath` unique violation만 특별 처리. plan "이 PR이 안 하는 것"과 두 차례 리뷰에서 이미 planner 후속(`spec/5-system/15-chat-channel.md §5.4` 404 매핑)으로 등재됨.
  - 제안: 조치 불요(이미 트래킹됨).

- **인덱스 / N+1 / 마이그레이션 / 스키마 설계 / 대량 데이터**: 이번 diff는 단건 트리거 행에 대한 UPDATE payload 범위 조정과 그 검증(e2e/unit/주석)뿐이며, 새 쿼리 패턴(반복문 내 개별 쿼리)·인덱스가 필요한 신규 조회·스키마/마이그레이션 변경·페이지네이션 대상 대량 조회를 포함하지 않는다. 해당 관점에서 특이사항 없음.

## 검증 방법

저장소를 뮤테이션하지 않고 소스 대조만으로 판단했다(`git status --short` 확인 불요 — 아무 파일도
건드리지 않음). `git show --stat d60cc65aa`로 이번 라운드의 유일한 신규 커밋이 프로덕션 DB 코드를
건드리지 않음을 확인했고, `triggers.service.ts`의 `update()` 전체와 `trigger-update-save-window.e2e-spec.ts`의
커넥션 정리/쿼리 파라미터화 부분을 직접 읽어 1·2라운드 DB 리뷰의 결론과 대조했다.

## 요약

이번 라운드에서 새로 추가된 유일한 커밋(`d60cc65aa`)은 문서/주석 전용 정정으로, DB 동작에 영향을
주는 코드 변경이 없다. 핵심 DB 로직(advisory lock 안 부분 객체 `save`로 lost-update를 차단하는 수정)은
지난 두 라운드에서 이미 Postgres+TypeORM 실측 e2e로 검증되었고 이번 라운드에서 직접 재확인한 결과도
동일하다. 커넥션 관리·SQL 파라미터화도 적절하며, 새로 발견된 CRITICAL/WARNING 급 DB 결함은 없다. 남은
INFO 2건(`written.updatedAt` falsy 분기 미검증, CASCADE 경합의 500 마스킹)은 이전 라운드에서 이미
식별·트래킹된 비차단 갭이다.

## 위험도
NONE — 이번 라운드의 신규 변경분(`d60cc65aa`)은 DB 코드에 영향이 없고, 기존 DB 로직은 두 차례 LOW
평가를 재확인했을 뿐 새 이슈가 없다.
