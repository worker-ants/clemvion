# Code Review SUMMARY

## 전체 위험도
**LOW** — `button_click` graceful degradation 구현은 spec §10.9 요건을 정확히 충족하며 보안·성능·동시성 면에서 안전. CRITICAL 없음.

## Critical
없음.

## WARNING (7건)

| # | 카테고리 | 발견 | 위치 | 제안 |
|---|---|---|---|---|
| W1 | 유지보수성 | warn 로그 메시지가 220자 초과 자연어 단일 문자열 — structured logging 일관성 깨짐 | service.ts 신규 warn | `logger.warn(msg, { executionId, buttonId })` 패턴 |
| W2 | 유지보수성 | 신규 테스트가 기존 `getPendings` 헬퍼 미사용, 인라인 타입 단언 중복 | spec.ts 신규 it | `getPendings(service)` 헬퍼 적용 |
| W3 | 유지보수성 | `button_click` variant 가 action 공용체 타입에 부재 → 인라인 `as { buttonId?: unknown }` 단언 필요 | service.ts button_click 분기 | continuation payload 공용체에 variant 추가 |
| W4 | 테스팅 | `button_click × N → ai_message → ended` 인터리빙 통합 케이스 미검증 | 신규 it | 통합 케이스 추가 |
| W5 | 테스팅 | `buttonId` 길이 슬라이싱 경계값(64+, null, 숫자) 단위 테스트 부재 | service.ts `slice(0, 64)` | 경계 케이스 추가 |
| W6 | 문서화 | `spec/0-common.md` frontmatter `status: spec-only` / `code: []` 미갱신 | spec frontmatter | project-planner 위임 |
| W7 | 문서화 | `spec/0-common.md §9 CHANGELOG` 본 회귀 수정 미기재 | spec §9 | project-planner 위임 |

## INFO (10건)
- 보안: button_click 무한 전송 이론적 DoS (상위 rate limiting 의존), `_retry_state.json` 로컬 절대경로 커밋
- 유지보수성: 매직 숫자 64 / 25, 파일 끝 개행 없음
- 테스팅: `warnSpy.mockRestore` finally 누락, cancel race 미검증
- 요구사항: spec line 번호 참조 stale 가능, `pendingEntry?.resolve` non-null 명시성

## Reviewer 위험도
| Agent | Risk |
|---|---|
| security | LOW |
| performance | NONE |
| requirement | LOW |
| scope | NONE |
| side_effect | LOW |
| maintainability | LOW |
| testing | LOW |
| documentation | LOW |
| concurrency | NONE |

Skipped (router): architecture, dependency, database, api_contract, user_guide_sync.

## 권장 조치 우선순위
1. **즉시** — W2 (getPendings 헬퍼 적용), W4·W5 (테스트 추가), W3 (타입 variant 추가)
2. **권고** — W1 (structured logging)
3. **후속 PR (project-planner)** — W6·W7 (spec frontmatter + CHANGELOG)
