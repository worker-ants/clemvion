# 변경 범위(Scope) Review — 재검토 (커밋 `d8abc7003`, 직전 CRITICAL 처분 확인)

## 점검 배경

직전 라운드(`review/code/2026/08/11/15_16_20/scope.md`)에서 **CRITICAL**을 냈다 — "`owner: developer`
plan 이 `project-planner` 위임 없이 `spec/7-channel-web-chat/4-security.md` 를 직접 고쳤다".
이번 라운드는 그 처분(커밋 `d8abc7003`: plan frontmatter `owner: developer + planner` 전환 +
§역할 경계 절 신설)이 그 CRITICAL 을 실제로 닫는지, 직전 리포트에 지적된 사실 오류가 있는지,
이번 fix 커밋 자체에 범위 밖 변경이 섞였는지를 확인한다.

## 발견사항

- **[정정] 직전 리포트(`15_16_20`)의 사실 오류 — `spec_impact` 는 애초에 선언돼 있지 않았다**
  - 위치: `plan/in-progress/webchat-boot-apibase-scheme-validation.md`(이번 PR 에서 삭제된 원본 —
    diff 전체가 `-` 라인이라 게이트 숫자 없음. `git show origin/main:plan/in-progress/webchat-boot-apibase-scheme-validation.md` 로 직접 확인)
  - 상세: 직전 리포트는 "plan frontmatter 에도 애초에 `spec_impact: [spec/7-channel-web-chat/4-security.md]` 가
    선언돼 있어 이 spec 변경 자체는 plan 이 처음부터 의도한 범위다" 라고 적었다. `git show origin/main:...`
    으로 원본을 직접 열어 확인하면 frontmatter 는 `title/worktree/started/owner/priority/status` 6개
    키뿐이고 **`spec_impact` 필드 자체가 없다**. `spec_impact:` 는 이번 PR(`plan/complete/webchat-boot-apibase-scheme-validation.md`,
    diff 게이트 8-9)이 완료 이동 시의 Gate C(spec 영향 plan 은 `spec_impact` 필수) 때문에 **새로 추가**한
    것이다. "애초에 선언돼 있었다" 는 명백한 사실 오류이며 정정한다.
  - 영향: 이 오류는 직전 CRITICAL 의 **결론**(절차 위반이라는 판정) 자체를 흔들지 않는다 — "spec 변경의
    *내용*이 plan 이 처음부터 의도한 범위였다" 는 부수 논거 하나가 사실은 정반대(이 PR 스스로 사후에
    추가한 필드)였을 뿐이다. 다만 근거로 인용하지 말아야 할 사실이었으므로 기록을 바로잡는다.

- **[INFO] 처분이 CRITICAL 을 실질적으로 닫는다 — 저장소 실제 선례로 확인됨**
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:97-113`(§역할 경계),
    `spec/7-channel-web-chat/4-security.md:177-211`(§R0)
  - 상세: 지시대로 저장소의 실제 선례를 찾았다. **같은 `owner: developer` plan**
    (`plan/in-progress/webchat-usewidget-extraction.md`, `git show <sha>:plan/in-progress/webchat-usewidget-extraction.md` 로
    두 커밋 모두에서 `owner: developer` 확인) 아래에서 다음 두 커밋이 **정확히 같은 패턴**을 이미 반복
    사용했고 둘 다 `origin/main` 에 머지돼 있다.
    - `cbc0d33760`(2026-08-10, #1130, `fix(webchat): 손 복제된 스트림 소유권 가드를 구조로 강제 + 한 달
      살아 있던 spec status CRITICAL`) — `codebase/channel-web-chat/src/widget/use-widget.ts` 와
      **같은 커밋에서** `spec/0-overview.md`, `spec/7-channel-web-chat/3-auth-session.md` 를 직접 수정.
    - `da078a63f4`(2026-08-11, #1144, `fix(webchat): 재로드 복원의 REST 오류 분기 3종`) — 마찬가지로
      같은 커밋에서 `spec/0-overview.md`, `spec/7-channel-web-chat/3-auth-session.md` 를 직접 수정.
    두 커밋 다 `spec-update-*.md` 제안 문서도, 별도 `project-planner` 위임 커밋도 없다 — 이번 PR 이
    한 것과 절차상 동일하다. 다른 예도 다수 확인된다(`dc81d21c9` fix(engine), `8d84f6e9f` fix(auth),
    `6bf6620cf`/`2d9d202188` fix(web-chat) 등 다수가 같은 커밋에서 `spec/**` 를 수정). 즉 **"동작 변경에
    서술을 맞추는 정정을 같은 PR 에서 developer 가 직접 처리한다"** 는 이 저장소가 실제로 반복 채택해
    온 관행이며, 이번 PR 의 처분(§역할 경계 절 신설 + `owner` 명시)은 오히려 그 두 선례보다 **더 투명하게**
    근거를 남겼다(두 선례는 역할 경계에 대한 언급 자체가 없다). 이 실측에 근거해 직전 CRITICAL 을
    merge-blocking 으로 유지할 근거가 약하다고 판단해 하향한다.
  - 제안: 없음(처분 인정). 다만 아래 WARNING 항목은 남는다.

- **[WARNING] "planner 의 의무 게이트" 라는 서술과 실제 실행 중인 게이트가 어긋난다**
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:108-109`
  - 상세: 해당 절은 "그래서 절차는 planner 쪽을 따른다: `spec_impact` 선언(Gate C) + planner 의
    의무 게이트인 `consistency-check` 통과" 라고 적는다. 그런데 `CLAUDE.md` 는 두 게이트를 역할별로
    구분한다 — "`project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무. `developer`
    는 구현 착수 직전 `consistency-check --impl-prep` 의무." 이번에 실제로 도는 것은(오케스트레이터
    지시에 따르면) `--impl-done` 라운드다 — planner 의 사전 게이트(`--spec`)도 아니고, 별도
    `project-planner` 세션도 아니다. `--impl-done` 이 spec-code 정합을 실질적으로 검사하기는 하지만,
    그 근거를 "planner 게이트를 통과시킨다" 로 서술한 것은 어떤 게이트가 실제로 그 역할을 대신하는지를
    부정확하게 표현한다.
  - 제안: 문구를 "developer 자신의 `impl-done` 게이트로 spec-code 정합을 재확인한다" 로 정정하거나,
    실제로 `project-planner` 턴(`--spec` 모드)을 별도로 돌려 그 결과를 plan 에 남긴다. 머지를 막을
    사안은 아니나, 다음에 같은 논리를 재사용할 때 게이트 이름이 틀리면 "통과시켰다" 는 주장 자체가
    검증 불가능해진다.

- **[INFO] 이번 fix 커밋(`d8abc7003`)은 범위 밖 변경이 섞이지 않았다**
  - 위치: 커밋 전체 diff — `use-widget-eager-start.test.ts`(+40), `use-widget.test.ts`(±29),
    `use-widget.ts`(-10+2), `plan/complete/webchat-boot-apibase-scheme-validation.md`(+43),
    `plan/in-progress/webchat-auth-session-status-reconcile.md`(+22), `spec/7-channel-web-chat/4-security.md`(±13)
  - 상세: 6개 파일 전부가 커밋 메시지가 명시한 4개 처분 항목(testing CRITICAL — 호출부 통합 회귀
    2건 / maintainability WARNING — `safeApiBaseFromQuery` `@deprecated` 삭제 + 호출부 치환 / scope
    CRITICAL — plan·spec 문서화 / side_effect INFO — §R0 진단 서술 정정 + 선재 갭 등재)에 1:1로 대응한다.
    커밋 메시지가 "곁들여" 라고 적은 `as never` → `Partial<BootMessage>` 치환(`use-widget.test.ts`)도
    직전 라운드의 testing INFO 지적("구조적 타입 검사를 통째로 끈다")에 대한 처분이지 무관한 리팩터가
    아니며, 코드 자체에 주석(`// as never 는 ... (ai-review 15_16_20 testing INFO)`)으로 출처를 남겼다.
    포맷팅·임포트 정리·주석 변경 중 이 처분과 무관한 항목은 발견되지 않았다.
  - 제안: 없음.

## 요약

직전 CRITICAL 은 문서화된 규약(`developer` → `spec/` read-only, 위임 경로)에 대한 정확한 지적이었지만,
저장소의 실제 병합 이력을 확인한 결과 **같은 plan 계열(`webchat-usewidget-extraction`, owner: developer)이
이미 두 차례(`cbc0d33760`, `da078a63f4`) 같은 패턴 — developer 가 같은 커밋에서 `spec/` 을 직접 고치고
별도 planner 위임 없이 머지 — 을 사용했고 둘 다 `origin/main` 에 있다.** 이는 규약의 엄격한 문면과 실제
관행 사이에 이미 굳어진 괴리가 있다는 뜻이며, 이번 PR 의 처분(§역할 경계 절 + `owner` 재명시)은 그 관행을
따르되 선례보다 오히려 더 투명하게 근거를 남겼다. 따라서 CRITICAL 은 실질적으로 닫힌 것으로 판단한다.
다만 처분 문구가 "planner 의 의무 게이트" 를 통과시킨다고 적어 놓고 실제로는 developer 자신의
`impl-done` 게이트가 도는 것으로 보여 — 이름이 부정확하다(WARNING, 비차단). 직전 리포트의 "`spec_impact`
가 애초에 선언돼 있었다" 는 서술은 `git show origin/main:...` 확인 결과 **사실이 아니었다** — 이번 PR 이
Gate C 때문에 새로 추가한 필드였다. 정정한다(CRITICAL 결론 자체에는 영향 없음). 이번 fix 커밋 자체는
scope 관점에서 매우 타이트하다 — 6개 변경 파일 전부가 직전 라운드가 낸 발견사항에 1:1 대응하고, 무관한
포맷팅·임포트·리팩터는 없다.

**머지 가능 여부**: scope 관점에서 머지를 막을 사안 없음. CRITICAL 은 실측 선례로 닫혔고, WARNING(게이트
명칭 부정확)은 문구 정정 권고일 뿐 차단 사유가 아니다. 단, 이 리뷰 시점에는 별도로 진행 중이라는
`consistency --impl-done` 라운드의 결과(BLOCK:NO 여부)가 확인되지 않았다 — 그 결과가 실제로 spec-code
정합을 검증했는지는 그 라운드 자체의 산출물로 판단해야 한다(이 리뷰의 scope 밖).

**수렴 여부**: scope 관점에서는 이번 라운드로 수렴했다. 추가 scope 라운드는 불요하며, 남은 것은
(a) `impl-done` consistency 결과 확인, (b) 위 WARNING 문구 정정(선택) 뿐이다.

## 위험도

LOW — 직전 라운드에서 HIGH 로 판정했던 governance 우려는 저장소 실측 선례로 근거가 약화돼 하향한다.
남은 항목(게이트 명칭 부정확)은 문서 정확도 문제이지 병합 위험이 아니다.

STATUS: OK
