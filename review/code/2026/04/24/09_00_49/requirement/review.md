## 발견사항

### [WARNING] `PreviewLlmModelsDto` 구현이 diff에 없음
- **위치**: `llm-config.controller.ts:35` — `import { PreviewLlmModelsDto } from './dto/preview-llm-models.dto'`
- **상세**: 컨트롤러가 이 DTO를 `@Body()`로 받지만, `dto/preview-llm-models.dto.ts` 파일이 diff에 포함되어 있지 않아 유효성 검증 범위를 확인할 수 없음. `provider`가 `@IsIn(LLM_PROVIDERS)`로 제한되는지, `apiKey`가 `@IsString()`으로 강제되는지, `baseUrl`이 `@IsUrl()`로 형식 검증되는지 불명확.
- **제안**: DTO에 최소한 `@IsIn(LLM_PROVIDERS)` on `provider`, `@IsString()` on `apiKey`, `@IsUrl()/@IsOptional()` on `baseUrl` 적용 여부를 확인할 것. 없으면 SSRF 가드 이전에 잘못된 형식의 URL이 `new URL(rawUrl)`에 전달될 수 있음.

---

### [WARNING] `ModelCombobox` 컴포넌트 구현이 diff에 없음
- **위치**: `frontend/src/app/(main)/llm-configs/page.tsx:8`
- **상세**: spec §B.2에 명시된 "chat 모델만 필터(embedding 제외)", "저장된 설정이면 `:id/models`, 없으면 `preview-models`" 분기, 자유 텍스트 fallback 등 핵심 UX 요구사항이 구현됐는지 확인 불가.
- **제안**: `frontend/src/components/llm-config/model-combobox.tsx`의 실제 구현에서 `type === 'chat'` 필터 및 `configId` 존재 여부에 따른 API 분기 로직을 확인할 것.

---

### [WARNING] Google `listModels()` 구현이 diff에서 truncate됨
- **위치**: `google.client.ts` (diff truncated)
- **상세**: spec 5.3에서 "supportedActions에 `generateContent` 포함 시 chat, `embedContent` 포함 시 embedding으로 분류"라고 명시하지만, 잘린 diff에서 실제 구현 여부를 확인할 수 없음.
- **제안**: `google.client.ts`의 `listModels()` 구현에서 `supportedActions` 기반 분류가 올바르게 적용되었는지 직접 확인할 것.

---

### [WARNING] `POST :id/test` 엔드포인트에 Rate Limit 누락
- **위치**: `llm-config.controller.ts` — `@Post(':id/test')` 라인
- **상세**: `preview-models`와 `GET :id/models`에는 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`가 추가됐지만 `test` 엔드포인트에는 적용되지 않음. 외부 LLM API를 실제 호출하는 엔드포인트이므로 동일한 보호가 필요함.
- **제안**: `@Post(':id/test')` 위에 동일한 `@Throttle` 데코레이터 추가.

---

### [INFO] `listModels` 에러가 이제 항상 `BadRequestException`으로 변환됨
- **위치**: `llm.service.ts:238–253`
- **상세**: 기존에는 `client.listModels()` 오류가 그대로 전파되었으나, 이제 catch 블록에서 전부 `BadRequestException`으로 변환함. 호출부(컨트롤러)에서 특정 예외 타입을 기대하거나 별도 처리하는 경우 동작이 바뀔 수 있음.
- **제안**: 기존 `/:id/models` 엔드포인트의 클라이언트 코드가 HTTP 상태 코드 기반으로 처리하므로 문제없으나, 내부 호출 지점에서 추가 확인 권장.

---

### [INFO] `withTimeout`에서 inner promise가 reject 시 unhandled rejection 처리
- **위치**: `llm.service.ts` — `withTimeout()` 메서드
- **상세**: `inner.catch(() => undefined)`로 abort 후 SDK가 reject할 때 unhandled rejection을 방지하는 패턴이 올바르게 적용됨. `finally`에서 `clearTimeout`으로 타이머 누수도 방지됨. 구현이 spec 요구사항(30초 타임아웃, AbortSignal 전파)을 충족함.

---

### [INFO] `isDefault` 트랜잭션 — self-update 엣지 케이스
- **위치**: `llm-config.service.ts` — `update()` 메서드
- **상세**: 이미 `isDefault=true`인 설정을 다시 `isDefault=true`로 업데이트 시, `manager.update({isDefault: true} → false)` 후 `manager.save(config with isDefault=true)` 순으로 실행됨. 최종 결과는 올바르지만 자기 자신을 false로 뒀다가 다시 true로 설정하는 불필요한 단계가 있음. 기능적으로는 무결함.

---

### [INFO] `llm-configs.ts` API 클라이언트의 방어적 `data?.data ?? data` 패턴
- **위치**: `frontend/src/lib/api/llm-configs.ts:73`
- **상세**: `TransformInterceptor`가 항상 `{ data: ... }`로 래핑하므로 `data?.data`가 항상 존재해야 함. `?? data` 폴백은 불필요하지만 무해함. `previewModels`에도 동일 패턴이 일관성 있게 적용됨.

---

## 요약

이번 변경의 핵심은 "폼 자격증명 기반 모델 목록 미리보기(`preview-models`)" 기능 추가로, SSRF 가드·Rate Limit·타임아웃·에러 sanitization이 모두 구현되어 있고 API Key 비저장 원칙도 준수됨. `isDefault` 트랜잭션 처리와 캐시 삭제 순서 교정은 기존 레이스 컨디션을 올바르게 해결했으며, Google SDK 마이그레이션과 Anthropic/OpenAI의 동적 모델 조회 전환도 스펙 요구사항과 일치함. 다만 `PreviewLlmModelsDto`(입력 유효성), `ModelCombobox`(chat 필터·분기 로직), Google `listModels()` 구현이 diff에서 확인 불가하고, `POST :id/test` 엔드포인트에 Rate Limit이 누락된 점이 보완이 필요한 사항임.

## 위험도

**LOW**