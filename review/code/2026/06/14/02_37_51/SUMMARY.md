# Code Review 통합 보고서 — user-profile-gaps 테마 System (항목4)

## 전체 위험도
**MEDIUM** — backend `USER_THEMES` 에 `'system'` 추가는 안전하나 frontend 타입·동기화·레이블 3곳에 즉각 부작용 + OpenAPI 응답 DTO enum 누락.

## Critical
없음.

## 경고 (WARNING)
| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | API 계약 | `UserProfileDto.theme` @ApiProperty enum 이 `['light','dark']` 만 — `'system'` 누락 | FIX (USER_THEMES 참조) |
| 2 | side_effect | frontend `ServerTheme = "light"\|"dark"` 에 `'system'` 없어 타입 불일치 | FIX (frontend 타입) |
| 3 | side_effect | `profile/page.tsx` theme sync guard 가 `'system'` 제외 → 동기화 누락 | FIX (frontend guard) |
| 4 | side_effect | `ProfilePreferencesCard` themeLabel 이 `'system'`→'Light' fallback (오표시) | FIX (frontend label+i18n+prefers-color-scheme 적용) |

## INFO 처리
- I1 avatarUrl require_tld:false SSRF(현재 fetch 안 함) → 주석. I3 theme=null 테스트, I5 it.each 변수명, I6 USER_LOCALES 주석 → 일부 FIX/수용. I2/I4/I7 수용.

## 에이전트별 위험도
side_effect MEDIUM(frontend 3건) · requirement LOW(Swagger enum) · security LOW(avatarUrl) · scope NONE · maintainability NONE · testing NONE · documentation NONE.

## 라우터 결정
router 선별 — 7명(security·requirement·scope·side_effect·maintainability·testing·documentation). 상수+검증 변경이라 perf/arch/db/concurrency/dependency/api/user-docs 제외.
