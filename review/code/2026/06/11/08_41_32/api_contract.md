# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] `topK` `@IsNumber()` → `@IsInt()` 요청 검증 강화 — 이미 적용 완료
- **위치**: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` diff L94-95
- **상세**: 청크 개수(`topK`)에 `@IsNumber()`(float 허용) 대신 `@IsInt()`를 사용하도록 변경됨. spec §2.1 `"type":"integer"` 요구사항과 일치. 이전 리뷰 세션(08_30_07) Warning #2에서 식별 후 RESOLUTION에서 "수정 완료"로 처리된 사항이 diff에 반영된 상태. 하위 호환성 유지 — 정수만 허용하므로 기존 정수 값 전송 클라이언트에 영향 없음. 부동소수점 값을 보내던 (비정상) 클라이언트는 이제 400 응답 수신.
- **제안**: 현재 적용 상태 유지. 추가 조치 불필요.

### [INFO] `topK` `default: 5` OpenAPI hint 제거 — codegen 영향 확인 권장
- **위치**: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` diff L90
- **상세**: `@ApiPropertyOptional({ default: 5 })` 제거. 런타임 동작은 서비스 레이어에서 token-budget + inject-cap 동적 컷으로 결정하므로 실제 API 동작 변경 없음. OpenAPI 스펙 JSON/YAML 기준으로는 `topK` 필드의 `default` 필드가 사라지는 변경이라, codegen 기반 클라이언트(TypeScript fetch client 등)가 있다면 재생성 필요. 현재 description에 "고정 default 아님, 동적 컷이 결정" 명시되어 있어 오용 방지.
- **제안**: codegen 사용 여부 확인. 사용 중이면 재생성 처리. description 내 동작 명시로 문서 측면은 충분.

### [INFO] `rerankMode` / `rerankLlmConfigId` description 갱신 — 하위 호환성 영향 없음
- **위치**: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` diff L38-39, L51-52; `update-knowledge-base.dto.ts` diff L219-220
- **상세**: enum 값(`off`, `cross_encoder`, `cross_encoder_llm`) 변경 없음. `cross_encoder_llm` 의 구현 상태를 "후속 구현" → 현재 구현 완료 문구로 정정. `rerankLlmConfigId` 필드의 "후속 구현" 단서 제거. 기존 API 계약(필드명, 타입, enum 값, 선택/필수 여부) 전혀 변경 없음. OpenAPI 문서 description 텍스트만 갱신.
- **제안**: 추가 조치 불필요.

### [INFO] `startHeadlessChat` 시그니처 변경 — examples/ 파일, published 표면 밖
- **위치**: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` diff L371-390
- **상세**: `(apiBase, endpointPath, firstMessage: string, handlers)` → `(apiBase, endpointPath, handlers, profile?: Record<string, unknown>)`. 파라미터 순서 변경 포함. RESOLUTION(08_30_07) Warning #1에서 "package.json `files`/`exports` 미정의, `main: dist/index.js`, tsconfig `src/**` 기준 빌드 — examples/ 는 published 표면 밖, 직접 호출자 0"으로 수용 결정됨. profile은 optional이고 파라미터 말미에 배치 — 신규 호출자에게 자연스러운 순서.
- **제안**: package.json `exports` 필드에 `examples/` 경로가 포함되지 않는지 최종 확인. 포함된다면 major version bump 또는 deprecation notice 필요. 현재 판단 기준(포함 안 됨)은 유효하며 README가 새 패턴을 명확히 제시하므로 마이그레이션 혼선 없음.

### [INFO] `triggerWebhook` payload `{firstMessage}` → `{profile}` — 서버 측 breaking change 아님
- **위치**: `codebase/packages/web-chat-sdk/README.md` diff L247, `byo-ui-headless.ts` diff L382-390
- **상세**: webhook 엔드포인트는 generic trigger input을 수신하는 구조. `firstMessage`는 예제 코드가 임의로 넣던 키이며 서버에서 정식 처리되지 않았음(spec §R6: multi_turn이 webhook 입력을 첫 턴으로 소비하지 않아 증발). 서버 API 계약(엔드포인트 URL, HTTP 메서드, 응답 형식) 변경 없음. payload 구조는 자유 형식이므로 `firstMessage` 제거 / `profile` 추가는 서버 측 breaking change가 아님.
- **제안**: 추가 조치 불필요. RESOLUTION INFO #4에서 "서버 코드 변경 불요" 확인됨.

## 요약

이번 변경의 API 계약 관련 사항은 전부 문서 문자열 정정 및 요청 유효성 검증 강화(topK `@IsNumber` → `@IsInt`) 수준이다. enum 값, 필드명, HTTP 메서드, 엔드포인트 URL, 응답 형식 등 런타임 API 계약의 핵심 요소에 변경이 없어 기존 API 클라이언트에 breaking change가 발생하지 않는다. `startHeadlessChat` 시그니처 변경은 published 패키지 표면 밖의 예제 파일에 한정되며, topK `default: 5` OpenAPI hint 제거는 codegen 재생성이 필요할 수 있으나 런타임 동작 무관이다. 이전 리뷰 세션(08_30_07)에서 API 계약 관련 항목 모두 수용/처리 완료 상태이며, 본 리뷰에서 추가 차단 사항 없음.

## 위험도

LOW
