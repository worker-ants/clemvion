# 변경 범위(Scope) Review

## 조사 방법

프롬프트에 실린 51개 파일(다수는 diff 가 크기 제한으로 생략됨)을 검토하고, `git log --oneline`
(`ead37afd4`..HEAD, 11개 커밋)과 각 커밋의 `git show --stat`/`git show`를 직접 열람해 어느 커밋이
어느 파일 조합을 건드리는지 확인했다. 저장소를 뮤테이션하지 않았다 — `Read`/`Grep`/`git log`/
`git show`/`git blame` 만 사용.

**관측 사항(뮤테이션 아님, 내가 만들지 않음)**: 조사 중 `git status --short` 로 확인한 결과
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 에 미커밋 변경 1건이
있었다 — `_scope_delta_census` 의 `diff_lines = diff_text.count("\n") if diff_text.strip() else 0`
가 `diff_lines = 999999  # MUTATION` 으로 바뀌어 있다. 이는 병렬 fan-out 중인 다른 reviewer(아마
testing 관점)의 진행 중 뮤테이션으로 보인다 — 프롬프트가 경고한 상황과 정확히 일치한다. 되돌리지
않았다(내가 만든 변경이 아니고, 원복 여부는 그 reviewer 의 책임 범위다). 이 리뷰의 판정에는
영향을 주지 않았다(정적 diff/커밋 이력만으로 판단).

## 발견사항

- **[WARNING]** `spec/**` 파일을 직접 편집하는 커밋 2건(및 그 후속 fix 커밋 2건 안에 포함된
  spec 편집)이 CLAUDE.md 의 "자기-반증형 소정정" 좁은 예외 조건을 충족하지 못한 채 존재한다.
  - 위치: 커밋 `d743251b0`(`spec/5-system/14-external-interaction-api.md` §8.2 HMAC 알고리즘
    화이트리스트 정정, 이 프롬프트의 **파일 49 게이트 949~951줄**) · 커밋 `50caf1a85`
    (`spec/5-system/6-websocket-protocol.md` §4 절 재배치, 이 diff 는 크기 제한으로 프롬프트에
    실리지 않아 게이트 인용 불가 — `git show 50caf1a85 -- spec/5-system/6-websocket-protocol.md`
    로 직접 확인). 후속 커밋 `0883c4e43`·`f3ece1fc6` 도 같은 spec 파일들의 bare-prose 인용
    정정을 포함한다(파일 49 게이트 1125줄, 파일 51 게이트 2196·2205·2214·2217줄 등).
  - 상세: CLAUDE.md 는 "`spec/` 변경 → `project-planner`"를 원칙으로 하고, developer 가
    `spec/`을 직접 고칠 수 있는 유일한 예외("자기-반증형 소정정")는 다섯 조건을 **전부**
    요구한다. 이번 두 편집은 최소 두 조건에서 문면상 불충족이다.
    1. **조건 2("예고·트리거만, 제품 정의·요구사항·API 계약은 해당 없음") 불충족** —
       `d743251b0`이 고친 문장(`algorithm whitelist: hmac-sha256 만` → `hmac-sha256`/
       `hmac-sha512`)은 웹훅 서명 검증 알고리즘 화이트리스트, 즉 명백한 **API 계약** 내용이다.
       예고 문장(추후 구현 예정을 알리는 문장)이 아니라 현재 검증 로직의 계약 자체를
       서술하는 문장이라 이 예외의 적용 대상이 아니라고 CLAUDE.md 가 명시한다.
    2. **조건 1("developer 자신이 그 문서에 썼다") 근거 없음** — `git log -S'algorithm
       whitelist: \`hmac-sha256\` 만' -- spec/5-system/14-external-interaction-api.md` 로
       원문을 추적하면 커밋 `9ed6e6305`("spec: External Interaction API — trigger 외부
       인터랙션 채널 (PR1/Spec) (#228)", 2026-05-21)에서 처음 작성됐다. 커밋 prefix `spec:`
       가 이 저장소의 project-planner 트랙 관례(`docs(spec):`류)와 부합해, 원문 작성자가
       developer 본인이라는 근거가 diff/이력 어디에도 없다.
    3. **조건 4("원문은 취소선으로 남기고 인접 서술은 건드리지 않는다") 미준수** — 두 커밋
       모두 원문을 취소선 없이 완전히 치환했다(§8.2 문장 자체를 재작성, WS §4 절 5개를
       재배치).
  - 이 문제는 이 diff 안에 이미 포함된 이전 라운드 scope 리뷰(`review/code/2026/08/31/
    18_30_55/scope.md`, 이 프롬프트 파일 33)가 INFO 로 먼저 지적했으나 "diff 만으로는
    project-planner 트랙이었는지 developer 가 예외를 넘겼는지 구분할 근거가 없다"며 격상하지
    않았다. 이번 라운드에서 `git blame`/`git log -S` 로 직접 확인한 결과 조건 1·2·4 가 문면상
    불충족임을 확인했으므로 WARNING 으로 격상한다. 다만 이 두 편집의 **내용 정확성**(실제
    구현과 일치하는가)은 이 리뷰 범위가 아니다 — 다른 라운드(`requirement`/`documentation`)가
    이미 확인했고 정확했다.
  - 추가로, 후속 fix 커밋 `0883c4e43`·`f3ece1fc6` 는 **같은 커밋 안에서** `codebase/backend/
    src/modules/websocket/**`(TS 코드 주석) + `.claude/skills/consistency-checker/**`
    (harness Python) + `spec/5-system/6-websocket-protocol.md`/`spec/data-flow/
    8-notifications.md`(spec 본문)를 함께 건드린다(`git show --stat 0883c4e43`로 확인). 코드
    영역과 spec 영역이 한 커밋에 섞여 있어, 두 트랙(developer/project-planner)의 경계를
    커밋 단위로도 분리하지 못했다.
  - 제안: 통합 조율자 또는 후속 게이트가 이 두 spec 편집(`d743251b0`·`50caf1a85`)이 실제로
    project-planner 세션에서 수행됐는지, 혹은 자기-반증형 소정정 5조건을 (사후에라도) 충족하는
    지 확인할 것. 후자라면 CLAUDE.md 가 요구하는 `--impl-done`(그 spec 파일이 포함되는 scope)
    실행 여부도 함께 확인 — 이 diff 안 어디에도 그 게이트 실행 로그가 없다.

- **[INFO]** 브랜치는 11개 원자적 커밋으로 서로 다른 여러 주제(harness census · chat-channel
  주석 · workflow-assistant 401 문서화 · WS/EIA/notifications 절번호 재배치 · cafe24/webchat/
  node-output/user-profile plan grooming · 두 차례의 review-fix 라운드)를 다룬다.
  - 위치: 브랜치 전체 (`ead37afd4`..HEAD, `git log --oneline`으로 확인한 11개 커밋)
  - 상세: 파일 단위로는 광범위해 보이지만, 각 커밋이 정확히 하나의 plan 체크리스트 항목 또는
    하나의 이전 리뷰 라운드 WARNING 묶음만 다루고(`git show --stat`로 커밋별 파일셋을 확인),
    워크트리명(`plan-in-progress-items`) 자체가 "여러 in-progress plan 항목을 훑어 처리"인
    세션 정의와 부합한다. 이 폭 자체는 스코프 위반으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 이전 두 코드 리뷰 세션의 산출물 디렉터리(`review/code/2026/08/31/18_30_55/**`,
  `review/code/2026/08/31/18_46_06/**`, 총 27개 파일)가 이번 브랜치 diff 에 신규 파일로
  포함돼 있다.
  - 위치: 프롬프트 파일 25~48(`review/code/2026/08/31/18_30_55/*`, `18_46_06/*`)
  - 상세: CLAUDE.md 의 저장 위치 표가 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/
    <hh>_<mm>_<ss>/`"를 정본 위치로 명시하고 `review/`는 gitignore 대상이 아니므로, 이 리뷰
    라운드 산출물이 커밋에 실리는 것 자체는 이 저장소의 review-fix 워크플로 관례에 부합한다.
    실제로 커밋 `0883c4e43`/`f3ece1fc6`(둘 다 `fix(review):` prefix)는 각각 `18_30_55`/
    `18_46_06` 라운드가 낸 WARNING 을 정정하는 커밋이라, 그 세션의 리뷰 산출물이 같은 커밋에
    동봉되는 것은 "무엇을 고쳤는가"의 근거 자료이지 무관한 drive-by 추가가 아니다.
  - 제안: 조치 불요.

- **[INFO]** plan 문서 다건(`cafe24-backlog-residual.md`, `spec-sync-user-profile-gaps.md`,
  `spec-sync-websocket-protocol-gaps.md`, `webchat-usewidget-extraction.md`,
  `node-output-redesign/README.md`)에 "착수 전 실측" 블록이 추가됐으나 실제 구현(코드 변경)은
  수반하지 않는다.
  - 위치: 파일 16·18·22·23·24 (diff 게이트로 확인)
  - 상세: 각 블록은 제품 semantics 결정이 필요하다고 스스로 판단하고 구현을 보류한 기록이다
    (WS 토큰 만료·유지보수 이벤트 트리거·in_app 뮤팅 등). 요청하지 않은 기능을 추가하지 않았고,
    오히려 착수 가능해 보이던 항목을 "결정 필요"로 명확히 좁혔다 — 기능 확장(over-engineering)
    방향이 아니라 반대 방향이다.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`
  의 `ApiUnauthorizedResponse` 신규 import(파일 12 게이트 28줄)와 `@ApiUnauthorizedResponse`
  데코레이터 7곳 부착은 신설 회귀 테스트(파일 11, `workflow-assistant.controller.swagger.
  spec.ts`)가 실제로 소비하며, plan `spec-sync-stop-editor-and-forbidden-routes.md`(파일 15)
  §2 항목과 1:1 대응한다.
  - 위치: 파일 12 게이트 28·59·79·97·111·126·142·164줄
  - 상세: 미사용 import·drive-by 리팩토링·무관한 포맷팅 변경 없음.
  - 제안: 조치 불요.

## 요약

브랜치는 11개 커밋으로 여러 in-progress plan 항목을 순회하는 "plan grooming" 세션이며, 대부분의
변경(harness census 신설, chat-channel 주석 정정, workflow-assistant swagger 401 문서화, 다수
plan 문서 실측 등재, 두 라운드의 review-fix)은 각 항목의 plan 체크리스트에 1:1 대응하고 요청하지
않은 기능 확장·무관한 리팩토링·포맷팅 뒤섞기는 발견되지 않았다. 다만 `spec/5-system/
14-external-interaction-api.md`(§8.2 HMAC 알고리즘 화이트리스트, API 계약 내용)와 `spec/5-system/
6-websocket-protocol.md`(§4 절 재배치) 두 spec 파일을 직접 편집한 커밋 2건(및 그 후속 fix
커밋에 섞여 들어간 spec 편집)이, CLAUDE.md 가 developer 에게 허용하는 유일한 spec 편집 예외
("자기-반증형 소정정")의 조건을 문면상 충족하지 못한다 — 특히 HMAC 화이트리스트 편집은 그 예외가
명시적으로 배제하는 "API 계약" 항목이다. 이 라운드에 포함된 이전 scope 리뷰가 이미 INFO 로
짚었던 지점이나, `git blame`/`git log -S` 로 직접 확인한 결과(원문 작성자가 developer 라는 근거
부재, 취소선 없이 전면 치환) 격상 근거가 뚜렷해 WARNING 으로 올린다. 내용 자체의 정확성은
문제없다 — 프로세스(어느 트랙에서, 어떤 게이트를 거쳐 편집됐는가) 문제다.

## 위험도

MEDIUM
