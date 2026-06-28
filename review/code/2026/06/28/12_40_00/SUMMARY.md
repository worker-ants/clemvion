# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 MDX 문서 수정으로 코드 변경 없음. API 계약 관점 혼선 가능성(WARNING) 존재하나 즉각 차단 수준 아님.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | 동일 413 행에 구현된 32KB 공개 웹훅 한도와 미구현 예정 1MB 인증 웹훅 한도가 혼재 — API 클라이언트가 실제 반환 여부 혼동 가능 | `triggers.en.mdx` L39/49, `triggers.mdx` L548/558 | 413 응답 코드 테이블을 공개/인증 두 행으로 분리하거나 인증 웹훅 한도 행에 "(현재 미시행 — 구현 후 enforced)" 주석 명시. Planned 기능 배포 시 문서 갱신 누락 방지용 spec 연결 트래킹 추가 |
| 2 | API Contract | webhook 429 rate limit이 per-trigger 60 req/min → global 100 req/min으로 변경됐으나 "global"의 범위(워크스페이스/인스턴스/엔드포인트 그룹)가 불명확 | `triggers.en.mdx` L50, `triggers.mdx` L559 | "글로벌"의 적용 범위를 문서에 명시. `spec/5-system/12-webhook.md` WH-SC-05 와 실제 서버 구현의 수치 정합 여부 확인 |
| 3 | API Contract / Documentation | inbound command 429 `RATE_LIMITED`(60 req/min per execution)가 미구현임을 명시했으나 현재 실제로 반환되지 않는 응답 코드가 응답 테이블에 포함되어 API 계약 일관성 혼선 발생 가능. 미구현 수치(60건/분)는 향후 구현 시 변경 가능 | `triggers.en.mdx` L59/357, `triggers.mdx` L566/568 | 미구현 응답 코드를 별도 "예정 응답 코드" 섹션으로 분리하거나 일관된 `[Planned]` 뱃지 표기. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 "EIA inbound rate-limit 구현 시 수치(60건/분) 재검토 + 문서 갱신" 체크리스트 항목 추가 (이미 추적 중) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 영문 문서에서 동일 Planned 상태를 "not yet enforced"(URL 섹션)와 "not yet implemented"(응답 코드 테이블)로 미세하게 다른 문구 사용. 한국어도 유사 | `triggers.en.mdx`, `triggers.mdx` | "Planned — not yet implemented"로 단일화 권장 |
| 2 | Documentation | 413 응답 테이블 셀에 두 개 조건이 한 문장으로 혼재 — 스캔 가독성 저하 | `triggers.en.mdx`/`triggers.mdx` 413 행 | 두 행으로 분리하거나 `<br/>` 구분 표기 고려 (WARNING #1과 연계) |
| 3 | Documentation | CHANGELOG 갱신 필요성 — rate limit 정책 변경이 코드 측에서도 적용된 경우 릴리즈 노트 기재 권장 | 프로젝트 루트 또는 spec CHANGELOG | 코드 변경 없는 순수 문서 보정이라면 생략 가능 |
| 4 | API Contract | `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 신규 에러 코드 도입 — 응답 바디 구조가 문서에 미명시 | `triggers.en.mdx` L39, `triggers.mdx` L548 | 에러 응답 바디 구조(`{ code: "PUBLIC_WEBHOOK_BODY_TOO_LARGE", ... }`) 명시 권장 |
| 5 | API Contract | 32KB 공개 웹훅 한도가 신규 도입인지 기존 적용 중인지 불명확 — 신규라면 1MB 기준 기존 클라이언트에 breaking change 가능성 | `triggers.en.mdx` L39 | spec 이력 확인. 신규 도입이라면 마이그레이션 가이드 또는 deprecation 공지 필요 |
| 6 | Requirement | Webhook 413/본문 크기 정책 및 429 rate limit 수치 — spec WH-NF-02·WH-SC-05 line-level 정합 확인됨 | `triggers.en.mdx`, `triggers.mdx` | 추가 조치 불필요 |
| 7 | Requirement | 이전 리뷰 세션 산출물(SUMMARY.md 등) 포함 — 기능 영향 없음 | `review/code/2026/06/28/12_28_46/` | 추가 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 두 주요 변경(413 분리임계·429 글로벌 수치) spec WH-NF-02·WH-SC-05 정합. inbound rate-limit 미구현 마킹 spec §8.4 정합. |
| documentation (강제 포함) | LOW | Planned 표현 미세 불일치, 413 셀 가독성, 미구현 inbound 수치 문서 안정성 우려. 즉각 수정 필수 아님. |
| api_contract | MEDIUM | 구현/미구현 413 혼재, global 범위 불명확, 미구현 429 코드 API 계약 혼선. |

## 발견 없는 에이전트

해당 없음 (모든 실행 에이전트에서 발견사항 존재).

## 권장 조치사항

1. **(즉각 권장)** 413 응답 코드 테이블을 공개 웹훅(32KB, 구현됨)과 인증 웹훅(1MB, Planned)으로 두 행 분리하거나 인증 웹훅 행에 명시적 미시행 주석 추가 — API 클라이언트 혼동 방지.
2. **(즉각 권장)** 429 "global" rate limit의 적용 범위(워크스페이스 레벨인지 인스턴스 레벨인지)를 문서에 명시.
3. **(계획 추적)** `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 "EIA inbound rate-limit 구현 시 수치(60건/분) 재검토 + 문서(triggers.mdx/en.mdx) 및 spec 동시 갱신" 체크리스트 항목 확인·추가.
4. **(문서 개선, non-blocking)** Planned 표현 문구를 문서 내에서 "Planned — not yet implemented"로 단일화.
5. **(문서 개선, non-blocking)** `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 에러 응답 바디 구조를 문서에 명시.
6. **(이력 확인)** 32KB 공개 웹훅 한도가 신규 도입인지 spec 이력 확인 — 신규라면 마이그레이션 가이드 또는 CHANGELOG 기재.

## 라우터 결정

라우터가 reviewer를 선별하여 실행함:

- **실행**: `requirement`, `documentation` (강제 포함), `api_contract` (3명)
- **강제 포함(router_safety)**: `documentation`
- **제외**: 11명

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 순수 문서 변경, 보안 영향 없음 |
| performance | 순수 문서 변경, 성능 영향 없음 |
| architecture | 순수 문서 변경, 아키텍처 영향 없음 |
| scope | 라우터 판단에 의해 생략 |
| side_effect | 순수 문서 변경, 부작용 없음 |
| maintainability | 라우터 판단에 의해 생략 |
| testing | 순수 문서 변경, 테스트 대상 없음 |
| dependency | 라우터 판단에 의해 생략 |
| database | 순수 문서 변경, DB 영향 없음 |
| concurrency | 순수 문서 변경, 동시성 영향 없음 |
| user_guide_sync | 라우터 판단에 의해 생략 |
