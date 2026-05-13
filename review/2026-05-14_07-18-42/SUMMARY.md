# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Security·Architecture·Testing 3개 에이전트가 MEDIUM을 부여. 즉각적 결함보다는 확장 시나리오에서 발현되는 구조적 취약점이 주요 위험 원인.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `mallId` SSRF 방어 `@Matches(/^[a-z0-9-]{3,50}$/)` 적용 여부를 diff 외부 파일에서 **직접 검증 불가** — RESOLUTION.md C1에서 수정 완료라고 명시하나 `integration.dto.ts`가 이번 diff에 미포함. `mall_id`는 `https://{mall_id}.cafe24api.com/...`에 직접 삽입되므로 미적용 시 SSRF | `backend/.../integration.dto.ts` (diff 미포함) | 해당 DTO 파일에서 `@Matches` 데코레이터 실제 적용 여부 별도 확인 필수 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `clientSecret`이 프론트→백 API body로 평문 전송. 백엔드 저장 측 AES-256-GCM(C4) 완료됐으나 ① 로깅 미들웨어 마스킹 여부 ② HTTPS 강제 여부 ③ APM trace 노출 가능성 미확인 | `integrations.ts:175` | NestJS 로거 인터셉터에서 `clientSecret` 마스킹 적용 + HTTPS-only 강제 설정 확인 |
| 2 | Security | MCP Tool SID가 `integrationId.substring(0, 8)`로 생성 — UUID v4 앞 8자 충돌 시 다른 사용자의 Cafe24 쇼핑몰 데이터로 tool call이 잘못 라우팅되는 **데이터 격리 위반** 가능 | `cafe24-mcp-tool-provider.ts` (diff 미포함) | `buildTools()` 단계에서 SID 충돌 감지 + 경고 로그 추가. 장기적으로 SID 길이 12~16자 확장 |
| 3 | Security | `OAUTH_STUB_MODE=true` 프로덕션 환경 실수 설정 시 인증 완전 우회. 백엔드의 `NODE_ENV === 'production'` 가드 구현 여부 diff에서 미확인 | `cafe24.en.mdx`, `cafe24.mdx` 환경변수 섹션 | 프로덕션에서 `OAUTH_STUB_MODE=true` 설정 시 서버 시작 실패 또는 강제 false 처리 |
| 4 | Security / Testing | Private 앱 OAuth begin 응답 `authUrl`에 `client_secret`이 쿼리 파라미터로 포함되지 않음을 검증하는 테스트 부재 (브라우저 history·Referer·access log 노출 경로) | `integration-oauth.service.cafe24.spec.ts` | `.not.toContain('client_secret')` 단언 추가 |
| 5 | Architecture / Requirement | `mcp-server-selector.tsx`의 UI 그룹 배열이 `MCP_CAPABLE_SERVICE_TYPES` 상수와 **독립적으로 하드코딩**되어 새 Internal Bridge 타입 추가 시 API 응답에는 포함되지만 UI에서 조용히 누락 (4개 에이전트 공통 지적) | `mcp-server-selector.tsx:187-226` | `GROUP_CONFIG: Record<McpCapableServiceType, { heading: string }>` 상수를 분리하여 타입 시스템이 누락을 컴파일 타임에 강제 |
| 6 | Architecture / Dependency | `integrations.ts` `oauthBegin` 파라미터에 Cafe24 전용 필드 4개(`mallId`, `appType`, `clientId`, `clientSecret`) 직접 추가 — 백엔드 `OAuthBeginDto` 오염 패턴과 대칭. 다음 provider 추가마다 이 타입이 무한 확장 | `integrations.ts:171-178` | `providerMeta?: Record<string, unknown>` 단일 필드로 통합하는 follow-up 추가 |
| 7 | Architecture / Dependency / Testing | `mcp-capable-service-types.ts`의 프론트-백엔드 상수 이중 관리를 강제하는 메커니즘이 주석 외에 없음 — 백엔드에 새 타입 추가 시 프론트 누락을 컴파일·테스트 모두 미감지 (4개 에이전트 공통 지적) | `mcp-capable-service-types.ts:1-12` | 단기: 양 파일에 `// SYNC: <상대 경로>` 상호 참조 주석. 중기: `/api/integrations/services` 엔드포인트로 단일화 (RESOLUTION W4 follow-up) |
| 8 | Side Effect / API Contract | React Query 캐시 키 `["integrations", "mcp"]` → `["integrations", "mcp-capable"]` 변경으로 기존 `invalidateQueries` 호환성 단절 가능 — 현재 단일 consumer 확인으로 즉각 위험은 없으나 향후 소비자 추가 시 silent 무효화 실패 (4개 에이전트 공통 지적) | `mcp-server-selector.tsx:65` | `export const MCP_CAPABLE_QUERY_KEY = ["integrations", "mcp-capable"] as const` 상수로 분리하여 invalidator와 공유 |
| 9 | Documentation / Requirement | `cafe24.en.mdx`에 한국어 문서 대비 ① OAuth scope 권장 프리셋 표 (8개 카테고리 × read/write scope 값) ② FAQ 4항목 (`OAUTH_CONFIG_MISSING`, `CAFE24_MCP_NO_SESSION` 등 에러 대응) 누락 — 영어 사용자가 오류 상황에서 트러블슈팅 정보에 접근 불가 (2개 에이전트 공통 지적) | `cafe24.en.mdx` 전체 | 두 섹션을 영문 문서에 추가하여 언어 간 정보 패리티 확보 |
| 10 | Documentation | `.env.example`에 `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `OAUTH_STUB_MODE` 추가 누락 — 운영자가 `.env.example` 기반으로 설정 시 Cafe24 OAuth 흐름 동작 불가 (2개 에이전트, 이전 review에서도 지적, RESOLUTION follow-up 미처리) | 프로젝트 루트 `.env.example` | 3개 변수 주석 포함 추가 |
| 11 | Testing | `mcp-server-selector.tsx` 그룹핑 로직 단위 테스트 부재 — ① 한 그룹만 항목 있을 때 ② 양쪽 모두 빈 경우 ③ 알 수 없는 `serviceType` 수신 시 렌더 결과 미검증 | `mcp-server-selector.tsx:192-226` | React Testing Library로 세 시나리오 커버리지 추가 |
| 12 | Testing | `override-registry.ts` `cafe24` 키 등록 검증 테스트 부재 — 잘못된 키 이름(`cafe_24`, `CAFE24`)으로 등록되어도 컴파일·빌드 통과 | `override-registry.ts:77` | `expect(OVERRIDE_REGISTRY['cafe24']).toBe(Cafe24Config)` 단언 추가 |
| 13 | Scope | `mcp-server-selector.tsx`가 단순 필터 확장 요건 대비 flat 리스트를 이모지 헤더 그룹 레이아웃으로 **전면 재구성** — 이모지 하드코딩, spacing 변경, 그룹 래퍼 추가 포함 | `mcp-server-selector.tsx:187-226` | 그룹 UI가 의도된 요건이라면 i18n 키 사용 및 영향 범위 명시 필요 |
| 14 | Documentation | `integrations.ts` 주석이 "백엔드 state row TTL 저장 방식" 등 구현 세부사항을 API 클라이언트 레이어에 기술 — 백엔드 내부 변경 시 오해 유발 (CLAUDE.md 주석 규약 위반) | `integrations.ts:171-176` | 호출자 관점 1줄 주석으로 대체: `// Cafe24 전용. mallId는 OAuth URL이 mall-specific이라 필수; Private 앱은 clientId/clientSecret 별도 전달.` |
| 15 | Scope | `review/2026-05-14_01-33-42/` 디렉토리 13개 파일 전체가 rate-limit 오류 문자열만 포함 — 정보 가치 없는 아티팩트가 `review/` 경로 오염 | `review/2026-05-14_01-33-42/` | 해당 디렉토리 삭제 (또는 실패 기록 목적으로 `meta.json`만 보존) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `mcp-server-selector.tsx` 그룹 렌더 시 매 렌더마다 인라인 배열 생성 + 이중 `filter()` 실행 — `MCP_LIST_LIMIT`으로 데이터 크기 제한되어 체감 영향 낮음 | `mcp-server-selector.tsx:187-226` | `useMemo(() => [...], [available])`로 감싸 불필요한 재계산 방지 |
| 2 | Testing | `McpCapableServiceType` exhaustiveness 미강제 — `groups` 배열 `key` 필드를 `McpCapableServiceType`으로 강타입 선언하면 컴파일 타임에 누락 감지 가능 | `mcp-server-selector.tsx` 그룹 정의 | `Array<{ key: McpCapableServiceType; heading: string }>` 타입 선언 |
| 3 | Testing | `integrations.ts` `clientSecret` 전달 E2E 테스트 부재 — Private 앱 OAuth begin 요청에서 `clientSecret`이 응답 URL·로그에 미포함됨을 검증하는 경로 없음 | `integration-oauth.service.cafe24.spec.ts` | 기존 spec 파일에 `.not.toContain('client_secret')` 단언 추가 |
| 4 | Maintainability | `mcp-capable-service-types.ts` 실행 코드 2줄 대비 JSDoc 7줄 — follow-up 노트가 코드에 박혀 신뢰도 저하 | `mcp-capable-service-types.ts:1-8` | JSDoc 1-2줄 요약으로 축약. follow-up은 `// TODO:` 주석 또는 plan 항목으로 이관 |
| 5 | Maintainability | `mcp-server-selector.tsx` useQuery 위 6줄 인라인 주석 과다 | `mcp-server-selector.tsx:62-68` | "Both `mcp`/`cafe24` expose tools via same `mcp_<sid>__` scheme — see spec §2.3 + §14.2" 1줄로 축약 |
| 6 | Documentation | `mcp-server-selector.tsx` 그룹 헤딩 이모지(`🌐`, `🛒`) + 영문 하드코딩 — 스크린 리더 오동작 가능성 및 향후 i18n 추가 시 다중 수정 지점 | `mcp-server-selector.tsx:195,200` | `const GROUP_LABELS = { mcp: '...', cafe24: '...' }` 상수로 추출하여 향후 `t()` 래핑 단일화 |
| 7 | Documentation | `cafe24.en.mdx` frontmatter에 `summary_en` 필드 없음 (`cafe24.mdx`는 4개 필드 보유) | `cafe24.en.mdx` frontmatter | `summary_en` 추가하거나 한국어 문서에서 `summary_en` 제거하여 스키마 통일 |
| 8 | Documentation | Cafe24 통합은 신규 서비스 타입·MCP 연동·OAuth 플로우 확장을 포함하는 주요 기능이나 CHANGELOG 미갱신 | 프로젝트 루트 CHANGELOG | 팀 컨벤션에 따라 릴리스 노트 항목 추가 검토 |
| 9 | Scope | `plan/in-progress/spec-update-send-email-port.md`가 `send_email` 포트명 불일치를 추적하는 plan으로 cafe24 작업과 무관 (파일 자체에 "영향 없음" 명시) | `plan/in-progress/spec-update-send-email-port.md` | 다음 작업 착수 시 별도 worktree로 이관 권장 |
| 10 | Database | 멀티 인스턴스 환경에서 `ensureFreshToken()` `findOne → save` 패턴에 `pessimistic_write` lock 부재 → 동시 refresh token 소진 위험 (현재 단일 인스턴스 전제, RESOLUTION W1 follow-up) | `cafe24-api.client.ts` (diff 미포함) | 멀티 인스턴스 전환 시점에 `lock: { mode: 'pessimistic_write' }` 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | `clientSecret` 전송 경로 미확인, SID 충돌 데이터 격리 위반, `mallId` SSRF 검증 diff 외부 |
| Architecture | **MEDIUM** | 그룹 UI와 상수 비동기화, `OAuthBeginDto` 필드 오염 패턴 |
| Testing | **MEDIUM** | 그룹핑 로직·동기화·레지스트리 등록 테스트 공백 |
| Requirement | LOW | 영문 문서 scope 프리셋·FAQ 누락, 그룹 UI 확장성 미충족 |
| Maintainability | LOW | 그룹 설정 인라인, `serviceType` 문자열 3곳 분산 |
| Scope | LOW | UI 재설계 범위 초과, 캐시 키 변경 독립성 |
| Documentation | LOW | 영문 문서 섹션 누락, `.env.example` 미갱신 |
| Side Effect | LOW | 캐시 키 변경 invalidate 단절 가능, 상수 드리프트 silent omission |
| API Contract | LOW | `appType` 수동 타입 동기화 드리프트 가능성 |
| Performance | LOW | 이중 `filter()` 인라인 (MCP_LIST_LIMIT으로 실영향 낮음) |
| Dependency | LOW | 상수 이중 관리, 캐시 키 변경 단일 consumer 확인됨 |
| Concurrency | LOW | thundering herd jitter·cleanup guard 이전 리뷰에서 조치 완료 |
| Database | LOW | 직접 DB 코드 변경 없음, 멀티 인스턴스 lock follow-up 잔존 |

## 발견 없는 에이전트
없음 — 13개 에이전트 모두 최소 1건 이상 발견사항 보고.

---

## 권장 조치사항

1. **[즉시] `backend/.../integration.dto.ts` 직접 확인** — `@Matches(/^[a-z0-9-]{3,50}$/)` 적용 여부 검증. 미적용 시 SSRF 위험으로 즉시 수정 필요.
2. **[즉시] `clientSecret` 전송 경로 보안 점검** — NestJS 로거에서 `clientSecret` 필드 마스킹 여부 + HTTPS-only 강제 설정 확인. `authUrl`에 `client_secret` 미포함 단언 테스트 추가 (W8/W9).
3. **[즉시] `review/2026-05-14_01-33-42/` 아티팩트 정리** — rate-limit으로 빈 파일만 포함된 디렉토리 삭제.
4. **[단기] `mcp-server-selector.tsx` 그룹 정의 리팩토링** — `GROUP_CONFIG: Record<McpCapableServiceType, { heading: string }>` 상수 분리 + `useMemo` 적용 + 쿼리 키 상수 export. 그룹 테스트 추가.
5. **[단기] MCP Tool SID 충돌 방어** — `buildTools()` 단계에 SID 중복 감지 로그 추가. SID 길이 확장 검토.
6. **[단기] `.env.example` 갱신** — `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `OAUTH_STUB_MODE` 3개 변수 주석 포함 추가.
7. **[단기] `cafe24.en.mdx` 보완** — OAuth scope 프리셋 표 + FAQ 4항목 추가하여 한국어 문서와 정보 패리티 확보.
8. **[단기] `OAUTH_STUB_MODE` 프로덕션 가드** — 백엔드에서 `NODE_ENV === 'production'` 시 강제 무시 처리 여부 확인 및 미구현 시 추가.
9. **[중기] `OAuthBeginDto` `providerMeta` 통합** — 프론트-백 양쪽에서 서비스별 필드를 `providerMeta?: Record<string, unknown>`으로 통합하는 follow-up 추가 (RESOLUTION W6 연계).
10. **[중기] `/api/integrations/services` 엔드포인트** — `MCP_CAPABLE_SERVICE_TYPES` 프론트-백 이중 관리 제거 (RESOLUTION W4 follow-up 실행).