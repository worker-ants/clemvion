# Cross-Spec 일관성 검토 — target `spec/2-navigation/` (impl-done, diff=User 엔티티 노출 방어)

## 검토 정황

target scope(`spec/2-navigation/`)는 이번 diff 에서 **변경분 0개**다 (실측: `git diff origin/main...HEAD --stat` 에 `spec/2-navigation/**` 항목 없음). 실제 diff 15개 파일/2005줄은 `spec/2-navigation/` 이 아니라 **`User` 엔티티 민감 컬럼 노출 방어**(`workflow-versions.service.ts` creator 투영, `user-entity-exposure-guard.ts`, `user-secret-absence.ts`, `dto-jsdoc-citation-guard.ts`) + `spec/conventions/{review-citations.md,spec-impl-evidence.md}` 정정 + `.claude/hooks/_lib/review_guard.py` 파서 수정이다. 이는 정상이다(코드/컨벤션 전용 PR). 아래는 이 diff 가 `spec/2-navigation/`(및 그 인접 데이터 모델·RBAC 문서)과 실제로 충돌하는지를 절대경로 워킹트리에서 직접 실행·grep 하여 확인한 결과다.

## 발견사항

### [WARNING] `User` 민감 7컬럼의 "응답 절대 미노출" 불변식이 `spec/1-data-model.md`(엔티티 홈 문서)에 규범 문장으로 없다 — 같은 계열인 `secret-store.md §1.1` 과 비대칭 (이미 추적 중, 미해결)

- **target 위치**: 없음 (`spec/2-navigation/` 은 무관) — 실제로는 `spec/1-data-model.md` §2.1 `User` 엔티티 표.
- **충돌 대상**: `spec/conventions/secret-store.md` §1.1 "비대상 필드도 응답 바디에는 나가지 않는다" (Trigger/AuthConfig 계열 secret-store ref 에 이미 규범 문장 존재).
- **상세**: 이번 diff 가 신설한 `USER_SECRET_KEYS`(7컬럼: `passwordHash`/`twoFactorSecret`/`totpRecoveryCodes`/`webauthnRecoveryCodes`/`emailVerifyToken`/`passwordResetToken`/`emailChangeToken`)는 `spec/1-data-model.md` §2.1 `User` 표의 필드 목록과 정확히 일치한다(데이터 자체는 충돌 없음). 그러나 "이 컬럼은 응답에 나가면 안 된다"는 불변식의 **SoT 가 코드(가드 3종 + CHANGELOG)뿐**이고, 같은 문서(`1-data-model.md`) 안에서도 다른 필드(`background_run_id`, §2.25 인접)는 `REST 미노출(select:false)` 처럼 필드 표 안에 직접 주석을 다는데, `User` 의 7컬럼에는 그런 표기가 전혀 없다. Trigger/AuthConfig 계열은 이미 `secret-store.md §1.1`(2026-09-05 도입)이 정확히 같은 취지의 규범 문장을 갖고 있어, `User` 만 비대칭이다.
- 이 항목은 **이번 회차의 새 발견이 아니다** — `review/consistency/2026/09/06/10_13_23` W2 가 최초 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:457-467`에 `[ ]`(미해결) planner 항목으로 이미 등재돼 있다: *"→ `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 7컬럼 노출 금지를 적고, 위 두 가드를 그 절의 `code:`/본문 링크로 잇는다."* 실측(2026-09-06 HEAD 기준) 결과 **아직 미착수** — `spec/1-data-model.md`·`secret-store.md` 어느 쪽도 이번 diff 에서 건드리지 않았다(`git diff origin/main...HEAD -- spec/1-data-model.md spec/conventions/secret-store.md` 무변경).
- **제안**: 새 항목을 추가하지 말 것 — 위 plan 항목이 이미 정확한 처방(§2.1 또는 §1.1 확장 + Rationale 이설)을 갖고 있다. planner 턴에서 그 항목을 그대로 집행하면 이 WARNING 은 해소된다.

## 확인됨 — 충돌 없음 / 이전 CRITICAL 해소 확인 (참고용, 새 조치 불필요)

- **이전 CRITICAL 해소 확인**: `review/consistency/2026/09/06/13_52_23/cross_spec.md` 가 지적한 CRITICAL(`review_guard._parse_frontmatter_code` 가 `code:` 블록 안의 `#` YAML 주석에서 `break`해 `spec/2-navigation/9-user-profile.md` 등 3개 도메인 7개 파일에서 41개 entry 가 조용히 유실되고, 이번 PR 자신이 고친 `workspace-response.dto.ts` 경로도 그중 하나였던 문제)는 이번 diff 의 `.claude/hooks/_lib/review_guard.py` 파서 수정(빈 줄·`#` 주석 skip)으로 **해소됐다**. 절대경로 워킹트리에서 직접 실행해 검증:
  - `rg._parse_frontmatter_code("spec/2-navigation/9-user-profile.md")` → 수정 전 2개 → **수정 후 17개** (전량 복구).
  - `_layout.md`/`10-auth-flow.md`/`11-error-empty-states.md`/`spec/7-channel-web-chat/{2-sdk,3-auth-session}.md`/`conventions/user-guide-evidence.md` 도 각각 5/11/15/4/6/7개로 전량 파싱됨.
  - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`(이번 diff 가 수정한 바로 그 파일)이 이제 전역 패턴 1개와 매칭 — Gate 2(`--impl-done` spec-linked 판정)가 이 파일을 다시 인식한다.
  - 수정하지 않고 남긴 7개 spec 파일도 의도적이다 — 파서를 고쳐 두 파서(게이트 정규식 vs 프런트엔드 gray-matter)의 답을 **731 대 731, 갈리는 파일 0** 으로 일치시켰기 때문에 파일 쪽 회피(주석 제거)가 불필요해졌다.
- **`WorkspaceMemberDto.joinedAt` 신설 필드**: `spec/1-data-model.md` §2.3 `WorkspaceMember.joined_at (Timestamp?)`와 필드명·nullable 여부 일치. `@ApiProperty({ nullable: true }) joinedAt: string | null` 선언은 `spec/5-system/2-api-convention.md §5.4`의 "null(키 present) = 기본값, 상시 존재" 규칙을 정확히 준수(`@ApiPropertyOptional` 오용 아님). `spec/2-navigation/9-user-profile.md`(멤버 목록 mock·API 표)는 이 필드를 표시하거나 언급하지 않으므로 표시 계약과의 모순도 없다.
- **`GET /api/workspaces/:id/members` 응답 형태**(`{ data: [...] }` bare array, 페이지네이션도 `{data:{items}}` 도 아님)는 `spec/5-system/2-api-convention.md §5.2`의 두 공인 형태(페이징 목록 / 비-페이징 고정 컬렉션) 중 어느 쪽에도 정확히 안 들어맞는 세 번째 형태이나, **이번 diff 의 신규 변경이 아니라 기존 컨트롤러의 사전 상태**이고(diff 는 이 엔드포인트에 처음으로 e2e 를 붙였을 뿐), 이미 오늘자 code review 3개 라운드(`10_13_22`/`11_27_53`/`11_55_36` api_contract.md)에서 각각 INFO 로 채점·"diff 대상 아님"으로 스코프 확정됐다. 재상정하지 않는다.
- **`User` 비밀 7컬럼 검출 가드 3종**(구조/이름/JSDoc 인용)은 서로 다른 파일에 겹치지 않게 단일 소유(`isResponseDtoFile` 공유)로 배선돼 있어 §5.4/`swagger.md §5-1` 검증 층 분리 원칙과 계층 책임 충돌 없음.

## 요약

target(`spec/2-navigation/`) 자체는 이번 diff 에서 변경되지 않았고, 실제 diff(User 엔티티 민감 컬럼 방어 + 프런트매터 파서 수정)는 nav 도메인의 데이터 모델·API 계약·상태 전이·RBAC 어느 축과도 새로운 충돌을 만들지 않는다. 오히려 이번 diff 는 `spec/2-navigation/9-user-profile.md` 를 포함한 7개 spec 파일이 게이트 파서 버그로 `--impl-done` 커버리지에서 조용히 빠져 있던 **기존 CRITICAL(전 라운드 cross_spec 지적)을 해소**했음을 직접 실행으로 재확인했다. 유일하게 남은 미해결 사안은 `User` 민감 컬럼의 응답 비노출 불변식이 `spec/1-data-model.md`(또는 `secret-store.md §1.1`)에 규범 문장으로 없다는 비대칭인데, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(457행)에 planner 담당 미해결 항목으로 정확히 등재돼 있어 새 조치 없이 그 항목 집행으로 해소 가능하다.

## 위험도

LOW
