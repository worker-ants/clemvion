# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이전 두 라운드의 CRITICAL/WARNING(락 없는 동시 쓰기, 웹훅 hot path fail-open, 창1 형제창 되돌림)은 이번 커밋(`c7a9c107e`)에서 실제로 닫혔음을 여러 리뷰어가 코드 추적·뮤테이션으로 재확인했다. 다만 그 수정 자체가 **새로운 CRITICAL 2건**을 남겼다 — (1) 창1이 동시 삭제와 겹치면 삭제된 트리거를 같은 id로 되살리는 경로(`side_effect`, `concurrency`가 TypeORM 내부 동작까지 실측 확인), (2) 이번 배치가 고친 두 대칭 hot-path 중 더 위험한 쪽(chat-channel 인입 경로)에 회귀 테스트가 없다는 것을 뮤테이션으로 실측(`testing`). 강제 화이트리스트(router_safety forced 7명) 전원 결과 확보됨 — raw 데이터 누락으로 인한 거짓 저위험 판정은 아니다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/부작용 | `TriggersService.update()`(창 1)이 advisory lock 안 재읽기(`fresh`)가 `null`이면(그 사이 트리거가 삭제됨) `rewriteTriggerConfigLocked`처럼 skip 하지 않고 stale `trigger` 스냅샷(`fresh ?? trigger`)으로 그대로 `m.save(Trigger, target)`를 호출한다. TypeORM의 `save()`는 대상 PK로 재조회해 행이 없으면 `mustBeInserted=true`로 판정해 **INSERT**를 실행하므로(vendored `Subject.js`/`SubjectDatabaseEntityLoader.js`로 실측 확인 — side_effect·concurrency 두 리뷰어 독립 확인), 방금 삭제된 트리거가 같은 id로 조용히 부활한다. `remove()`가 이미 끝낸 `teardownChatChannel`/`secrets.deleteByPrefix`/BullMQ job 해제/CASCADE 삭제된 `schedule` row는 되돌아가지 않아 되살아난 행이 고아 참조를 갖게 되고, `chatChannel`이 실린 PATCH라면 provider `setupChannel`+listener 재등록까지 재실행될 수 있다. 감사 로그엔 `TRIGGER_UPDATED`만 남아 "삭제 후 부활" 사실이 기록되지 않는다. `remove()`는 이 advisory lock을 잡지 않으므로 인터리빙이 항상 가능하다. | `codebase/backend/src/modules/triggers/triggers.service.ts:557`(`m.findOne`)·`:582`(`const target = fresh ?? trigger;`)·`:584`(`m.save(Trigger, target)`). 대조: `trigger-config-lock.ts:108-109`(`if (!fresh) return false;`) | `!fresh`일 때 나머지 세 창과 동일하게 skip/명시적 실패(예: `NotFoundException`)로 처리하고 `fresh ?? trigger` 폴백을 제거. 또는 `remove()`가 같은 advisory lock(`trigger-config:<id>`)을 잡게 해 이 인터리빙 자체를 차단(plan §D에 이미 "후속"으로 등재된 항목과 동일 수정으로 동시에 닫힘). |
| 2 | 테스트 | `hooks.service.ts`의 두 대칭 hot-path 수정(`save(trigger)` → 컬럼 한정 `update({id},{lastTriggeredAt})`) 중 chat-channel 인입 경로(더 잦고, 코드 주석 자신이 "PATCH 경합보다 훨씬 잦다"고 명시한 더 위험한 쪽)에만 회귀 테스트가 없다. 뮤테이션으로 실측: 이 call site만 종전 `save(trigger)`로 되돌려도 `hooks.service.spec.ts` 54건 전부 GREEN(대조군인 반대 call site를 같은 방식으로 되돌리면 정확히 1건 RED로 잡힘 — 무효 뮤턴트가 아님을 확인). plan/CHANGELOG의 "뮤턴트 두 방향 모두 RED를 확인했다"는 실측 서술이 이 자리에 대해서는 사실이 아니다. | `codebase/backend/src/modules/hooks/hooks.service.ts:695-704`(`handleChatChannelWebhook`). 테스트 파일: `codebase/backend/src/modules/hooks/hooks.service.spec.ts`(`describe('Chat Channel 분기', ...)` `:590`, "새 execution 시작" 테스트 `:798`는 이 call site를 통과하지만 대상 단언 없음) | 기존 `:201` 테스트(`webhook` 타입 경로 겨냥)와 대칭인 케이스를 `:590` 블록 안에 추가 — `chatChannelTrigger`로 이 경로를 태운 뒤 `expect(triggerRepo.save).not.toHaveBeenCalled()` + `update` patch가 `{lastTriggeredAt}` 뿐임을 단언. `:201` 테스트 형태를 거의 그대로 재사용 가능. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | 락 없이 `trigger.config`를 통째로 스냅샷 기반으로 덮어쓰는 형제 write-site 3곳(`normalizeNotificationSecretRef`, `revokePerTriggerToken`, `promoteRotatedNotificationSecrets`, 2자리)이 여전히 남아 있다 — 이 PR이 닫은 4개 창(+ 이번 라운드 hooks 2곳)과 같은 lost-update 클래스이며, 그중 `revokePerTriggerToken`이 `chatChannel.inboundSigningRef`와 동시에 겹치면 이 PR이 닫으려는 fail-open이 인접 엔드포인트로 재현될 수 있다. | `codebase/backend/src/modules/triggers/triggers.service.ts:775,1008,1225,1256` | 새 조치 불요 — `plan/in-progress/trigger-config-lost-update.md` §D/§후속이 이미 전수 열거·처분(`revokePerTriggerToken` 최우선)해 뒀다. 후속 PR에서 그 우선순위를 따를 것. |
| 2 | 문서화/scope | `CHANGELOG.md`의 Behavior change 항목이 `12ed21ff1` 시점 기준으로 작성돼, 이후 커밋(`c7a9c107e`)이 추가한 hooks hot-path 수정 및 "1라운드 수정이 만든 새 lost update" 정정을 반영하지 못한다 — "config를 다시 쓰는 네 자리 전부"라는 서술이 실제 수정 범위(창1~4 + hooks 두 자리)보다 좁다. `scope` 리뷰어도 독립적으로 같은 사실을 관측(INFO로 기록). | `CHANGELOG.md:3-26` | 종결 커밋 전에 hooks 인입 hot path 컬럼-한정 update 전환 내용을 한 문단 추가하고, "네 자리" 수치 표현이 이번 PR 전체 범위를 가리키지 않음을 명시. `plan` §D가 이미 정확한 서술을 담고 있어 옮기면 됨. |
| 3 | 유지보수성 | `previousInboundSigningRef`가 함수 최상단에서 선언되고(요청 시작 시점 값) 트랜잭션 클로저 내부에서 조건부 재할당된 뒤, 커밋 후 한참 뒤의 다른 분기(`setupChatChannel` 인자)에서 소비된다 — 값의 흐름을 추적하려면 클로저 경계를 세 번 넘어야 한다. | `codebase/backend/src/modules/triggers/triggers.service.ts:513`(선언) → `:562-563`(트랜잭션 콜백 내 재할당) → `:619`(소비) | 급하지 않음(인접 JSDoc이 이미 함정을 상세히 설명). 다음에 이 함수를 만질 때 트랜잭션 콜백이 `{target, previousInboundSigningRef}` 결과 객체를 반환하도록 바꿔 단일 대입점으로 정리하는 것을 고려. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/성능/DB/API 계약 (공통 확인) | 웹훅 hot path의 `save(trigger)` → 컬럼 한정 `update({id},{lastTriggeredAt})` 전환은 인입 메시지마다 도는 자리에서 `inboundSigningRef` fail-open 재발을 구조적으로 차단하고, 응답 스키마·왕복 수(1회 유지)에 영향 없이 페이로드/서브스크라이버 오버헤드만 줄인 개선. | `hooks.service.ts:232-236, 700-704` | 조치 불요(긍정 확인). 향후 컬럼 추가 시에도 patch 객체를 필요한 컬럼으로만 좁히는 관례 유지. |
| 2 | 아키텍처/DB/동시성 (공통 확인) | 19_07_43 라운드 WARNING("창1의 `save(trigger)`가 형제 창의 부분 UPDATE를 되돌린다")이 저장 대상을 `trigger`→`fresh ?? trigger`(락 안 재읽은 행)로 바꿔 해소됨. 락 획득 SQL 중복도 `acquireTriggerConfigLock` 단일 프리미티브로 수렴. | `triggers.service.ts:582-584`, `trigger-config-lock.ts:39-46` | 조치 불요. 단 이 수정이 Critical#1의 새 결함(삭제 레이스 시 부활)을 만든 지점이므로 함께 처리 필요. |
| 3 | 유지보수성 | `withTransactionMock` JSDoc이 "provider가 6개 파일에 흩어져 있다"고 전수 조사했지만, 실제로 이번 diff가 이관한 곳은 2곳(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)뿐 — 나머지 4곳은 현재 `TriggersService` 트랜잭션 경로를 호출하지 않아 안전하지만 JSDoc이 이 구분을 언급하지 않아 다음 사람이 오인할 소지. | `trigger-transaction-mock.ts:20-27` | JSDoc에 "이번 PR은 2곳만 이관, 나머지 4곳은 트랜잭션 경로 미호출로 미이관"을 한 줄 추가. |
| 4 | 문서화 | `trigger-config-lock.ts` JSDoc의 "네 자리" 배경 설명이 이 함수 자신의 실제 호출부 수(3곳 — 창1은 이 함수를 쓰지 않음)와 구분 없이 섞여 있음 — 세 번째 라운드 연속 지적, 아직 미반영. | `trigger-config-lock.ts:53` | 우선순위 낮음. "배선: 창 2·3·4. 창 1은 별도 인라인" 한 줄 추가로 종결 가능(이미 정확한 문구가 두 라운드 전 제안됨). |
| 5 | 테스트 | `trigger-config-lock.spec.ts`의 "config가 null이면…" 테스트 제목과 달리 실제 fixture는 `undefined`만 검증(동작상 `??`라 차이 없음). | `trigger-config-lock.spec.ts:93-100` | 급하지 않음 — 제목 정정 또는 `null` 케이스 추가. |
| 6 | DB/동시성 (추적됨) | `remove()`가 advisory lock을 잡지 않아 삭제 레이스의 좁은 창 존재(무해한 orphan UPDATE 수준으로 plan에 등재) — 단 Critical#1이 밝혔듯 창1의 `save()` 경로에는 "무해"가 적용되지 않음(위 표 정정 필요). `lock_timeout` 부재로 인한 무제한 대기/커넥션 점유도 설계상 수용된 트레이드오프로 재확인. | `trigger-config-lock.ts:39-46`, `triggers.service.ts:893-922`(`remove()`) | 조치 불요(추적됨), plan §D의 "데이터 손상 없음" 서술을 창1 한정으로 정정 필요(Critical#1과 연동). |
| 7 | 의존성 | 이번 라운드도 `package.json`/lockfile 변경 0건, 신규 import는 전부 기존 dependency 또는 내부 모듈. | 전체 diff | 조치 불요. |
| 8 | 유저가이드 동기화 | 매트릭스 22개 trigger 전건 검토 — 매칭 0건(순수 backend 동시성 버그 수정+리팩터+테스트). | 해당 없음 | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 웹훅 hot path save→update 전환으로 인증 우회 재발 경로 해소 확인. 신규 결함 없음 |
| performance | LOW | hot path 전환은 개선. 이전 라운드 트레이드오프(락+재읽기 비용)는 변화 없이 유지 |
| architecture | LOW | 이전 두 라운드 WARNING(락 SQL 중복, 클로저/캐스트 중복) 모두 공용 함수 추출로 해소 확인 |
| requirement | NONE | 핵심 요구사항(lost-update 방지, fail-open 차단) 충족을 코드 추적+e2e+전체 테스트(GREEN)로 확인 |
| scope | NONE | 모든 변경이 단일 결함 클래스와 직접 파생 항목에 한정. CHANGELOG 범위 갭은 INFO로 별도 기록 |
| side_effect | HIGH | **CRITICAL**: 창1이 동시 삭제된 트리거를 save()로 재삽입(부활)시킬 수 있음. 형제 write-site 3곳 lost-update 미해결(WARNING, 추적됨) |
| maintainability | LOW | 락/재읽기/머지 로직은 잘 분리됨. 트랜잭션 클로저를 넘나드는 mutable 변수 1건(WARNING) |
| testing | HIGH | **CRITICAL**: chat-channel 인입 hot path에 회귀 테스트 부재를 뮤테이션으로 실측(대칭 call site는 RED, 이 자리만 GREEN) |
| documentation | LOW | CHANGELOG가 최신 커밋 범위를 못 따라잡음(WARNING). JSDoc "네 자리" vs "3곳 배선" 혼재(3라운드째 INFO) |
| dependency | NONE | 신규 외부 패키지 없음 |
| database | LOW | 창1 형제창 되돌림 WARNING 해소 확인. 삭제 레이스/무가드 save 8곳/타임스탬프 캡처 시점은 추적된 INFO |
| concurrency | MEDIUM | 창1의 `!fresh` 폴백이 skip이 아니라 INSERT(부활)로 귀결됨을 TypeORM 내부 동작으로 확인(side_effect CRITICAL과 동일 근본 원인) |
| api_contract | NONE | 컨트롤러/DTO/응답 스키마 변경 없음. 409 충돌 변환 경로 유지 확인 |
| user_guide_sync | NONE | 매트릭스 22개 trigger 매칭 0건 — 순수 backend 동시성 수정 |

## 발견 없는 에이전트

없음 — 14개 reviewer 전원이 최소 INFO 이상을 기록했다(리스크 NONE 판정 에이전트도 확인 사항을 INFO로 남김).

## 권장 조치사항

1. **[최우선]** `TriggersService.update()`(창1)에서 `!fresh`(락 안 재읽기 결과 없음 = 동시 삭제)일 때 `fresh ?? trigger` 폴백으로 stale 엔티티를 `save()`하지 말 것 — `rewriteTriggerConfigLocked`와 동일하게 skip/명시적 실패로 처리해 삭제된 트리거의 조용한 부활을 차단한다(Critical#1 / concurrency MEDIUM).
2. `hooks.service.ts`의 chat-channel 인입 경로(`handleChatChannelWebhook`)에 대해서도 `:201` 테스트와 대칭인 회귀 테스트를 추가해, 이 배치가 실제로 막았다고 주장하는 fail-open 재발을 유닛 레벨에서 잡히게 한다(Critical#2).
3. `CHANGELOG.md`의 Behavior change 항목을 최신 커밋(`c7a9c107e`) 범위까지 갱신한다(WARNING#2).
4. `plan/in-progress/trigger-config-lost-update.md` §D의 "삭제 레이스는 데이터 손상 없음(INFO#6)" 서술을 창1 한정으로 정정하고, `remove()`가 advisory lock에 참여하도록 하는 후속 수정을 우선순위 표에 반영한다(Critical#1과 연동).
5. (급하지 않음) 트랜잭션 클로저를 넘나드는 `previousInboundSigningRef` 정리, `withTransactionMock`/`trigger-config-lock.ts` JSDoc의 서술 범위 정정 — WARNING#3, INFO#3·#4.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 강제 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(forced 미이행 없음)