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

### 미조치 — 근거

| # | 등급 | 항목 | 사유 |
|---|---|---|---|
| W1 | Warning | **[SPEC-DRIFT]** spec SoT 4곳(`1-auth.md §4.1` · `1-audit.md §1.1` · `conventions/audit-actions.md §3` · `2-navigation/2-trigger-list.md`)이 구현 완료된 13개 액션을 여전히 "Planned/미구현" 으로 서술. `2-trigger-list.md` 는 `trigger.delete` 액션명 오기까지 있다 | **`developer` 는 `spec/` read-only** — planner 턴 필요. impl-prep consistency(`09_11_58`)가 이미 "4곳 동시 갱신" 을 예견·권고했고 그 판단은 유효하다. PR 본문과 plan 에 인계로 명시했다. `workflow.executed` 만 Planned 잔류가 맞으므로 일괄 승격이 아니라 분리가 필요하다 |
| W3 | Warning | `saveCanvas`/`importWorkflow`/`restoreVersion` 에 `workflow.updated`/`created` 미기록 | 타당한 지적이나 **이번 PR 이 선언한 범위(서비스 CRUD 4메서드) 밖**이다. spec §4.1 이 약속한 것은 액션 이름이고, 어느 진입점에서 기록할지는 별도 판단이다 — 특히 `saveCanvas` 는 캔버스 편집마다 발동해 `workflow.executed` 와 같은 카디널리티 논점(보존 정책 미정)을 공유한다. plan 후속으로 등재 |
| W4 | Warning | `recordAudit` 래퍼가 5개 서비스에 반복 | 리뷰어도 "6번째 리소스 추가 시점 권장" 으로 즉시 필수가 아니라고 판단. 지금 추상화하면 4개 구현이 각자 다른 `details` 스키마를 갖는 상태에서 조기 일반화가 된다 |
| W7 | Warning | 동시 삭제 시 중복 `*.deleted` 감사 행 가능 | 기존 `auth-configs` 패턴이 확장 복제된 것으로, 이번 PR 이 만든 회귀가 아니다. `Repository.delete()` + `affected` 판정으로 바꾸는 것은 4곳 + 기존 1곳의 삭제 시맨틱을 함께 바꾸는 변경이라 별도 트랙이 맞다. audit 은 append-only 라 중복 행이 조회를 깨지도 않는다 |
| W8 | Warning | 컨트롤러 `userId` 배선 검증 비일관 (`schedules.controller.spec` 부재 등) | 부분 조치 — `model-config` 의 `update`/`remove` 는 이미 단언한다. 나머지는 서비스 레벨 테스트가 `userId` 를 단언하고 있어 배선 자체는 타입으로 강제된다(인자 누락 시 TS2554). 신규 spec 파일 생성은 후속 |

## TEST 결과

- **lint**: PASS
- **unit**: PASS
- **build**: PASS
- **e2e**: **통과** — backend jest 46 suites / 260 tests + frontend playwright 51 passed
- **대상 모듈 유닛**: 425건 통과 (감사 전용 17건 포함)
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
- `saveCanvas`/`importWorkflow` 감사 (W3), `recordAudit` 공통 팩토리 (W4),
  삭제 중복 감사 (W7), 컨트롤러 spec 보강 (W8) — 전부 우선순위 낮음으로 기록.
