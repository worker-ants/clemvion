# 변경 범위(Scope) 리뷰 — system-error-banner (02_39_10)

## 검증 방법

`origin/main...HEAD` 전체 diff 를 `git diff --stat` 로 확인하고, 실제 코드에 영향을 주는
파일(`CHANGELOG.md`, `use-execution-events.ts`, `use-execution-events.test.ts`,
`plan/in-progress/system-error-banner-live-ws.md`)의 전체 diff 를 직접 열람했다.
`plan/in-progress/system-error-banner-live-ws.md` 의 체크리스트(및 "스코프 밖" 섹션)와
diff 를 항목별로 대조했고, backend·spec 디렉터리에 변경이 없는지도 확인했다.

## 발견사항

없음.

## 근거 (검토 절차)

- **코드에 영향을 주는 변경은 4개 파일에 국한**: `CHANGELOG.md`(+19),
  `use-execution-events.ts`(+85/−64 net 라인 diff), `use-execution-events.test.ts`(+290),
  `plan/in-progress/system-error-banner-live-ws.md`(신규 +69). `codebase/backend/**`,
  `spec/**` 는 diff 에 전혀 나타나지 않는다 — plan 문서가 "스코프 밖" 으로 명시한
  "`output` 미동봉 2경로에 output 싣기"·"`error` 를 객체로 바꾸기" 는 둘 다 백엔드 계약
  변경이라 실제로 손대지 않았음을 실측으로 확인했다.
- **plan 체크리스트와 diff 1:1 대응**:
  - `extractNodeErrorPayload` 의 `nested` 를 `rawOutput.output.error` 로 — `use-execution-events.ts` 의
    `asRecord` 헬퍼 도입 + `const domain = asRecord(rawOutput)?.output` 이 정확히 이 항목만 구현.
    `direct` 분기(옛 객체 `error` 파싱)는 제거됐고, 이는 RESOLUTION.md W4 근거(뮤테이션으로
    커버리지 0 실증)가 명시된 의도된 축소라 새로운 스코프가 아니다.
  - `handleNodeFailed` 가 `payload.output` 을 전달 — 함수 시그니처를
    `extractNodeErrorPayload(rawError, rawOutput)` → `extractNodeErrorPayload(rawOutput)` 으로
    좁힌 것도 호출부 2곳(`handleNodeCompleted`, `handleNodeFailed`) 동반 수정으로 일관됨.
  - 헬퍼·핸들러 주석의 정정 전 §4.1 인용 교체 — JSDoc(51-77행 부근)과
    `handleNodeFailed`(842-851행)·`handleNodeCompleted`(807-810행) 위 주석이 모두
    §4.1-a 기준으로 갱신됨(직전 라운드 RESOLUTION W1/W2 가 지적한 "한 겹 얕은 자매 주석"도
    이번 diff 에 이미 반영돼 있음을 직접 확인).
  - fixture 를 production shape 으로 — CT-S9/S10(문자열 `error`+래퍼 `output`),
    CT-S11(`conversationWrapper`), `node.completed`(래퍼 `output`) 4곳 전부 확인.
  - 신규 테스트 헬퍼 `wrapNodeHandlerOutput`(RESOLUTION W3 산출물)이 테스트 파일 내
    **모든** `output:` 필드에 일관 적용되어 있고(손으로 복제된 래퍼 리터럴 잔존 0건, grep 확인),
    캐너리·가드 테스트(문자열 error+래퍼 output 조합, `output` 미동봉 경로, `||` 좌/우항 분리,
    배열 `output`, single-turn 대칭, `details` 부재)는 plan 체크리스트의 "뮤테이션 2건 — 예측보다
    넓게 물었다" 항목과 대응하는 방어 테스트로, 전부 이 결함(라이브 WS 경로 `system_error`
    미노출)과 직결된 회귀 방지 코드다.
- **후속 라운드(01_26_11 → 01_44_22 → 02_02_18 → 02_21_19)의 review 산출물이 diff 에 새 파일로
  포함**되어 있다(`review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19}/**`). 이는 이
  프로젝트 컨벤션상 리뷰 산출물이 `.gitignore` 대상이 아니고, 같은 세션 내 반복 라운드가
  이전 라운드의 RESOLUTION/SUMMARY 를 포함해 순차 커밋되는 정상 프로세스이지 무관한
  파일 추가가 아니다(각 라운드 자체의 scope.md 도 매 라운드 "발견사항 없음"으로 독립 판정됨).
- import·설정 파일 변경 없음. 포맷팅-only 변경 섞임 없음 — hunk 전부가 의미 있는 코드/주석
  변경이거나 그 변경에 필연적으로 따르는 인접 주석 갱신.
- CHANGELOG 추가분은 기존 엔트리를 건드리지 않고 새 `## Unreleased` 섹션 하나만 최상단에
  삽입했다 — 무관한 항목 수정 없음.

## 요약

이번 라운드(`02_39_10`)의 코드 영향 diff(`CHANGELOG.md` + 2개 TS 파일 + 신규 plan 문서, 4개
파일)는 `plan/in-progress/system-error-banner-live-ws.md` 의 체크리스트·"스코프 밖" 선언과
정확히 1:1 대응하며, backend/spec 은 diff 에 전혀 등장하지 않아 plan 이 명시한 경계가
실측으로도 지켜졌다. 이전 라운드(01_26_11~02_21_19)의 WARNING(JSDoc drift, 자매 주석,
수동 래퍼 복제)은 이번 diff 시점에 이미 해결된 상태로 반영돼 있어 스코프 이탈이 아니라
같은 결함 축의 정상적 반복 수렴이다. 무관한 파일·설정·포맷팅·불필요한 임포트 변경은
발견되지 않았다.

## 위험도

NONE
