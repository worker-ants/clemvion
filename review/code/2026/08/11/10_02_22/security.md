# Security Review — `10_02_22`

## 전제: 이전 CRITICAL 2건 반영 여부 재검증

이전 라운드(security CRITICAL 2 + side_effect 독립 수렴) 지적 — "`openStream` 진입점 셋 중 하나에만 redaction" — 을 처음부터 다시 세었다. 코드베이스를 직접 열어 `openStream` 을 부르는 모든 호출부를 grep 으로 전수 확인(`use-widget.ts:466,771,860,1223`)했고, 각 진입점과 그 위의 예외 처리 경로를 추적했다.

- **`start()`**(`use-widget.ts:860` 의 `openStream` → 실패 시 `catch` → `errMessage()`): `errMessage`(`use-widget.ts:1325-1331`)가 `redactToken` 적용. ✅ 확인.
- **`applyConfig` 복원**(`use-widget.ts:1223` 의 `openStream`): 마운트 `useEffect` 내부에 정의된 `applyConfig` 를 `runApplyConfig` 헬퍼(`use-widget.ts:1243-1247`)가 `.catch()` 로 감싸고 `redactToken` 적용. 호출부 2곳(`bridge.onBoot` 핸들러 `use-widget.ts:1249-1251`, direct-load fallback `use-widget.ts:1286`) 모두 `runApplyConfig` 를 통해서만 `applyConfig` 를 부른다 — 헬퍼로 묶어 "호출부가 둘인데 한쪽만 고친다" 재발을 구조적으로 막았다. ✅ 확인.
- **`resumeDeferredStreamRef`**(`use-widget.ts:771` 의 `openStream`, `useTokenRefresh` 의 `onRefreshed` 콜백 경유): 이 콜백을 부르는 자리는 `use-widget.ts` 가 아니라 `use-token-refresh.ts:166-176` — `try { onRefreshedRef.current?.(updated); } catch (notifyErr) { console.warn(..., redactToken(...)) }` 로 이미 감싸져 있다(전전 라운드 `18_23_54`에서 고쳐진 자리). ✅ 확인.
- **SSE `onError`**(`use-widget.ts:466-484`): 원본 `Event` 대신 `e.type` 문자열만 로깅하도록 축소됨(`use-widget.ts:477-481`). `e.target.url` 등 나머지 필드는 아예 로그에 실리지 않는다. ✅ 확인.

`eia-client.ts` 를 열어 REST 3종(`interact`/`getStatus`/`refreshToken`)이 토큰을 **모두 `Authorization: Bearer` 헤더로만** 보내고 URL 쿼리에 싣지 않는 것도 재확인했다(`eia-client.ts:72-118`) — 따라서 그 세 메서드의 에러 메시지(`명령 실패(...)`, `상태 조회 실패(...)`, `토큰 갱신 실패(...)`)는 애초에 토큰/URL 을 담지 않는다. 그래서 `use-widget.ts:540`(`recoverFromExpiredToken` non-terminal catch), `use-widget.ts:730`(`seedWaitingFromStatus` soft-fail catch), `use-widget.ts:1025`/`1075`(`newChat`/`endConversation` 명령 실패 catch), `use-token-refresh.ts:183`(주기 갱신 실패)의 미-redact `console.warn` 들은 **redact 대상이 아니다** — 토큰이 URL 쿼리로 실리는 것은 `EventSource`(SSE, `eia-client.ts:120-133`) 하나뿐이고, 그 예외가 흘러갈 수 있는 4개 진입점(`start`·`applyConfig`·`resumeDeferredStream`·`onError`)은 전수로 막혔다.

sessionStorage 영속(`session-store.ts`), `postMessage`(`host-bridge.ts`, `bridgeRef.current?.sendEvent(...)` 전수 grep — `reason`/`executionId`/`text` 뿐 토큰 없음), UI 렌더(`errMessage`→ `GENERIC_ERROR_MESSAGE` 고정 문구, 원문 비노출)까지 로그·UI·storage·네트워크 4축을 각각 다시 세웠고, 새로 발견된 미차단 유출 경로는 없었다.

**결론: 이전 CRITICAL 2건은 실제로 닫혔고, 이번엔 좁게 잡지 않았다.**

## 위협 모델 정정("cross-origin iframe이라 호스트가 콘솔을 못 읽는다") 검증

`eia-client.ts:190-195` 의 정정 — "호스트 페이지의 다른 스크립트가 콘솔을 읽을 수 있다" 는 처음 주석이 틀렸고, cross-origin iframe 격리상 호스트 realm 은 이 realm 의 `console` 에 접근 불가하다는 주장 — 을 `spec/7-channel-web-chat/0-architecture.md` 로 대조했다.

- §R1/§R5: M1(주력) 배포는 위젯을 **별도 CDN origin**의 실제 `src` iframe 으로 로드한다(`srcdoc`/`about:blank` 자가생성은 호스트 origin 상속으로 격리가 깨진다는 이유로 명시 기각됨) — 이 경우 브라우저 same-origin 정책상 호스트 페이지 스크립트가 `iframe.contentWindow.console` 에 접근하면 `SecurityError` 로 차단된다. **정정은 이 기본 배포 경로에 한해 기술적으로 정확하다.**
- §R5 carve-out: admin 콘솔 **내부 라이브 미리보기**만 예외적으로 **same-origin** iframe 으로 위젯을 로드한다 — 이 경우엔 상위 프레임이 `contentWindow.console` 에 실제로 접근 가능하다. 정정된 주석은 이 경우를 "위젯을 같은 origin 에 임베드하는 배포" 로 **이미 열거해 뒀다** — 빠뜨리지 않았다.
- 정정 후 남긴 노출면 목록(devtools 를 여는 사람 · 콘솔 수집 확장 · 버그리포트 콘솔 덤프/스크린샷 · same-origin 임베드)도 실제 브라우저 동작과 맞다: cross-origin 프레임이어도 그 탭에서 devtools 를 연 사람(또는 `tabs`/`debugger` 권한을 가진 확장)은 모든 프레임의 콘솔을 볼 수 있다 — 이 경로들은 postMessage/DOM API 접근이 아니라 브라우저/사용자 권한 자체이므로 cross-origin 격리로 막히지 않는다.

**결론: 정정은 유효하다. 위협 모델을 다시 넓힐 근거는 없다.** 다만 아래 발견사항 1에서 지적하듯, **같은 파일 트리 안에 정정 이전의 주장이 그대로 남아** 다음 사람이 두 설명 중 무엇을 믿어야 할지 혼란을 줄 수 있다.

## 발견사항

- **[WARNING]** 정정 이전의 틀린 위협 모델 서술이 테스트 파일에 그대로 남아 있다 — `redactToken` 도입 근거였던 `eia-client.ts` 의 JSDoc 은 정정됐는데, 같은 방어를 검증하는 테스트의 주석은 정정되지 않았다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:698-699` (함수: `"§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다"` `it` 블록 내부 주석)
  - 상세: 해당 줄은 여전히 "이 위젯은 공개 사이트에 임베드되므로 호스트 페이지의 다른 스크립트도 그 콘솔을 읽는다" 라고 적혀 있다 — `eia-client.ts:190-192` 가 명시적으로 틀렸다고 정정한 바로 그 문장이다. 이 `it` 블록 자체는 이번 diff 대상이 아니고(이전 `17_55_57` 라운드 산출물), 이번 커밋(`bd4e5b35f`)이 같은 파일 뒤쪽에 새 테스트 2개를 추가하면서 이 기존 주석은 건드리지 않았다. 기능적 결함은 아니지만(어차피 두 서술 모두 결론은 "redact 를 유지한다" 로 같다), **정정된 근거와 정정되지 않은 근거가 같은 트리 안에 공존**하면 다음에 유사한 로그 노출을 판단하는 사람(또는 에이전트)이 낡은(더 넓은) 위협 모델을 근거로 과도하거나, 반대로 정정된 좁은 모델만 보고 다른 실제 노출면(같은 origin 임베드 등)을 놓칠 수 있다. `feedback_documented_guarantee_wider_than_built` 류의 "문서 스큐" 패턴과 같은 축이다.
  - 제안: `use-widget-eager-start.test.ts:698-699` 주석을 `eia-client.ts:190-195` 의 정정된 서술(또는 그에 대한 참조)로 맞춘다.

- **[WARNING]** `applyConfig`(세션 복원) 진입점의 redaction 방어가 회귀 테스트로 고정되지 않았다 — 이번 라운드가 스스로 "진입점 셋" 이라 명명했는데, 그 중 하나만 전용 회귀가 비어 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 의 마운트 `useEffect` 내부 `runApplyConfig` 헬퍼(1243-1247번째 줄, `void applyConfig(cfg).catch((e: unknown) => { console.warn(..., redactToken(...)) })`) — 테스트 부재는 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `use-widget.test.ts`, `use-widget-commands.test.ts` 전체.
  - 상세: 이번 커밋이 스스로 남긴 JSDoc(`use-widget-eager-start.test.ts:709` 부근, "`openStream` 을 부르는 진입점은 셋(`start()`·`applyConfig` 복원·`resumeDeferredStream`)")대로 그 셋을 전수 grep 했다(`grep -n "throwOnce" use-widget-eager-start.test.ts` → 681, 734 두 곳만). `throwOnce`(가짜 `EventSource` 생성자가 실제 브라우저의 `TypeError: Failed to construct 'EventSource': <url>` 형태로 동기 throw 하게 만드는 테스트 유틸)를 켜서 토큰이 실제로 redact 되는지 확인하는 테스트는 `start()`(734, 이번 diff 신규)와 `resumeDeferredStream`(681, `17_55_57` 라운드 기존)에만 있다. **저장 세션이 있는 상태로 부팅해 `applyConfig` 복원 경로가 `openStream` 을 부르고 그 자리에서 동기 throw 하는 시나리오** — 즉 `runApplyConfig` 의 `.catch()`+`redactToken()` 을 실제로 태우는 테스트 — 는 세 파일(`use-widget.test.ts`/`use-widget-commands.test.ts`/`use-widget-eager-start.test.ts`) 어디에도 없다(`grep -n "throwOnce\|redactToken\|token=<redacted>"` 결과 0건). 코드 리딩으로는 방어가 정확히 대칭적으로 걸려 있다고 판단하지만(`start()`·`resumeDeferredStream` 과 동일 패턴), 이 특정 자리만 **뮤테이션으로 검증할 방법이 없다** — `runApplyConfig` 의 `.catch()` 자체를 지우거나 `redactToken(...)` 호출을 `e.message` 로 되돌리는 뮤턴트가 어떤 테스트도 못 잡고 통과한다. 이 세션 자신의 커밋 이력(RESOLUTION 들)이 반복해 지적한 "가드를 한쪽에만 적용" 패턴이 **테스트 축에서 다시 반복된 것**이다.
  - 제안: 저장 세션(`sessionStorage`)을 미리 심어 두고 `boot()` 후 `applyConfig` 의 복원 분기가 `openStream` 을 부르는 시점에 `throwOnce=true` 로 동기 throw 를 유발한 뒤, `console.warn` 스파이로 `token=<redacted>` 는 포함하고 원본 토큰 문자열은 포함하지 않는지 단언하는 테스트를 `use-widget-eager-start.test.ts`(714-750줄의 `start()` 테스트와 대칭 위치)에 추가한다. 뮤테이션(`runApplyConfig` 의 `.catch()` 제거, `redactToken` 제거)으로 RED 확인.

- **[INFO]** `use-token-refresh.ts` 의 `onRefreshed` 소비자 예외 redaction 도 "실제로 토큰이 지워지는가" 를 단언하는 테스트가 없다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:166-176` (방어 코드) / `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:276-289` (관련 테스트, `it("onRefreshed 가 throw 해도 갱신은 성공으로 취급된다 — 백오프로 떨어지지 않는다")`)
  - 상세: 이 테스트는 `() => { throw new TypeError("consumer blew up"); }` 로 소비자 콜백을 던지게 하지만, 그 메시지엔 애초에 `token=` 이 없고 `console.warn` 도 스파이하지 않는다 — "성공 판정이 오염되지 않는다" 는 다른 축(백오프 미진입)만 검증할 뿐, `redactToken` 이 실제로 동작하는지는 이 테스트로 확인할 수 없다. 위 WARNING 항목과 같은 축이지만, 이 자리는 이번 diff 가 아니라 `18_23_54` 라운드에서 이미 도입된 기존 방어라 등급을 낮춰 INFO 로 남긴다.
  - 제안: 여유가 될 때 `use-token-refresh.test.ts` 에 소비자 콜백이 토큰이 실린 메시지(`"...token=iext_xxx..."`)로 던지는 케이스를 추가해 `console.warn` 출력에 원본 토큰이 없고 `<redacted>` 가 있는지 단언한다.

## 그 외 점검(발견 없음)

- **인젝션**: DB/셸 접근 없음(순수 프론트엔드). `configFromQuery`(`use-widget.ts:170-190`)의 `apiBase` 스킴 화이트리스트(http/https 만)는 이번 diff 밖이며 변경 없음 — 유지됨.
- **하드코딩 시크릿**: 전체 diff 대상 파일에서 API 키/비밀번호 패턴 grep 결과 없음. 테스트의 `"iext_..."` 토큰들은 전부 fixture 문자열.
- **인증/인가**: 토큰이 REST 는 `Authorization` 헤더, SSE 는 부득이 쿼리(EventSource 헤더 미지원, EIA §8.3 문서화됨) — 설계상 이미 알려진 트레이드오프이고 이번 diff 는 그 노출을 로그 레벨에서 줄이는 방향으로만 움직였다. `isTerminalAuthError`(`eia-client.ts:179-181`)가 `401`/`410` 만 종단으로 판정하는 로직은 `instanceof EiaError` 가드를 포함해 `.status` 만 있는 duck-typed 객체를 종단으로 오판하지 않도록 막혀 있다(`eia-client.test.ts:281-285` 로 고정).
- **입력 검증**: 이번 diff 의 신규 입력 표면 없음.
- **암호화/평문 전송**: `apiBase` 는 http(s) 로 제한(기존), SSE/REST 모두 same-origin/CORS 경계는 이번 diff 밖.
- **에러 처리**: 위 CRITICAL 재검증 섹션 참조 — UI 에는 항상 `GENERIC_ERROR_MESSAGE`(카탈로그 고정 문구)만 노출되고 원문은 console 전용, 그마저 토큰이 실릴 수 있는 경로는 redact.
- **의존성 보안**: 이번 diff 는 신규 의존성 도입 없음.

## 요약

이전 라운드가 CRITICAL 2건으로 지적한 "`openStream` 진입점 3곳 중 1곳에만 redaction" 은 이번 커밋에서 4개 로그 유출 지점(`start()`·`applyConfig`·`resumeDeferredStream`·SSE `onError`)이 전부 대칭적으로 막혔다 — 코드 직독으로 전수 확인했고 REST 3종(`interact`/`getStatus`/`refreshToken`)은 애초에 토큰이 URL 에 실리지 않아 redact 대상이 아님도 재확인했다. "cross-origin iframe 이라 호스트가 콘솔을 못 읽는다" 는 정정도 `0-architecture.md` §R1/§R5 의 실제 배포 구조(M1 cross-origin CDN iframe, admin 미리보기만 same-origin carve-out)와 대조해 기술적으로 유효하며 정정 후 문구도 그 예외를 빠뜨리지 않았다 — 위협 모델을 다시 넓힐 근거는 없다. 남은 문제는 실행 취약점이 아니라 **테스트/문서 축의 비대칭**이다: `applyConfig` 진입점의 redaction 방어는 코드상 존재하고 대칭적으로 보이지만 그것만 검증하는 회귀 테스트가 없어 향후 리팩터가 그 자리만 조용히 무력화해도 아무 테스트도 못 잡으며, 정정된 위협 모델 서술이 정정되지 않은 옛 서술과 같은 파일 트리에 공존한다.

## 위험도

LOW

STATUS: SUCCESS reviewer=security file=/Volumes/project/private/clemvion/.claude/worktrees/spec-small-followups/review/code/2026/08/11/10_02_22/security.md
