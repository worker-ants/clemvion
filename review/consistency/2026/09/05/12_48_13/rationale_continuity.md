# Rationale 연속성 검토 — `spec/5-system/`

## 검토 범위와 방법

`--impl-prep spec/5-system/` 번들에서 전문이 실린 3개 문서(`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`)를 전수 대조했다. 나머지 15개 파일은 컨텍스트 예산 초과로 헤더만
실렸으므로 "본문 부재"를 결함 부재의 근거로 삼지 않고, 교차 참조가 몰린 `spec/data-flow/12-workspace.md`
는 실제 저장소 파일을 `Read` 로 직접 열어 대조했다(2150~3530행의 "관련 Rationale 발췌" 섹션에는
그 파일 본문이 실리지 않았다). `git log`/`git show` 로 최근 변경 이력(가장 최근 커밋
`7979d7daf`, `#1280`)도 함께 확인해 이미 어떤 정정이 반영됐는지 파악했다.

## 발견사항

- **[INFO]** §7 Rate Limiting 표의 "인증 API (IP 기준)" 행과 표 아래 각주("인증 보호 라우트의
  제한은 사용자 기준")가 문면만 보면 상충하는 것처럼 읽힌다
  - target 위치: `spec/5-system/2-api-convention.md` §7 표 2번째 행("인증 API | 10 req/min
    (IP 기준)") 및 바로 아래 "표의 범위" 각주
  - 과거 결정 출처: 같은 문서 §7 각주 자체(2026-06-27, `#719` 도입) — `UserThrottlerGuard.getTracker`
    가 인증된 요청은 `user:<sub>`, 미인증 요청만 IP 로 폴백한다는 서술
  - 상세: 실제 구현(`codebase/backend/src/common/guards/user-throttler.guard.ts`)을 확인하면
    모순이 아니다 — "인증 API" 행은 로그인·회원가입처럼 **인증 이전** 단계의 엔드포인트(`@Public`)를
    가리키므로 `getTracker` 가 IP 로 폴백하는 것이 맞고, 각주의 "인증 보호 라우트"(= 로그인 이후
    JWT 로 보호되는 라우트, 즉 표의 "일반 API"·"Provider probe"·"KB 재임베딩"·"초대 발송" 행들)는
    `user:<sub>` 기준이 맞다. 즉 "인증 API"(authentication endpoints)와 "인증 보호"(protected-by-
    authentication)가 같은 "인증" 이라는 단어를 다른 의미로 겹쳐 써서 생기는 **표기상** 혼선이며,
    Rationale 이 뒤집히거나 기각된 대안이 재도입된 것은 아니다.
  - 제안: 각주에 "(로그인·회원가입 등 `인증 API` 행 자체는 미인증 상태라 IP 폴백 대상, 그 외
    JWT 보호 라우트가 사용자 기준)" 한 구절만 추가하면 다음 사람이 표와 각주를 재조사 없이
    바로 이해한다. 결정 자체는 손대지 않는 순수 명확화 제안이라 INFO 로 남긴다.

그 외에는 다음을 포함해 기각된 대안의 무단 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant
우회 사례를 찾지 못했다.

- `1-auth.md §Rationale` 이 명시적으로 기각한 패턴(예: "라우트별 opt-in 마커", "비밀번호 재설정 시
  현재 family 만 제외한 revoke", "WebAuthn counter 역행 시 suspend", "이메일 변경 재인증에 이메일
  OTP", "계정 잠금 이메일 알림 부활") 은 본문 어디에도 재도입되지 않았고, 본문(§1.1·§1.4·§2.3)이
  실제로 그 기각 결과(예: `verifyReauth` = password OR TOTP 한정, counter 역행 시 즉시 삭제)를
  그대로 반영하고 있다.
- `2-api-convention.md`·`3-error-handling.md` 의 최근 정정(§5.4 스코프 명시, §2.2 "자원 액션"
  재명명, §1.4 앵커 열 추가, `410` 기본값 미제공 등)은 모두 실측 근거와 "기각한 대안" 절을 동반한
  Rationale 신설/개정 패턴을 따르고 있어 CLAUDE.md/교훈 문서가 요구하는 "번복 시 새 Rationale
  동반" 원칙에 부합한다.
- `data-flow/12-workspace.md` 를 직접 열어 대조한 결과, `1-auth.md`/`2-api-convention.md`/
  `3-error-handling.md` 가 인용하는 "UUID 검증 강도 비대칭", "멤버십 검증은 가드 1곳에서",
  "workspace.deleted 감사 제외", "header-first 전환기" 등의 서술은 실제 Rationale 원문과 문구·
  결론이 모두 일치한다 — target 이 그 문서의 결정을 왜곡·재해석하지 않았다.
- RBAC 매트릭스(§3.2 "멤버 관리" Admin=CRUD), `ACCOUNT_LOCKED` 401(423 아님), `INVALID_PASSWORD`
  wire 은퇴, `change-password` 실패 코드 정렬(2026-09-03 자기반증형 소정정 — CLAUDE.md 예외 조건에
  부합하는 형태로 취소선 보존 + 실측 근거 병기) 등 최근 정정 사항은 각 절의 본문·Rationale·카탈로그
  세 곳이 서로 어긋나지 않는다.

## 요약

전문이 실린 3개 문서는 자체 `## Rationale` 및 `spec/data-flow/12-workspace.md` 등 교차 참조
문서의 기존 결정과 충돌하지 않는다. 기각된 대안(opt-in 마커, WebAuthn suspend, 이메일 OTP 재인증,
전 세션 유지 등)이 재도입된 자리가 없고, 최근 결정 번복(§2.2 재명명, §5.4 스코프 명시, §1.4 앵커
열, `change-password` 코드 정렬)은 모두 실측 근거와 "기각한 대안" 문단을 동반해 CLAUDE.md 가
요구하는 절차를 지켰다. 유일하게 표시할 만한 사항은 §7 Rate Limiting 표와 각주 사이의 표기상
모호함(실제로는 모순 아님)뿐이며 INFO 로 하향해 기록한다.

## 위험도

NONE
