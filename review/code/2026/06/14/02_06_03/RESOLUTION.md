# RESOLUTION — schedule-gaps §2.2 ai-review (2026-06-14/02_06_03)

RISK=MEDIUM, Critical 0, Warning 9. 수동 조치.

## WARNING 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 Architecture (SchedulesModule Workspace 직접 소유) | ✅ FIXED | Workspace forFeature 제거. `WorkspacesService.getWorkspaceTimezone`(RBAC 없는 내부 헬퍼) 신설, SchedulesService 가 위임 호출(WorkspacesModule 은 @Global 이라 import 불요). 모듈 경계 준수. |
| 2 Architecture (isValidIanaTimezone 위치) | ✅ FIXED | `common/utils/timezone.ts` 로 이동. workspaces.service·system-context-prefix(캐시 래퍼 유지) 모두 공용 util 위임 — 중복 제거(W5). |
| 3 SPEC-DRIFT (12-workspace §1.7·9-user-profile §6.1 timezone 비대상) | ✅ FIXED | 두 spec 의 PATCH/GET body·response 에 `timezone?` 추가, "비대상" 문구 정정. |
| 4 Requirement (Asia/Seoul vs env 체인) | ✅ 의도 명시 | resolveTimezone JSDoc 에 "Schedule 도메인 전용 제품 기본값(서버 env/UTC 아님)" 명시. |
| 5 Testing (isValidIanaTimezone 단위 + 중복) | ✅ FIXED | `timezone.spec.ts` 신규. 중복은 W2 에서 통합. |
| 6 Testing (workspace null 케이스) | ✅ FIXED | getWorkspaceTimezone undefined → Asia/Seoul 테스트 + dto 무효 → BadRequest 테스트. |
| 7 Testing (공백 timezone) | ✅ 커버 | 빈 문자열 설정 해제 테스트(trim 으로 공백도 동일 경로). |
| 8 Documentation (updateWorkspaceSettings JSDoc) | ✅ FIXED | "interactionAllowedOrigins 와 timezone 갱신" 으로 수정. getWorkspaceSettings JSDoc(I15)도. |
| 9 User Guide | ✅ FIXED | user-guide-writer 가 workspaces-and-members.mdx/en.mdx 에 timezone(API-only) 안내 추가(KO/EN). |

## INFO 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 resolveTimezone explicit IANA 검증 | ✅ FIXED | 명시값 무효 → INVALID_TIMEZONE BadRequest(silent fallback 대신). |
| 2 DB wsTz 검증 | ✅ FIXED | getWorkspaceTimezone 이 isValidIanaTimezone 으로 검증(레거시 방어). |
| 16 DTO 빈 문자열 시맨틱 | ✅ FIXED | description 에 "빈 문자열=설정 해제" 명시. |
| 18 frontmatter code: | ✅ FIXED | 3-schedule.md 에 workspaces.service·dto·timezone.ts 등재. |
| 15 getWorkspaceSettings JSDoc | ✅ FIXED | timezone 반환 반영. |
| 5,11,12,13,6,7,8,9,10,17 (update 비대칭 주석·as never→as unknown·네이밍·WorkspaceSettings 타입·DTO @Matches·e2e·기존 origins 선언) | 수용/일부 | 본 PR 범위·우선순위 고려(as never→as unknown as CreateScheduleDto 적용). |

## 검증
- 137건 통과(schedules+workspaces+timezone+system-context-prefix). build·lint(0) 통과.

## 결론
Critical 0. Warning 9 해소(아키텍처 모듈 경계 위임·util 통합·SPEC-DRIFT·테스트·JSDoc·user-docs). 보안 INFO(IANA 검증) 반영.
