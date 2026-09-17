# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 핵심 변경(`TriggersService.update()` 창 1을 통째 엔티티 `save` → 부분 객체 `save`로 좁힘)은 e2e(`trigger-update-save-window.e2e-spec.ts`, 실제 Postgres)로 검증된 실제 lost-update 보안/무결성 버그 수정이며 신규 결함은 발견되지 않았다. 남은 것은 문서/테스트 기록 정합성 WARNING 4건과 SPEC-DRIFT 1건, 다수의 비차단 INFO다. **forced(router_safety) 7개 reviewer 전원 결과 확보 확인 완료 — 누락 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/2-trigger-list.md §3` ⚠️ 문단("PATCH 기본 저장 경로는 엔티티 통째 저장이며 ① CASCADE 창 실패 방식 ② 락 밖 컬럼 경합이 미검증")이 이번 PR로 이미 사실과 다르다 — 저장은 부분 객체로 전환됐고 ①②는 e2e로 실측 완료(①=23503/①b=23502 롤백·부활 없음, ②=통째 시 되돌아감/②b=부분 시 보존) | `spec/2-navigation/2-trigger-list.md:203-205` | 코드는 유지(옳음). developer 권한 밖이라 plan에 이미 planner 후속으로 명시됨 — 머지 직후 별도 PR로 ⚠️ 문단을 실측 결과로 교체하고 `code:` frontmatter에 신규 e2e 파일 등재 |
| 2 | 테스트 | plan 체크리스트의 뮤턴트 커버리지 표(M1)가 실측과 다르다 — "통째 엔티티 save로 되돌림" 뮤턴트가 테스트 2건 모두 RED로 만든다고 적혀 있으나, 실제 재현 결과 1건(`저장 대상은 이 요청이 바꾸는 필드뿐이다`)만 RED이고 `save 반환값의 null...` 테스트는 GREEN 그대로였다 | `plan/in-progress/trigger-save-partial-patch.md:144` | M1 행에서 `save 반환값의 null...` 테스트를 빼고 단독 테스트로 정정 — 잘못된 표가 남으면 향후 테스트 정리 시 방어선이 뚫릴 위험 |
| 3 | 문서화 | 저장 대상 설명 주석("재읽은 행을 저장 대상으로 쓴다")이 바로 아래 이번 PR의 신규 코드(부분 객체 `save`)와 문자 그대로 어긋난다 — 상위 블록 전제가 하위 블록에 의해 조용히 뒤집힌 채 방치 | `codebase/backend/src/modules/triggers/triggers.service.ts:658-675` | 658행 머리말을 "재읽은 행의 id를 키로 쓴다(값은 부분 객체로 좁힘 — 679행 참조)"처럼 수정하거나 두 블록 병합 |
| 4 | 문서화 | `trigger-transaction-mock.ts` 자신의 JSDoc이 "이 파일을 고칠 땐 뮤턴트 재측정치(53개 케이스)를 다시 재라"고 명시하는데, 이번 PR이 정확히 그 파일(`save` mock 동기→비동기, 반환값 폴백 추가)을 고쳤음에도 재측정 기록이 diff 어디에도 없다 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62-69` | 뮤턴트(콜백 미실행) 재실행해 RED 건수 재측정, 숫자가 바뀌었으면 갱신, 안 바뀌었으면 "재측정함, 여전히 53" 한 줄 기록 |
| 5 | 유지보수성 | 저장 payload(`{...defined, config: mergedConfig}`)가 `m.save()` 호출과 `Object.assign()` 호출에 리터럴로 두 번 중복 작성됨 — 필드 추가/제거 시 한쪽만 고치면 "DB에 쓴 값"과 "응답에 반영한 값"이 조용히 어긋남 | `codebase/backend/src/modules/triggers/triggers.service.ts:707-713` | `const patch = { ...defined, config: mergedConfig };`로 한 번만 구성해 `save`와 `Object.assign` 양쪽에서 재사용 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/API계약/유지보수성/테스트 (5개 reviewer 공통) | `if (written.updatedAt)` truthy 가드가 falsy일 때 응답이 에러 없이 재읽기 시점 stale `updatedAt`을 그대로 반환 — 실사용 경로에선 e2e로 "항상 채워짐"을 실측했으나 방어 분기 자체의 존재 근거(왜 없을 수 있다고 가정하는지)가 코드에 없음 | `codebase/backend/src/modules/triggers/triggers.service.ts:713` | 방어 분기가 실제로 필요한 경로가 있는지 확인 후, 없다면 non-null 단언/invariant 체크로 전환하거나 근거 주석 추가; 최소한 분기 생존을 확인하는 회귀 테스트 추가 |
| 2 | 데이터베이스/API계약/동시성 (3개 reviewer 공통) | 재읽기 뒤 `workflow` CASCADE 삭제 경합(advisory lock으로 못 막는 별개 경로)이 여전히 도메인 코드 없이 일반 500으로 마스킹됨 — 기존 갭이며 이번 PR의 회귀 아님, plan/consistency에 이미 planner 후속(`spec/5-system/15-chat-channel.md §5.4`)으로 등재 | `codebase/backend/src/modules/triggers/triggers.service.ts:716`, `http-exception.filter.ts` | 조치 불요(이미 트래킹됨) — 후속 PR에서 404/409 매핑 검토 |
| 3 | 테스트 | CHANGELOG/plan이 락 밖 되돌림 대상으로 나열한 4개 컬럼 중 e2e가 실제 SQL로 검증한 것은 2개(`notification_secret_v2`, `last_triggered_at`)뿐 — 단위 테스트의 일반화된 키 집합 단언이 나머지를 커버하므로 기능적 공백은 아님 | `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` | 필요시 CHANGELOG/plan에 "e2e 확인 범위 2/4" 각주 추가 또는 `chat_channel_token_v2` 케이스 보강 |
| 4 | 부작용 | 신규 e2e가 `jest.config.ts`의 "e2e 스펙은 pg Client 하나만 연다"는 문서화된 전제를 깨고 TypeORM `DataSource`도 직접 연다(정리는 적절히 됨) | `codebase/backend/jest.config.ts`, `test/trigger-update-save-window.e2e-spec.ts:41-42` | `jest.config.ts` 해당 주석에 이 파일을 예외로 명시하는 한 줄 추가 |
| 5 | 부작용 | 테스트 mock의 `save`가 이제 `undefined` 대신 항상 `target`으로 폴백 — 향후 반환값의 신규 필드를 무가드로 읽는 회귀에 대한 `TypeError` 트립와이어가 약해짐(이번 PR 범위의 회귀는 전용 테스트로 이미 커버됨) | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:125-133` | 조치 불요 — 향후 유사 회귀 시 이 트레이드오프를 기억할 것 |
| 6 | 유지보수성 | `update()`가 이미 크던 단일 메서드(약 215줄)에 이번 PR이 주석 28줄+코드 8줄을 더 얹어 계속 커짐 — 저장 payload 조립과 응답 재구성이 한 함수에 혼재 | `codebase/backend/src/modules/triggers/triggers.service.ts:679-714` | 여유 있을 때 `buildTriggerUpdatePatch`/`applyWrittenTimestamp` 헬퍼로 분리(이번 PR 스코프 밖) |
| 7 | 유지보수성 | e2e의 Postgres 에러코드(`23503`/`23502`)가 매직 스트링으로 두 번 등장 | `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:135,149` | 지역 상수화 고려(낮은 우선순위) |
| 8 | 데이터베이스 | 수정 전제가 TypeORM `save()`의 "부분 객체 diff" 내부 동작(비공식 계약)에 의존 — e2e characterization 테스트로 완화됨 | `codebase/backend/src/modules/triggers/triggers.service.ts:679-706` | TypeORM 버전 업그레이드 PR에서 이 e2e를 우선 확인 절차에 남겨둘 것 |
| 9 | 데이터베이스 | `save()`가 `update()`보다 advisory lock 보유 시간을 다소 늘릴 수 있음 — 의도된·문서화된 트레이드오프(재조회+`update()` 전환 시 단위 6건 RED 이력 있음) | `codebase/backend/src/modules/triggers/triggers.service.ts:632-715` | 트리거 PATCH 트래픽 증가 시 `lock_timeout` 초과율 관측 지표 추가 고려 |
| 10 | 범위 | 공용 테스트 mock(`trigger-transaction-mock.ts`)의 `save` 동작 변경이 diff에 없는 다른 소비 spec 파일(`triggers.web-chat.spec.ts`, `schedules.service.spec.ts`)에도 영향 — plan에 기록된 전체 스위트 통과 실측(unit 14·e2e 314 ALL PASS)이 이를 뒷받침 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:124-133` | 조치 불요, 기록 목적 |
| 11 | 보안 | 이번 변경은 기존 잠재적 보안 성격 lost-update(시크릿 회전 상태 `notification_secret_v2`, 정리된 `chat_channel_token_v2` 되돌림)를 실제로 수정하는 방향 — 신규 취약점 아니라 기존 결함의 수정 | `codebase/backend/src/modules/triggers/triggers.service.ts:707-714` | 없음(방향 확인용 기록) |
| 12 | 요구사항 | 신규 단위 테스트가 null 방어를 검증하며 3개 nullable 컬럼 중 1개(`endpointPath`)만 단언 — "통째로 덮는" 뮤턴트 클래스는 잡히나 특정 필드만 골라 덮는 뮤턴트까지는 못 잡는 좁은 틈 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3886-3918` | 여유 있을 때 `notificationSecretV2`·`chatChannelTokenV2`도 같은 단언에 추가(선택) |
| 13 | 보안 | e2e 테스트의 DB 비밀번호 fallback(`'clemvion-e2e'`)이 하드코딩돼 있으나 저장소 전반의 기존 e2e 관행과 동일 — 신규 위험 아님 | `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:82` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 기존 잠재 보안 lost-update 수정 확인, 신규 취약점 없음, SQL 파라미터화 정상 |
| requirement | LOW | SPEC-DRIFT(2-trigger-list.md §3) 1건, null 커버리지 여유 1건 |
| scope | NONE | 범위 이탈 없음 — 단일 hunk에 국한, 공용 mock 파급 INFO 1건 |
| side_effect | LOW | `updatedAt` stale 응답 가능성, jest.config.ts 주석 전제 붕괴, mock 트립와이어 약화 |
| maintainability | LOW | payload 중복 작성(WARNING), truthy 가드 근거 불명확, 메서드 비대화 |
| testing | LOW | 뮤턴트 커버리지 표 오류(WARNING), e2e 검증 범위 2/4 컬럼 |
| documentation | LOW | 주석 stale(WARNING), 재측정 미기록(WARNING) |
| database | LOW | FK CASCADE 500 마스킹(기존 갭), TypeORM 내부 동작 의존, lock 보유시간 소폭 증가 |
| concurrency | LOW | `updatedAt` stale fallback, FK CASCADE 창은 비회귀로 확인 |
| api_contract | NONE | breaking change 없음, DTO/에러코드/인가 불변 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 확인, 매칭 0건 |

## 발견 없는 에이전트

- **user_guide_sync** — 21개 유저 가이드 동반 갱신 trigger 전수 대조, 매칭 0건(순수 backend 서비스 계층 버그 수정 + 테스트).

## 권장 조치사항

1. `plan/in-progress/trigger-save-partial-patch.md:144`의 뮤턴트 커버리지 표(M1) 정정 — 잘못된 표는 향후 테스트 정리 시 방어선을 뚫을 수 있어 우선순위가 가장 높다.
2. `codebase/backend/src/modules/triggers/triggers.service.ts:658-675`의 오래된 저장 대상 주석을 부분 객체 저장 방식에 맞게 수정.
3. `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62-69`의 뮤턴트 재측정치("53개 케이스")를 재실행해 갱신하거나 "재측정함" 기록 추가.
4. `codebase/backend/src/modules/triggers/triggers.service.ts:707-713`의 저장 payload 중복(`save` 호출과 `Object.assign` 호출)을 `const patch`로 단일화.
5. [SPEC-DRIFT] `spec/2-navigation/2-trigger-list.md §3` ⚠️ 문단 갱신 — developer 권한 밖이므로 머지 직후 planner 후속 PR로 처리(plan에 이미 예정됨).
6. (선택, 비차단) `written.updatedAt` 방어 분기의 존재 근거를 확인해 invariant화하거나 주석 보강; `jest.config.ts` 주석 갱신·e2e 검증 범위 각주 등 나머지 INFO는 여유 있을 때 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 확인 완료, 누락 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff는 단건 트리거 행 저장 방식 변경으로 성능 특성 변화(신규 쿼리 패턴·N+1 등) 없음으로 분류 |
  | architecture | router 판단 — 단일 hunk 국소 수정, 구조적 재설계 없음으로 분류 |
  | dependency | router 판단 — 신규 의존성 추가/버전 변경 없음으로 분류 |