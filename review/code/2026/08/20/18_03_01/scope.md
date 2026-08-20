STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard (18_03_01)

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase/ spec/ CHANGELOG.md plan/` 로 실 코드/문서
변경 34개 파일(1,684 insertions / 232 deletions)을 확인했다. 나머지(`review/code/2026/08/20/**`,
`review/consistency/2026/08/20/**`)는 이 작업이 같은 브랜치에서 누적한 다회 리뷰 세션
산출물이며, 이 저장소는 `review/` 를 gitignore 하지 않고 `RESOLUTION.md` 가 이전 라운드
산출물을 서로 참조하는 관행을 유지하므로 scope 위반 대상이 아니다.

이 34개 파일 자체는 `16_25_35`·`16_51_19`·`17_13_19` 세 차례의 이전 scope 라운드가 이미
전량 검토해 `ISSUES=0`(NONE)으로 판정했다. 이번 라운드는 그 이후 유일한 신규 코드 변경인
커밋 `d446ab7ad`("스키마에서 사라진 마스킹 키가 재입력을 영구 차단했다 — 라운드9 처분")에
집중했다. `git show d446ab7ad --stat`(review 산출물 제외) 기준 6개 파일만 건드린다:
`background-runs.service.spec.ts`, `execution-response.dto.ts`, `rerun-modal.test.tsx`,
`rerun-modal.tsx`, `eia-inputdata-marker-guard.md`, `spec-sync-external-interaction-api-gaps.md`.
`git status --short` 로 미커밋 코드 변경이 없음도 확인했다(review 산출물 디렉토리 2개뿐).

## 발견사항

없음.

- **의도 이상의 변경 / 무관한 수정**: `d446ab7ad`는 커밋 메시지가 예고한 정확히 두 가지
  WARNING(직전 라운드 `17_38_33`)만 고친다 — (1) `rerun-modal.tsx`: manual_trigger 스키마에서
  사라진 `maskedKeys` 를 untyped text 필드로 되살려 "차단 근거 키는 반드시 렌더된다" 불변식을
  세움(W3, 스키마 드리프트 영구 교착 방지), (2) `background-runs.service.spec.ts` +
  `execution-response.dto.ts`: 자매 파일에서 이미 고쳐진 "필드별 분리 단언"·"주제문 우선"
  패턴을 마지막 남은 두 자리에 적용(W4 + consistency swagger JSDoc 길이 규약). 코드 영역을
  벗어난 수정(인증·노드 핸들러·다른 모듈)은 diff에 없다.
- **불필요한 리팩토링**: `fields` useMemo 내부에 `declared`/`declaredNames`/`orphanMasked` 를
  추출한 것은 스키마-드리프트 키를 병합하기 위해 필연적으로 필요한 분리이며, 동작 무변화
  리팩터가 아니다.
- **기능 확장(over-engineering)**: 새로 추가된 것은 W3가 실제로 재현한 영구 교착에 대한
  방어(스키마에 없는 마스킹 키만 선별 복원)뿐이고, 그 외 필드(마스킹되지 않은 드리프트 키)는
  종전 동작을 그대로 유지한다고 주석·plan 양쪽에 명시돼 있다 — 요청 범위를 넘는 신규 기능
  없음. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 W2(서버측 마커 거부)
  갱신은 코드 반영이 아니라 유예 근거를 "틀린 근거"에서 "실측된 근거"로 정정만 하는 문서
  변경이고, 실제 서버측 체크는 이번 diff에 구현되지 않았다(트래커 등재 유지) — 범위를
  넘는 선반영이 아니다.
- **포맷팅/주석/임포트**: 무의미한 공백·줄바꿈 변경 없음. 신규 주석(JSDoc `## 불변식`,
  테스트 헤딩)은 전부 이번 두 수정의 근거를 설명하는 데 필요한 내용이다. 신규/불필요
  임포트 없음.
- **설정 변경**: `.claude/config/**`, `package.json`, CI, lint/tsconfig 등 설정 파일 변경 없음.
- **plan 문서 갱신**: `eia-inputdata-marker-guard.md`·`spec-sync-external-interaction-api-gaps.md`
  두 plan의 변경은 체크리스트·라운드 카운트·트래커 근거를 실제 수행한 라운드 9 결과와
  동기화하는 것으로, 이 저장소의 plan 라이프사이클 규약(수행 후 체크·근거 실측 기록)에 부합한다.

## 요약

이번 라운드에서 유일하게 새로 반영된 코드 변경(`d446ab7ad`)은 직전 리뷰(`17_38_33`)가 지적한
두 WARNING — 스키마 드리프트로 인한 영구 차단 교착(rerun-modal), 그리고 자매 캐너리·JSDoc의
"한쪽만 고침" 재발(background-runs.service.spec.ts + execution-response.dto.ts) — 을 정확히
겨냥한 방어적 수정과 그에 대응하는 캐너리 테스트·plan 동기화뿐이다. 이는 8라운드에 걸쳐
`ISSUES=0`으로 반복 확인돼 온 34개 핵심 파일의 "`Execution.inputData` egress 마스킹 카브아웃
폐지 + 재제출 소비처 3곳 마커 가드"라는 단일 목표를 전혀 벗어나지 않으며, 새 기능·무관한
파일·포맷팅 잡음·설정 변경 어느 것도 섞여 있지 않다.

## 위험도

NONE
