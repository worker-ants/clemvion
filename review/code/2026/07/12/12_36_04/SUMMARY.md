# Code Review 통합 보고서

> **주의(disk-write gap 보정)**: workflow 반환 시 `security`/`maintainability`/`testing` 3개 리뷰어의
> output 파일이 디스크에 없어(PR #901 과 동일 패턴) 최초 요약은 4/7 리뷰어 기준 **WARNING=1** 로 집계됐다.
> 본 요약은 `journal.jsonl`(wf_62c80b6c-072)에서 3개 리뷰어 전문을 복원해 재집계한 **정정본**이다.
> 실제 커버리지 7/7, 실제 **WARNING=2, CRITICAL=0**.

## 전체 위험도
**LOW** — embed-config Cache-Control TTL 값 단일 진실화 순수 DRY 리팩터. CRITICAL 0, WARNING 2 (모두 조치 완료).

## Critical 발견사항

없음.

## 경고 (WARNING) — 2건, 모두 조치 완료

| # | 카테고리 | 발견사항 | 위치 | 조치 |
|---|----------|----------|------|------|
| 1 | documentation | `getEmbedConfig` 인라인 주석 `짧게(5분)` 이 파생 상수를 참조하지 않고 리터럴 `5분` 유지 → 상수 변경 시 이 주석만 조용히 드리프트 | `hooks.controller.ts:89` | 주석을 `EMBED_CONFIG_CACHE_SEC 초` 상수 지목으로 교체 (리터럴 제거) |
| 2 | maintainability | `EMBED_CONFIG_CACHE_MAX_MIN` 네이밍 — `_MIN` 은 코드베이스에서 minimum 의미(`PARALLEL_BRANCH_COUNT_MIN` 등), 분(minutes) 기간은 `_MINUTES` 컨벤션(`DEFAULT_RETRY_STATE_TTL_MINUTES` 등). `MAX_MIN` 은 "최대·최소" 로도 읽혀 특히 모호 | `hooks.controller.ts:44` | `EMBED_CONFIG_CACHE_MAX_MINUTES` 로 개명 (3개 사용처 일괄) |

## 참고 (INFO) — 대표 항목

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | security | 순수 컴파일타임 상수 치환. 사용자 입력·시크릿·인증/인가 로직 무개입, 리스크 표면 없음. RISK=NONE | 불필요 |
| 2 | requirement/scope/side_effect | 렌더값·응답 DTO·OpenAPI 계약 byte-identical, export 없는 private const, 무관 변경 없음 | 불필요 |
| 3 | testing | 기존 헤더 단언이 `stringContaining('max-age')` 로 느슨 — SoT 회귀 미포착. Swagger 문자열 자체 테스트 부재(기존 관행, 신규 리스크 아님) | 단언을 정확값 `'public, max-age=300'` 으로 강화(SoT 회귀 가드) |
| 4 | maintainability | description 문자열 결합 스타일(`+` vs 템플릿) 파일 내 혼재 — 마크다운 백틱 이스케이프 회피 위한 실용적 트레이드오프 | 현행 유지 |

## 에이전트별 위험도 요약 (7/7 복원 후)

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 리스크 표면 없음 |
| requirement | NONE | behavior-preserving 확인 |
| scope | NONE | 변경 범위 정확히 일치 |
| side_effect | NONE | private const, 외부 영향 없음 |
| maintainability | **WARNING** | `_MIN` 네이밍 모호(→ `_MINUTES` 개명) |
| testing | INFO | 단언 강화 기회(반영) |
| documentation | **WARNING** | L89 주석 리터럴 잔존(→ 상수 지목 교체) |

## 라우터 결정

- `routing_status=done`. **실행 7명**: security, requirement, scope, side_effect, maintainability, testing, documentation (전원 router_safety 강제 포함 — 소스 코드 변경 6종 + 문서 파일 변경 documentation).
- **제외 7명**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (상수 치환/문서 문자열 리팩터 — 각 도메인 변경 경로 없음).

## 결론

WARNING 2건 모두 REVIEW WORKFLOW 에서 조치 완료. 상세 조치·재테스트 결과는 [RESOLUTION.md](./RESOLUTION.md).
