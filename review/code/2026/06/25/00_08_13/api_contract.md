# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] getStatus 응답에 `seq` 가 항상 `0` placeholder 로 반환됨
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `getStatus()` 반환값 `seq: 0`
- 상세: `seq` 필드가 API 스펙에 정의돼 있고 클라이언트(위젯)가 SSE `Last-Event-Id` 보정에 사용하는데, 현재 항상 `0` 을 반환한다. spec §5.3 에 "seq 항상 `0` placeholder, SSE replay 가 권위" 로 문서화되어 있어 클라이언트가 이를 이미 인지하고 있다. 기존 동작 그대로이며 이번 변경이 이 값을 변경하지 않으므로 breaking change 는 아니다.
- 제안: 중기적으로 seq 실값 노출 로드맵을 spec/계획에 명시하는 것이 좋음. 현재 spec §5.3 에서 이미 언급됨 — 현 상태 허용.

### [INFO] `getStatus` 응답 `context` 필드가 `waiting_for_input` 이 아닌 상태에서는 `null` — 스키마 분기 주의
- 위치: `interaction.service.ts` `getStatus()` 반환부
- 상세: `waiting_for_input` 상태에서만 `currentNode` / `context` 가 실값으로 채워진다. 다른 상태(`running`, `completed`, `failed`)에서는 `null`. 이는 이번 변경 이전부터 `null` 이었으므로 하위 호환성에 문제는 없다. 단, `context` 내부 구조가 interactionType(`buttons` / `form` / `ai_conversation`)에 따라 다른 필드를 가진다(`buttonConfig` vs `nodeOutput`). API 스키마 문서(`ExecutionStatusDto`)에 union 타입 명세가 없으면 클라이언트가 타입을 추론하기 어려울 수 있다.
- 제안: `ExecutionStatusDto.context` 에 discriminated union 타입 주석 또는 OpenAPI oneOf 스키마 추가 권장.

### [INFO] `getStatus` DB 쿼리 추가로 인한 응답 지연 가능성 — SLA 관점
- 위치: `interaction.service.ts` `getStatus()` — `nodeExecutionRepository.findOne(...)` 추가
- 상세: `waiting_for_input` 상태일 때만 추가 쿼리가 실행되므로 일반 상태 조회에는 영향 없음. race fix 경로(start/restore 직후)는 성능 민감하지 않은 cold-path. 하위 호환성 영향은 없음.
- 제안: 특이사항 없음, 현 구현 적절.

### [INFO] SSE stream URL 에 `lastEventId=0` 쿼리 파라미터 추가 — CORS preflight 영향 없음 확인
- 위치: `use-widget.ts` — `openStream(session, "0")` 변경; `use-widget-eager-start.test.ts` — `esUrl` 검증
- 상세: `EventSource` 는 브라우저가 `Last-Event-Id` 헤더를 자동 관리하는 표준 방식과 달리, 이 구현에서는 `?lastEventId=0` 쿼리 파라미터로 전달한다. 서버 측 `sse-adapter` 가 이 파라미터를 처리한다고 명시됨(plan 파일 §핵심 사실). 쿼리 파라미터 추가는 SSE GET 요청이라 CORS preflight 를 추가로 발생시키지 않으므로 CORS 정책에 영향 없음.
- 제안: 특이사항 없음.

## 요약

이번 변경은 `GET /api/external/executions/:id` (getStatus) 엔드포인트의 응답에서 기존에 항상 `null` 이었던 `currentNode` 와 `context` 필드를 `waiting_for_input` 상태에서 실값으로 채우도록 확장한다. 응답 shape 자체는 그대로이고 값만 이전에 없던 경우에 채워지는 방향의 변경이므로 하위 호환성 파괴(breaking change)는 없다. 에러 응답 코드 체계, HTTP 상태 코드, 요청 검증, 인증/인가, URL 설계, 페이지네이션 등 다른 API 계약 항목은 이번 변경으로 영향받지 않는다. `context` 의 interactionType 별 필드 분기가 DTO 레벨에서 typed union 으로 명세되지 않은 점만 개선 여지로 남는다.

## 위험도

LOW

---

ISSUES: 3 (모두 INFO)
