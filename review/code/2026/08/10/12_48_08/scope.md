# 변경 범위(Scope) Review

## 발견사항

없음. `git diff --stat origin/main...HEAD` 로 실제 diff 대상 14개 파일을 프롬프트에 제시된 14개
파일 목록과 대조한 결과 완전히 일치했다(누락·추가 없음). 각 파일의 변경 내용도 아래처럼 단일
작업 항목("seed 게이트 + openStream 게이트 짝의 구조적 강제", 이전 라운드 `12_39_25` WARNING
3건 반영)에 정확히 대응한다.

- **[INFO]** `review/code/2026/08/10/12_39_25/*` 11개 파일이 신규 파일로 diff 에 포함됨
  - 위치: `review/code/2026/08/10/12_39_25/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`,
    `documentation.md`, `maintainability.md`, `meta.json`, `requirement.md`, `scope.md`,
    `security.md`, `side_effect.md`, `testing.md` (전부 `new file mode`)
  - 상세: 코드 변경(파일 2)과 직접 관련 없어 보일 수 있으나, `CLAUDE.md` 가 "코드 리뷰 산출물:
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 를 단일 진실 저장 위치로 명시하고, 이 라운드
    자체가 그 직전 라운드(`12_39_25`)가 지적한 WARNING 3건(아래 참고)을 반영한 fix 커밋이므로
    그 근거가 된 리뷰 산출물이 함께 커밋되는 것은 이 프로젝트의 정상적인 review→fix→재리뷰 워크플로
    (memory `feedback_fresh_review_after_resolution.md`)에 부합한다. 무관한 파일 혼입이 아니다.
  - 제안: 조치 불필요.

## 세부 확인 내역

1. **`use-widget.ts` (5개 hunk) — 전부 `RESOLUTION.md` WARNING #1·#2 에 대응**
   - `StreamClaim` 명명 union 타입 신설(게이트 92-110) 및 `openStream` 반환 타입을
     `void` → `StreamClaim` 으로 승격(게이트 386-409: `"no_client"`/`"already_owned"`/`"opened"`
     세 갈래 명시 반환) — WARNING #1(`boolean` 이 "열었다"/"통과시켰다"를 뭉갬)의 정확한 수정.
   - `seedWaitingFromStatus` JSDoc(게이트 458-469)·`start()`(게이트 613-619)·`applyConfig`
     복원 경로(게이트 961-968)의 인접 주석이 옛 "호출부 양쪽 게이트" 서술에서 "openStream 내부
     단일 게이트" 로 갱신 — 게이트 위치가 실제로 이동했으므로 갱신이 필연적인 부수 편집이지
     무관한 주석 손질이 아니다.
   - `start()` 의 `useCallback` 의존성 배열(게이트 630)에서 더 이상 본문에서 호출되지 않는
     `sessionEstablished` 제거 — WARNING #2 의 정확한 수정. `grep` 확인 결과 `sessionEstablished`
     는 파일 내 다른 곳(`seedWaitingFromStatus` 게이트 511·541, `applyConfig` 게이트 938)에서는
     여전히 실제로 호출되고 있어 그쪽 의존성 배열은 손대지 않았다 — 과잉 정리(다른 함수의 정당한
     참조까지 제거)가 아니라 stale 참조 1곳만 정확히 겨눈 수정이다.
   - `openStream` JSDoc 에 `@param session`/`@param lastEventId`/`@returns` 태그가 추가됨(게이트
     381-384) — `SUMMARY.md` INFO 표의 "@param/@returns 없이 산문뿐" 항목에 대한 "반영 — 태그로
     정리" 조치와 일치, 별도 스코프 이탈 아님.
   - 이 5개 hunk 밖에서 import·설정·무관한 코드 영역·순수 포맷팅만 바뀐 흔적은 없다(전체 파일
     컨텍스트 대조 결과 diff 범위 밖 라인은 원문과 동일).

2. **`use-widget-eager-start.test.ts` — 순수 주석 변경, `RESOLUTION.md` WARNING #3 에 대응**
   - `raceStartVsResendSingleStream` 위 설명 주석만 옛 구조("openStream 직전 양쪽 호출부에 게이트")
     서술에서 현재 구조("게이트는 `openStream()` 안") 서술로 교체(게이트 3401-3408). 단언(assertion)
     코드는 변경 없음 — 커버리지·동작에 영향 없는 문서 성격 수정이다.

3. **`plan/in-progress/webchat-usewidget-extraction.md`**
   - 미완료(`[ ]`) 체크리스트 항목 1개를 완료(`[x]`)로 바꾸며 결정 근거·뮤테이션 검증·`tsc`
     결과를 기록(게이트 60-90). 문서에 적힌 근거(ai-review `02_25_54`·`01_44_21`, 뮤테이션 결과,
     동등 뮤턴트 판단)는 코드 쪽 JSDoc·`RESOLUTION.md`/`SUMMARY.md` 의 동일 인용과 일치해 지어낸
     서술이 아니다. frontmatter·다른 섹션·다른 체크리스트 항목은 손대지 않았다.

4. **`review/code/2026/08/10/12_39_25/*`**
   - 직전 라운드의 SUMMARY/RESOLUTION/개별 reviewer 리포트/`meta.json`/`_retry_state.json` 이
     그대로 신규 파일로 추가됨. 내용은 이번 라운드가 반영한 fix 의 근거이며, `RESOLUTION.md` 의
     "조치" 서술(union 타입 승격·deps 배열 정리·테스트 주석 갱신)이 실제 코드 diff(1·2번 항목)와
     1:1 대응한다 — 산문만 그럴듯하게 쓰고 코드가 다른 이야기를 하는 불일치는 없었다.

5. **임포트/설정**: 전체 diff 에서 import 문·설정 파일(package.json, tsconfig, eslint 등) 변경 없음.
6. **포맷팅**: 변경된 줄은 전부 실질 코드/문서/리뷰 산출물 내용이며, 공백·줄바꿈만 바뀐 순수
   포맷팅 hunk 는 없음.

## 요약

이번 diff(`origin/main` 대비 14개 파일)는 직전 리뷰 라운드(`12_39_25`)가 지적한 WARNING 3건
(`boolean` 반환의 의미 뭉개짐, `start()` deps 배열의 stale `sessionEstablished`, 회귀 테스트
주석의 구조 drift)을 정확히 반영한 fix 커밋과, 그 근거가 되는 이전 라운드 리뷰 산출물(`review/
code/2026/08/10/12_39_25/*`) 및 plan 체크리스트 완료 기록으로 구성된다. `git diff --stat` 로
실제 변경 파일 집합이 프롬프트 목록과 정확히 일치함을 확인했고, 코드 변경은 `SeedOutcome` 과
동형인 명명 union(`StreamClaim`) 승격·`start()` 의 stale 의존성 1곳 제거·주석 3곳 갱신으로
좁게 국한되며, `sessionEstablished` 가 여전히 유효하게 쓰이는 다른 두 곳의 의존성 배열은 건드리지
않아 과잉 정리도 없었다. 무관한 파일·기능 확장·불필요한 리팩토링·의미 없는 포맷팅·부적절한
임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
