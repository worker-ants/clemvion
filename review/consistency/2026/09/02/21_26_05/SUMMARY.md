# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 응답 수령, 재시도 필요 checker 없음)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, cross_spec 이 target 자기 문서 안에서 헤더-표 모순(§1.2.1 "전용" 선언)과 감사값 출처 오인 소지를 발견했고, plan_coherence 는 결정③(9-user-profile.md) 이 원본 결정-plan 의 추적 범위 밖에 있는 구조적 위험을 지적함.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §1.2.1 "2FA/WebAuthn/재인증 흐름 전용" 헤더 문장과 `changePassword` 발행처 추가가 표-헤더 간 직접 모순 | 변경안 #5·#6 (`3-error-handling.md:66-67`) | `3-error-handling.md:52,54` §1.2.1 소제목·"...전용이다" 문장 | `:52` 소제목·`:54` 문장에 "및 비밀번호 변경(`changePassword`) 흐름이 공유" 류로 정정 |
| 2 | cross_spec | 은퇴 후 남는 `INVALID_PASSWORD` 감사값의 출처가 실제로는 `changePassword` 가 아니라 **로그인 실패**(`AuthService.login`)인데, §5 캐비어트 문안이 이 한정어를 빠뜨려 §3 기존 서술 정밀도보다 후퇴 | 결정② + 변경안 #4·#11b (§5 신규 행) | `error-codes.md:82`(§3 기존 행 — "로그인 실패의 감사 사유값"), `auth.service.ts:347` vs `users.service.ts`(changePassword 는 login_history 미기록) | §5 신규 행/item 11b 에 "이 감사값은 로그인 실패(`AuthService.login`) 전용이며 `changePassword` 는 `login_history` 를 쓰지 않는다" 구절 추가 |
| 3 | plan_coherence | target 의 신규 "결정③"(`9-user-profile.md` OAuth-only 안내 문구)이 원본 결정-plan 의 `spec_impact`/체크리스트 범위 밖 — 그 plan 완료·`complete/` 이동 시 이 항목이 추적에서 누락될 구조적 위험 | 결정③ + 변경안 #12·#13 | `auth-change-password-oauth-only-code-split.md` frontmatter `spec_impact`(3개 파일만) + `## 할 일` 체크리스트 | `spec_impact` 에 `spec/2-navigation/9-user-profile.md` 추가, `## 할 일` 에 별도 체크박스 신설 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `9-user-profile.md` 내 동일 페이지 서술 3곳 중 1곳(147행)만 OAuth-only 안내 반영 | `9-user-profile.md:94,141` (미반영) vs `:147`(반영) | 94·141행에 "(OAuth-only 안내는 §2.2 참조)" 포인터 추가 또는 §2.2 단일 SoT 임을 Rationale 에 명시 |
| 2 | rationale_continuity | §5 헤드노트 caveat 삽입 위치 — 머리말에 넣으면 다른 완전-제거 행까지 매번 재검증하게 만들 수 있음 | 변경안 #11b (§5 머리말) | 캐비어트를 머리말 대신 해당 행의 "비고" 셀에 국한하는 대안도 검토 |
| 3 | convention_compliance | §5 표의 첫 "구 코드 1개 → 신 코드 2개" 사례가 행 셀에만 기록되고 헤드노트 산문엔 일반화 안 됨 | 변경안 #10 (§5 표) | 헤드노트에 "일부 교체는 조건별 신 코드 복수 가능" 한 문장 추가, 또는 불필요 판단을 Rationale 에 기록 |
| 4 | convention_compliance | §5 `PR` 열에 병합 전 plan 링크(임시값)를 넣는 관례가 §5 에 문서화 안 됨(cafe24-catalog `?` placeholder 와 대비) | 변경안 #10 (PR 열) | 후속 PR 에서 §5 에 "PR 미정 시 plan 링크, 생성 즉시 갱신" 한 줄 추가 |
| 5 | convention_compliance | 결정 서사(실측 표·기각 사유)가 `auth-change-password-oauth-only-code-split.md` 와 상당 부분 중복 | "배경"·"왜 지금 고치나"·"왜 초판 B 거부" 섹션 | 향후 유사 draft 는 "왜" 서사를 결정 plan 링크로 참조, draft 본문은 "무엇을 어떻게"에 집중 |
| 6 | plan_coherence | 자매 draft(`spec-draft-api-convention-status-and-password-codes.md`)의 결정①②③이 이미 전부 spec 반영 완료인데 `in-progress/` 에 잔존 | target 이 인용하는 `#1268` 관련 draft | target 실행(§3 행 제거) 시 함께 `complete/` 이동 또는 은퇴 사실 한 줄 기록 |
| 7 | naming_collision | `PASSWORD_NOT_SET` 재사용 회피 근거(`auth.service.ts:330` 기존 감사값과 충돌) 실측 확인 — 문제 없음 | 결정① 기각 사유 | 없음 — 이미 회피됨 |
| 8 | naming_collision | 발행처 확장(`verifyPasswordForUser` → `changePassword` 추가)은 코드베이스 전수 grep 상 스코프 충돌 없음 | 변경안 #0·#2·#5·#6 | 없음 |
| 9 | naming_collision | `INVALID_PASSWORD` 감사값(로그인 실패)과 changePassword wire 코드는 무관한 두 기능이 우연히 공유하는 문자열 — caveat 문구 보강 여지(cross_spec #2 와 동일 사안) | §5 신규 행 / item 11b | "로그인 실패 감사 트레일(`AuthService.login`)에서 발행" 구절 추가 (WARNING #2 와 동일 조치로 해소) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §1.2.1 헤더-표 자기모순(WARNING), 감사값 출처(로그인 실패 vs changePassword) 캐비어트 정밀도 후퇴(WARNING), 9-user-profile.md 근접 서술 비동기화(INFO) |
| rationale_continuity | NONE | 전 결정·Rationale 참조 정합, INFO 1건(§5 caveat 삽입 위치)뿐 |
| convention_compliance | LOW | 명명·rename·등급 B 요건 전부 준수, INFO 3건(1→N 매핑 일반화, PR placeholder, 서사 중복) |
| plan_coherence | LOW | 결정③이 원본 plan 추적 범위 밖(WARNING), 완료된 자매 draft 잔존(INFO) |
| naming_collision | NONE | 신규 식별자 없음(결정 자체), 발행처 확장 충돌 없음, 감사값 무관성 확인(INFO만) |

## 권장 조치사항
1. `spec/5-system/3-error-handling.md:52,54` — §1.2.1 소제목·"전용" 문장을 `changePassword` 공유를 반영해 정정 (WARNING #1 해소)
2. `error-codes.md` §5 신규 행 또는 item 11b 문구에 "이 감사값은 `changePassword` 가 아니라 로그인 실패(`AuthService.login`) 전용" 구절 추가 (WARNING #2 및 INFO #9 동시 해소)
3. `auth-change-password-oauth-only-code-split.md` 의 `spec_impact` + `## 할 일` 에 `spec/2-navigation/9-user-profile.md` 항목 신설 (WARNING #3 해소)
4. (선택) `9-user-profile.md:94,141` 에 §2.2 참조 포인터 추가
5. (선택) target 실행 시 `spec-draft-api-convention-status-and-password-codes.md` 를 `plan/complete/` 로 이동 또는 은퇴 기록 추가
6. (선택) `error-codes.md` §5 헤드노트에 1→N 매핑 일반화 문장·PR 열 placeholder 관례 명문화
