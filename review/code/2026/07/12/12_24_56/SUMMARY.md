# Code Review 통합 보고서

## 전체 위험도
**LOW** — disclaimer 문구를 3파일(`demo-config.ts`/`snippet.html`/`2-sdk.md`)에서 해요체로 통일하는 순수 카피 수정. CRITICAL/기능 결함 없음. 유일한 지적은 동일 문구가 여러 파일에 리터럴로 중복돼 SSOT/자동 drift 검증이 없다는 구조적 WARNING(이번 diff 가 만든 문제 아님, 선례 있음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 동일 disclaimer 문구가 `demo-config.ts`/`snippet.html`/`2-sdk.md`(+ `web-chat-sdk.mdx`) 4곳에 리터럴로 중복 — single source of truth 부재이며 값이 달라져도 실패하는 자동 검증(테스트)이 없음. 이 코드베이스에는 정확히 동일한 3-파일 토폴로지(데모/스니펫 예제/spec)에서 문자열이 drift 됐던 전례가 있음(`2-sdk.md` §R5, command-queue 스텁, 2026-06-25에 발견·복원) — 동일 클래스 재발 위험 (maintainability, testing 공통 지적) | `demo-config.ts:30`, `snippet.html:44`, `2-sdk.md:246` | (a) `demo-config.ts` 의 기본 disclaimer 값을 export 하고 다른 두 문서가 "그 값과 동일해야 함"을 주석으로 명시, 또는 (b) 4곳 문자열을 비교하는 경량 테스트(또는 spec-link-integrity 확장)를 추가해 향후 drift 를 기계적으로 차단. 이번 diff 자체의 스코프는 아니므로 후속 항목으로 제안 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 정합성/spec-fidelity | 서로 다른 문체(합니다체/습니다체/생략 placeholder)였던 3곳 문구가 canonical 소스(`web-chat-sdk.mdx`)와 byte 단위로 일치하는 문구로 완전 수렴 — 저장소 전수 grep 결과 옛 문구 잔존 0건, i18n-userguide Principle 6(해요체) 위반이 완결적으로 해소됨 (requirement, maintainability, documentation 공통 확인) | `demo-config.ts:30`, `snippet.html:44`, `2-sdk.md:246`, `web-chat-sdk.mdx:50` | 없음 — 조치 완료로 판단 |
| 2 | 테스트 | 기존 `demo-config.test.ts` 는 `disclaimer` 기본값 문자열에 결합돼 있지 않고(자체 override 값 `" 주의 "` 사용해 trim 동작만 검증) 이번 diff 로 깨지는 테스트 없음 — 카피 변경에 강건한 바람직한 테스트 설계 | `demo-config.test.ts:62-124` | 없음 — 현행 유지 권장 |
| 3 | 정합성 | 인접 테스트 fixture 에 구 문체("...동작합니다.") 잔존 — 이번 diff 범위 밖 파일이며 canonical 문구와 동기화 의무 없는 임의 렌더링 fixture | `widget-app.test.tsx:44,53` | 강제 아님. 후속에 해요체로 맞추면 grep 기반 tone drift 스캔 잡음 감소에 도움 |
| 4 | 문서화 | CHANGELOG 미기재는 순수 카피/톤 통일 커밋에 대한 기존 프로젝트 관례와 부합(선례: `f718c6431`, `1902b4621` 모두 CHANGELOG 미기재) — 결함 아님 | `CHANGELOG.md` (본 diff 미포함) | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 문자열 리터럴 교체, 인젝션/시크릿/인증/암호화 표면 없음 |
| requirement | NONE | i18n-userguide P6(해요체) 준수로 정확히 정렬, canonical 소스와 byte 일치 확인. INFO 1건(범위 밖 fixture) |
| scope | NONE | 3파일 각 1줄 변경만, 의도와 diff 범위 정확히 일치 |
| side_effect | NONE | 상태/시그니처/인터페이스/네트워크/파일시스템 영향 없음, 기존 테스트 비의존 확인 |
| maintainability | LOW | WARNING 1건(리터럴 중복·SSOT 부재, drift 재발 전례 있음) + INFO 1건(수렴 개선) |
| testing | NONE | 신규 테스트 불요, 기존 테스트 비결합 확인. INFO 3건(중복 drift 갭 포함) |
| documentation | NONE | 수정 완결·잔존 drift 0건, CHANGELOG 관례 부합 확인 |

## 발견 없는 에이전트

security, scope, side_effect

## 권장 조치사항
1. (우선순위 낮음, 선택) `demo-config.ts` 의 `defaultDemoForm.disclaimer` 를 공유 상수로 export 하거나, `demo-config.ts`/`snippet.html`/`2-sdk.md`/`web-chat-sdk.mdx` 4곳의 문자열 일치를 검증하는 경량 테스트(또는 spec-link-integrity 확장)를 추가해 이 코드베이스에서 반복된 3-파일 drift 전례의 재발을 기계적으로 차단 — 이번 PR 필수 아님, 후속 항목.
2. (선택) `widget-app.test.tsx` 의 fixture 문구를 해요체로 맞춰 tone drift grep 스캔 시 잡음(non-canonical 잔존)을 줄임 — 강제 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원)
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | disclaimer 텍스트 리터럴 교체 — 성능 영향 표면 없음 |
  | architecture | 함수/모듈 구조·경계 변경 없는 순수 콘텐츠 수정 |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 스키마/쿼리 관련 변경 없음 |
  | concurrency | 동시성/상태 관리 코드 변경 없음 |
  | api_contract | API 시그니처/DTO/계약 변경 없음(문자열 리터럴만 변경) |
  | user_guide_sync | 대상 파일이 사용자 가이드 문서 동기화 매트릭스 범위 밖(spec 예시·SDK 예제·데모 기본값) |
