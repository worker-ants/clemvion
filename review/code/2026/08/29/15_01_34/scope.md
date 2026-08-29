# 변경 범위(Scope) 리뷰

대상: `origin/main...HEAD` = 커밋 `cb3a45ac0`(멀티라인 링크 매칭 수정) + `cf613bf89`(직전 리뷰 라운드의
Critical/Warning 조치). `git diff --stat origin/main...HEAD` 로 15파일·1047(+)/28(-) 이 프롬프트에
실린 파일 목록·라인 수와 정확히 일치함을 확인(누락·추가 파일 없음).

## 발견사항

- **[INFO]** 리뷰 세션 산출물(12개 파일, `review/code/2026/08/29/14_36_39/**`)이 코드 수정과
  같은 커밋(`cf613bf89`)에 포함됨.
  - 위치: `review/code/2026/08/29/14_36_39/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`,
    `documentation.md`, `maintainability.md`, `meta.json`, `performance.md`, `requirement.md`,
    `scope.md`, `security.md`, `side_effect.md`, `testing.md` (전부 신규 파일).
  - 상세: 이 파일들은 "무관한 수정"처럼 보일 수 있으나, 실제로는 **바로 이 두 소스 파일의 첫
    리뷰 라운드가 남긴 산출물**이고, `RESOLUTION.md` 는 그 라운드의 Critical 1건·Warning 5건에
    대한 조치 기록이다. `CLAUDE.md` 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"
    조항과 `review/` 가 gitignore 대상이 아니라는 프로젝트 관례(리뷰 산출물은 커밋 대상) 그대로다.
    실제로 `cf613bf89` 가 담은 코드 변경(§Warning #2/#3 함수 분리, §Warning #4 회귀 테스트,
    §Warning #5/#6 문서 동기화, §Critical #1 펜스 처리)은 그 12개 파일에 적힌 항목과 1:1로
    대응한다 — 자발적 추가 작업이 아니라 그 라운드가 지시한 조치를 그대로 수행한 것.
  - 제안: 조치 불요. Scope 위반이 아니라 이 저장소의 표준 리뷰-즉시조치 워크플로.

- **[INFO]** 워크트리 슬러그(`eslint10-upgrade-5e3cf9`)와 실제 작업 주제(spec-link 멀티라인
  매칭 버그 수정) 불일치. 직전 라운드 자신의 `scope.md`(파일 12) 가 이미 동일 항목을 INFO 로
  기록했고, 코드 diff 자체에는 eslint10 관련 변경이 0건(config 파일 미포함, `git diff --stat`
  로 재확인)이라 Scope 위반은 아님. 신규 관찰 아님 — 중복 기재만 방지하고 참고로 남김.

## 항목별 점검

1. **의도 이상의 변경** — 없음. `cb3a45ac0`(핵심 수정) + `cf613bf89`(그 라운드의 Critical/Warning
   후속 조치)로 구성되며, 후속 커밋의 모든 hunk 가 `RESOLUTION.md` 표의 항목과 대응된다.
2. **불필요한 리팩토링** — `extractLinks()` 를 `buildMaskedDoc()`/`lineForOffset()` 로 분리한 것은
   자발적 리팩토링이 아니라 직전 라운드의 Warning #2·#3(함수 책임 과다·펜스 분기 중복)에 대한
   지시된 조치다. `git diff` 확인 결과 두 `.ts` 파일 모두 import 변경 없음, 다른 함수(`slugify`,
   `headingSlugs`, `collectHeadings` 등)는 손대지 않음.
3. **기능 확장(over-engineering)** — 없음. 추가된 회귀 테스트(멀티라인 2개·단일+멀티 혼재·3줄
   스팬)는 직전 라운드 Warning #4(off-by-one 사각지대) 를 메우는 범위에 정확히 부합하고, 그 이상의
   케이스(예: ANCHOR 통합 경로)는 INFO #17 로 유보된 채 실제로 추가되지 않았다 — 요청된 범위만
   정확히 채웠다.
4. **무관한 수정** — 없음. `git diff --stat origin/main...HEAD` 상 15파일 전부가 이 작업(핵심 버그
   수정 + 그 리뷰 라운드의 후속조치)과 직접 관련. plan 문서 diff 도 `harness-review-gate-followups.md`
   의 해당 항목(§미해결 항목의 spec-link-integrity 멀티라인 건)에만 국한되며, 인접한 다른 항목
   (§11 잔여, origin 브랜치 해석 4곳, `doclink-guard-scope` 항목 등)은 건드리지 않았다.
5. **포맷팅 변경** — 실질 변경과 섞인 무의미한 공백/줄바꿈 diff 없음(trailing whitespace grep 0건).
6. **주석 변경** — 신규 JSDoc/인라인 주석이 많지만 전부 "왜 이렇게 고쳤는가"·"무엇을 지키면
   깨지는가"를 설명하는 근거-중심 주석이며, `MdLink`/`LinkViolation` 필드 주석 추가도 이번에
   실제로 바뀐 계약(멀티라인 시 첫 줄 보고, `raw` 개행 포함)을 반영한다. 무관한 주석 삭제/왜곡 없음.
7. **임포트 변경** — 없음(`grep -E '^\+import|^-import'` 0건, 두 `.ts` 파일 모두).
8. **설정 변경** — 없음. `package.json`/`eslint.config.*`/`tsconfig*` 등 15파일 목록에 전혀 없음.

## 요약

이 diff 는 두 커밋(`cb3a45ac0` 핵심 버그 수정, `cf613bf89` 그 직전 리뷰 라운드의 Critical 1건 +
Warning 5건 후속 조치)으로 구성되며, `review/code/2026/08/29/14_36_39/**` 12개 파일이 대량으로
섞여 있어 언뜻 무관한 변경처럼 보이지만 실측 대조 결과 전부 같은 결함 수정의 리뷰-조치 사이클
산출물이었다. 코드(`spec-links.ts`/`spec-links.test.ts`)와 plan 문서 diff 는 "멀티라인 마크다운
링크 미탐지" 단일 결함의 수정·검증·완료기록·후속 리뷰 조치에 정확히 대응하며, 임포트·설정·의미
없는 포맷팅 변경이나 요청되지 않은 리팩토링·기능 확장은 발견되지 않았다.

## 위험도

NONE
