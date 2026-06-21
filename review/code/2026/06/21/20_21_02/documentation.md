# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `resendEmailChange` — `clearPendingEmailChange` 롤백 누락에 대한 주석 없음
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `resendEmailChange` 메서드
- 상세: `requestEmailChange` 는 메일 발송 실패 시 `clearPendingEmailChange` 롤백을 수행하며 해당 주석이 추가됐다(W6/W9 resolution). 그러나 `resendEmailChange` 의 동일한 메일 발송 실패 경로에는 롤백을 의도적으로 생략한다는 설명이 없다. 독자가 왜 두 메서드의 실패 처리 방식이 다른지 이해하기 어렵다. (resend 의 경우 pending 이 이미 있어야 호출 가능하므로 롤백보다 재시도를 유도하는 것이 올바른 설계이지만, 이 의도가 코드에서 명시되지 않는다.)
- 제안: `resendEmailChange` 의 `sendEmailChangeVerification` 호출 직전에 `// 발송 실패 시 pending 필드는 그대로 유지 — 재시도(resend 재호출)로 해소 가능.` 주석 한 줄 추가.

---

### [INFO] `clearPendingEmailChange` private 헬퍼에 JSDoc 없음
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `clearPendingEmailChange` 메서드
- 상세: `cancelEmailChange`(public API)와 `requestEmailChange` 롤백 경로, `verifyEmailChange` race condition 처리, 이렇게 세 곳에서 호출되는 핵심 헬퍼다. 세 호출 맥락(정상 취소 / 오류 롤백 / 경쟁 조건 정리)이 모두 다르므로, 해당 메서드가 "어떤 필드를 NULL 로 정리하고, 어느 상황에서 safe하게 재호출 가능한지"를 JSDoc 한 블록으로 명시하면 유지보수성이 크게 향상된다. `maintainability` 리뷰에서도 이 계층 관계 명시를 제안했으나 JSDoc 자체는 미추가 상태다.
- 제안: `/** pendingEmail / emailChangeToken / emailChangeExpiresAt 을 NULL 로 초기화. cancelEmailChange 외부 호출, requestEmailChange 오류 롤백, verifyEmailChange race condition 정리에서 공유. */` 형태의 JSDoc 추가.

---

### [INFO] `users.ts` API 클라이언트 — `resendEmailChange` / `cancelEmailChange` 빈 body `{}` 이유 미주석
- 위치: `codebase/frontend/src/lib/api/users.ts` — `resendEmailChange`, `cancelEmailChange`
- 상세: 이전 `18_29_37` 세션의 `documentation.md` INFO#19 로 이미 식별됐으나 resolution 대상이 아니었다. 두 함수가 `apiClient.post(..., {})` 로 빈 객체를 body 에 전달하는데, 이 선택의 이유(일부 HTTP 클라이언트가 body-less POST 를 다르게 처리하는 호환성 우려)가 주석 없이 남아 있다. 향후 유지보수자가 `{}` 를 `undefined` 로 바꾸려는 충동을 유발할 수 있다.
- 제안: 각 함수 직전 또는 함수 내부에 `// body 없는 POST 는 일부 클라이언트가 Content-Type 을 생략 — 빈 객체 유지.` 주석 추가.

---

### [INFO] `spec/5-system/1-auth.md` Rationale 1.1.B-6 문구 개선 — resolution 후 적용됨, 확인
- 위치: `spec/5-system/1-auth.md` — Rationale 1.1.B-6 마지막 문장
- 상세: `18_29_37` consistency 세션의 convention_compliance.md INFO 에서 "§4.1.A 예고 표현" 문구 수정을 제안했고, 이번 diff 에서 `"§4.1.A 및 audit-actions.md 의 확정 규약"` 으로 정확히 갱신됐다. 해소됨.
- 제안: 없음 — 이미 반영.

---

### [INFO] `data-flow/2-auth.md` 이메일 변경 흐름 시퀀스 미반영
- 위치: `spec/data-flow/2-auth.md` §1.7 / §2.1 (이번 PR changeset 미포함)
- 상세: `review/consistency/2026/06/21/18_58_39/cross_spec.md` INFO 에서 지적됐으며, 이번 코드 리뷰 changeset 에도 `data-flow/2-auth.md` 수정이 포함되지 않았다. 신규 4개 엔드포인트의 시퀀스와 3개 신규 컬럼이 data-flow 문서에 미반영 상태로, `spec/1-data-model.md` 및 `spec/5-system/1-auth.md` 와 점차 벌어진다. 코드 동작에 영향은 없으나 SDD 관점의 문서 gap 이다.
- 제안: 별도 project-planner 작업으로 `data-flow/2-auth.md §1.7` 에 이메일 변경 시퀀스를, `§2.1` 에 신규 3컬럼을 추가하도록 `spec-draft-email-change.md` 또는 후속 plan 에 follow-up 항목 등록 권장. 본 PR 차단 사안은 아님.

---

### [INFO] `spec/2-navigation/9-user-profile.md` §6.1 — WARNING 수정 반영 확인
- 위치: `spec/2-navigation/9-user-profile.md` §6.1 `POST /api/users/me/email-change/request` 행
- 상세: consistency 세션 WARNING 1(`재인증 범위 — 2FA 가 WebAuthn 포함으로 오독 가능`)이 이번 diff 에서 `"비밀번호 또는 등록 TOTP — WebAuthn step-up 재인증은 현재 미지원, 인증 §1.1.B Rationale 1.1.B-4"` 로 정확히 갱신됐다. 해소됨.
- 제안: 없음 — 이미 반영.

---

### [INFO] `spec-draft-email-change.md` 체크박스 §5 — 갱신 확인
- 위치: `plan/in-progress/spec-draft-email-change.md` — §다음 단계 항목 5
- 상세: consistency 세션 plan_coherence INFO 에서 지적한 체크박스 미체크 상태가 이번 diff 에서 `[x]` 로 갱신됐고 구현 완료 사실도 본문에 명시됐다. 해소됨.
- 제안: 없음 — 이미 반영.

---

### [INFO] `review/code/18_29_37/documentation.md` 미완 STATUS 라인
- 위치: `review/code/2026/06/21/18_29_37/documentation.md` 마지막 줄
- 상세: 기존 세션의 documentation.md 가 `STATUS: SUCCESS` (콜론 형식) 로 끝나며, 호출 규약의 `STATUS=success` (등호 형식) 와 포맷이 다르다. 기능적 문제는 없으나 파싱 스크립트가 등호 형식을 기대한다면 인식 실패 가능성이 있다. 이미 커밋된 파일이므로 현 PR 에서 수정 불필요 — 후속 세션에서 형식 통일 주의 권장.
- 제안: 향후 리뷰 산출물 작성 시 `STATUS=success ISSUES=N PATH=...` 등호 형식 준수.

---

## 요약

이번 changeset 은 문서화 품질이 전반적으로 우수하다. 이전 리뷰 세션(`18_29_37`)에서 식별한 문서화 항목 — `emailChangeExpiresAt` JSDoc, `isUniqueEmailViolation` 23505 주석, Swagger 응답 데코레이터 보완, `spec/2-navigation/9-user-profile.md §6.1` 재인증 범위 문구, `spec-draft-email-change.md` 체크박스, Rationale 1.1.B-6 표현 개선 — 이 모두 resolution 커밋에 반영됐음을 확인했다. 사용자 가이드 MDX 양 언어 동시 갱신, i18n ko/en parity 완비, Swagger jsdoc 신규 4엔드포인트 전수 적용도 검증됐다. 남은 항목은 `resendEmailChange` 실패 처리 의도 주석 부재, `clearPendingEmailChange` JSDoc 누락, API 클라이언트 빈 body `{}` 미주석 등 소규모 INFO 수준이며, `data-flow/2-auth.md` 의 신규 흐름·컬럼 미반영은 별도 planner 후속으로 처리하는 것이 적절하다. 차단 요인 없음.

## 위험도

LOW

STATUS=success ISSUES=5 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/documentation.md RESET_HINT=
