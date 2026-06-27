# 요구사항(Requirement) Review

## 리뷰 대상

| 파일 | 변경 유형 |
|------|-----------|
| `spec/2-navigation/6-config.md` | code 프론트매터에 `llm-model-config.controller.ts` 추가 |
| `spec/5-system/7-llm-client.md` | testConnection 섹션 및 Rationale forwardRef 완료 기술 갱신 |
| `spec/data-flow/7-llm-usage.md` | 부속 엔드포인트 소유 컨트롤러·캐시 무효화 흐름 설명 갱신 |

---

## 발견사항

### **[INFO]** `spec/5-system/7-llm-client.md` code 프론트매터에 `llm-model-config.controller.ts` 미등재
- **위치**: `spec/5-system/7-llm-client.md` frontmatter `code:` 목록
- **상세**: 이번 변경은 `spec/2-navigation/6-config.md`의 code 목록에 `llm-model-config.controller.ts`를 추가했다. 동 파일은 llm 모듈 소속이며 `spec/5-system/7-llm-client.md` 본문에서 상세히 서술되지만, 해당 spec의 code 프론트매터에는 등재되지 않았다.  
  이 파일의 1차 귀속이 "API 라우팅 계층(Config > Models 화면)" 이므로 `spec/2-navigation/6-config.md`에 등재하는 것이 타당하며, `spec/5-system/7-llm-client.md`는 서비스·클라이언트 계층을 기술한다는 점에서 현재 배치는 논리적으로 수용 가능하다.
- **제안**: 양쪽 spec에 동시 등재하거나 현행 유지 중 선택. 필요 시 `spec/5-system/7-llm-client.md` code 목록에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 항목 추가 검토.

### **[INFO]** `POST /api/model-configs/:id/test` 역할(Role) 가드 미적용
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L77–95
- **상세**: `preview-models`(`POST`)는 `@Roles('editor')`가 명시돼 있고, spec §5.5도 "권한: editor 이상"으로 명기한다. 반면 `:id/test`(`POST`)와 `:id/models`(`GET`)는 `@Roles` 없이 `@Throttle`만 적용된다. `spec/2-navigation/6-config.md §3`의 일반 원칙("mutation POST/PATCH/DELETE는 Editor+")에 의하면 POST인 `:id/test`도 Editor+ 이상 요구 대상으로 읽힐 수 있으나, 테스트·목록 조회는 데이터 변경이 없는 읽기형 연산이므로 의도적 미적용일 가능성이 높다.  
  spec이 이 두 엔드포인트의 역할을 명시하지 않아 "침묵 영역"이다.
- **제안**: spec에 "연결 테스트·모델 목록 조회는 Viewer 이상 접근 허용" 또는 "Editor 이상 필요"를 명시해 의도를 확정. 현행 코드(역할 미제한 = 인증된 사용자면 허용)가 실제 의도와 일치한다면 spec 본문에 "인증 필요(역할 무제한)" 명시.

---

## 핵심 검증 결과

### 기능 완전성

1. **`llm-model-config.controller.ts` 존재 확인** ✅  
   - `@Controller('model-configs')` 프리픽스로 공개 API 라우트 무변 유지.  
   - `preview-models`, `:id/test`, `:id/models` 3개 엔드포인트를 llm 모듈에서 소유.

2. **forwardRef 제거 완료** ✅  
   - `llm.module.ts`: `imports: [ModelConfigModule, ...]` — `forwardRef` 없이 단방향 import.  
   - `model-config.module.ts`: `imports: [TypeOrmModule.forFeature([ModelConfig])]` — llm 모듈 의존 완전 제거.

3. **옵저버 기반 캐시 무효화** ✅  
   - `ModelConfigService.invalidationListeners: Set<(configId: string) => void>` 등록/통지 인프라 구현.  
   - `ModelConfigService.update`/`remove` → `this.notifyInvalidated(id)` 호출 확인.  
   - `LlmService.onModuleInit` → `this.modelConfigService.onConfigInvalidated(this.onConfigInvalidatedListener)` 구독 확인.  
   - `onConfigInvalidatedListener`는 class field로 1회 바인딩되어 Set dedup 동작.

4. **CRUD는 `model-config.controller.ts` 잔류** ✅  
   - `ModelConfigController`가 GET/POST/PATCH/DELETE/set-default를 소유하며 llm 모듈 직접 의존 없음.

### 엣지 케이스

- **리스너 격리** ✅: `notifyInvalidated`가 각 리스너 호출을 try/catch로 감싸 한 리스너 실패가 DB 커밋 결과와 나머지 리스너 통지를 깨지 않음.
- **안정 참조 dedup** ✅: `onConfigInvalidatedListener` 필드 바인딩으로 `onModuleInit` 중복 호출 시에도 Set에 한 번만 등록됨.
- **`testConnection` rerank 경우** ✅: rerank provider는 `LLMClientFactory` 미등록으로 `createClient`에서 throw되며 catch → `{ success: false }` graceful 실패 반환.
- **embedding probe 빈 벡터** ✅: `vectors[0]?.length`가 0 또는 undefined이면 `dimension` 없이 `{ success: true }` 반환. spec "0이면 omit" 일치.
- **`setDefault` 캐시 무효화 생략** ✅: `setDefault`는 `isDefault` 플래그만 변경하며 API key·baseUrl·provider가 불변이므로 LLM client cache 무효화 불필요. 생략이 올바름.

### TODO/FIXME

- 이전 spec에 있던 "순환 정리는 백로그 `unified-model-management §7 W4`" 참조가 "forwardRef 제거 완료 — refactor-02 C-2 cluster 4"로 정확히 갱신됨. 미완성 백로그 참조 제거 완료 ✅

### 의도와 구현 일치

| spec 서술 | 코드 |
|-----------|------|
| 라우트 프리픽스 `model-configs` 유지 | `@Controller('model-configs')` ✅ |
| `LlmPreviewService.previewModels` 위임 | `this.llmPreviewService.previewModels(dto)` ✅ |
| `LlmService.testConnection` 위임 | `this.llmService.testConnection(id, workspaceId)` ✅ |
| `LlmService.listModels` 위임 | `this.llmService.listModels(id, workspaceId, { type })` ✅ |
| `ModelConfigService.notifyInvalidated` 옵저버 통지 | `this.notifyInvalidated(id)` in `update`/`remove` ✅ |
| `LlmService.onModuleInit` 구독 | `onModuleInit(): void { this.modelConfigService.onConfigInvalidated(...) }` ✅ |

### 에러 시나리오

- 캐시 무효화 리스너 실패 → try/catch 격리, warn 로그만. mutation 응답에 영향 없음 ✅
- `testConnection` 실패 → `{ success: false, error: sanitized }` 반환 ✅
- `listModels` 실패 → `LLM_MODEL_LIST_FAILED` 400 throw ✅

### 데이터 유효성

- `preview-models`: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` — spec "10/60s" 일치 ✅
- `:id/test`: 동일 throttle 적용 ✅
- `:id/models`: 동일 throttle 적용 ✅
- `ParseUUIDPipe`로 `:id` 파라미터 UUID 형식 검증 ✅

### 비즈니스 로직

- `preview-models` `@Roles('editor')` — spec §5.5 "editor 이상" 일치 ✅
- spec §3 "mutation POST/PATCH/DELETE = Editor+, 조회 = Viewer 이상" 대비 `:id/test`(POST)·`:id/models`(GET) 역할 미지정 — 위 INFO 발견사항 참조
- 단방향 `LlmModule → ModelConfigModule` 의존 확립 — 설계 의도 일치 ✅

### 반환값

- `testConnection`: `Promise<{ success: boolean; error?: string; dimension?: number }>` — 모든 경로 반환 ✅  
  spec: "chat `{ success }`, embedding `{ success, dimension? }`" 충족. 실패 시 `error` 필드 추가는 스펙 침묵 영역의 합리적 확장.
- `listModels`: 필터 적용 후 `ModelInfo[]` 반환. `opts.type` 미지정 시 전체 반환 ✅

### Spec Fidelity

3개 spec 파일 변경 모두 코드 현실을 정확히 반영하는 문서 갱신이다:
- **`spec/2-navigation/6-config.md`**: `llm-model-config.controller.ts` code 목록 추가 — 파일 존재 및 `@Controller('model-configs')` 확인 ✅
- **`spec/5-system/7-llm-client.md`**: forwardRef 상호 → 단방향 갱신 — 코드의 모듈 구성과 정확히 일치 ✅
- **`spec/data-flow/7-llm-usage.md`**: 부속 엔드포인트 소유·캐시 무효화 흐름 갱신 — 코드 flow와 정확히 일치 ✅

spec이 코드를 앞서지 않으며, 코드가 먼저 구현되고 spec이 이를 따라잡는 정상적 갱신이다. SPEC-DRIFT(spec이 낡은 상태) 에 해당하나, 이번 변경이 바로 그 drift를 해소하는 작업이므로 적용 후 일치한다.

---

## 요약

3개 spec 파일은 refactor-02 C-2 cluster 4에서 구현된 `LlmModule ↔ ModelConfigModule` forwardRef 순환 제거를 문서화하는 갱신이다. 핵심 설계 변경 — ① 부속 엔드포인트(`preview-models`/`test`/`models`)를 `LlmModelConfigController`로 재배치, ② 캐시 무효화를 `ModelConfigService.notifyInvalidated` 옵저버로 역전 — 이 코드에 완전히 구현됐으며, 세 spec 파일의 기술이 코드와 line-level로 일치한다. 발견된 CRITICAL 또는 WARNING 수준의 불일치는 없다. INFO 수준으로 `:id/test`·`:id/models` 역할 가드 미지정(spec 침묵 영역)과 `spec/5-system/7-llm-client.md` code 프론트매터에 controller 미등재가 있으나 모두 동작 버그가 아닌 명세 명시 부재 또는 의도적 선택으로 판단된다.

---

## 위험도

**NONE**
