# RESOLUTION — 감사 로깅 커버리지 갭 13개 액션

리뷰 **2라운드** 조치 기록.
- 1차 `review/code/2026/08/01/10_05_53` — Critical 2 · Warning 11 · risk HIGH
- 2차 `review/code/2026/08/01/10_49_18` — Critical 1 · Warning 11 · risk HIGH
  (1차 조치가 **새 결함을 만들었다** — 아래 R2 표)

## 조치 항목

| # | 등급 | 발견사항 | 조치 | commit |
|---|---|---|---|---|
| C1 | Critical | 서비스 시그니처에 필수 `userId` 를 추가하면서 기존 spec 호출부 **70곳**을 갱신하지 않아 `tsc --noEmit` 이 TS2554 로 깨졌다. `tsconfig.build.json` 이 `**/*spec.ts` 를 exclude 하고 ts-jest 는 `isolatedModules` 라 lint/unit/build 어느 게이트도 못 잡는다 | 70곳에 더미 `userId` 추가. **잔여 20건은 기존 오류** — `cp` 로 `origin/main` 판을 놓고 재측정하니 23건이라 오히려 3건 줄었다 | `f77c1e0de` |
| C2 | Critical | `triggers` create/update(4) · `workflows` update/remove · `schedules` update/remove 의 `recordAudit` 호출이 무검증. 리뷰어가 해당 호출부를 지우고 재실행해 전부 통과함을 실증 | 8곳 전부에 회귀 테스트 추가. 뮤턴트 8종(각 기록 제거) 전부 RED 확인 | (본 커밋) |
| W5 | Warning | `triggers` create/update 가 chatChannel 분기별로 `recordAudit` 을 2회씩 호출 — `details` 필드를 늘릴 때 한쪽만 고치는 drift 위험 | `result` 변수로 통합해 1회 호출 | 〃 |
| W6 | Warning | `triggers`/`schedules` 는 DB 커밋과 감사 사이에 실패 가능한 외부 호출(secret store rotate, BullMQ `registerJob`/`removeJob`)이 끼어 있었다 — 그게 터지면 리소스는 생겼는데 감사가 안 남는다. `model-config`/`workflows` 에서 지킨 "커밋 직후" 불변식을 같은 PR 안에서 두 모듈만 어긴 셈 | 4개 지점 전부 **커밋 직후**로 이동. chatChannel 재조회는 응답 형태만 바꾸므로 감사 내용에 영향 없음을 주석에 명시 | 〃 |
| W9 | Warning | `workflows.service.spec` 의 트랜잭션 순서 테스트 2건이 공유 mock 을 본문 마지막 줄에서만 복원 — 중간 `expect` 가 실패하면(즉 이 테스트가 잡으려는 회귀가 실제로 났을 때) 복원이 안 돼 오염이 번진다 | `try/finally` 로 복원 이동 | 〃 |
| W10 | Warning | `triggers.service.spec` 감사 describe 의 죽은 코드 5줄(`const idx = ... as never; void idx;`)과 어긋난 주석 | 삭제 + 주석 정정 | 〃 |
| W2 | Warning | `CHANGELOG.md` 기재 누락 | `## Unreleased` 항목 추가 (신규 13액션 · 시제 근거 · 커밋 직후 기록 원칙 · `workflow.executed` 제외 사유) | 〃 |

### 2라운드 (`10_49_18`) 조치

| # | 등급 | 발견사항 | 조치 |
|---|---|---|---|
| R2-C1 | **Critical** | 1차 조치로 추가한 `schedules.service.spec` 감사 테스트가 `UpdateScheduleDto` 를 **import 없이** 참조해 `tsc` 신규 오류(TS2552). **1차 C1 과 정확히 같은 결함 클래스**(spec 파일의 타입 안전망 훼손)가, 그 수정 대상이 아니던 내 새 블록에서 재발했다. `RESOLUTION.md` 의 "tsc 오류 0건" 자체 검증 주장과도 상충 | import 추가 + 재측정 |
| R2-W5 | Warning | **이 RESOLUTION 이 존재하지 않는 커밋 해시(`2a1f8c1`)를 인용했다.** 서술 내용은 실제 커밋(`f77c1e0de`)과 일치하나 해시만 창작 — 감사 추적 문서의 근거가 `git show` 로 재현 불가능해졌다 | 실제 해시로 정정. 이후 커밋 직후 `git log --oneline -1` 로 확인 |
| R2-W4 | Warning | plan §4.1 이 "구현 완료" 문장 뒤에 옛 "import 0건" 본문을 그대로 남겨 자기모순 | 과거 시제·이력 표기로 전환 |
| R2-W6 | Warning | 감사와 무관한 `notification-config.dto.ts` 타입 단언 제거 hunk 가 `eslint --fix` 로 유입돼 1차에서 지적됐는데도 추적 누락 | **되돌림** (`origin/main` 대비 0줄 확인). lint 는 warning 이라 PASS 유지 |
| R2-W9 | Warning | W6("커밋 직후 기록") 불변식이 `triggers`/`schedules` 는 코드로만 맞춰져 있고 순서 회귀 테스트가 없었다 — 리팩터링이 되돌려도 GREEN | `order: string[]` 순서 테스트 2건 추가. 뮤턴트(기록을 secret/BullMQ 뒤로 되돌림) 둘 다 RED |
| R2-W11 | Warning | chatChannel 분기의 이중 `recordAudit`(1차 W5 실버그) 회귀를 잡을 테스트 부재 — 단언 테스트가 전부 chatChannel 없는 입력만 썼다 | `trigger.created` 호출 **횟수**를 세는 테스트 추가 |

### 3라운드 (`11_35_19`) 조치

3차는 Critical 0 · Warning 2. **다만 이 라운드는 코드를 보지 않았다** — `origin/main` 이
작업 중 10커밋 전진(dependabot 7건 + `#1057` + **`#1058` typescript 7.0.2→5.x 롤백**)해
diff base 가 stale 이 됐고, 그 탓에 changeset 이 리뷰 산출물 문서로 채워져 라우터가
`documentation` 1명만 골랐다. 코드 수렴 근거로는 쓸 수 없어 rebase 후 재리뷰했다.

| # | 등급 | 발견사항 | 조치 |
|---|---|---|---|
| R3-W1 | Warning | consistency checker 산출물 2건(`naming_collision.md`·`rationale_continuity.md`)에 하네스 반환 프로토콜 봉투(`STATUS=…` / `===REPORT_MARKDOWN_BELOW===`)가 영구 리포트 본문에 유출 | 봉투 제거 — 나머지 3개처럼 `#` 제목으로 시작 |
| R3-W2 | Warning | 같은 세션 `_retry_state.json` 이 `--prepare` 스냅샷(5개 전부 pending)으로 커밋돼 `SUMMARY.md`(5/5 완료)와 모순 | `--sync-from-disk` 로 재조정 (success=5 pending=0) |
| R3-INFO1 | Info | diff 에 무관한 리뷰 세션이 "삭제" 로 표시 | **병렬 세션 머지가 원인으로 확정** — `origin/main` 에 해당 세션이 존재. rebase 로 해소 |

**교훈**: 리뷰 diff base 는 `origin/main` 을 쓰더라도 **그 시점의** origin/main 이다.
장시간 작업 중에는 라운드마다 `git fetch` 로 전진 여부를 확인하고, 전진했으면 rebase 후
리뷰해야 한다 — 아니면 라우터가 엉뚱한 changeset 을 보고 "코드 무관" 으로 판정한다.

### 4라운드 (`12_06_37`) 조치 — **처음으로 코드를 제대로 본 라운드**

3차가 코드를 못 본 원인은 rebase 로 다 풀리지 않았다. `--prepare --branch origin/main` 이
**직전 라운드가 본 파일을 제외**해 changeset 이 리뷰 산출물 12건뿐이었고 codebase 는 0건이었다
(meta.json 실측). `git diff --name-only origin/main...HEAD -- codebase/` 로 19개 파일을 **명시
지정**해 다시 준비하니 forced 가 6명으로 정상화됐다. 그 상태에서 나온 것이 아래다.

> 이 확인이 없었으면 3차의 "Critical 0" 을 코드 수렴 근거로 오독해 검증 없이 PR 을 올렸을 것이다.
> 라우터가 `documentation` 1명만 고른 것이 신호였다.

| # | 등급 | 발견사항 | 조치 |
|---|---|---|---|
| R4-C1 | **Critical** | `TriggersService.update()` 에서 `syncScheduleActivation()`(BullMQ 외부 호출)이 `recordAudit` 보다 **먼저** 실행 — 같은 함수의 다른 두 외부 호출은 원칙대로 뒤에 두고 **이 하나만** 앞에 남아, schedule 타입 + `isActive` 변경 경로에서만 W6 불변식이 깨져 있었다. `registerJob` 이 throw 하면 트리거는 커밋됐는데 감사가 유실된다. 기존 테스트는 이 조합을 안 태운다(감사 테스트는 webhook 타입만 씀) | 순서 교정 + 조합 회귀 테스트. 결함 복원 뮤턴트 RED |
| R4-W1 | Warning | `importWorkflow()` 가 새 Workflow 를 만드는데 감사 미기록 — `create`/`duplicate` 와 비대칭 | **기록 추가**(`details.imported`). 1차에 `saveCanvas` 와 묶어 미룬 게 잘못이었다 — 카디널리티 논거는 캔버스 편집마다 발동하는 `saveCanvas` 에만 해당하고 import 는 이산적 생성 이벤트다 |
| R4-W2 | Warning | W6 순서 가드가 `create()` 에만 있고 `update()` 에 없음 | schedules·triggers `update()` 순서 테스트 추가. 뮤턴트 RED |
| R4-W4 | Warning | `Schedule`↔`Trigger` 상호 직접 쓰기가 상대 리소스 감사를 건너뜀. **직전 라운드에서 발견됐으나 RESOLUTION 어느 표에도 흡수되지 않고 유실** | **설계로 확정하고 `audit-action.const.ts` 에 명문화** — 감사는 호출된 엔드포인트의 리소스 기준이며, 양쪽을 다 남기면 한 번의 조작이 2행으로 보여 "누가 트리거를 따로 건드렸나" 를 되묻게 만든다 |
| R4-W5 | Warning | `duplicate()` 의 커밋-뒤-기록 불변식에 순서 테스트 없음 | 순서 테스트 추가. 뮤턴트 RED |
| R4-W7 | Warning | `AuditLogDto.action` Swagger 설명이 신규 13액션 미반영 | 열거를 **SoT 참조로 전환** — 이미 `workspace.*`·`member.*`·`user.*` 때부터 낡아 있었다. 목록 복제를 끊는 게 근본 조치 |

미조치: R4-W3(컨트롤러 `userId` 배선 검증 비일관 — 1차 W8 과 동일, 아래 표) ·
R4-W6(`recordAudit` 중복 — 1차 W4 유예 유효) · R4-W8(SPEC-DRIFT — planner 턴, 이미 등재).

### 5라운드 (`12_44_54`) — **수렴**

Critical 1 · Warning 4. **Critical 은 SPEC-DRIFT 하나뿐이고 코드 조치 대상이 아니다** —
`developer` 는 `spec/` read-only 이며 planner 턴으로 이미 등재돼 있다. 코드 자체는
security · concurrency · database · api_contract · dependency · scope 전 관점에서
**NONE~LOW** 로 수렴했다.

| # | 등급 | 발견사항 | 조치 |
|---|---|---|---|
| R5-C1 | Critical | **[SPEC-DRIFT]** spec 4곳이 구현 완료된 13액션을 여전히 "Planned/미구현" 으로 서술. `AuditLogDto` Swagger 가 그 stale 한 §4.1 을 참조해 외부 소비자가 "아직 없는 기능" 으로 오인할 수 있다는 노출 경로가 CRITICAL 판정 근거 | **코드 조치 불요 — planner 턴.** `plan/in-progress/spec-sync-auth-gaps.md` 에 파일·줄번호까지 등재됨. Swagger 쪽은 4차에 이미 SoT 참조로 바꿔 열거 의존을 끊었다 |
| R5-W1 | Warning | `model-config` 의 `isDefault:true` 트랜잭션 경로(create/update)가 감사 테스트 미방문 — `setDefault` 에만 순서 테스트가 있었다 | `create(isDefault:true)` 순서 테스트 추가. 뮤턴트 RED |
| R5-W3 | Warning | `triggers` 만 "저장 실패 시 감사 미기록" 불변식 테스트 부재 — 자매 3개 모듈은 보유. 하필 순서 버그(4차 C1)가 났던 파일 | create/update 실패 테스트 추가. 기록을 `save` 앞으로 옮기는 뮤턴트 RED |
| R5-W2 | Warning | 컨트롤러 `userId` 배선 검증 비일관 | **미조치** — 1차 W8 부터 이월. 서비스 레벨이 `userId` 를 단언하고 배선 자체는 타입이 강제한다(인자 누락 시 TS2554). `schedules.controller.spec` 신설은 후속 |
| R5-W4 | Warning | `recordAudit` 5곳 중복 | **미조치** — 1차 W4 의 "6번째 리소스 추가 시점" 유예 유효. `details` shape 이 도메인별로 갈리는 현재 조기 추상화는 인터페이스를 어색하게 만든다 |

**수렴 판정**: 라운드 1→5 에서 발견의 성격이 *동작 결함 → 구조 → 테스트 커버리지 → 문서 동기화*
로 이동했고, 5차의 유일한 Critical 은 코드가 아니라 spec 표기다. 코드 관점 6개가 모두 NONE~LOW.

### 미조치 — 근거

| # | 등급 | 항목 | 사유 |
|---|---|---|---|
| W1 | Warning | **[SPEC-DRIFT]** spec SoT 4곳(`1-auth.md §4.1` · `1-audit.md §1.1` · `conventions/audit-actions.md §3` · `2-navigation/2-trigger-list.md`)이 구현 완료된 13개 액션을 여전히 "Planned/미구현" 으로 서술. `2-trigger-list.md` 는 `trigger.delete` 액션명 오기까지 있다 | **`developer` 는 `spec/` read-only** — planner 턴 필요. impl-prep consistency(`09_11_58`)가 이미 "4곳 동시 갱신" 을 예견·권고했고 그 판단은 유효하다. PR 본문과 plan 에 인계로 명시했다. `workflow.executed` 만 Planned 잔류가 맞으므로 일괄 승격이 아니라 분리가 필요하다 |
| W3 | Warning | `saveCanvas`/`restoreVersion` 에 `workflow.updated` 미기록 | `saveCanvas` 는 캔버스 편집마다 발동해 `workflow.executed` 와 같은 카디널리티 논점(보존 정책 미정)을 공유한다. spec §4.1 이 약속한 것은 액션 이름이고 어느 진입점에서 기록할지는 별도 판단이다. plan 후속으로 등재<br>**(6차 정정)** 이 행은 원래 `importWorkflow` 도 미조치로 묶었으나 **4차 W1 에서 이미 조치됐다**(`workflows.service.ts:582`, `details: { imported: true }`). 카디널리티 논거는 `saveCanvas` 에만 적용되는데 묶어서 유예한 것이 원래의 오분류였고, 4차에 그 오분류를 바로잡고도 이 표를 갱신하지 않아 미조치로 남아 있었다 |
| W4 | Warning | `recordAudit` 래퍼가 5개 서비스에 반복 | **(6차 근거 정정)** 원래 근거는 "6번째 리소스 추가 시점에 재검토" 였는데 **이미 5개**라 곧 자기모순이 된다. 실제 근거는 축 발산이다 — 5개 helper 의 `details` 계약이 전부 다르다(workflows=passthrough · triggers=`{type}` · schedules=없음 · model-config=`{kind}` · auth-configs=`ipAddress`). 공통분모는 `resourceType` 바인딩 + 6필드 기계적 전달뿐이라, 그걸 뽑아도 **타입 있는 per-service 래퍼는 그대로 남는다**. 이득은 서비스당 ~4줄이고 새 모듈이 하나 생긴다. 6차 리뷰어의 "유예 사유가 약하다" 는 지적은 옳았고(근거가 틀렸으므로) 근거를 교체했지만, 결론은 유지한다 |
| W7 | Warning | 동시 삭제 시 중복 `*.deleted` 감사 행 가능 | 기존 `auth-configs` 패턴이 확장 복제된 것으로, 이번 PR 이 만든 회귀가 아니다. `Repository.delete()` + `affected` 판정으로 바꾸는 것은 4곳 + 기존 1곳의 삭제 시맨틱을 함께 바꾸는 변경이라 별도 트랙이 맞다. audit 은 append-only 라 중복 행이 조회를 깨지도 않는다 |
| W8 | Warning | 컨트롤러 `userId` 배선 검증 비일관 (`schedules.controller.spec` 부재 등) | ~~부분 조치 — 배선 자체는 타입으로 강제된다(인자 누락 시 TS2554)~~ → **6차에서 전량 조치**. 유예 근거가 틀렸다: TS2554 는 인자 *누락* 만 잡고 **동일 타입 인자의 스왑은 못 잡는다**(실측 §6차). 아래 6차 항 참조 |

## 6차 리뷰 (`review/code/2026/08/01/13_13_09`) — Critical 0 / Warning 2

5차 이후 델타가 `.spec.ts` 3개 · **프로덕션 코드 0줄** 이라 `REVIEW_AGENTS=testing,maintainability`
로 범위를 맞춰 실행했다. 결과 Critical 0, Warning 2 — 둘 다 이월된 유예 항목이다.

| # | 등급 | 항목 | 조치 |
|---|---|---|---|
| W1 | Warning | 컨트롤러→서비스 `userId` 배선 단위 테스트 부재 (4개 모듈) | **조치** — 아래 |
| W2 | Warning | `recordAudit` 헬퍼 5중복, 유예 사유가 약함 | **유예 유지 + 근거 교체** (미조치표 W4) |

### W1 — 4라운드 미룬 항목을 닫았다. 유예 근거가 사실이 아니었다

그동안의 근거는 "배선은 타입이 강제한다(TS2554)" 였다. **틀렸다.** TS2554 는 인자 *누락* 만
잡는다. `create(workspaceId, dto, userId)` 는 1·3번째가 **둘 다 `string`** 이라 서로 바꿔도
컴파일이 통과한다 — 실측으로 `schedules.controller.ts` 의 호출을 스왑한 뒤 `tsc --noEmit` 을
돌려 **오류 0건**을 확인했다. 그리고 스왑된 상태에서도 감사 행은 정상적으로 적재된다. 즉
workspace 와 actor 가 통째로 뒤바뀐 **조용히 틀린 감사**가 되고, 서비스 레벨 spec 은 이미 들어온
값을 볼 뿐이라 이 스왑을 관측할 수 없다. 경계에서 위치까지 단언해야 잡힌다.

- `schedules.controller.spec.ts` **신규** (파일 자체가 없었다) — create/update/remove
- `triggers.controller.spec.ts` — create/update/remove 배선 describe 추가
- `workflows.controller.spec.ts` — create/duplicate/importWorkflow/update/remove
- `model-config.controller.spec.ts` — create/setDefault 보강 (update/remove 는 기존)

**집계 오류를 한 번 냈다.** 처음엔 `userId` 철자만 grep 해 12곳으로 세고 "전수 커버" 라고 적었는데,
`user.sub` 를 넘기는 workflows `create`/`duplicate`/`importWorkflow` 3곳이 빠져 있었다. 철자
무관 패턴(`userId|user\.sub`)으로 재집계해 18곳을 찾았고, 그중 **감사 기록 대상 15곳을 전수**
커버했다. 나머지 3곳(`findAll`·`saveCanvas`·`runNow`)은 감사를 기록하지 않는다.

**뮤턴트 13종 전부 RED**: 인자 스왑 10 + `userId` 자리에 `id` 재전달 3. 매 건 치환 전에 앵커
존재를 단언했다(치환 실패는 GREEN 으로 보인다).

**수렴 판정**: 6차의 Critical 은 0이고, Warning 2건은 새 발견이 아니라 이월 유예 항목이다.
그중 하나(W1)는 **유예 근거가 반증돼 조치**했고, 다른 하나(W2)는 근거를 교체하되 결론을
유지했다. 새로운 동작 결함은 3라운드째 나오지 않았다.

## 7차 리뷰 (`review/code/2026/08/01/13_46_48`) — Critical 1(diff 밖) / Warning 8

6차 이후 코드가 바뀌어 push 게이트가 막았으므로(정상 동작), 브랜치 델타 23파일을 **명시 경로**로
넘겨 전수 재리뷰했다. reviewer 11명 성공, forced 6명 전원 산출물 확보. `summary` sub-agent 만
세션 한도로 실패해 **SUMMARY.md 는 main 이 11개 리포트를 읽어 직접 작성**했다.

### Critical 1건 — 이번 PR 소산이 아님을 실측 확인 후 별도 트랙 분리

`security` 가 `@Roles()` 미부착 라우트의 워크스페이스 멤버십 검증 누락(cross-tenant 접근)을
CRITICAL 로 보고했다. **리뷰어 주장을 액면으로 받지 않고 직접 재현했고, 결함은 실재한다**:
`RolesGuard.canActivate` 가 `requiredRoles` 가 비면 `return true` 로 조기 반환해 `getMemberRole`
이 실행되지 않고, 멤버십을 보는 다른 가드가 없으며, `@WorkspaceId()` 데코레이터는 자체 주석에서
"헤더 스푸핑은 RolesGuard 가 차단한다" 고 그 가드에 의존한다고 적어 두었다.

동시에 **이 PR 소산이 아님**도 실측했다 — 이 PR 은 `common/guards/` 를 변경하지 않았고,
지적된 핸들러(`rotateBotToken`·각 `findAll`/`findOne`)는 전부 diff 밖이며, `origin/main` 에도
`@Roles` 가 없다. 감사 로깅과 묶어 고치면 범위가 뒤섞이고 올바른 조치(전수 조사 +
`RolesGuard` 재구성)가 이 PR 보다 크다 → **별도 세션으로 분리**했다.

### Warning 8건

| 관점 | 항목 | 조치 |
|---|---|---|
| architecture + maintainability | `recordAudit` 의 `action` 타입을 4개 파일이 인라인 재정의 (`AuditAction` 이 이미 export 돼 있고 auth-configs 는 사용 중) | **조치** — `AuditActionFor<P>` 로 리소스별 한정 |
| testing | `duplicate` 롤백 · `importWorkflow` 순서/롤백 테스트 부재 | **조치** — 3건 추가 |
| requirement ×4 + documentation ×1 | SPEC-DRIFT (spec SoT 5곳) | **planner 인계** — `developer` 권한 밖, 이미 추적 중 |

**타입 한정은 단순 치환 이상이다.** 전체 34개 합집합을 받으면 `resourceType` 은 서비스마다
고정인데 `WorkflowsService` 에 `'trigger.deleted'` 를 넘겨도 컴파일이 통과해 `resourceType`
과 action 이 모순된 감사 행이 만들어진다. 정합성을 주석에서 타입으로 옮겼다 — 교차-도메인
대입 3종 전부 `tsc` RED 확인.

**testing 지적은 실제보다 넓었다** — `duplicate` 의 순서 테스트는 이미 있었다. 실측으로 갭을
좁혀 필요한 3건만 추가했고, 각 테스트가 **개별적으로** 뮤턴트를 잡는 것까지 확인했다
(`failed=1 skipped=89`).

### 뮤턴트 검증 중 무효 뮤턴트를 하나 만들었다

`return savedWorkflow;` 가 `create`·`importWorkflow` 두 곳에 있어 `replace(..., 1)` 이
`create` 를 건드렸고, 그 결과 롤백 테스트를 **vacuous 로 오판**했다. 유일 앵커로 다시 돌려
RED 를 확인했다. 기존 교훈("앵커 존재를 먼저 단언")을 **"존재 + 유일성"** 으로 강화한다.
부수적으로 유효성 단언 자체도 한 번 틀렸다 — `duplicatedFrom` 이 주석에도 있어 개수 기준이
과했다. 개수보다 **"밖에서 사라지고 안에 생겼는가"** 를 봐야 한다.

**수렴 판정**: 이번 PR 이 만든 Critical 0. 코드 Warning 3건은 조치 + 뮤턴트 검증 완료.
나머지 5건은 spec 영역. 발견의 성격이 *동작 → 구조 → 테스트 → 타입 정밀도 → 문서* 로
이동했고, 7차의 코드 지적은 전부 "더 좁힐 수 있다" 류이지 오동작이 아니다.

## TEST 결과

- **lint**: PASS
- **unit**: PASS
- **build**: PASS
- **e2e**: **통과** — backend jest 46 suites / 260 tests + frontend playwright 51 passed
- **대상 모듈 유닛**: 439건 중 438 통과 / 1 skip — 6차에서 **+13** (HEAD 기준선 426 실측 후 대조)
- **타입체크**: `tsc --noEmit` 에서 내 변경이 만든 오류 0건 (잔여는 `origin/main` 대비 감소 확인)
- **뮤턴트**: 총 17종 전부 RED — 기록 제거 8 · 트랜잭션 안으로 이동 2 · 삭제 후 필드 읽기 2 · `duplicatedFrom` 제거 1 · 그 외 4

**뮤턴트가 제 테스트 2건을 vacuous 로 판정해 고쳤다**: 트랜잭션 경계를 `'tx-start'` 만 찍어 기록이
안으로 들어가도 순서가 같았고, 롤백 테스트는 콜백을 아예 호출하지 않아 안쪽 기록이 실행될 기회가
없었다. 양쪽 경계를 찍고 본문 실행 후 throw 하는 형태로 고쳤다.

**뮤턴트 1종은 앵커 오타로 무효였다** (T-update). 문자열을 바로잡아 재실행해 RED 확인했다 —
치환 실패가 GREEN 으로 보이는 형태라 매번 앵커 존재를 먼저 단언한다.

## 보류·후속 항목

`plan/in-progress/spec-sync-auth-gaps.md` 에 등재:

- **spec SoT 4곳 동기화 (planner 턴)** — W1. 13개 액션을 "구현된 액션" 으로 이동,
  `workflow.executed` 만 Planned 잔류, `2-trigger-list.md` 액션명 오기 정정.
- **`workflow.executed`** — 보존 정책(`audit_log` pruner 부재) 결정과 묶어 별도 판단.
- `saveCanvas`/`restoreVersion` 감사 (W3 — `importWorkflow` 는 4차에 조치 완료),
  `recordAudit` 공통 팩토리 (W4/6차 W2), 삭제 중복 감사 (W7) — 전부 우선순위 낮음으로 기록.
  **컨트롤러 spec 보강(W8)은 6차에서 종결**되어 후속 목록에서 제외한다.
