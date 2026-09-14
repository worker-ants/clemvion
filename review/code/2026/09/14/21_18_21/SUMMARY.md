# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. 14개 reviewer(전원 실행, forced 7명 포함) 전체 결과 확보됨(누락 없음). 실제 코드 결함은 없고, 전부 (1) 이미 존재하는 잔여 문서 드리프트(CHANGELOG·JSDoc)와 (2) 신규 코드 경로 하나의 테스트 커버리지 갭으로 수렴한다. 이 배치(5라운드 누적)를 막을 사유는 없다는 데 14개 reviewer 전원이 동의한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/Database | `TriggersService.remove()` 의 삭제-락 실패 시 "던진다"(조용한 지연 대신 드러나는 오류로 만든다는 이 PR의 설계 목표) 보증이 어떤 테스트로도 지켜지지 않는다 — `throw err;` → `// swallow` 로 뮤테이션해도 140개 테스트 전부 GREEN(실측). 실패 시 감사 로그(`TRIGGER_DELETED`)를 남기지 않는다는 보증도 같은 이유로 미검증 | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 내 `.catch((err) => { logger.error(...); throw err; })` | `m.remove`를 reject시키는 fixture로 `service.remove(...)`가 그 에러를 그대로 rethrow하는지, `logger.error` 호출과 `recordAudit` 미호출을 함께 단언하는 테스트 1개 추가 |
| 2 | Documentation | `CHANGELOG.md`의 "대기 상한은 없다" 서술이 이후 커밋(`889c93cd9`/`e5319a409`)이 추가한 삭제 경로(`TRIGGER_DELETE_LOCK_TIMEOUT_MS=5s`) 예외를 반영하지 못해, 구현·테스트보다 넓은 보장을 약속한다 (requirement/documentation/concurrency 3명 동일 지적) | `CHANGELOG.md:34-36` | "단, 삭제(`DELETE /api/triggers/:id`)는 되돌릴 수 없는 정리 이후 무한 대기가 위험해 5초 `lock_timeout` 예외를 둔다" 한 문장 추가 |
| 3 | Documentation | 고아(orphaned) JSDoc — `touchLastTriggeredAt` 신설 위치가 기존 `markChatChannelRateLimited`를 설명하던 CCH-NF-03 docblock과 그 함수 정의 사이에 끼어들어, 그 docblock이 지금은 엉뚱한(`touchLastTriggeredAt`) 함수를 설명하는 것처럼 보이고 정작 `markChatChannelRateLimited`는 설명을 잃었다 | `codebase/backend/src/modules/hooks/hooks.service.ts:957-986` | CCH-NF-03 docblock을 `markChatChannelRateLimited`(`:986`) 바로 위로 이동, `touchLastTriggeredAt` JSDoc은 그 함수 바로 위에만 유지 |
| 4 | Maintainability | `TriggersService.update()`가 advisory lock 획득~재읽기~병합~저장을 담은 40줄 트랜잭션 클로저를 안으로 삼켜, 이미 다책임이던 메서드가 163→182줄로 늘고 이해에 두 스코프(메서드→콜백)를 오가야 한다 | `codebase/backend/src/modules/triggers/triggers.service.ts:579-629` | 트랜잭션 콜백 본문을 `private mergeAndSaveLocked(...)` 형태로 추출 |
| 5 | Maintainability | 신규 테스트 헬퍼에서 `ChannelListenerRegistry` provider 교체가 바로 다음 줄에 정의되는 `at()` 헬퍼와 동일한 검색 로직을 인라인으로 먼저 반복 — 같은 함수 안에서 두 스타일 혼재(순수 테스트 코드, 리스크 없음) | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3708-3719` | `at` 선언을 위로 올려 세 provider 교체 모두 동일 형태로 통일 |
| 6 | Side Effect | 삭제 경로에 새로 건 `SET LOCAL lock_timeout`이 advisory lock 획득 한 줄이 아니라 **같은 트랜잭션의 `DELETE`(및 `Schedule.triggerId` CASCADE) 전체의 lock 대기**에 적용됨 — JSDoc이 서술하는 범위(advisory lock 대기)보다 실제 부작용 범위가 넓어, 다른 writer가 그 행을 5초 이상 점유하면 advisory lock과 무관한 사유로 `55P03` 실패할 수 있음(데이터 손상은 없음 — 트랜잭션 롤백) | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:44-50`, `triggers.service.ts:968-974` | advisory lock 획득 직후 `SET LOCAL lock_timeout = DEFAULT`로 범위를 좁히거나, CASCADE 연쇄 대상까지 포함한다는 사실을 JSDoc/plan에 명시 |
| 7 | Performance | advisory lock 대기에 상한이 없는 세 경로(update/binder/rotateBotToken, delete만 5s 상한 있음)에서 경합이 몰리면 그 트랜잭션이 점유한 DB 커넥션이 대기 상태로 묶여 전역 커넥션 풀 고갈로 번질 잠재 가능성(설계 근거는 명시적, 임계구간 짧음) | `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `acquireTriggerConfigLock` 및 호출부(`triggers.service.ts` update/rotateBotToken, `chat-channel-binder.service.ts`) | 지금 조치 불요. 운영 중 특정 트리거 폭주가 관측되면 나머지 세 호출부에도 `timeoutMs` 확대 적용 검토 |
| 8 | Performance | `TriggersService.update()`가 PATCH 1건당 DB 왕복을 대략 2배(SELECT 2회 + lock + UPDATE)로 늘림 — lost-update 방지를 위해 불가피하고 이미 중복 JOIN은 제거됨, hot path 아니라 영향 낮음 | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` | 조치 불요. 재사용 빈도가 늘면 재측정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `rewriteTriggerConfigLocked`가 여전히 `Trigger` 엔티티 전용(제네릭 아님) — plan §D 후속 8곳 착수 시 매개변수화 필요 | `trigger-config-lock.ts:127,142,161` | 후속 착수 시 `<T>` 매개변수화 검토 |
| 2 | Architecture | 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)의 엔티티 매칭이 식별자 텍스트 비교라 `import { Trigger as T }` 같은 별칭에 잠재적으로 취약(현재 별칭 사용 0건, 실질 위험 없음) | `endpoint-path-conflict-wrap-guard.ts:162-166` | 급하지 않음. 재손질 시 TypeChecker 기반 심볼 비교로 전환 고려 |
| 3 | Architecture/Requirement | `notification`/`interaction` 서브키를 건드리는 4~5개 메서드는 여전히 락 없는 `save()` — 같은 `Trigger` 애그리게잇 안에 두 동시성 모델이 공존(plan §D가 실측과 함께 후속 범위로 이미 등재) | `triggers.service.ts` `rotateNotificationSecret` 등 | 클래스/메서드 주석에 "이 범위 밖 — §D 후속" 한 줄 추가 권고 |
| 4 | Requirement | plan의 "후속(developer 범위) — 이 PR로 넓히지 않는다" 표에 이미 해결된 `remove()` 락 항목이 남아 혼동 유발(코드는 이미 정확) | `plan/in-progress/trigger-config-lost-update.md` | 해당 행 제거 또는 "해결됨" 표시 |
| 5 | Maintainability | 락 안 재읽기 결과(`previousInboundSigningRef`)가 트랜잭션 클로저 경계를 넘나드는 `let` 재대입으로 흐름 추적 비용 있음(현재 정확) | `triggers.service.ts:544,593-594,662` | 트랜잭션 콜백이 값을 함께 반환하도록 리팩터링 고려 |
| 6 | Maintainability | 존재-검증 헬퍼 `assertTriggerFound`를 리터럴 `null` 인자로 호출해 "그냥 던지기" 용도로 계약 우회 재사용 | `triggers.service.ts:1243` | `throwTriggerNotFound(): never` 별도 추출 또는 오버로드 |
| 7 | Testing | (3라운드 연속) `trigger-config-lock.spec.ts`의 "null·undefined" 케이스 제목이 실제로는 `undefined`만 검증 | `trigger-config-lock.spec.ts` | `it.each`로 `null` 케이스 추가 |
| 8 | Testing | (2라운드 연속) `withTransactionMock`의 idempotency 가드·시퀀스 폴백 분기가 어떤 테스트에도 행사되지 않음(테스트 인프라, 조치 불요로 기처분) | `trigger-transaction-mock.ts:77`, `triggers.service.spec.ts` `freshFindOne` | 조치 불요(기존 처분 유지) |
| 9 | Concurrency | 창 1(`update()`)의 재읽기~저장 구간에서, 락에 참여하지 않는 `touchLastTriggeredAt`(컬럼 한정 update)의 동시 갱신이 아주 좁은 창에서 되돌려질 수 있음(데이터 손상 아님, PR이 기존보다 이 창을 오히려 좁힘) | `triggers.service.ts` `update()` 588~627행 | plan "형제 창" 표에 한 줄 추가 권고, 조치 불요 |
| 10 | Security | `rewriteTriggerConfigLocked`의 `findOne`~`update` 사이 좁은 삭제-경합 창(고아 UPDATE, 데이터 손상·보안 영향 없음, 이전 라운드 기수용) | `trigger-config-lock.ts` `rewriteTriggerConfigLocked` | 조치 불요 |
| 11 | Security | advisory lock timeout을 SQL 문자열에 보간(현재 호출부 전부 하드코딩 상수라 injection 불가) — 향후 사용자 입력 유입 시 실제 표면이 될 수 있음 | `trigger-config-lock.ts` `acquireTriggerConfigLock` | JSDoc에 "상수만 전달" 명시 또는 런타임 정수 가드 추가 |
| 12 | API Contract | `DELETE /api/triggers/:id`가 삭제 락 타임아웃(5s) 시 `QueryFailedError(57014)`가 일반 500으로 마스킹되고 Swagger에 별도 등재 없음(발생 조건 좁음) | `triggers.service.ts` `remove()`, `trigger-config-lock.ts:39-54` | 실사례 관측되면 409/503 + 전용 에러 코드로 승격 검토 |
| 13 | Dependency | 신규 외부 패키지·락파일 변경 0건, 모든 신규 import는 기존 선언 의존성 또는 내부 모듈. 순환 의존 없음 | `package.json` diff 없음, 신규 leaf 모듈 `trigger-config-lock.ts`/`chat-channel-input-rules.ts` | 없음 |

## 절차 참고 — 병렬 리뷰 중 관측된 작업 트리 뮤테이션 (이슈로 집계하지 않음)

`maintainability`·`dependency`·`database` 3개 reviewer가 리뷰 진행 중 `triggers.service.ts`의 `remove()` `.catch` 블록에서 `throw err;` 가 일시적으로 `// MUTANT: swallow` 로 바뀐 미커밋 상태를 관측했다고 보고했다(각자 Edit/Write는 하지 않았다고 명시). SUMMARY 작성 시점 `git status --short` 재확인 결과 해당 파일은 추적 변경 없이 clean 상태이며(`?? review/code/2026/09/14/21_18_21/` 만 존재), 잔여 뮤테이션은 없다. 공교롭게도 이 뮤테이션의 형태가 위 **WARNING #1**(삭제-락 실패 시 오류 전파 미검증)이 정확히 겨냥하는 뮤턴트와 일치해, 그 WARNING의 현실성을 뒷받침하는 정황으로 남긴다.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 락 timeout SQL 보간(현재 무해)·삭제 경합 좁은 창 — 둘 다 INFO. 인입 웹훅 fail-open을 닫는 핵심 수정 자체를 긍정 확인 |
| performance | LOW | PATCH 왕복 증가·lock 대기 상한 부재(WARNING 2건, 둘 다 조치 불요 판정). 웹훅 hot path는 오히려 최적화됨 |
| architecture | LOW | `Trigger` 전용 하드코딩·정적 가드 텍스트 매칭·이원 동시성 모델 공존(전부 INFO, 이전 라운드 결함 다수 해소 확인) |
| requirement | LOW | CHANGELOG "대기 상한 없음" drift(WARNING), plan 표 배치 혼동(INFO). 기능·spec 정합성은 5라운드 서술과 소스 대조로 확인 |
| scope | NONE | 16개 코드 파일 전수 diff 확인, 범위 이탈 없음 |
| side_effect | LOW | `SET LOCAL lock_timeout` 범위가 문서보다 넓음(WARNING), orphan JSDoc(INFO) |
| maintainability | LOW | `update()` 트랜잭션 클로저 비대화(WARNING), 테스트 헬퍼 스타일 비일관(WARNING), 그 외 INFO 다수. 이전 라운드 중복(클로저 쌍둥이·인라인 캐스트) 해소 확인 |
| testing | WARNING | `remove()` 삭제-락 실패 전파 보증이 뮤테이션 미검출(실측: 140 tests 전건 GREEN) — 이번 라운드 유일한 실질 커버리지 갭 |
| documentation | LOW | orphan JSDoc(WARNING), CHANGELOG drift(WARNING). 문서화 밀도 자체는 저장소 평균 상회 |
| dependency | NONE | 신규 패키지/락파일 변경 0건, 순환 의존 없음 |
| database | LOW | `remove()` 실패 시 감사로그 미기록 보증 미검증(WARNING, testing과 동일 근본원인). 삭제 레이스는 이번 라운드에 해소 확인 |
| concurrency | LOW | CHANGELOG drift(WARNING), 락 미참여 컬럼 갱신의 좁은 창(INFO). 락 순서·데드락·임계구간 설계는 전부 건전 확인 |
| api_contract | NONE | 컨트롤러/DTO 변경 0건. 이전 라운드 WARNING(형제 엔드포인트 응답 불일치)이 이번에 해소됨을 확인. DELETE 500 마스킹은 INFO |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매칭 0건(frontend/spec/nodes 변경 없음) |

## 발견 없는 에이전트

- **scope**: 요청 범위를 벗어난 변경 없음(전 16개 코드 파일이 단일 lost-update 근본원인으로 귀결).
- **user_guide_sync**: doc-sync-matrix 21개 trigger 매칭 0건 — 유저 가이드 동반 갱신 대상 아님.
- **api_contract**: 컨트롤러/DTO/라우트/인증/페이지네이션 변경 없음(서비스 계층 한정 수정).
- **dependency**: 신규 패키지·버전·라이선스 변경 없음.
- **security**: SQL 인젝션·시크릿 하드코딩·인가 우회·암호화 오용 등 CRITICAL/WARNING급 결함 없음.

## 권장 조치사항

1. `triggers.service.spec.ts`에 `remove()`의 삭제-락 실패 시 오류 rethrow + 감사 로그 미기록을 함께 단언하는 회귀 테스트 1개 추가 (WARNING #1 — 이번 배치에서 유일하게 실제 코드 경로를 겨냥하는 커버리지 갭).
2. `CHANGELOG.md`의 "대기 상한은 없다" 문단에 삭제 경로 5초 예외를 명시해 구현·테스트와 일치시킨다 (WARNING #2).
3. `hooks.service.ts`의 orphan JSDoc(CCH-NF-03 docblock)을 `markChatChannelRateLimited` 위로 재배치한다 (WARNING #3).
4. 여유가 되면 `TriggersService.update()`의 트랜잭션 클로저를 private 메서드로 추출해 가독성을 개선한다 (WARNING #4).
5. 나머지 WARNING(#5~#8)과 INFO 항목들은 모두 조치 불요 또는 후속 라운드로 명시적으로 defer 가능 — 이번 배치 병합을 막을 사유 없음.

## 라우터 결정

`routing_status=skipped` — 라우터 미사용. 전체 14개 reviewer 실행(forced 화이트리스트: documentation, maintainability, requirement, scope, security, side_effect, testing 포함 7명 전원 결과 확보됨). 제외된 reviewer 없음.