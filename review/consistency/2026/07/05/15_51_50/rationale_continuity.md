# Rationale 연속성 검토 결과

## 검토 대상

- 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- FOCUS: 이전 라운드(`review/consistency/2026/07/05/15_33_01/rationale_continuity.md`)가 지적한 WARNING — `spec/2-navigation/10-auth-flow.md` §2.6 이 `spec/5-system/1-auth.md` §1.5.3 신규 각주(로그인 사용자 register 진입 시 accept 페이지 리다이렉트)를 미러링하지 않던 문제 — 가 이번 배치에서 §2.6 신규 각주로 조치되었는지, 그리고 그 조치 및 `has_session` 힌트 쿠키 기반 판정 로직이 기존 auth-state Rationale 과 정합하는지를 확인.
- 실제 diff 근거: `git diff origin/main`(워크트리 절대경로 기준) — `spec/2-navigation/10-auth-flow.md`(+2줄, §2.6 각주), `spec/5-system/1-auth.md`(frontmatter code 매핑 + §1.5.3 각주, 이번 배치가 아닌 이전 커밋 `b477913c2`에서 이미 반영됨), `codebase/frontend/src/components/auth/register-form.tsx`(`has_session` 쿠키 감지 `useEffect` 신설), `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`(자동수락→[수락]버튼 재작성, 이전 커밋에서 이미 반영).

## 발견사항

### [정보 확인] 이전 WARNING(§2.6 미러 누락)은 이번 배치의 §2.6 각주로 해소됨 — 정합
- target 위치: `spec/2-navigation/10-auth-flow.md` §2.6 상단 신규 인용문(diff 참조: `> **이미 로그인한 사용자의 진입 분기**...`)
- 과거 결정 출처: `review/consistency/2026/07/05/15_33_01/rationale_continuity.md` [WARNING] — "`10-auth-flow.md` §2.4 3번째 스텝 또는 §2.6 상단에 '이미 로그인 && 이메일 일치 시 `/invitations/accept?token=` 로 client-side redirect(§1.5.3 참고)' 한 줄 추가" 제안
- 상세: 이번 diff 는 정확히 그 제안대로 §2.6 상단에 각주를 추가했다. 각주는 (a) 진입 분기 조건(초대 메일 링크 → register 페이지, 로그인 사용자면 accept 페이지로 리다이렉트), (b) `(auth)` 라우트 그룹에 세션 하이드레이션이 없어 클라이언트 스토어로 감지 불가하다는 제약, (c) 그 대안으로 `has_session` 힌트 쿠키를 사용한다는 메커니즘, (d) stale 힌트(쿠키만 남고 refresh 만료)에 대한 방어(accept 페이지 라우트 가드가 로그인 화면으로 되돌림)까지 `1-auth.md` §1.5.3 각주 및 `register-form.tsx` 코드 주석과 완전히 대응한다. 인접 SoT 문서 간 비대칭은 해소되었다.
- 제안: 없음 — 확인 완료.

### [정보 확인] `has_session` 쿠키를 진입 판정에 재사용하는 것은 §7.1 기존 Rationale(비-인증 UX 힌트)과 완전히 일치 — 새 invariant 우회 없음
- target 위치: `spec/2-navigation/10-auth-flow.md` §2.6 신규 각주 vs 동일 문서 §7.1("`has_session` 은 **인증 수단이 아닌 UX 용 힌트 쿠키**다..."), `codebase/frontend/src/components/auth/register-form.tsx` 신규 `useEffect`(`document.cookie` 에서 `has_session=1` 존재 여부로 리다이렉트 판단)
- 과거 결정 출처: `spec/2-navigation/10-auth-flow.md` §7.1 기존 Rationale 문단 — "API 가 cross-domain 이라 Next 서버 미들웨어가 백엔드 세션을 직접 알 수 없으므로... non-httpOnly 쿠키 `has_session=1`... 을 set... 실제 인가 판정은 항상 토큰(계층 2 + API 401)이 담당한다"
- 상세: §2.6 신규 각주는 §7.1 이 이미 정의한 동일 쿠키·동일 목적(서버가 직접 세션을 알 수 없는 cross-domain 제약 우회용 UX 힌트)을 **재사용**한다. 새로운 인증 판정 경로를 발명하지 않았고, "실제 인가는 항상 토큰이 담당" 이라는 §7.1 의 invariant 도 그대로 유지된다 — register-form 의 리다이렉트는 인가 결정이 아니라 단순 UX 라우팅(로그인 사용자를 register 폼 대신 accept 페이지로 안내)이며, accept 페이지 진입 후 최종 인가는 여전히 `AuthProvider`(계층 2)가 담당한다고 각주 스스로 명시한다("힌트가 stale 이면... 라우트 가드가 정상적으로 로그인 화면으로 되돌린다"). 기각된 대안의 재도입이나 합의 원칙 위반이 아니다.
- 제안: 없음 — 확인 완료.

### [정보 확인] 자동수락→[수락]버튼 전환은 spec 결정 번복이 아니라 code→spec 정합화(V-09) — 새 Rationale 불요
- target 위치: `spec/5-system/1-auth.md` §1.5.3 스텝 2("로그인되어 있고... 일치 → 수락 페이지에 **[수락] 버튼** 노출") — 이 문구 자체는 `origin/main` 이전 커밋(`b477913c2`, V-09)에서 이미 확정되어 이번 diff 범위(`origin/main` 대비)에는 포함되지 않음. `accept-invitation-content.tsx` 의 자동 accept→명시적 버튼 재작성도 동일 이전 커밋에서 완료.
- 과거 결정 출처: `spec/5-system/1-auth.md` §1.5.3 (SoT, 코드보다 선행하는 계약)
- 상세: 커밋 로그(`b477913c2 fix(invitations): V-09 초대 수락 확인 UI (자동수락→[수락]버튼)...`)를 확인한 결과, 이 변경은 spec §1.5.3 이 이미 요구하던 "[수락] 버튼 노출" 계약과 코드(구버전 자동 accept)의 불일치를 코드 쪽에서 바로잡은 spec-code-cross-audit V-09 조치다. 즉 spec 의 결정을 코드가 뒤집은 것이 아니라, 코드가 spec 을 따라잡은 것이라 "결정의 무근거 번복"에 해당하지 않는다. Rationale 1.5.A("이메일 일치 강제 + prefill 로 마찰 최소화")와도 상충하지 않는다 — 신설된 confirm 버튼은 이메일 불일치 시 즉시 차단·안내라는 §1.5.A 정신을 그대로 따르고, 일치 시 단일 버튼 클릭만 요구해 과도한 마찰을 추가하지 않는다(이전 라운드 15_33_01 이 이미 이 정합성을 INFO 로 확인).
- 제안: 없음 — 확인 완료.

## 자기정합성 확인 (참고)

- `1.5.A`(이메일 일치 강제), `1.5.B`(시스템 SMTP 전용), `1.5.C`(7일 만료), `1.5.D`(raw 토큰 저장) 등 `1-auth.md` 의 기존 Rationale 항목 전체는 이번 diff 로 인해 재기술되거나 훼손되지 않았다 — 이번 diff 는 §1.5.3 각주(신규 추가)와 frontmatter code 매핑만 건드린다.
- `10-auth-flow.md` 의 나머지 Rationale(R-1 배경 그래디언트, R-2 로고 변종)도 이번 변경 범위 밖이며 영향 없음.

## 요약

FOCUS 로 지목된 이전 WARNING(§2.4/§2.6 미러 누락)은 이번 배치의 `10-auth-flow.md` §2.6 신규 각주로 정확히 조치되었으며, 그 각주는 `1-auth.md` §1.5.3 각주·`register-form.tsx` 코드 주석과 문구 수준까지 대응해 문서 간 비대칭이 해소되었다. `has_session` 힌트 쿠키를 진입 분기 판정에 사용하는 것은 §7.1 이 이미 확정한 "비-인증 UX 힌트, 최종 인가는 항상 토큰" invariant 를 그대로 재사용한 것이라 새로운 메커니즘 도입이나 합의 원칙 위반이 아니다. 자동수락→[수락]버튼 전환은 spec 결정의 번복이 아니라 code 가 이미 확정된 §1.5.3 계약(V-09)을 뒤늦게 따라잡은 조치이므로 별도 신규 Rationale 이 필요하지 않다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
