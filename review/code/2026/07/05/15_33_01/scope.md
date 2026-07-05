# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** `register-form.tsx` 의 로그인 사용자 리다이렉트 추가는 최초 요청 범위보다 넓어 보이나, 문서화된 정당한 스코프 확장
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` (신규 `useEffect` — `invitationToken` + `isAuthenticated` 감지 → `/invitations/accept?token=` `router.replace`), 대응 테스트 `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx`
  - 상세: 작업명(`invite-accept-confirm-ui`)과 plan V-09 항목의 원 지적은 "accept 페이지의 자동수락 UX"에 한정되지만, 이번 diff 는 `register-form.tsx` 에도 새 진입 경로 로직을 추가한다. 다만 이는 `review/consistency/2026/07/05/14_54_13/cross_spec.md` 가 --impl-prep 단계에서 발견한 CRITICAL("초대 메일 링크가 §1.5.3 accept 페이지에 절대 도달하지 않음 — register 페이지엔 로그인 감지·리다이렉트 로직 부재")에 대한 대응이며, `review/consistency/2026/07/05/14_54_13/SUMMARY.md` 에 "확정 스코프(진입 경로 포함)"로 명시, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-09 항목 갱신문에도 "**진입 경로**(impl-prep cross_spec CRITICAL)" 로 근거가 남아 있다. `spec/5-system/1-auth.md` §1.5.3 에도 "경로·진입" 문단이 동반 추가되어 spec-코드 정합이 유지된다. 절차상 근거가 명확한 확장이라 scope creep 으로 보기 어렵다.
  - 제안: 조치 불요. 이미 plan/consistency 문서에 근거가 남아있어 추가 조치 없이도 감사 추적 가능.

- **[INFO]** `review/code/2026/07/05/15_20_19/**` + `review/consistency/2026/07/05/14_54_13/**` 신규 파일 다수(총 20개)가 코드 diff 와 같은 changeset 에 포함
  - 위치: `review/code/2026/07/05/15_20_19/{SUMMARY.md,RESOLUTION.md,_retry_state.json,meta.json,documentation.md,maintainability.md,requirement.md,scope.md,security.md,testing.md,user_guide_sync.md}`, `review/consistency/2026/07/05/14_54_13/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 이 파일들은 코드 변경이 아니라 이전 `/ai-review`(15_20_19) 및 `consistency-check --impl-prep`(14_54_13) 세션의 산출물이다. CLAUDE.md 규약상 코드 리뷰/일관성 검토 산출물은 `review/code/**`·`review/consistency/**` 에 저장하도록 명시되어 있고, 프로젝트 메모(`plan 체크박스 = 실제 상태`)에도 "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋" 이라고 기록되어 있어 정상 워크플로 산출물이다. 무관한 파일 혼입이 아니라 절차상 필수 동반 커밋으로 판단된다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 갱신은 이번 구현 완료를 반영하는 적절한 범위
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35, L60-66 (V-09 `[ ]` → `[x]` 전환 + 완료 요약)
  - 상세: 구현 완료 후 plan 체크박스를 갱신하는 것은 developer 워크플로의 표준 의무이며, 이번 작업(V-09)에 정확히 대응하는 단일 항목만 수정되어 있어(다른 V-* 항목은 그대로 잔류 표시 유지) 범위를 벗어난 plan 편집은 없다.
  - 제안: 조치 불요.

- **[INFO]** 순수 포맷팅성 변경 없음(1건 후보였던 register-form.tsx goDashboard 버튼 줄바꿈은 이번 diff 범위 밖)
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx`
  - 상세: 이전 세션의 `scope.md`(`review/code/2026/07/05/15_20_19/scope.md`)가 "goDashboard 버튼 JSX 줄바꿈"을 INFO 로 기록했으나, 이는 `accept-invitation-content.tsx` 파일(파일 2)의 변경이며 이번 diff 대상인 `register-form.tsx` 파일(파일 4)에는 해당 변경이 나타나지 않는다. `accept-invitation-content.tsx` 의 `goDashboard` 버튼 줄바꿈(diff L389-398)은 실질 로직 변경(missing/error 상태 블록 조정) 과 인접해 있어 순수 포맷팅만 분리하기 어려운 경미한 수준이며, 이미 이전 리뷰에서 INFO 로 포착되어 조치 불요 판정이 난 사안이다. 재확인 결과 추가 지적 사항 없음.
  - 제안: 조치 불요.

- **[INFO]** i18n 사전 변경(en/ko)은 이번 UI 변경에 정확히 대응하는 신규 키만 추가
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/invitations.ts`, `codebase/frontend/src/lib/i18n/dict/ko/invitations.ts` (`mismatchTitle`/`mismatchHint`/`logoutAndSwitch` 3키)
  - 상세: 기존 키 삭제·수정 없이 신규 UI 상태(mismatch)에 필요한 키만 양쪽 로케일에 parity 있게 추가되어 있다. 무관한 사전 항목 정리나 리네이밍은 없음.
  - 제안: 조치 불요.

## 요약

핵심 변경(파일 1~6: `accept-invitation-content.tsx`+test, `register-form.tsx`+test, i18n en/ko)은 "§1.5.3 초대 수락 확인 UI 재작성 + 그 진입 경로(register 리다이렉트)"라는 단일 목표로 수렴하며, 요청 범위를 벗어난 리팩토링·기능 확장·무관한 파일 수정·불필요한 임포트/주석 변경은 발견되지 않았다. `register-form.tsx` 리다이렉트 추가는 표면적으로는 스코프 확장처럼 보이지만 impl-prep 단계 cross_spec CRITICAL 발견에 대한 문서화된(consistency SUMMARY·plan 갱신·spec 갱신) 대응이라 정당하다. 나머지 파일(plan 갱신, 다수의 `review/code/**`·`review/consistency/**` 신규 파일, `spec/5-system/1-auth.md` frontmatter/본문 갱신)은 모두 프로젝트 표준 워크플로가 요구하는 동반 산출물이며 코드 변경과 무관한 영역을 건드리지 않는다. 전체적으로 스코프 이탈 징후는 없다.

## 위험도

NONE
