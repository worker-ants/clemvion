# 요구사항(Requirement) 리뷰 — trigger-canary-hardening (라운드 5)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리,
④ e2e teardown 근거 정정)을 기준으로 실제 코드(파일 1~6)를 직접 열어 대조했다. 이 배치는
이미 `/ai-review` 4라운드(`11_27_40`→`12_37_01`)를 거쳤고 매 라운드 Critical 0 에 도달했으며,
그 사이 발견된 WARNING 은 전부 실측 뮤테이션으로 검증 후 수정됐다. 5라운드째인 이 리뷰는
(a) 그 이력이 실제로 반영돼 있는지, (b) 4라운드가 못 본 새 결함이 있는지를 코드·spec 원문을
직접 열어 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** 항목①(비밀 컬럼 3중 사본 가드) 정합성 실측 — 정본·사본 값이 실제로 일치하고, `MIRROR_SOURCES` 가 실제 사본 두 곳과 정확히 일치한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:12-27`(`CANONICAL_SOURCE`/`MIRROR_SOURCES`), `codebase/backend/src/modules/triggers/triggers.service.ts:104`(`TRIGGER_RESPONSE_STRIP_COLUMNS`), `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:24`, `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:45`
  - 상세: `grep -rn "TRIGGER_RESPONSE_STRIP_COLUMNS\|TRIGGER_SECRET_COLUMNS"` 로 저장소 전체를 훑어 정본 1곳 + 사본 2곳(합 3곳, self-spec 내 4번째 언급은 의도된 독립 대조군) 외에 다른 사본이 없음을 확인했다. 세 목록의 실제 값은 `['notificationSecretV2', 'chatChannelTokenV2']` 로 순서·값이 완전히 일치해 가드의 "현재는 일치" 전제가 참이다. `readStringArrayConst`(AST 언랩: `as`/`satisfies`/괄호)가 정본의 `as const satisfies readonly (keyof Trigger)[]` 형태와 사본의 `as const` 형태를 둘 다 올바르게 파싱함을 코드로 확인했다.
  - 판단: 결함 없음. 기능 완전성 충족.

- **[INFO]** 항목②(schedule `workflow` 양성 커버리지) — 새 단언 3곳(C-2·G·H)이 실제로 `workflow` 관계가 로드되는 코드 경로에 정확히 배치돼 있다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('C-2. ...')`, `it('G. ...')`, `it('H. ...')` 세 블록. 대응 서비스 코드: `codebase/backend/src/modules/triggers/triggers.service.ts:462`(`update()`) — 465행 `findById()`(342행에서 `relations: ['workflow']` 로드 확정) → G/H 는 `chatChannel` 필드를 보내지 않으므로(스케줄 타입은 §3 규칙상 `chatChannel` 자체가 `disallowed` — 481행) `if (chatChannel) {...}` 재조회 분기(564행)를 타지 않고 `result = saved`(그 안에 `workflow` 유지)가 그대로 응답된다.
  - 상세: `expectTriggerWorkflowRef(row/patch.body.data, { present: true, expectedWorkflowId })` 가 각 케이스에서 실제로 관계가 채워지는 응답에 걸려 있음을 직접 추적해 확인했다. plan 문서(§A.2)와 tracker(INFO#5, 라운드 4 RESOLUTION)가 "G·H 는 원래 회귀(chatChannel 재조회 시 relations 누락)의 정확한 재현은 아니고, schedule 타입은 PATCH 로 chatChannel 을 구조적으로 보낼 수 없어 더 일반적인 회귀만 지킨다"고 이미 정확히 처분했고, 코드 확인 결과 그 판단이 맞다.
  - 판단: 결함 없음. 의도(§3 계약: 목록·수정 응답의 `workflow` 유지)와 구현 일치.

- **[INFO]** spec fidelity — `3-schedule.md §4`·`2-trigger-list.md §3`·`secret-store.md §R4` 세 지점을 원문 대조.
  - 위치: `spec/2-navigation/3-schedule.md:153`(`trigger.workflow` 키 생략형, 양성3+음성1 註), `spec/2-navigation/2-trigger-list.md:182-197`(`TriggerDto.workflow` 키 생략형 註), `spec/conventions/secret-store.md:428`(§R4)
  - 상세: `3-schedule.md §4` 의 "양성 3 + 생성 음성 대조 1" 은 `ScheduleDto.trigger.workflow`(`expectNarrowedScheduleTriggerRef`) 축이고, 이번 배치가 새로 채운 것은 `TriggerDto.workflow`(`expectTriggerWorkflowRef`) 축이라 서로 다른 표면이다 — 코드 주석(`schedule-trigger.e2e-spec.ts:28-29`)이 이 구분을 정확히 적었고 spec 본문과 모순되지 않는다. `secret-store.md §R4` 는 `TriggersService.delete()` 라 적지만 실제 메서드명은 `remove()`(`triggers.service.ts:842`) — 이 spec 오탈자를 `trigger-workflow-ref.e2e-spec.ts` 의 새 JSDoc 이 "R4 는 프로덕션 삭제 경로 규율이고 그 경로(`remove()`→`deleteByPrefix`)는 R4 대로 동작한다"고 인용하면서 처음으로 명시적으로 드러냈는데, **코드가 아니라 spec 쪽의 기존 오탈자**이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3945` 에 planner 항목으로 등재돼 있다(권한 밖 — 이 reviewer 는 spec 수정 안 함).
  - 판단: 코드가 spec 을 어긴 것이 아니라 **spec 자체의 기존 오탈자를 코드 주석이 정확히 인용**한 것 — SPEC-DRIFT 아님(코드가 잘못 만든 drift 가 아니라 이미 planner 트래커에 정정 대기 중인 별개의 spec 오탈자). 추가 조치 불필요.

- **[INFO]** `secret_store` 고아 row 무해성 주장(2개 경계) 실측 재검증.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:153-167`(새 JSDoc 표), 근거 파일: `Makefile:52-61`(`e2e-down`/`e2e-test`), `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:37-91`
  - 상세: "`make e2e-test` 는 끝에 항상 `e2e-down`=`docker compose down -v`" 주장을 `Makefile` 에서 직접 확인 — `e2e-test:` 타깃이 `; STATUS=$$?` 패턴으로 실패해도 `$(MAKE) e2e-down`(`down -v --remove-orphans`)을 실행한다. "세션 안에서 `secret_store` 를 읽는 유일한 e2e 는 `secret-store-like-prefix`" 주장도 `grep -rn "FROM secret_store"` 로 저장소 전체를 훑어 확인 — 그 파일만 실제 `SELECT/DELETE ... secret_store` 쿼리를 실행하고, 모든 쿼리가 `ref LIKE $1`(자기 전용 `uniqueName('like')` 네임스페이스)로 스코프돼 있어 `chat-channel-trigger-create`/`trigger-workflow-ref` 가 남기는 `secret://triggers/<실제-trigger-uuid>/...` 형태의 고아 row 와 충돌하지 않는다.
  - 판단: 두 실측 주장 모두 코드로 재현 가능하고 정확하다. 결함 없음.

- **[INFO]** 캐너리 표기 통일(항목③) 잔존 여부 재검증.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
  - 상세: `grep -rnP '[①-⑪]' trigger-workflow-ref.spec.ts` 결과 0건(원문자 완전 제거 확인). `## 가드` 케이스 헤딩은 정확히 3개(`가드 3·5`, `가드 7`, `가드 9`) — plan 문서가 재실측으로 정정한 수치(2→3)와 일치.
  - 판단: 결함 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 미완성 마커 부재.
  - 위치: 변경된 6개 코드 파일 전체
  - 상세: `grep -n "TODO\|FIXME\|HACK\|XXX"` 결과 0건.

## 요약

이번 배치(트리거 비밀 컬럼 3중 사본 repo-guard 신설, `TriggerDto.workflow` schedule 양성 커버리지 3곳, 캐너리 주석 표기 통일, e2e teardown 근거 정정)는 4차례의 `/ai-review`를 거치며 실측 뮤테이션(가드 분기별 대조군, 계약 위반 시 RED 확인)으로 검증됐고, 이번 5라운드에서 핵심 주장(비밀 컬럼 값 일치, `workflow` 관계가 실제로 로드되는 코드 경로에 단언 배치, `secret_store` 무해성의 두 경계, 캐너리 표기 잔존 0건, Makefile의 `e2e-down` 보장)을 코드·설정 파일을 직접 열어 독립적으로 재현·확인했으며 전부 참이었다. spec 본문(`3-schedule.md`·`2-trigger-list.md`·`secret-store.md`) 대조 결과 코드가 spec 을 위반하는 지점은 없고, `secret-store.md §R4` 의 `delete()`/`remove()` 오탈자는 코드가 만든 drift 가 아니라 spec 쪽 기존 오탈자이며 이미 planner 트래커에 등재돼 있어 이 reviewer 의 조치 대상이 아니다. TODO/FIXME 류 미완성 마커도 없다. Critical/Warning 급 신규 발견사항 없음.

## 위험도

NONE
