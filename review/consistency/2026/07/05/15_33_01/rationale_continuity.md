# Rationale 연속성 검토 결과

## 검토 대상

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 실 target: 이번 배치가 실질적으로 건드린 영역은 `spec/5-system/1-auth.md` §1.5.3(초대 토큰 흐름 — 이미 가입한 사용자 경로) 및 그 코드 구현(`codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`, `codebase/frontend/src/components/auth/register-form.tsx`). 프롬프트 payload 에 실린 `10-graph-rag.md` 전문과 다수 무관 spec 의 Rationale 발췌는 이번 diff 범위 밖이라 본 검토에서는 실제 diff(`git diff origin/main`)를 1차 근거로 대조했다.
- 이전 라운드 참고: `review/consistency/2026/07/05/14_54_13/cross_spec.md` 가 --impl-prep 단계에서 CRITICAL("초대 메일 링크가 §1.5.3 accept 페이지로 절대 도달하지 않음")을 발행했고, `review/code/2026/07/05/15_20_19/requirement.md` 가 이번 구현으로 그 CRITICAL 이 해소됐다고 확인했다. 본 검토는 그 해소가 과거 Rationale 과 정합하는지, 그리고 해소 과정에서 새로 도입된 결정에 합당한 근거가 남았는지를 점검한다.

## 발견사항

### [INFO] CRITICAL 해소 방식은 cross_spec 이 제시한 "옵션 2"이며 §1.5.A(마찰 최소화)·Rationale 1.5.B 원칙과 상충하지 않음
- target 위치: `codebase/frontend/src/components/auth/register-form.tsx`(신규 `useEffect` — `invitationToken` && `isAuthenticated` 시 `/invitations/accept?token=` 로 `router.replace`), `spec/5-system/1-auth.md` §1.5.3 신규 인용문(diff L264-266)
- 과거 결정 출처: `review/consistency/.../14_54_13/cross_spec.md` CRITICAL 의 제안 목록 — "2. `/auth/register` 페이지 자체가 분기"
- 상세: 이번 구현은 제안된 3가지 대안(①메일 발송 시점 이원화 ②register 페이지 자체 분기 ③follow-up 으로만 남김) 중 ②를 채택했다. 이는 §1.5.A(가입 시 이메일 일치 강제 — "다른 이메일로 가입하고 싶은 경우는 일반 회원가입 경로를 따로 거치게 되므로 안내가 단순함")의 정신과 상충하지 않는다 — register 폼은 여전히 미가입자 전용이고, 기가입자는 폼 렌더 전에 리다이렉트되어 §1.5.2 의 prefill+readOnly 흐름(정상 사용자 마찰 최소화 대상)을 그대로 유지한다. 기각된 대안 ①(메일 이원화)은 cross_spec 자신이 "초대 발송~클릭 사이 계정 상태가 바뀔 수 있어 완전한 해법이 아니다"로 이미 부분 기각했던 것과 일치하는 선택이라 번복이 아니다.
- 제안: 없음 — 확인 결과로 기록.

### [WARNING] `spec/2-navigation/10-auth-flow.md` §2.6 이 신규 리다이렉트 분기를 반영하지 않아, §1.5.3 신규 각주와 인접 문서 간 비대칭 발생
- target 위치: `spec/5-system/1-auth.md` §1.5.3 신규 각주("register 페이지가 로그인 상태를 감지해 위 수락 페이지로 리다이렉트한다") vs `spec/2-navigation/10-auth-flow.md` §2.6("미가입자가 메일 링크를 클릭하면 회원가입 페이지는 `?invitationToken=…` 쿼리를 받아 다음 처리를 수행한다" — 이미 로그인한 사용자 케이스 언급 없음)
- 과거 결정 출처: `review/consistency/.../14_54_13/cross_spec.md` WARNING 2번째 항목이 이미 "이 이름(§1.5.3 진입 경로)이 spec 문서에 없다는 것 자체가 향후 재구현자·리뷰어가 임의로 param 이름을 바꿀 위험을 남긴다"고 지적하며 §1.5.3 본문 갱신을 권고했음
- 상세: 이번 배치는 그 권고대로 `1-auth.md` §1.5.3 에 각주를 추가했으나, register 페이지의 SoT 인 `10-auth-flow.md` §2.4("처리 플로우")·§2.6("초대 토큰을 통한 가입")은 갱신되지 않았다. §2.6 은 여전히 "**미가입자**가 메일 링크를 클릭하면" 이라는 전제로만 기술되어 있어, register-form.tsx 에 실제로 존재하는 "기가입자 감지 → accept 페이지 redirect" 분기가 이 문서에서는 드러나지 않는다. Rationale 자체의 기각·번복은 아니지만, 동일 결정(§1.5.3 각주가 명문화한 리다이렉트)이 인접 SoT 문서에는 미러링되지 않아 향후 `10-auth-flow.md` 만 보고 작업하는 사람이 이 분기의 존재를 놓칠 위험이 남는다(과거 memory 기록의 "spec banner flip 시 본문 미러 stale 함께 잡을 것" 교훈과 동형의 패턴).
- 제안: `10-auth-flow.md` §2.4 3번째 스텝 또는 §2.6 상단에 "이미 로그인 && 이메일 일치 시 `/invitations/accept?token=` 로 client-side redirect(§1.5.3 참고)" 한 줄 추가.

### 자기정합성 확인 (참고, 문제 없음)

- **§1.5.3 로그아웃 버튼 노출** — diff 의 `handleLogout`(서버 `authApi.logout()` 실패를 swallow 하고 클라이언트 세션만 정리 후 `/login` 이동)은 §1.5.3 본문("불일치 시... 로그아웃 버튼만 노출")을 그대로 구현한다. §2.3 세션 정책의 "logout → 호출 디바이스 family 전체 revoke" 원칙과 별도 충돌 없음 — 서버 실패 시에도 클라이언트 측 access token 제거는 §2.3 이 규정하는 서버측 revoke 실패와는 다른 계층이며, spec 이 이 세부 fallback 을 규정하지 않는 회색지대다(code review `requirement.md` 도 동일하게 조치불요 판정).
- **이메일 일치 강제(§1.5.A)** — 신규 `status: "mismatch"` 분기는 로그인 사용자 이메일과 토큰 이메일을 비교해 불일치 시 수락을 차단한다. 이는 Rationale 1.5.A 의 "토큰 이메일 ≠ 가입/로그인 사용자 이메일인 경우 가입·accept 를 모두 차단" 원칙과 완전히 일치하며 서버측 이메일 일치 강제(400 `invitation_email_mismatch`)의 클라이언트측 사전 안내로 기능한다 — 서버 재검증이 여전히 최종 방어선이라는 전제도 code review `security.md`(NONE)로 확인됨.
- **토큰 메타 조회 재사용(`invitationsApi.getByToken`)** — §1.5.2(가입 prefill)와 §1.5.3(accept 확인) 양쪽이 동일 `GET /api/invitations/:token` 응답 shape(`InvitationMeta`)을 공유하는 것은 Rationale 어디에도 금지되지 않으며, 오히려 API 표면 단일화 원칙과 부합한다.
- **`fetchedRef`/`cancelled` cleanup 패턴** — code review WARNING(#1)로 지적되고 이미 조치된 사항으로, register-form 의 기존 패턴을 그대로 재사용한 것이라 새로운 설계 원칙 도입이 아니다.

## 요약

이번 배치는 --impl-prep 단계에서 발견된 CRITICAL(초대 메일 링크가 §1.5.3 accept 페이지에 도달하지 못함)을, cross_spec 이 제시한 대안 중 "register 페이지 자체의 로그인 감지 분기"로 해소했고 그 결정을 `1-auth.md` §1.5.3 각주로 정확히 기록했다. 이 해소 방식은 과거 Rationale(§1.5.A 마찰 최소화, 1.5.D 위협모델 구분 등)이 정한 원칙과 상충하지 않으며, 기각된 대안을 이유 없이 재도입한 사례도 없다. 다만 같은 결정이 인접 SoT 문서인 `10-auth-flow.md` §2.4/§2.6 에는 미러링되지 않아, "기가입자 register 링크 진입 시 리다이렉트" 라는 신규 확정 사실이 그 문서만 보는 독자에게는 여전히 드러나지 않는 상태로 남아 있다 — Critical 급 모순은 아니나 문서 간 비대칭을 방치하면 향후 재구현·리뷰 시 동일 갭이 재발할 소지가 있다.

## 위험도

LOW
