# Code Review Resolution — 3-Batch 후속 리뷰 (2026-04-24)

리뷰 보고서:
- [2026-04-24_08-11-00/SUMMARY.md](./SUMMARY.md) — 코드 diff 대상 (MEDIUM, Critical 1 / Warning 19)
- [2026-04-24_08-16-06/SUMMARY.md](../2026-04-24_08-16-06/SUMMARY.md) — 프론트 UX (MEDIUM, Warning 11)
- [2026-04-24_08-20-33/SUMMARY.md](../2026-04-24_08-20-33/SUMMARY.md) — DB 서비스 concurrency (MEDIUM, Warning 23)

## Batch 1 — 코드 diff 대상

### Critical. Google SDK 스트림 타입 캐스팅 → ⏭️ 보류

`AsyncIterable<unknown>` 캐스팅은 신 SDK 의 `generateContentStream` 이 `Promise<AsyncGenerator<GenerateContentResponse>>` 를 돌려주므로 이론상 불필요. 실제로는 `@google/genai` v1.50 에서 반환 타입 표기와 런타임 청크 형태가 완전히 일치하지 않아(특히 `candidates[].content.parts` 의 `Part` 필드 옵셔널성) 엄격한 `for await` 시 타입 에러가 잇따름. 런타임 타입 가드(`hasProperty`, `isChunkShape`) 도입은 별도 리팩터링 성격이라 이번 범위 외로 이관. `buildGenerationConfig` 반환 타입을 `GenerateContentConfig` 로 구체화(B1 W13)해 더 중요한 타입 약화 지점은 해소됨.

### W1. SSRF DNS rebinding 미차단 → ✅ 한계 문서화

`spec/5-system/7-llm-client.md` §5.5 에 DNS rebinding 을 현행 가드가 차단하지 않으며 rate limit + `editor` 권한 + egress 방화벽으로 완화한다고 명시. 실차단(`dns.promises.lookup` 기반)은 네트워크 계층 개입이 더 적합해 별도 이슈로 이관.

### W2/3/4. IPv6 사설/0.0.0.0/local 우회 → ✅ 조치

`isPrivateHost()` 강화:
- `0.0.0.0/8` 추가 (`a === 0`)
- IPv6 ULA `fc00::/7` (`fc..`, `fd..` prefix)
- IPv6 link-local `fe80::/10` (`fe8.`, `fe9.`, `fea.`, `feb.` prefix)
- IPv4-mapped IPv6: Node 가 `::ffff:10.0.0.1` → `::ffff:a00:1` 로 hex 정규화 하는 것을 반영해 hex 2세그먼트를 IPv4 로 재구성 후 재귀 검사 + 도트 형태도 병행 처리
- Zone id (`%eth0` 등) 제거

`local` 프로바이더 의도적 예외는 `spec/5-system/7-llm-client.md` §5.5 에 명시. 코드 주석에도 "self-hosted Ollama/vLLM 런타임 지원" 명시.

### W5. 스트림 usage fallback 제거 → ✅ 조치

`google.client.ts` 스트림 종료 시점에 `finalTotal === 0 && finishReason !== 'aborted'` 면 `Logger.warn` 으로 경고 기록. 과금·모니터링 팀이 관측 가능. fallback 호출 복원은 두 번째 API 왕복 비용이 있어 로그만 먼저 도입.

### W6. embed silent failure → ✅ 조치

`google.client.ts` `embed()` 에서 응답 길이 ≠ 입력 길이 또는 빈 `values` 수신 시 명시적 Error throw. Knowledge Base 파이프라인의 벡터 정합성 보장. 테스트 2건 추가.

### W7. SSRF 172.16.x.x 미검증 → ✅ 조치

`172.16.0.1`, `172.20.1.1`, `172.31.255.254` 테스트 3종 추가.

### W8. 기존 `listModels` 회귀 테스트 → ✅ 조치

`llm.service.spec.ts` 에 `listModels (saved config)` describe 블록 신규. 401 에러 sanitize + 30초 timeout 검증.

### W9. Google `MAX_MODELS` 상한 테스트 → ✅ 조치

150개 mock → 100개로 잘라내는 테스트 추가.

### W10. `listModels(signal)` SDK 전달 테스트 → ✅ 조치

OpenAI, Anthropic, Google 각각의 spec 에 signal 전달 케이스 추가. `openai: { signal }`, `anthropic: (undefined, { signal })`, `google: { config: { abortSignal } }`.

### W11. Google `listModels` prefix/필터 로직 테스트 → ✅ 확인 완료 (기존 커버)

`skips entries with no name field`, `falls back to id when displayName is missing`, `maps SDK models ... classifying by supportedActions` 이미 존재.

### W12. Gemini 비자명 주석 → ✅ 확인 완료 (유지됨)

`sanitizeGeminiSchema` (line 76: empty ObjectSchema 거부), `buildContents` (line 213-216: function role 분리), fcPart 주석 (line 255: thoughtSignature echo) 모두 유지. 삭제된 부분 없음 (리뷰 false positive).

### W13. `buildGenerationConfig` 타입 약화 → ✅ 조치

`Record<string, unknown>` → `GenerateContentConfig` (SDK 타입). 잘못된 필드명·타입 불일치 시 컴파일 에러로 감지.

### W14. Google 페이지네이터 break 시 HTTP 잔류 → ✅ 조치

`listModels` 내부에 로컬 `AbortController` 를 만들어 SDK 에 전달. 100개 도달 시 `inner.abort()` 호출로 pager 가 다음 페이지 요청을 즉시 중단. 외부 signal 이 abort 되면 `inner` 도 함께 abort (`addEventListener('abort', ...)`). `finally` 에서 listener 정리.

### W15. 프론트 `data?.data ?? data` 폴백 → ⏭️ 이관 유지

기존 RESOLUTION(2026-04-23) 에서 TODO 주석 + interim 계약으로 기록. 프론트 전역 응답 인터셉터 중앙화가 선행되어야 하므로 유지.

### W16. 타입 캐스트 정리 혼재 → ⏭️ 확인 완료

본 PR 커밋에는 LLM listModels 관련 파일만 포함. 리뷰 오케스트레이터가 이전 stash 를 함께 포함해 생긴 false positive.

### W17. API Key POST body 로깅 위험 → ⏭️ 정책 검토 후 이관

백엔드 전역 request logger 가 body 를 기록하지 않음이 확인되었으나, 추후 로깅 정책이 변경될 때 `apiKey` 필드 mask 를 위한 `@Exclude()`/interceptor 도입 필요. 별도 이슈로 이관.

### W18/19. 누락 파일 확인 → ✅ 확인 완료

`preview-llm-models.dto.ts` 와 `model-combobox.tsx` 는 이번 PR 의 신규 파일로 실제 포함되어 있다 (리뷰 diff 범위 인식 오류).

---

## Batch 2 — 프론트 UX 상세

### W1 (B2). SSRF 서비스 레이어 가드 → ✅ B1 W2-4 와 함께 조치
### W2 (B2). `as never` 타입 단언 → ✅ 조치

`llm-config.controller.spec.ts` 를 `jest.Mocked<Pick<...>>` 기반으로 재작성. 서비스 계약 변경 시 컴파일 타임 감지.

### W3 (B2). `useSavedConfig && configId` 이중 검사 → ✅ 조치

`mutationFn` 내 `useSavedConfig` 파생 변수로 단순화. TS narrowing 을 위해 `configId as string` 캐스트 1회.

### W4 (B2). `models` props 변경 시 초기화 → ✅ 조치

React 권장 render-phase reset 패턴 사용. `useEffect` 는 `react-hooks/set-state-in-effect` 린트 규칙에 걸려 `resetKey` prev/cur 비교 + if 블록으로 state 초기화. `provider`/`configId` 변경 시 `models`, `errorMessage` 초기화. 테스트 `clears model list ... when provider changes` 추가.

### W5 (B2). `clearClientCache` mock 미검증 → ✅ 조치

`llm-config.controller.spec.ts` 에 `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()` 어서트 추가. mock 은 controller 의 다른 핸들러(e.g. update) 가 호출하는 경로가 있어 제거하지 않음.

### W6 (B2). `onSuccess` `setErrorMessage(null)` 중복 → ✅ 조치

`onMutate` 가 이미 clear 하므로 `onSuccess` 에서 제거.

### W7 (B2). `data?.data ?? data` interim 표시 → ⏭️ 이미 조치

`llm-configs.test.ts` 에 `interim dual-shape contract` 및 `TODO: W-12 중앙화 후 제거` 주석 추가 완료 (2026-04-23 라운드).

### W8 (B2). mutation 이중 렌더 → ⏭️ 보류

`useMutation.data` 직접 파생은 "첫 로드 전" 과 "에러 후 유지" 분기 재설계 필요. 현재 렌더 횟수는 UX 영향 없음 (클릭당 2회 리렌더). `useModelLoader` 훅 분리와 함께 후속 이관.

### W9 (B2). 프로바이더 상수 프론트·백엔드 이중 정의 → ⏭️ 이관

`@/lib/constants/llm-providers.ts` 공유 모듈 도입은 monorepo shared package 설계 필요. 현재 프론트 하드코딩은 `azure`/`local` 2개 항목뿐이라 drift 빈도 낮음. 후속 이관.

### W10 (B2). `axios` 직접 import → ⏭️ 유지

`axios.isAxiosError` 1회 사용. API 레이어 도메인 에러 변환은 프론트 전역 에러 처리 정책 설계 필요.

### W11 (B2). Verbose ternary + `apiKey.trim()` 중복 → ✅ 조치

`!baseUrl?.trim()` 로 단순화. `trimmedKey` 를 `mutationFn` 내 한 번 계산.

---

## Batch 3 — DB 서비스 · UI concurrency

### W1-3 (B3). 보안 (API Key 노출 / baseUrl SSRF / 에러 메시지) → 부분 조치

- API Key 클라이언트 노출 (B3 W1): 재설계 범위 외 → 이관
- baseUrl SSRF (B3 W2): B1 W1-4 와 통합 조치 완료
- 에러 메시지 정보 노출 (B3 W3): 백엔드 `sanitizeErrorMessage` 가 1차 정규화. 프론트 렌더 `{errorMessage}` 는 React 기본 텍스트 이스케이프로 XSS 방지. 화이트리스트 기반 상수화는 후속 이관.

### W4 (B3). `create/update` isDefault 트랜잭션 → ✅ 조치

`llm-config.service.ts` 의 `create()` / `update()` 에서 `isDefault === true` 경로에 `manager.transaction()` 적용. `setDefault()` 와 동일 패턴. 동시 요청 시 중복 default 레코드 차단.

### W5 (B3). `useMutation` stale closure → ✅ 조치

`mutationFn` 이 `{ data, snapshot }` 반환. `onSuccess(data, _, snapshot)` 에서 `snapshot.provider !== provider || snapshot.configId !== configId` 면 응답 무시. 테스트 `ignores a stale response when provider changes mid-flight` 추가.

### W6-8 (B3). 기타 SRP/useSavedConfig/as never → ✅ 조치

B2 W2/W3/W4 와 함께 조치 완료.

### W9 (B3). 상태 초기화 분산 → ✅ 조치

`onMutate` 에 `setErrorMessage(null)` 집중. `onSuccess` 중복 제거. `onError` 는 이전 모델 목록 유지 필요 (B2 W2 결정 유지).

### W10 (B3). `afterEach(vi.restoreAllMocks)` 무효 → ✅ 확인 완료

이전 라운드에서 제거됨. 확인 완료.

### W11 (B3). 동기 throw mock → ✅ 조치

`model-combobox.test.tsx` 의 에러 케이스가 `mockRejectedValue` 로 전환됨.

### W12-14 (B3). 요청 캐싱 / 인-플라이트 취소 / setState 다중 → ⏭️ 이관

- 캐싱: API Key 기반 cache key 보안 정책 결정 선행
- 인-플라이트 취소: `useModelLoader` 훅 분리 후속
- setState 다중: `useReducer` 통합 후속

### W15 (B3). `remove()` 캐시-DB 순서 역전 → ✅ 조치

`remove(id)` 성공 후 `clearClientCache(id)` 로 순서 변경.

### W16 (B3). `listModels` Throttle 미적용 → ✅ 조치

`GET /:id/models` 에 `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 추가.

### W17 (B3). 컨트롤러 CRUD 테스트 전무 → ⏭️ 파일 헤더 주석으로 명시

`llm-config.controller.spec.ts` 최상단에 `// Covers only previewModels — full CRUD handler coverage lives in llm-config.service.spec.ts for business logic and in e2e tests for routing.` 주석.

### W18-19 (B3). `onMutate` 테스트 / stale closure 테스트 → ✅ 조치

`clears the error message when a retry starts (onMutate)` + `ignores a stale response when provider changes mid-flight` 2건 신규.

### W20-21 (B3). provider/apiKey 변경 초기화 요구사항 → ✅ 조치 + 문서화

- provider/configId 변경 시 초기화: 코드로 구현 + 테스트 1건
- apiKey 변경 시 유지: 의도적. 주석 `apiKey 변경은 사용자가 타이핑하는 중간 단계라 의도적으로 초기화하지 않는다` 명시

### W22 (B3). `@types/jest-axe` vs `jest-axe` 메이저 불일치 → ⏭️ 별건

테스팅 인프라 이슈로 LLM listModels 범위 외.

### W23 (B3). `side_effect/review.md` 범주 이탈 → ⏭️ 리뷰 도구 문제

리뷰 오케스트레이터 카테고라이제이션 이슈로 소스 코드 영향 없음.

---

## 검증

- Backend: `pnpm lint` clean, `pnpm test` **1700 passed** (+14 신규 — SSRF 강화 6건, listModels 회귀 2건, signal 전달 3건, Google MAX 1건, Anthropic cap 2건), `pnpm build` clean
- Frontend: `pnpm lint` clean, `pnpm test` **1058 passed** (+3 신규 — provider 변경 초기화, stale closure, onMutate 클리어), `pnpm build` clean
- Spec: `spec/5-system/7-llm-client.md` §5.5 SSRF 가드 범위 + `local` 예외 + DNS 한계 명시
- AI 재리뷰 (3-batch): MEDIUM → 기대 LOW (SSRF 강화·Concurrency 해소·테스트 공백 채움)

## 2차 AI 재리뷰 추가 대응 (2026-04-24 09:00 / 09:10)

위 조치 적용 후 3-batch 재리뷰에서 새로 발견된 항목 중 실질 버그 4건 추가 조치:

### R1. `isPrivateHost` URL 스킴 가드 → ✅ 조치

`file:///etc/passwd` 같은 비 http(s) 스킴은 URL 파싱 시 hostname 이 `''` 가 되어 기존 `if (!hostname) return false` 로 "사설 아님" 판정되어 통과. DTO 레이어 `@IsUrl({ protocols })` 가 1차로 막지만, 헬퍼가 다른 경로에서 재사용될 때를 위한 심층 방어로 `parsed.protocol !== 'http:' && 'https:'` 면 `true` 반환.

### R2. OpenAI `listModels` 100개 상한 → ✅ 조치

Anthropic/Google 과 동일한 `MAX_MODELS = 100` 정책 적용. UI 드롭다운 렌더링·페이지네이션 비용 일관화.

### R3. `POST /:id/test` Rate Limit 누락 → ✅ 조치

`@Throttle({ default: { limit: 10, ttl: 60_000 } })` 데코레이터 추가. `preview-models`, `:id/models` 와 동일 정책. 외부 LLM API 실호출 엔드포인트 3종 모두 동일 쓰로틀.

### R4. SSRF 경계값·Class C 테스트 → ✅ 조치

- 192.168.1.1 차단 테스트 추가 (Class C)
- 172.15.0.1 · 172.32.0.1 허용 테스트 추가 (off-by-one 경계)
- file:///etc/passwd 차단 테스트 추가 (스킴 가드)
- OpenAI `MAX_MODELS=100` 테스트 추가 (150개 → 100개)

### 3차 재리뷰 대응 요약 (2026-04-24 09:14)

3-batch 3차 재리뷰 (`review/2026-04-24_09-14-12/`) 는 MEDIUM 19건 Warning 을 보고했으나, 확인 결과 **대부분은 리뷰 오케스트레이터가 이전 diff 스냅샷을 사용해 최신 조치를 감지 못한 false positive**:

| 재리뷰 항목 | 현재 상태 |
|---|---|
| W1 `local` SSRF 우회 | spec §5.5 명시적 허용 문서화 완료 |
| W2 `0.0.0.0` 미차단 | `isPrivateHost` 에 `a === 0` 조건 이미 추가 |
| W3 IPv6 사설 미차단 | fc00/fd/fe80/IPv4-mapped 이미 구현 |
| W4 Google SDK 타입 캐스팅 | 보류 사유 RESOLUTION 에 명시 |
| W5 스트림 usage fallback | `logger.warn` 관측 로그 조치 완료 |
| W6 embed silent failure | length/빈 values assertion throw 완료 |
| W7 pnpm-lock 검증 | `pnpm remove @google/generative-ai` 완료 |
| W8 isDefault 트랜잭션 | `create/update` 양쪽 `manager.transaction()` 완료 |
| W9 remove 순서 | DB 삭제 후 cache clear 로 수정 완료 |
| W12 models props 변경 | render-phase reset 패턴 적용 완료 |
| W13 stale closure | snapshot 가드 `onSuccess` 비교 완료 |
| W16 `as never` | `as unknown as LlmService` 로 교체 완료 |
| W17 172.16.x.x 테스트 | 3개 IP 테스트 추가 완료 |
| W18 onMutate 클리어 테스트 | `clears the error message when a retry starts` 추가 완료 |
| W19 Google MAX_MODELS 테스트 | 150→100 검증 테스트 추가 완료 |

**W14 실제 확인**: Anthropic `testConnection()` 은 `this.client.messages.create({ max_tokens: 1 })` 를 호출하지 `listModels` 를 호출하지 않음. OpenAI `testConnection()` 은 원래부터 `this.client.models.list()` 를 쓰지만 이는 하드코딩 → 실시간 전환 대상이 아님 (원래부터 실시간). 따라서 "listModels 실시간 전환이 testConnection 에 영향" 우려는 false.

**W15 실제 확인**: `listModels` 내부 호출자는 (a) `LlmService.listModels(configId, workspaceId)` controller 엔드포인트 위임 (b) 본 PR 에서 신설된 `previewModels` 뿐. 프로덕션 코드에 `catch (e: Error)` 로 프로바이더 원본 에러를 기대하는 경로 없음. `BadRequestException` 래핑은 의도적 계약 개선.

### 재리뷰에서 확인만 한 항목 (조치 불필요)

- **Critical (B1)**: diff truncated — 리뷰 툴의 diff 잘림 이슈. 실제 코드에는 `fnCallToToolCall` 및 스트림 에러 경로 모두 구현·테스트됨
- **W8 (B1)**: SSRF 192.168 미커버 → 실제로는 `10.0.0.5` 테스트로 충족되었으나 명시적 Class C 케이스를 위 R4 로 추가
- **W10 (B1)**: `isDefault=true` 트랜잭션 경로 → 기존 `llm-config.service.spec.ts` 가 커버
- **W11 (B1)**: `remove` 순서 변경 → 컨트롤러 레벨 통합 테스트 추가는 e2e 스코프

### 4차 추가 조치 — W4 / W10 이관 해제 (2026-04-24)

기존에 "이관 유지" 로 분류했던 두 항목을 해결 완료:

#### W4 (3차 리뷰 지적). Google SDK 스트림 타입 가드 → ✅ 조치

- `google.client.ts` 상단에 `GeminiStreamChunk` 네임드 인터페이스와 `isGeminiChunk(raw): raw is GeminiStreamChunk` 타입 가드 함수 추가.
- SDK 의 `generateContentStream` 반환을 `as AsyncIterable<unknown>` 대신 **`AsyncGenerator<GenerateContentResponse>` SDK 타입 그대로** 사용.
- for-await 루프 내부에서 `isGeminiChunk(raw)` 로 검증 후 매칭 실패 시 `logger.warn` 로그 + `continue` (조용히 `undefined` 를 파이프라인에 흘리지 않음).
- SDK 업그레이드로 청크 구조가 바뀌면 (a) 컴파일 에러 또는 (b) 타입 가드 skip + 경고 로그로 관측 가능.
- 테스트 `skips malformed stream chunks via type guard and continues processing` 추가 (형태 불일치 청크가 타입 가드로 걸러지고 뒤이은 정상 청크는 처리됨을 검증).

#### W10 (3차 리뷰 지적). ModelCombobox SRP 리팩터 → ✅ 조치

- 새 파일 `frontend/src/components/llm-config/use-model-loader.ts` 에 `useModelLoader(args)` 커스텀 훅 추출.
- 네트워크 라우팅 결정 (preview vs saved-config), mutation 상태, 에러 sanitize, stale closure 가드, provider/configId 변경 시 reset 모두 훅 책임으로 일원화.
- `ModelCombobox` 는 훅 반환값을 받아 UI 렌더링만 담당 (`{ models, errorMessage, isPending, isSuccess, canLoad, load }`).
- `LOCAL_PROVIDER`, `PROVIDERS_REQUIRING_BASE_URL`, `providerRequiresApiKey` 는 훅 파일로 이동.
- 전용 훅 테스트 파일 `__tests__/use-model-loader.test.tsx` 신규 (7건): preview 라우팅 / listModels 라우팅 / provider 변경 reset / 비활성화 / local baseUrl / sanitize / fallback.
- 기존 `model-combobox.test.tsx` 의 18개 케이스는 훅 기반으로도 그대로 통과 (컴포넌트 API 변화 없음).

### 이관 유지

| 항목 | 사유 |
|------|------|
| DTO `NoPrivateIpConstraint` | 서비스 레이어 `isPrivateHost` + `@IsUrl` 조합으로 심층 방어 충분 |
| `isDefault` partial unique index | DB 마이그레이션 별건, 트랜잭션으로 race 해소 |
| `create/update` helper 추출 | 리팩터링 성격, 기능 영향 없음 |
| `withTimeout` 에러 분류 | AbortError 외 에러도 "timed out" 메시지로 전달되는 것은 방어적 기본값 유지 |

---

## 이관 항목 (후속 이슈 권장)

| 카테고리 | 이관 내용 |
|----------|-----------|
| 보안 아키텍처 | API Key 클라이언트 노출 → configId 기반 백엔드 프록시 재설계 |
| 네트워크 | DNS rebinding 실차단 (`dns.promises.lookup`) 또는 egress 방화벽 |
| 프론트 구조 | `useModelLoader` 훅 분리, mutation → useQuery 전환, 상태 `useReducer` 통합 |
| 프론트 API | 응답 언래핑 axios 인터셉터 중앙화 |
| 프로바이더 상수 | monorepo shared package 도입 |
| 인프라 | `@types/jest-axe` 버전 정렬, package.json jest 설정 → jest.config.ts 분리 |
| 로깅 정책 | POST body 로거 도입 시 `apiKey` 필드 mask 규칙 |
