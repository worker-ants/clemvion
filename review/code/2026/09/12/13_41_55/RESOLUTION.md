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
| #7 | spec (SPEC-DRIFT) | `3c47885a3` | spec 반영 완료. `plan/complete/spec-update-chat-channel-adapter-status.md`(draft, `a9f626a9b` 로 이동 완료) — 코드 무수정. 아래 참고 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 458 suites / 9621 tests, frontend 289 files / 6406 tests, 내부 패키지 전부 통과)
- build : 미실행 (본 자동 흐름은 lint+unit+e2e 만 강제 — build 는 별도 게이트)
- e2e   : 통과 (305/305, `_test_logs/e2e-20260912-140527.log`)

## 보류·후속 항목

- **spec draft 위임 (SUMMARY#7) — 해소 완료**: `spec/conventions/chat-channel-adapter.md`
  frontmatter(`:7`)와 본문 `:188-190` 이 "§1.1.2 `code` 선언 계약은 미구현" 이라 적고 있었으나,
  이번 세션이 adapter 3종(discord/slack/telegram) 전부에 `code` 를 부착해 그 문장을
  반증했다(SPEC-DRIFT). `git blame` 확인 결과 해당 문장은 developer 가 아니라 planner
  커밋(`8964a7114`)이 작성해 CLAUDE.md "자기-반증형 소정정" 조건 1(작성자=developer)이
  성립하지 않아 — developer/resolution-applier 권한 밖 — draft 만 작성해(`8d1da07d9`) main 으로
  위임했다. 후속 처리 완료:
  - `/consistency-check --spec plan/in-progress/spec-update-chat-channel-adapter-status.md` →
    `review/consistency/2026/09/12/14_11_58` **BLOCK: NO** (CRITICAL 0 · WARNING 1 · INFO 1).
  - spec 반영 완료 — 커밋 `3c47885a3`: `spec/conventions/chat-channel-adapter.md` frontmatter
    주석 + §1.1.2 제거 조건 콜아웃 갱신. draft 는 그대로 반영하지 않고 실측으로 두 곳을
    좁혀 반영했다(제거 조건은 충분조건이 아님 — fallback 이 방어하는 잔여 경로 명시,
    frontmatter 서수 참조를 파일명+제목 직접 인용으로 정정). 트래커 cross-link·신규 항목
    등재도 같은 커밋.
  - draft 는 `plan/in-progress/` 에서 `plan/complete/spec-update-chat-channel-adapter-status.md`
    로 이동 완료(커밋 `a9f626a9b` 로 자기 서술의 "마무리 커밋에서 이동" 예고 문구도 정정).
  - 코드는 세션 전체에서 무수정(SPEC-DRIFT 코드 revert 금지 원칙 준수).
- **INFO 항목**: 자동 조치 대상 아님. INFO #1(401/403 message fallback 은 3종 `code` 부착
  완료로 제거 검토 시점 도래 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
  "CCA §1.1.2 fallback 제거 판정" 항목이 이미 추적하며, 위 `3c47885a3` 실측으로 "신호는
  켜졌고 판정은 아직" 으로 갱신됨), INFO #9(에러 카탈로그 미등재, 같은 세션 consistency-check
  가 추적 중, `spec_impact: none` 확정)는 재조치 불요.
