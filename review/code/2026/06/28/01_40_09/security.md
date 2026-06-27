# 보안(Security) 코드 리뷰

리뷰 대상: `useWidget` God hook 분리 — `useTokenRefresh` / `usePendingMessageQueue` 추출 (behavior-preserving 리팩터)

---

## 발견사항

### [INFO] 토큰 갱신 실패 시 에러 원문이 console.warn 에 노출됨
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.ts` L62–64
- 상세: `.catch` 핸들러에서 `err instanceof Error ? err.message : String(err)` 를 `console.warn` 으로 출력한다. 브라우저 DevTools 에서 확인 가능하며, 에러 메시지에 서버 내부 정보(endpoint URL, 응답 본문 등)가 포함될 수 있다. 임베드 위젯 특성상 타 도메인의 DevTools 에도 노출된다. 단, 이는 `use-widget.ts` 의 기존 동작을 그대로 보존한 것으로 이번 리팩터에서 새로 도입된 취약점이 아니다. `errMessage()` 와 달리 UI 에 노출되지 않으므로 severity 는 INFO.
- 제안: 장기적으로는 `err.message` 대신 고정 문자열(예: `"token refresh failed"`)만 warn 하고, 원문은 별도 telemetry 경로로 전달하는 방향 검토 가능. 단, 본 PR 범위(behavior-preserving)에서는 현행 유지가 적절.

### [INFO] `pending?.nodeId` 가 undefined 로 서버에 전달될 수 있음
- 위치: `/codebase/channel-web-chat/src/widget/use-pending-message-queue.ts` L50
- 상세: `isTextInputSurface(null) === true` 인 과도 상태에서 `pending?.nodeId` 는 `undefined` 가 되어 `submit_message` 페이로드에 `nodeId: undefined` 가 포함된다. 이는 의도된 동작으로 주석으로도 명시되어 있으나, 서버 측에서 `nodeId` 누락·`undefined` 직렬화를 명시적으로 처리하지 않을 경우 예측 불가능한 동작이 발생할 수 있다. 보안 관점에서 nodeId 없는 요청이 잘못된 실행 노드에 접근하는 권한 문제를 일으키지 않는지 서버 측 검증이 필요하다.
- 제안: 서버 EIA `submit_message` 핸들러가 `nodeId` 누락 요청을 명시적으로 거부하거나 안전하게 처리함을 spec(EIA §6.2)에서 확인할 것. 클라이언트에서는 `pending === null` 일 때 flush 를 보류하는 방어 로직도 고려 가능.

### [INFO] sessionStorage 키에 사용자 제공 `triggerEndpointPath` 값이 그대로 사용됨
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.ts` L58 (`saveSession` 호출), `/codebase/channel-web-chat/src/widget/use-widget.ts` (전반)
- 상세: `saveSession(currentCfg.triggerEndpointPath, updated)` 에서 `triggerEndpointPath` 가 `sessionStorage` 키 일부로 사용된다. `triggerEndpointPath` 는 host 페이지 또는 query param 에서 수신하는 외부 입력이다. 악의적 host 가 특수 문자 또는 긴 문자열을 주입할 경우 sessionStorage 키 충돌 또는 저장소 오용 가능성이 있다. 이번 리팩터에서 새로 도입된 것은 아니나 `use-token-refresh` 로 분리되면서 같은 패턴이 새 파일에도 존재함.
- 제안: `saveSession` 내부에서 `triggerEndpointPath` 를 `encodeURIComponent` 또는 고정 prefix(`clemvion-web-chat:session:`)와 결합해 키를 정규화하는지 확인. 이미 `session-store.ts` 에서 처리되고 있다면 문제없음(테스트 코드에서 `"clemvion-web-chat:session:t1"` 형태가 관찰되어 prefix 처리는 존재하는 것으로 보임).

### [INFO] `configFromQuery()` — URL query param `apiBase` 가 원점(origin) 검증 없이 사용됨
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L1270–1277 (전체 파일 컨텍스트)
- 상세: 이번 변경의 직접 수정 대상은 아니나, `configFromQuery()` 에서 읽은 `apiBase` 가 `isEmbedAllowed` / `EiaClient` 생성에 사용된다. 악의적 페이지가 `?apiBase=https://attacker.com` 으로 위젯을 로드하면, 위젯이 공격자 서버와 SSE 연결을 수립하고 토큰을 전송할 수 있다. plan/in-progress 의 backlog 에 이미 "configFromQuery apiBase origin 검증(보안 #6)"이 INFO 로 기록되어 있어 인지된 사안임.
- 제안: `apiBase` 를 허용 목록(allowlist) 또는 같은 호스트 기반으로 제한하거나, query param 경로는 개발/샘플 전용임을 spec 에 명시. 이번 PR 범위 밖이나 중장기 개선 권장.

---

## 요약

이번 변경은 `useWidget` God hook 에서 `useTokenRefresh` 와 `usePendingMessageQueue` 를 추출한 behavior-preserving 리팩터다. 새로 도입된 보안 취약점은 없으며, 기존 코드의 동작이 두 개의 캡슐화된 훅으로 그대로 이전되었다. 주요 보안 제어(토큰 갱신 실패 silent-fail·일반화 에러 메시지·sessionStorage 사용·embed origin 검증 soft-control)는 모두 이번 PR 이전부터 존재하던 설계이며 변경 없이 유지된다. 발견사항은 모두 INFO 등급으로 이번 리팩터와 직접적 인과관계가 없는 pre-existing 또는 의도된 설계다. `nodeId: undefined` 서버 전달 동작만 서버 측 처리 확인이 권장된다.

---

## 위험도

NONE
