# plan_coherence 검토

대상 PR: `claude/webchat-apibase-scheme` (`wc:boot` apiBase 스킴 검증 + `4-security.md §R0` 신설)

건드린 plan 둘:
- `plan/complete/webchat-boot-apibase-scheme-validation.md` — 이번 PR 안에서 `in-progress/` → `complete/` 이동 + §역할 경계 절 + 리뷰 라운드1 회고 추가
- `plan/in-progress/webchat-auth-session-status-reconcile.md` — `applyConfig` 조용한 early return 선재 갭 신규 등재

## 발견사항

- **[WARNING]** 새로 등재한 항목이 문서 자신의 "완료 조건" 표에 반영되지 않음
  - target 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` 파일 끝
    (`## \`applyConfig\` 의 조용한 early return`, 2026-08-11 `15_16_20` side_effect INFO 절)
  - 관련 plan: 같은 파일 상단(L7-L26)의 "완료 조건" 표 — 현재 9행(§frontmatter 재판정 ~
    §`16_09_40` provenance 사본)뿐이고 이번에 추가된 10번째 항목이 없다.
  - 상세: 이 문서는 스스로 정확히 이 실패 형태를 이미 경험하고 경고문으로 박아 뒀다 —
    "처음 '두 항목' 이라 적었는데 표는 그 뒤 다섯 행이 됐다 — **개수를 문장에 박으면 표가
    늘 때마다 조용히 거짓이 된다**" (L11-L12). 이번 PR 이 그 경고를 다시 어겼다: 새 섹션을
    추가하면서 표는 갱신하지 않았다. 표는 "전부 닫히면 `complete/` 로 옮긴다" 는 이동 판정의
    체크리스트 역할을 겸하므로, 다음에 이 plan 을 완료 이동시키려는 세션이 표만 보고 이
    항목의 존재를 놓칠 위험이 있다(본문 체크박스가 여전히 `[ ]` 로 남아 있어 §3 이동요건
    자체는 결국 막아 주지만, 표가 SoT 로서 기능하지 못하는 상태가 된다).
  - 제안: 표에 행 추가 — 예)
    `| §applyConfig 조용한 early return | 도달 가능성 실측 후 — 도달 가능하면 dispatch/회귀,
    불가하면 주석 고정 |`

- **[INFO]** 새 섹션 본문에 미치환 placeholder `#PR` 잔존
  - target 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md`,
    "``wc:boot`` apiBase 스킴 검증(`#PR`, `plan/complete/webchat-boot-apibase-scheme-validation.md`)이"
  - 상세: `#PR` 이 실제 PR 번호/링크로 치환되지 않고 리터럴 텍스트로 남았다. 기능·게이트 영향은
    없다(마크다운 링크 문법이 아니라 인라인 코드라 링크 무결성 가드 대상도 아님). 문서 정확도만의
    사소한 흠이다.
  - 제안: 다음에 이 절을 편집할 때 실제 PR 번호로 치환.

- **[INFO — 확인 완료, 문제 없음]** `owner: developer + planner` 값은 저장소 규약과 충돌하지 않는다
  - target 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter L5
  - 확인 내용:
    - `plan-lifecycle.md §4` 는 `owner: <역할/이름> # planner / developer / 사용자 본인 등` 로
      **예시**만 나열할 뿐 어휘를 닫힌 enum 으로 제한하지 않는다.
    - 가드(`plan-frontmatter.test.ts` → `checkPlanFrontmatter`, `plan-scan.ts:319-322`)는
      `owner` 에 대해 **"non-empty string 인가"** (`owner-missing`) 하나만 검사한다. 값의
      어휘·형식은 보지 않는다. `gray-matter` 파싱도 인라인 YAML 주석(`# 아래 §역할 경계 참조…`)을
      정상적으로 분리해 `owner: "developer + planner"` 로 파싱됨을 직접 확인했다.
    - 저장소에 이미 같은 패턴의 선례가 있다 — `plan/complete/c1-engine-split.md`
      (`owner: developer (+ project-planner spec-sync)`), `plan/complete/web-chat-quality-backlog.md`
      /`plan/complete/webchat-polish-batch.md` (`owner: project-planner + developer`). 이번
      PR 의 `developer + planner` 는 이 선례 계열의 연장이다.
    - 다만 미묘한 지점: `checkPlanFrontmatter` 는 top-level `plan/in-progress/*.md` 만 스캔한다
      (`collectLivePlanMarkdown`). 이 plan 은 애초에 커밋 `3f1169ab5` 에서 생성과 동시에
      `plan/complete/` 로 들어갔고(원래 `owner: developer` 단일값), `owner` 를 `developer + planner`
      로 바꾼 것은 그 다음 커밋(`d8abc7003`)에서 **이미 `complete/` 에 있는 상태**였다. 즉 이
      값은 frontmatter 가드가 실제로 스캔하는 대상이 된 적이 없다(구조적으로 guard 밖). 그래도
      값 자체가 통과 가능한 형태이고 선례와 일치하므로 처분에는 영향 없음 — 참고 사항으로만 남긴다.

## 라이프사이클 이동 요건 검증 (§3)

- 체크박스: `plan/complete/webchat-boot-apibase-scheme-validation.md` 전량 `[x]`, 잔여
  `- [ ]`/`TODO`/`결정 필요`/`남은 작업` 문자열 0건 확인(grep).
- 이동 시점/방식: `git show --name-status -M 3f1169ab5` 로 `plan/in-progress/…` 삭제 +
  `plan/complete/…` 추가가 **같은 커밋**에서 일어남을 확인(별 PR 분리 아님). PROJECT.md 는
  이동 방식을 별도 지정하지 않아 기본(history 보존, 단순 복사·삭제 아님) 요건 충족.
- `spec_impact`: 리스트 `[spec/7-channel-web-chat/4-security.md]`, 파일 실존 확인
  (`makeSpecExists` 규칙대로 `spec/` 하위 실재 `.md` 파일). Gate C 컷오프(`started: 2026-07-24`
  ≥ 2026-06-04)도 적용 대상이라 강제가 실제로 걸렸다.
- `status: complete` — `TERMINAL_PLAN_STATUSES` 에 포함된 유효 종료값.
- 인입 참조 전수: 저장소 전체 grep 결과, 옛 경로
  (`plan/in-progress/webchat-boot-apibase-scheme-validation.md`)를 가리키는 살아있는 문서는
  없다. 형제 3개 plan(`webchat-usewidget-extraction.md`,
  `webchat-command-failure-is-not-termination.md`, `webchat-spec-rationale-followup.md`) 어디에도
  이 plan 에 대한 참조가 없다(신설 당시부터 참조된 적이 없어 stale 화될 대상도 없음). 유일하게
  옛 경로를 언급하는 문서는 전부 `review/**`(시점 기록) — `plan-lifecycle.md §3` 이 그 경로는
  "옛 경로 유지"로 정상 취급한다. 살아있는 spec 문서(`4-security.md`, `2-sdk.md`)에는 이 plan
  경로에 대한 참조 자체가 없다(frontmatter `pending_plans` 도 미사용, `status: implemented` 로
  이 완료와 무모순).

## 미해결 결정 충돌 / 선행 plan 미해소 (§1·§2 관점)

- target(완료 plan)이 다른 in-progress plan 의 "결정 필요" 항목을 우회해 일방 결정한 사례 없음.
  `webchat-boot-apibase-scheme-validation.md` 자체가 이 PR 의 유일한 결정 지점("wc:boot 스킴
  검증 적용 여부")이고, 그 판정 근거(위젯이 항상 CDN origin iframe 에서 돈다)는 다른 plan 의
  미해결 결정과 무관하다.
- target 이 가정하는 선행 조건(SDK 가 iframe 쿼리와 `wc:boot` 양쪽에 같은 `apiBase` 를 보낸다,
  세션이 발급 origin 에 바인딩된다)은 모두 `webchat-session-apibase-binding.md`(이미 `complete/`)
  로 이미 종결돼 있다 — 미해소 선행 plan 없음.

## 후속 항목 반영 (§3 관점)

- 이번 하드닝이 `applyConfig` 의 침묵 early-return 분기 도달 빈도를 넓혔다는 부수 발견을
  `webchat-auth-session-status-reconcile.md` 에 새 절로 등재한 것은 이 저장소가 반복 학습한
  "형제 티켓 분리/등재" 관행과 형식(날짜+reviewer 성격+등급 태그, "처리" 체크리스트)에 부합한다.
  다만 위 WARNING(완료 조건 표 미반영)이 그 등재의 완결성에 흠을 남긴다.

## 요약

이번 PR 의 plan 이동(`webchat-boot-apibase-scheme-validation.md` → `complete/`)은
`plan-lifecycle.md §3/§4/§5` 의 이동 요건(체크박스 전량 완료, 같은 커밋 이동, `spec_impact`
리스트, 유효 종료 status, 인입 참조 무결)을 모두 충족하며 CRITICAL 은 없다. `owner: developer +
planner` 는 가드가 검사하지 않는 자유 문자열이고 저장소에 이미 3건의 동형 선례가 있어 규약
위반이 아니다. 유일한 실질 흠은 `webchat-auth-session-status-reconcile.md` 에 새로 등재한 항목이
그 문서 자신이 "완료 조건" SoT 로 쓰는 상단 표에 반영되지 않은 것(WARNING) — 이 문서가 스스로
경고해 둔 "표가 조용히 거짓이 된다" 실패 형태의 재발이다. 병합을 막을 사유는 아니되 다음 편집
시(또는 이번 PR 안에서) 표 갱신을 권한다.

## 위험도

LOW

STATUS: OK
