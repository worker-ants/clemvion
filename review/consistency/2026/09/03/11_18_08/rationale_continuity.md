# Rationale 연속성 검토 — spec/5-system/ (change-password 실패 코드 형제 정렬, 2R 재검토)

## 검토 범위

- target: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (diff-base `origin/main`, impl-done)
- 구현 diff: `codebase/backend/src/common/utils/password.util.ts` · `auth.service.ts` ·
  `sessions.service.ts`(+spec) · `users.service.ts`(+spec) · e2e/unit 테스트 · user-docs mdx 2종
- 결정 문서: `spec/conventions/error-codes.md` §5(Rename 이력, 등급 B) ·
  `plan/complete/auth-change-password-oauth-only-code-split.md` ·
  `plan/complete/spec-draft-change-password-code-alignment.md`
- 직전 라운드: `review/consistency/2026/09/03/10_46_11/rationale_continuity.md` (WARNING 1건,
  "순환 의존" 근거 미검증) — 그 라운드 **이후** 커밋 `5232a5540`(리뷰 2R)이 세 곳(spec §5 note ·
  `PASSWORD_VERIFY_CODES` JSDoc · plan)을 모두 실측 근거로 교체했음을 diff·`git log -S` 로 재확인.

## 발견사항

### [INFO] spec 본문 note 는 정정 시 원문 취소선을 남기지 않음 (JSDoc·plan 과 형식 비대칭)

- target 위치: `spec/5-system/1-auth.md` §5 "민감 동작 비밀번호 재확인 코드" note
  (`## 5. API 엔드포인트` 하단, 커밋 `5232a5540`).
- 과거 결정 출처: 같은 커밋이 동시에 고친 두 자매 위치 —
  `codebase/backend/src/common/utils/password.util.ts` `PASSWORD_VERIFY_CODES` JSDoc,
  `plan/complete/auth-change-password-oauth-only-code-split.md` "`changePassword` 가 왜
  이렇게 됐나" 절.
- 상세: 세 위치 모두 "`UsersService` 는 `AuthService` 를 주입할 수 없다(순환)" 는 반증된 주장을
  담고 있었다(직전 라운드 WARNING). 커밋 `5232a5540` 이 셋 다 측정된 근거(조회 2회·`!user`
  처방 차이·안내 문구 차이)로 교체했는데, **plan 문서와 JSDoc 은 원문을 `~~취소선~~` +
  "이 근거는 틀렸다" 로 남기고** 교체한 반면, **spec 본문 note 는 원문을 흔적 없이 통째로
  대체**했다(diff 상 `-`/`+` 한 줄 치환, 취소선 없음). 세 곳이 같은 커밋·같은 정정인데 스타일이
  갈린다 — CLAUDE.md 의 "자기-반증형 소정정" 조건 4(원문은 취소선으로 남기고 정정은 그 문장에
  국한)를 plan·코드 JSDoc 은 지켰고 spec 본문만 지키지 않았다. 이 note 는 `## Rationale` 절 자체는
  아니라서(§5 API 엔드포인트 본문 note) 이 저장소가 `## Rationale` 절에서 일관되게 지키는
  "원문 이력 보존 + 후속 갱신 bullet 신설" 관례(예: 본 diff 의 `3-error-handling.md` §1.2.1
  근접 명명 주석·`~~INVALID_PASSWORD~~` 취소선 처리)의 엄격 적용 대상은 아니었을 수 있으나,
  같은 문서 다른 곳(§1.2 표의 `~~INVALID_PASSWORD~~` 취소선, §Rationale 의 "(2026-09-02 후속)"
  bullet)은 이 관례를 지키고 있어 비일관이 눈에 띈다.
- 제안: CRITICAL/WARNING 은 아님 — 결론(코드 상수 공유, 헬퍼 비공유)은 정확하고 최종 근거도
  타당·측정됨. 다음에 이 note 를 다시 손댈 때 "왜 예전엔 순환이라고 썼었는지" 를 추적하려면
  plan 문서(`auth-change-password-oauth-only-code-split.md`)를 봐야 하는 비용만 남는다. 필요하면
  spec note 끝에 `(정정 이력: plan/complete/auth-change-password-oauth-only-code-split.md)` 포인터
  한 구절만 추가해도 충분하다.

## 그 외 확인 사항 — Rationale 연속성 관점 4가지 전부 통과 (문제 없음)

- **① 기각된 대안의 재도입** — 없음. `PASSWORD_NOT_SET` 신설안(원 초판 권장)은 명시적으로
  재검토·재기각됐고(`login_history.failure_reason` 감사값과의 wire/audit 동명 충돌 재생산,
  `git log -S PASSWORD_NOT_SET` 로 실측 확인된 근거), 채택안(D. 형제 코드 재사용)은 새 코드를
  만들지 않는 쪽이라 "과거에 거부된 신설안" 을 다시 들여온 것도 아니다.
- **② 합의된 원칙 위반** — `error-codes.md §2`("이름 정확성 향상만을 위한 rename 은 하지
  않는다")와의 긴장은 §5 의 A/B 등급 흡수-조건 메커니즘(§2 자체가 예외로 두는 통로)을 통해
  정식으로 해소됐다 — 두 번째 등급 B 사례로 명시 등재, 사용자 결정 2026-09-02 기록, §5 머리말의
  "B 는 예외로 세어야" 요구대로 개수(2건)를 갱신했다. 선례(`INVALID_INPUT`→
  `INVALID_TRIGGER_PARAMETERS`, #1193)와 판정 기준이 동일하다.
- **③ 결정의 무근거 번복** — 없음. `INVALID_PASSWORD` 를 §3(historical-artifact, *유지*)에서
  빼고 §5(Rename 이력, *은퇴*)로 옮긴 것은 새 Rationale(결정 기록 D·§5 신규 행·plan 결정절)을
  충분히 동반한다. §3 은 애초에 "미설정 조건을 별도 코드로 분리할지는 미결" 이라고 명시적으로
  결정을 유보하고 있었으므로(과거 확정 결정의 번복이 아니라 유보 상태의 확정), 대상이 되는
  과거 결정 자체가 pending 이었다.
- **④ 암묵적 가정 충돌** — 없음. `login_history.failure_reason` 감사값 레이어와 wire 코드
  레이어를 분리 유지하는 기존 설계(§1.2.1 "근접 명명 주의")를 그대로 따르며, 감사값은 건드리지
  않고 그 출처(로그인 실패 vs 비밀번호 변경)까지 명시했다. `2.3.C`(비밀번호 변경 시 세션 revoke
  범위) 등 인접 Rationale 항목과도 상호 참조·모순 없음.

## 요약

이전 라운드(`10_46_11`)가 지적한 유일한 결함("순환 의존이라 주입 불가능" 이라는 미검증 주장이
spec·코드 JSDoc·plan 세 곳에 박혀 있던 것)은 이후 커밋(`5232a5540`, 리뷰 2R + `--impl-done`)이
세 곳 모두 측정된 근거로 교체해 해소됐다 — diff·`git log -S`로 재확인했다. `INVALID_PASSWORD`
wire 코드 은퇴(등급 B)·`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 형제 코드 재사용은 §5 흡수-조건
메커니즘을 정확히 따르고, 과거 유보(§3 "미결")를 정식 결정으로 닫았으며, 감사값 레이어와 wire
레이어의 기존 분리 원칙을 그대로 지킨다. 유일하게 남는 흠은 정정 커밋이 plan·코드 JSDoc에서는
원문을 취소선으로 보존했으나 spec 본문 note 에서만 흔적 없이 치환한 형식적 비일관(INFO)뿐이며,
결론·근거의 실질에는 영향이 없다.

## 위험도

LOW
