# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 1건(Plan Coherence), INFO 9건. 기능 동작 충돌 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | §A.2 편집 폼과 생성 폼을 spec 필드 표가 명시적으로 구분하지 않아, 구현자가 편집 폼도 현 scope 포함으로 오인할 여지 있음 | `spec/2-navigation/6-config.md` §A.2 구현 현황 callout 마지막 문장 | `plan/in-progress/spec-sync-config-gaps.md` §미구현 — "편집 폼은 별도 범위" | §A.2 callout 에 "편집 폼은 spec-sync-config-gaps.md §A.2 후속으로 분리됨" 링크 명시. 또는 현 착수 범위 노트에 한 줄 추가. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `action='auth_config.reveal'` 표기가 규약 표기(따옴표 없음)와 스타일 혼용 | `spec/2-navigation/6-config.md` §A.4 L119 | backtick 인라인 코드 표기로 통일 |
| 2 | Cross-Spec | §3 Authentication API 표에 mutation 권한 주석 누락 (Model Config 표와 비대칭) | §3 Authentication API 표 (L258–265) | "mutation (POST/PATCH/DELETE) 은 Admin+ ([Spec 인증 §3.2])" 한 줄 추가 |
| 3 | Cross-Spec | 구현 완료 후 §A.2 구현 현황 주석 갱신 필요 (`PATCH` 항목 미구현 표시 제거) | §A.2 구현 현황 주석 (L55) | 구현 후 callout 을 "(편집 폼 포함 구현)" 으로 갱신 |
| 4 | Rationale Continuity | 편집 폼 Rationale 선제 기록 부재 — bearer_token 자동 발급 전용·마스킹 유지 원칙이 편집 경로에도 적용됨이 명시되지 않음 | `spec/2-navigation/6-config.md` §A.2 또는 ## Rationale | R-2 에 "편집 폼은 자동 발급 정책 동일 적용 — 비밀 값 재입력 불가, 변경은 regenerate 경로 일원화" 추가 |
| 5 | Rationale Continuity | §A.3 소스 IP 컬럼 결정 보류 — 결정 시 PII 최소화 원칙 참조 누락 위험 | `spec/2-navigation/6-config.md` §A.3 | 결정 시 `spec/2-navigation/4-integration.md Rationale` PII 최소화 원칙 참조 및 근거 기록 권장 |
| 6 | Convention Compliance | 최상위 섹션 번호 체계 혼재 (Part A/B vs `## 3. API` 숫자 prefix) | L28, L128, L252 | `## 3. API` → `## API` 로 숫자 prefix 제거하거나 Part A/B 도 번호 통일 |
| 7 | Convention Compliance | `FORBIDDEN` 에러 코드 SoT 참조가 동 라인에 이미 있으나, 공식 카탈로그 등재 여부가 명시되지 않음 | L124 | 이미 `[Spec 인증 §3.2]` 참조 있어 사실상 충분. 추가 조치 불필요. |
| 8 | Naming Collision | `config.headerName` (AuthConfig, camelCase) vs `Integration.credentials.header_name` (snake_case) — 기존 의도적 분리이나 혼용 위험 | 편집 폼 구현 전반 | 편집 폼 구현 시 `config.headerName` camelCase 일관 사용. `header_name` snake_case 와 혼용 금지 |
| 9 | Naming Collision | 편집 폼 테스트 파일 명명 미결 — 기존 `authentication-form.test.tsx` 와 혼동 가능 | `codebase/frontend/src/app/(main)/authentication/__tests__/` | 순수 로직은 기존 `auth-config-form.test.ts` 에 추가, UI 통합은 `authentication-form.test.tsx` 확장 또는 `authentication-edit.test.tsx` 신설 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·RBAC·audit 액션·Webhook 연동 전반 정합. INFO 3건 (표기 스타일·권한 주석 보완) |
| Rationale Continuity | LOW | 편집 폼 신설 시 적용해야 할 자동 발급·마스킹 원칙이 spec 에 선제 기록되지 않아 구현자 간과 위험. INFO 2건 |
| Convention Compliance | NONE | frontmatter 스키마·audit 액션 레지스트리·에러 코드 규약 준수. INFO 2건 (섹션 번호·backtick 표기) |
| Plan Coherence | LOW | spec §A.2 필드 표가 편집/생성 폼 범위를 명시 구분하지 않아 착수 범위 오인 가능. WARNING 1건 |
| Naming Collision | NONE | 요구사항 ID·API endpoint·이벤트명·환경변수 충돌 없음. INFO 2건 (headerName 케이스·테스트 파일 명명) |

## 권장 조치사항

1. **(착수 전 권장)** `spec/2-navigation/6-config.md` §A.2 구현 현황 callout 에 "편집 폼은 `spec-sync-config-gaps.md §A.2` 후속 범위로 분리됨" 한 줄 추가 — WARNING 해소, 착수 범위 오인 방지.
2. **(선택)** `## Rationale` 에 편집 폼 적용 원칙 명시 — bearer_token·비밀 값 재입력 불가, regenerate 경로 일원화 (Rationale Continuity INFO 4번 해소).
3. **(구현 중 주의)** `config.headerName` (camelCase) / `Integration.credentials.header_name` (snake_case) 혼용 금지 — 런타임 키 불일치 방지.
4. **(구현 완료 후)** §A.2 구현 현황 callout 갱신 및 §3 Authentication API 표에 mutation 권한 주석 추가.

---
_persisted by main (workflow terminal write was blocked; summary_written=false)_
