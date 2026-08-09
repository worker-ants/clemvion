# RESOLUTION — 14_36_39 (RolesGuard reflection 경화)

**Critical 0 · WARNING 6 · INFO 18 · risk MEDIUM.** router 가 9명 선별(forced 7 + architecture
+ api_contract), 9/9 리포트 확보 — `forced_missing=[]`, `unfinished=[]`. `requirement` 는
STATUS 라인 없이 끝났으나 리포트가 디스크에 있어 workflow 가 recover 했다.

**6건 전부 수정.** 가장 값 있던 둘(W5·W6)은 **내 테스트가 정작 중요한 지점을 비워 뒀다**는
지적이다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | requirement/documentation | `CHANGELOG.md` 의 plan 추적 링크가 이미 `complete/` 로 옮겨진 경로를 가리킴. **내가 그 줄을 편집하면서 옆의 stale 경로를 그대로 전파**했다. `spec-link-integrity` 가드는 `spec/**.md` 만 스캔해 CI 로도 안 잡힌다 | **수정.** `plan/complete/` 로 정정 |
| W2 | requirement | plan frontmatter `worktree: (unstarted)` 가 남아 구현이 끝난 plan 을 미착수로 표기 | **수정.** 실제 worktree 명 기입 |
| W3 | scope | plan 이동이 **같은 PR 에 든 자체 consistency checker 의 "본 worktree 권한 밖" 판정과 정반대**인데 오버라이드 사유가 없다 | **수정(근거 기재).** 그리고 **처음 쓴 근거가 틀렸다** — "그 worktree 는 회수됐다" 고 적었다가 `git worktree list` 로 확인하니 디스크에 있었다. 정확한 근거로 교체: worktree 는 있으나 `#1103` 머지로 작업이 끝나 **더는 PR 을 내지 않으므로** 권고대로면 아무도 옮기지 않는다(그 PR 이 이미 한 번 빠뜨렸고 그 결과가 깨진 링크다) |
| W4 | maintainability | 신설 `it.each` 가 **이중 호출 assert**(동일 인자로 `toThrow` 1회 + `getResponse()` 1회)를 씀 — 같은 PR 의 이웃 스펙이 "첫 단언이 실패하면 code 단언이 조용히 건너뛰어진다" 며 기각해 둔 패턴 | **수정.** 캡처-재던지기로 통일 |
| **W5** | testing | 이번 PR 이 연 400 throw 를 **프로덕션에서 가장 먼저 통과하는 지점이 전역 `APP_GUARD`** 인데 가드 레벨 테스트가 **전무**. util·데코레이터 스위트가 계약을 고정해도 가드가 그 예외를 삼키거나 403 으로 바꾸면 클라이언트 응답이 달라진다 | **수정.** 3건 추가 — `@WorkspaceId()` 라우트 · `@Roles()` 라우트(선재 결함 경로) · **403 이 아니라 400 임**(+ DB 미도달 단언, 그것이 22P02 마스킹을 막는 지점) |
| **W6** | testing | "전역 라우트는 헤더와 무관하게 통과" 테스트가 nil UUID(형식상 **유효**)를 써서 **vacuous** — "early-return 이 검증을 건너뛰었다" 와 "검증이 돌았고 통과했다" 를 구별 못 한다 | **수정.** 형식이 깨진 값으로 두 갈래를 가르는 테스트 추가 |

### 뮤테이션 — 새 테스트가 실제로 잡는지 실증

| 뮤턴트 | 결과 |
|---|---|
| 헤더 UUID 검증 제거(개정 전 동작 복원) | **10건 RED** (util 6 · guard 3 · decorator 1) |
| `handlerConsumesWorkspaceId` 단축을 헤더 파싱 **뒤로** 이동 | **정확히 1건 RED — 새로 넣은 그 테스트만.** 기존 nil UUID 테스트들은 전부 GREEN 으로 남았다. W6 이 "vacuous" 라고 한 것이 이 대비로 실증된다 |

원복은 `cp` + 절대경로로 했고(커밋 먼저 → 뮤테이션), 복원 후 `git status` clean + 345건 GREEN 재확인.

### 후속·미조치 (INFO 18건)

전부 조치 불요이거나 이미 문서화된 한계다. 판단이 필요했던 셋만 기록한다:

- **INFO 1** — 부팅 fail-closed 가 Node 의 `unhandledRejection` 기본 동작에 의존한다
  (`void bootstrap()`). `bootstrap().catch(log)` 로 흔한 리팩터를 하면 조용히 살아남는다.
  **지금은 의도대로 동작**하고(e2e 로 실증) 그 리팩터는 가정이지 결함이 아니라 두지만,
  캐너리 docstring 에 이 위임 관계가 적혀 있어 다음 사람이 알 수 있다.
- **INFO 4** — 캐너리 파일 위치(`common/decorators/` vs `common/config/`). 검증 대상
  바로 옆에 두는 편이 발견 가능성이 높다고 판단해 유지. reviewer 도 non-blocking 로 표기.
- **INFO 18** — backend `README.md` "배포 주의" 에 캐너리가 부팅을 멈출 수 있다는 사실이
  없다. **후속으로 남긴다** — 이 PR 은 이미 CHANGELOG·JSDoc·plan 세 곳에 적었고, README
  §배포 절은 별도 구조 정리가 필요한 상태라 여기서 손대면 범위가 흐려진다.

INFO 13·14(픽스처 상수 3파일 중복 · `WS1` 네이밍)은 다음 관련 PR 에서 공용 fixture 로
승격할 때 함께 본다 — 지금 옮기면 이 PR 의 diff 가 세 파일 더 늘어난다.

## TEST 결과

- lint : **PASS** (51s)
- unit : **PASS** (77s)
- build : **PASS** (144s)
- e2e : **PASS** (283s — backend jest 46 suites/261 + playwright 51, 로그 전수 확인)
  > 코드 변경이므로 면제 대상이 아니다(`PROJECT.md §e2e 면제 화이트리스트`).
- 부수 : `spec-link-integrity` 13 · `spec-plan-completion`(Gate C) 776 통과 — plan 이동 때문

## 보류·후속 항목

- backend `README.md` §배포 주의 에 부팅 캐너리 언급 (INFO 18) —
  `plan/in-progress/auth-guard-reflection-hardening.md` §후속 에 등재
- 워크스페이스 UUID 픽스처 공용 모듈 승격 (INFO 13·14) — 동 plan §후속
