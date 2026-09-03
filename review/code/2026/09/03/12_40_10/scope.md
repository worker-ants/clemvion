# 변경 범위(Scope) 리뷰

## 컨텍스트 확인

`git merge-base HEAD origin/main` = `af41a3c6e`(직전 auth 커밋)이며, `git diff origin/main...HEAD --stat` 로 실측한 결과 이 리뷰 페이로드의 파일 1~33 은 정확히 다음 3개 커밋의 누적 diff와 1:1 일치한다(파일 수·hunk 라인 수 대조 완료, 추가 파일 없음):

- `69aad5d5d fix(ws): 이월 INFO 5건을 한 번에 닫았다`
- `b75e6a76b fix(ws): 리뷰 1R — 새 심볼을 JSDoc 과 그 대상 사이에 끼워 넣었다`
- `80ac92668 fix(ws): 리뷰 2R — "런북에서 추적 중" 이 거짓이었다`

이 3개 커밋은 모두 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 명시한 단일 작업 —
"이월 INFO 5건 정리" 및 그 정리 과정에서 두 차례 리뷰가 잡은 재발/거짓 근거의 정정 — 에 귀속된다.

## 발견사항

- **[INFO]** review 산출물(33개 중 29개)이 실제 코드 diff(4개 파일, +207/-23) 대비 압도적으로 큰 비중을 차지한다
  - 위치: `review/code/2026/09/03/11_57_58/**`(15개), `review/code/2026/09/03/12_16_24/**`(14개)
  - 상세: `git diff --stat` 기준 2,007줄 추가 중 대부분이 이전 두 리뷰 라운드의 SUMMARY/RESOLUTION/개별 reviewer 리포트다. CLAUDE.md 가 명시한 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)와 정확히 일치하고, developer SKILL 의 "구현 완료 후 `/ai-review` + fix 는 상시 승인된 강제 의무" 규약에 따른 정상 산출물이다. 직전 라운드(`12_16_24/scope.md`)도 동일 결론(NONE)을 냈고, `git log`(6ffadb1f4·7e6a4bc3e·2ff000a6a 등)를 보면 이 저장소가 review/plan 산출물을 코드 fix 커밋과 함께 커밋하는 것이 일관된 관행임을 확인했다. 따라서 무관한 파일 혼입이 아니라, 이 diff 를 크게 만드는 요인일 뿐이다.
  - 제안: 조치 불요.

- **[INFO]** `websocket.gateway.ts` import 재정렬 — 신규 심볼 추가에 종속된 최소 포맷 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23-28` (`AuthEventType, ExecutionEventType, MSG_AUTH_TOKEN_EXPIRING, type AuthTokenExpiredPayload` 알파벳 순 재배열)
  - 상세: `MSG_AUTH_TOKEN_EXPIRING` 추가로 `type AuthTokenExpiredPayload` 의 위치가 한 줄 밀렸다. 신규 import 추가에 필연적으로 딸려오는 최소 변경이며, 별도의 임포트 정리·불필요한 재배열은 없다.
  - 제안: 조치 불요.

## 범위 정합성 평가 (핵심)

- **plan 체크리스트 ↔ 코드 diff 1:1 대응**: `websocket-events.types.ts`(`MSG_AUTH_TOKEN_EXPIRING` 상수 승격) · `websocket.gateway.ts`(`expiryTimers` non-optional화, `clearExpiryTimers` 추출 + 선제 해제를 조기 `return` **앞**으로, `.unref()`, `Math.max` 근거 주석) 모두 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(:93-113)가 선언한 항목과 정확히 대응한다. 항목 밖 추가 변경은 없다.
- **`clearExpiryTimers` private 메서드 추출**: 임의의 drive-by 리팩터가 아니라 (a) `expiryTimers` non-optional화로 `handleDisconnect` 의 방어 분기(`if (timers.notice) …`)가 죽은 코드가 된 것, (b) `armExpiryTimers` 진입부에 선제 해제가 새로 필요해진 것 — 두 항목이 동시에 요구하는 필연적 결과다. `handleDisconnect`(`:314-317`)는 동일 절차를 헬퍼 호출로 치환했을 뿐 동작 변화가 없다(구 인라인 로직과 신규 헬퍼 로직이 1:1 대응).
- **테스트 5건 추가**(`websocket.gateway.spec.ts:794-892`): 상수 일치(항목 3) · 재무장 시 해제 exp 有(항목 4) · 재무장 시 해제 exp 無(1R W3 회귀 정정 검증) · cutoff 음수 clamp(2R INFO#4 후속) · unref(항목 5) — 전부 이 3개 커밋이 스스로 선언한 수정 대상에 대응하며, 무관한 커버리지 확장은 없다.
- **plan 문서 diff**: 이월 INFO 5건 체크박스를 완료 서술로 교체 + 셧다운 중 만료 콜백 미실행 리스크를 신규 백로그 항목(:169-180)으로 등재. 이는 2R RESOLUTION 이 "런북에서 추적 중"이라는 검증 안 된 주장을 발견해 실제 추적처를 만든 것으로, 같은 diff 안의 `.unref()` 변경에 직접 종속된 문서 갱신이지 별개 스코프가 아니다.
- **불필요한 리팩토링 / 기능 확장 / 무관한 파일 / 설정 변경**: 없음. `codebase/frontend`, 다른 backend 모듈, 설정 파일(`package.json`, CI, lint config 등) 어디에도 손대지 않았다.

## 요약

3개 커밋(`69aad5d5d`→`b75e6a76b`→`80ac92668`) 모두 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 선언한 단일 작업 — 이월 INFO 5건 정리와 그 정리 과정에서 두 차례 리뷰가 잡은 회귀/거짓 근거의 정정 — 범위 안에서만 움직인다. `git diff origin/main...HEAD --stat` 실측으로 33개 파일 전부가 이 3개 커밋에 귀속됨을 확인했고, 리뷰 산출물(29개 파일)은 프로젝트가 명시한 저장 위치·워크플로에 따른 정상 부산물이지 무관한 혼입이 아니다. 신규 `private` 메서드 추출·5개 테스트·import 재정렬·plan 갱신 모두 선언된 5개 이월 항목 또는 그 항목에 대한 리뷰 재발 수정에 필연적으로 종속돼 있으며, 의도 이상의 변경·범위 밖 리팩터링·기능 확장·설정 변경은 발견되지 않았다. 직전 라운드(`review/code/2026/09/03/12_16_24/scope.md`)의 NONE 판정과 독립적으로 수렴한다.

## 위험도

NONE
