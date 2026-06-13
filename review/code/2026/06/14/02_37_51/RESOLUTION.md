# RESOLUTION — user-profile-gaps 테마 System ai-review (2026-06-14/02_37_51)

RISK=MEDIUM, Critical 0, Warning 4. 수동 조치 — backend 'system' 수용의 **frontend ripple** 을 동반 구현으로 완결.

## WARNING 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 API 계약 (UserProfileDto.theme enum) | ✅ FIXED | `user-response.dto.ts` 가 `USER_THEMES` import 해 `enum: USER_THEMES` 참조(향후 동기화 자동). |
| 2 side_effect (ServerTheme 타입) | ✅ FIXED | `frontend/src/lib/api/users.ts` `ServerTheme` = `"light"\|"dark"\|"system"`. |
| 3 side_effect (profile sync guard) | ✅ FIXED | `profile/page.tsx` theme sync guard 에 `"system"` 포함. |
| 4 side_effect (label 오표시) | ✅ FIXED | `ProfilePreferencesCard` themeLabel/themeReadonlyLabel 에 `'system'` 분기 + 토글 옵션 버튼 추가 + i18n(`profile.themeSystem` ko"시스템"/en"System"). theme-store 는 이미 prefers-color-scheme 적용. |

## INFO 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 avatarUrl SSRF | ✅ 주석 | "서버가 이 URL 을 fetch 하지 않음(클라 <img src>)" + 향후 fetch 시 require_tld:true·내부IP 차단 가드 명시. |
| 3 theme=null 테스트 | ✅ FIXED | null optional 통과 케이스 추가. |
| 5 it.each 변수명 t→theme | ✅ FIXED | |
| 2,4,6,7 (컨트롤러 통합테스트·locale 커버리지·USER_LOCALES 주석·plan frontend 추적) | 수용 | DTO 단위테스트로 충분, plan 메모로 추적. |

## 검증
- backend: dto 7건 통과, build·lint(0). frontend: eslint(0)·tsc(profile/users/theme 에러 0).
- 결과적으로 항목4(테마 System)가 backend+frontend **완전 구현** — ai-review 가 ripple WARNING 을 잡아 thin backend-only → 완결로 격상.

## 결론
Critical 0. Warning 4 전부 해소(backend dto + frontend 타입/guard/label/토글/i18n 동반). 테마 System 풀스택 완료.
