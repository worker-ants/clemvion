# 변경 범위(Scope) Review

## 대상

- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts`
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `codebase/frontend/src/lib/websocket/ws-client.ts`

## 근거 문서 대조

`plan/in-progress/refactor/06-concurrency.md` 를 확인한 결과, 이 diff 는 다음 4개 백로그 항목의 "권장(A)" 안을 그대로 구현한 것이다.

- **M-3** [Major] `void client.join(channel)` unawaited → `await client.join` + try/catch 롤백 + 실패 ack, `leave` 도 await(best-effort). — `websocket.gateway.ts`
- **M-6** [Major] frontend 싱글턴 WsClient 핸들러 중복 등록 위험 → 등록 직전 `client.off(event, handler)` 선행(`bind` 헬퍼). — `use-execution-events.ts`
- **m-3** [Minor] `ws-client.ts` 동시 `connect()` 경쟁 → `socket.connected || socket.active` pending 가드. — `ws-client.ts`
- **m-5** [Minor] snapshot 경고 타이머 dismiss 깜빡임 → dismiss ~1s hysteresis. — `use-execution-events.ts`

각 항목은 plan 문서에 옵션 비교·권장안·검증 방법까지 사전 정의돼 있고, diff 의 구현·주석·테스트가 그 권장안(A)과 일치한다. "저비용 선제 수정", "국소 변경" 으로 명시된 항목들이며, 실제 코드도 해당 지점에 정확히 국소화돼 있다.

## 발견사항

### INFO 파생적 테스트 값 변경(범위 내, 부작용 아님)
- 위치: `websocket.gateway.spec.ts` L59-69 (`handleUnsubscribe` 를 `async`/`await` 로 전환), `use-execution-events.test.ts` L2295-2304 (`connectOffCalls` 2→4, `resumedOffCalls` 1→2 단언 값 변경)
- 상세: `handleUnsubscribe` 가 M-3 구현으로 `async` 시그니처가 됐고, `bind` 헬퍼(M-6, off-before-on)가 각 리스너 등록 시 추가 `off` 호출을 유발하므로 기존 카운트 단언이 늘어난 값으로 갱신됐다. 둘 다 해당 항목의 구현이 만든 필연적 파생 효과이며 무관한 리팩토링이 아니다.
- 제안: 없음 — 범위 내 정상 변경.

### INFO 코멘트 밀도가 높으나 전부 근거 태그(M-3/M-6/m-3/m-5) 부착
- 위치: 6개 파일 전반
- 상세: 각 변경 지점에 `M-3 (06 concurrency)`, `m-3`, `M-6`, `m-5` 태그와 plan 근거가 일관되게 달려 있어 추적 가능성이 높다. 관련 없는 주석 추가/삭제/수정은 발견되지 않았다.
- 제안: 없음.

### INFO 신규 임포트는 신규 테스트에 필요한 최소 임포트
- 위치: `use-execution-events.test.ts` L2 (`act` 추가 임포트)
- 상세: `act`는 M-6/m-5 신규 테스트(`vi.advanceTimersByTime` 를 감싸는 용도)에서만 사용되며 불필요한 임포트가 아니다.
- 제안: 없음.

의도 이상의 변경, 무관한 파일 수정, 포맷팅 노이즈, 사용하지 않는 임포트, 설정 파일 변경, over-engineering 성격의 기능 확장은 발견되지 않았다. 6개 파일 모두 plan 문서의 4개 백로그 항목 각각에 정확히 1:1로 매핑되며, 각 diff hunk 는 해당 항목이 정의한 "국소적", "최소 변경" 원칙을 벗어나지 않는다.

## 요약

이 변경은 `plan/in-progress/refactor/06-concurrency.md` 에 사전 정의된 M-3/M-6/m-3/m-5 4개 백로그 항목(각각 옵션 비교·권장안·검증 기준 명시)을 그대로 구현한 것으로, 범위 이탈·불필요 리팩토링·무관 수정·포맷팅 노이즈·기능 확장이 전혀 관찰되지 않는다. 테스트 파일의 assertion 값 변경(off 호출 카운트 증가, async 전환)도 해당 구현의 필연적 파생 효과일 뿐 별개 리팩토링이 아니다. 변경 범위 관점에서 매우 깨끗한 diff 다.

## 위험도

NONE
