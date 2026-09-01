# Plan 정합성 검토 — `spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md`

## 사전 확인 (실측)

- `git log --oneline -3` → HEAD `442a0c7b6 docs(spec): 아바타 키가 workspaceId 를 빼는 것을 §2.7 Rationale 의 두 번째 예외로 등재`.
  이 커밋이 `spec/0-overview.md`·`spec/data-flow/0-overview.md`·`spec/data-flow/4-file-storage.md`·
  `spec/2-navigation/9-user-profile.md`·`spec/5-system/2-api-convention.md`·
  `spec/5-system/3-error-handling.md` **6개 파일을 한 커밋에서 동시 수정**했고,
  `plan/in-progress/spec-update-avatar-upload-implemented.md` → `plan/complete/`로
  `git mv`(rename 072% 로 detect), `plan/in-progress/spec-sync-user-profile-gaps.md` 갱신,
  `plan/in-progress/spec-draft-avatar-storage-key.md` 신설까지 같은 커밋에 포함.
- 이 검토 세션(`11_33_21`)은 그 커밋 11초 뒤 실행 — 즉 **"해결 전" 이 아니라 "해결 직후 재검증"** 시점.
- target 두 파일의 현재 본문을 직접 확인: `2-api-convention.md` §9 는 "파일 업로드 엔드포인트는
  둘이다 — KB 문서 업로드와 아바타 업로드"로 이미 갱신돼 있고, `3-error-handling.md` §1.3 에
  `FILE_REQUIRED`·`INVALID_FILE_TYPE` 행이 이미 등재돼 있다.

## 대조한 plan 문서

- `plan/in-progress/spec-draft-avatar-storage-key.md` — `/consistency-check --impl-done`
  BLOCK:YES(`01_51_41`)를 해소하려 작성된 draft. §F(3-error-handling.md §1.3 신규 행)·
  §G(2-api-convention.md §9 정정)가 **정확히 target 파일의 현재 diff 내용과 문자 그대로 일치**한다
  (`FILE_REQUIRED`/`INVALID_FILE_TYPE` 행 문구, "파일 업로드 엔드포인트는 둘이다" 문구 모두 동일).
  draft 의 §A/§B(spec/0-overview.md §2.7 트리·표·Rationale)도 같은 커밋에서 적용됨을
  `git diff --stat` 로 확인 — target 두 파일만 반영되고 자매 파일(0-overview.md 등)이 방치되는
  **부분 적용 상태가 아니다**.
- `plan/in-progress/spec-sync-user-profile-gaps.md` — 아바타 업로드 항목이 `[x] 완료
  (2026-08-31)`로 표시돼 있고, spec 배지 flip 위임이 `../complete/spec-update-avatar-upload-implemented.md`
  로 정확히 갱신돼 있다(실제 파일 존재 확인).

## 발견사항

이 회차의 target 범위(`spec/5-system/2-api-convention.md`, `3-error-handling.md`)에 대해
**CRITICAL/WARNING 없음**. 아래는 조사 과정에서 확인·기각한 후보들이다.

- **[검토 후 기각] `3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE`의 "message 는 고정 문구만
  반환" 서술과 `spec-sync-user-profile-gaps.md`(:150) 의 미해결 WARNING("multer 413 이 CWE-209
  마스킹을 우회해 원문을 leak")의 충돌 여부** — 실측 결과 `PAYLOAD_TOO_LARGE` 행 문구가
  처음부터 **"body-parser 의 413"으로 명시 스코프**돼 있어(`GlobalExceptionFilter` 가
  body-parser 의 413 을 매핑), multer(`FileInterceptor`)발 413 에 대해서는 아무 보장도
  주장하지 않는다. 즉 target 문서는 스코프를 넓게 주장하지 않으므로 plan 이 추적 중인 그
  미해결 버그와 **모순되지 않는다** — plan 쪽에 이미 정확히 `error-handling.md §1.3` 을
  인용해 별도 항목(`[ ]` 미해결, 회귀 테스트로 고칠 예정)으로 추적 중이며, 이번 PR 의 target
  변경(§F 의 신규 행 2개)과는 무관한 영역이다. 후속 조치 불요.
- **[정보 — 비차단] `plan/in-progress/spec-draft-avatar-storage-key.md` 가 status: in-progress
  로 남아 있음** — §A~§H 전체가 이미 코드베이스(6개 spec 파일)에 반영 완료됐고 위임 트래커도
  `plan/complete/`로 이동됐는데, draft 자신은 커밋 메시지가 명시한 대로("draft 는 산출물이라
  보존한다") `plan/in-progress/`에 의도적으로 남아 있다. `plan-lifecycle.md`는 draft 문서의
  종결 처리에 대해 별도 규정이 없고(§5 자가점검은 "tracker" 이동을 다룬다), 이 draft 는
  tracker 가 아니라 evidence 이므로 이동 누락으로 보기 어렵다. plan 정합성 관점의 3개 축
  (미해결 결정 충돌 / 선행 plan 미해소 / 후속 항목 누락) 중 어느 것도 해당하지 않아 CRITICAL/WARNING
  으로 올리지 않는다 — 참고용 기록만 남긴다.

## 요약

target 두 파일(`spec/5-system/2-api-convention.md`, `3-error-handling.md`)의 변경은 원래
`/consistency-check --impl-done`(`01_51_41`)이 낸 CRITICAL BLOCK(아바타 S3 키 구조가
`spec/0-overview.md` §2.7 Rationale 의 "workspaceId 제외 예외는 KB 뿐"이라는 배타적 결정과
충돌)을 해소하기 위한 6-파일 동시 수정의 일부이며, 그 상위 결정(사용자 결정 2026-09-01, "코드가
아니라 spec 을 고친다")은 이미 `plan/in-progress/spec-draft-avatar-storage-key.md`에 근거와
함께 명시돼 있고 같은 커밋에서 spec 6개 파일 전체·plan 라이프사이클(위임 트래커 `complete/` 이동,
인입 링크 정정)까지 일관되게 반영됐다. target 이 미해결 결정을 우회하거나, plan 이 요구하는
선행조건을 방치하거나, 다른 plan 의 후속 항목을 무효화한 흔적은 발견되지 않았다. 유일하게
조사할 가치가 있었던 후보(§1.3 `PAYLOAD_TOO_LARGE` 마스킹 보장과 multer 413 leak 미해결
버그의 충돌 가능성)는 target 문서가 애초에 "body-parser 의 413"으로 스코프를 좁혀 서술하고
있어 실제로는 충돌하지 않는 것으로 확인했다.

## 위험도

NONE
