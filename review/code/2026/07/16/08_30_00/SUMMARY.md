# 코드 리뷰 SUMMARY — control-plane per-provider escape (F-5 근본 fix)

- 범위: `origin/main..HEAD` (docs + refactor), escapeControlText 이관 + F-5 제거.
- 실행 reviewer: 8 (requirement, architecture, side_effect, security, maintainability, scope, testing, documentation).

## 위험도: 초회 MEDIUM → fix 후 해소 · **BLOCK: NO** (Critical 0)

| reviewer | Critical | Warning | Info |
|---|---|---|---|
| requirement | 0 | 3 | 2 |
| architecture | 0 | 1 | — |
| side_effect | 0 | 1 | 4 |
| security | 0 | 0 | 2 |
| maintainability | 0 | 2 | 1 |
| testing | 0 | 2 | 1 |
| scope | 0 | 0 | 0 |
| documentation | 0 | 2 | — |

## Critical: 없음. security = NONE (F-5 제거가 injection 위험 안 염 — 봇 API 텍스트 필드, escape 는 어댑터가 소유).

## Warning 처분 — fix (commit `2a2e3a8c7`), 상세 `RESOLUTION.md`

**fix**:
- [architecture] escape 4개 발송 site → sendBestEffortNotice 단일 chokepoint 통일.
- [maintainability] telegram escapePromptText 중복 제거 + sendSurfaceMismatchNotice stale 주석.
- [testing] escapeControlText wiring(marker) + /help 경로 테스트.
- [documentation/requirement] §1.1 rename broken backlink 2곳 + types.ts/R-CCA "6함수" 일반화.

**문서화/ops**:
- [requirement/side_effect] 이중-escape 마이그레이션(F-5기 escaped override) → plan 에 배포 전 DB 점검 ops
  note. 코드 방어는 미채택(backslash-toggle 복잡도 부활 + 평문 계약서 오탐). 위험 창 매우 좁음(#950 직후).

**backlog/수용**:
- [documentation] R1/R2 Rationale 제목의 "6함수"(historical core-6 설계) → 제목 anchor cascade 회피 위해 보존.
- [testing] formValidationFailed/formNextField 경로 테스트는 handleFormStep 복잡 setup — 미추가(수용), /help+wiring 으로 escape 경유는 대표 검증.
