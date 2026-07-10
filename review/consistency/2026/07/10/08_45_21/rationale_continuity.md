# Rationale 연속성 검토 — spec/5-system/3-error-handling.md

> 검토 대상 diff: `## Overview` 도메인 목록 문구 확장 + 신규 `§1.2.1`(2FA/WebAuthn/재인증 코드)·`§1.8`(KB/Graph RAG 코드) "도메인 spec 참조" 섹션 추가. plan: `plan/in-progress/error-codes-catalog-sot.md`.

## 방법론 메모

`prompt_file` 의 "관련 Rationale 발췌" 는 `spec/0-overview.md` ~ `spec/2-navigation/4-integration.md` 범위에서 크기 한도로 truncate 되어, target 과 직접 연관된 도메인 spec(`1-auth.md`·`10-graph-rag.md`·`conventions/error-codes.md`·`4-execution-engine.md` 등 `5-system/*`)의 Rationale 은 payload 에 포함되지 않았다. 이 gap 을 메우기 위해 저장소에서 해당 파일들을 직접 Read 해 대조했다 (`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/conventions/error-codes.md`, target 자체의 `## Rationale`, `git log -p --all -- spec/5-system/3-error-handling.md` 로 과거 WebAuthn/2FA/KB 언급 이력 확인).

## 발견사항

- **[INFO]** 신규 등재가 오히려 기존에 선언된 SoT 원칙의 미이행 갭을 해소함
  - target 위치: `## Overview` 2번째 단락, `§1.2.1`, `§1.8`
  - 과거 결정 출처: `spec/conventions/error-codes.md` §Overview "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)" — 이 선언은 §1 이 **프로젝트 전체** 에러 코드의 카탈로그 SoT임을 이미 전제한다.
  - 상세: 기존 `3-error-handling.md §1`은 WS commands(§1.5)·EIA REST(§1.6)·webhook(§1.7)만 "도메인 spec 참조, 카탈로그 가시성만 등재" 패턴으로 담고 있었고, `1-auth.md`(WebAuthn/2FA/재인증 7종)와 `10-graph-rag.md`(`KB_REEXTRACT_IN_PROGRESS`)는 대상에서 빠져 있었다 — `error-codes.md` 의 "전체 SoT" 선언과 실제 §1 내용 사이에 completeness gap 이 있었다(#880 impl-done convention_compliance 가 지적한 pre-existing 이슈, plan 배경 참조). 이번 변경은 그 gap 을 §1.5~§1.7 과 **동일한 기존 패턴**(정의·트리거 SoT는 도메인 spec 유지, §1은 등재만)으로 메운 것이라 새 원칙 도입이 아니라 기존 원칙의 완결이다. `git log -p --all -- spec/5-system/3-error-handling.md` 전체 이력에 WebAuthn/2FA/`KB_REEXTRACT_IN_PROGRESS` 언급이 전혀 없어(이번이 최초 등재), "과거에 의도적으로 제외했던 항목을 재도입" 하는 사례도 아님을 확인했다.
  - 제안: 조치 불필요. 다만 향후 독자가 "왜 이제 와서 §1.2.1/§1.8 이 추가됐는가"를 spec 파일만 보고 알 수 있도록, target 자신의 `## Rationale` 에 1~2문장짜리 짧은 항목("§1 카탈로그 완결성 — 도메인 spec 참조 패턴을 auth/KB 도메인으로 확장, 근거: `error-codes.md` §1 SoT 선언과의 정합")을 추가하면 plan 문서가 archive 로 이동한 뒤에도 근거 추적성이 spec 자체에서 닫힌다.

- **[INFO]** 코드값·HTTP status·의미 원문 대조 결과 — 재정의 없음 확인
  - target 위치: `§1.2.1` 표 7행, `§1.8` 표 1행
  - 과거 결정 출처: `spec/5-system/1-auth.md` §1.4.3/§5(WebAuthn 엔드포인트 표)·§2.3, `spec/5-system/10-graph-rag.md` §5.1/§7
  - 상세: `WEBAUTHN_DISABLED`(503)·`WEBAUTHN_VERIFY_FAILED`(400)·`INVALID_OPTIONS_TOKEN`(400)·`CHALLENGE_INVALID`(401)·`WEBAUTHN_INVALID`(401)·`RECOVERY_CODE_INVALID`(401)·`REAUTH_NOT_AVAILABLE`(403)·`KB_REEXTRACT_IN_PROGRESS`(409) 모두 도메인 spec 원문의 HTTP status·트리거 조건과 1:1 일치. `conventions/error-codes.md` §1 "의미 기반 명명" 원칙이나 §3 historical-artifact 레지스트리와도 충돌 없음(신규 코드가 아니라 기존 발행 코드의 카탈로그 등재이므로 명명 규율 자체는 적용 대상 아님).
  - 제안: 없음 (참고용 기록).

## 요약

target 변경은 `3-error-handling.md §1`을 "프로젝트 전체 에러 코드 카탈로그 SoT"로 선언한 `conventions/error-codes.md` 의 기존 원칙을 실제로 완결시키는 순수 등재(visibility-only) 작업이며, 이미 확립된 §1.5~§1.7 "도메인 spec 참조" 패턴을 auth(§1.2.1)·KB/Graph RAG(§1.8) 도메인으로 그대로 확장한다. 코드값·HTTP status·트리거 의미는 도메인 SoT(`1-auth.md`, `10-graph-rag.md`) 원문과 정확히 일치하며 재정의가 없고, 과거 커밋 이력 전체에서 이 코드들이 의도적으로 배제됐던 정황도 없어 "기각된 결정의 재도입"이나 "무근거 번복"에 해당하는 사례를 찾지 못했다. 유일한 보완 여지는 이 completeness-gap 해소의 배경을 target 자체 `## Rationale` 에도 짧게 남겨 plan 문서 archive 이후에도 추적성을 유지하는 것(INFO, 비차단).

## 위험도
NONE
