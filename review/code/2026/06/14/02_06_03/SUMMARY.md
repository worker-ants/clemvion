# Code Review 통합 보고서 — schedule-gaps §2.2 (timezone fallback)

## 전체 위험도
**MEDIUM** — 핵심 기능 올바름·테스트됨. 단 모듈 경계 위반·테스트 갭·SPEC-DRIFT·JSDoc 불일치 복합.

## Critical
없음.

## 경고 (WARNING)
| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | Architecture | SchedulesModule 이 Workspace 엔티티 직접 소유(WorkspacesModule 경계 침범) | FIX (WorkspacesService 위임) |
| 2 | Architecture | isValidIanaTimezone 가 workspaces.service 에 노출 (잘못된 위치) | FIX (common/utils/timezone.ts 이동) |
| 3 | SPEC-DRIFT | 12-workspace §1.7·9-user-profile §6.1 이 timezone 을 settings 비대상으로 명시 | FIX (spec 갱신) |
| 4 | Requirement | Asia/Seoul fallback vs 1-data-model §2.2 env 체인 불일치 | 의도 명시(Schedule 전용 제품 기본값) |
| 5 | Testing | isValidIanaTimezone 독립 단위 테스트 부재 + system-context-prefix 중복 | FIX (테스트 + 통합) |
| 6 | Testing | resolveTimezone workspace null 케이스 미테스트 | FIX |
| 7 | Testing | 공백 전용 timezone 키 제거 미테스트 | FIX |
| 8 | Documentation | updateWorkspaceSettings JSDoc "origins 만 갱신" stale | FIX |
| 9 | User Guide | workspaces-and-members.mdx timezone API 미갱신 | FIX (user-guide-writer) |

## INFO (주요)
- I1/I2 Security: resolveTimezone explicit(dto)·DB wsTz IANA 검증 누락 → FIX(검증 + 무효 시 fallback).
- I5 update timezone PATCH fallback 비대칭 → 주석. I8/I16 DTO @Matches·빈문자열 시맨틱 → 일부 FIX. I15 getWorkspaceSettings JSDoc → FIX. I18 frontmatter code: → FIX. 나머지(타입 정의·네이밍) 수용.

## 에이전트별 위험도
architecture MEDIUM · testing MEDIUM · user_guide_sync WARNING · requirement LOW · documentation LOW · security LOW · scope LOW · side_effect LOW · api_contract LOW · maintainability NONE.

## 라우터 결정
router 선별 — security·requirement·scope·side_effect·maintainability·testing·documentation·architecture·api_contract·user_guide_sync 등 실행.
