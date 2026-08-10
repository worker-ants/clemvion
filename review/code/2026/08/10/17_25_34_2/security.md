# 보안(Security) Review — `17_25_34_2` 라운드

## 스코프에 대한 메모

이번 프롬프트가 담은 13개 파일은 전부 (1) 직전 라운드(`17_15_33_2`)의 리뷰 산출물이 저장소에
커밋되는 diff(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`/`meta.json`), (2) 이번 라운드
자신의 `_retry_state.json`/`meta.json`, (3) `spec/7-channel-web-chat/3-auth-session.md` 의
문서 정정(§3.1-2 "재차 `401`" → "재차 `401`·`410`") 뿐이다. **애플리케이션 소스(`*.ts`) diff 는
이 프롬프트 페이로드에 없다.**

오케스트레이터가 알려준 delta — (a) `500` 테스트 케이스 고착 감지 보강(fake timer), (b) 게이팅
조건 `shouldAbortAfterSeed` 헬퍼 추출(순수 이동), (c) plan 등재 — 는 이 프롬프트에 diff 로
포함돼 있지 않으므로, 워킹트리를 건드리지 않는 `Read`/`Bash`(읽기 전용)로 현재 코드베이스를
직접 열어 그 서술이 사실인지, 그리고 그 변경이 보안에 영향을 주는지 독립적으로 확인했다
(뮤테이션 없음 — 이번 라운드는 새 뮤테이션 검증이 필요한 로직 변경이 아니라고 판단했다. 근거는
아래 "검증" 절).

## 검증 (읽기 전용, 워킹트리 무수정)

- `codebase/channel-web-chat/src/widget/use-widget.ts:120-122` — `shouldAbortAfterSeed(outcome)`
  헬퍼가 실제로 존재하며 `outcome !== "continue" && outcome !== "refresh_deferred"` 그대로다.
  호출부 두 곳(`:716` `start()`, `:1073` `applyConfig()`)이 리터럴 조건식 대신 이 헬퍼를 참조한다
  — 화이트리스트(fail-closed) 의미는 추출 전후 동일. **동작 변경 없음**을 코드로 재확인.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:501-544` —
  `§R4: refresh 가 \`500\` 으로 실패해도 종료로 확정하지 않는다` 테스트가 `vi.useFakeTimers`
  전환 + `advanceTimersByTimeAsync(20_000)` 후 `/refresh-token` 재호출 횟수(`after > before`)를
  단언하는 형태로 바뀌어 있다 — 네트워크-오류 케이스(같은 파일 448~499행)와 동일한 패턴. **테스트
  전용 변경**이며 프로덕션 코드 경로는 건드리지 않는다.
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts:88-103` — `.then()` 성공 분기는
  여전히 `openStream` 을 호출하지 않고, `.catch()` 실패 분기는 여전히 HTTP 상태코드를 구분하지
  않는다(401/410 이어도 storage 정리 없음). 이는 직전 라운드 side_effect reviewer 가 낸 CRITICAL/
  WARNING 이 **이번 delta 에서 손대지 않았음**을 뜻한다 — RESOLUTION.md 의 "plan 등재 + 범위
  명시" 처분과 일치한다.
- `plan/in-progress/webchat-auth-session-status-reconcile.md:181-215` — "미해결 —
  `refresh_deferred` 는 고착의 절반만 닫는다" 절이 실제로 존재하고, `- [ ]` 체크리스트로 (a)/(b)
  설계 택일과 회귀 검증 항목이 등재돼 있다. "plan 등재" 서술이 실제 파일과 일치함을 확인.

## 점검 관점별 결과

1. **인젝션**: 이번 라운드 diff 는 markdown/JSON 문서(리뷰 산출물) + spec 문서 정정뿐이라 신규
   인젝션 표면 없음. 독립 확인한 실제 코드 변경(테스트 fake timer, 헬퍼 추출)도 사용자 입력 처리
   경로가 아니다.
2. **하드코딩된 시크릿**: 없음. 테스트 fixture 의 `iext_y`/`iext_ok`(`use-widget-eager-start.test.ts`)
   는 합성 mock 토큰으로 이 파일의 기존 컨벤션과 동일하며 실 자격증명이 아니다.
3. **인증/인가**: `shouldAbortAfterSeed` 추출은 화이트리스트 fail-closed 의미를 그대로 보존한
   순수 이동(동치 뮤턴트가 정상 — 직전 라운드 RESOLUTION.md 가 이미 뮤테이션으로 확인). spec 문서의
   "재차 `401`·`410`" 정정은 종료 확정 조건을 **넓히는**(더 많은 경우를 종료로 fail-close 하는)
   방향이라 인가 완화가 아니다 — 직전 라운드 전담 security reviewer(`17_15_33_2/security.md`)가
   `git show`/코드 실측으로 이미 NONE 판정했고, 이번 검증에서도 코드가 그 판정과 다르지 않음을
   재확인했다.
4. **입력 검증**: 이번 라운드 diff 범위 밖(변경 없음).
5. **OWASP Top10**: 해당 없음 — 실질 코드 변경은 테스트/구조적 리팩터뿐.
6. **암호화**: 변경 없음.
7. **에러 처리**: `use-token-refresh.ts` 의 `.catch` 는 여전히 `console.warn` 진단 로그만 남기고
   사용자에게 별도 메시지를 노출하지 않는다 — 기존 정책과 동일, 새 노출 경로 없음.
8. **의존성 보안**: 이번 라운드에 패키지 변경 없음.

## 발견사항

- **[INFO]** (신규 아님, 추적 확인) 주기 갱신 실패 시 401/410 을 구분하지 않아 확정 종료 후에도
  sessionStorage 의 단명 토큰이 탭 종료까지 잔존하는 갭이 여전히 열려 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `scheduleRefresh` 콜백의
    `.catch` 블록(88~103번째 줄 구간, HTTP 상태코드 미분기).
  - 상세: 직전 라운드 side_effect reviewer 가 CRITICAL/WARNING 으로 지적했고, `RESOLUTION.md`
    가 "plan 등재 + PR 범위 명시" 로 명시적으로 defer 했다. 이번 라운드 delta(fake timer 테스트
    보강, `shouldAbortAfterSeed` 추출, plan 등재)는 이 파일을 변경하지 않으므로 새로 생긴 것도
    악화된 것도 아니다. 보안 영향은 낮음 — 해당 토큰은 per_execution 단명 토큰이고 종료 시 서버
    측 jti blacklist(EIA §8.3, EIA-AU-04)로 이미 무효화되므로, 클라이언트에 남은 잔존 토큰을
    재사용해도 서버가 거부한다(정보 노출·권한 상승 경로 아님). 다만 "stale 토큰 잔존 금지" 라는
    spec §3.1-3 불변식과는 여전히 어긋나 있어, plan 체크리스트가 실제로 처리될 때까지는 이
    비대칭이 남는다는 점만 기록해 둔다.
  - 제안: 별도 조치 불요(이미 `plan/in-progress/webchat-auth-session-status-reconcile.md` 로
    추적 중, `- [ ]` 체크리스트 확인). 조치는 project-planner/developer 턴의 몫.

## 요약

이번 라운드(`17_25_34_2`)의 diff 페이로드는 애플리케이션 소스 변경을 포함하지 않는다 — 직전
리뷰 라운드(`17_15_33_2`)의 리뷰 산출물이 저장소에 기록되는 diff와, 이번 라운드 자신의 상태
파일, 그리고 `spec/7-channel-web-chat/3-auth-session.md` 의 `401`→`401`·`410` 서술 확장뿐이다.
오케스트레이터가 알려준 실제 코드 delta(500 테스트 fake-timer 보강, `shouldAbortAfterSeed`
추출, plan 등재)는 읽기 전용으로 현재 코드베이스를 직접 열어 독립 확인했으며, 서술대로 (a) 테스트
전용 변경, (b) 동작을 바꾸지 않는 순수 리팩터, (c) 이미 존재하는 plan 문서에 실제로 등재된 항목
임을 모두 확인했다. 인젝션·하드코딩 시크릿·인가 완화·평문 전송·에러 메시지 노출 등 신규 보안
취약점은 발견되지 않았다. 유일하게 참고할 항목은 이미 알려져 plan 에 defer 된 토큰 저장소 정리
갭(서버측 blacklist 로 실질 악용 불가, INFO 수준)이며 이번 라운드가 그 노출 범위를 넓히지 않았다.

## 위험도

NONE
