## 발견사항

### [WARNING] `192.168.x.x` RFC1918 범위 전용 테스트 누락
- **위치**: `llm.service.spec.ts` — `previewModels` SSRF 섹션
- **상세**: `isPrivateHost`는 `192.168.0.0/16` 차단 로직을 포함하지만, 전용 테스트가 없음. `10.0.0.5`(Class A)와 `172.16-31.x`(Class B)는 커버되나 `192.168.1.1` 시나리오가 누락.
- **제안**: `rejects RFC1918 Class C (192.168.x.x) range` 케이스 추가

### [WARNING] `172.16-31` 경계값 테스트 미검증
- **위치**: `llm.service.spec.ts` — `rejects RFC1918 Class B` 테스트
- **상세**: 차단 범위의 양쪽 경계(`172.15.x.x`는 허용되어야 하고, `172.32.x.x`도 허용)를 검증하는 테스트 없음. 경계 off-by-one 버그가 잠복해도 현재 테스트로는 감지 불가.
- **제안**: `172.15.0.1`, `172.32.0.1` 에 대해 `rejects`가 **발생하지 않음**을 명시적으로 검증

### [WARNING] `LlmConfigService` 트랜잭션 로직 테스트 없음
- **위치**: `llm-config.service.ts` — `create()` / `update()` 트랜잭션 분기
- **상세**: `isDefault=true` 시 `manager.transaction()` 내에서 기존 default 해제 후 저장하는 새 경로가 추가됐으나, 서비스 스펙 파일에 해당 시나리오 테스트 없음. `isDefault=false` 단순 저장 경로와의 동작 차이도 미검증.
- **제안**: `isDefault=true`로 생성 시 기존 default가 false로 바뀌는 것을 검증하는 통합 테스트 또는 mock transaction 테스트 추가

### [WARNING] `remove()` 캐시 순서 변경에 대한 테스트 없음
- **위치**: `llm-config.controller.ts:227-230`
- **상세**: DB 삭제 전 캐시를 지우던 버그를 수정(주석에 명시)했으나, "DB 성공 후 캐시 제거" 순서를 검증하는 테스트가 없음. 컨트롤러 테스트에서 DB 삭제 실패 시 캐시가 살아있어야 함을 보장하는 케이스 필요.
- **제안**: `llmConfigService.remove`가 실패하면 `llmService.clearClientCache`가 호출되지 않음을 검증하는 테스트 추가

### [WARNING] Google SDK 대규모 마이그레이션 테스트 범위 불확실
- **위치**: `google.client.ts` 전체, `google.client.spec.ts` (diff 프롬프트 길이 초과로 잘림)
- **상세**: `@google/generative-ai` → `@google/genai` 로 SDK를 전면 교체하면서 채팅 세션 패턴(startChat + sendMessage)에서 직접 `generateContent` 호출로 변경. `tool_call.id` 처리, `functionResponse.id` 추가, `thoughtSignature` 에코 방식 변경 등 런타임 동작 변경사항이 많음. 테스트 diff가 잘려 실제 커버리지 확인 불가.
- **제안**: 특히 (a) tool call round-trip(functionCall → functionResponse), (b) thoughtSignature 에코, (c) `generateContentStream`이 `AsyncIterable<unknown>` 으로 캐스팅되는 경로의 오류 케이스를 명시적으로 확인 필요

### [WARNING] OpenAI `listModels`에 모델 수 상한 테스트 없음
- **위치**: `openai.client.spec.ts`, `openai.client.ts`
- **상세**: Anthropic 클라이언트에는 100개 상한 테스트(`caps the number of models returned at 100`)가 있으나 OpenAI 클라이언트는 상한 없이 무한 iteration. 대규모 응답 시 메모리·UI 드롭다운 문제 발생 가능.
- **제안**: OpenAI에도 동일한 상한 적용 후 테스트 추가, 또는 의도적 차이라면 인터페이스 계약에 명시

### [WARNING] `ModelCombobox` 프론트엔드 컴포넌트 테스트 없음
- **위치**: `frontend/src/components/llm-config/model-combobox` (신규 컴포넌트)
- **상세**: `page.tsx`에서 사용하는 새 컴포넌트가 추가됐으나, `previewModels` API 호출·에러 핸들링·로딩 상태·직접 입력 fallback 동작을 검증하는 테스트가 없음.
- **제안**: 최소한 (a) 모델 로드 성공 시 드롭다운 옵션 렌더, (b) 로드 실패 시 자유 입력 허용, (c) 빈 apiKey 시 버튼 비활성화 여부를 커버하는 컴포넌트 테스트 작성

### [INFO] `jwt.strategy.spec.ts` `as never` 제거 불일치
- **위치**: `jwt.strategy.spec.ts:82, 102, 114` vs 나머지 `mockUser as never`
- **상세**: `null` 값에 대한 `as never` 제거는 올바르나, 같은 파일의 `mockUser as never`, `mockWorkspace as never`는 그대로 남아 스타일 불일치. 런타임 영향은 없으나 타입 정확도 개선 여지 있음.
- **제안**: 동일 파일 내 `as never` 잔존 케이스도 정리 (단, 타입 호환성 먼저 확인)

### [INFO] `transformIgnorePatterns` 정규식 변경 효과 검증 방법 없음
- **위치**: `backend/package.json`
- **상세**: pnpm 환경에서의 ESM 패키지(`uuid`, `p-limit`, `yocto-queue`) transform 문제를 수정하는 정규식 변경이나, CI에서 실제 pnpm flat/hoist 구조로 검증되는지 확인 불가. `node_modules/.pnpm/*/node_modules/` 경로 패턴이 올바른지 별도 확인 필요.
- **제안**: pnpm 환경 CI 통과 여부 확인으로 충분; 별도 단위 테스트 불필요

### [INFO] `async iterator` done 타입 수정 — `value: undefined` 
- **위치**: `anthropic.client.spec.ts:12`, `openai.client.spec.ts:15`, `workflow-assistant-stream.service.spec.ts:57`
- **상세**: `value: undefined as unknown as T` → `value: undefined` 변경. 실제 `IteratorResult<T>` 스펙에서 `done: true`일 때 `value`는 `T | undefined`이므로 타입적으로 올바른 수정. 기존 동작 변경 없음.

---

## 요약

이번 변경의 핵심은 (1) 광범위한 `as unknown as X` 타입 단언 제거, (2) `previewModels` 신규 기능 추가, (3) Google SDK 전면 교체, (4) `listModels`에 AbortSignal + 타임아웃 추가이다. `previewModels`의 SSRF 가드 테스트는 IPv6, IPv4-mapped, RFC1918 다수 케이스를 커버해 수준이 높다. 다만 `192.168.x.x`·`172.16-31` 경계값 누락, `LlmConfigService` 트랜잭션 로직 미검증, Google SDK 마이그레이션의 테스트 diff 미확인, 캐시 순서 버그픽스 미검증이 잠재적 위험으로 남아 있다. 프론트엔드 `ModelCombobox`는 테스트가 전무한 상태로 추가되어 회귀 감지 망에서 제외되어 있다.

## 위험도
**MEDIUM**