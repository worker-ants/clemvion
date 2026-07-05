# Cross-Spec 일관성 검토 — `spec/5-system/` (V-09 초대 수락 페이지, impl-done)

검토 모드: `--impl-done`. diff-base `origin/main`. 변경 범위: `accept-invitation-content.tsx` 재작성(§1.5.3 대로: 마운트 자동수락 → 토큰메타 조회 → 로그인 이메일==토큰 이메일이면 [수락] 버튼 / 불일치면 안내+로그아웃) + `register-form.tsx`(이미 로그인한 사용자를 `/invitations/accept?token=` 로 redirect) + `spec/5-system/1-auth.md`(frontmatter code 3건 추가, §1.5.3에 "경로·진입" 단락 추가) + i18n(ko/en) + 테스트. 직전 `--impl-prep` 검토(`review/consistency/2026/07/05/14_54_13/cross_spec.md`)가 지적한 CRITICAL("메일 링크가 항상 `/auth/register`로만 향하고 그 페이지에는 로그인 감지·redirect 로직이 없어 §1.5.3 흐름에 실사용자가 도달 불가")의 해소 여부를 중심으로 코드·spec 양쪽을 대조했다.

## 발견사항

- **[WARNING]** `spec/2-navigation/10-auth-flow.md` §2.6 이 register-form.tsx 의 신규 redirect 분기를 반영하지 않음 — code-owner 문서 갱신 누락
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 하단 신규 단락("경로·진입": "이미 로그인한 사용자가 이 링크로 진입하면 register 페이지가 로그인 상태를 감지해 위 수락 페이지로 리다이렉트한다")
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §2.6 "초대 토큰을 통한 가입" 표(1~7단계) — frontmatter `code:` 에 `codebase/frontend/src/components/auth/**`(register-form.tsx 포함)를 명시한 **register 페이지 자체의 code-owner 문서**이지만, 표 어디에도 "이미 로그인한 사용자는 accept 페이지로 redirect" 분기가 없다. §2.6 은 여전히 "미가입자가 메일 링크를 클릭하면" 이라는 전제로만 기술되어 있다.
  - 상세: 직전 impl-prep 검토(14_54_13/cross_spec.md WARNING/제안 2)가 "§2.6 문서에도 이 redirect 분기를 명시적으로 추가해야 한다"고 명시적으로 권고했으나, 이번 구현은 `1-auth.md` §1.5.3(및 frontmatter)만 갱신하고 `10-auth-flow.md` §2.6 은 그대로 두었다(diff 확인: `git diff origin/main...HEAD -- spec/2-navigation/10-auth-flow.md` 결과 없음). 두 문서가 같은 코드 파일(`register-form.tsx`)의 동일 동작을 서로 다른 시점 상태로 서술하는 drift 가 생겼다 — `10-auth-flow.md` 만 읽는 독자는 이미 로그인한 사용자가 초대 링크를 클릭했을 때 무슨 일이 일어나는지 알 수 없다.
  - 제안: `10-auth-flow.md` §2.6 표 앞(또는 표 내 0단계)에 "이미 로그인 상태 + 이메일 일치 시 `/invitations/accept?token=` 로 client-side redirect (§1.5.3 참고)" 한 줄을 추가해 두 문서를 동기화한다. 또는 `1-auth.md` §1.5.3 이 이 redirect 로직의 유일한 SoT임을 `10-auth-flow.md` §2.6 에서 포인터로 명시(중복 서술 대신 참조).

- **[INFO]** `code:` frontmatter 교차 소유 — `register-form.tsx`·`invitations.ts` 가 두 spec 문서에 동시 등재
  - target 위치: `spec/5-system/1-auth.md` frontmatter(신규): `codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/api/invitations.ts`
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` frontmatter(기존): `codebase/frontend/src/components/auth/**`(register-form.tsx 포함 glob) 및 `codebase/frontend/src/lib/api/invitations.ts`(동일 경로 명시적 중복)
  - 상세: 두 문서가 정의하는 내용 자체는 이번 검토 범위에서 모순되지 않지만(§2.6 이 §1.5.2/§1.5.3 을 참조 링크로 이미 인용하는 관례가 있음), `code:` 필드는 통상 "이 파일의 변경이 이 spec 과 관련됨"을 나타내는 커버리지 신호로 쓰인다. 동일 파일이 두 spec 의 code 목록에 중복 등재되면 향후 `spec-coverage` 감사·정합성 재검토 시 어느 문서가 이 파일의 1차 SoT 인지 모호해질 수 있다(다른 영역은 대체로 한 파일당 하나의 SoT 문서만 code 로 소유하는 관례를 따름).
  - 제안: 특별한 조치 불필요 — 다만 향후 register-form.tsx 관련 변경 시 두 spec 모두 검토 대상에 오르도록 리뷰 체크리스트에 유의. 원한다면 `1-auth.md` frontmatter 주석에 "register-form.tsx 는 §1.5.3 redirect 분기에 한정, 화면 전체는 `10-auth-flow.md` SoT" 같은 범위 한정 주석을 추가할 수 있음.

- **[INFO]** 이전 impl-prep CRITICAL 은 이번 구현으로 실질적으로 해소됨 (확인)
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 신규 단락 + `register-form.tsx` diff(`useAuthStore.getState().isAuthenticated` 감지 → `router.replace("/invitations/accept?token=...")`)
  - 충돌 대상: 없음 (참고용 확인 항목)
  - 상세: 14_54_13 검토가 지적한 "메일 링크가 §1.5.3 accept 페이지에 절대 도달하지 않는다"는 CRITICAL 은, 메일 링크 자체를 바꾸지 않고 register 페이지가 로그인 상태를 감지해 client-side redirect 하는 방식(제안 2)으로 해소됐다. `accept-invitation-content.tsx` 의 `token` query param 명명도 §1.5.3 신규 단락에서 명시적으로 `/invitations/accept?token=<초대토큰>` 으로 문서화되어 14_54_13 WARNING(param 이름 미문서화)도 함께 해소됐다.
  - 제안: 없음 — 위 WARNING(§2.6 미동기화)만 후속 정리 필요.

## 요약

이번 impl-done 구현은 직전 impl-prep 검토가 지적한 CRITICAL(초대 메일 링크가 §1.5.3 accept 흐름에 도달 불가)을 register-form.tsx 의 로그인 감지 redirect 로 실질적으로 해소했고, `1-auth.md` §1.5.3 에 진입 경로·query param 명명을 명시적으로 문서화해 관련 gap 도 함께 메웠다. 다만 이 redirect 로직이 실제로 위치하는 코드(`register-form.tsx`)의 원래 code-owner 문서인 `spec/2-navigation/10-auth-flow.md` §2.6 은 갱신되지 않아, register 페이지의 초대 흐름을 다루는 두 spec 문서(§1.5.3 vs §2.6) 사이에 서술 drift 가 남았다 — 기능적 모순(코드 오작동)은 아니지만 향후 §2.6 만 참조하는 개발자·리뷰어에게 이 분기가 보이지 않는 문서 불일치다. 데이터 모델·API 계약·RBAC·상태 전이·요구사항 ID 충돌은 발견되지 않았다.

## 위험도

LOW — 기능적으로 코드는 정상 동작하고 API/RBAC/상태 전이 충돌은 없다. 다만 §2.6 미동기화는 문서 신뢰성 저하로 이어질 수 있어 WARNING 수준의 후속 정리(§2.6 한 줄 추가)를 권고한다.
