# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 를 SSOT 로 Read.
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (142~156행) 을 보조로 Read.
- 변경 file 목록은 prompt 내 22개 실제 코드/plan 파일(1~6번) + 이전 라운드
  (`14_54_36`, `15_22_06`, `15_16_28`, `15_42_35`) 의 review/consistency 산출물
  40개(7~46번, 자기 자신의 형제 reviewer 출력 — 신규 코드 변경 아님)로 구성됨을 확인.
  `git status --short` 로 저장소 상태 확인(현재 세션 산출 디렉터리만 untracked, 뮤테이션 없음).

## 변경 changeset 요약

- `CHANGELOG.md` — 신규 Unreleased 항목 1건 (§5.4 drift 정정 배경 서술)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  — `ExecutionStatusDto` 5필드(`durationMs`/`currentNode`/`context`/`result`/`error`)의
  `@ApiPropertyOptional({nullable:true}) field?: T | null` → `@ApiProperty({nullable:true}) field: T | null`.
  **필드 추가·삭제·이름 변경 없음, 신규 필드 없음** — 기존 5필드의 OpenAPI `required` 메타데이터만
  실제 동작(상시 present, null 가능)에 맞춤.
- 대응 `.spec.ts` — `required` 축 신규 단언 추가(테스트 강화, 프로덕션 API 표면 무변경)
- `plan/**` 3개 — plan 체크박스·후속 트래커 갱신 (라이프사이클 문서, docs 대상 아님)
- 나머지 40개 — 이전 리뷰 라운드(`14_54_36`/`15_22_06`/`15_16_28`/`15_42_35`)의 review/consistency
  산출 markdown/json (자기 자신과 같은 계열의 부산물, 코드 변경 아님)

## 매트릭스 매칭

- `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) — 미매칭. 변경분에 `src/nodes/`
  경로 없음(단, `error-codes.ts` 도 `src/nodes/core/` 이지만 이번 diff 에 없음).
- `new-ui-string` (`codebase/frontend/src/**/*.tsx`) — 미매칭. frontend TSX 변경 없음.
- `integration-provider-change` / `new-userguide-section-dir` — 미매칭. `codebase/frontend/src/content/docs/**` 무변경.
- `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — 미매칭.
- `expression-language-change` (`codebase/packages/expression-engine/**`) — 미매칭.
- `run-debug-flow-change` (semantic, 실행·디버깅 **흐름** 변경) — **검토했으나 미해당.** `ExecutionStatusDto`
  는 `05-run-and-debug/` 문서가 다루는 실행 상태 폴링 표면과 관련은 있지만, 이번 diff 는 흐름·필드
  구성·의미를 바꾸지 않고 이미 존재하던 5필드의 OpenAPI `required` 플래그만 실제 동작에 맞춘 것이다.
  `CHANGELOG.md` 자체가 "동작 변경은 없다. 서버가 내보내는 값은 그대로" 라고 명시하고, 같은 배치의
  다른 8개 reviewer(`api_contract.md`/`documentation.md`/`security.md` 등, `14_54_36` 세션)가 wire-level
  무변경을 각자 독립적으로 재실측 확인했다. 사용자가 실행/디버그 패널에서 관측하는 동작·필드
  구성에 변화가 없으므로 `05-run-and-debug/` 갱신 대상 아님.
- `new-warning-code` / `new-error-code` — 미매칭. `warningRules`/`error-codes.ts` 무변경.
- `backend-api-change` (`codebase/backend/src/**/dto/**`, glob 매칭) — **매칭됨.** target (a) "controller·DTO
  의 swagger jsdoc" 은 이번 diff 자체가 그 정정 작업이므로 이미 충족. target (b) "API 노출 변경이
  사용자 안내에 영향 → 관련 user-guide 페이지" 는 **적용 대상 아님** — 새 필드 노출·필드 삭제·의미
  변경이 없고, OpenAPI 스키마가 뒤늦게 기존 런타임 동작을 따라잡은 것뿐이다(§5.4 `#1277`/`#1280`
  정정에 따른 소급 정합화). `codebase/frontend/src/content/docs/**` 어떤 페이지도 OpenAPI `required`
  플래그를 직접 서술하지 않으므로 갱신 대상이 없다.
- `spec-major-change` (`spec/2-*/**` 등) — 미매칭. 이번 diff 는 `spec/` 파일을 건드리지 않는다
  (§5.4 정정은 선행 커밋 `#1277`/`#1280` 에서 이미 완료됨).

## 발견사항

없음. `backend-api-change` 트리거가 glob 상 매칭됐으나 의미상 사용자 가이드 동반 갱신이 필요한
"API 노출 변경"에 해당하지 않는다 — 신규/삭제/재정의 필드 없이 기존 5필드의 OpenAPI 메타데이터
정확도만 개선한 순수 계약-정합화(wire 불변, CHANGELOG·8개 형제 리뷰어 실측이 이를 뒷받침)이므로
누락으로 분류하지 않는다.

## 요약

매트릭스 21개 trigger 중 glob 상 매칭된 것은 `backend-api-change`(`dto/**`) 1건뿐이며, 의미 판단 결과
target (a) swagger jsdoc 은 diff 자체가 충족하고 target (b) user-guide 페이지 갱신은 실제 API 노출
변화가 없어 적용 대상이 아니다. 나머지 20개 trigger(신규 노드, UI 문자열, 통합/제공자, 신규 섹션
디렉토리, auth/세션, 표현식 언어, 실행/디버깅 흐름, warning/error 코드 등)는 이번 changeset 의 파일
집합(백엔드 응답 DTO `required` 플래그 정정 2파일 + CHANGELOG + plan 3개 + 이전 라운드 review 산출물
40개)과 전혀 무관해 매칭되지 않는다. 동반 갱신 누락 0건.

## 위험도

NONE
