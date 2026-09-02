# 문서화(Documentation) Review

## 배경 — 이전 라운드(17_38_12) 대비 확인

이번 diff 는 `auth.token_expired` 구현(파일 1~9)과 함께 직전 리뷰 라운드(`review/code/2026/09/02/17_38_12/**`, `review/consistency/2026/09/02/**`)의 산출물을 커밋으로 포함한다. 그 라운드의 `documentation.md` 는 WARNING 3건을 냈고 `RESOLUTION.md` 가 조치를 주장한다 — 이번 라운드에서는 diff 를 직접 대조해 그 주장을 검증했다.

| 이전 WARNING | 검증 결과 |
|---|---|
| `EXPECTED_EXPORTS` 완전성 목록에 `AuthEventType`/`AuthTokenExpiredPayload` 누락 | **해소 확인** — `websocket-events.types.spec.ts` diff 에 두 항목이 추가됐고, `#1174` 회귀·부분집합 검사 한계를 설명하는 주석이 함께 달림 |
| CHANGELOG.md 미갱신 | **해소 확인** — `Unreleased` 섹션에 `connect()` no-op 함정·revoke 카브아웃까지 포함한 서술형 항목 추가, 기존 항목들과 톤 일치 |
| spec `Planned` 배지·tracker 체크박스 stale 예정, 후속 조치 포인터 부재 | **해소 확인** — `ws-token-expired-socket-lifetime-impl.md` 체크리스트에 "머지 후 planner 턴" 항목 신설. `spec/5-system/6-websocket-protocol.md:52,1100,1133` 은 실제로 여전히 `Planned` 배지가 남아 있음을 직접 확인했으나, developer 가 그 문구의 원저자가 아니라 자기-반증형 소정정 예외 대상이 아니라는 판단이 정확하고 포인터가 남아 추적이 끊기지 않는다 |

세 건 모두 근거 문서(spec §4.6, `spec-sync-websocket-protocol-gaps.md:23` 등)를 직접 열어 대조했고, 주장과 실제 상태가 일치했다.

## 발견사항

- **[INFO]** `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에는 개별 설명이 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207` (`timers.cutoff = setTimeout(...)`) — 참고로 인접한 `untilNotice` 클램프 설명은 `:180-190`
  - 상세: `armExpiryTimers` 안에는 `Math.max(0, …)` 클램프가 두 곳(`untilNotice` 계산, `cutoff` 타이머 지연)에 각각 쓰인다. `:180-186` 주석은 "이 clamp 를 빼도 동작이 같고 실제로 뮤테이션에서 살아남았다(M3)... 런타임 구현 세부를 코드가 표현하려는 계약으로 명시한다" 는 근거를 `untilNotice` 바로 위에 달아 두었지만, 같은 패턴이 `cutoff` 타이머(`:206`)에도 반복되는데 그쪽에는 별도 주석이 없다. 코드를 처음 읽는 사람이 `untilNotice` 설명을 `cutoff` 까지 확장해서 읽을지는 문맥에 의존한다 — 두 클램프가 같은 함수 안에 8줄 간격으로 있어 실제 혼동 가능성은 낮지만, "왜 여기도 `Math.max(0, ...)`인가" 를 명시적으로 잇는 한 줄이 없다.
  - 제안: `Math.max(0, untilCutoff)` 옆에 "notice 와 같은 이유(런타임 방어, 계약 표현) — 위 설명 참조" 정도의 짧은 참조 주석을 추가하거나, 두 클램프를 한 헬퍼(`clampDelay(ms)`)로 묶어 설명을 한 곳으로 합친다. 차단 사유는 아님.

## 검토했으나 이상 없음으로 판단한 항목

- **JSDoc 정확성**: `AuthEventType`/`AuthTokenExpiredPayload`(`websocket-events.types.ts:274-300`)의 JSDoc 이 인용하는 spec 절번호(§4.6)·Rationale ID(`R-ws-socket-lifetime-binds-token`)를 spec 파일에서 직접 `grep` 으로 확인 — 실체와 일치.
- **명명 충돌 서술**: `AuthTokenExpiredPayload` JSDoc 이 `_retryState.expiresAt`(§4.2)·`auth.refreshed.expiresAt`(§1.3 비채택)과의 명칭 충돌을 구분해 명시 — consistency `naming_collision` checker 가 이미 검증한 내용과 일치.
- **`armExpiryTimers`/`TOKEN_EXPIRY_LEAD_MS` JSDoc**: 60초·900초·6.7% 수치가 실제 코드 상수(`TOKEN_EXPIRY_LEAD_MS = 60_000`)·spec 서술과 일치. 이전 라운드에서 잡힌 산술 오류("4%"→"6.7%")도 이미 정정된 상태로 반영돼 있음(`plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` diff 참조).
- **인라인 주석-코드 일치**: `ws-client.ts` 의 `refreshAndReconnect`·`socket.on("auth.token_expired", …)`·`socket.on("disconnect", …)` 세 블록 주석은 실제 조건 분기(reason 필터, disconnect→connect 순서)와 정확히 대응. `{@link AuthEventType.AUTH_TOKEN_EXPIRED}` TSDoc 문법도 같은 모듈(`websocket.service.ts`)의 `{@link X}` 관례와 일치.
- **테스트 설명 vs 실제 검증**: `websocket.gateway.spec.ts`/`ws-client.test.ts` 의 `describe`/`it` 문구("소켓당 누수다", "순서가 뒤집히면 다시 no-op") 가 실제 단언(`invocationCallOrder` 비교, `clearTimeout` 미호출 검증 등)과 일치 — 문서-역할을 하는 테스트명이 정확함.
- **README/설정 문서**: 이번 변경은 신규 환경변수·설정 옵션·공개 API 엔드포인트가 없다(WS 이벤트 1종 추가, 기존 JWT `exp` 클레임 재사용). `websocket/` 하위에는 원래 모듈별 README 관례가 없어 README 갱신 대상 아님. REST 계약이 아니므로 `spec/conventions/swagger.md` 대상도 아님.
- **07-workspace-and-team 유저 가이드·e2e**: 별도 `user_guide_sync` 리뷰어가 이미 WARNING 으로 지목했고, `RESOLUTION.md`(W7)가 "사용자 대면 UI 변경 없는 내부 신뢰성 개선" 이라는 근거로 명시적 미조치 판단을 기록해 뒀다 — 조용한 누락이 아니라 판단이 남은 상태라 본 리뷰에서 중복 기재하지 않음.

## 요약

이전 라운드가 지적한 문서화 WARNING 3건(export 완전성 목록, CHANGELOG, spec 배지 후속 포인터)은 모두 diff 와 실제 파일 대조로 해소가 확인됐다 — 근거 문서를 직접 열어 주장과 대조했고 불일치가 없었다. 신규 코드(`AuthEventType`/`AuthTokenExpiredPayload`/`armExpiryTimers`/`refreshAndReconnect`)의 JSDoc·인라인 주석은 spec 절번호·Rationale ID·수치까지 실체와 정확히 일치하며, 테스트 설명도 실제 단언과 부합한다. 유일한 발견은 `cutoff` 타이머 클램프에 대한 설명이 인접한 `notice` 클램프 설명에 암묵적으로 얹혀 있다는 매우 경미한 INFO 로, 차단 사유가 아니다.

## 위험도

NONE
