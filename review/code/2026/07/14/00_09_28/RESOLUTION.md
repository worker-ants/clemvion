# RESOLUTION — EIA 후속 F-2 (surfaceMismatch 안내)

리뷰: `review/code/2026/07/14/00_09_28/SUMMARY.md` (위험도 LOW, BLOCK: NO, Critical 0 / Warning 8 / Info 19).

## 조치 항목

Critical 0. Warning 8건 중 5건 same-turn fix, 3건 backlog 이관. Info 19건은 대부분 기존 컨벤션 준수 확인 — 미조치.

| # | reviewer | 발견 (Warning) | 조치 | 위치 |
|---|---|---|---|---|
| A | maintainability | 테스트가 MarkdownV2 특수문자 집합을 canonical `escapeMarkdownV2` 에서 import 하지 않고 재선언 | fix | `language-hint-defaults.spec.ts` — `escapeMarkdownV2(default) === default` 단언으로 교체(중복 regex 제거) |
| B | testing | `sendSurfaceMismatchNotice` 발송 실패(swallow) 경로 미테스트 | fix | `hooks.service.spec.ts` — sendMessage reject 시 no-throw + warn 검증 테스트 추가 |
| C | documentation | CHANGELOG 미갱신 | fix | `CHANGELOG.md` — F-2 전용 `## Unreleased` 항목 추가 |
| D | documentation | providers/telegram.md 에 surfaceMismatch non-escape 예외 미문서화 | fix | `spec/4-nodes/7-trigger/providers/telegram.md §5.8` 신설 (control-plane 직접 발송 → renderNode escape 미적용, default MarkdownV2-safe 근거) |
| E | user_guide_sync | 트리거 drawer `languageHintsHelp` dict 에 `surfaceMismatch` 미열거 | fix | `dict/{ko,en}/triggers.ts` — `surfaceMismatch` + 기존 누락분(`formOpenLabel`/`sessionExpired`) 백필 |

모두 본 review-fix commit(`refactor(chat-channel): ai-review F-2 반영`)에 포함.

## TEST 결과

- lint: 통과 (`.claude/tools/run-test.sh lint`)
- unit: 통과 (`.claude/tools/run-test.sh unit`)
- build: 통과 (`.claude/tools/run-test.sh build`)
- e2e: 통과 (`.claude/tools/run-test.sh e2e`)

## 보류·후속 항목

architecture reviewer 의 Warning 3건은 모두 **pre-existing 패턴 / 본 PR 범위 밖**으로, `plan/in-progress/eia-command-waiting-surface-guard.md` 후속 항목에 이관:

- **F-4** (신설): control-plane 안내 발송의 구조 정리 — (a) `resolveXxxMessage` 3-level lookup resolver 3중 복제(`sessionExpired`/`formOpenLabel`/`surfaceMismatch`)를 factory 로 통합, (b) `HooksService` 안내 발송 private 메서드 4종(`sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`/`maybeNotifyIgnored`/기타)의 try/catch/warn 골격을 `sendBestEffortNotice` 로 추출 + 중장기 `ChatChannelInboundService` 분리. 기존 함수 포함 리팩터라 별도 PR.
- **F-5** (신설): control-plane raw 발송 키(`surfaceMismatch`/`sessionExpired`/`executionStillRunning`/`help`)의 MarkdownV2-safe 불변식을 DTO validator 로 등록 시점 강제(operator override 미검증 갭). 기존 키 전체 공유 갭이라 별도 하드닝.
