# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — CRITICAL 2건(spec-impl-evidence 라이프사이클 규약 위반, code: 구현 surface 불충분)이 spec 프로모션 시 build-time 가드 실패를 직접 유발합니다. 나머지는 WARNING 5건, INFO 다수이며 blocking 요인이 아닙니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | plan 파일 frontmatter 에 spec-impl-evidence 전용 `status: implemented` 기재 — 라이프사이클 가드 충돌 | `spec-draft-error-codes.md` frontmatter line 3 | `spec/conventions/spec-impl-evidence.md §1` — `status: implemented` 는 spec 파일 전용 enum 값 | frontmatter `status` 를 plan-lifecycle 값(`in-progress`)으로 교체하거나 제거. 실제 `spec/conventions/error-codes.md` 신설 이후 그 파일에 기재 |
| 2 | Convention Compliance | `code:` 글로브가 에러 코드 명명 규약의 실제 구현 surface(상수/enum 정의 파일)를 미포함 — spec-impl-evidence §2.1 §3 준수 불충분 | `spec-draft-error-codes.md` frontmatter lines 4–6 | `spec/conventions/spec-impl-evidence.md §2.1, §3` — 필터·DTO는 봉투 생산 지점이지 명명 규약 집행 파일이 아님 | 에러 코드 상수/enum 정의 파일(예: `src/common/errors/*.ts`)을 `code:` 에 추가. spec 파일 신설 시 `spec-code-paths.test.ts` 로 경로 실존 확인 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/5-system/3-error-handling.md` 와 target 간 "에러 코드 형식 SoT" 책임 경계 불명확 — 동일 frontmatter 파일 공유 | target 전체 | `spec/5-system/3-error-handling.md` §1·§2.1·frontmatter | target Overview 에 "3-error-handling.md 는 코드 목록·HTTP 매핑 SoT, 본 문서는 명명 규율만 다룬다" 명시 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.10` DB-API 이중 표기 결정이 target §1 에서 정식 역참조 없이 `4-integration.md §10.4` 링크만으로 처리 | target §1 형식 괄호 부연 | `spec/1-data-model.md §2.10 status_reason` | target §1 에 `spec/1-data-model.md §2.10` 정식 역참조 추가 |
| 3 | Convention Compliance | Overview 에서 봉투 SoT 를 `api-convention §5.3` 으로 위임 선언했으나 §1 본문에서 봉투 JSON 구조를 직접 인라인 기술 — SoT 이중화 | target §1 형식 봉투 인라인 | `spec/5-system/2-api-convention.md §5.3` | 봉투 형식 인라인을 제거하고 `api-convention §5.3` 링크 참조로 대체 |
| 4 | Plan Coherence | `cafe24-backlog-residual.md` F-3 "신설 여부 결정" 체크박스 미결인 채 draft 진행 — 인덱스 동기화 누락 | `plan/in-progress/cafe24-backlog-residual.md` §잔여항목 F-3 | F-3 체크박스 | F-3 를 `[x]` 로 닫고 "결정: 신설 — spec-draft-error-codes.md 초안 작성 중" 한 줄 추가 |
| 5 | Plan Coherence | active worktree `cafe24-install-ratelimit-2891d1` 이 `CAFE24_INSTALL_RATE_LIMITED` 추가 중 — error-codes convention 공식화 후 준수 확인 기록 누락 위험 | `spec/2-navigation/4-integration.md` (cafe24-install-ratelimit-2891d1 diff) | 신설 `spec/conventions/error-codes.md §2` 의미 기반 명명 원칙 | `cafe24-install-ratelimit-2891d1` RESOLUTION.md 에 "CAFE24_INSTALL_RATE_LIMITED 는 의미 기반 명명 §2 준수 — 예외 등재 불요" 한 줄 명기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `swagger.md §2-4` 참조 앵커가 "HTTP 상태 코드 선택 SoT" 로 기재됐으나 실제 SoT 는 `api-convention.md §6` | target §1 Overview | 링크를 `api-convention.md §6` 으로 수정하거나 용도("데코레이터 패턴")를 명시 |
| 2 | Cross-Spec | `4-integration.md` Rationale 과 target §4 레지스트리가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 사실을 이중 서술 — 단일 진실 지정 없음 | target §4 레지스트리 | 격상 후 `4-integration.md` Rationale 해당 항에 "정식 SoT: `spec/conventions/error-codes.md §4`" 역참조 추가 |
| 3 | Cross-Spec | `spec/conventions/node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규정과 target §1 이 동일 원칙을 중복 선언 | target §1 형식 | target §1 에 `node-output §3.2` 역참조 추가 또는 node-output §3.2 에서 신설 conventions 로 위임 표기 |
| 4 | Cross-Spec | `spec/0-overview.md §8` 문서 맵에 `spec/conventions/error-codes.md` 미등재 | `spec/0-overview.md §8` | 격상 후 에러 코드 명명 규약 행 추가 |
| 5 | Rationale Continuity | 봉투 `details?` optional 표기 스타일이 SoT(`api-convention §5.3`, `3-error-handling §3.2`) 와 불일치 | target §1 봉투 인라인 | WARNING #3 해소 시 자동 해결 |
| 6 | Rationale Continuity | `4-integration.md` Rationale (c) 가 target 을 forward 참조하지 않아 상호 참조 단방향 비대칭 | `4-integration.md` Rationale (c) | 격상 후 (c) 에 `spec/conventions/error-codes.md` forward 참조 추가 |
| 7 | Rationale Continuity | `VALIDATION_ERROR` 등 prefix 없는 시스템 레벨 코드가 §4 예외 레지스트리 미등재 — 도메인 prefix 원칙 적용 범위 모호 | target §2 · §4 | §2 에 "도메인 범주화가 의미 있는 코드에 한해 적용" 단서 추가하거나 §4 에 시스템 글로벌 코드 일괄 등재 |
| 8 | Convention Compliance | `VALIDATION_ERROR` 가 `<DOMAIN>_<CONDITION>` 패턴 미준수인데 §4 예외 등재 없음 (INFO #7 과 동일 해소) | target §1 도메인 prefix 예시 | §4 에 등재하거나 §1 에 허용 조항 명시 |
| 9 | Convention Compliance | plan 파일에 `spec/conventions/error-codes.md` 이동 체크리스트 미명시 | plan 파일 본문/frontmatter | plan frontmatter 또는 TODO 에 "spec/conventions/error-codes.md 신설 후 plan complete/ 이동" 명시 |
| 10 | Plan Coherence | frontmatter `worktree:` 필드 누락 | `spec-draft-error-codes.md` frontmatter | `worktree: .claude/worktrees/cafe24-error-codes-convention-523e2d` 추가 |
| 11 | Naming Collision | `code:` frontmatter 가 `3-error-handling.md` · `2-api-convention.md` 가 이미 claim 한 동일 구현 파일을 중복 claim | `spec-draft-error-codes.md` frontmatter `code:` | Critical #2 해소 시 자동 해결 |
| 12 | Naming Collision | 격상 후 `4-integration.md` Rationale 에 역참조 미추가 시 독자 혼선 | `spec/2-navigation/4-integration.md` Rationale | 격상 시 역참조 한 줄 추가 (INFO #6 과 동일) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL 없음; WARNING 2건(SoT 책임 경계 불명확, DB-API 이중 표기 역참조 누락); INFO 4건 |
| Rationale Continuity | LOW | CRITICAL·WARNING 없음; INFO 3건(봉투 표기 스타일 불일치, 상호 참조 단방향, 시스템 코드 예외 미등재) |
| Convention Compliance | HIGH | CRITICAL 2건(plan frontmatter `status: implemented` 라이프사이클 위반, `code:` 구현 surface 불충분); WARNING 2건 |
| Plan Coherence | LOW | CRITICAL 없음; WARNING 2건(F-3 체크박스 미결, cross-worktree 준수 확인 누락); INFO 1건 |
| Naming Collision | NONE | 실질적 충돌 없음; INFO 2건(code: 중복 claim, 역참조 단방향) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/spec-draft-error-codes.md` frontmatter 의 `status: implemented` 를 `in-progress` 로 교체하거나 제거. spec-impl-evidence `status` / `code:` frontmatter 는 실제 `spec/conventions/error-codes.md` 신설 시점에 그 파일에 기재.
2. **(BLOCK 해소 필수)** `spec/conventions/error-codes.md` 신설 시 `code:` 항목을 에러 코드 상수/enum 을 실제 정의하는 파일로 교체하고 `spec-code-paths.test.ts` 로 경로 실존 확인. 봉투 생산 필터·DTO 파일의 중복 claim 제거.
3. target Overview 에 `3-error-handling.md` vs 본 문서의 SoT 역할 분리 한 줄 명시 (WARNING #1).
4. target §1 봉투 인라인 기술을 `api-convention §5.3` 링크 참조로 대체 (WARNING #3, INFO #5 동시 해소).
5. `plan/in-progress/cafe24-backlog-residual.md` F-3 체크박스를 `[x]` 로 닫고 결정 로그 기재 (WARNING #4).
6. 격상(프로모션) 시: `spec/0-overview.md §8` 에 `error-codes.md` 등재, `4-integration.md` Rationale 에 역참조 추가, `spec-draft-error-codes.md` 를 `plan/complete/` 로 이동 (INFO #4, #6, #9).