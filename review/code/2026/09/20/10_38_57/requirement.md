# 요구사항(Requirement) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (3라운드 · 머지 후 확인)

## 검토 방법

`plan/in-progress/ssrf-catch-instanceof.md` 가 선언한 목표("판정만 차단으로. 판정이 아니면 그 호출부의 «분류되지
않은 실패» 경로로")를 대상으로 10개 코드 파일(운영 코드 5 + 테스트 5)의 diff 와 현재 소스(`Read`)를 line-level 로
대조했다. 직전 두 라운드(`review/code/2026/09/20/09_35_16`, `10_09_56`)의 WARNING 이 실제로 반영됐는지 소스
재확인으로 검증했고, `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query}.md`,
`spec/2-navigation/4-integration.md` §5.3/§5.4/§6 을 직접 열어 에러 코드 정의와 대조했다. 저장소에 뮤테이션은
가하지 않았다(정적 읽기만으로 판별 가능) — `git status --short` 로 트리 미변경 확인(리뷰 세션 산출물 디렉터리만
untracked).

## 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 가 머지
  시점에도 여전히 누락 — 1·2라운드 WARNING 의 미해소 잔여, 신규 아님
  - 위치: `spec/4-nodes/4-integration/1-http-request.md:1-8` (frontmatter `code:` 블록, 현재 4개 항목만 나열)
  - 상세: 이번 PR 이 `http-redirect.ts` 의 `outboundBlockReason`/`followRedirectsSafely` catch 를 직접 고치고 신설
    `http-redirect.spec.ts` 까지 추가했는데, §4 step 9(리다이렉트 5홉 + 홉마다 SSRF 재검증)를 구현하는 그 파일이
    spec 증거 목록에 없다. `developer` 는 `spec/` 쓰기 권한이 없고 이 갭은 자기-반증형 소정정 5조건에도 해당하지
    않는다(예고 문장 정정이 아니라 증거 목록 누락) — 판단 자체는 1·2라운드 RESOLUTION 이 이미 내렸고
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재돼 있다. 다만 "머지했어"
    시점 기준으로 실제 파일은 아직 고쳐지지 않은 상태라 spec fidelity 관점에서 재확인차 기록한다.
  - 제안: 코드 조치 아님 — `project-planner` 턴에서 `code:` 에 `http-redirect.ts` 추가(이미 계획됨, 새 작업 아님).

- **[INFO]** 가드 «고장»(판정 아닌 오류) 메시지의 host/IP 마스킹 부재가 3+1곳에서 그대로 — 이미 실측·트래커 등재된
  의도적 스코프아웃, 신규 아님
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:151`(`clampMessage(describeFailure(err))`,
    `sanitizeMessage` 미적용), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:560`(redirect
    hop 실패 경로는 `toLogError(err).message` 로 마스킹되지만 자격증명 패턴만 가릴 뿐 host/IP 패턴은 안 가림)
  - 상세: `sanitizeMessage`(`_base/integration-handler-base.ts:156-163`)는 password/token/Bearer/장문 blob 패턴만
    가리고 host/IP 패턴은 다루지 않는다. 오늘 가드가 낼 수 있는 유일한 비판정 오류(`isBlockedHostname` 의
    `.toLowerCase()` TypeError, `http-safety.ts:131-137`)는 host/IP 를 message 에 담지 않으므로 실제 유출은 없다 —
    이 실측은 `plan/in-progress/ssrf-catch-instanceof.md`(29-33행)와
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 항목, 2026-09-20 등재)가 이미 정확히 반영했고,
    후자는 두 해결 방향(고정 문구 치환 vs `sanitizeMessage` 에 host/IP 패턴 추가)까지 기록해 뒀다. 새로 발견한
    결함이 아니라 기존 실측·문서화의 재확인.
  - 제안: 조치 불요(이미 결정·문서화됨). 후속 트래커 항목 진행 시 처리.

- **[INFO]** `plan/in-progress/ssrf-catch-instanceof.md` 가 아직 `plan/complete/` 로 이동하지 않음 · 체크리스트 하단
  3항목(`/ai-review` 수렴 · `--impl-done` · 트래커 해소) 미체크 — 2라운드에서도 지적된 시점 불일치, 아직 미해소
  - 위치: `plan/in-progress/ssrf-catch-instanceof.md:85-87` vs
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(SSRF 항목이 이미 `[x]` + "2026-09-20 해소" +
    존재하지 않는 `plan/complete/ssrf-catch-instanceof.md` 참조)
  - 상세: `python3 -c "os.listdir('plan/complete')"` 로 직접 확인 — `ssrf-catch-instanceof.md` 는 `plan/complete/`
    에 없다. 사용자가 "머지했어" 라고 전달했지만 이 워크트리 안에서는 plan 이 여전히 `in-progress` 이고 체크리스트도
    미완료 상태다. 트래커 쪽 "해소" 서술이 앞서 사실화됐다고 가정하고 쓰였다는 뜻 — 코드 결함은 아니고 마무리
    순서(리뷰 수렴 → `--impl-done` → plan 체크 → `plan/complete/` 이동)가 아직 안 끝났다는 프로세스 상태 확인.
  - 제안: 이번 라운드가 Critical·Warning(코드 대상) 없이 수렴하면 마무리 커밋에서 plan 체크리스트 3항목 체크 +
    `plan/complete/` 이동으로 두 문서의 서술을 일치시킬 것.

## 핵심 확인 사항 (문제 없음 — line-level 대조 완료)

- 4개 소비자 + 동반 1건이 plan 표와 **정확히 일치**하는 것을 소스에서 재확인:
  - `http-request.handler.ts:350-418` — `SsrfBlockedError` → `HTTP_BLOCKED`(그대로) / 그 외 →
    `logger.warn` + `toLogError(err)`(1회 계산, `const logError`, 라운드2 INFO1 반영 확인) 로 usage 로그 +
    `buildPreflightErrorOutput(new IntegrationError('INTEGRATION_CALL_FAILED', logError.message), …)` → `port:'error'`.
  - `http-redirect.ts:30-39` `outboundBlockReason` — `SsrfBlockedError` → 사유 문자열(그대로) / 그 외 → `throw err`
    (그대로 재던짐). 호출자(`http-request.handler.ts:531-579`, `http-connection-tester.ts:139-153`)가 각자
    `HTTP_TRANSPORT_FAILED`/`HTTP_CONNECT_FAILED` 로 분류하는 것도 확인.
  - `database-query.handler.ts:262-287` — `SsrfBlockedError` → `IntegrationError('DB_HOST_BLOCKED', …)`(그대로) /
    그 외 → `IntegrationError('INTEGRATION_CALL_FAILED', sanitizeMessage(detail))`. 바깥 catch(`:343-349`)가 두
    코드 모두 `IntegrationError` 분기로 보존해 `mapDbError` fallback 을 우회하는 것도 확인.
  - `database-connection-tester.ts:140-161` — `SsrfBlockedError` → `DB_HOST_BLOCKED` 결과(그대로) / 그 외 →
    `DB_CONNECT_FAILED` 결과 + `logger.warn`, **던지지 않음**(JSDoc·`dispatchTest` no-throw 계약 보존 확인).
  - `http-connection-tester.ts:117-121` — preflight 호출을 `try` 안으로 이동(동반 1건), `AbortSignal.timeout` 생성을
    preflight **뒤**로 이동해 DNS 조회 시간이 전송 타임아웃 예산을 잠식하던 것을 없앤 것도 확인.
- `http-safety.ts` 실측: 판정 경로(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`)는 오늘 전부
  `SsrfBlockedError` 만 던지고 DNS lookup 실패는 fail-open 이라, 비판정 오류의 유일한 경로는
  `isBlockedHostname`(:131-137)의 `.toLowerCase()` TypeError(hostname 이 문자열이 아닐 때) 뿐이라는 plan 의 주장이
  소스와 일치. 이 값은 DB/HTTP credentials validation(`field.type==='string'`)을 거치므로 API 로는 닿지 않는다는
  plan 의 도달 가능성 주장은 이번 라운드에서도 별도로 반증하지 않았다(선행 두 라운드가 이미 검증, 재검증 불요 범위).
- spec 대조: `spec/4-nodes/4-integration/0-common.md:85` `INTEGRATION_CALL_FAILED`("기타 일반 예외(분류되지 않은
  실패)")·`spec/2-navigation/4-integration.md:504`("DB_CONNECT_FAILED — 그 밖(네트워크·타임아웃·TLS·없는 database
  등)")·`:483`("HTTP_CONNECT_FAILED — 네트워크·타임아웃·TLS")은 모두 캐치올 정의라 이번 diff 가 만든 신규 트리거
  (가드 자체의 고장)를 명시적으로 배제하지 않는다 — 부합. `1-http-request.md:364` Rationale("redirect 대상·한도초과
  SSRF 판정은 HTTP_BLOCKED 로 라우팅해야 한다")도 이번 diff 로 깨지지 않음 — **판정**(`SsrfBlockedError`)은 여전히
  `blocked:true`→`HTTP_BLOCKED` 로 가고, 이번에 `HTTP_TRANSPORT_FAILED` 로 새로 흐르는 것은 판정이 아닌 가드의
  고장(TypeError 등)뿐이라 D4 Rationale 이 금지한 "SSRF 판정을 transport 실패로 오분류"에 해당하지 않는다.
- `2-database-query.md:344`/`0-common.md:85` 에는 `INTEGRATION_CALL_FAILED` 의 기존 트리거(`requireEntity`
  `RESOURCE_NOT_FOUND` fallback)만 나열돼 있고 이번 PR 이 추가한 "SSRF 가드 고장" 트리거는 표에 없다 — 캐치올
  정의상 위반은 아니지만(위 항목 참조) 명시적 열거 누락은 INFO 로 이미 트래킹 중(`spec-draft-nullable-notation-followups.md`).
- 테스트 5건(신규 4 + 신설 파일 1) 모두 실제 구현 분기와 반환 코드/message/throw 여부가 일치. `database-query.handler.spec.ts`
  신규 테스트는 `connectMock` 미호출 + `logUsage` 의 `error.code === 'INTEGRATION_CALL_FAILED'` 를 함께 검증해
  "쿼리 시작 전 승격" 주석 주장과 부합.
- `codebase/**` 대상 파일 6개(운영 코드)에서 TODO/FIXME/HACK/XXX 없음(`grep` 확인). 판정/비판정 두 갈래 모두
  성공/실패 명시적 반환값 또는 명시적 재throw 를 가진다 — 반환 누락 경로 없음.

## 요약

SSRF 가드 소비자 넷("판정" vs "가드의 고장"을 가르는 catch 분기)과 동반 변경 1건은 plan 이 선언한 기대 동작표,
그리고 spec 의 에러 코드 캐치올 정의(`INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`) 와
line-level 로 정확히 부합한다. 1·2라운드에서 지적된 WARNING(타임아웃 예산 잠식·미mock DNS·메시지 마스킹 2곳·stale
주석·중복 계산)은 전부 소스 재확인으로 반영이 확인됐다. 이번(3)라운드에서 남는 항목은 전부 개발자 권한 밖이거나
이미 근거와 함께 스코프아웃된 잔여뿐이다 — spec frontmatter `code:` 목록의 `http-redirect.ts` 누락(WARNING,
planner 턴 대기 중, 코드 결함 아님), 가드-고장 메시지의 host/IP 미마스킹(INFO, 실제 유출 없음이 실측됨, 트래커
등재), plan/트래커 완료 서술의 시점 불일치(INFO, 이번 라운드 수렴 시 마무리 커밋에서 해소 가능). 기능 완전성·엣지
케이스·에러 시나리오·반환값 모두 정상이며, 새로운 Critical/코드 대상 WARNING 은 발견되지 않았다 — 이번 라운드는
`codebase/` 수정 없이 수렴 조건(Critical·Warning-코드 0)을 충족한다.

## 위험도

LOW
