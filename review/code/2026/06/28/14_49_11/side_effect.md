# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `safeApiBaseFromQuery` 신규 export — 공개 API 표면 추가
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (신규 export 함수)
- 상세: `safeApiBaseFromQuery`가 `export function`으로 선언되어 모듈 공개 API에 추가됨. 기존 호출자가 없는 신규 심볼이므로 breaking change가 아니며, 하위 호환성에 영향 없음. 테스트 파일(`use-widget.test.ts`)이 해당 export를 즉시 소비하므로 의도된 설계. 단, 이 함수가 공개 모듈 API에 포함되면 향후 시그니처 변경 시 하위 호환 비용이 발생하므로 내부 유틸리라면 `export` 제거를 고려할 수 있음.
- 제안: 현재 상태로 문제 없음. 다만 테스트 목적으로만 export한 경우라면 테스트 파일에서 직접 구현을 import하는 대신 모듈 내부 테스트 경계를 명확히 하는 편이 장기적으로 낫다. 본 변경 자체는 부작용 없음.

### [INFO] `configFromQuery` 내부 동작 변경 — apiBase가 null/비-http(s)일 때 `undefined` 반환으로 변경
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `configFromQuery()` 함수 내
- 상세: 변경 전: `q.get("apiBase") ?? undefined` — 쿼리 파라미터가 없으면 `undefined`, 있으면 값을 그대로 반환. 변경 후: `safeApiBaseFromQuery(q.get("apiBase"))` — `javascript:`, `data:`, 상대 경로 등 비-http(s) 값이 전달되면 `undefined`를 반환하고 `console.warn`을 발생시킴. 기존에 비-http(s) `apiBase` 쿼리를 실제로 사용하던 호출 경로(예: 개발/테스트 시 `?apiBase=/api` 같은 상대 경로)가 있다면 조용히 동작하던 코드가 `undefined` 반환 + `console.warn`으로 바뀌어 동작이 달라질 수 있음. 하지만 상대 경로를 `apiBase`로 쓰는 것은 보안상 의도치 않은 동작이었으므로 방어적 하드닝이 정당함.
- 제안: 개발 환경에서 `?apiBase=` 상대 경로를 쓰는 문서나 README가 있다면 `http://localhost:...` 형식으로 업데이트 권장. 코드 자체의 부작용은 의도된 것으로 허용 가능.

### [INFO] `console.warn` 부작용 — 비-http(s) apiBase 입력 시 브라우저 콘솔에 경고 출력
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `safeApiBaseFromQuery()` 함수
- 상세: 함수가 `undefined`를 반환하기 직전 `console.warn("[widget] configFromQuery: apiBase 가 http(s) URL 이 아니어서 무시합니다:", raw)`를 호출함. 이는 전역 `console` 객체를 부작용으로 사용하며, 테스트 환경에서는 `vi.spyOn(console, "warn").mockImplementation(() => {})` 로 올바르게 격리하고 있음. 프로덕션 콘솔 오염을 의도적으로 발생시키는 경보 패턴으로 적합하나, SSR 환경에서 `console.warn`이 서버 로그에 기록될 수 있음. 단, 함수 진입부에서 `typeof window === "undefined"` 가드가 `configFromQuery()`에 있어 SSR에서 `configFromQuery` 자체가 호출되지 않으므로 실질 위험 없음.
- 제안: 현재 구조 적절함. 테스트가 `console.warn` mock을 사용하여 부작용을 격리하고 있어 테스트 전역 상태 오염도 없음.

### [INFO] `EmbedConfigDto` JSDoc 주석 추가 — 런타임 부작용 없음
- 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
- 상세: `/** ... */` JSDoc 주석 2개 추가. TypeScript 컴파일 후 런타임 JavaScript에 영향 없음. Swagger 스키마 생성은 `@ApiProperty()` 데코레이터 기반이고 JSDoc은 별도이므로, OpenAPI 출력 변경 없음. 클래스 시그니처(`allowlist: string[]`, `enforce: boolean`)도 변경 없어 기존 호출자 영향 없음.
- 제안: 없음.

### [INFO] 테스트 파일 import 목록 변경 — 테스트 격리 확인
- 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts`
- 상세: `afterEach`, `vi` 추가 import, `safeApiBaseFromQuery` 신규 import. `afterEach(() => vi.restoreAllMocks())`가 각 `describe` 블록의 spy를 자동 복원하므로 테스트 간 `console.warn` mock 누출 없음. 기존 `describe` 블록은 영향받지 않음.
- 제안: 없음.

### [INFO] spec/plan/review 파일 변경 — 런타임 부작용 없음
- 위치: `plan/in-progress/webchat-polish-batch.md`, `review/consistency/2026/06/28/14_36_34/` 하위 파일들, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/2-sdk.md`, `spec/7-channel-web-chat/5-admin-console.md`
- 상세: 순수 문서(Markdown/JSON) 변경으로 런타임 코드 실행에 영향 없음. 환경 변수 읽기·쓰기, 네트워크 호출, 파일시스템 동적 조작 없음. `_retry_state.json`은 일관성 검토 세션 내부 상태 파일로 `agents_success: []` 초기 상태이며, 오케스트레이터의 세션 상태 추적 파일임 — 리포지터리 커밋에 포함되어 있지만 런타임 부작용 없음.
- 제안: 없음.

## 요약

본 변경셋의 실질적 코드 변경은 두 가지다: (1) `EmbedConfigDto`에 JSDoc 주석 추가(런타임 무영향), (2) `configFromQuery` 내부에서 `safeApiBaseFromQuery`로 apiBase 스킴 검증 추가. (2)의 부작용은 비-http(s) apiBase 쿼리 값 전달 시 기존 무처리에서 `undefined` 반환 + `console.warn` 발생으로 전환되는 것으로, 이는 의도된 보안 하드닝이다. 신규 export된 `safeApiBaseFromQuery`는 기존 모듈 사용자에게 breaking이 아니며, 테스트는 `afterEach(() => vi.restoreAllMocks())`로 console spy 부작용을 올바르게 격리한다. 전역 변수 오염, 파일시스템 부작용, 의도치 않은 네트워크 호출, 환경 변수 변경은 없다. 문서 파일 변경은 순수 텍스트 조작으로 런타임에 영향이 없다.

## 위험도

NONE
