# Rationale 연속성 검토 결과

## 검토 범위 메모

`prompt_file` 에는 실제 `diff` 블록(`## 구현 변경 사항`)이 포함되어 있지 않았다 (안내 문구만 있고 본문 없음). 대상 워크트리(`.claude/worktrees/suggestions-prefix-dry-0fae90`)에서 `git diff origin/main...HEAD -- spec/5-system/` 를 직접 확인한 결과도 **변경 없음** — 즉 `spec/5-system/1-auth.md`·`10-graph-rag.md` 는 이번 태스크의 diff 대상이 아니며, payload 는 두 문서의 스냅샷 전문 + 타 spec 의 관련 Rationale 발췌를 정적으로 담고 있다. 이에 따라 "diff 신규 도입분" 기준이 아니라 **target 문서 자체(및 그 자신의 `## Rationale`)의 내적 정합성**, 그리고 실제 코드(워크트리 절대경로 확인)와의 정합성을 기준으로 점검했다.

## 발견사항

- **[CRITICAL] §2.3 "강제 종료 재인증" 이 자신의 Rationale 1.1.B-4 가 명시한 invariant(`verifyReauth`=password OR TOTP 한정)를 정면 위반**
  - target 위치: `spec/5-system/1-auth.md` §2.3 세션 정책 표, "강제 종료 재인증" 행 — `"비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선) 를 따른다"`
  - 과거 결정 출처: 같은 문서 `## Rationale` → **1.1.B-4 — 이메일 변경 재인증은 이메일 OTP 를 배제 (§2.3 세션-revoke 재인증과 차등)**. 해당 항목은 "구현은 세션 강제 종료와 동일한 `SessionsService.verifyReauth`(**password OR TOTP**) 를 재사용한다. **WebAuthn 을 재인증 수단으로 쓰는 것은 challenge/response step-up 흐름이 필요해 `verifyReauth` 가 현재 미지원이며(§2.3 세션-revoke 와 동일 한계)**, 그 일반화는 `plan/complete/refactor-auth-reverify-unify.md` 영역이다" 라고 **명시적으로** 기록한다.
  - 상세: Rationale 1.1.B-4 는 "§2.3 세션-revoke 재인증 자체도 WebAuthn 을 지원하지 않는다"는 invariant 를 스스로 못박아 두었는데, 정작 §2.3 본문 표는 그 반대로 "TOTP 또는 WebAuthn" 그리고 "이메일 OTP" 로 대체 가능하다고 서술한다. 실제 코드로 교차 검증한 결과도 Rationale 쪽이 맞다:
    - `codebase/backend/src/modules/auth/dto/requests/revoke-session.dto.ts` — `RevokeSessionDto` 필드는 `password`·`totpCode` 두 개뿐. WebAuthn·이메일 OTP 관련 필드 없음.
    - `codebase/backend/src/modules/auth/sessions.service.ts` `verifyReauth()` (L244-289) — `hasPassword`/`has2fa`(TOTP) 두 분기만 존재. WebAuthn credential 카운트를 조회하는 코드도, 이메일 OTP 발급/검증 코드도 없음.
    - `revokeFamily`(개별 강제 종료, L74-108)·`revokeOtherFamilies`(전체 강제 종료, L128-138) 모두 이 `verifyReauth` 를 그대로 호출.
    - `plan/in-progress/spec-sync-auth-gaps.md` 는 "§1~§5 의 나머지 surface(...세션...)는 audit 재검증에서 모두 구현 확인됨" 이라 기록해 이 갭이 추적 대상으로도 잡혀 있지 않다 — 미검출 상태로 spec 에 잔존.
    - 부수적으로 "§1.4.2 의 우선순위(WebAuthn 우선)를 따른다" 인용도 잘못됐다 — §1.4.2 는 **로그인 challenge 방식 선택**(로그인 2FA 단계) 규칙이라 이 reauth 경로(`verifyReauth`)에는 애초에 적용되지 않는다.
  - 제안: (a) §2.3 표를 "비밀번호 재확인 필수. OAuth-only 사용자는 등록된 TOTP 로만 대체(2FA 미보유·WebAuthn-only 계정은 `REAUTH_NOT_AVAILABLE` — password/TOTP 설정 후 재시도)" 로 정정해 코드·Rationale 1.1.B-4 와 일치시키거나, (b) WebAuthn/이메일 OTP 지원을 실제로 의도한다면 이는 "결정의 번복"이므로 `verifyReauth` 확장 구현 + 신규 Rationale(예: 1.1.B-4 갱신 또는 별도 2.3.D 신설)을 반드시 동반해야 한다. 어느 쪽이든 현재 상태(본문·Rationale·코드 3자 불일치)로 두면 안 됨. `plan/in-progress/spec-sync-auth-gaps.md` 의 "세션 완전 구현 확인" 결론도 함께 정정 필요.

- **[INFO] `spec/5-system/10-graph-rag.md` 자체 `## Rationale` 섹션이 payload truncation 으로 미확인**
  - target 위치: `spec/5-system/10-graph-rag.md` (payload 내 §4 "검색 흐름" 이후 `... (truncated due to size limit) ...` 로 잘림)
  - 과거 결정 출처: 해당 문서 자체의 `## Rationale` (본 checker 에게 전달되지 않음)
  - 상세: `§2.2 본 문서 범위 밖`(Neo4j/community detection/rule-based 추출/KB 모드 사후 변경 기각)과 `§4 기술 결정 사항` 표까지는 확인했고 내적 모순은 발견하지 못했다. 다만 문서 하단의 `## Rationale` 절 전체를 받지 못해, 그 안에 있을 수 있는 기각된 대안·번복 여부는 이번 회차에서 완전히 검증하지 못했다.
  - 제안: 다음 회차 orchestrator 는 payload 크기 캡을 늘리거나 `10-graph-rag.md` 를 별도 payload 로 분리해 `## Rationale` 전문이 checker 에 도달하도록 조정 권장.

## 요약

`spec/5-system/1-auth.md`·`10-graph-rag.md` 는 대부분의 설계 결정이 `## Rationale` 에 근거 있게 정리되어 있고 (WebAuthn 우선 정책, 복구 코드 풀 분리, 초대 토큰 raw 저장, 비밀번호/이메일 변경 시 세션 revoke 범위 등) 타 spec 의 관련 Rationale(0-overview 의 Redis 큐·Flyway 채택 등)과도 충돌이 없다. 그러나 §2.3 "강제 종료 재인증" 본문이 문서 자신의 Rationale 1.1.B-4 가 명시적으로 선언한 invariant("`verifyReauth` 는 WebAuthn 미지원, §2.3 도 동일 한계")를 정면으로 위반하는 서술을 유지하고 있으며, 이는 실제 코드(`RevokeSessionDto`, `SessionsService.verifyReauth`)로도 반증된다 — Rationale-본문 간 정합성이 깨진 구체적 사례로, 추적 plan(`spec-sync-auth-gaps.md`)에도 잡히지 않은 미검출 드리프트다. Graph RAG 문서는 payload truncation 으로 자체 Rationale 을 완전히 확인하지 못한 잔여 리스크가 있다.

## 위험도

HIGH
