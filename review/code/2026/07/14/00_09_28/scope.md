# 변경 범위(Scope) Review

## 대상

- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts`
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`
- `spec/5-system/15-chat-channel.md`

## 컨텍스트 확인

`plan/in-progress/eia-command-waiting-surface-guard.md` F-2 항목("채팅 채널 표면 불일치 입력의 graceful 안내")을 대조한 결과, 7개 파일 모두 이 단일 작업 항목(사용자에게 `surfaceMismatch` best-effort 안내를 발송)에 직접 대응한다. 구현(핵심 로직 + 통합 지점) → 테스트 → 문서(운영자 가이드) → spec(SoT) 갱신까지 하나의 기능을 완결적으로 다루는 구성이며, CLAUDE.md 의 "plan 은 spec 갱신까지 정식 phase 로 포함" 원칙과도 부합한다.

## 발견사항

- **[INFO]** `forwardToInteractionService` 시그니처 확장 (`config`, `adapter` 파라미터 추가)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:736-738` (시그니처), 호출부 `:621-628`
  - 상세: 기존 private 메서드에 파라미터 2개가 추가되고 호출부도 함께 수정됨. 언뜻 "의도 이상의 변경"으로 보일 수 있으나, 신설되는 `sendSurfaceMismatchNotice(update, config, adapter)` 호출에 `config`/`adapter` 가 반드시 필요하므로 F-2 기능 구현에 직접 종속된 필연적 변경이다. 다른 메서드 시그니처·호출부는 손대지 않았고, diff 범위도 필요한 최소 라인에 한정됨.
  - 제안: 없음 (범위 내 정상 변경).

- **[INFO]** 신규 테스트에 정규식 상수(`MD_V2_SPECIALS`) 추가
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts:40-43`
  - 상세: "default 문구가 telegram MarkdownV2 특수문자를 포함하면 안 된다"는 신규 설계 제약(주석·spec §4.1.1 Rationale 병기)을 검증하기 위한 전용 테스트 헬퍼로, 기존 테스트 스타일과 이질감 없이 해당 describe 블록 내부에 로컬 스코프로 배치됨. 범위를 벗어나는 유틸리티 확장이 아님.
  - 제안: 없음.

그 외 항목별로:
1. **의도 이상의 변경**: 없음 — 모든 diff hunk 가 `surfaceMismatch` 안내 기능(defaults, resolver, 발송 로직, 테스트, 문서, spec)에만 좁게 대응.
2. **불필요한 리팩토링**: 없음 — 기존 함수·구조(`resolveSessionExpiredMessage` 등)는 그대로 두고 동일 패턴을 복제해 신규 함수를 추가하는 방식(관례 일치, 리팩토링 아님).
3. **기능 확장(over-engineering)**: 없음 — 3-level lookup(override → locale → ko fallback) 패턴은 기존 `sessionExpired`/`formOpenLabel`과 동일 관례를 재사용한 것으로 신규 설계 도입이 아님. 발송 실패 swallow 방식도 기존 `sendExecutionStillRunningNotice`/`maybeNotifyIgnored`와 동일 패턴.
4. **무관한 수정**: 없음 — 문서 2건(`telegram.mdx`/`telegram.en.mdx`)은 §7.4 섹션만 신규 추가, 기존 §7.1~7.3·§8 내용 변경 없음. spec 파일도 신규 키 1개(JSON 예시 1줄 + 표 1행 + 설명 단락)만 추가.
5. **포맷팅 변경**: 없음 — 모든 diff 가 순수 추가(added lines)이며 기존 라인의 재포맷/재배치 흔적 없음.
6. **주석 변경**: 신규 코드에 대한 신규 주석만 추가(JSDoc, F-2 태그, MarkdownV2-safe 근거 설명). 기존 주석 삭제/수정 없음.
7. **임포트 변경**: `resolveSurfaceMismatchMessage`, `SURFACE_MISMATCH_DEFAULTS`, `type LanguageLocale` — 모두 새로 추가된 코드에서 실사용. 미사용 임포트나 기존 임포트 정리 없음.
8. **설정 변경**: 없음 — 설정 파일(tsconfig, eslint, package.json 등) 변경 없음. `spec/5-system/15-chat-channel.md` 변경은 코드가 아닌 SoT 문서로, 신규 기능의 계약을 기술하는 정상적 spec 동기화.

## 요약

7개 파일 변경 전체가 plan F-2("표면 불일치 안내") 단일 작업 항목에 정확히 대응하며, 구현 로직·테스트·운영자 문서·spec SoT 갱신이 모두 동일 범위 내에서 비례적으로 이뤄졌다. `forwardToInteractionService` 시그니처 확장은 표면적으로는 범위 밖처럼 보일 수 있으나 신규 안내 발송에 필수적인 최소 변경이며, 나머지 diff 는 순수 추가(additive)로 무관한 리팩토링·포맷팅·주석 정리·임포트 정리·설정 변경이 전혀 섞여 있지 않다.

## 위험도

NONE
