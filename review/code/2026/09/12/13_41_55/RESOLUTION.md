# RESOLUTION — 13_41_55

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `8847b6736` | `triggers.service.spec.ts` Logger spy 원복을 `try/finally` 로 — 실패 시 전역 누출 차단. 드라이브바이로 인접 `BadRequestException`→`BadGatewayException` 캐스팅 오타(INFO #6)도 정정 |
| #2 | 코드 | `eda10e051` | `http-exception.filter.spec.ts` 에 502 `BadGatewayException` 필터 통과 회귀 테스트 1건 추가 |
| #3 | 코드 | `a07c91b64` | Discord 401/403 판별을 `DISCORD_CREDENTIAL_REJECTED_STATUSES` 이름 있는 상수로 추출 (Telegram/Slack 과 스타일 통일). 동작 변경 없음 |
| #4 | 코드(문서) | `0adc3d577` | `CHANGELOG.md` Unreleased 에 502 최초 도입 · `details.reason` 제거 · 메시지 문구 고정 3건 기록 |
| #5 | 코드(문서) | `0adc3d577` | 위 항목과 같은 커밋 — "Behavior change (breaking)" 표제 + 영향 표 + "⚠️ 배포 시 확인" 콜아웃으로 400→502 전환 명시 공지 |
| #6 | 코드(문서) | `15504662d` | Slack/Discord 유저가이드(ko/en 4파일, §5.5/§6.5)에 Telegram §6 과 동일한 형식으로 400/502 에러 코드 한 줄 추가 |
| #7 | spec (SPEC-DRIFT) | (draft 위임) `8d1da07d9` | `plan/in-progress/spec-update-chat-channel-adapter-status.md` — 코드 무수정. 아래 참고 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 458 suites / 9621 tests, frontend 289 files / 6406 tests, 내부 패키지 전부 통과)
- build : 미실행 (본 자동 흐름은 lint+unit+e2e 만 강제 — build 는 별도 게이트)
- e2e   : 통과 (305/305, `_test_logs/e2e-20260912-140527.log`)

## 보류·후속 항목

- **spec draft 위임 (SUMMARY#7)**: `plan/in-progress/spec-update-chat-channel-adapter-status.md`.
  `spec/conventions/chat-channel-adapter.md` frontmatter(`:7`)와 본문 `:188-190` 이 "§1.1.2
  `code` 선언 계약은 미구현" 이라 적고 있으나, 이번 세션이 adapter 3종(discord/slack/telegram)
  전부에 `code` 를 부착해 그 문장을 반증했다(SPEC-DRIFT). `git blame` 확인 결과 해당 문장은
  developer 가 아니라 planner 커밋(`8964a7114`)이 작성해 CLAUDE.md "자기-반증형 소정정" 조건
  1(작성자=developer)이 성립하지 않는다 — developer/resolution-applier 권한 밖. 코드는
  건드리지 않았고(SPEC-DRIFT 코드 revert 금지 원칙) draft 만 작성해 위임한다. 후속:
  `/consistency-check --spec plan/in-progress/spec-update-chat-channel-adapter-status.md` →
  BLOCK:NO 시 spec 반영 + 본 session_dir 로 resolution-applier 재호출(idempotency 로 #1~#6
  skip, #7 만 마무리).
- **INFO 항목**: 자동 조치 대상 아님. INFO #1(401/403 message fallback 은 3종 `code` 부착
  완료로 제거 검토 시점 도래 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
  "CCA §1.1.2 fallback 제거 판정" 항목이 이미 추적), INFO #9(에러 카탈로그 미등재, 이미 같은
  세션 consistency-check 가 추적 중, `spec_impact: none` 확정)는 재조치 불요.
