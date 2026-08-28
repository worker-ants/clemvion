# 변경 범위(Scope) 리뷰 — system-error-banner

## 발견사항

없음.

## 근거 (검토 절차)

- `git diff --stat HEAD`(및 `origin/main...HEAD`) 로 실제 변경 파일을 전수 확인 — 프롬프트에 제시된 3개 파일과 정확히 일치:
  - `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (+134/−?)
  - `codebase/frontend/src/lib/websocket/use-execution-events.ts` (+47/−?)
  - `plan/in-progress/system-error-banner-live-ws.md` (신규, +69)
- `plan/in-progress/system-error-banner-live-ws.md` 의 체크리스트(라인 55~61)와 실제 diff 를 항목별 1:1 대조:
  - `extractNodeErrorPayload` 의 `nested` 를 `rawOutput.output.error` 로 — `use-execution-events.ts:83-90` (신규 `asRecord` 헬퍼 포함) 이 정확히 이 항목만 구현.
  - `handleNodeFailed` 가 `payload.output` 을 전달 — `use-execution-events.ts:906-911` 이 정확히 이 항목.
  - 헬퍼·핸들러 주석의 정정 전 §4.1 인용 교체 — `use-execution-events.ts:76-78, 83-88, 842-849` 코멘트 변경이 이 항목에 대응(설명 갱신, 새 로직 추가 아님).
  - fixture 를 production shape 으로(CT-S9·CT-S10·CT-S15·completed 4곳) — 테스트 diff 의 4개 hunk 가 정확히 이 4곳.
  - 캐너리 2건(문자열 error+래퍼 output 조합에서 배너 발생 / `output` 미동봉 경로에서 미발생) — 신규 `it("[캐너리] ...")` 1건 추가 + 기존 "legacy string error" 테스트를 라벨·주석만 정정해 재사용(로직 자체는 불변).
- 위 항목 외 diff 잔여분 없음 — `direct` 분기 관련 주석 보강(76-78행)은 새 `nested` 로직이 우선순위를 갖게 되며 "왜 `direct` 가 사실상 거의 안 타는지"를 설명하는 것으로, 별도 리팩토링이 아니라 인접 로직 변경에 필연적으로 따라오는 주석 갱신.
- `asRecord` 헬퍼는 새 기능 확장이 아니라 `rawOutput.output.error` 2단 중첩 접근을 도입하며 생긴 가독성 필요에 따른 최소 추출(주석 "위 중첩 접근을 읽을 만하게 만든다" 로 자기 설명).
- import/설정 파일 변경 없음. 포맷팅-only 변경 섞임 없음(모든 hunk 가 의미 있는 코드/주석 변경).
- 무관한 파일·영역 수정 없음 — 3개 파일 모두 해당 결함(라이브 WS 경로에서 `system_error` 배너 미노출)과 직접 연결.

## 요약

diff 전체(3 파일, +207/−43)가 `plan/in-progress/system-error-banner-live-ws.md` 에 명시된 체크리스트와 정확히 1:1 대응한다. 프로덕션 코드 변경은 `extractNodeErrorPayload` 의 래퍼 한 겹 통과 로직과 `handleNodeFailed` 의 `payload.output` 전달이라는 두 지점에 국한되며, 신규 `asRecord` 헬퍼도 그 변경이 요구하는 가독성 최소치일 뿐 기능 확장이 아니다. 테스트 변경은 production shape 을 반영한 fixture 정정 + 캐너리 추가/재사용에 한정되고, 라벨·주석 정정도 스코프 문서에 명시된 항목이다. 무관한 파일·설정·포맷팅·불필요한 임포트 변경은 발견되지 않았다.

## 위험도

NONE
