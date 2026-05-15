## 발견사항

### [WARNING] cursor 페이로드 명세와 구현 불일치 (3곳)
- **위치 1**: `query-background-run.dto.ts` JSDoc — `서버가 { lastCreatedAt, lastId }를 직렬화`
- **위치 2**: 동 파일 `@ApiPropertyOptional` example — base64 디코드 시 `{"createdAt":"...","id":"123"}`
- **위치 3**: `spec/4-nodes/1-logic/12-background.md §8.3` — 정렬 키를 `NodeExecution.createdAt ASC, id ASC`로 기술
- **상세**: 실제 구현(`background-runs.service.ts` `CursorPayload`)은 `{ s: string; i: string; }`로, `s`는 `startedAt`(ISO8601), `i`는 `NodeExecution.id`다. 명세·주석·예제가 모두 실제 키(`s`, `i`)·정렬 기준(`startedAt`)과 어긋남. cursor 포맷을 신뢰하고 클라이언트를 구현하면 디코딩 오류 발생.
- **제안**: `query-background-run.dto.ts` JSDoc를 `서버가 { s (startedAt ISO8601), i (NodeExecution.id) }를 직렬화`로, example base64를 `Buffer.from('{"s":"2026-05-15T05:04:37.000Z","i":"123"}').toString('base64')`로 교체. spec §8.3 정렬 키를 `startedAt ASC, id ASC`로 수정.

---

### [WARNING] `cancelled` 상태: 타입·spec 정의 ≠ 구현
- **위치**: `background-run-response.dto.ts:6`, `spec/4-nodes/1-logic/12-background.md §8.2`
- **상세**: `BackgroundRunStatus` 타입과 spec에 `'cancelled'`가 포함되어 있으나, `deriveBackgroundRunStatus()`는 해당 값을 절대 반환하지 않는다. spec §8.2는 "maxDurationMs 초과 등"을 `cancelled` 발생 조건으로 기술하지만 processor에 타임아웃 강제 종료 로직이 없어 사실상 dead enum member다. API 소비자가 `cancelled` 처리 분기를 작성해도 실제로 수신되지 않음.
- **제안**: 미구현임을 명시하거나(`// reserved — not yet emitted; maxDurationMs enforcement not implemented`), spec에서 `cancelled` 조건을 "TODO"로 표시. 또는 `BackgroundRunStatus`에서 `'cancelled'` 제거 후 구현 시 재추가.

---

### [WARNING] `getBackgroundRun` 공개 메서드 JSDoc 부재
- **위치**: `background-runs.service.ts:92`
- **상세**: `verifyBackgroundRunOwnership`은 JSDoc이 있지만 핵심 공개 API인 `getBackgroundRun`에는 없다. 파라미터(executionId vs backgroundRunId의 역할 차이, query 구조, userWorkspaceId가 CurrentUser 데코레이터에서 오는 경위)가 명시되지 않아 서비스를 직접 호출하는 컨텍스트(테스트, future WebSocket guard)에서 계약을 알기 어렵다.
- **제안**: 클래스 JSDoc처럼 파라미터 의미·예외 조건(NotFoundException 발생 시나리오)을 brief JSDoc으로 추가.

---

### [INFO] `NodeExecutionsList`의 `sorted` 변수명이 오해를 유발
- **위치**: `background-run-section.tsx:168`
- **상세**: `const sorted = useMemo(() => nodes, [nodes])`는 정렬을 수행하지 않는다. 변수명 `sorted`는 정렬이 됐다는 암시를 주며 `useMemo`도 실질적으로 아무것도 memoize하지 않는다(nodes 배열 자체를 그대로 반환). 코드 독자가 의도적 정렬 생략인지, 미구현인지 판단하기 어렵다.
- **제안**: `const nodes = items` 로 단순화하거나, 의도가 "API가 이미 정렬된 순서를 보장함"이라면 `// API returns body nodes in chronological order (startedAt ASC)` 주석 추가 후 `useMemo` 제거.

---

### [INFO] `useEffect` 의존성 비활성화 사유 미문서화
- **위치**: `use-background-run.ts:97`
- **상세**: `// eslint-disable-next-line react-hooks/exhaustive-deps` 한 줄만 있고 왜 `queryKey`를 deps에서 제외했는지 기술되지 않았다. 이 결정이 의도적 안정화(channel 재구독 루프 방지)인지 실수인지 알 수 없다.
- **제안**: `// intentionally omit queryKey — channel is stable for a given backgroundRunId; re-subscribing on every render would cause an infinite loop` 같은 설명 추가.

---

### [INFO] `background-runs.controller.ts` 클래스 수준 JSDoc 부재
- **위치**: `background-runs.controller.ts:24`
- **상세**: Swagger `@ApiOperation`으로 엔드포인트 단위 문서는 충분하지만 컨트롤러 클래스 자체에 역할·책임 요약이 없다. `ExecutionsModule`에서 `BackgroundRunsController`가 exported되는 맥락에서 코드 탐색 시 진입점을 파악하려면 파일을 열어야 한다.
- **제안**: 컨트롤러 클래스 위에 1줄 brief JSDoc 추가 (`/** Read-only monitoring API for background body subgraph runs (spec §8). */`).

---

### [INFO] 영문 문서(`logic.en.mdx`) spec 링크가 dead link 가능성
- **위치**: `logic.en.mdx:418`
- **상세**: `spec [Background §8](/spec/4-nodes/1-logic/12-background.md#8-모니터링-api)` 링크가 프론트엔드 문서 라우팅 기준으로 유효한 경로인지 불확실. `.mdx` 문서의 라우팅 기반이 `frontend/src/content/docs/`이므로 `/spec/...` 경로는 404 가능성이 있다. 한국어 파일(`logic.mdx`)에도 동일 링크가 있다.
- **제안**: 링크 타겟을 프로젝트의 실제 docs 라우팅 컨벤션에 맞게 검증하거나, 링크 없이 "API spec에서 확인" 식으로 변경.

---

## 요약

전체적으로 마이그레이션 SQL 주석, WebSocket 서비스·게이트웨이 JSDoc, spec §8 신설 섹션(Rationale 포함) 등 문서화 품질이 높다. 그러나 **cursor 페이로드 구조에 대한 명세와 구현의 불일치**(DTO JSDoc·ApiProperty example·spec 정렬 키 모두 실제 `{s, i}` 키와 다름)가 가장 큰 리스크이며, 이는 cursor 기반 페이지네이션을 직접 구현하거나 디버깅하는 개발자에게 혼란을 준다. `cancelled` 상태가 타입과 spec에 정의되어 있으나 코드에서 생성되지 않는 점도 소비자 계약 관점에서 오해를 유발할 수 있다.

## 위험도

**MEDIUM** — cursor 문서 불일치와 `cancelled` 미구현은 API 소비자 코드에 영향을 줄 수 있으나 런타임 장애는 아니다.