# Rationale 연속성 검토 — webchat-spec-rationale-followup (§R7·§R8 신설)

## 사전 고지 — 번들 프롬프트 갭

`_prompts/rationale_continuity.md` 에 자동 첨부된 "관련 Rationale 발췌" 번들은 **컨텍스트 예산 초과로
`spec/7-channel-web-chat/2-sdk.md`·`3-auth-session.md`·`4-security.md` 3건을 전부 누락**했다
(파일 하단 "⚠ 컨텍스트 예산 초과로 생략된 파일 77개" 목록에 정확히 이 3건이 포함돼 있다). 이는 본 리뷰의
직접 대상 파일이므로, 번들에 의존하지 않고 워킹트리에서 `Read`/`git diff`로 직접 대조했다.

## 확인 방법

- `git diff -- spec/7-channel-web-chat/{2-sdk,3-auth-session,4-security}.md plan/in-progress/webchat-spec-rationale-followup.md` 로 실제 편집분 확인
- `codebase/channel-web-chat/src/widget/use-widget.ts` (JSDoc, L380-430) 원문 대조
- `codebase/channel-web-chat/src/lib/session-store.ts` (`loadSession`, L55-98) 원문 대조
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (`normalizeApiBase`, L51-56) 원문 대조
- `plan/complete/webchat-boot-single-flight.md` 전체 이력(9~12번째 "거울상", A-6 되돌림) 대조
- `plan/complete/webchat-session-apibase-binding.md` 전체 이력(레거시 세션 폐기 결정·naming_collision CRITICAL) 대조
- `plan/in-progress/webchat-command-failure-is-not-termination.md` (열린 A/B/C 결정) 대조

## 발견사항

발견된 CRITICAL·WARNING 없음. 4개 점검 항목 모두 아래와 같이 실측 확인됨.

- **[INFO] 번들 프롬프트가 target 파일 3건을 예산 초과로 누락**
  - target 위치: `_prompts/rationale_continuity.md` 하단 "컨텍스트 예산 초과로 생략된 파일 77개" 목록 중
    `spec/7-channel-web-chat/{2-sdk,3-auth-session,4-security}.md`
  - 과거 결정 출처: 해당 없음 (프로세스 이슈, Rationale 내용 문제 아님)
  - 상세: 이번 라운드가 정확히 이 3개 문서의 Rationale 신설/편집을 검토하는 작업인데, 번들이 그 문서들 자체를
    빠뜨렸다. 이번엔 직접 `Read`로 우회해 실질 검토를 완료했으나, orchestrator 쪽 번들링 로직(consistency
    `--spec` 예산 산정)이 "지금 편집 중인 target 파일"을 우선순위 없이 예산에서 탈락시킬 수 있다는 기존
    관측(memory: `feedback_consistency_spec_mode_budget`)이 이번에도 재현됐다.
  - 제안: 이 checker 자체는 조치 불필요(직접 대조로 커버됨). orchestrator 쪽에서 diff 대상 파일을 번들
    우선순위 최상단에 고정하는 개선을 고려할 가치가 있다.

### 점검 1 — §R7 "표면 되감기 방어는 세션 확립 축" 서술의 정확성

**결론: 왜곡·과장 없음. `use-widget.ts` JSDoc(L380-430)의 서사를 충실히 spec 언어로 옮겼다.**

- "boot 세대 축이 두 번 구멍 났다" — JSDoc 원문: *"boot 세대 비교는 그 proxy 였고 두 번 구멍이 났다 — (1)
  호출부 checkpoint 2 는 함수 **반환 뒤** 만 보는데 `WAITING` dispatch 는 함수 **안쪽**이라 안 닿았고(18_39_11),
  (2) `start()` 가 진입 시점 boot 을 캡처하면 아무것도 복원 못 하는 no-op 재전송이 `bootGenRef` 만 올려
  start() 자신을 거짓 stale 처리해 스피너에 고착시켰다(00_51_53, 3인 재현)."* — §R7 텍스트는 이 두 구멍의
  메커니즘을 거의 그대로(용어만 spec 어휘로 치환) 서술한다. 과장·누락 없음.
- "짝 가드가 microtask 경계 때문에 필요하다" — JSDoc 원문: *"`await seedWaitingFromStatus` 와 호출부의
  `openStream` 사이엔 microtask 경계가 있어, 겹친 두 seed 가 같은 flush 에서 resolve 하면 둘 다 seed
  시점엔 스트림 미열림을 보고 통과한 뒤 각자 continuation 에서 `openStream` 을 부를 수 있다(초기 JSDoc 이
  '동기 실행이라 원천 차단된다' 라 적었으나 그 경계를 간과한 오판)."* — §R7 이 그대로 옮김. "낭비성 두 번째
  연결 생성 자체를 없앤다"까지 정확히 일치.
  - 종료 확정 vs 표면 갱신 2-정책 표(spec R7 표 vs JSDoc L398-401 표)도 문구까지 거의 동일.
  - "예외 — 버퍼 만료 재동기화" 절도 JSDoc `allowWhileStreaming` 주석과 정합.
- 이력 대조(`plan/complete/webchat-boot-single-flight.md` L379-445, "9~12번째 거울상")로 "두 번 구멍"이
  실제 커밋(`7cfbf2557` → `cffee0d28` → `77805bd32`)을 수반한 진짜 재발 이력임을 확인 — 지어낸 서사가 아니다.

### 점검 2 — §R8 "발급 apiBase 바인딩" 서술의 정확성

**결론: `session-store.ts:60-98` `loadSession` 구현과 정확히 일치. 과장·왜곡 없음.**

- "레거시 fail-safe 를 두지 않았다" — `loadSession` L84-93: 불일치는 물론 **`!parsed.apiBase`(미기록)도
  동일하게 폐기**(`clearSession` 후 `null` 반환). "일단 복원으로 살려주지 않는다"는 §R8 서술과 코드가
  정확히 일치. 주석 원문("최악의 비용은 새 대화 1회이고, 반대편 비용은 다른 origin 으로의 토큰 유출")도
  §R8 의 "fail-closed" 절과 동일 논리.
- "정규화는 후행 슬래시로만 한정" — L77-83 주석·L89 `stripTrailingSlash` 사용으로 확인. 경로(`/api` 등)는
  보존하고 후행 슬래시만 정규화한다는 §R8 서술과 일치.
- **동명 함수 경고 실측**: `demo-config.ts` L51-56 `normalizeApiBase`는 `.replace(/\/+$/, "")` **+**
  `.replace(/\/api$/i, "")` — 후행 `/api` 까지 제거하는 **정반대 계약**이 실제로 존재함을 확인. §R8 각주
  ("정규화를 후행 슬래시로만 한정한 이유 — 동명 함수가 정반대 계약")가 정확하다. `session-store.ts` L80-83
  주석도 이 충돌을 "consistency-check 22_35_51 naming_collision CRITICAL"로 명시 인용하며, 그 인용이
  `plan/complete/webchat-session-apibase-binding.md` L58-62 의 실제 1차 `BLOCK: YES` 이력과 일치한다
  (지어낸 인용이 아님).

### 점검 3 — "기각된 대안"이 실제 이력인가 (지어낸 서사 금지 규칙 준수 확인)

**결론: 둘 다 실제 이력. 지어낸 대안 없음.**

- **§R7 "boot 세대 비교"**: `plan/complete/webchat-boot-single-flight.md` L383-414 에 실제 커밋 이력으로
  기록돼 있다 — 9번째(`7cfbf2557`, boot 세대 스냅샷 캡처 fix) → 10번째(00_51_53, 그 fix 가 스피너 고착을
  유발해 되돌림, "boot 축을 버리고 `sessionEstablished()` 로") → 11번째(01_44_21, 재설계 커밋의 "동기 실행
  원천 차단" 주장이 오판으로 드러나 짝 가드 추가, `77805bd32`). 세 커밋 SHA 모두 실존하며 순서·인과관계가
  §R7 서술과 일치한다.
- **§R8 "레거시 fail-safe"**: `plan/complete/webchat-session-apibase-binding.md` L73-77 "레거시 세션(apiBase
  미기록)은 폐기" 절에 동일 논거("아마 같겠지로 통과시키면 정확히 이 결함이 남는다")로 기록돼 있다. §R7 처럼
  "코드로 구현했다가 되돌린" 강한 이력은 아니고(§R8 은 "레거시 fail-safe 를 **두지 않았다**"는 순한 문구로
  설계 검토 단계의 기각을 서술), 완료된 developer plan 문서에 실제로 검토·기각된 근거로 남아 있으므로
  "지어낸 대안" 규칙 위반이 아니다.
- 부수 확인: §R7 이 참조하는 "A-6 되돌림"(비-410 명령 실패 관련, 점검 4 참고)도 같은 plan L327-341,
  L237-250 에 실제 되돌림 커밋 이력으로 존재 — CHANGELOG 에서도 뺀("순변경 0") 실측 기록.

### 점검 4 — 불변식 2(비-410 명령 실패)를 Rationale 화하지 않은 판단

**결론: 판단이 맞다. 과도한 보수가 아니라, 지금 쓰면 오히려 사실과 어긋난 Rationale이 된다.**

- `plan/in-progress/webchat-command-failure-is-not-termination.md`(상태: 미착수)가 (A)/(B)/(C) 세 분기를
  실제로 열어 둔 미결 결정임을 직접 읽어 확인했다(L46-56). 이는 지어낸 핑계가 아니라 진짜 열린 티켓이다.
  체크리스트("결정 (A/B/C) — 사용자 또는 project-planner")가 비어 있다.
- 더 중요한 점: `plan/complete/webchat-boot-single-flight.md` L327-341 "A-6 되돌림" 이력을 보면, 옵션 (B)에
  준하는 시도("비-410 실패도 종료로 취급" 방향의 `ended` 가드 확대, A-6)가 **실제로 구현됐다가 살아있는
  대화의 영구 유실**을 일으켜 되돌려졌다("A-6 전체가 순변경 0"). 즉 **현재 코드의 실제 동작은 여전히
  "`ERROR` → `phase: ended`"**(옵션 (B)와 유사한 상태)이고, 이 결함을 어떻게 고칠지가 바로 미결 상태다.
  이 시점에 "비-410 명령 실패는 종료가 아니다"를 Rationale 로 확정해 쓰면, **현재 실제 구현 동작과 정면
  배치되는 문서**가 만들어진다 — 이는 "미래를 앞지르는" 수준을 넘어 **당장 거짓인 Rationale**이 될 위험이다.
  따라서 이 판단은 과도한 보수가 아니라 필수적인 절제였다.
  - 참고로 옵션 (B)에 대한 반박 근거("일시적 500 에도 대화 영구 소실을 제품이 수용한다는 뜻 — 권장하지
    않음, 위 사건이 그 대가를 보여줬다")는 이미 `webchat-command-failure-is-not-termination.md` 자체에
    기록돼 있어(L50-52), A-6 되돌림의 교훈이 유실되지는 않는다. 해당 plan 이 닫힐 때 그 plan 이 직접
    Rationale 을 작성하는 것이 맞는 순서다.

## 교차 확인 — 부수 정합성

- `spec/7-channel-web-chat/2-sdk.md §3` 신규 각주("예외 — apiBase 가 바뀐 재부팅")는 같은 문서 R6("동일
  triggerEndpointPath 로의 재부팅은 진행 중 execution 을 중복 시작하지 않는다", `1-widget-app.md §R6` 근거)와
  충돌하지 않는다 — R6 의 "중복 시작 안 함" 보장은 origin 불변을 전제하는데, 새 각주는 그 전제가 깨지는
  경우(apiBase 변경)를 명시적으로 예외 처리할 뿐 R6 자체를 뒤집지 않는다.
- `spec/7-channel-web-chat/4-security.md §1` 신규 행("저장 세션의 발급-origin 바인딩")은 기존 표의 다른 행과
  중복·모순 없이 새 축을 추가한다. `3-auth-session.md §R8` 상호 참조도 정확하다.
- 문서 내 로컬 `§R7`(`3-auth-session.md`) 표기가 동일 영역의 다른 문서(`1-widget-app.md §R7`, 의미 다름)와
  번호가 겹치지만, 이 저장소는 이미 R-넘버링을 문서 로컬 스코프로 쓰고 교차 참조 시 항상 문서명을 접두어로
  붙이는 관행이 확립돼 있다(`EIA §R7` vs `WS §2.2` 등 기존 예시로 확인). 신규 편집도 이 관행을 그대로
  따른다(`[1-widget-app §R6]`, `[3-auth-session §R8]` 형태) — Rationale 연속성 문제 아님, 언급만 해 둔다.

## 요약

`webchat-spec-rationale-followup` 의 §R7·§R8 신설은 근거 코드(`use-widget.ts` JSDoc, `session-store.ts`
`loadSession`, `demo-config.ts` `normalizeApiBase`)와 실제 plan/git 이력(`webchat-boot-single-flight.md`,
`webchat-session-apibase-binding.md`)을 직접 대조한 결과 **사실 왜곡·과장 없이 충실하게 옮겨졌고**, 인용된
"기각된 대안"(boot 세대 비교, 레거시 fail-safe)은 모두 **실제로 시도·검토됐다가 물러선 이력**으로 뒷받침돼
이 저장소의 "지어낸 대안 금지" 규칙을 위반하지 않는다. 불변식 2(비-410 명령 실패)를 Rationale 화하지 않은
판단도 타당할 뿐 아니라, 실제로는 현재 코드 동작(과거 A-6 시도가 되돌려진 뒤 남은 상태)과 배치되는 거짓
Rationale을 막아주는 필수적 절제였다. CRITICAL·WARNING 급 발견사항 없음.

## 위험도

NONE

STATUS=success
