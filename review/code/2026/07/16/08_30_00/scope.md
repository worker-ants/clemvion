# 변경 범위(Scope) Review

## 대상

`control-plane 안내 발송 per-provider escape 이관 (F-5 근본 fix)` — 19개 파일 (adapter 인터페이스 3종 구현체 + 테스트, HooksService, DTO 검증기 제거, spec 3건, CHANGELOG, plan 문서).

## 발견사항

- **[INFO]** F-5(`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`chat-channel/shared/markdown-v2.ts`+spec) 전체 삭제
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`, `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts`(+`.spec.ts`, 파일 삭제)
  - 상세: 직전 커밋(#950)에서 신설된 등록 시점 MarkdownV2 검증 기능을 이번 변경이 통째로 되돌린다. 통상적인 "요청 범위 밖 추가 삭제"로 보일 수 있으나, `plan/in-progress/control-plane-provider-escape.md` 에 "F-5 는 interim 이었고 이 근본 fix 로 대체됨" + "사용자 결정(2026-07-14): 근본 fix 를 하자"가 명시되어 있고, CHANGELOG·spec 3곳 모두 동일한 근거로 갱신되어 있어 계획된 축소가 아니라 **사전 승인된 과업의 핵심 산출물**로 판단된다. 스코프 위반이 아니라 태스크의 정의 자체.
  - 제안: 없음 (근거 문서화 충분). 참고용 기록.

- **[INFO]** `spec/conventions/chat-channel-adapter.md` §1.1 절 제목이 `6함수 책임` → `어댑터 함수 책임`으로 변경
  - 위치: `spec/conventions/chat-channel-adapter.md:120`
  - 상세: `escapeControlText` 신규 메서드 추가로 인터페이스 함수 개수가 6→7이 되어 제목의 구체적 숫자가 부정확해진 것을 제거한 결과. 새 메서드 추가에 직접 종속된 필연적 수정이며 무관한 리팩토링이 아니다.
  - 제안: 없음.

## 스코프 내 확인된 항목 (참고)

- 어댑터 인터페이스에 `escapeControlText` 추가 → 3개 provider(`telegram`/`slack`/`discord`) 어댑터 구현 + 각 단위 테스트, `FakeAdapter`(registry spec) mock 갱신, `HooksService` mock 갱신은 인터페이스 변경의 필연적 파급(compile-time 요구)이며 임의 확장 아님.
- `HooksService` 의 `sendBestEffortNotice`/`help`/`formValidationFailed`/`formNextField` 발송 경로가 `adapter.escapeControlText()` 경유로 변경 + `\\.`→`.` 평문 default 정리는 문제 설명(cross-provider literal 노출 버그)과 정확히 대응.
- CHANGELOG.md 항목 1건 추가, 기존 다른 Unreleased 섹션 미변경.
- `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md` 갱신 범위는 모두 F-5 제거·`escapeControlText` 도입과 직접 연관된 문구/표에 국한.
- `plan/in-progress/control-plane-provider-escape.md` 신규 — SDD 규약상 정상적인 작업 추적 문서.
- 포맷팅 전용 diff, 미사용 import 추가/정리, 관련 없는 주석 변경, 설정 파일(`.env`, tsconfig, eslint 등) 변경은 발견되지 않음.
- diff 전반에서 로직과 무관한 개행/공백 재정렬(reflow)은 관찰되지 않음(예: `hooks.service.ts`의 3항 표현식 줄바꿈 조정은 새로 추가된 `adapter.escapeControlText(...)` 래핑에 따른 불가피한 재포맷).

## 요약

19개 파일 변경 전부가 단일 목표("HooksService의 control-plane 직접발송 경로에 provider별 escape 책임을 어댑터로 이관하고, 그 전 단계 interim 검증(F-5)을 제거")로 수렴하며, plan 문서·CHANGELOG·spec 3건이 동일한 근거로 일관되게 갱신되어 있다. F-5 관련 코드 삭제는 표면적으로 "이전 기능 되돌림"처럼 보이지만 사용자의 명시적 승인("근본 fix 를 하자")과 원래 F-5가 예고된 interim 조치였다는 배경 문서(`plan/complete/eia-command-waiting-surface-guard.md`)가 뒷받침되어 스코프 이탈로 볼 수 없다. 어댑터 인터페이스 확장에 따른 3개 provider 구현·테스트·mock 동시 갱신은 TypeScript 컴파일 요구상 불가피한 파급이지 임의 확장이 아니다. 포맷팅/주석/임포트/설정 관련 무관한 변경은 발견되지 않았다.

## 위험도

NONE
