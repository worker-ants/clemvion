STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 방법

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행)을 SSOT 로 적재하고 `PROJECT.md` §변경 유형 →
갱신 위치 매핑 본문을 보조로 확인했다. 변경 파일 목록은 프롬프트 첨부분 + `git diff --name-only
origin/main...HEAD` 로 교차 확인(22개 실질 파일 — CHANGELOG, backend TS 8개, spec 6개, plan 3개,
review 산출물 다수는 이전 라운드 재커밋).

**이번 diff 는 frontend 코드(TSX·dict·backend-labels.ts)를 전혀 건드리지 않는다** — `codebase/backend/**`,
`spec/**`, `plan/**`, `review/**`, `CHANGELOG.md` 뿐이다. 이 점이 아래 판정의 핵심 전제다.

## 매트릭스 대조

| # | trigger | 매칭 여부 | 근거 |
|---|---|---|---|
| 1 새 노드 추가 | `codebase/backend/src/nodes/**` | 불일치 | nodes/ 디렉토리 파일 없음 |
| 2 노드 schema 변경 | 상동 | 불일치 | 상동 |
| 3 신규 UI 문자열(TSX) | `codebase/frontend/src/**/*.tsx` | 불일치 | frontend 파일 0개 변경 |
| 4 통합/제공자 변경 | semantic | 불일치 | provider 코드 없음 |
| 5 신규 섹션 디렉토리 | `codebase/frontend/src/content/docs/*/` | 불일치 | docs 디렉토리 변경 없음 |
| 6 인증·권한·세션 흐름 | `codebase/backend/src/modules/auth/**` | 불일치 | auth 모듈 미변경(이번 변경은 트리거 파라미터 검증) |
| 7 표현식 언어 변경 | `codebase/packages/expression-engine/**` | 불일치 | 미변경 |
| 8 실행·디버깅 흐름 변경 | semantic → `05-run-and-debug/` | **그레이존, 조사 후 불일치로 판정** | 아래 상세 |
| 9 신규 warningCode/errorCode | `codebase/backend/src/nodes/core/error-codes.ts`(glob) / warningRules(semantic) | **그레이존, 조사 후 "새 발행이지만 이미 다른 라운드가 triage" 로 판정** | 아래 상세 |

### #8 상세 — `execution-engine/` 변경이지만 GUI 흐름은 변경되지 않음

새 코드(`reject-masked-resubmission.ts`)는 `execution-engine` 모듈 아래 있지만, 이건 **실행
엔진의 실행/로깅 흐름 자체**가 아니라 실행 시작 **이전** 트리거 파라미터 검증에 얹힌 방어층이다.
동작이 사용자에게 보이는 유일한 지점은 `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
의 "Run with Input" 버튼인데, 이 버튼은 `hasMaskedMarkerLeaf` 로 **이미 클라이언트에서** 마스킹
마커를 막고 있다(PR #1188, 이번 diff 이전에 이미 존재·docs 반영됨). `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx:32` 가 이미
"자격증명으로 판별된 값은 `***` 로 가려져 오는데 ... 남아 있는 동안 실행 버튼이 비활성돼요" 로
정확히 이 UX 를 설명한다.

이번 PR 의 서버측 거부는 **그 UI 가드를 우회하는 API 직접 호출(curl 등)만** 겨냥한 2차 방어층이고
(CHANGELOG 명시: "프런트 가드는 렌더 경로라 curl 로 API 를 직접 치면 우회된다"), 정상 GUI 플로우의
관측 가능한 동작(버튼 비활성화 + 기존 안내)은 바뀌지 않는다. 또한 `editor-toolbar.tsx` 의
`handleRunWithInput` catch 블록은 현재도 `console.error` 만 하고 토스트를 띄우지 않아(기존 동작,
이 diff 미변경) 신규 400 이 GUI 에 새 문구로 노출되지도 않는다. 따라서 `05-run-and-debug/` 갱신
누락으로 볼 실질 근거가 없다 — INFO 로도 등재하지 않는다(불일치로 판정).

### #9 상세 — `MASKED_VALUE_RESUBMITTED` 는 이미 triage 된 기존 패턴의 4번째 사례

`trigger-parameter.types.ts` 에 `masked_value_resubmitted` reason / `MASKED_VALUE_RESUBMITTED` code
가 신설됐다. 다만 이는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum(노드
실행 에러 카탈로그, matrix row `new-error-code` 의 정확한 trigger)이 아니라, **별도의 소규모
분류 체계**(`TriggerParameterErrorDetail.code`: `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/
`INVALID_SCHEMA` + 이번 신규 4번째)다. `error-codes.ts` 자체는 이번 diff 에서 변경되지 않았다
(`git diff --name-only` 확인).

직접 검증: `grep -rl "MISSING_REQUIRED_FIELD\|TYPE_COERCION_FAILED\|INVALID_SCHEMA\|MASKED_VALUE_RESUBMITTED\|INVALID_TRIGGER_PARAMETERS" codebase/frontend/src` → **0 매치**. 즉 4개 코드
전부(기존 3개 + 신규 1개) frontend 어디에서도 `details[].code` 값을 파싱해 표시하는 경로가 없다
— `backend-labels.ts` 의 `ERROR_KO` 에도 4개 전부 없음. 사용자에게 영문 원시 코드가 그대로
노출될 표면이 현재 존재하지 않는다(매트릭스 CRITICAL 기준 "매핑 없으면 사용자에게 영문 그대로
노출"의 전제 자체가 이 경로에는 성립하지 않음).

이 gap 은 이번 diff 가 만든 새 이탈이 아니라 **기존 3형제와 동일한, 이미 있던 패턴**이고, 같은
changeset 안의 `review/code/2026/08/21/01_15_47/RESOLUTION.md`(미조치 INFO #10)가 정확히 이
사실("형제 3종도 동일, 이번 diff 의 이탈 아님")을 근거로 이미 조치 보류를 결정했다 — 위 grep 으로
그 근거를 독립적으로 재확인했다.

## 발견사항

- **[INFO]** `MASKED_VALUE_RESUBMITTED` 필드 에러 코드에 `backend-labels.ts` ko 매핑 부재 (기존 패턴 연장, 신규 이탈 아님 — 참고 등재)
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (REASON_TO_DETAIL 신규 항목, 게이트 59-62)
  - 매트릭스 항목: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시" (단, trigger glob 은 `error-codes.ts` 이며 이번 신규 코드는 그 enum 소속이 아님 — 엄밀한 glob 매칭은 불일치, 의미상 인접 케이스로 등재)
  - 누락된 동반 갱신: 있다면 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO['MASKED_VALUE_RESUBMITTED']`
  - 상세: 위 조사대로 현재 frontend 어디에도 이 4개 코드 계열을 소비하는 표시 경로가 없어 실사용자 영향은 없다. 다만 향후 누군가 `details[].code` 를 파싱해 필드별 인라인 에러를 보여주는 UI 를 붙이면(자연스러운 다음 단계), 그 시점에 4개 코드 전부에 대해 ko 매핑이 한 번에 필요해진다 — 지금 미루는 결정 자체는 타당하나 그 시점을 놓치지 않도록 추적이 필요.
  - 제안: 새 조치 불요(팀이 이미 `01_15_47` RESOLUTION 에서 근거를 남기고 보류 결정함, 이번 세션에서 독립 재검증 완료). 후속으로 `details[].code` 소비 UI 가 생기는 PR 에서 4개 코드 전부의 `ERROR_KO` 매핑을 일괄 추가하도록 그 PR 의 plan/체크리스트에 남겨 두는 것을 권장(이번 PR 스코프는 아님).

## 요약

매트릭스 9개 trigger 요약 항목 중 매칭 후보는 2개(#8 실행·디버깅 흐름, #9 신규 error code)뿐이었고, 둘 다
조사 결과 실질 갭이 아니었다 — #8 은 서버측 2차 방어층으로 GUI 관측 동작이 바뀌지 않아 `05-run-and-debug/`
갱신 불요, #9 는 `error-codes.ts`(ErrorCode enum) 소속이 아닌 별도 taxonomy 이며 frontend 소비 경로 자체가
없어(4개 형제 코드 전수 grep 0건) 사용자 영향이 없고, 이미 같은 changeset 안에서 팀이 근거와 함께 보류
결정을 문서화했다(RESOLUTION.md). 나머지 7개 trigger(신규 노드/schema/UI 문자열/통합/섹션 디렉토리/
auth 흐름/표현식 언어)는 대상 파일이 이번 diff 에 전혀 없어 명백히 불일치다. 이번 PR 은 frontend 코드를
전혀 건드리지 않는 backend-only 보안 하드닝이라 i18n parity CRITICAL 위험(한쪽 로케일만 등록)도 원천적으로
발생할 수 없다. 결론: 유저 가이드 동반 갱신 관점에서 이번 diff 는 사실상 "해당 없음" 에 가깝고, 등재한
INFO 1건은 새 결함이 아니라 기존에 triage 된 항목의 재확인이다.

## 위험도

NONE
