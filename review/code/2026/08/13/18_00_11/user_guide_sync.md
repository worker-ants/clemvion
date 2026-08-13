# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(표 21행 + "자주 누락되는 항목")을 Read 해 적재했다.

## 변경 파일 식별

프롬프트에 포함된 46개 파일 중 실제 `codebase/**` 소스 변경은 다음 6개뿐이다 (나머지는 `plan/**` 메모 2건 + 이전 리뷰 라운드(`14_01_46`, `17_15_21`)와 consistency-check(`14_18_42`, `17_05_10`)의 산출물 `review/**` 38건 — 이들은 매트릭스 대상이 아니다):

1. `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (테스트만, 프로덕션 코드 변경 없음)
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (테스트)
3. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (admission/lock/status-update 3곳에 `Array.isArray` fail-closed 가드 + throw)
4. `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` (테스트)
5. `codebase/backend/src/modules/executions/executions.service.spec.ts` (테스트)
6. `codebase/backend/src/modules/executions/executions.service.ts` (`SNAPSHOT_CACHE_MAX_ENTRIES` export + `computeChainDepth` 에 동일한 `Array.isArray` fail-closed 가드)

`git log` 로 확인한 결과 이 6개 파일은 이미 별도 커밋(`4fcc1b43a`, `c31c96529`, `b3782f562`)으로 HEAD 에 반영돼 있고, 현재 워킹 트리엔 이 세션(`18_00_11`) 자신의 리뷰 산출물 디렉토리 외 변경이 없다(`git status --short` 확인).

## trigger 매칭 결과

- **`codebase/backend/src/nodes/**`** (새 노드 추가 / 노드 schema 변경) — 매칭 파일 없음.
- **`codebase/frontend/src/**/*.tsx`** (신규 UI 문자열) — 매칭 파일 없음.
- **`codebase/frontend/src/content/docs/**`** (신규 섹션 디렉토리 / 통합 제공자 변경) — 매칭 파일 없음.
- **`codebase/backend/src/modules/auth/**`** (인증·권한·세션 흐름 변경) — 매칭 파일 없음.
- **`codebase/packages/expression-engine/**`** (표현식 언어 변경) — 매칭 파일 없음.
- **`codebase/backend/src/nodes/core/error-codes.ts`** (신규 errorCode) / warningRules (신규 warningCode) — 매칭 파일 없음. `grep -n "ErrorCode\|warningRules"` 로 변경된 6개 파일 전체를 확인했고, `executions.service.ts` 에 기존 `ErrorCode` import(line 21)가 있으나 이번 diff 범위 밖(기존 코드)이며 신규 enum 값 추가는 없다.
- **"실행·디버깅 흐름 변경" (semantic, `05-run-and-debug/`)** — 가장 근접한 후보. `execution-engine.service.ts`/`executions.service.ts` 는 execution 엔진 핵심 파일이지만, 이번 변경 내용은 (a) `EntityManager.query()` 의 선언 타입이 `Promise<any>` 라 드라이버가 배열이 아닌 값을 반환하는(정상 postgres 드라이버에서는 사실상 발생하지 않는) 극단적 edge case 에 대한 방어적 `Array.isArray` 가드 3~4곳, (b) `SNAPSHOT_CACHE_MAX_ENTRIES` LRU 캐시 경계값 테스트 신설이다. 사용자에게 노출되는 새로운 실행 상태·디버그 화면·로그 필드·재실행 정책 값(RR-PL-05 상한 32 등 기존 값 불변)이 추가되지 않았고, 정상 경로 동작(성공 시 응답)도 바뀌지 않는다 — 단지 이미 문서화된 종결 이벤트 계약(EIA §6, spec 기 반영)을 극단적 오류 상황에서 조용히 어기지 않도록 만드는 하드닝이다. 따라서 `05-run-and-debug/` 갱신을 요하는 "흐름 변경" 으로 보기엔 근거가 약하다 — 회색지대이나 확정적이지 않아 아래 INFO 1건으로만 남긴다.

## 발견사항

- **[INFO]** "실행·디버깅 흐름 변경" trigger 근접 매칭이나 확정적이지 않음
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/executions/executions.service.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "실행·디버깅 흐름 변경 → `codebase/frontend/src/content/docs/05-run-and-debug/`" (PROJECT.md 표 151행)
  - 상세: 두 파일 모두 execution 엔진 핵심 로직이라 표면적으로는 이 trigger 후보이지만, 실제 diff 는 DB 드라이버가 계약을 어길 때(배열이 아닌 반환)에 한정된 방어적 `Array.isArray` 가드와 그에 대한 회귀 테스트일 뿐이다. 정상 실행/재실행/디버그 흐름의 사용자 가시 동작(상태값·재시도 정책·로그 화면)은 변경되지 않았다.
  - 제안: 조치 불요로 판단. 다만 `computeChainDepth`(RR-PL-05 체인 깊이 제한)나 admission 상태 전이(`admitted`/`cancelled`/`deferred`) 값 자체가 향후 바뀌는 변경이 생기면 그때는 `05-run-and-debug/` 갱신을 재검토할 것.

## 요약

매트릭스 21개 trigger 중 이번 changeset(실제 `codebase/**` 변경 6개 파일, 전부 execution-engine/executions/chat-channel 내부 방어 가드·LRU 캐시 경계 테스트)에 확정 매칭되는 trigger 는 없다. 노드 추가/스키마 변경, 신규 TSX 문자열, docs 섹션 신설, 통합 제공자 변경, 인증 흐름 변경, 표현식 언어 변경, 신규 warningCode/errorCode 발행 — 어느 trigger 도 매칭되지 않았고, i18n dict·backend-labels.ts·locale.ts·docs MDX 어느 것도 이 changeset 과 무관하다. "실행·디버깅 흐름 변경" 만 근접 후보였으나 사용자 가시 동작 변화가 없어 INFO 1건(비차단)으로 그친다. 나머지 40개 파일(`plan/**` 2건 + `review/**` 38건)은 매트릭스 영역 밖이다.

## 위험도

NONE
