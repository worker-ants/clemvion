# 보안(Security) Review

## 발견사항

없음 (Critical/Warning 없음).

- **[INFO]** SSE 이벤트 데이터 자체는 신뢰하지 않고 기존 인증된 세션으로만 재조회
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent` `execution.replay_unavailable` 분기 (신규)
  - 상세: 신규 분기는 서버가 emit 한 `execution.replay_unavailable` 이벤트의 `data`(예: `executionId`)를 전혀 신뢰/파싱하지 않고, 이미 `sessionRef.current`/`clientRef.current` 에 보관된 기존 세션·토큰으로 `client.getStatus(session.endpoints, session.token)` 만 재호출한다. 이벤트 payload 를 신뢰 경계로 쓰지 않으므로 이벤트 스푸핑(예: 악성 SSE 프레임 주입) 시에도 공격자가 임의 executionId/엔드포인트로 유도할 수 없다. 기존 `seedWaitingFromStatus`(이미 `start()`/`applyConfig()` 복원 경로에서 사용 중인 검증된 헬퍼)를 재사용해 신규 검증 로직·신규 신뢰 경계를 추가하지 않은 점도 공격면을 넓히지 않는다.
  - 제안: 조치 불필요 — 안전한 설계로 확인.

- **[INFO]** 에러 상세는 console 로만, UI 는 일반화 문구 유지(4-security §5 정합)
  - 위치: `use-widget.ts` `seedWaitingFromStatus` catch 블록, `errMessage()` (기존 패턴 재확인)
  - 상세: 신규 `execution.replay_unavailable` 경로에서도 `seedWaitingFromStatus` 의 실패는 `console.warn` 으로만 남고 `state.error`/UI 에는 노출되지 않는다(soft-fail). 테스트 `use-widget-eager-start.test.ts` W1 케이스가 `state.error` 에 HTTP status·예외 원문(`/500|EiaError|fetch|undefined/i`)이 섞이지 않음을 명시적으로 단언해 회귀를 가드한다. 다만 console 원문 노출 자체는 기존 프로젝트 관례(브라우저 devtools 접근 가능자 = 그 세션의 사용자 본인)이며 이번 diff 가 새로 도입한 리스크는 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 fixture 토큰은 실제 시크릿이 아님
  - 위치: `use-widget-eager-start.test.ts` 전역(`iext_x`, `iext_prev`, `iext_y` 등)
  - 상세: `iext_*` 형태 문자열은 mock fetch 응답에 들어가는 테스트 전용 더미 토큰(EIA per-execution 토큰 네이밍 컨벤션의 mock)이며 실제 인증정보·API 키가 아니다. 하드코딩된 시크릿에 해당하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `webauthn-response.dto.ts` 변경은 순수 주석(JSDoc) 정정
  - 위치: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts` `WebAuthnCredentialListDto`
  - 상세: 코드 로직 변경 없음 — 잘못된 서술("SessionListDto 의 이중 중첩 패턴은 피한다")을 실제 계약(`SessionListDto` 와 동일 `{items:[]}` shape, load-bearing)으로 정정하는 주석 수정뿐이다. DTO 필드·`@ApiProperty` 정의는 불변이라 응답 포맷·인가·검증에 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** plan/spec 문서(md) 변경은 서술만 갱신, 코드/설정 변경 없음
  - 위치: `plan/in-progress/eia-context-schema-followups.md`, `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/7-channel-web-chat/1-widget-app.md`
  - 상세: 완료 항목 체크·구현 반영 서술 갱신뿐이며 시크릿·자격증명·인프라 설정 노출 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경분의 핵심은 (1) 위젯이 SSE `execution.replay_unavailable`(5분 버퍼 만료 신호) 를 소비해 기존에 이미 검증된 `seedWaitingFromStatus` 헬퍼로 `getStatus` 재동기화를 수행하도록 배선한 것, (2) 관련 테스트 헬퍼(`installControllableEventSource`) 중복 제거 리팩터, (3) DTO/plan/spec 문서의 서술 정정이다. 신규 분기는 이벤트 payload 를 신뢰 경계로 쓰지 않고 기존 인증 세션·토큰만으로 재조회하므로 인젝션·인증 우회·SSRF 등 새로운 공격면이 생기지 않았고, 에러 노출도 기존 "console 진단/UI 일반화 문구" 관례를 그대로 따르며 회귀 테스트로 고정되어 있다. 하드코딩 시크릿, 안전하지 않은 암호화, 입력 검증 누락 등은 발견되지 않았다.

## 위험도
NONE
