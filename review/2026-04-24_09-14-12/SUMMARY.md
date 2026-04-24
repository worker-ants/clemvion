파일 쓰기 권한이 필요합니다. 아래가 통합 보고서 전문입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 동작은 전반적으로 정상이나, SSRF 방어 공백(클라우드 배포 시 HIGH 근접), Google SDK 마이그레이션의 과금 데이터 영향, `isDefault` 경쟁 조건, stale closure 버그가 미해결 상태로 잔존

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

### 🔐 보안 / SSRF

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Security · Architecture · Requirement | **`local` 프로바이더가 SSRF 가드 전면 우회** — `editor` 권한 사용자가 `provider: 'local'` + `baseUrl: 'http://169.254.169.254/'`로 클라우드 인스턴스 메타데이터(IAM 자격증명) 조회 가능. AWS/GCP 배포 환경에서 HIGH 근접. 3개 라운드 반복 지적 미해결. | `llm.service.ts` — `previewModels()` `if (params.provider !== 'local')` 분기 | `local` 프로바이더에도 `localhost`/`127.x.x.x`/`::1` 허용 allowlist 적용, 링크로컬(`169.254.x.x`) 명시 차단. 현행 유지 시 `spec/5-system/7-llm-client.md`에 "의도적 허용 범위" 필수 명시 |
| W2 | Security · Requirement | **`0.0.0.0` 미차단** — Linux에서 모든 인터페이스 바인딩 소켓으로 해석, loopback 접근 가능. `a === 0` 조건 미도달로 통과. 3개 라운드 반복, 미해결. | `llm.service.ts` — `isPrivateHost()` | `if (a === 0) return true;` 조건 추가 |
| W3 | Security · Requirement | **IPv6 사설 대역 전면 미차단** — `fc00::/7`(ULA), `fe80::/10`(link-local), `::ffff:10.0.0.1`(IPv4-mapped) 모두 통과. 3개 라운드 연속 지적, 미해결. | `llm.service.ts` — `isPrivateHost()` | IPv6 사설 prefix 검사 추가. DTO에 `baseUrl: 'http://[fc00::1]/'` 거부 케이스 테스트 추가 |
| W4 | Security · Dependency | **Google SDK 스트림 타입 강제 캐스팅 — 에러 처리 무음 우회 가능** — `generateContentStream()` 반환값을 `as AsyncIterable<unknown>`으로 캐스팅 후 청크를 익명 타입으로 재캐스팅. 실제 청크가 예상과 다르면 `undefined`/`null`이 파이프라인을 통과, sanitize/에러 처리 로직 우회 가능. 라운드 1 CRITICAL 분류, 3라운드까지 미조치. | `google.client.ts` — `stream()` | `@google/genai` 올바른 제네릭 타입 사용 또는 `interface GeminiStreamChunk` 네임드 인터페이스 + 타입 가드 추가 |

### 🔄 Google SDK 마이그레이션

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W5 | Side Effect · Requirement | **Google 스트림 토큰 usage fallback 제거 — 과금·모니터링 오염** — 구 SDK의 `await result.response` 보조 집계가 삭제됨. 일부 Gemini 모델은 청크별 usage를 스트리밍하지 않아 토큰 사용량이 0으로 기록될 수 있음. 4개 라운드 전체 미해결. | `google.client.ts` — `stream()` | 신 SDK `generateContentStream` 응답에 usage가 항상 포함됨을 공식 문서/통합 테스트로 검증. RESOLUTION.md에 해결 여부 명시 |
| W6 | Side Effect · Requirement | **Google `embed()` 배치 전환 silent failure** — `response.embeddings[i].values` 없을 때 빈 벡터 `[]` 반환 후 조용히 종료. knowledge-base에 임베딩 없이 저장되는 silent failure. 입력-출력 수 일치 검증 없음. 4개 라운드 전체 미해결. | `google.client.ts` — `embed()` L490-494 | `if (result.embeddings.length !== texts.length) throw new Error(...)` assertion 추가 |
| W7 | Dependency | **`@google/genai` SDK 교체 — pnpm-lock 검증 불가** — 구 패키지(`@google/generative-ai`) 완전 제거 여부, 신 패키지 고정 버전, 두 SDK 동시 설치 여부 미확인. Breaking Change 포함 메이저 SDK 전환에서 lock 파일 미검증. | `backend/package.json` | `pnpm list @google/generative-ai @google/genai` 실행, 동시 설치 여부 확인 |

### 🏗️ 아키텍처 / 데이터 일관성

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W8 | Architecture · Concurrency | **`isDefault` 플래그에 트랜잭션 없음 — 경쟁 조건** — `create()`/`update()`에서 `clearDefault()` + 트랜잭션 없는 `save()` 순차 호출. 동시 요청 시 `isDefault=true` 레코드 2개 공존 가능. `setDefault()`는 트랜잭션 있음 — 동일 도메인 불변식에 서로 다른 전략 혼재. | `llm-config.service.ts` — `create()` L93-108, `update()` L135-142 | `clearDefault()` + `save()` 블록을 `manager.transaction()`으로 감싸거나, `setDefault()`를 공통 메서드로 추출 |
| W9 | Architecture | **`remove()`에서 캐시를 DB 삭제 전에 제거 — 실패 시 불일치** — DB 삭제 실패 시 "캐시 없음 + DB 있음" 불일치. `update()`는 반환 후 캐시 삭제로 순서 반대 — 동일 리소스에 다른 전략. | `llm-config.controller.ts` — L224-229 | `await remove()` 완료 후 `clearClientCache()` 호출 |
| W10 | Architecture · Maintainability | **`ModelCombobox` SRP 위반 — API 라우팅 전략이 UI 컴포넌트 내부에 위치** — `useSavedConfig` 분기가 `mutationFn` 인라인에 존재. 렌더링과 API 선택 책임 혼재. 여러 라운드 반복 지적, 미조치. | `model-combobox.tsx` — `mutationFn` L60-68 | `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅으로 추출. stale closure, 이중 setState, 테스트 결합 문제 동시 해소 |
| W11 | Architecture · Dependency · Maintainability | **프로바이더 도메인 규칙 이중 하드코딩 — 컴파일 타임 동기화 보장 없음** — 백엔드 `LLM_PROVIDERS` 단일 소스 vs 프론트엔드 `LOCAL_PROVIDER = "local"`, `PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", "local"])` 독립 정의. 2·3라운드 공통 지적, 미조치. | `model-combobox.tsx` L34-39 vs `create-llm-config.dto.ts` | 단기: `@/lib/constants/llm-providers.ts` 공유 상수 파일 도입. 중기: monorepo `/packages/shared` 패키지 |

### 🧪 부작용 / 상태 관리

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W12 | Side Effect · Requirement | **`models` state가 props 변경에 무반응 — stale datalist** — `provider`/`apiKey`/`baseUrl`/`configId` 변경 시 `models` 초기화 `useEffect` 없음. 프로바이더 변경 후 이전 모델 목록이 datalist에 잔존. 라운드 4에서 "미수정" 재확인. | `model-combobox.tsx` — L27 | `useEffect(() => { setModels([]); }, [provider, configId]);` 추가 |
| W13 | Concurrency · Testing | **stale closure 버그 미수정 + 미검증** — `onSuccess`가 현재 props 검증 없이 `setModels(fetched)` 호출. 프로바이더 변경 후 이전 요청 결과가 적용되는 race. 컴포넌트 수정과 테스트 추가 모두 미완. | `model-combobox.tsx` — `onSuccess`, `model-combobox.test.tsx` | `mutationFn`에서 `{ fetched, snapshot: { provider } }` 반환 후 `onSuccess`에서 `snapshot.provider !== provider`이면 무시 |
| W14 | Side Effect | **`listModels` 실시간 전환 — 항상 성공하던 코드 경로가 실패 가능** — `Promise.resolve(ANTHROPIC_MODELS)` → `client.models.list()` 실제 HTTP 요청 전환. `testConnection` 내부 호출 등 항상 완료된다고 가정한 경로가 이제 네트워크 오류·401·429 수신 가능. | `anthropic.client.ts` L132-143, `llm.service.ts` | `testConnection()` 구현이 `listModels` 호출 여부 명시적 확인 후 RESOLUTION.md에 기록 |
| W15 | Side Effect | **`listModels` 에러 타입 변경 — 상위 호출자 silent 동작 변화** — 기존 프로바이더 원본 에러 전파에서 `BadRequestException({ code: 'LLM_MODEL_LIST_FAILED' })` 래핑으로 변경. 에러 타입 기준으로 분기하던 호출자가 있다면 silent 동작 변경. | `llm.service.ts` L197-209 | `listModels` 모든 호출자에서 에러 타입 의존성 코드베이스 검색 |

### 🧪 테스트 누락

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W16 | Testing | **`as never` 타입 단언 — 4라운드 연속 미수정** — TypeScript 타입 검사 완전 우회. `LlmConfigService`/`LlmService` 시그니처 변경 시 테스트가 무음으로 stale. | `llm-config.controller.spec.ts` L24-26 | `as unknown as LlmConfigService`, `as unknown as LlmService` 패턴으로 교체 |
| W17 | Testing | **`172.16.x.x` SSRF 범위 미검증** — RFC1918 Class B 대역 테스트 누락. 라운드 2 지적, 이후 추적 끊김. | `llm.service.spec.ts` — SSRF 테스트 블록 | `it('rejects 172.16.x.x (RFC1918 class B)', ...)` 케이스 추가 |
| W18 | Testing | **`onMutate` 에러 클리어 동작 미검증** — `onMutate: () => setErrorMessage(null)` 구현 존재하나 검증 테스트 케이스 없음. | `model-combobox.test.tsx` | 에러 후 재시도 시 에러 메시지 즉시 클리어 검증 케이스 추가 |
| W19 | Testing | **Google MAX_MODELS=100 상한 및 `models/` prefix 제거 로직 미검증** — 라운드 2 지적, 이후 추적 없음. | `google.client.spec.ts` — `listModels` describe 블록 | 상한 케이스 및 prefix 제거 케이스 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| I1 | Security | Factory 에러 메시지 sanitize 우회 경로 미테스트 | `llm-config.service.ts` — 팩토리 에러 경로 |
| I2 | Security | Rate limit 키가 IP 기반 — NAT 환경 공유·다계정 공격 취약 | `llm-config.controller.ts` — `@Throttle` |
| I3 | Security | CI 시크릿 스캔 부재 (`sk-xxx` 패턴) | CI 파이프라인 |
| I4 | Architecture | `LlmService` 추상화 레벨 이원화 (저장 설정 기반 vs raw 자격증명 기반) | `llm.service.ts` — `previewModels()` |
| I5 | Architecture | `GET :id/models`에 `@Throttle` 미적용 — `POST preview-models`와 정책 불일치 | `llm-config.controller.ts` L192-208 |
| I6 | Architecture | `data?.data ?? data` fallback이 API 레이어 불일치 영속화 | `frontend/src/lib/api/llm-configs.ts` |
| I7 | Architecture | `isPrivateHost` 함수가 import 블록 사이에 위치 — ESLint `import/first` 위반 | `llm.service.ts` 파일 상단 |
| I8 | Architecture | `buildGenerationConfig` 반환 타입 `Record<string, unknown>` — 실질적 `any` | `google.client.ts` — `buildGenerationConfig()` |
| I9 | Testing | AbortSignal SDK 전달 미검증 (클라이언트 단위 테스트 없음) | `anthropic.client.spec.ts`, `openai.client.spec.ts` |
| I10 | Testing | `clearClientCache` mock 선언만 있고 검증 없음 — 3라운드 미수정 | `llm-config.controller.spec.ts` L10 |
| I11 | Dependency | Anthropic `listModels` 모델 수 상한 없음 (Google은 MAX_MODELS=100) | `anthropic.client.ts` — `listModels()` |
| I12 | Dependency | `transformIgnorePatterns` 정규식 변경 의도 미문서화 | `backend/package.json` |
| I13 | Requirement | `chat-only` 모델 필터링 기준 미명시 | `spec/5-system/7-llm-client.md` |
| I14 | Requirement | 모델 목록 로드 후 기존 선택값 유효성 재검증 정책 미정의 | `model-combobox.tsx`, 스펙 문서 |
| I15 | Maintainability | `30_000` 타임아웃 매직 넘버 2곳 중복 | `llm.service.ts` — `listModels`, `previewModels` |
| I16 | Documentation | 라운드 간 발견사항 상태 갱신 없음, 심각도 기준 불일치, `CRITERIA.md` 부재 | `review/` 전체 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM (HIGH 근접) | SSRF `local` 프로바이더 bypass + `0.0.0.0`/IPv6 미차단 → 클라우드 환경에서 IAM 자격증명 탈취 경로 |
| Testing | MEDIUM | `as never` 4라운드 미수정, stale closure 버그 테스트 없이 production 존재, SSRF 172.16.x.x 미검증 |
| Side Effect | MEDIUM | Google 스트림 토큰 usage fallback 제거(과금 오염), `embed()` silent failure, `models` stale state |
| Dependency | MEDIUM | Google SDK 타입 캐스팅 공백, pnpm-lock 미검증, `@types/jest-axe` 버전 불일치 |
| Architecture | MEDIUM | `isDefault` 트랜잭션 누락, `ModelCombobox` SRP 위반, `local` SSRF 설계 미문서화 |
| Requirement | MEDIUM | SSRF 방어 범위 스펙 미명시, 과금 데이터 영향 미검증, provider 변경 시 초기화 정책 미정의 |
| Maintainability | LOW | 동일 이슈 3라운드 미조치 반복, Gemini 제약 주석 삭제, 매직 넘버 중복 |
| Documentation | LOW | 라운드 간 이슈 상태 갱신 없음, 심각도 기준 불일치 |
| Scope | LOW | 2026-04-24_08-20-33 배치 내 일부 리뷰어가 입력 마크다운 대신 원본 소스 코드 분석 |
| Performance | NONE | 문서 리뷰 (런타임 코드 없음) |
| Concurrency | NONE | 문서 리뷰 (런타임 코드 없음) |
| Database | NONE | DB 관련 코드 변경 없음 |
| API Contract | NONE | API 계약 소스 코드 변경 없음 |

---

## 발견 없는 에이전트

Database, API Contract, Concurrency, Performance — 변경 파일 전체가 `.md`/`.json` 리뷰 산출물로 실행 가능한 코드가 없음. Concurrency·Performance 리뷰에서 식별한 실제 코드 이슈는 이전 라운드에서 이미 포착됨.

---

## 권장 조치사항

### 즉시 (보안·데이터 정합성)
1. **W1~W3 SSRF 방어 보완** — `local` 프로바이더 allowlist 도입(또는 스펙 문서화), `isPrivateHost`에 `0.0.0.0`·IPv6 사설 대역 차단 추가
2. **W5 Google 스트림 토큰 usage 검증** — 신 SDK에서 usage가 항상 포함되는지 통합 테스트/공식 문서로 검증
3. **W6 `embed()` assertion 추가** — 입력-출력 수 불일치 시 throw
4. **W8 `isDefault` 트랜잭션 추가** — `create()`/`update()`의 `clearDefault()` + `save()` 블록 트랜잭션화
5. **W13 stale closure 버그 수정** — `mutationFn`에서 snapshot 반환, `onSuccess`에서 provider 불일치 시 무시

### 단기 (코드 품질·안전망)
6. **W12** `models` state 초기화 `useEffect` 추가 (`[provider, configId]` 의존성)
7. **W16** `as never` → `as unknown as LlmConfigService` 교체
8. **W7** pnpm-lock 검증 (구 SDK 완전 제거, 신 SDK 버전 고정 확인)
9. **W9** `remove()` 순서 수정 (DB 삭제 성공 후 캐시 제거)
10. **W18** `onMutate` 에러 클리어 동작 테스트 추가
11. **W17** `172.16.x.x` SSRF 테스트 추가
12. **W20** `@types/jest-axe` 버전 정렬
13. **W22** Gemini API 제약 주석 복원 (`// WHY:` 접두사)
14. **I15** `30_000` 상수 추출

### 중기 (구조 개선)
15. **W10** `ModelCombobox` → `useModelLoader` 훅 분리 (SRP 해소, 파생 이슈 동시 해결)
16. **W11** `@/lib/constants/llm-providers.ts` 공유 상수 파일 도입
17. **W23** RESOLUTION 추적 체계 수립 (라운드 종료 시 RESOLUTION.md 업데이트 프로세스)
18. **I7** `isPrivateHost` → `src/common/utils/ssrf.util.ts` 분리
19. **스펙 문서화** — `spec/5-system/7-llm-client.md`에 SSRF 허용 범위, `ModelInfo.type` 기준, provider 변경 시 초기화 정책, `listModels` API 계약 변경 명시