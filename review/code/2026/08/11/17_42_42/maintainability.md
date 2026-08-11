# 유지보수성(Maintainability) Review — 델타 (51 → 64건, 잔여 13 추가)

직전 라운드(`17_21_33`)에서 이미 "공용 데코레이터 추출 기각"을 실측 근거로 판정했다. 이번엔
그 판정이 새 13건(설명 문자열 역할별 3종: `viewer`/`editor`/`owner`)에도 유지되는지, codemod
산출물이 주변 코드와 구분되는지, plan 문서 분량이 과한지 세 가지만 재검증한다.

## 발견사항

- **[INFO]** 공용 데코레이터 추출 기각은 새 13건을 포함해도 그대로 유지된다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:221,242`(`'owner 이상 권한 필요'`), `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:71,100`(`'viewer 이상 권한 필요'`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:107,120,135,157`·`codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:60,78,135`·`codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:366`(`'editor 이상 권한 필요'`), `codebase/backend/src/modules/workflows/workflows.controller.ts:134`(`'viewer 이상 권한 필요'`)
  - 상세: `'owner 이상 권한 필요'`는 이번 diff 전에는 저장소에 **선례가 0건**이었다(`grep`으로 직접 확인, 이번 2건이 최초). 다만 이는 "새로운 중복 축"이 아니라 기존에 이미 확립된 `'<role> 이상 권한 필요'` 템플릿(직전 라운드 실측 기준 `editor` 46건·`viewer` 1건)이 세 번째 role 값으로 확장된 것뿐이다. 문자열 선택 규칙 자체가 `swagger.md §5-4`에 명문화돼 있고, 이번 13건도 예외 없이 그 규칙을 따른다(직접 대조 확인). 종류가 늘었다고 해서 "성격이 다른 중복"이 된 것은 아니므로 추출 기각 판단을 뒤집을 근거는 없다.
  - 제안: 조치 불요. 다만 이제 `'워크스페이스 멤버가 아님'`(63건) + `editor`(54건) + `viewer`(4건) + `owner`(2건) 총 4개 템플릿 변형이 확정됐으므로, 직전 라운드가 이미 남긴 "향후 대규모 리팩터 시 `ApiRoleForbidden(role)` 얇은 래퍼 고려" 메모는 여전히 유효하다(지금 강제할 근거는 없음).

- **[INFO]** codemod가 만든 13건은 주변 코드와 형태적으로 구분되지 않는다 — 오히려 1차 51건 때보다 더 매끈하다.
  - 위치: 위와 동일 6개 파일 13곳
  - 상세: 직접 파일을 열어 확인한 결과(`knowledge-base.controller.ts:366` 등) 데코레이터 배치가 전부 `@ApiUnauthorizedResponse` 직후 · `@ApiNotFoundResponse` 직전(있는 경우) 선례를 정확히 재현한다. 1차 51건 때 유일한 codemod 흔적이던 "신규 import가 리스트 끝에 append돼 알파벳/status 순서를 깬 문제"도 이번 13건에서는 관찰되지 않는다 — 6개 대상 파일 전부 이미 `ApiForbiddenResponse`를 import하고 있어(1차 51건 부착분 또는 기존 role 데코레이터 때문) import diff 자체가 발생하지 않았다. plan(`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:157-164`)이 스스로 밝힌 "2차 codemod가 `@UseInterceptors(FileInterceptor(...))`를 메서드 시그니처로 오인해 데코레이터 인자 안에 삽입한" 버그도 최종 diff에는 남아있지 않음을 `knowledge-base.controller.ts` 직접 열람으로 확인했다.
  - 제안: 조치 불요.

- **[WARNING]** plan 문서에 동일 제목의 `## 후속 (이 티켓 범위 밖, 등재만)` 섹션이 **두 번** 존재하고, 그 안의 항목 하나가 사실상 중복·모순 상태로 남았다.
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:126`, `:194` (두 헤딩), 항목 본문은 `:128-130`과 `:203-205`
  - 상세: 126번째 줄 섹션의 항목("`swagger.md §5-4`는 401도 요구한다")과 194번째 줄 섹션의 두 번째 항목("`swagger.md` §2-4가 401을 요구한다... 첫 판에 §5-4라 적었으나 401 요구는 §2-4 소관 — `plan_coherence` 정정")은 **같은 후속 과제**(`workflow-assistant.controller.ts` 3라우트 401 누락)를 가리킨다. 두 번째가 첫 번째의 인용 오류(§5-4→§2-4)를 정정한 것인데, 정정 후에도 원본 항목이 그 자리에 그대로 남아 있다. 결과적으로 문서를 처음부터 읽는 사람은 "§5-4가 401을 요구한다"는 **정정 전 문구**를 먼저 마주치고, 맨 아래에서야 그것이 틀렸다는 정정을 다시 만난다. 동일 제목의 H2가 두 번 나오는 것 자체도 목차/검색 관점에서 헷갈린다(예: 이 후속 항목을 다른 세션이 착수하며 "§5-4 위반"으로 재조사를 시작할 위험).
  - 제안: 두 `## 후속` 섹션을 하나로 합치고, 중복된 workflow-assistant 401 항목은 정정된 버전(§2-4 인용) 하나만 남긴다.

## plan 분량 판정

`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`는 현재 205줄이다. 이번 라운드에서
"## 실측"·"## 리뷰 라운드가 잡은 것"·두 번째 "## 후속" 등 회고성 서술이 대폭 늘어(§73-205, 전체의
약 65%) 원래 기능 서술(§1-72)보다 길어진 것은 사실이다. 그러나 이 저장소의 `plan/complete/*.md`
분량 분포(중앙값 근방 250~340줄, 다수가 300줄 이상, 최대 623줄)와 비교하면 205줄은 **과하지 않고
오히려 짧은 축**이다. 회고 내용도 "수치를 술어와 함께 적어야 한다" · "뮤테이션은 자매를 각각
검증해야 한다" 처럼 재발 방지 근거가 명시된 구체적 서술이라 순수 분량 부풀리기로 보기 어렵다.
다만 그 회고를 이어 붙이는 과정에서 위 WARNING(헤딩 중복)이 생겼다는 점은 "길어서 나쁘다"가
아니라 "append 방식으로 계속 붙이면서 기존 섹션과의 정합을 놓쳤다"는, 분량과는 결이 다른 문제로
판정한다.

## 요약

51건→64건 델타에서 새로 등장한 3종 역할별 설명 문자열(`viewer`/`editor`/`owner`)은 기존에 이미
확립된 `'<role> 이상 권한 필요'` 템플릿의 세 번째 값 확장일 뿐이라, 직전 라운드의 "공용 데코레이터
추출 기각" 판단을 뒤집을 근거가 되지 않는다. codemod가 만든 13건은 데코레이터 순서·import 상태
모두 주변 코드와 구분되지 않을 정도로 매끈하고, 1차 51건 때 유일하게 관찰됐던 import 순서 교란도
이번엔 발생하지 않았다(대상 6개 파일이 이미 import를 보유). plan 문서 205줄은 이 저장소 완료 plan
분량 분포에 비춰 과하지 않다. 다만 회고를 append하는 과정에서 동일 제목의 `## 후속` 섹션이 두 번
생기고 그 안의 한 항목(workflow-assistant 401 누락, §5-4→§2-4 인용 정정)이 정정 전/후 버전으로
중복 방치된 것은 실제 결함이라 WARNING으로 남긴다.

## 위험도

LOW

STATUS: OK
