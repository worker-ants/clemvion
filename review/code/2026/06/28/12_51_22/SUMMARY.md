# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 MDX 문서 수정(코드 변경 없음). spec 정합은 확인됐으나 rate limit 정책 변경에 대한 클라이언트 가이던스 보강 여지가 있음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 429 rate limit 범위 변경(per-trigger 60 → global 100 req/min)의 배경·`Retry-After` 헤더 지원 여부가 문서에 없음. 클라이언트가 버스팅 로직 구현 시 정책 전환을 자동 감지하기 어려움. | `triggers.en.mdx` L47 / `triggers.mdx` L91 | 429 응답 행에 scope(instance-wide), `Retry-After` 헤더 지원 여부를 짧은 주석 또는 Callout 블록으로 추가 권장. 즉각 필수는 아님. |

> **해소(후속 커밋)**: 429 행에 `Retry-After` 헤더 안내 추가(spec 5-system/2-api-convention.md §7 정합). scope("instance-wide global")는 직전 커밋에서 이미 반영.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | Webhook 429 rate limit 수정(글로벌 100 req/min)은 spec/5-system/2-api-convention.md §7 및 spec/5-system/12-webhook.md WH-SC-05 와 line-level 정합 확인됨. | `triggers.en.mdx` L48 / `triggers.mdx` L92 | 추가 조치 불필요. |
| 2 | Requirement | Webhook 본문 크기 "공개 32KB / 인증 1MB(Planned)" 분리 임계는 spec WH-NF-02·§6 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 완전 정합. | `triggers.en.mdx` L37 / `triggers.mdx` L81 | 추가 조치 불필요. 인증 1MB 구현 시 Planned 마킹 제거(`plan/in-progress/spec-sync-webhook-gaps.md` 추적 중). |
| 3 | Requirement | Inbound command `429 RATE_LIMITED` "(Planned — not yet implemented)" 마킹은 spec/5-system/14-external-interaction-api.md §5.1 "미구현" 명시와 일치. | `triggers.en.mdx` L57 / `triggers.mdx` L101 | 추가 조치 불필요. 향후 구현 시 60건/분 수치 재확정 필요(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 추적 중). |
| 4 | API Contract | `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 에러 코드 신규 도입: HTTP 상태코드(413)는 유지되어 프로토콜 레벨 breaking change 없음. 단, 클라이언트가 봉투 `code` 필드로 분기하는 경우 신규 code 값 처리 필요. | `triggers.en.mdx` L39 / `triggers.mdx` L83 | API 가이드에 에러 봉투 스키마(`{ code, message }`) 명시 여부 확인. SDK·문서에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 열거형 추가 검토. |
| 5 | Documentation | 영문·한국어 문서 변경 내용(오류 코드, 수치, Planned 마킹) 병렬 동기화 정상 확인됨. | `triggers.en.mdx` / `triggers.mdx` 전체 diff | 추가 조치 불필요. |
| 6 | Documentation | 이번 변경이 코드 변경 없는 doc-sync 보정이라면 CHANGELOG 업데이트는 범위 외. 동작 변경 PR(rate limit policy 전환)의 릴리즈 노트 기재 여부 사후 확인 권장. | 프로젝트 루트 CHANGELOG | 동작 변경 PR 릴리즈 노트에 반영됐는지 확인. |
| 7 | Documentation | review/code/2026/06/28/12_28_46/ 메타 파일들(RESOLUTION.md, SUMMARY.md 등)은 이전 리뷰 세션 산출물로 기능·요구사항에 영향 없음. | review/code/2026/06/28/12_28_46/ | 추가 조치 불필요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 모든 변경이 spec SoT(WH-SC-05·WH-NF-02·§6·EIA §5.1)와 line-level 정합. 비즈니스 로직 결함·엣지 케이스 누락 없음. |
| documentation | LOW | 429 rate limit 정책 변경(per-trigger → global) 배경 및 `Retry-After` 헤더 지원 여부가 문서에 부재. 클라이언트 가이던스 보강 여지 있음. |
| api_contract | LOW | HTTP 상태코드 계약 유지로 프로토콜 breaking change 없음. 에러 봉투 code 분기 클라이언트 및 `Retry-After` 처리에 대한 추가 문서화 검토 권장. |

## 발견 없는 에이전트

_없음_ (모든 실행된 reviewer 에서 발견사항 있음)

## 권장 조치사항

1. **(WARNING 해소 — 선택적 개선)** `triggers.en.mdx`·`triggers.mdx` 의 429 응답 설명에 scope("instance-wide global") 및 `Retry-After` 헤더 지원 여부를 짧게 명시. 즉각 필수는 아니나 클라이언트 혼란 방지에 유효. → **후속 커밋에서 반영**.
2. **(INFO — 추적 확인)** 에러 봉투 스키마 문서(`{ code, message }`)에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 열거형이 반영되어 있는지 확인. SDK 문서·에러 코드 목록 업데이트 검토.
3. **(INFO — 기존 plan 추적 중)** 인증 webhook 1MB 구현 시 Planned 마킹 제거(`spec-sync-webhook-gaps.md`). Inbound rate-limit 구현 시 60건/분 수치 재검토(`spec-sync-external-interaction-api-gaps.md`).

## 라우터 결정

- **실행**: `requirement`, `documentation`, `api_contract` (3명; `documentation` 은 router_safety 강제 포함)
- **제외**: 11명

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 라우터 제외 |
| performance | 라우터 제외 |
| architecture | 라우터 제외 |
| scope | 라우터 제외 |
| side_effect | 라우터 제외 |
| maintainability | 라우터 제외 |
| testing | 라우터 제외 |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| user_guide_sync | 라우터 제외 |

- **강제 포함(router_safety)**: `documentation`
