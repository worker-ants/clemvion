# 코드 리뷰 SUMMARY — EIA 후속 F-2 (surfaceMismatch 안내)

- 범위: `main..HEAD` (2 commits — docs + feat), 7 files
- 실행 reviewer: 9 (requirement, security, scope, side_effect, maintainability, testing, documentation, architecture, user_guide_sync)
- 라우터 forced 7 + architecture(레이어링) + user_guide_sync(문서 변경) 수동 포함. 미실행: performance / dependency / database / concurrency / api_contract (변경 성격상 무관 — 신규 의존성·DB·동시성·API 계약·핫패스 없음).

## 위험도: LOW · **BLOCK: NO**

| reviewer | 위험도 | Critical | Warning | Info |
|---|---|---|---|---|
| requirement | LOW | 0 | 0 | 2 |
| security | NONE | 0 | 0 | 4 |
| scope | NONE | 0 | 0 | 0 |
| side_effect | LOW | 0 | 0 | 6 |
| maintainability | LOW | 0 | 1 | 3 |
| testing | LOW | 0 | 1 | 2 |
| documentation | MEDIUM | 0 | 2 | 2 |
| architecture | LOW | 0 | 3 | 2 |
| user_guide_sync | LOW | 0 | 1 | 0 |
| **합계** | **LOW** | **0** | **8** | **19** |

## Critical: 없음

## Warning 처분 (8건)

**조치 (same-turn fix)** — 상세는 `RESOLUTION.md`:
- [maintainability] 테스트가 MarkdownV2 특수문자 집합을 canonical `escapeMarkdownV2` 에서 import 하지 않고 재선언 → **fix A**: `escapeMarkdownV2(default) === default` 단언으로 교체.
- [testing] `sendSurfaceMismatchNotice` 발송 실패(swallow) 경로 미테스트 → **fix B**: sendMessage reject 시 throw 안 함 + warn 검증 테스트 추가.
- [documentation] CHANGELOG 미갱신 → **fix C**: F-2 전용 `## Unreleased` 항목 추가.
- [documentation] providers/telegram.md 에 surfaceMismatch non-escape 예외 미문서화 → **fix D**: §5.8 신설 (control-plane sendMessage 직접 발송은 renderNode escape 미적용 → default MarkdownV2-safe).
- [user_guide_sync] 트리거 drawer `languageHintsHelp` dict 에 `surfaceMismatch` 미열거 → **fix E**: ko/en 에 `surfaceMismatch` + 기존 누락분(`formOpenLabel`/`sessionExpired`) 백필.

**백로그 (pre-existing 패턴 / PR 범위 밖 — plan 후속 항목으로 이관)**:
- [architecture] 3-level lookup resolver 3중 복제 → factory 통합 (기존 2함수 포함, 별도 리팩터).
- [architecture] HooksService 안내 발송 private 메서드 4종 구조 중복 + SRP → `sendBestEffortNotice` 추출 / `ChatChannelInboundService` 분리 (백로그).
- [architecture] control-plane raw 발송 키(surfaceMismatch/sessionExpired/executionStillRunning/help)의 MarkdownV2-safe 불변식이 DTO validator 로 강제되지 않음 (operator override 미검증) — 기존 키 전체 공유 갭, 별도 하드닝 백로그.

## Info (19건)
대부분 기존 컨벤션 준수 확인 / 향후 정리 제안 (resolver helper 추출, unknown-locale fallback 테스트 통일, Slack/Discord 문서 대칭 등). 차단 아님.
