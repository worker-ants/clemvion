# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 신규 테스트 JSDoc 이 spec frontmatter 이력에 대해 사실과 반대되는 주장을 한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:248-249`
  - 상세: 신규 추가된 JSDoc 블록(244-253행)은 "이 분기들은 spec 이 동작을 확정 서술해 두고도 오래
    미구현이었다 ... **spec frontmatter 가 `status: partial` + `pending_plans:` 로 그 사실을
    가리키고 있었다**" 라고 적는다. 그러나 실측 결과 이는 거짓이다:
    - `git log --follow -p -- spec/7-channel-web-chat/3-auth-session.md` 로 확인하면, 이 파일의
      frontmatter 는 2026-05-30 생성 시 `status: partial` + `pending_plans:` 였다가 **2026-06-27
      커밋 `94338b94`에서 `status: implemented` 로 바뀌고 `pending_plans:` 가 완전히 제거됐다.**
    - §3.1 본문에 "404·복구불가 401·낙관적 refresh 는 미구현(Planned)" 배너가 **처음 추가된 것은
      2026-07-05**(`6b25ccc3`) — 즉 frontmatter 가 `implemented`(partial 아님)로 바뀐 지 **8일
      뒤**다. 그 이후 오늘 이 diff 로 배너가 정정되기까지 frontmatter 는 계속 `implemented` 였고
      `partial`/`pending_plans:` 로 돌아간 적이 없다.
    - 바로 이 불일치(본문 "미구현" vs frontmatter "implemented")는 `review/consistency/2026/07/12/
      11_54_56/plan_coherence.md` WARNING 이 정확히 지적한 사안이고, 이번 diff 의 HEAD 커밋
      메시지(`deb9b6978`) 자신도 "origin/main 기준으로 이 spec 은 `status: implemented` 인데
      본문은 '미구현(Planned)' 을 자인하고 있었다" 고 명시한다 — 즉 코드 작성자 본인도 커밋
      메시지에서는 실제 이력을 정확히 알고 있었는데, 테스트 docstring 에는 그 반대(frontmatter 가
      partial 로 그 사실을 가리켰다)가 남았다.
  - 제안: 248-249행을 사실에 맞게 정정하거나(예: "이 갭은 본문에만 있었고 frontmatter 는
    `status: implemented` 로 남아 있어 불일치 자체가 별도 결함이었다" 등) 아예 frontmatter 언급을
    제거한다. frontmatter 이력은 코드 테스트 docstring 보다는 커밋 메시지·spec-impl-evidence 쪽이
    적합한 자리다.

- **[WARNING]** `seedWaitingFromStatus` 함수 JSDoc 계약이 이번 diff 로 추가된 404/401 예외 분기를
  반영하지 못해 stale
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:369-370`(함수 요약), `:380-381`(실패
    정책), `:389-392`(`@returns` 설명)
  - 상세: 이 diff 는 `catch` 블록 안에 `404`(즉시 `finalizeEnded`)·`401`(refresh 1회 → 성공 시
    `"continue"`, 재실패 시 `finalizeEnded`) 분기를 새로 추가했다(486-522행). 그런데 함수 최상단
    JSDoc 은 이 diff 이전 문구 그대로 남아 있다:
    - 369-370행: "`getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드하거나, 스냅샷이
      이미 terminal 이면 세션을 정리하고 `ENDED` 로 전이한다" — 오직 *성공 응답의 status 값*
      기준 두 갈래만 서술한다. 예외(`catch`) 경로에서도 이제 `ENDED` 로 전이할 수 있다는 사실이
      빠져 있다.
    - 380-381행: "**실패 정책**: soft-fail — HTTP 오류·네트워크 실패 시 `console.warn` 후 진행"
      — 이 문장은 이제 **404/401 을 제외한 나머지 오류에만** 참이다. 404/401 은 `console.warn`
      을 거치지 않고 `finalizeEnded`/`refreshToken` 을 수행한다. 함수 계약을 요약하는 이 한 줄만
      읽는 독자는 404/401 도 soft-fail 인 줄 오해한다.
    - 390행: `@returns` 설명의 `"ended"`(스냅샷이 terminal → 종료 확정)"도 이제 부분적으로만
      맞다 — `"ended"` 는 이제 (a) 스냅샷 terminal, (b) `404` catch, (c) 401 재차 실패 catch,
      세 경로에서 반환된다. `SeedOutcome` 타입 자체의 `"ended"` 독스트링(84-86행, `/** 스냅샷이
      terminal → finalizeEnded 로 종료 확정함. */`)도 같은 이유로 stale.
  - 제안: 함수 JSDoc 에 "404/401 예외도 각각 종료·낙관적 refresh 로 처리한다" 한 문단을 추가하고,
    `"ended"` 유니언 멤버 독스트링과 `@returns` 설명을 "스냅샷 terminal **또는** 404/401 예외
    확정" 식으로 갱신 권장.

- **[WARNING]** 같은 spec·같은 기능 영역의 기존 CHANGELOG 관례를 따르지 않음 — 신규 항목 부재
  - 위치: `CHANGELOG.md`(이번 diff 에 미포함, 저장소 루트)
  - 상세: `CHANGELOG.md` 는 웹채팅 위젯의 이전 기능/버그 수정마다 `## Unreleased — 웹채팅 위젯:
    <설명> (<spec 참조>)` 패턴을 일관되게 기록해 왔다 — 예: 183행 "웹채팅 위젯: 버퍼 만료
    재동기화 + 종료 처리 일원화 (7-channel-web-chat §3.1)"는 바로 이번 diff 가 마무리하는 **같은
    §3.1 REST 오류 분기 작업의 앞선 절반**(200+종료 분기)에 대한 CHANGELOG 항목이었다. 그 뒤를
    잇는 이번 diff(404·401 분기, 나머지 절반)는 기능적으로 동등한 무게의 사용자-관측 가능한 동작
    변경(재로드 시 종료 판정·자동 refresh)임에도 CHANGELOG 항목이 없다. `git show --stat HEAD` 로
    확인한 결과 이번 커밋은 `use-widget-eager-start.test.ts`/`use-widget.ts`/`3-auth-session.md`
    3파일만 건드리고 `CHANGELOG.md` 는 변경분에 없다.
  - 제안: 선행 항목(183행)과 동형으로 `## Unreleased — 웹채팅 위젯: 재로드 REST 오류 분기(404/
    401 낙관적 refresh) (7-channel-web-chat/3-auth-session §3.1-2/§R4)` 항목 추가 권장.

- **[INFO]** PR 간 frontmatter 소유권 조율이 커밋 메시지에만 있고 spec 어디에도 남지 않음
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter(`status: implemented`, 1-13행)
  - 상세: HEAD 커밋 메시지는 "frontmatter 는 별도 PR(#1130)이 `status: partial`+`pending_plans:`
    로 바꾸는 중이라 여기서는 건드리지 않는다"는 조율 결정을 설명한다. 이 결정은 유효하지만, 이
    diff 가 머지된 뒤 만약 #1130 이 이 diff **이전** 스냅샷을 근거로 삼아 `status: partial` 로
    내렸는데 그 근거(§3.1 "미구현" 서술)가 이 diff 로 이미 사라졌다면, #1130 은 stale 근거로
    frontmatter 를 잘못된 방향(implemented→partial)으로 되돌릴 위험이 있다. 코드 검토 범위 밖의
    프로세스 이슈이나, 병합 순서 확인이 필요하다는 점만 기록.
  - 제안: 조치 불요(정보 제공용) — 다만 이 diff 가 먼저 머지되면 `project-planner` 가 #1130 을
    재판정해야 한다는 점을 병합 담당자가 인지할 것.

## 인라인 주석·독스트링 품질 (양호한 부분)

- 신규 404/401 분기(`use-widget.ts:486-522`)의 인라인 주석은 근거 spec 섹션(`§3.1-2`, `§R4`,
  `EIA §8.3`/`EIA-AU-04`)을 정확히 인용하고, "왜 soft-fail 로 넘기면 안 되는가"를 각 분기마다
  명시해 향후 재발 방지에 도움이 된다.
- 신규 테스트 4건(§3.1-2 404 / §R4 401-성공 / §R4 401-재실패 / 500-여전히-soft-fail)의 설명
  텍스트는 각 분기가 서로 대칭인 정반대 귀결(복원 vs 종료)을 왜 한 테스트로 못 묶는지 근거를
  제시해 테스트 설계 의도가 명확하다.
- `spec/7-channel-web-chat/3-auth-session.md` §3.1 배너 정정(65-66행) 자체는 diff 범위 내에서
  정확하다 — "404·복구불가 401·낙관적 refresh 도 구현됐다(2026-08-10)"는 실제 코드와 일치하고,
  "그 외 status·오류는 여전히 catch soft-fail" 서술도 남겨진 `use-widget.ts:528` 의 실제 catch-all
  분기와 일치한다. **저장소 전체(§3.1-2/§R4/낙관적 refresh/pending_plans 축)를 grep 한 결과,
  이 스펙 문서 자신과 `spec/7-channel-web-chat/` 하위 다른 문서·`plan/in-progress/**`·
  `codebase/channel-web-chat/src/**` 어디에도 "미구현(Planned)"이 잔존한 곳은 없다** — 오직
  위 test docstring 의 frontmatter 이력 서술 1건만 사실과 어긋난다. `plan/complete/**`·
  `review/**` 아래 남아 있는 "미구현(Planned)" 인용들은 모두 과거 시점 스냅샷을 기록한 이력
  문서(archive 성격)라 갱신 대상이 아니다.

## 요약

기능 diff 자체(용어 축 정정 대상이었던 `3-auth-session.md` §3.1 배너)는 정확하게 갱신됐고, 저장소
전체를 "미구현(Planned)"·"후속 결정" 용어 축으로 훑어도 이 기능 영역에 남은 거짓 서술은 없다.
다만 이번 diff 가 **새로** 추가한 문서 3건에서 자체 결함이 발견됐다: (1) 신규 테스트 docstring 이
spec frontmatter 이력을 사실과 반대로 서술(정정된 `git log` 실측으로 반증), (2) 함수 최상단 JSDoc
계약(`실패 정책`·`@returns`·`SeedOutcome` 유니언 설명)이 새로 추가된 404/401 예외 분기를 반영하지
못해 부분적으로 stale, (3) 동일 기능 영역의 기존 관례(CHANGELOG 항목)를 따르지 않음. 모두 기능에
영향을 주지 않는 문서 정확성 문제이나, (1)은 정확히 이 브랜치가 반복해서 낸 "미구현/이력 서술"
클래스의 재발이다.

## 위험도

MEDIUM
