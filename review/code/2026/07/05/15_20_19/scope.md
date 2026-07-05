# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** register-form.tsx 의 순수 포맷팅 변경 1건
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` diff 494~502행 (goDashboard 버튼)
  - 상세: `<Button variant="outline" onClick={...}>` 한 줄이었던 JSX 를 3줄로 줄바꿈만 한 변경. 이 버튼(`goDashboard`)은 이번 작업(§1.5.3 수락 확인 UI + register redirect)의 상태 분기와 무관한 기존 error 상태 코드다. 기능 변경 없이 개행만 발생했다.
  - 제안: 실질 영향 없는 수준(prettier 자동 정렬로 보임)이라 위험도는 낮으나, 굳이 손댈 필요가 없었던 인접 코드다. 리뷰 관점에서는 "무관한 포맷팅 혼입"으로 기록만 하고 별도 조치는 불필요.

- **[INFO]** register-form.tsx 에 로그인 사용자 리다이렉트 로직 추가는 `SUMMARY.md`에 근거된 의도적 스코프 확장
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` (신규 `useEffect` 블록, invitationToken + isAuthenticated 감지 → `/invitations/accept` redirect)
  - 상세: 최초 요청 범위는 "초대 수락 확인 UI(§1.5.3) 재작성"으로 보이나, `review/consistency/2026/07/05/14_54_13/SUMMARY.md`가 impl-prep 단계에서 cross_spec CRITICAL(진입 경로 부재)을 발견했고, 사용자 결정(2026-07-05)으로 register redirect 를 스코프에 명시적으로 포함시켰다. 즉 파일상으로는 "추가 수정"처럼 보이지만 정식 문서화된 스코프 확장이며 `spec/5-system/1-auth.md` §1.5.3 에도 대응 문구가 함께 갱신되어 spec-코드 정합이 유지된다.
  - 제안: 조치 불필요. 다만 이 판단의 근거가 `review/consistency/**` 산출물에만 있으므로, PR 설명/커밋 메시지에도 "register redirect 포함은 impl-prep cross_spec CRITICAL 대응(사용자 결정)"이라는 취지를 남겨 두는 것이 추후 스코프 감사 시 유용하다.

- **[INFO]** `review/consistency/2026/07/05/14_54_13/**` 산출물이 코드 변경과 같은 커밋/PR 범위에 포함
  - 위치: `review/consistency/2026/07/05/14_54_13/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 프로젝트 규약상 `consistency-check --impl-prep` 산출물은 `review/consistency/**`에 남기는 것이 정상 워크플로다(코드 리뷰어는 `review/code/**`만 쓴다). 이 파일들은 코드 변경이 아니라 착수 전 검토 로그이므로 "무관한 파일 수정"이 아니라 절차상 필수 동반 산출물이다.
  - 제안: 별도 조치 불필요. 정상 범위로 판단.

- **[INFO]** `spec/5-system/1-auth.md` frontmatter `code:` 목록 갱신 + §1.5.3 경로 설명 1단락 추가
  - 위치: `spec/5-system/1-auth.md` frontmatter(3개 code 경로 추가) 및 §1.5.3 인용구 1단락
  - 상세: 새로 추가된 프론트엔드 코드 경로(`invitations/accept/**`, `register-form.tsx`, `lib/api/invitations.ts`)를 spec frontmatter 에 매핑하고, register redirect 진입 경로를 문서화한 것으로 코드 변경과 1:1 대응한다. `plan_coherence.md`(WARNING)가 "frontmatter code 매핑 부재 → 구현 동반 추가"를 지적했고 이번 diff 로 해소된 것으로 보인다.
  - 제안: 조치 불필요.

## 요약

핵심 코드 diff(4개 tsx/ts 파일 + 2개 i18n 사전 + 1개 spec 파일)는 "§1.5.3 초대 수락 확인 UI 재작성 + register 리다이렉트 진입 경로"라는 하나의 정합된 목표로 수렴하며, 불필요한 리팩토링·무관한 기능 확장·임포트 정리·주석 오염은 발견되지 않았다. register-form.tsx 에 추가된 리다이렉트 로직은 최초 요청보다 넓어 보이지만 `review/consistency/**` SUMMARY 에 사용자 결정으로 명시적으로 기록된 정당한 스코프 확장이며, spec 문서도 함께 갱신되어 spec-코드 정합이 유지된다. 유일한 순수 포맷팅성 변경(goDashboard 버튼 줄바꿈)은 무시할 수준이다. `review/consistency/**` 산출물 동반은 정상 워크플로 절차이지 무관한 파일 수정이 아니다.

## 위험도

NONE
