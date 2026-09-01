# Plan 정합성 검토 — spec/5-system/ (impl-done, avatar-upload-public-url)

## 검토 범위 확인
- target scope `spec/5-system/` 은 이 브랜치에서 **델타 0** (`git diff origin/main -- spec/5-system/` 확인) — 정상. 코드 전용 PR.
- 실제 구현 diff(15 파일/1977줄)는 아바타 업로드(`users.controller.ts`/`users.service.ts`/`s3.service.ts`/`s3.config.ts`/`main.ts` 등) — `plan/in-progress/spec-sync-user-profile-gaps.md` §6.1 항목("완료 2026-08-31")과 `plan/in-progress/spec-update-avatar-upload-implemented.md`(planner 트랙 후속) 두 plan 문서가 정확히 이 작업을 추적하고 있음을 확인.

## 발견사항

- **[INFO]** `FILE_REQUIRED`/`INVALID_FILE_TYPE` 가 아직 `spec/5-system/3-error-handling.md` §1.3 카탈로그에 등재되지 않음 — 이미 plan 이 정확히 추적 중, 신규 문제 아님
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 유효성 검증 에러 표 (현재 `VALIDATION_ERROR`/`PAYLOAD_TOO_LARGE`/`WORKSPACE_ID_REQUIRED`/... 행은 있으나 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 행 없음. `grep -n "FILE_REQUIRED\|INVALID_FILE_TYPE" spec/5-system/3-error-handling.md` → 0건)
  - 관련 plan: `plan/in-progress/spec-update-avatar-upload-implemented.md` "## 할 일" 세 번째 항목 — `spec/5-system/3-error-handling.md §1 에러 카탈로그에 FILE_REQUIRED(파일 누락)과 INVALID_FILE_TYPE(확장자 불허, knowledge-base 와 공용) 등재` (체크박스 미완)
  - 상세: 이번 diff 의 `users.service.ts` `updateAvatar()` 가 실제로 `BadRequestException({code:'FILE_REQUIRED'})`·`BadRequestException({code:'INVALID_FILE_TYPE'})` 를 throw 하는 것을 diff 본문에서 직접 확인. `spec/5-system` 스코프가 이번 PR 에서 안 바뀐 것은 developer 가 `spec/` 쓰기 권한이 없어 의도적으로 planner 트랙(`spec-update-avatar-upload-implemented.md`)에 위임했기 때문 — plan 문서 자체가 "선례: `spec-sync-websocket-protocol-gaps.md` 의 `notification.new` 배지 flip 위임" 을 근거로 이 분리를 명시하고 있어 **정합**. 즉 이것은 새로 발견된 정합성 결함이 아니라, plan 이 이미 정확히 잡아 둔 미해결(open) 후속 항목이 여전히 미해결 상태임을 재확인한 것.
  - `spec/2-navigation/9-user-profile.md:334`·`spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md §2.1` 도 같은 이유로 여전히 "미구현 (Planned)"/`{workspaceId}/avatars/{userId}.{ext}` 옛 키 패턴을 서술 — 이들은 target scope(`spec/5-system`) 밖이지만 같은 plan 문서가 "왜 이게 Critical 인가 — stale spec 이 만드는 실패"(버킷 정책을 옛 키 패턴으로 설계하면 업로드는 성공하고 이미지만 403) 로 이미 등재해 두었으므로 별도 보고 불필요.
  - 제안: 새 작업 불필요. `spec-update-avatar-upload-implemented.md`(planner, P3, in-progress)가 다음 planner 턴에서 처리하도록 그대로 열어 둘 것. 이 developer PR 을 spec 미갱신을 이유로 막을 근거는 없음(권한 밖 작업이 아니라 예정된 분리).

## 요약
target(`spec/5-system/`)은 이번 PR 에서 변경되지 않았고(델타 0, 예산 절단으로 인한 누락 아님 — `git diff` 로 재확인), 실제 아바타 업로드 구현 diff 가 새로 발행하는 에러 코드(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)는 `spec/5-system/3-error-handling.md` 카탈로그에 아직 없다. 그러나 이 갭은 `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 착수 시점부터 정확히 예견·추적하고 있고, developer 가 spec 쓰기 권한 밖이라는 이유로 planner 트랙에 정당하게 위임한 것이며 우회나 일방적 결정이 아니다. `plan/in-progress` 전체를 훑어도 이 diff 가 다른 plan 의 미해결 결정과 충돌하거나, 선행 plan 이 해소되지 않은 상태에서 전제를 깨뜨리거나, 추적되지 않은 후속 항목을 새로 만드는 사례는 발견되지 않았다(TOCTOU 유예·매직바이트 검증 유예·프런트엔드 UI 후속 등은 모두 plan 문서 안에서 재개 신호와 함께 이미 명시적으로 유예됨).

## 위험도
LOW
