# 문서화(Documentation) Review — webchat-apibase-scheme (델타: 커밋 `d8abc7003`)

## 사전 확인 절차

- `d8abc7003`(fix(webchat): 리뷰 CRITICAL 2건 처분)의 실제 diff를 `git show`로 별도 확인해, 프롬프트에 실린
  누적 diff(파일 1~7) 중 **이번 델타가 실제로 건드린 부분**과 **직전 라운드(`15_16_20`)에서 이미 검토된
  부분(커밋 `3f1169ab5`)**을 구분했다.
  - 이번 델타가 실제로 건드린 것: `use-widget.ts`(deprecated 별칭 삭제 + 캐스트 제거), `use-widget.test.ts`
    (별칭 7곳 치환 + `as never`→`Partial<BootMessage>`), `use-widget-eager-start.test.ts`(신규 통합 테스트 2건),
    `plan/complete/webchat-boot-apibase-scheme-validation.md`(§역할 경계 + §리뷰 라운드1 절 신설, `owner` 갱신),
    `plan/in-progress/webchat-auth-session-status-reconcile.md`(§`applyConfig`의 조용한 early return 신설),
    `spec/7-channel-web-chat/4-security.md`(§R0의 진단-위치 정정 blockquote 추가).
- `use-widget.ts`의 실제 코드(`applyConfig`, `safeApiBase`, `mergeBootConfig`)를 직접 열어 §R0/plan의 서술과
  대조했다.

## 발견사항

- **[CRITICAL]** `safeApiBase` JSDoc(코드)에 §R0에서 이미 "거짓"으로 정정한 것과 **동일한 문장**이 그대로 남아 있다
  — 이번 델타가 spec만 고치고 소스 주석은 놓쳤다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:191`
  - 상세: 이 줄은 여전히 "`apiBase` 가 결국 없으면 `applyConfig` 가 자기 자리에서 실패한다" 라고 적혀 있다.
    그런데 같은 커밋(`d8abc7003`)이 `spec/7-channel-web-chat/4-security.md §R0`와
    `plan/complete/webchat-boot-apibase-scheme-validation.md`(§리뷰 라운드1)에 **정확히 이 문장을 인용해
    "거짓이다" 라고 정정**했다 — `applyConfig`의 실제 코드(`use-widget.ts:1220-1233`)를 직접 읽어 확인한
    결과도 정정이 맞다: `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;`(1221행)은 `warn`도
    `dispatch`도 없는 조용한 early return이고, 바로 아래(1228-1233행) 자매 분기(origin allowlist 실패)만
    `dispatch({ type: "BLOCKED", ... })`를 낸다. 즉 **정정 자체는 옳다.** 문제는 그 정정이 `4-security.md`와
    plan에는 반영됐는데, 정작 "코드 SoT"로 지목된 `safeApiBase`의 JSDoc(같은 파일, 25줄 위)에는 **반영되지
    않고 원래의 거짓 문장이 그대로 남았다**는 점이다. `git show d8abc7003 -- use-widget.ts`로 확인한 실제
    diff는 이 함수의 deprecated 별칭 삭제와 `mergeBootConfig` 호출부 캐스트 제거만 건드렸고, 166-196행의
    JSDoc 블록은 전혀 건드리지 않았다.
  - 왜 문제인가: `plan/complete/...md`의 체크리스트는 "적용 근거를 `4-security.md §R0`(기각한 대안 포함)과
    `safeApiBase` JSDoc **양쪽에** 남겼다" 라고 명시적으로 주장하는데, 실제로는 그 "양쪽"의 내용이 서로
    모순된 상태다. `safeApiBase`는 스펙 문서가 명시한 "코드 SoT"이므로, 이후 이 함수를 만지는 사람(에이전트
    포함)이 가장 먼저 읽는 자리다. 여기서 "apiBase가 없으면 applyConfig가 알아서 실패를 진단한다"는 거짓
    확신을 얻으면, `webchat-auth-session-status-reconcile.md`에 방금 등재된 "조용한 early return을 관측
    가능하게 만들자"는 TODO의 긴급성을 스스로 낮춰 보게 된다 — 이 PR이 직접 겪은 "정정문이 또 틀렸다" 패턴이
    한 칸 다른 형태(정정을 한 곳에만 반영)로 재발한 사례다.
  - 제안: `use-widget.ts:190-191`의 "거절 시 그 필드만 버린다(부팅 자체를 막지 않는다) — 쿼리 경로의 기존
    동작과 대칭이고, `apiBase` 가 결국 없으면 `applyConfig` 가 자기 자리에서 실패한다." 를 §R0의 정정 문구와
    동형으로 바꾼다(예: "…쿼리 경로의 기존 동작과 대칭이다. 진단은 거절 지점(`console.warn`)에만 있다 —
    `apiBase`가 결국 없으면 `applyConfig`는 `warn`도 `dispatch`도 없이 조용히 반환한다(선재 갭,
    `webchat-auth-session-status-reconcile.md` 참조)."). 이렇게 하면 `4-security.md §R0` /
    `webchat-auth-session-status-reconcile.md` / `use-widget.ts` 세 자리가 다시 정합한다.

- **[WARNING]** `webchat-auth-session-status-reconcile.md`에 이번 델타로 신설된 추적 항목이 문서 최상단
  인덱스 표에 반영되지 않았다 — 이 문서가 스스로 명문화한 "표는 항목이 늘 때마다 조용히 거짓이 된다"는
  규율을 이 델타에서 어겼다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:319`(신설 절 `## \`applyConfig\` 의
    조용한 early return`) / 같은 파일의 표(14-24행 부근, `> | 항목 | 완료 조건 |` 로 시작하는 인덱스)
  - 상세: 이 문서 맨 위 blockquote는 "처음 '두 항목'이라 적었는데 표는 그 뒤 다섯 행이 됐다 — 개수를 문장에
    박으면 표가 늘 때마다 조용히 거짓이 된다"고 명시하며, 실제로 `§refresh 동시 발화 경합`·`§catch 분기 세대
    재검사 미검증`·`§start()/applyConfig 꼬리 블록 중복`·`§runApplyConfig catch stale 가드`·
    `§16_09_40 provenance 사본 "2명"` 등 열려 있는 미해결 절은 전부 이 표에 행이 있다. 그런데 이번 델타가
    새로 추가한 `## applyConfig 의 조용한 early return`(체크박스 3개, 아직 전부 미완료)만 표에 행이 없다 —
    같은 파일이 방금 스스로 지목한 실패 형태를 같은 델타에서 재현했다.
  - 제안: 표에 `| §applyConfig 조용한 early return | 도달 경로 전수 확인 후 — 관측 가능화 + 회귀 |` 같은 행을
    추가한다.

- **[INFO]** 새 추적 항목에 채워지지 않은 템플릿 자리표시자 `` `#PR` `` 가 남아 있다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:331`
  - 상세: "`wc:boot` apiBase 스킴 검증(`#PR`, `plan/complete/webchat-boot-apibase-scheme-validation.md`)이…"
    — 저장소의 다른 plan 문서(`plan/in-progress/node-output-redesign/information-extractor.md:3`)는 같은
    관례를 쓸 때 항상 실제 식별자를 채운다(예: `#PR 78594c71`, `#484`). 이 자리만 리터럴 `#PR` 그대로 남아
    실제 PR 번호/해시로 치환되지 않았다. 뒤에 plan 경로가 함께 적혀 있어 추적 자체는 가능하지만, 표기
    관례에서 벗어난다.
  - 제안: 실제 PR 번호(또는 이 delta의 커밋 해시 `d8abc7003`)로 치환하거나, 번호를 아직 모른다면
    `(이 PR, plan/complete/...)` 처럼 `#PR` 리터럴을 쓰지 않는 표현으로 바꾼다.

- **[INFO]** `plan/complete/webchat-boot-apibase-scheme-validation.md` §관련 섹션이 이번 델타로 사라진
  식별자 `safeApiBaseFromQuery`를 코드 내비게이션 앵커로 계속 인용한다.
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:51`("- `codebase/channel-web-chat/src/
    widget/use-widget.ts` (`safeApiBaseFromQuery`, `wc:boot` 처리)")
  - 상세: 이번 델타(그리고 직전 커밋 `3f1169ab5`)가 `safeApiBaseFromQuery`를 완전히 삭제했다 —
    `codebase/`·`spec/`·`plan/in-progress/` 전체에서 grep 0건(남은 참조는 `plan/complete/`의 다른 완료
    plan과 `review/`의 과거 리뷰 산출물뿐이며 이들은 역사 기록이라 문제 아님). `§문제` 섹션이
    `safeApiBaseFromQuery`를 언급하는 것은 "PR 시작 시점의 문제 서술"이라 역사적으로 정당하지만, `§관련`은
    통상 "지금 코드에서 무엇을 찾아보면 되는가"를 가리키는 자리라, 여기 인용된 식별자로 grep하면 아무것도
    안 나온다.
  - 제안: `§관련`의 괄호 안을 현재 식별자(`safeApiBase`, `mergeBootConfig`)로 갱신한다. 우선순위는 낮다 —
    바로 아래 §Rationale·§완료·§역할 경계 절이 최신 식별자를 이미 반복해서 쓰고 있어 실제 혼선 위험은 작다.

- **[검증 완료, 새 CRITICAL 없음]** 오케스트레이터가 지목한 항목 1·2·3·5는 실측 결과 문제 없다.
  1. §R0 정정문("진단은 거절 지점에만 있다" / "자매 분기가 `BLOCKED`를 dispatch하는 것과 비대칭")은
     `use-widget.ts:1220-1233`의 실제 `applyConfig` 코드와 정확히 일치한다(1221행 조용한 early return,
     1228-1233행 `BLOCKED` dispatch). **정정 내용 자체는 참이다** — 다만 위 CRITICAL이 지적하듯 이 정정이
     `safeApiBase` JSDoc까지 전파되지 않았다.
  2. plan의 라운드1 회고 수치도 실측과 일치한다 — `use-widget.test.ts`의 `mergeBootConfig` describe는
     정확히 `it(` 6건(65-124행), `use-widget-eager-start.test.ts`의 신규 통합 describe는 정확히 2건
     (`d8abc7003` diff로 확인). "소비처 1곳"도 grep으로 확인: 삭제 전 `safeApiBaseFromQuery` 호출부는
     `use-widget.test.ts` 한 파일에만 7곳(수정 diff에서 실측 — import 1 + 호출 6쌍이 아니라 정확히 함수
     호출 7회) 있었고, 다른 소비 파일은 없었다. "회귀 5건 → 실제 6건" 정정도 체크리스트·diff와 정합한다.
  3. `webchat-auth-session-status-reconcile.md`의 신설 등재문은 `applyConfig` 코드 스니펫과 dispatch 대비
     서술이 실제 소스와 정확히 일치한다(위 CRITICAL과 별개로, 본문 자체의 정확성은 문제없다). 다만 인덱스
     표 미동기화는 WARNING으로 별도 지적했다.
  5. `4-security.md`를 두 번(§1 표 행 `3f1169ab5`, §R0 blockquote `d8abc7003`) 고친 것은 서로 모순되지
     않는다 — 표 행은 "두 경로 모두 http(s)만 허용, 부적합 시 그 필드만 무시 + warn"이라는 정책 요약이고,
     §R0 blockquote는 그 정책의 "왜"와 "진단이 어디서 나는가"를 상세히 설명하는 것으로 서로 보완 관계다.
     `mergeBootConfig`의 실제 구현(`safeApiBase(boot.apiBase, "wc:boot") ?? fromQuery.apiBase`)과도
     둘 다 부합한다 — 거절/부재 모두 쿼리 값으로 폴백하고, 거절만 `console.warn`을 낸다.

- 항목 4(`safeApiBaseFromQuery`를 인용하던 문서 잔존)는 INFO로 위에 기재했다 — 활성 코드/spec에는 없고
  `plan/complete/`의 §관련 섹션 1곳만 남아 있다.

## 그 외 관점 (README/CHANGELOG/설정 문서/예제)

- README 업데이트 필요성: 없음 — 위젯 내부 하드닝 강화이며 공개 API·환경변수·설정 옵션 변경이 없다.
- API 문서: 해당 없음 — 엔드포인트 변경 없음.
- 설정 문서(환경변수 등): 신규 env/설정 없음.
- 예제 코드: `safeApiBase`/`mergeBootConfig`의 JSDoc과 신설 테스트(6+2건)가 사용법·경계 조건을 충분히
  예시하고 있어 별도 사용 예제 불요.
- CHANGELOG: 이 저장소는 plan 기반 이력 관리를 쓰며 별도 CHANGELOG 파일 관행이 없음 — 해당 없음.

## 요약

이번 델타(`d8abc7003`)는 직전 라운드의 CRITICAL 2건(호출부 미검증, 거짓 정당화)과 side_effect INFO 1건
(§R0 거짓 서술)을 처분했고, §R0의 정정 내용 자체·plan 회고 수치·자매 plan 등재문·`safeApiBaseFromQuery`
정리는 모두 실측과 정합해 새로운 오류가 없다. 다만 정정 작업이 **불완전하게 전파**됐다는 새 문제를
발견했다 — `use-widget.ts`의 `safeApiBase` JSDoc(코드 SoT로 지목된 자리)이 spec에서 방금 "거짓"으로
판정한 문장을 그대로 담고 있어, 같은 커밋 안에서 정정된 사실과 정정되지 않은 사실이 공존한다. 여기에
`webchat-auth-session-status-reconcile.md`의 인덱스 표 미동기화(같은 문서가 스스로 지목한 실패 형태의
재발)까지 더해져, "한 사실을 여러 곳이 복제하면 한 곳만 고치고 넘어간다"는 이 저장소의 반복 패턴이
이번 델타에서도 관측된다. 기능적 위험은 없으나(코드 동작은 정상이며 회귀 테스트로 고정됨), 문서
신뢰도 관점에서는 CRITICAL 1건 + WARNING 1건으로 조치가 필요하다.

## 위험도

HIGH
