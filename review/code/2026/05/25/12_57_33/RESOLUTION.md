# RESOLUTION — 12_57_33

**세션**: `review/code/2026/05/25/12_57_33`
**대상**: chat-channel-error-notify (CCH-ERR-*) PR — 5 commit
**처리일**: 2026-05-25

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `1d8441d` | `types.ts` `ChatChannelConfig.languageHints` JSDoc 에 `@deprecated executionFailed` 단일 키 → CCH-ERR-* 6 키 마이그레이션 안내 추가 |
| #3 | 코드 | `1d8441d` | `execution-failure-classifier.ts` `console.warn` → `new Logger('ChatChannelFailureClassifier').warn(...)` 교체. 주석 "pure" → "side-effect free except diagnostic warn log" 수정 |
| #4 | 코드 | `1d8441d` | `execution-failure-classifier.spec.ts` `extractStatusCode` 경계값 3종 추가: `statusCode: 0` (정수 통과—현재 구현 문서화), `1.5` (float→omit), `-200` (음수 정수—현재 구현 문서화) |
| #5 | 코드 | `1d8441d` | `execution-failure-classifier.spec.ts` `event.error` undefined 강제 캐스팅 방어 경로 테스트 1건 추가 |
| #6 | 코드 | `1d8441d` | `execution-failure-classifier.ts` unknown code fallback warn 로그 payload 에 `triggerId: event.triggerId` 추가 (CCH-ERR-04 structured log 보강) |
| #7 | 코드 | `1d8441d` | `discord-message.renderer.spec.ts` HTTP_5XX without statusCode 케이스: `?` 치환 assertion + `'일시적'` prefix 검증 추가 (KO 5xx 분기 확인) |
| #11 | 코드 | `1d8441d` | #1 과 동일 처리 (JSDoc deprecation 안내) |
| #12 | 코드 | `1d8441d` | `ko/triggers.ts` + `en/triggers.ts` `chatChannel.languageHintsHelp` 에 CCH-ERR-* 6 키 목록 + `{statusCode}` placeholder 안내 추가 (KO/EN parity 동시 갱신) |
| #13 | 코드 | `1d8441d` | `language-hint-defaults.ts` `resolveLanguageHint` 안에서 `languageHints.executionFailed` 존재 시 1회 runtime `console.warn` (structured deprecation log). 테스트 갱신 |

## TEST 결과

- lint  : 통과 (28s)
- unit  : 통과 (4884 passed, 29s)
- build : (lint/unit 통과 확인 후 e2e 가 내부 빌드 포함)
- e2e   : 통과 (123/123, 60s) — `_test_logs/e2e-20260525-131418.log`

## 보류·후속 항목

- **W#2** (languageLocale KO default 행동 변경 명시): user-guide 의 `06-integrations-and-config/telegram.mdx` 및 `slack.mdx`/`discord.mdx` 에 이미 `languageLocale: 'en'` 안내가 포함됨. 추가 cross-link 필요 여부는 user-guide 담당자 검토 권장. 별도 코드 변경 불필요.
- **W#8** (테스트 fixture `'e'`/`'t'`/`'w'` 단일 문자 값): 기능 버그 아님, maintainability 수준. 후속 PR 에서 `executionId: 'exec-base'` 등 의미 있는 이름으로 교체 권장.
- **W#9** (`findFirstUnknownPlaceholder` / `FAILURE_HINT_KEYS` DTO 혼재): 리팩토링 필요 아키텍처 개선. `shared/language-hint-keys.ts` 추출 후 DTO 에서 import 패턴으로 변경 — 별도 refactor plan 권장.
- **W#10** (CCH-ERR-03 enforcement 3레이어 분산 — 보안 계층 지도 주석 누락): `language-hint-defaults.ts` 상단에 "보안 계층 지도" 주석 추가로 처리 가능. 기능 변경 없음 — 후속 PR 권장.
- **W#14** (MDX 섹션 번호 renumber 앵커 파단 가능성): 대상 6 MDX 파일 (`discord.mdx`/`.en.mdx`, `slack.mdx`/`.en.mdx`, `telegram.mdx`/`.en.mdx`) 이미 PR 에 포함됨. 앵커 redirect 또는 `id` 속성 수동 지정은 별도 PR 에서 처리 권장 (`e2e 면제 화이트리스트` 대상이므로 코드 회귀 위험 없음).
- **INFO 17건**: 본 PR 통과 후 별도 plan 또는 follow-up 단계 처리 권장 (핵심: MaxLength DoS 가드, `Object.hasOwn` 사용, LanguageLocale 타입 중복 통합, 3 renderer boilerplate 공통화, Slack/Telegram fallback 테스트, warnSpy 호출 횟수 검증).
