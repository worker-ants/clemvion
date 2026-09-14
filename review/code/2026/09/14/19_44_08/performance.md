# 성능(Performance) 리뷰 — trigger-config-lost-update (2026-09-14 19:44 최종 라운드)

## 검토 범위

이번은 세 번째(최종) 라운드다. 이전 두 라운드(`review/code/2026/09/14/18_17_44/performance.md`,
`review/code/2026/09/14/19_07_43/performance.md`)가 이미 이 PR 의 핵심 성능 트레이드오프
(advisory lock + 락 안 재읽기로 인한 DB 왕복 증가, 전체 컬럼 조회, lock timeout 부재)를
상세히 다뤘다. 이번 라운드가 반영하는 새 커밋(`c7a9c107e`)의 실질 변경은 두 갈래다:

1. `hooks.service.ts` — 웹훅 인입 hot path 두 자리의 `trigger.lastTriggeredAt = …; save(trigger)`
   를 `triggerRepository.update({id}, {lastTriggeredAt})` 로 교체.
2. `triggers.service.ts` — 창 1(`update()`)의 저장 대상을 `trigger`(pre-lock 스냅샷)에서
   `fresh ?? trigger`(락 안 재읽은 행)로 교정. 그리고 `acquireTriggerConfigLock` /
   `extractInboundSigningRef` 두 헬퍼로의 추출.

아래는 이 변경이 성능 그림에 미치는 영향에 집중하고, 이전 라운드가 이미 다룬 항목은
"영향 없음/변경 없음"으로만 재확인한다.

## 발견사항

- **[INFO]** (개선) 웹훅 hot path 의 쓰기가 전체 엔티티 `save()` 에서 컬럼 한정 `update()` 로 좁혀졌다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236`(`handleWebhook`),
    `codebase/backend/src/modules/hooks/hooks.service.ts:700-704`(chat-channel inbound 경로)
  - 상세: 두 자리 모두 종전엔 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger)` 였다. `save()`는 TypeORM 이 엔티티 전체(모든 컬럼 + `config` JSONB blob)를 매 웹훅 인입마다 다시 직렬화·전송했고, 이는 lost-update 수정과 무관하게도 **인입 요청마다 도는 hot path**라 PATCH 계열보다 호출 빈도가 훨씬 높다. 이제 `update({id}, {lastTriggeredAt})`는 단일 컬럼만 실어 왕복 바이트 수를 줄이고, `save()`가 유발하는 서브스크라이버/리스너 훅 실행 오버헤드도 없앤다. 순수 성능 관점에서 이 변경은 **개선**이며(부작용인 lost-update 방지는 보안/정합성 관점 — 다른 리뷰어가 다룸), 새로운 DB 왕복을 추가하지 않는다(여전히 1왕복).
  - 제안: 없음(긍정 확인).

- **[INFO]** 창 1(`update()`)의 저장 대상 교정은 DB 왕복 수를 바꾸지 않는다 — 이전 라운드가 지적한 왕복 수 증가는 그대로 유효
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:548-586`(`transaction` 콜백, `m.save(Trigger, target)`)
  - 상세: `c7a9c107e`는 `Object.assign(trigger, …)` → `m.save(Trigger, trigger)` 를 `Object.assign(target, …)` → `m.save(Trigger, target)`(`target = fresh ?? trigger`)로 바꿨을 뿐, 트랜잭션 안의 쿼리 개수(`BEGIN → advisory lock → findOne(relations:['workflow']) → save → COMMIT`)는 그대로다. 즉 이 교정은 **정합성 버그를 고쳤을 뿐 성능 프로파일을 바꾸지 않는다** — 이전 라운드(19_07_43) WARNING("PATCH 전체가 lock+재읽기 비용을 진다")·INFO("전체 컬럼 조회")는 이번 라운드에도 그대로 적용된다. 새 성능 회귀나 개선은 없다.
  - 제안: 조치 불요 — 중복 등재하지 않음(이미 이전 라운드에서 다뤄짐).

- **[INFO]** `update()` 요청 하나가 같은 트리거 행(+ `workflow` 관계)을 두 번 SELECT 한다 — lock+reread 설계의 구조적 귀결
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:473`(`this.findById(id, workspaceId)`, `relations: ['workflow']` 포함), `:557-560`(락 안 `m.findOne(Trigger, { where: { id: trigger.id, workspaceId }, relations: ['workflow'] })`)
  - 상세: `findById()`가 이미 `id`+`workspaceId`+`workflow` 관계로 트리거를 1회 조회하는데, 그 사이 스케줄/authConfig 검증을 거친 뒤 advisory lock 안에서 **같은 조건 + 같은 관계**로 다시 조회한다. 두 조회는 목적이 다르다 — 앞은 "요청 검증/존재 확인", 뒤는 "락 이후 최신 상태 확보"라 이 lock-then-reread 패턴 자체에서 최소 1회의 재조회는 정합성상 불가피하다(락 밖에서 읽은 값은 stale 일 수 있으므로). 다만 두 조회가 완전히 동일한 `relations: ['workflow']` JOIN을 반복한다는 점은, 검증 단계에서 `workflow` 관계가 실제로 필요한지(주로 `type==='schedule'` 분기 정도로 보임) 재확인하면 첫 조회를 더 가볍게(관계 없이) 만들 여지가 있다 — 다만 이는 이전 라운드가 이미 인지하고 "지금 규모에서 필수는 아님"으로 판단한 것과 같은 클래스라 새 등급을 매기지 않는다.
  - 제안: 조치 불요(이미 트래킹). 여유가 있으면 `findById` 호출부 중 `workflow` 관계가 불필요한 경로(예: `update()` 진입부 검증용)에 한해 relation 없는 경량 조회를 별도로 두는 것을 후속 검토.

- **[INFO]** 헬퍼 추출(`acquireTriggerConfigLock`, `extractInboundSigningRef`)은 순수 리팩터 — 실행 경로·쿼리 수 불변
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock`), `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:247-250`(`extractInboundSigningRef`)
  - 상세: 두 헬퍼 모두 기존에 인라인으로 중복 작성돼 있던 코드를 이름 있는 함수로 옮긴 것뿐이다. `acquireTriggerConfigLock`은 여전히 `SELECT pg_advisory_xact_lock(hashtext($1))` 한 번, `extractInboundSigningRef`는 옵셔널 체이닝 한 줄이라 함수 호출 오버헤드는 무시할 수준이다. 새 쿼리·새 순회·새 알고리즘 복잡도 없음.
  - 제안: 없음.

## 그 외 관점 (이전 라운드 대비 변경 없음 — 재확인만)

- **N+1**: 반복문 안에서 DB/외부 호출을 부르는 자리 없음(전수 `grep` 재확인). `rewriteTriggerConfigLocked` 호출부 3곳 + 창 1 인라인 1곳 모두 단건 트리거에 대한 단발 호출이다.
- **advisory lock 대기 상한 없음**: `trigger-config-lock.ts`의 JSDoc·설계가 이미 인지하고 있고(72-82행), 이전 두 라운드(concurrency/side_effect WARNING)가 이미 다뤘다. 이번 커밋은 이 구조를 바꾸지 않았다 — 중복 등재하지 않음.
- **`chatChannel`을 포함한 PATCH의 왕복 수 증가(창1 + binder 트랜잭션 순차 통과)**: 19_07_43 라운드 INFO가 이미 정량화(약 2~3왕복 → 7왕복 안팎)했고, 이번 커밋은 이 경로의 쿼리 개수를 바꾸지 않았다.
- **캐싱**: `mergeExternalConfig`/`stripInlineAuthKeys`/`extractInboundSigningRef`는 요청마다 다른 입력의 순수 변환이라 캐싱 대상이 아니다.
- **문자열 연산/자료구조**: 이번 diff에 O(n²) 문자열 누적이나 부적절한 자료구조 사용 없음.
- **정적 가드(`endpoint-path-conflict-wrap-guard.ts`)**: 빌드/테스트 타임 AST 워크로 런타임과 무관, 파일당 선형 스캔이라 문제 없음.
- **테스트·e2e 파일**(`hooks.service.spec.ts`, `trigger-config-lock.spec.ts`, `triggers.service.spec.ts`, `trigger-transaction-mock.ts`, e2e spec): 프로덕션 성능과 무관. e2e의 폴링(최대 20초 대기 여지)은 CI 시간에만 영향 — 이전 라운드에서 이미 확인됨.

## 요약

이번 최종 라운드가 반영하는 실질 변경 중 성능에 영향을 주는 것은 웹훅 hot path 두 자리의
`save()` → 컬럼 한정 `update()` 전환 하나이며, 이는 **개선**이다(왕복 수는 그대로 1회이나
페이로드·서브스크라이버 오버헤드가 줄었다). 창 1의 저장 대상 교정(`fresh ?? trigger`)은
정합성 버그를 고친 것으로 DB 왕복 수·알고리즘 복잡도를 바꾸지 않았고, 두 헬퍼 추출은 순수
리팩터라 실행 경로에 영향이 없다. 이전 두 라운드가 이미 지적하고 추적 중인 트레이드오프
(PATCH 전체가 advisory lock+재읽기 비용을 지게 된 것, 재읽기가 select 제한 없이 전체 컬럼을
가져오는 것, `chatChannel` 포함 PATCH의 왕복 수 증가, lock timeout 부재)는 이번 커밋으로
해소되지도 악화되지도 않았으므로 재등재하지 않는다. N+1, 캐싱 누락, O(n²) 연산, 메모리 누수
등 구조적 성능 결함은 발견되지 않았다. 이번 라운드에서 새로 차단할 성능 사유는 없다.

## 위험도

LOW
