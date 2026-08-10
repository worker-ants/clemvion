# 문서화(Documentation) Review

대상: 웹채팅 위젯 재로드 REST 오류 분기(§3.1-2·§R4) 전체 브랜치 diff(`origin/main` 대비), 특히
직전 CRITICAL 2건(CHANGELOG 세 번째 갈래 신설 + 4번째 갈래 표기, 유실 WARNING 2건 처분)의 반영
여부를 액면가로 받지 않고 코드·git 이력을 직접 대조해 확인했다.

## 확인 방법

- `CHANGELOG.md`, `spec/7-channel-web-chat/3-auth-session.md`(배너·§R4·frontmatter),
  `spec/0-overview.md`, 관련 plan 4곳(`plan/complete/web-chat-quality-backlog.md`,
  `plan/complete/webchat-reload-rest-error-branches.md`,
  `plan/in-progress/webchat-command-failure-is-not-termination.md`,
  `plan/in-progress/webchat-usewidget-extraction.md`,
  `plan/in-progress/webchat-auth-session-status-reconcile.md`)를 직접 `Read`.
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts`·`use-widget.ts`·
  `src/lib/eia-client.ts`·`src/lib/session-store.ts` 를 직접 열어 JSDoc과 실제 로직(재시도
  백오프, `onRefreshed`→`openStream` 배선)을 line-level 대조.
- `git log`/`git show --stat`로 처분 커밋(`410705910`·`092d784a3`·`51e8c72e8`)이 실제로 어떤
  파일을 건드렸는지 확인.
- 저장소 전체(`spec/`, `plan/`, `CHANGELOG.md`, `codebase/channel-web-chat/src`)에서 `미구현`·
  `in-progress/webchat-reload-rest-error-branches` 잔존 여부 grep.

## 발견사항

- **[CRITICAL]** `plan/in-progress/webchat-auth-session-status-reconcile.md` 가 **이미 고쳐진
  결함을 여전히 "미해결"로 서술**한다 — CHANGELOG·코드·RESOLUTION 과 모순.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:18`(완료 조건 표 — `§비-terminal refresh 실패 후 스트림 부재 | 실측 완료 — 결함 확정. 아래 §미해결 참조`), `:190-228`(`## 미해결 — refresh_deferred 는 고착의 절반만 닫는다` 섹션 전체, 특히 `:212-225` "왜 이 PR 에서 안 고치는가"와 `:227-228`의 미체크 항목 `- [ ] (a)/(b) 중 선택` / `- [ ] 선택 후 회귀: refresh 성공 뒤 스트림이 열리는지 / Composer 가 풀리는지`).
  - 상세: 이 절은 "갱신 성공 후 스트림을 열어 주는 배선이 없다(원인 B)"를 **미해결**로 확정하고, 해법 3택(a/b/c) 중 아무것도 이 PR에서 고르지 않았다고 적는다. 그러나 실제로는 커밋 `410705910`("fix(webchat): \`refresh_deferred\` 가 약속한 복구가 실제로는 없었다 — 두 절반 다 닫음")이 정확히 이 절이 나열한 옵션 (a)를 구현했다 — `use-token-refresh.ts` 에 `onRefreshed` 콜백을 추가하고(`:75`, `:152-155`), `use-widget.ts` 가 `deferredStreamRef`/`resumeDeferredStreamRef` 로 미뤄 둔 스트림 오픈을 기록·재생한다(`use-widget.ts:262-276`, `:742-748`). 실패 재예약도 `.catch()` 에서 `isTerminalAuthError` 로 분기해 지수 백오프로 재예약한다(`use-token-refresh.ts:158-172`). 이 사실은 같은 세션의 `CHANGELOG.md:172`("이 복구 경로는 두 군데가 비어 있어 실제로는 작동하지 않았고 ... 둘 다 닫았다")와 `review/code/2026/08/10/17_25_34_2/RESOLUTION.md` §C1("고침")에도 이미 기록돼 있다 — 즉 이 plan 문서만 갱신에서 빠졌다. `git log --oneline -- plan/in-progress/webchat-auth-session-status-reconcile.md` 로 확인한 결과 이 파일을 마지막으로 건드린 커밋은 병합 커밋 `51e8c72e8`(`origin/main` 충돌 해소)이고, `410705910`·`092d784a3`(CHANGELOG·spec·JSDoc 3곳을 명문화한 문서 커밋) 어느 쪽도 이 파일을 건드리지 않았다. 게다가 `plan/complete/webchat-reload-rest-error-branches.md:78-80`가 "전말은 \`webchat-auth-session-status-reconcile.md\`"라고 이 문서를 **유일한 상세 출처**로 가리키고 있어, 이 경로를 따라오는 다음 세션·에이전트는 "원인 B가 아직 미해결이고 설계 선택 3택 중 하나를 골라야 한다"는 **거짓 전제**로 재조사·재구현을 시도하거나 이미 구현된 옵션(a)와 충돌하는 옵션(c)(종료로 되돌리기)을 고를 위험이 있다. CLAUDE.md 정보 저장 원칙상 `plan/`이 진행 중 작업의 단일 진실이고 `review/**`는 SoT가 아니므로, `RESOLUTION.md`에만 "고침"이 적힌 것으로는 이 plan의 오류가 상쇄되지 않는다.
  - 제안: `:18`의 표 행과 `:190-228`의 "미해결" 절을 "해결됨(`410705910`, 2026-08-10)"으로 갱신하고, 실제 채택한 방식(옵션 a — `onRefreshed` 통지 콜백 패턴, `useTokenRefresh` 의 단일 책임은 유지한 채 `use-widget` 이 스트림 오픈 소유권을 갖는 형태)을 짧게 기록. `:227-228`의 두 미체크 항목은 체크하거나 "완료 — 실제 구현은 아래 참조"로 대체. 완료 조건 표(`:9-20`)의 해당 행도 함께 갱신.

- **[INFO]** 테스트 JSDoc 이 병행 PR(#1130) 상태를 여전히 진행형으로 서술
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:261-263` — `"그 모순 자체가 별도 PR 의 CRITICAL 대상이다(그 PR 이 \`partial\` + \`pending_plans:\` 로 정정 중)."`
  - 상세: `#1130`은 이미 머지돼(`51e8c72e8` 병합 로그, `spec/7-channel-web-chat/3-auth-session.md` frontmatter가 현재 `status: implemented`이고 `pending_plans:` 필드도 없음) 정정이 완료된 상태인데, 이 JSDoc은 "정정 중"이라는 진행형을 유지한다. 기능적 영향은 없고(테스트는 통과하며 서술 자체는 역사적으로 정확했다), 다음에 이 테스트 파일을 여는 사람이 "아직 진행 중인 조정"으로 오독할 여지만 남긴다. 같은 세션이 이미 8차례 "동일 형태(오래된 진행형 서술)"를 지적·수정한 이력이 있어(RESOLUTION 16_09_40 §6 등) 재발 패턴에 해당한다.
  - 제안: "정정 중" → "정정했다(`#1130` 머지, `plan/in-progress/webchat-auth-session-status-reconcile.md` 로 조정 절차 마감)"로 갱신. 우선순위는 낮음 — 다음 이 파일을 편집하는 김에 함께 고치는 정도로 충분.

- **[INFO]** (정합성 확인, 조치 불요) CHANGELOG·spec·JSDoc·plan 4곳 링크는 실측 결과 모두 일치
  - 위치: `CHANGELOG.md:166-174`(세 번째 갈래 신설)·`:200`(4-state 표기 추가), `spec/7-channel-web-chat/3-auth-session.md:66`(배너)·`:85-89`(§3.1-2)·`:104-117`(§R4)·frontmatter `:1-13`(`status: implemented`, `pending_plans` 없음), `spec/0-overview.md:82`, `plan/complete/web-chat-quality-backlog.md:26`·`plan/in-progress/webchat-usewidget-extraction.md:175`·`plan/in-progress/webchat-command-failure-is-not-termination.md:35`(모두 `../complete/webchat-reload-rest-error-branches.md` 또는 `./webchat-reload-rest-error-branches.md`로 정정된 상대링크).
  - 상세: 저장소 전체(`spec/`, `plan/`, `CHANGELOG.md`, `codebase/channel-web-chat/src`)를 `in-progress/webchat-reload-rest-error-branches`·`미구현`으로 grep한 결과 살아있는 참조는 전부 `review/**`(SoT 아님, 역사 기록)뿐이었고, `3-auth-session.md` 본문의 "미구현" 언급 1건도 "미구현이 아니라 의도된 경계다"라는 정정된 문맥 안에 있었다. `use-token-refresh.ts` 최상단 JSDoc(`:78-95`)도 "종전엔 한 갈래(멈춤) — 그래서 한 번 실패하면 갱신 사이클이 죽었다"를 **과거형**으로 명확히 구분해 서술하고, 이어지는 "실패는 두 갈래다"가 현재 구현(401/410 멈춤 vs 그 외 지수 백오프 재예약)과 정확히 일치해 방금 고친 결함을 여전히 현재형으로 설명하는 문제는 없었다.
  - 제안: 없음(참고용).

## 요약

CHANGELOG의 새 서술(세 번째 갈래 + 4-state 표기)은 실제 구현(코드·git 이력으로 확인)과 정확히
일치하며 구현보다 넓게 약속하지 않는다. 배너·§R4·frontmatter·`spec/0-overview.md`·plan 4곳
링크도 전수 확인 결과 서로 모순이 없고, `use-token-refresh.ts` 최상단 docstring도 방금 고친
결함을 과거형으로 정확히 구분해 서술한다 — 요청받은 세 가지 확인 항목은 모두 통과했다. 다만
그 과정에서 별도의 새 결함을 발견했다: `plan/in-progress/webchat-auth-session-status-reconcile.md`
의 "미해결" 절이 **이미 코드로 고쳐진 결함(원인 B — 갱신 성공 시 스트림 재오픈 부재)을 여전히
미해결·설계 선택 대기 상태로 서술**하고 있다. 이 문서는 완료된 plan(`webchat-reload-rest-error-branches.md`)
이 "전말"의 유일한 출처로 가리키는 자리라, 다음 세션이 이 경로를 따라오면 거짓 전제 위에서
재조사하거나 이미 구현된 방식과 충돌하는 대안을 고를 위험이 있다.

## 위험도

HIGH
