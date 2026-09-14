# 성능(Performance) 리뷰 — trigger-config-lost-update (2026-09-14 19:07 라운드)

## 검토 범위

lost-update 방지(advisory lock + 락 안 재읽기)를 `trigger.config` 쓰기 네 자리에 적용한
변경. 이전 라운드(`review/code/2026/09/14/18_17_44/performance.md`)는 세 자리
(`chat-channel-binder.service.ts` 성공/실패 경로, `rotateBotToken`)만 스코프였고, 이번
커밋(`12ed21ff1`)이 `triggers.service.ts#update()`(창 1, 인라인 트랜잭션)를 네 번째 자리로
추가했다. 그 확장이 이번 라운드에서 새로 봐야 할 유일한 실질 변화라, 아래는 그 확장이
바꾸는 성능 그림에 집중한다.

## 발견사항

- **[WARNING]** 창 1 추가로 `PATCH /api/triggers/:id` **전체**가 advisory lock + 재읽기 비용을 지게 됐다 — 이전 라운드는 이 엔드포인트를 "영향 없음"으로 평가했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:549-576`(창 1 인라인 트랜잭션), 호출부는 `update()` 전체
  - 상세: 이전 라운드 INFO#1은 지연 증가 대상을 "`setupChatChannel` 성공/실패, `rotateBotToken`" 세 자리로 한정하고 "hot path(웹훅 실제 인입 처리 경로)에는 영향이 없다"고 판단했다. 이번 커밋이 추가한 창 1은 `chatChannel`/`config`를 **전혀 싣지 않은 PATCH**(이름 변경, `isActive` 토글 등)도 예외 없이 통과하는 지점이다 — `schedule` 타입 트리거가 아니라면(§update 상단의 `disallowed` 체크는 `type==='schedule'`에만 걸림) 모든 trigger PATCH가 `BEGIN → pg_advisory_xact_lock → SELECT(findOne) → save → COMMIT` 5단계를 거친다. 종전에는 `save(trigger)` 단독 왕복이었다. 즉 이번 변경으로 지연 증가의 **적용 범위가 "chatChannel/bot-token 관련 요청"에서 "트리거 PATCH 전체"로 넓어졌다** — 이전 라운드의 "영향 없음" 결론이 이 새 지점에는 그대로 적용되지 않는다.
  - 제안: 새 결함은 아니고 lost-update 수정을 위한 의도된 트레이드오프이지만, `PATCH /api/triggers/:id`의 호출 빈도가 이 저장소에서 실제로 낮은지(관리자 조작성 vs 자동화 스크립트의 잦은 폴링/재시도) 확인이 필요하다. 옵저버빌리티에 이 엔드포인트의 P95/P99를 추가해 두면 향후 회귀를 조기에 잡을 수 있다.

- **[INFO]** `chatChannel`을 포함한 PATCH 하나가 **서로 다른 advisory-lock 임계구간을 순차로 두 번** 통과한다
  - 위치: 창 1 `codebase/backend/src/modules/triggers/triggers.service.ts:549-576` → 이후 `chatChannelBinder.setupChatChannel` 호출(`triggers.service.ts:606-611`) → 그 안의 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266-280`(성공) 또는 `:303-317`(실패) → 마지막으로 응답 갱신용 재조회(`triggers.service.ts:614-617`)
  - 상세: `chatChannel`이 실린 PATCH는 (1) 창 1의 lock+select+save, (2) `adapter.setupChannel` 외부 HTTP 호출, (3) binder의 두 번째 lock+select+update, (4) 응답용 `relations: ['workflow']` 재조회까지 — 서로 다른 세 개의 트랜잭션(창 1, binder 트랜잭션)과 최소 두 번의 advisory lock 획득/해제를 순차로 거친다. 각 창이 서로 다른 목적(엔티티 컬럼 저장 vs `chatChannel` 필드 저장)을 가져 하나로 합치기는 설계상 어렵고, 외부 HTTP 호출을 락 밖에 두는 제약(문서화된 설계 근거)과도 상충하지 않는다 — 다만 "chatChannel 있는 PATCH"의 순수 DB 왕복 수가 이번 변경 전 대비 유의미하게 늘었다는 점은 기록해 둔다(대략 2~3왕복 → 7왕복 안팎).
  - 제안: 조치 불필요. 다만 이 조합 경로(PATCH+chatChannel)가 성능 회귀 테스트/모니터링 대상에 포함돼 있는지 확인 권장.

- **[INFO]** 창 1의 재읽기도 필요한 열(`config`) 하나가 아니라 엔티티 전체를 조회한다 — 이전 라운드 INFO#2와 같은 패턴이 새 호출부에도 반복
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:556-558`(`m.findOne(Trigger, { where: { id: trigger.id, workspaceId } })`), 헬퍼 쪽은 `codebase/backend/src/modules/triggers/trigger-config-lock.ts:91`
  - 상세: 이전 라운드가 `trigger-config-lock.ts:91`에 대해 지적한 "select 제한 없는 전체 컬럼 조회"가, 이번 커밋에서 새로 추가된 창 1의 인라인 `findOne`에도 그대로 반복된다(이쪽은 `rewriteTriggerConfigLocked`를 안 쓰고 직접 구현이라 별도 인스턴스). `config` JSONB 자체가 워크플로 참조 등으로 커질 수 있는 트리거라면, 두 자리 모두에서 불필요한 바이트가 왕복한다.
  - 제안: 여전히 선택 사항 — 지금 규모에서 필수는 아니다. 다만 두 자리가 같은 패턴을 반복하므로, 나중에 최적화하려면 `select`를 두 곳 모두 함께 좁혀야 drift가 없다.

- **[INFO]** advisory lock 대기 상한 없음(`lock_timeout` 미설정)이 이번엔 트리거 PATCH 자체의 처리량에도 영향
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:53-63`(JSDoc, 기존 문서화) / `triggers.service.ts:551-554`(창 1의 잠금 획득)
  - 상세: 기존 문서와 concurrency 리뷰가 이미 짚은 사항이지만, 창 1 추가로 이 무제한 대기가 "chatChannel setup" 같은 저빈도 이벤트뿐 아니라 **모든 PATCH 요청**에 적용된다는 점이 성능 관점에서 새로 드러난다. 같은 트리거에 대한 동시 PATCH가 몰리면(예: 재시도 폭주) 대기 중인 요청들이 커넥션 풀에서 커넥션을 쥔 채 블로킹되어, 극단적으로는 그 워크스페이스의 다른 요청까지 커넥션 부족으로 지연될 수 있다. 임계구간이 짧다는 전제(외부 호출 없음)로 감당 가능하다고 설계 문서가 이미 인정하고 있어 신규 이슈로 등재하지는 않는다.
  - 제안: 기존 추적(설계 JSDoc의 "임계 구간에 외부 호출/긴 계산이 들어가면 `lock_timeout` 필요")으로 충분 — 중복 등재 불필요.

## 그 외 관점 (변경 없음 확인)

- **N+1**: `rewriteTriggerConfigLocked` 호출부 3곳(`chat-channel-binder.service.ts` 2곳, `triggers.service.ts#rotateBotToken` 1곳) + 창 1 인라인 1곳, 총 네 자리 모두 단건 트리거에 대해 단발 호출이다. 반복문 안에서 호출되는 자리는 없다(`grep`으로 전수 확인).
- **캐싱**: `mergeExternalConfig`/`stripInlineAuthKeys`는 요청마다 다른 입력을 순수 변환하는 함수라 캐싱 대상이 아니다.
- **문자열 연산**: 대상 diff 안에 O(n²) 문자열 누적 패턴 없음.
- **정적 분석 가드(`endpoint-path-conflict-wrap-guard.ts`)**: 빌드/테스트 타임에만 도는 AST 워크로, 런타임 요청 경로와 무관 — 순회 깊이도 파일당 AST 크기에 선형 비례해 문제 없음.
- **테스트 파일(`trigger-config-lock.spec.ts`, `triggers.service.spec.ts`, `triggers.web-chat.spec.ts`, e2e spec)**: 프로덕션 성능과 무관. e2e의 폴링(`waitForWindowOneCommit` 계열, 최대 수십 초 대기 여지)은 CI 실행 시간에만 영향.

## 참고 (절차 투명성 — 이슈로 집계하지 않음)

리뷰 중 `chat-channel-binder.service.ts`를 첫 `Read`로 열었을 때 `rewriteTriggerConfigLocked`
import·`survivesWithFresh`·`buildChannel` 이 전혀 없는 **패치 이전 버전**이 관측됐다
(`this.triggerRepository.update(...)` 로 직접 쓰는 구버전 형태). 병렬 fan-out 리뷰 규약이
경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황과 정확히 일치한다. 재확인
결과 — `git status --short`(해당 파일 미표시), `git diff HEAD -- <file>`(빈 diff),
`md5(workdir 파일) == md5(git show HEAD:<file>)` — 파일은 현재 커밋 `12ed21ff1`(HEAD)과
정확히 일치하는 정상 상태다. 이 보고서의 모든 줄 번호 인용은 이 재확인 이후 시점의 상태
기준이다. 저장소에 잔여 이상 상태는 없다 — 다음 라운드 리뷰어를 위해 기록만 남긴다
(이전 라운드 `api_contract.md`가 같은 파일에서 같은 현상을 이미 한 차례 보고한 바 있다).

## 요약

이번 라운드에서 성능 그림을 실질적으로 바꾸는 변경은 창 1(`triggers.service.ts#update()`의
인라인 advisory-lock 트랜잭션) 하나다. 이전 라운드가 "영향 없는 hot path"로 평가했던 결론의
전제(지연 증가가 chatChannel/bot-token 관련 세 자리에 한정된다)가 이제 깨졌다 — 트리거 PATCH
전체가 단일 `UPDATE` 왕복 대신 `BEGIN+lock+SELECT+save+COMMIT` 5단계를 거친다. 이는 lost-update
수정을 위한 의도된 트레이드오프이고 알고리즘적 결함이나 N+1, 캐싱 누락, 메모리 누수 같은
구조적 문제는 없지만, 영향 범위가 "저빈도 경로"에서 "가장 흔한 PATCH 경로"로 넓어졌다는 점은
이전 라운드의 평가를 갱신할 만큼 실질적이라 WARNING으로 올린다. `chatChannel`이 함께 실린
PATCH는 여기에 더해 별도의 두 번째 lock 임계구간까지 순차로 통과해 왕복 수가 한층 더 늘어난다.
새 공유 블로킹 자원(advisory lock, 대기 상한 없음)이라는 근본 트레이드오프 자체는 이미
concurrency 리뷰와 설계 문서가 인지하고 감당 가능하다고 판단한 사안이라 이번 리뷰에서
별도 조치를 강제하지는 않는다.

## 위험도

LOW
