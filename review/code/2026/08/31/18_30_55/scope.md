# 변경 범위(Scope) 리뷰

## 조사 방법

프롬프트에 실린 22개 파일 diff 를 검토하고, 다수 파일이 잘려 있어 `git log --oneline`,
`git show --stat <sha>`, `git show <sha>` 로 8개 커밋(`469d75ac8`·`b0452f74b`·`50caf1a85`·
`d743251b0`·`554266c09`·`2435cbc41`·`c1ae464d7`·`00f279fe8`, base `ead37afd4`)을 각각 직접
열람했다. 저장소 파일을 뮤테이션하지 않았다(`git status --short` 로 clean 확인, read-only 명령만 사용).

## 발견사항

- **[INFO]** 브랜치 전체 diff 는 서로 다른 8개 주제(harness census · chat-channel 주석 ·
  workflow-assistant 401 문서화 · WS/EIA/notifications 절번호 재배치 · cafe24/webchat/
  node-output/user-profile plan grooming)를 아우른다.
  - 위치: 브랜치 전체 (`git diff --stat origin/main...HEAD` — 20 files, 8 commits)
  - 상세: 파일 단위로는 여러 하위시스템(`.claude/skills/consistency-checker`,
    `codebase/backend/src/modules/chat-channel`, `codebase/backend/src/modules/workflow-assistant`,
    `spec/5-system`, `spec/data-flow`, 다수 `plan/**`)에 걸쳐 있어 언뜻 광범위해 보인다.
    다만 커밋을 하나씩 열어 보면 **각 커밋이 정확히 하나의 plan 체크리스트 항목만** 다루고
    (`469d75ac8`=3파일 comment-only, `b0452f74b`=swagger 401, `50caf1a85`=WS 절번호,
    `c1ae464d7`=harness census, 나머지 3개는 plan 문서 단독), 커밋 메시지가 각각 "무엇을 안
    고쳤나"/"범위를 넓히지 않은 것" 절로 스스로 경계를 명시한다. 워크트리명(`plan-in-progress-items`)
    자체가 "여러 in-progress plan 을 훑어 처리"인 세션이라, 이 폭은 그 작업 정의에 부합한다.
  - 제안: 조치 불요 — 리뷰어 참고용 정보. 각 커밋이 독립적으로 되돌릴 수 있는 단위라
    이 폭이 실질적 리스크를 만들지 않는다.

- **[INFO]** `50caf1a85`·`d743251b0` 커밋은 `spec/**`(WS §4 절번호 재배치, EIA §8.2 알고리즘
  화이트리스트 정정)를 직접 편집한다. CLAUDE.md 는 `spec/` 을 project-planner 트랙으로,
  developer 의 spec 편집은 "자기-반증형 소정정"(예고 문장 한정, API 계약 제외)이라는 좁은
  예외로만 허용한다.
  - 위치: `spec/5-system/14-external-interaction-api.md`(§8.2 알고리즘 화이트리스트),
    `spec/5-system/6-websocket-protocol.md`(§4.3 이동 + §4.4~4.6 재번호)
  - 상세: 이 두 편집은 "developer 가 스스로 써 넣은 예고 문장의 반증"이 아니라 (a) 같은
    문서 내부 모순 정정(§8.2 vs §R12) (b) 절 번호 재배치라, 좁은 예외의 조건 2("예고·트리거만,
    API 계약·제품 정의는 해당 없음")를 문면상 충족하지 못한다. 다만 diff 만으로는 이 턴이
    project-planner 트랙(정상 경로 — spec/ 은 planner 몫이므로 문제 없음)으로 수행됐는지
    developer 가 예외 범위를 넘겨 직접 편집했는지 구분할 근거가 없다(git author 가 전부
    동일 `worker-ants` 계정). 커밋 메시지에 실측·근거가 충실히 남아 있어 **내용 자체의
    정확성**은 이 리뷰 범위에서 문제 삼지 않는다 — 다만 "어느 트랙에서 썼는가"는 이 diff
    바깥의 프로세스 기록(예: `consistency-check --spec` 실행 로그)으로만 확정 가능하다.
  - 제안: 통합 조율자/후속 게이트(`--spec` 또는 `--impl-done`)가 이 두 spec 편집에 대해
    project-planner 경로였음을 (or 자기-반증형 소정정 5조건 충족을) 별도로 확인하는 것을
    권장. 이 리뷰(코드 diff 기준)만으로는 위반이라 단정할 근거가 부족해 CRITICAL/WARNING
    으로 올리지 않는다.

- **[INFO]** 스코프 자제(self-restraint)가 커밋 메시지에 반복적으로 명시돼 있다 — 긍정적
  신호로 기록해 둔다.
  - 위치: `b0452f74b`("저장소 전수 가드는 만들지 않았다 … 이 티켓의 범위가 아니다"),
    `554266c09`/`00f279fe8`("코드 변경 없음 … developer 권한 밖"), `469d75ac8`("앵커까지
    손대면 검증 대상이 늘고 이 항목의 결함 클래스와 무관해진다")
  - 상세: 세 커밋 모두 "더 넓게 고칠 수 있었지만 안 했다"는 근거를 명시한다(권한 경계·비용·
    결함 클래스 불일치). WS 관련 3개 backlog 항목(`auth.token_expired`/`system.maintenance`/
    서버 ping)은 실측 후 "제품 semantics 결정 필요"로 판단해 구현을 보류했고, 실제 코드
    변경 없이 plan 문서에만 실측을 등재했다 — 의도하지 않은 기능 확장이 없다.
  - 제안: 없음(관찰 기록).

## 파일별 확인 결과 (요약)

각 코드/spec 변경이 정확히 어느 plan 체크리스트 항목에서 유래했는지 1:1 대조 완료, 불일치 없음:

| 코드 변경 | 대응 plan 항목 |
|---|---|
| `consistency_orchestrator.py` `_scope_delta_census`/`_count_diff_files` + 테스트 | `harness-consistency-summary-downgrade-rule.md` 마지막 미체크 항목 (커밋 `c1ae464d7`) |
| `chat-channel.dispatcher.ts`/`.spec.ts`/`types.ts` 주석 6곳 | `spec-draft-eia-notification-payload-contract.md` "하드코딩 줄 번호 인용을 앵커로" (커밋 `469d75ac8`) |
| `workflow-assistant.controller.ts` `@ApiUnauthorizedResponse` ×7 + 신규 `.swagger.spec.ts` | `spec-sync-stop-editor-and-forbidden-routes.md` 후속 항목 (커밋 `b0452f74b`) |
| `spec/5-system/6-websocket-protocol.md` §4.3 이동 + §4.4~4.6→4.7 재번호, `14-external-interaction-api.md`/`8-notifications.md` 앵커 동반 정정 | `spec-sync-external-interaction-api-gaps.md` "`### 4.4` 중복" 항목 (커밋 `50caf1a85`) |
| `14-external-interaction-api.md` §8.2 hmac 화이트리스트 정정 | `spec-sync-external-interaction-api-gaps.md` §8.2 항목 (커밋 `d743251b0`) |
| `spec-sync-websocket-protocol-gaps.md`/`spec-sync-user-profile-gaps.md`/`cafe24-backlog-residual.md`/`webchat-usewidget-extraction.md`/`node-output-redesign/README.md` 실측 노트 | 각 파일 자체 (코드 변경 없음, `554266c09`/`00f279fe8`/`2435cbc41`) |

플랜 항목과 무관한 drive-by 수정(불필요한 리팩토링·미사용 임포트 정리·포맷팅-only 변경·
설정 파일 변경)은 발견하지 못했다. `workflow-assistant.controller.ts` 의 신규 import
(`ApiUnauthorizedResponse`)는 같은 커밋에서 실제로 쓰인다.

## 요약

브랜치는 8개의 원자적 커밋으로 구성되며, 각 커밋이 정확히 하나의 plan 체크리스트 항목에
대응하고 diff 범위가 그 항목이 요구하는 파일에 정확히 국한된다. 커밋 메시지가 "무엇을 안
고쳤는지"·"왜 범위를 넓히지 않았는지"를 스스로 밝히고 있고, 제품 semantics 결정이 필요한
지점(WS 토큰 만료·유지보수 이벤트·in_app 뮤팅)에서는 실제로 구현을 멈추고 실측만 등재해
승인되지 않은 기능 확장을 만들지 않았다. 유일하게 표시해 둘 점은 `spec/**` 편집 2건
(WS 절번호 재배치·EIA 알고리즘 화이트리스트 정정)이 CLAUDE.md 의 developer 자기-반증형
소정정 예외 조건을 문면상 벗어나는데, diff 자체로는 이 턴이 project-planner 트랙이었는지
확인할 수 없다는 것 — 다만 이는 "무엇을 고쳤는가"의 범위 문제가 아니라 "누가/어느 트랙에서"
의 프로세스 확인 문제라 INFO 로 남긴다.

## 위험도

LOW
