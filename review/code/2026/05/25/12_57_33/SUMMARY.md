# Code Review 통합 보고서

**세션**: `review/code/2026/05/25/12_57_33`
**대상**: chat-channel-error-notify (CCH-ERR-*) PR — 5 commit (origin/main..HEAD)
**검토자**: 10 reviewer (router 가 4 제외) — security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync

## 전체 위험도
**MEDIUM** — 핵심 보안 개선 (error.message 직접 노출 제거) 은 올바르게 구현되었으나, 기존 운영자에게 silent breaking change 가 발생하고, 테스트 경계값 갭과 i18n 툴팁 미갱신이 잔존한다.

## Critical 발견사항
없음. **BLOCK: NO**.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `languageHints.executionFailed` 단일 키 + `{{code}}`/`{{message}}` placeholder 가 경고 없이 silently ignored — 기존 운영자 설정이 무음 폐기됨 | `chat-channel-config.dto.ts`, `types.ts`, 세 renderer | Deprecation 응답 헤더 또는 warnings 배열로 운영자 알림 / 마이그레이션 가이드 |
| 2 | API 계약 | `languageLocale` 미설정 시 기존 트리거가 KO 기본 문구를 자동 수신 — 영어권 기존 운영자에게 행동 변경 | `types.ts`, `chat-channel-config.dto.ts` | Swagger `default: 'ko'` 외 운영 문서에도 명시 |
| 3 | 아키텍처 | `console.warn` 직접 사용 — NestJS Logger 체계 밖 | `execution-failure-classifier.ts` line ~110 | NestJS `Logger.warn` 또는 표준 로거로 교체; "pure" 표현 재정의 |
| 4 | 테스트 | `extractStatusCode` 경계값 (`statusCode: 0`, `1.5`, `-200`) 누락 — `0` 은 `Number.isInteger` 통과해 사용자에게 `"0"` 노출 | `execution-failure-classifier.spec.ts` | 경계 케이스 3종 추가 |
| 5 | 테스트 | `event.error` 가 `undefined` 인 방어 경로 미검증 | `execution-failure-classifier.spec.ts` | 강제 캐스팅 방어 케이스 1건 |
| 6 | 요구사항 | CCH-ERR-04 warn 로그에 `triggerId` 미포함 | `execution-failure-classifier.ts` | `event.triggerId` structured payload 에 추가 |
| 7 | 요구사항 | `statusCode` 누락 시 `"?"` 치환 assertion 범위 협소 | `discord-message.renderer.spec.ts` line 106-118 | 전체 문구 또는 inline snapshot 검증 |
| 8 | 유지보수성 | 단위 테스트 fixture `'e'`, `'t'`, `'w'` 단일 문자 값 | `discord-message.renderer.spec.ts` (BASE), `telegram-message.renderer.spec.ts` | 의미 있는 이름 (`'exec-base'` 등) |
| 9 | 유지보수성 | `findFirstUnknownPlaceholder` / `FAILURE_HINT_KEYS` DTO 파일 혼재 — HTTP 입력 경계에 비즈니스 로직 | `chat-channel-config.dto.ts` | `shared/` 또는 classifier 모듈로 추출 |
| 10 | 유지보수성 | CCH-ERR-03 enforcement 가 3 레이어 분산 | DTO validator + classifier + defaults | `language-hint-defaults.ts` 상단에 "보안 계층 지도" 주석 |
| 11 | 문서화 | `ChatChannelConfig.languageHints` JSDoc 에 deprecated `executionFailed` 마이그레이션 안내 없음 | `types.ts` line 74 | `@deprecated` 태그 + 6 키 대체 안내 |
| 12 | user-guide 동반 갱신 | `chatChannel.languageHintsHelp` i18n dict (KO/EN) 가 CCH-ERR-* 신규 6 키 미반영 — UI 툴팁 stale | `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` | 두 파일 동시 갱신 (parity 가드) |
| 13 | 사이드이펙트 | 기존 `languageHints.executionFailed` 키 운영 DB 존재 시 silently drop — 마이그레이션 가이드 없음 | `language-hint-defaults.ts` | deprecation warn 또는 docs migration note |
| 14 | 사이드이펙트 | 6 MDX 의 섹션 번호 renumber 로 기존 앵커 URL 파단 가능 | 6 MDX 파일 | `id` 속성 수동 지정 또는 redirect 검토 |

## 참고 (INFO)

(총 17건 — 본 PR 통과 후 별 plan 또는 follow-up 단계 처리 권장. 핵심:
- 보안: 이전 `error.message` 직접 노출 취약점 제거가 올바르게 됨 ✓. `languageHints` MaxLength 부재 (DoS), `Object.hasOwn` 사용 권장
- 아키텍처: `LanguageLocale` 타입 중복, `FAILURE_HINT_KEYS` 단일 진실 통합, 3 renderer `renderFailedMessage` boilerplate 공통 함수화
- 테스트: Slack/Telegram unknown code fallback, MarkdownV2 escape 순서 검증, `warnSpy` 호출 횟수 검증
- API: e2e 의 `UNKNOWN_PLACEHOLDER` `details.code` 직접 assert
- 명명: `renderFailedMessage` vs `renderFailureMessage` 통일
- 장기: `execution.completed` / `cancelled` 도 3-level lookup 방식으로 통일 검토)

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | LOW | 보안 개선 ✓. unknown code 원문 로그 / MaxLength / hasOwn INFO |
| architecture | LOW | console.warn 로거 위반 WARNING; 타입 중복 INFO |
| requirement | LOW | warn 로그 triggerId 누락 + assertion 범위 WARNING |
| scope | NONE | 42 파일 모두 작업 범위 내 |
| side_effect | LOW | executionFailed silent drop + 로거 불일치 WARNING |
| maintainability | LOW | 테스트 fixture / DTO 비즈니스 로직 혼재 / 보안 분산 WARNING |
| testing | MEDIUM | 경계값 + 방어 경로 누락 WARNING; e2e 세부 검증 INFO |
| documentation | LOW | JSDoc deprecation 안내 + `_args` 미문서 WARNING |
| api_contract | MEDIUM | silent breaking change WARNING 2건 |
| user_guide_sync | LOW | i18n dict stale WARNING (parity 가드 영향) |

## 라우터 결정

- 실행: 10 (security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync)
- 제외 (의미 없음): performance / dependency / database / concurrency

## 권장 조치사항 (resolution-applier 처리 권장)

| 우선순위 | 항목 | RESOLUTION 처리 방향 |
|---|---|---|
| 즉시 | #12 i18n dict 툴팁 갱신 (KO/EN parity 가드 영향) | 자동 fix — 두 dict 파일 갱신 |
| 즉시 | #1, #13 executionFailed silent breaking change 마이그레이션 안내 | 자동 fix — Convention Changelog + types.ts JSDoc @deprecated + runtime warn |
| 권장 | #3 console.warn → NestJS Logger | 자동 fix — small refactor |
| 권장 | #4, #5 테스트 경계값 / 방어 경로 추가 | 자동 fix — spec 케이스 신설 |
| 권장 | #6 warn 로그 triggerId 추가 | 자동 fix |
| 권장 | #7 statusCode "?" assertion 강화 | 자동 fix |
| 권장 | #11 JSDoc deprecation 안내 | 자동 fix |
| 권장 | #2 languageLocale KO default 행동 변경 명시 | docs (이미 user-guide 에 있음 — 추가 cross-link 검토) |
| 참고 | #8, #9, #10, #14 maintainability / 앵커 | 별 follow-up plan 또는 본 PR 안 작은 정리 |

본 PR 영역의 핵심 보안 개선 (CCH-ERR-03) 은 정상 — Critical 없음. 본 PR 안에서 resolution-applier 가 우선순위 "즉시"·"권장" 항목 자동 처리하고 RESOLUTION.md 작성 권장.
