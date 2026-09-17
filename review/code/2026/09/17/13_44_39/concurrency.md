# 동시성(Concurrency) 리뷰 — `trigger-save-partial-patch`

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts` 의
`TriggersService.update()` — advisory lock(`acquireTriggerConfigLock`) 안에서 재읽은
`Trigger` 엔티티를 **통째로** `m.save(Trigger, target)` 하던 것을, **이 요청이 바꾸는 필드 +
`config` 만 담은 부분 객체**로 좁혔다 (`m.save(Trigger, { id: target.id, ...defined, config:
mergedConfig })`). 나머지 파일(`triggers.service.spec.ts`·`trigger-transaction-mock.ts`·신규
e2e `trigger-update-save-window.e2e-spec.ts`·plan·CHANGELOG)은 이 수정을 검증/문서화하는
테스트·기록물이다.

## 검증한 것

- `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `update()` 전체(551~766행)를
  직접 읽고, 락 획득(634행) → 재읽기(641행) → 병합(652행) → 부분 객체 `save`(707행) → 응답
  조립(712~714행) 흐름을 대조했다.
- 같은 파일에서 `acquireTriggerConfigLock` 을 호출하는 다른 자리(`remove()` 1072행)를 grep 으로
  확인 — `update()` 와 `remove()` 가 **같은 락 키**(trigger id)를 공유해, "삭제된 행을 `save` 가
  되살린다" 는 별개 경로는 `assertTriggerFound`(357행, fresh 가 null 이면 즉시 throw)로 이미
  차단돼 있음을 확인했다. 이번 diff 가 그 보호를 깨지 않는다.
- TOCTOU 재현 로직(`trigger-update-save-window.e2e-spec.ts` ①·②)의 시나리오 설계 — 트랜잭션 A
  재읽기 → 커밋되지 않은 상태에서 연결 B 가 커밋 → A 저장 — 가 Postgres read-committed 격리
  수준에서 실제로 그 창을 여는지 논리적으로 대조했고, 결함(②, 통째 저장 시 락 밖 컬럼이
  `null` 로 되돌아감)과 수정(②b, 부분 객체는 보존)이 서로 대칭임을 확인했다.

## 발견사항

### INFO — 응답의 `updatedAt` 폴백이 무신호로 스테일해질 수 있는 경로
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `written.updatedAt` 을
  조건부로 취하는 자리 (`const written = await m.save(...)` 다음 `if (written.updatedAt)
  target.updatedAt = written.updatedAt;`, 함수 `TriggersService.update()`)
- 상세: `written.updatedAt` 이 falsy 인 경우(드라이버가 `RETURNING` 값을 못 채우는 등 예상 밖
  동작) 응답은 재읽기(`fresh`) 시점의 `updatedAt` 을 그대로 반환한다 — 조용히 스테일한 값을
  내보내는 유일한 폴백이고, 이 경로가 실제로 타는지는 어떤 테스트도 단언하지 않는다(항상
  `updatedAt` 이 채워진다는 전제 하에 `written.updatedAt` truthy 케이스만 실측·검증됨). 데이터
  손상은 아니지만, pg 드라이버 버전이 바뀌는 시점(최근 커밋 이력에 `pg`/`@types/pg` bump 존재)에
  이 분기가 처음 관측 없이 조용히 활성화될 수 있다.
- 제안: `written.updatedAt` 이 없는 경우를 로그 한 줄로 남기거나, 최소한 "이 분기가 살아있는지"
  를 확인하는 회귀(예: mock 이 `updatedAt` 없는 `written` 을 돌려줬을 때의 응답을 단언)를 추가.
  차단 사유는 아님.

### INFO — FK CASCADE 창은 이번 수정 범위 밖으로 명시적으로 남아 있음(회귀 아님, 확인용 기록)
- 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `describe('① 재읽기 뒤
  workflow 삭제 …')`
- 상세: `acquireTriggerConfigLock` 은 trigger id 로 잠그고 workflow 삭제(CASCADE 트리거)는 이
  락으로 직렬화되지 않는다. e2e ①/①b 는 이 창이 "시끄러운 실패 + 롤백"(23503/23502)으로
  끝나고 부활이 없음을 실측으로 고정했다 — 즉 데이터 손상 없이 실패하는 것으로 설계상
  수용됐다. 이번 diff 가 introduce 한 새 갭이 아니라 기존에 알려진 gap 의 재확인이므로 위험도는
  없지만, 리뷰 기록으로 남긴다 — 이 창이 "조용한 lost update" 로 바뀌는 방향의 변경이 향후
  들어오면 (예: `save` 실패를 삼키는 캐치가 추가되는 경우) 즉시 재검토가 필요하다.
- 제안: 조치 불요. plan 자체가 이미 이 경계를 명시(`## 이 PR 이 안 하는 것` 참조)했고 e2e 로
  캐너리화됐다.

## 검증하지 않은 것

- `mergeExternalConfig`/`stripInlineAuthKeys`/`mergeIntoFreshSubKey` 의 순수성(입력 객체 mutation
  여부)은 이번 diff 의 변경 대상이 아니라 상세 대조하지 않았다 — 부분 객체로 좁힌 이번 수정의
  정합성과 직접 관련이 없다고 판단했다(락 안에서 재읽은 `fresh.config` 기준으로 병합되고,
  병합 결과가 같은 트랜잭션·같은 락 안에서 저장되므로 이번 변경이 다루는 "락 밖 컬럼 보존"
  문제와는 다른 축).
- e2e 헬퍼(`createDbClient`·`registerAndLogin`·`createTeamWorkspace`)의 기존 구현은 diff 밖이라
  열어보지 않았다.
- 저장소를 뮤테이션하는 검증(뮤턴트 적용 등)은 수행하지 않았다 — 코드 대조와 논리적 재구성만으로
  충분히 판단 가능했고, 프롬프트에 첨부된 plan 이 이미 e2e 재현·뮤턴트 표(M1~M3 RED)로 동일
  가설을 실측했다. 저장소 상태 변경 없음(`git status --short` 확인 불요 — 아무 파일도 건드리지
  않았다).

## 요약

이번 변경은 `#1334` 가 "이론적 TOCTOU" 로 유예했던 자리를 실제 Postgres+TypeORM 조합으로
재현해 확정한 **진짜 lost-update 결함**을 고친다 — `save()` 가 재읽은 엔티티와 DB 값을 통째로
비교해 다시 쓰는 특성 때문에, advisory lock 재읽기 **이후** 락 밖에서 커밋된 컬럼
(`notification_secret_v2`·`last_triggered_at`·`chat_channel_token_v2`·schedule 동기화
`name`/`is_active`)이 옛 값으로 되써지던 것을, 저장 대상을 "이 요청이 바꾸는 필드 + config" 로
좁혀 근본적으로 차단했다. 같은 락을 공유하는 형제 창(`remove()`)과의 직렬화는 그대로 유지되고,
FK CASCADE 창(락으로 못 막는 별개 경로)은 손상 없는 loud failure 로 남아 있음을 e2e 로 확인했다.
회귀 자체(응답 반환값의 `null` 채움을 통째로 덮어 `endpointPath` 를 지운 것)도 PR 내에서 e2e 가
잡아 고쳤고, 그 교훈이 단위 테스트에 반영돼 있다. 이번 diff 에서 새로 발견된 차단급 동시성
결함은 없으며, 위 INFO 두 건은 기록 목적의 관찰이다.

## 위험도
LOW — 검토 대상 자체가 이미 실측·테스트로 두텁게 검증된 동시성 수정이며, 이 리뷰에서 새로
발견한 결함은 없다(INFO 2건은 비차단).
