# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 코드(창 1 `save` 를 부분 객체로 좁힌 lost-update 수정)는 12개 reviewer 전원이 코드 결함 없음으로 확인했다. 위험도를 MEDIUM 으로 매기는 유일한 근거는 `testing` reviewer 의 WARNING — mock JSDoc·plan·CHANGELOG 가 근거로 반복 기재하는 뮤턴트 재측정치("60개 RED")를 두 가지 합리적 방식으로 직접 재현해도 재현되지 않았다(64·68). 코드 자체는 clean 이지만 감사 근거로 쓰이는 숫자의 신뢰도 문제이므로 WARNING 으로 반영한다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 뮤턴트 재측정치("60개 RED", 321건 중)를 두 가지 방식으로 직접 재현했으나 각각 68·64 로 나와 문서 수치와도, 서로와도 불일치한다. "콜백을 실행하지 않는다"는 서술이 반환값(`undefined` vs `false` 등)까지 고정하지 않아 뮤턴트 자체가 잘 정의돼 있지 않다. 같은 파일이 13→53→60 으로 재측정치를 반복해서 다르게 보고해 온 패턴의 연장(53 기반 파생 서술은 1라운드가 이미 반증). | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:63` (JSDoc), `plan/in-progress/trigger-save-partial-patch.md:116,164` | 정확한 숫자 대신 재현 스크립트(뮤턴트의 정확한 형태 포함)를 코드/canary 로 고정해, 사람마다 다른 뮤턴트를 만들어 다른 수를 재는 문제를 근본적으로 없앨 것. 최소한 뮤턴트의 정확한 반환값 형태까지 각주에 명시. |
| 2 | documentation | CHANGELOG "함께 실측으로 확정한 것" 절이 `workflow`·`workspace` 두 테이블의 CASCADE 삭제를 나란히 "실측"으로 적었지만, 신규 e2e 는 `workflow` 삭제만 테스트한다(`workspace` 삭제 쿼리는 저장소 어디에도 없음, grep 0건). plan 의 실측 표는 정확한데 CHANGELOG 만 범위를 넓혔다. 이 문서 자체가 "이론이 아니라 쟀다"를 신뢰 근거로 내세우는 문서라 자기모순. | `CHANGELOG.md` (24번째 줄 부근) | (a) `workspace` 삭제 케이스를 실제 e2e 로 추가해 측정하거나, (b) 문장에서 "실측"을 `workflow` 로 한정하고 `workspace` 는 "같은 `onDelete: 'CASCADE'` 구조라 동일할 것으로 추정하나 별도 실측은 안 함"으로 명시 구분. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/concurrency/database | 이번 수정은 신규 취약점이 아니라 기존 보안 성격 lost-update(회전된 `notification_secret_v2`·정리된 `chat_channel_token_v2` 가 락 밖에서 되살아나는 경로)를 근본 차단하는 방향. e2e 로 실측 검증됨 | `triggers.service.ts:680-717` | 없음(방향 확인) |
| 2 | security | 저장 대상(`defined`)은 DTO 화이트리스트 필드만 담아 mass-assignment/IDOR 위험 없음. `id` 는 workspace-scoped `findOne` 결과에서 옴 | `triggers.service.ts:613-615, 679` | 없음(검증 완료) |
| 3 | performance | advisory lock 보유 시간은 `save()` 유지로 인해 이미 알려진 트레이드오프이며 이번 diff 로 신규 악화 없음. payload 크기는 오히려 줄어 방향은 중립~약간 긍정 | `triggers.service.ts:632-718` | 조치 불요 — PATCH 트래픽 증가 시 `lock_timeout` 관측 유지 |
| 4 | architecture/maintainability | `TriggersService.update()` 가 이미 11개 관심사를 가진 대형 메서드(219줄)인데 이번 PR 이 주석 28줄+코드 8줄을 더해 계속 커진다. 과거 분리 시도가 반환 엔티티·subscriber·UNIQUE 충돌 경로 회귀(단위 6건 RED)를 냈던 이력이 있어 신중해야 함 | `triggers.service.ts` `update()` 551-769행, 특히 680-717행 | 여유 있을 때 `buildTriggerUpdatePatch`/`applyWrittenTimestamp` 헬퍼 추출 검토(이번 PR 범위 밖, 1라운드에서 이미 defer) |
| 5 | architecture | 서비스 계층이 TypeORM `save()` 의 컬럼-diff 내부 동작(공식 계약 아닌 구현 세부사항)에 30줄 넘는 주석과 함께 직접 의존 | `triggers.service.ts:680-711` | 두 번째 호출부가 생기면 `TriggerRepository.savePartial()` 로 승격 검토(현재 유일 호출부, 급하지 않음) |
| 6 | architecture | `EntityManager.save()` 타입 시그니처(`Promise<Entity>`, 완전한 엔티티 약속)와 실제 런타임 모양(부분 객체를 넘기면 미지정 nullable 컬럼이 `null` 로 채워짐)이 불일치 — 이 PR 자체가 이 간극으로 회귀를 냈다가 e2e 로 잡아 수정 | `triggers.service.ts:711-716` | 조치 불요(현재 유일 호출부, 이미 방어·테스트됨). 팀 지식으로 남기려면 convention 문서에 한 줄 고려 |
| 7 | architecture | 신규 e2e 가 `createDbClient()` 와 별도로 동일 DB 접속 정보를 TypeORM `DataSource` 생성자에 재하드코딩(DRY) | `test/trigger-update-save-window.e2e-spec.ts:77-87` vs `test/helpers/db.ts` | `createTypeOrmDataSource(entities)` 헬퍼로 접속 파라미터 공유 검토(낮은 우선순위) |
| 8 | maintainability | Postgres SQLSTATE 매직 스트링(`'23503'`, `'23502'`)이 e2e 파일에 리터럴로 등장 — 1라운드 기지적, 비악화 재확인 | `test/trigger-update-save-window.e2e-spec.ts` ① describe 블록 | 처분 그대로 유지, 우선순위 상승 시 지역 상수화 |
| 9 | maintainability | 신규 e2e 의 두 helper(`saveAfterCascade`, `saveAfterColumnWrite`)가 유사 골격을 각자 재구현(의도적 명시성-중복 트레이드오프) | `test/trigger-update-save-window.e2e-spec.ts` | 세 번째 유사 helper 추가 시 공용 러너 추출 재검토 |
| 10 | api_contract/concurrency/database | `written.updatedAt` falsy 가드의 폴백 분기(재읽기 시점 stale timestamp 반환 가능)는 실제 경로 테스트 없음 — 실사용 경로는 e2e 로 항상 채워짐이 실측됨 | `triggers.service.ts:713-716` | 조치 불요. 여유 있으면 invariant 화 또는 로그 한 줄 |
| 11 | api_contract/database/requirement | FK CASCADE 삭제 경합의 SQLSTATE 가 23503→23502 로 바뀌었지만 `rethrowEndpointPathConflict` 가 미분기라 클라이언트는 여전히 일반 500 — 회귀 아님, planner 후속(`15-chat-channel.md §5.4`)으로 이미 이관 | `triggers.service.ts` `.catch((err) => this.rethrowEndpointPathConflict(err))` | 조치 불요(이미 트래킹됨) |
| 12 | requirement | `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ 문단("실측되지 않은 잔여")이 이 PR 로 이미 사실과 다름(코드는 부분 객체 저장으로 바뀌었고 e2e 로 실측 완료) — **[SPEC-DRIFT]** 구현이 spec 을 앞서갔고 spec 문구만 낡음 | `spec/2-navigation/2-trigger-list.md:203-205` | 코드 유지. planner 후속 PR 에서 ⚠️ 문단 교체(이미 plan "이 PR 이 안 하는 것" §1 에 등재) |
| 13 | side_effect | `TriggersService.update()` 응답이 락 밖에서 커밋된 컬럼에 대해 one-beat-stale 값을 반환하는 성격은 유지됨(원본 fix 커밋에서 도입, 이번 라운드 신규 아님) | `triggers.service.ts:680-717` | 조치 불요(이미 트래킹, planner 후속에서 계약 문서화 흡수) |
| 14 | side_effect | 공유 mock `withTransactionMock` 의 `save` 가 `undefined` 대신 항상 `target` 폴백 — 다른 필드 무가드 접근 회귀에 대한 TypeError 트립와이어가 약해짐(1라운드 기지적) | `trigger-transaction-mock.ts:125,131-132` | 조치 불요(1라운드 처분 유지) |
| 15 | 다수(requirement/side_effect) | 리뷰 진행 중 공유 워킹트리에서 `trigger-transaction-mock.ts` 에 대한 다른 reviewer 의 것으로 보이는 일시적 미커밋 뮤테이션을 2회 관측 — 이 diff 의 일부 아님, 원복하지 않음(규약 준수) | `trigger-transaction-mock.ts` (`withTransactionMock` 함수 본문) | 통합 단계에서 이 파일 대상 다른 산출물이 있다면 오염 가능성 감안해 대조 |
| 16 | scope/maintainability | `update()` 저장/응답 블록 hunk 의 실질 코드 변경은 8줄이지만 근거 설명 주석이 30줄 넘게 추가되어 메서드가 계속 비대해짐 — 1라운드에서 이미 defer 처리된 항목의 재확인 | `triggers.service.ts:680-717` | 조치 불요(이미 트래킹) |

## SPEC-DRIFT

| # | 발견사항 | 위치 | 처리 |
|---|----------|------|------|
| 1 | [SPEC-DRIFT] `spec/2-navigation/2-trigger-list.md §3` ⚠️ 문단이 "PATCH 의 기본 저장 경로(엔티티 통째 저장)"를 전제로 "CASCADE 창 실패 방식·락 밖 컬럼 경합이 확인되지 않았다"고 서술하지만, 이 PR 로 부분 객체 저장으로 전환되고 두 항목 모두 e2e(`trigger-update-save-window.e2e-spec.ts`)로 실측 완료됨. 구현이 spec 을 개선했고 spec 텍스트만 낡음 | `spec/2-navigation/2-trigger-list.md:203-205` | resolution-applier: 코드 revert 아님 — spec 갱신 경로로 라우팅. developer 권한 밖(spec 파일 수정 불가)이므로 이미 `plan/in-progress/trigger-save-partial-patch.md` "이 PR 이 안 하는 것" §1 에 planner 후속으로 등재됨. 이번 라운드는 spec 파일을 건드리지 않아 처리 정확 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. lost-update 수정이 보안 성격 회귀(secret 부활)를 차단하는 방향임을 확인 |
| performance | NONE | 쿼리 개수·루프·I/O 패턴 악화 없음. payload 축소로 방향은 중립~긍정 |
| architecture | LOW | 국소적 최소 침습 수정. `update()` 비대화·ORM 세부동작 의존·타입-런타임 불일치는 기존 이력의 연장 |
| requirement | LOW | 코드-문서 정합 라인 단위 확인 완료. SPEC-DRIFT 1건(이미 1라운드 수용·이관됨). 공유 워킹트리 뮤테이션 관측(무해) |
| scope | NONE | 30개 파일 전원이 단일 목적에 수렴. 불필요한 리팩터·기능확장·무관 파일 수정 없음 |
| side_effect | LOW | 신규 부작용 없음. 1라운드 disposition 이 값 자체를 바꾸지 않았음을 직접 diff 대조로 확인. 공유 워킹트리 뮤테이션 관측(무해) |
| maintainability | LOW | 핵심 변경은 작고 국소적. 남은 관측은 전부 기존 트래킹 항목의 연장이거나 낮은 우선순위 신규 관측 |
| testing | MEDIUM | 프로덕션 코드·핵심 회귀 테스트는 뮤턴트 직접 재현으로 검증 통과. 단, "60 RED" 재측정치는 재현 불가(64·68) — 문서 신뢰성 WARNING |
| documentation | LOW | 1라운드 지적 2건 정확히 반영 확인. CHANGELOG 의 "workspace 실측" 과장 1건 WARNING |
| database | LOW | 1라운드 WARNING(payload 이중 작성) 실제 해소 확인. 신규 DB 결함 없음 |
| concurrency | LOW | lost-update 근본 차단 확인, 형제 창 직렬화·되살리기 방지 유지. 신규 차단급 결함 없음 |
| api_contract | NONE | 엔드포인트·DTO·인가 무변경. breaking change 없음 |

## 발견 없는 에이전트

- security (INFO 외 실질 발견 없음 — NONE 위험도)
- performance (INFO 외 실질 발견 없음 — NONE 위험도)
- scope (INFO 1건 외 위반 사례 없음 — NONE 위험도)
- api_contract (INFO 2건 외 계약 변경 없음 — NONE 위험도)

## 권장 조치사항

1. **(WARNING 1)** `trigger-transaction-mock.ts` 의 뮤턴트 재측정치("60 RED")를 재현 가능한 형태로 재정의하거나, 최소한 뮤턴트의 정확한 반환값 형태를 각주에 명시해 다음 사람이 같은 조작을 재현할 수 있게 한다. 반복적으로 부정확했던 패턴(13→53→60)이므로 이번엔 코드화된 재현 스크립트를 우선 고려.
2. **(WARNING 2)** `CHANGELOG.md` 의 "함께 실측으로 확정한 것" 절에서 `workspace` 삭제를 실측 항목에서 빼거나, 실제로 e2e 에 `workspace` CASCADE 삭제 케이스를 추가해 측정한다.
3. **(SPEC-DRIFT, 이미 이관됨)** `spec/2-navigation/2-trigger-list.md §3` ⚠️ 문단 교체는 별도 planner 턴에서 처리 — 이번 라운드가 새로 만든 의무 아님, 진행 상황만 확인.
4. 나머지 INFO 항목은 전부 이미 트래킹되었거나 이번 PR 을 막을 사유가 아님 — 별도 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 diff 에 의존성 버전 변경 없음(router 판단, 코드 diff 로 재확인 시 `package.json`/`pnpm-lock.yaml` 무변경) |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음(router 판단) |