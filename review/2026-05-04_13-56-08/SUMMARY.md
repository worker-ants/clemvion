# Code Review 통합 보고서 (Stage 2-4 / commit `da9dc3e`)

> 본 SUMMARY.md 는 13개 에이전트 리뷰 산출물의 통합 요약이다. 원본은
> `review/2026-05-04_13-56-08/<agent>/review.md` 에 보존된다. 조치 내역은
> 같은 폴더의 [`RESOLUTION.md`](./RESOLUTION.md) 참조.

## 전체 위험도
**HIGH** — SSRF / authType 폴스루(Critical 2건) 즉시 조치 필요. race condition·세션 누출·SID 충돌 등 동시성 결함 다수.

## Critical (2건)
1. **SSRF** — `mcp-tool-provider.ts` `toConnectParams()` 가 `i.credentials.url` 을 검증 없이 SDK 로 전달. 내부 IP / metadata 호스트로 직접 연결 가능
2. **authType 폴스루** — `bearer_token`·`api_key` 외 임의 authType 가 `'none'` 분기로 무음 폴백되어 인증 없이 연결

## Warning (28건)
보안 (헤더 인젝션·prompt injection·런타임 자격증명 검증 부재), 동시성 (TOCTOU race, listTools 타임아웃 시 세션 누출, connect 타임아웃 부재), 아키텍처 (HandlerDependencies ISP 위반, in-process 캐시 수평 확장 결함, `__default__` 버킷 누수), 테스트 (timeout / authType variants / 메타툴 happy path / cleanup / SID 충돌 / executionId-undefined 미커버), 요구사항 (`isError` 미처리, sanitizeName 충돌 무음 덮어쓰기, 프론트엔드 isError 미처리), 문서 (UiHint widget 목록·환경변수·widget-registry JSDoc 불일치), 부수효과 (멀티턴 재개 executionId 부재 → __default__ 폴백, 매턴 재연결 비용, O(n) findEntryBySid, successResult 전체 직렬화 후 size check), API 컨트랙트 (프론트-백엔드 McpServerRef 동기화 보장 없음).

## Info (20건)
batch 쿼리, ProviderCtxBase 추출, withTimeout 공통 유틸, JSDoc 보강, McpServerSelector 테스트, integration.status 검사, integrationId.min(1), enabledTools UI, ToolDef 캐시, 환경변수 모듈로드 캐싱 등.

## 권장 조치
1. (즉시) SSRF 차단 + authType 폴스루 제거
2. (단기) listTools 실패 시 세션 close, connect 타임아웃, materializeServer race 제거, SID 충돌 처리, prompt injection 방어, runtime credential validation, `__default__` 폴백 제거
3. (중기) 누락 테스트 보완, 프론트엔드 isError 표시, withTimeout 공통 유틸 추출, `.env.example` 환경변수 등재, JSDoc 갱신

각 항목의 위치·제안 상세는 에이전트별 `review.md` 참조.
