# Code Review 후속 처리 (RESOLUTION)

> 대상 리뷰: `review/code/2026/06/03/14_13_35/SUMMARY.md` (risk=CRITICAL, critical=1, warning=14, info=13)
> 리뷰 범위: spec-sync-audit 의 `spec/**` 20파일 동기화 갱신 (codebase 변경은 `version-history.mdx` 1줄뿐 — 나머지 codebase 는 origin/main 과 동일)
> 처리: 2026-06-03, project-planner(spec-sync) 본인 수동 조치

## 핵심 판정: 실질 CRITICAL 없음 (검증 완료)

리뷰는 **`spec/` 문서**를 대상으로 했고, 발견의 대부분은 "spec 이 기술한 **코드 현실**의 위험" 이다. 즉 본 spec-sync 가 *도입한* 결함이 아니라, spec 이 코드에 맞춰 정직하게 기술한 (이미 main 에 머지된) 동작·갭이다. 코드 수정은 사용자 지시에 따라 **별도 developer 세션**이 처리하며, 전수 항목은 `plan/in-progress/spec-sync-structural-followups.md §C` + 개별 `spec-sync-*-gaps.md` 스텁에 추적된다.

### CRITICAL #1 — FALSE POSITIVE (검증)
- 주장: `user-guide-evidence.md` 의 `pending_plans: spec-sync-user-guide-evidence-gaps.md` 가 부재 → `spec-pending-plan-existence.test.ts` 가드 fail.
- 검증: 해당 스텁 **실존** (`plan/in-progress/spec-sync-user-guide-evidence-gaps.md`, 1245B). 정식 vitest `spec-pending-plan-existence.test.ts` **61 테스트 통과**. 리뷰어가 origin/main 기준으로 비교해 worktree 의 신규 스텁을 못 본 오탐 (consistency-check 의 동일 false-positive 와 같은 원인). → **가드 fail 없음, CI 차단 없음.**
- W9 (동일 근원) 도 동일하게 해소.

## WARNING 처리

| # | 분류 | 처리 |
|---|---|---|
| 1 X-Workspace-Id IDOR / 2 workspace UNIQUE DB 미강제 / 8 schedule 트랜잭션 / 10 alert_type CHECK | 코드 도메인 | spec 은 코드 현실 + Rationale 로 정확 기술. 수정은 developer — `spec-sync-structural-followups.md §C` (C-6, C-19 등) + `spec-sync-data-flow-12-workspace-gaps.md`/`spec-sync-data-flow-8-notifications-gaps.md` 추적 |
| 3·4·5·6·7·11 API 계약 변경 (`/run`→`/execute`, `/interactions`→`/continue`, 404→410, 세션 revoke, OAuth begin, 423→401, WS→SSE) | 코드 현실 기술 | 이 변경들은 **이미 main 코드에 반영된 동작**이며 spec 이 그것을 기술한 것(drift 정정). 클라이언트 정합은 코드 도메인 — 해당 gaps 스텁/followups 에 추적. spec 자체는 정확 |
| 9 user-guide-evidence §4 미구현 추적 | = CRITICAL#1 | 스텁 실존으로 해소 |
| 12 DB/Email in-flight 중단 테스트 부재 | 코드 도메인 | `node-cancellation` 스텁 추적 (developer) |
| 13·14 섹션 제목에 '미구현 (Planned)' 포함 → 앵커 변경 우려 | **검증: dead link 0** | 해당 앵커로의 inbound cross-ref grep 결과 0건. 현재 breakage 없음. 향후 cross-ref 안정성 위해 blockquote 표기 권장은 **별도 컨벤션 정비 turn** 으로 이관(본 동기화 113파일 전반의 표기 패턴 일괄 변경은 범위 밖) |

## INFO 처리
- 성능(S3 bulk delete, alerts N+1)·보안(S3 prefix, audit_log enum)·테스팅(누락 테스트): 모두 **코드 도메인** — 해당 gaps 스텁/followups 에서 추적, developer 처리.
- 유지보수 INFO-11 (spec 의 file:line 하드코딩), INFO-12 (구현 상태 표기 6종 혼재): 타당한 스타일 지적. 단 file:line 은 followups §C 가 *developer 단독 처리*를 위해 의도적으로 채택한 정밀 참조이며, 상태 표기 통일은 **별도 컨벤션 정비 turn** 권고 (본 동기화가 도입한 게 아닌 repo 전반 패턴).

## 결론
- **CI 차단 없음** (CRITICAL false-positive, 4 spec 가드 + docs 가드 1498 통과, frontend build 통과).
- **spec 편집의 실제 결함 0** — 모든 WARNING/INFO 는 (a) 코드 도메인(developer, followups 추적) 또는 (b) 별도 컨벤션 정비 권고.
- 사용자 지시("코드 버그는 developer 세션 처리")에 따라 **본 turn 에서 코드 미수정**. resolution-applier 자동 fix 미적용 — 코드 도메인 항목을 spec-sync turn 에서 손대지 않기 위함.
