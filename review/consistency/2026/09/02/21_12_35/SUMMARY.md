# Consistency Check 통합 보고서

**BLOCK: YES** — plan_coherence 가 CRITICAL 1건을 발견

## 전체 위험도
**CRITICAL** — target 의 착수 근거("사용자 결정")가 참조 plan 문서에 실제로 기록돼 있지 않고, 채택안이 그 plan 의 A/B/C 선택지 어디에도 해당하지 않음. 나머지 4개 checker(cross_spec/rationale_continuity/convention_compliance/naming_collision)는 LOW~NONE 으로 설계 자체의 논리적 견고성은 높음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 착수 근거로 인용한 `auth-change-password-oauth-only-code-split.md` "사용자 결정(2026-09-02) — 선택지 1 '형제와 완전 정렬'"이 해당 plan 문서 어디에도 기록돼 있지 않음(문구 자체가 그 파일에 없음). 게다가 target 이 실제로 채택한 안(신규 코드 0, `PASSWORD_NOT_SET` 신설 명시적 기각)은 그 plan 의 A(현상유지)/B(`PASSWORD_NOT_SET` 신설·권장)/C(메시지만 분기) 어느 것에도 해당하지 않는 제4의 합성안 | 머리말 "착수 근거" 인용문, 결정 ① 전체 | `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 선택지` 표(A/B/C, 전항목 `- [ ]` 미체크, `## 결정 기록` 절 자체 부재) + `## 할 일` 체크리스트(전부 "(B 인 경우)" 로 조건화돼 있어 target 의 어떤 변경도 트리거하지 않음). `spec/conventions/error-codes.md:82` §3 행과 `ws-token-expired-socket-lifetime-impl.md:78-80` 도 이 질문을 "미결"로 명시 | `auth-change-password-oauth-only-code-split.md` 를 target 과 같은 턴/커밋에서 갱신하되(target 변경안 #13 이 이미 계획 중), **단순 체크박스 전환이 아니라 옵션 표 자체를 재작성**(예: "D. 기존 형제 코드 재사용(신규 코드 0)" 행 추가 또는 B 항목을 채택안으로 재작성) + `## 결정 기록` 절 신설로 "왜 B(권장안)를 거부했는가"를 남길 것 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이 CRITICAL 은 developer 턴에서 발견된 spec/ drift 류가 아니라, `--spec` 모드로
> 도는 이 검토 자체가 이미 project-planner 턴 안에서 실행되고 있다. 근본 원인(참조 plan 문서의
> "사용자 결정" 미기록·옵션 표 불일치)은 `plan/**` 영역에 있고 이는 project-planner 의 정규 쓰기
> 권한 범위다. 즉 이 CRITICAL 을 고칠 권한을 지금 이 턴이 이미 가지고 있으므로 인계 대상이 아니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | (없음) | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `1-auth.md §2.3` 재인증 note(`:337`)가 `changePassword` 를 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 새 발행처로 반영하지 않아, 이 draft 적용 후 "발행처 열거가 실제보다 좁은" — 이 PR 이 고치려는 결함과 동형인 — 문제를 새로 만듦 | 변경안 표 (항목 1~3, `1-auth.md` 대상 라인 `:339`/`:521`/`:750` 만 명시) | `spec/5-system/1-auth.md:337`("PASSWORD_INVALID 는 ... 동일 코드를 공유한다" 열거 문단) | 변경안 표에 `1-auth.md:337` 행 추가, 또는 `:339` 편집 시 `:337` 문장 말미에 상호 참조 덧붙이기 |
| 2 | rationale_continuity | 변경안 항목 #7 "4중 → wire **2종** + 감사값 1종"이 자기 인용한 "4중"(`INVALID_PASSWORD`·`PASSWORD_INVALID`·`PASSWORD_REQUIRED`·`REAUTH_REQUIRED`)과 산술이 맞지 않음 — `REAUTH_REQUIRED` 는 정렬 대상이 아니라 손대지 않으므로 wire 코드로 그대로 남아 "wire 3종"이어야 함(REAUTH_REQUIRED 누락) | 변경안 표 항목 #7 | `spec/5-system/3-error-handling.md` `## Rationale`(§1 카탈로그 완결성 종결 — "4중" 근접명명 원문) | "4중 → wire 3종(`PASSWORD_INVALID`·`PASSWORD_REQUIRED`·`REAUTH_REQUIRED`) + 감사값 1종(`INVALID_PASSWORD`)"로 정정하거나, 애초 3항목 클러스터였다면 "3중"으로 낮춰 통일 — 편집 직전 `grep` 재확인 |
| 3 | plan_coherence | target 변경안 #13 "사용자 결정(선택지 1) 기록 + 체크박스 전환"이라는 서술이 옵션 표 자체를 재작성해야 한다는 사실을 놓치게 할 위험(위 CRITICAL #1 과 직결) | `## 변경안` > plan 표 #13 | `auth-change-password-oauth-only-code-split.md` `## 할 일` | #13 서술에 "옵션 표를 채택안에 맞게 재작성"을 명시적으로 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `error-codes.md §5` 표가 처음으로 "구 코드 1개 → 조건별 대체 코드 2개" 형태를 갖게 되나 표 스키마는 이 shape 를 명시적으로 예상하지 않음 | 변경안 표 항목 10 | 새 행의 "대체 코드" 셀에 조건별 매핑을 `PASSWORD_REQUIRED`(미설정)/`PASSWORD_INVALID`(불일치) 처럼 조건과 함께 표기 |
| 2 | cross_spec | `error-codes.md §5` 표의 `PR` 열은 지금까지 "이미 병합된 구현"만 기록해왔는데, 이 draft 는 spec-first 라 승인 시점에 PR 값이 없음 | 변경안 표 항목 10 | PR 미정 상태 placeholder 명시(예: 계획 문서 링크) 또는 §5 행 추가를 developer 턴 완료 후로 미루는 대안 검토 |
| 3 | convention_compliance | §5 머리말 "코드베이스에서 완전 제거" 전제가 이 행에서 처음 깨짐(감사값으로 존속) — §5 에 아직 이런 "레이어가 다른 잔존값" 각주 선례가 없음 | "결정 ②" 절, 변경안 #10 | 등재 자체는 진행 무방. 여력 되면 §5 머리말에 `WORKER_HEARTBEAT_TIMEOUT` 류가 쓰는 "레이어가 다르다" 패턴의 caveat 한 문장 추가 |
| 4 | convention_compliance | §2 "의미 분기 시 새 코드 신설" 문구가 "형제 코드 재사용" 경로를 아직 명문화하지 않음 | "결정 ①" 단락 | target 수정 불요. §2 에 "동일 의미 코드가 형제 흐름에 이미 존재하면 신설 대신 채택" 문장 보강 검토(규약 문서 쪽) |
| 5 | naming_collision | 기각된 대안 `PASSWORD_NOT_SET` 이 이미 로그인 흐름의 `login_history.failure_reason` 감사값으로 존재(`auth.service.ts:330`) — 재도입 시 wire/audit 동명 충돌을 재생산했을 것이라는, 기각 결정을 더 강하게 뒷받침하는 사실이 문서화 안 됨 | 결정 ① Rationale | `auth-change-password-oauth-only-code-split.md` 의 "원안 폐기 이유" 또는 target 결정①에 한 줄 보강(blocking 아님) |
| 6 | plan_coherence | `error-codes.md`(§3·§5) 동시 편집 대상인 인접 in-progress plan `spec-conventions-engine-error-code-surface.md`(§Overview 대상)를 target 이 교차 인용하지 않음 — 절이 겹치지 않아 실질 충돌 가능성은 낮음 | 변경안 spec 표 #9~#11 | 낮은 우선순위: 필요시 한 줄 교차 인용 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `1-auth.md:337` 발행처 열거 미반영(WARNING) + §5 표 스키마 관행 이탈 2건(INFO). 인용 라인 전량 실측 일치 확인 |
| rationale_continuity | LOW | 근접 명명 "4중→wire 2종" 산술 불일치(WARNING, REAUTH_REQUIRED 누락). 3단계 이력 추적·등급 B 판정·§5 전제 예외 인지는 모범적으로 정확 |
| convention_compliance | NONE | CRITICAL/WARNING 없음. §5 첫 예외 케이스·§2 문구 여백 INFO 2건만 |
| plan_coherence | HIGH | 착수 근거 "사용자 결정"이 참조 plan 에 미기록 + 채택안이 A/B/C 어디에도 미해당(CRITICAL). #13 서술 리스크(WARNING). 인접 plan 미인용(INFO) |
| naming_collision | NONE | 신규 식별자 0개(설계 의도). 전수 grep 충돌 없음. `PASSWORD_NOT_SET` 감사값 선점 사실 미문서화(INFO, 기각 결정을 오히려 강화) |

## 권장 조치사항
1. **(BLOCK 해소 우선)** `plan/in-progress/auth-change-password-oauth-only-code-split.md` 의 `## 선택지` 표를 실제 채택안(신규 코드 0, 형제 코드 재사용)에 맞게 재작성하고 `## 결정 기록` 절을 신설해 "왜 B(권장 `PASSWORD_NOT_SET` 신설)를 거부했는가"를 명시. target 변경안 #13 을 "체크박스 전환"에서 "옵션 표 재작성 + 결정 기록 신설"로 구체화.
2. `1-auth.md:337` 재인증 note 에 `changePassword` 를 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 발행처로 반영(변경안 표에 행 추가).
3. 변경안 #7 "4중 → wire 2종" 산술을 재확인해 "wire 3종(`REAUTH_REQUIRED` 포함) + 감사값 1종"으로 정정하거나 시작 숫자를 "3중"으로 통일.
4. `error-codes.md §5` 신규 행에 조건별 코드 매핑을 조건과 함께 표기하고, PR 열 미정 상태에 대한 placeholder 정책을 명시.
5. (선택) §5 머리말 "레이어가 다르다" caveat 문장, §2 형제 코드 재사용 문구 보강, `PASSWORD_NOT_SET` 감사값 선점 근거 기록, `spec-conventions-engine-error-code-surface.md` 교차 인용 — 모두 non-blocking.
