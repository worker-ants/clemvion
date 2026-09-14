# 정식 규약 준수 검토 — trigger-config-lost-update

## 검토 범위에 대한 전제

`spec/5-system/` 델타는 0개 파일이다(코드 전용 PR). 따라서 이 검토는 문서 구조 규약(Overview/본문/Rationale, `0-` prefix 등)을 적용할 신규·변경 spec 문서가 없다 — 그 축은 위반 후보가 원천적으로 존재하지 않는다. 실질 검토 대상은 `spec/conventions/**` 가 규율하는 **코드 쪽 표면**과 diff(`codebase/backend/src/modules/{triggers,schedules,hooks}/**`, 17개 파일 / 2287줄, `origin/main...HEAD` 실측)의 정합이다. API 엔드포인트·DTO·컨트롤러·에러 코드 신설이 없어(`swagger.md`, `error-codes.md §1~4` 대상 표면 미접촉) 명명·출력 포맷·API 문서 규약 축도 새 위반 후보가 거의 없다. 아래는 실제로 접촉이 있었던 두 규약(`redis-keys.md`, `review-citations.md`)에 대한 실측 결과다.

## 발견사항

- **[WARNING]** 신규 advisory-lock key 계열이 `redis-keys.md §4`(인접 네임스페이스)에 아직 미등재 — 단, 발견 자체는 새롭지 않고 이미 추적 중
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:6-18` (`TRIGGER_CONFIG_LOCK_PREFIX = 'trigger-config'`, `triggerConfigLockKey()`), `codebase/backend/src/modules/schedules/schedules.service.ts`(`acquireTriggerConfigLock` 재사용), `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 위반 규약: [`spec/conventions/redis-keys.md` §4](../../../../spec/conventions/redis-keys.md#4-인접-네임스페이스--redis-키가-아닌데-형태가-비슷한-것) — "`{도메인}:{용도}:{id}` 꼴이지만 Redis 를 경유하지 않는" 키를 예방적으로 등재하는 절
  - 상세: `trigger-config:<triggerId>` 는 `redis-keys.md §1`이 규정한 Redis 키 형태(`{도메인}:{식별자}`)와 겉모양이 같지만 실체는 `pg_advisory_xact_lock(hashtext(...))` 의 입력 문자열이라 Redis 를 전혀 경유하지 않는다. §4 가 바로 이런 혼동(예: `background:run:<id>` 를 Redis 키로 오인했던 문서 자체의 과거 실수, 같은 문서 Rationale 참조)을 막기 위한 절인데, 자매 사례 `exec-cap:<workspaceId>`(`execution-engine.service.ts`)조차 아직 §4에 없고 이번 PR이 같은 계열을 하나 더 늘렸다. 코드 자체가 이 사실을 `trigger-config-lock.ts:9-17` 주석에 명시하고 있고, 동일 지적은 이번 브랜치의 이전 라운드 검토(`review/consistency/2026/09/14/17_10_16/naming_collision.md` WARNING#2, 위험도 LOW)에서 이미 나왔다.
  - 제안: `developer` 는 `spec/**` 쓰기 권한이 없어(스킬 경계, CLAUDE.md) 이 등재를 직접 할 수 없고, 코드·plan(`plan/in-progress/trigger-config-lost-update.md:131-136,305-306,673`) 양쪽에 "planner 항목으로 올린다"고 명시적으로 위임한 것은 절차상 올바르다. 다만 이 문서(`redis-keys.md`)가 실제로 갱신되기 전까지는 규약이 구현보다 뒤처진 상태이므로, 다음 `project-planner` 턴에서 `exec-cap:<workspaceId>` · `trigger-config:<triggerId>` 두 계열을 §4 표에 한 줄씩(포인터만) 추가할 것을 재확인 요청한다. 새로 발견된 위반이 아니라 **기추적 항목의 존속 확인**으로 처리해도 무방하다.

- **[INFO]** 위 lock key 는 `pg_advisory_xact_lock` 32비트 해시 공간을 `exec-cap:*` 계열과 접두어만 다르게 공유
  - target 위치: `trigger-config-lock.ts:39-63` (`acquireTriggerConfigLock`)
  - 위반 규약: 명시적 금지 규약 없음 — `redis-keys.md`는 이 축(advisory lock 해시 충돌)을 다루지 않는다. 규약 위반이 아니라 별도 리스크 메모.
  - 상세: 두 계열(`trigger-config:*`, `exec-cap:*`) 모두 문자열을 `hashtext()`로 32비트화해 같은 `pg_advisory_xact_lock(bigint)` 키 공간을 쓴다. 계열이 늘면 우연한 해시 충돌로 무관한 자원끼리 직렬화될 확률이 오른다. 이미 `review/consistency/2026/09/14/17_10_16/naming_collision.md` INFO 로 등재돼 급하지 않음으로 처리된 사안이라 재차 급박도를 올릴 근거는 없다.
  - 제안: 조치 불요(선행 검토와 동일 결론). 계열이 셋 이상으로 늘어나는 시점에 재검토.

## 준수 확인 (위반 아님 — 근거 남김)

- **`review-citations.md` §2 (bare `hh_mm_ss` 금지)**: diff에 등장하는 리뷰 인용 14개 세션 타임스탬프(`18_17_44`~`23_38_09`, `00_07_52`~`01_09_53`, `17_10_16`)를 전수 grep 한 결과, **모두** `review/(code|consistency)/2026/09/{14,15}/<hh_mm_ss>` 전체 경로 형태로만 등장했다(§2 "권장" 형태) — bare 시각 단독 인용은 0건. `codebase/**` 코드 주석 축(§3 대상)에 정확히 부합한다.
  - `TRIGGER_ENTITY` 관련 정적 가드 인용(`review/code/2026/09/08/13_34_28`)도 동일 형태.
- **`error-codes.md`**: 이 diff가 발행하는 코드는 기존 `RESOURCE_NOT_FOUND`(UPPER_SNAKE_CASE, 공용 코드) 재사용뿐이고 신규 코드 신설이 없다 — §1(의미 기반 명명)·§2(rename 안정성) 저촉 없음. `assertTriggerFound`/`throwTriggerNotFound` 로 중복 리터럴을 단일화한 것은 오히려 §2가 우려하는 drift를 줄이는 방향.
- **`migrations.md` / `swagger.md`**: 대상 표면(신규 마이그레이션, DTO/컨트롤러 데코레이터) 접촉 없음 — 검토 대상 아님.
- **`execution-context.md` / `node-cancellation.md` / `chat-channel-adapter.md`**: 이 diff가 건드리는 자리(`chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`)는 이미 존재하는 식별자(`inboundSigningRef`, `chatChannelHealth` 등)를 그대로 재사용하며 새 의미 부여가 없다 — 명명 재검토 불필요(선행 검토 `naming_collision.md`가 이미 확인).

## 요약

이번 PR은 API 표면(엔드포인트·DTO·에러 코드)을 새로 만들지 않는 순수 동시성 버그 수정이라 명명·출력 포맷·API 문서·문서 구조 규약 축에서는 위반 후보가 거의 없었고, 코드 주석의 리뷰 인용 형식(`review-citations.md §2`)은 14개 세션 전수가 규약을 준수했다. 유일한 실질 항목은 신규 advisory-lock key(`trigger-config:<triggerId>`)가 `redis-keys.md §4`(인접 네임스페이스) 표에 아직 등재되지 않은 것인데, 이는 이번 PR이 새로 만든 결함이 아니라 이전 라운드에서 이미 WARNING(LOW)으로 지적·추적되고 있는 항목이며, developer 가 `spec/` 쓰기 권한이 없어 코드·plan 양쪽에 명시적으로 planner 위임 처리한 것은 스킬 경계상 올바른 절차다. 즉 "규약을 어긴 코드"라기보다 "규약 문서 갱신이 아직 도착하지 않은 상태"에 가깝다.

## 위험도

LOW
