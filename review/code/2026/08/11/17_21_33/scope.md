# 변경 범위(Scope) 리뷰

## 검증 절차 요약

프롬프트 페이로드가 대형 파일(`integrations.controller.ts`, `workflows.controller.ts`,
`3-execution.md`, `node-cancellation.md`) 2곳은 "전체 파일 컨텍스트" 생략 경고를 냈으므로,
`git diff origin/main` 을 직접 실행해 `codebase/`·`spec/`·`plan/` 전체 diff 를 재구성하고
스크립트로 전수 검증했다(저장소는 읽기만 함, 수정 없음). 브랜치는 `origin/main` 위에 커밋
1개(`91edf4f6e`)만 얹은 fast-forward 상태.

## 발견사항

### 1. `codebase/` diff 는 선언대로 순수 추가뿐 — 삭제 줄 0, 전수 확인

- **[INFO]** `git diff origin/main -- codebase/` = `16 files changed, 57 insertions(+), 0 deletions(-)`.
  - 위치: 전체 `codebase/` 변경셋 (16개 컨트롤러 파일)
  - 상세: `grep -E '^-[^-]'` 로 삭제 줄을 전수 검색해 0건을 확인했다. 추가된 57줄을 정규식으로
    분류한 결과 **51줄은 정확히** `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })`,
    **6줄은 정확히** `ApiForbiddenResponse,`(import) 이며, 이 두 패턴에 해당하지 않는 추가 줄은
    0건이었다. 51개 데코레이터 설명 문자열도 `sort -u` 결과 단일 값으로 수렴 — 오탈자·변형 없음.
  - 제안: 없음 (선언한 범위와 정확히 일치).

### 2. 부착 위치·순서 — 세 패턴 모두 파일 내에서 상대 순서 보존

- **[INFO]** 51건 전수를 `401 직후 / 404 직전(401 없음) / 시그니처 직전(401·404 둘 다 없음)`
  세 갈래로 분류하면 **47 / 1 / 3** 으로 plan(`spec-sync-stop-editor-and-forbidden-routes.md`
  §실측)의 표와 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:95`
    (`findOne` — 404 직전 1건), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:58,77,94`
    (`list`/`latest`/`findOne` — 시그니처 직전 3건)
  - 상세: `model-config.controller.ts` 의 `findOne` 은 origin/main 시점에 이미 `@ApiUnauthorizedResponse`
    가 없는 핸들러였다(`git show origin/main:...` 로 확인) — 이 PR 이 만든 갭이 아니라 기존 문서화
    누락이며, codemod 는 그 상태 그대로 "404 직전"에 403 을 끼워 넣었을 뿐이다. `workflow-assistant.controller.ts`
    3건도 마찬가지로 401 자체가 부재한 기존 상태이고, plan 이 이를 "이 티켓 범위 밖" 후속으로 명시
    등재해 뒀다(§후속 항목 1개).
  - 어느 파일에서도 403 이 기존 404(또는 그 뒤의 400/409/422 등)보다 뒤에 삽입된 사례는 없었다 —
    삽입은 항상 401 과 404 "사이"(또는 그 경계)에 끼워졌으므로 기존 상대 순서를 보존한다.
  - 제안: 없음. `workflow-assistant.controller.ts` 의 401 누락은 plan 이 이미 후속으로 분리 등재했으므로
    이 PR 에서 추가로 손댈 필요 없음.

### 3. 포맷팅 노이즈 / drive-by 리팩토링 — 발견 없음 (plan 스스로 자수한 1차 시도 폐기 이력 확인)

- **[INFO]** import 재정렬·공백 변경·무관 리팩토링이 diff 에 섞여 있지 않다.
  - 위치: 6개 import 삽입 파일(`dashboard`, `background-runs`, `notifications`, `statistics`,
    `workflow-assistant`, `workflow-versions` 컨트롤러) — 모두 append-only 한 줄 추가.
  - 상세: plan 문서(§실측 "drive-by 를 한 번 만들었다가 되돌렸다")가 1차 codemod 가
    `@nestjs/swagger` import 를 알파벳 재정렬해 `background-runs.controller.ts` 에서만
    `+8/-3` 을 냈다고 스스로 기록했고, 최종본은 폐기 후 append-only 로 재작성해 `+57/-0` 으로
    수렴했다고 적었다. 실제 diff 로 재현 검증한 결과 이 서술과 일치 — 현재 diff 에 재정렬·삭제
    흔적이 전혀 없다.
  - 제안: 없음.

### 4. spec 3곳 — 티켓 §1·§3 범위와 1:1 대응

- **[INFO]** `spec/3-workflow-editor/3-execution.md` (+2/-1, 2 hunk), `spec/conventions/node-cancellation.md`
  (+1/-1, 1 hunk), `spec/conventions/swagger.md` (+2/-2, 2 hunk) 모두 plan §1("`/stop` 의 Editor+
  미반영")·§3("`swagger.md` 앵커 프래그먼트")에서 명시한 항목과 정확히 일치한다.
  - 위치: `spec/3-workflow-editor/3-execution.md` §9 API 표(신규 "권한" 행 + `/stop` 행 1줄 수정),
    `spec/conventions/node-cancellation.md` §2.3 사용자 cancel 버튼 항목 1줄 확장,
    `spec/conventions/swagger.md` §5-4 체크리스트·§확장배경 Rationale 문단 — 기존 `12-workspace.md`
    인용 2곳에 앵커 프래그먼트만 추가.
  - 상세: 세 파일 모두 서술 확장(신규 사실 주장) 없이 "이미 §3.2 가 정한 권한을 파생 문서에
    반영"하는 표기 동기화이며, `swagger.md` 는 기존 링크에 앵커만 덧붙였다(URL 텍스트 변경 없음).
    티켓 범위를 벗어나는 문단·섹션 추가는 없다.
  - 제안: 없음.

### 5. `plan/in-progress/...md` 변경 — 셀프 트래킹 문서, 범위 내

- **[INFO]** `worktree: (unstarted)` → `worktree: stop-editor-403-docs`, 체크박스 완료 처리,
  `## 실측`·`## 후속` 섹션 신설(+75/-19).
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`
  - 상세: 이 PR 이 수행 중인 바로 그 작업의 plan 파일이며, `CLAUDE.md`/`plan-lifecycle.md` 관례상
    작업 완료 시 체크박스 갱신 + 실측 근거 기록은 정상 워크플로다. 새로 발견한 후속 갭
    (`workflow-assistant.controller.ts` 401 누락)을 별도 항목으로 등재해 스코프를 넓히지 않고
    분리한 점도 바람직하다.
  - 제안: 없음.

### 6. 머지 가능성

- **[INFO]** `origin/main` 이 현재 브랜치 HEAD 의 ancestor(fast-forward 가능), 충돌 없음.
  plan 문서가 재스캔 잔여 0건·16파일 lint 0건·타입오류 0건·문서가드 2890 passed 를 주장하며,
  이는 본 리뷰의 범위(스코프 검증)를 넘는 항목이라 별도 검증하지 않았다 — 스코프 관점에서는
  머지를 막을 요소가 없다.

## 요약

`codebase/` 변경은 51개 `@ApiForbiddenResponse` 데코레이터 + 6개 import, 정확히 `+57/-0`, 삭제
줄 0건으로 전수 확인했다. 부착 위치는 401 직후(47)/404 직전(1)/시그니처 직전(3) 세 갈래로 갈리지만
모두 파일 내 기존 상태·상대 순서를 보존하며, 예외 4건(model-config 1 + workflow-assistant 3)은
codemod 가 만든 문제가 아니라 사전에 존재하던 401 문서화 누락이고 plan 이 이를 스스로 발견해 범위
밖 후속으로 분리 등재해 뒀다. 1차 codemod 가 만들었던 import 알파벳 재정렬 drive-by(`+8/-3`)는
폐기되고 append-only 로 재작성된 이력이 diff 로도 재현 검증된다. spec 3곳(`3-execution.md` 2곳·
`node-cancellation.md`·`swagger.md`)은 각각 plan §1/§3 이 명시한 항목과 1:1 대응하며 범위 밖 서술
확장이 없다. plan 파일 갱신은 이 작업 자체의 self-tracking 문서로 정상 관례다. 포맷팅 노이즈·기능
확장·무관 수정·주석 변경·설정 변경 모두 발견되지 않았으며, 이 PR 은 억지 발견 없이 스코프 관점에서
완전히 깨끗하다.

## 위험도

NONE

STATUS: OK
