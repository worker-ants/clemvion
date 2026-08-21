# 문서화(Documentation) 리뷰 — masked-marker-contract-7d2e14 (라운드 6, 13_34_34)

## 검토 방법

이 PR 은 이미 5라운드(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`/`13_14_29`)의 코드 리뷰를 거쳤고,
그중 documentation 관점은 매 라운드 독립적으로 깊이 검토됐다(plan 체크박스 stale, spec R17
서술 갱신, JSDoc 절대 서술 정정 등 이미 WARNING 3건이 발견·수정됨). 이번 라운드는 그 축적된
diff(원본 코드 변경 22개 파일 + 리뷰/consistency 산출물 아카이브)를 대상으로 하되, 재작업을
피하기 위해 이전 라운드들이 지적·수정했다고 "서술"한 지점을 실제 저장소 최신 상태에서
`Read`/`grep` 로 직접 재확인하는 데 집중했다:

- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 (backend)
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 (frontend) —
  `SOT_DIR`/`sotPrefix` 경계 처리가 두 쌍둥이에서 실제로 대칭인지 (`12_50_37`→`13_14_29` 수정 대상)
- 양쪽 `masked-marker-mirror.{spec,test}.ts` 전문 — 접두 겹침·함수 선언 캐너리가 실제로 존재하는지
- `plan/in-progress/masked-marker-shared-package.md` 전체 (체크리스트·"작업"/"후속" 섹션)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373,765` — 두 트래커 항목이 여전히 `[x]`인지
- `spec/5-system/14-external-interaction-api.md` R17 문단 diff(`7cc64fa35..HEAD`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `codebase/frontend/src/lib/utils/masked-markers.ts` 전문
- `codebase/packages/masked-markers/README.md` vs `src/index.ts` 내용 대조
- `CHANGELOG.md` 최상단 — 이번 이관 관련 항목 유무

## 발견사항

새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다. 직접 재확인한 결과, 이전 라운드들이
"수정했다"고 서술한 지점은 실제로 소스에 반영돼 있다 — 특히 `12_50_37`(WARNING, backend만
접두 경계 수정)→`13_14_29`(WARNING, `sot` 변수 섀도잉+루프 재계산 수정) 두 라운드가 문제 삼았던
`findMirrorRedeclarations` 의 `SOT_DIR`/`sotPrefix` 처리는 지금 시점에 backend
(`masked-marker-mirror-guard.ts:149`, 모듈 레벨 리터럴이라 애초에 섀도잉 문제 없음)와 frontend
(`masked-marker-mirror-guard.ts:144`, `sotPrefix` 로 개명해 루프 밖으로 끌어올려짐)가 대칭이고,
두 스펙 파일 모두 "SoT 와 접두가 겹치는 형제 패키지" 캐너리(`masked-markers-extra` 합성
fixture)를 갖고 있어 이 클래스의 회귀를 기계가 잡는다.

- **[INFO] `CHANGELOG.md` 에 이번 패키지 추출/가드 신설에 대한 항목이 여전히 없음 (선례 일치, 재등재)**
  - 위치: `CHANGELOG.md` 최상단 "Unreleased" 섹션
  - 상세: `12_25_15` 라운드가 이미 `git log --diff-filter=A -- codebase/packages/ai-end-reason/package.json`
    로 동일 성격의 선례(`@workflow/ai-end-reason` 도입)도 CHANGELOG 를 건드리지 않았음을 확인해
    두었고, 이번 재확인 시점에도 `CHANGELOG.md` 는 변함없이 미기재다. "동작 무변경 내부 패키지
    추출"은 이 저장소 CHANGELOG 관행상 대상이 아닌 것으로 보이며, 이 PR 자체가 README/plan/
    다수 SUMMARY 에서 반복해 "동작 무변경"임을 명시하고 있어 같은 범주다.
  - 제안: 조치 불요(선례와 일치, 이미 3라운드 전 판정됨). 다만 신설된 저장소 전역 가드 2건
    (backend/frontend 미러 소멸 가드)이 향후 세 번째 스택 추가 시 자동으로 그 스캔 대상에
    편입된다는 사실은, 다른 개발자가 재발견하기보다 한 줄 남기는 편이 값싸다는 점은 여전히
    유효한 참고 사항이다 — 강제 사항 아님.

- **[INFO] frontend `masked-markers.ts` 에서 `MASKED_MARKERS` 가 여전히 `isMaskedMarker` 전용
  JSDoc 블록 아래 함께 export 되어 자체 설명이 없음 (11_27_29 에서 이미 지적된 INFO, 미변경 유지)**
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` — `export { isMaskedMarker, MASKED_MARKERS };`
    바로 위 JSDoc 블록(함수: 모듈 최상단, `isMaskedMarker` 설명 문단)
  - 상세: 이 JSDoc 은 명백히 `isMaskedMarker` 함수 하나("이 값이 egress 마스킹의 산물인가",
    "정확 일치만 잡는다")를 설명하며 `MASKED_MARKERS`(마커 3종 집합이라는 사실) 자체를 설명하지
    않는다. 대응하는 backend `sanitize-error-message.ts` 는 `MASKED_MARKERS` 를 별도 `export {}`
    문으로 분리해 전용 JSDoc을 붙였다(:167 부근) — 동일 패키지의 동일 심볼인데 두 재export
    지점의 문서화 세분도가 여전히 다르다. `11_27_29` 라운드가 이미 이 항목을 INFO·조치 불요로
    판정했고(패키지 원본 README/index.ts 가 `MASKED_MARKERS` 를 이미 충분히 설명), 이후 4라운드
    동안 이 파일이 여러 차례 수정됐음에도(캐너리 추가, 섀도잉 수정 등) 이 지점은 그대로다 —
    악화되지도, 해소되지도 않았다.
  - 제안: (선택) `export { isMaskedMarker, MASKED_MARKERS };` 를 backend 처럼 두 개의 `export {}`
    문으로 나누고 `MASKED_MARKERS` 위에 한 줄짜리 JSDoc(`"마커 전체 집합 — 상세는
    @workflow/masked-markers 참조"` 등)을 붙이면 backend/frontend 문서화 세분도가 일치한다.
    차단 사유 아님.

## 요약

6라운드째 리뷰인 이 PR 은 문서화 관점에서 이례적으로 성숙한 상태를 유지하고 있다. 이전
라운드들이 지적한 documentation WARNING(plan 체크박스 stale — `11_53_49`, JSDoc 절대 서술이
자기 이력에서 반증됐는데 소스에 정정이 안 남음 — `13_14_29`)은 모두 다음 라운드에서 실제로
수정되어 지금 상태와 일치함을 직접 원본 파일 대조로 재확인했다. 이번 라운드에서 특히 주목한
지점 — backend/frontend 미러 소멸 가드 쌍둥이 파일의 `SOT_DIR` 경계 처리 대칭성(`12_50_37`→
`13_14_29` 의 수정 대상) — 은 현재 시점에 실제로 대칭이며, 그 대칭을 지키는 캐너리(경로 접두
겹침·함수 선언 재선언)도 양쪽 스펙 파일에 동일하게 존재한다. spec R17 서술, plan 체크리스트,
CI 워크플로 주석("6개를 전부 등록")도 실제 코드 상태와 어긋남 없이 일치한다. 새로 발견한
것은 없고, 이전에 이미 INFO·조치 불요로 판정된 두 항목(CHANGELOG 미기재 — 선례 일치,
frontend `MASKED_MARKERS` re-export 지점의 개별 JSDoc 부재)이 이번 재확인에서도 동일하게
유지되고 있어 참고용으로만 재언급한다. 차단 사유가 될 문서화 이슈는 없다.

## 위험도
NONE
