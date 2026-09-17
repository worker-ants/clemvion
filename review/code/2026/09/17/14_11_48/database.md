# 데이터베이스(Database) 리뷰

## 검토 범위

이 라운드의 diff(`origin/main..HEAD`)는 크게 두 갈래다.

1. **실제 DB 동작 변경** — `TriggersService.update()`(창 1)의 저장 대상을 "재읽은 엔티티 통째 `save`"에서
   "이 요청이 바꾸는 필드만 담은 부분 객체 `save`"로 좁힌 것(`codebase/backend/src/modules/triggers/triggers.service.ts:679-717`),
   이를 실제 Postgres + TypeORM으로 재현하는 신규 e2e
   (`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`), 관련 mock/unit 테스트 조정
   (`trigger-transaction-mock.ts`, `triggers.service.spec.ts`).
2. **1라운드(`review/code/2026/09/17/13_44_39`) 처분의 코드 반영 + 그 라운드 산출물(RESOLUTION/SUMMARY/
   각 리뷰어 리포트/consistency 산출물)의 신규 커밋** — 이 부분은 문서·테스트 정리이고 새 DB 동작을
   추가하지 않는다.

핵심 DB 로직(부분 객체 `save`) 자체는 1라운드 `database.md`가 이미 실측 근거와 함께 LOW 위험으로
평가했다. 이번 라운드는 그 판단에 영향을 줄 만한 **새 DB 결함이 diff에 있는지**를 다시 확인했다.

## 발견사항

- **[POSITIVE/INFO]** 1라운드 WARNING#5(저장 payload 이중 작성)가 실제로 해소됐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:710-712`
  - 상세: `const patch = { ...defined, config: mergedConfig };` 로 한 번만 구성한 뒤
    `m.save(Trigger, { id: target.id, ...patch })`와 `Object.assign(target, patch)` 양쪽이 같은
    객체를 재사용한다. 이전엔 `save` 호출과 응답 조립에 리터럴이 두 번 따로 있어 필드 추가 시
    "DB에 쓴 값"과 "응답에 얹은 값"이 조용히 갈릴 위험이 있었는데, 이번 반영으로 그 위험이 코드
    구조적으로 제거됐다.

- **[정보]** 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)의 커넥션 관리·SQL 파라미터화는
  적절하다
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:74-105`(`beforeAll`/`afterAll`),
    `:118`·`:124-126`·`:161-164`·`:167-175`·`:193-196`·`:202-208`·`:229-236` 등 raw 쿼리
  - 상세: 별도 `pg.Client`와 `DataSource`를 각각 열고, `afterAll`에서 `ds.destroy().catch(() =>
    undefined)` → `db.end().catch(() => undefined)` 순으로 둘 다 정리해 커넥션 누수가 없다
    (`jest.config.ts:50-53`에 이 예외가 문서화됨 — 1라운드 INFO#4 반영). 모든 raw 쿼리가 `$1`/`$2`
    바인딩을 쓰고, 쿼리 문자열에 섞인 리터럴(`'v2-from-B'` 등)은 테스트 고정 상수일 뿐 외부 입력이
    아니라 인젝션 표면이 아니다.
  - 제안: 조치 불요.

- **[정보]** 부분 객체 `save`의 새 단위 테스트가 정확히 회귀 지점(키 집합)을 조인다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3876-3884`
    (`expect(Object.keys(savedEntity).sort()).toEqual(['config', 'id', 'name'])`)
  - 상세: 값이 아니라 "무엇을 저장 대상에 실었는가"를 단언해, 통째 엔티티로 되돌리는 뮤턴트를
    직접 잡는다. plan 체크리스트의 뮤턴트 표(M1 1건 RED)와 일치한다.

- **[정보, 기존 갭 재확인 — 이번 diff의 신규 결함 아님]** `written.updatedAt` truthy 가드의 falsy
  분기는 여전히 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:713-716`
  - 상세: 1라운드 다수 reviewer INFO#1에 대해 이번 라운드는 **근거 주석**(단위 대역이 넘긴 객체를
    그대로 돌려줄 때 재읽은 값을 `undefined`로 지우지 않으려는 것)을 추가했지만, 이 분기가 falsy가
    되는 입력에 대한 테스트는 추가되지 않았다. `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`
    ②c는 실제 Postgres 경로에서 `written.updatedAt`이 항상 채워짐을 확인했으므로 운영 경로 위험은
    낮다. 차단 사유 아님 — 1라운드가 이미 "코멘트 or 테스트 둘 중 하나"로 제안했고 코멘트로 처리된
    것으로 판단한다.

- **[정보, 기존 갭 재확인]** 재읽기 뒤 `workflow` CASCADE 삭제 경합은 여전히 도메인 에러로 매핑되지
  않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:719`
    (`.catch((err: unknown) => this.rethrowEndpointPathConflict(err))`)
  - 상세: 이번 수정으로 이 경합은 "조용한 lost update"에서 "시끄러운 롤백"(통째 23503 / 부분 객체
    23502, `trigger-update-save-window.e2e-spec.ts` ①/①b)으로 바뀌었지만, `rethrowEndpointPathConflict`
    는 `endpointPath` unique violation이 아니면 원본 `QueryFailedError`를 그대로 재던지므로 클라이언트는
    일반 500으로만 본다. 이 PR이 만든 회귀가 아니고, plan(`plan/in-progress/trigger-save-partial-patch.md`
    "이 PR이 안 하는 것")과 consistency 산출물에 이미 planner 후속(`spec/5-system/15-chat-channel.md
    §5.4` 404 행 갱신)으로 등재돼 있다.
  - 제안: 조치 불요(이미 트래킹됨).

- **인덱스 / N+1 / 마이그레이션 / 스키마 설계 / 대량 데이터**: 이번 diff는 단건 트리거 행에 대한
  UPDATE payload 범위 조정과 그 검증 테스트일 뿐, 새 쿼리 패턴(반복문 내 개별 쿼리)·스키마 변경·
  마이그레이션·페이지네이션 대상 쿼리를 포함하지 않는다. 해당 관점에서는 특이사항 없음.

## 요약

이번 라운드 diff의 실질 DB 로직은 1라운드에서 이미 LOW 위험으로 평가된 부분 객체 `save` 수정 그
자체이며, 이번에 새로 반영된 것은 1라운드 리뷰 처분(payload 조립 단일화·JSDoc 정정·뮤턴트 재측정)과
그 리뷰 산출물 커밋으로, 새로운 DB 동작이나 새 결함을 추가하지 않는다. 1라운드 WARNING#5(저장
payload 이중 작성)는 `const patch` 단일화로 실제로 해소됐고, 신규 e2e의 커넥션 정리·파라미터화된
SQL도 그대로 적절하다. 남은 항목은 전부 이미 트래킹된 비차단 INFO(락 밖 CASCADE 경합의 500 마스킹,
`written.updatedAt` 방어 분기의 미검증 falsy 경로)뿐이며, 이번 diff 범위에서 새로 발견된 CRITICAL/
WARNING 급 DB 결함은 없다.

## 위험도
LOW
