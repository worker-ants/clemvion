# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 및 방법

이 세션은 `error-code-emission-axis` 배치의 **누적 3라운드**(19_23_22 → 19_51_33 → 20_13_13) 리뷰 중 마지막 라운드다. 실질 코드 변경은 두 파일에 집중된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 + `isMessagePrefixOnly` 술어 + `GUIDE_NON_EMITTED_VOCABULARY`)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 + 대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·두 `logic.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 유지보수성 관점의 발견사항이 없다는 이전 라운드의 판단(`review/code/2026/09/13/19_23_22/maintainability.md`, `.../scope.md`)에 동의한다.

프롬프트가 두 핵심 TS 파일의 diff 를 크기 제한으로 생략했으므로, `Read` 로 두 파일 **전문**을 직접 열어 현재 상태(HEAD `a4b98eda8`, worktree clean)를 확인했다. 또한 `git diff a397ccc55..a4b98eda8`(라운드 1→2 수정 커밋)를 직접 대조해, 이전 라운드가 지적한 항목이 실제로 어떻게 고쳐졌는지 확인했다.

## 이전 라운드 WARNING 처리 확인

- **라운드 1 maintainability WARNING#7**(수집기 3종 근접 중복) — `collectMatches(texts, rx, group)` 공유 헬퍼로 해소됨을 직접 확인(`guide-identifier-scan.ts:281-291`, 세 함수 `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 가 모두 이를 호출). 재발 없음.
- **라운드 2 testing WARNING#3 / architecture INFO#1**(`isMessagePrefixOnly` 가 테스트 파일 내부 지역 클로저라 진리표 대조군 불가) — `guide-identifier-scan.ts:447-453` 로 정본 이관, `guide-identifier-existence.test.ts:519-543` 에 4갈래 진리표 대조군(`describe("isMessagePrefixOnly — 진리표 대조군")`) 추가됨을 확인. 호출부는 `prefixOnly` 얇은 래핑(`:121-122`)으로 정본을 재사용해 사본이 두 곳에 생기지 않는다.
- **라운드 2 testing WARNING#2**(`where` 필드가 `.exec()` 단일 매치라 두 번째 위치부터 미검증) — `parseWhereRefs`(`:54-61`)로 가운뎃점 구분 다중 위치를 전부 파싱하도록 교체, 파서 자체의 대조군(`:262-275`)도 추가됨을 확인.
- **라운드 2 maintainability WARNING#4**(거울상 죽은-항목 검사 두 곳이 손으로 복제됨) — `staleEntries(list, cited)` 공유 헬퍼(`:64-69`)로 단일화됨을 확인. 중복 재발 없음(`grep` 결과 `filter((e) => !cited.has` 패턴이 헬퍼 정의 1곳뿐).

세 라운드에 걸쳐 지적된 근접 중복·검증 공백류 결함이 모두 해소된 채로 마지막 라운드에 도달했다.

## 발견사항

- **[INFO]** `where`/`why` 필드의 vacuity 하한이 형제 목록과 다른 값인데 이름 붙은 상수가 없다 (라운드 1부터 이월, 미해소 — 낮은 우선순위 유지)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:219`(`entry.where.trim().length).toBeGreaterThan(10)`), `:220`(`entry.why.trim().length).toBeGreaterThan(30)`) — 형제 목록의 `:394`(`entry.system.trim().length).toBeGreaterThan(2)`), `:395`(`entry.why.trim().length).toBeGreaterThan(20)`)와 대조.
  - 상세: `why` 하한이 한쪽은 20, 다른 쪽은 30 으로 다른데 그 차이의 근거가 주석에 없다. 파일이 이미 `EXTERNAL_VOCABULARY_CAP`/`NON_EMITTED_VOCABULARY_CAP` 처럼 의미 있는 임계값을 이름 붙은 상수로 뽑는 관례를 확립해 두었으므로 이 값들도 그 패턴을 따를 여지가 있다. 3라운드 동안 리뷰어들이 반복 지적하지 않고 조치도 없었던 것으로 보아 위험도가 실질적으로 낮다는 공감대가 있는 항목으로 판단된다.
  - 제안: 조치하지 않아도 무방. 다음에 이 파일을 다시 만질 때 `WHERE_MIN_LENGTH`/`WHY_MIN_LENGTH` 류 상수로 뽑으면 두 목록의 강제 수준이 왜 다른지(또는 같아야 하는지)가 명시된다.

- **[INFO]** 같은 파일 안에 정규식 매치 수집의 두 관용구(`matchAll` vs 수동 `lastIndex`)가 계속 공존한다 (라운드 1부터 이월, 의도적 유예)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:456-484`(`scanIdentifierCitations`), `:494-505`(`collectSourceTokens`), `:536-558`(`collectEnvDeclarations`) — 수동 `lastIndex` 4곳. `:281-291`(`collectMatches`) — `matchAll` 신규 관용구.
  - 상세: 파일 상단 주석(`:242-251`)이 이 비일관성과 "이번 배치 범위 밖" 이라는 판단을 이미 명시하고 있고, `plan/in-progress/error-code-emission-axis.md` 체크리스트와 consistency 세션(`plan_coherence` INFO#3)도 같은 갭을 교차 기록해 두었다. 조치가 필요한 결함은 아니며, 다섯 번째 축이 추가될 때 어느 관용구를 따를지 결정이 필요하다는 점만 남는다.
  - 제안: 조치 불요 — 참고용.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 이름이 한 토큰만 다르고 제약이 정반대인 상태가 유지된다 (라운드 1부터 이월)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:300`(`GUIDE_EXTERNAL_VOCABULARY`), `:333`(`GUIDE_NON_EMITTED_VOCABULARY`).
  - 상세: JSDoc(`:312-321`)이 두 목록의 대조표를 명시적으로 실어 오독 위험을 낮춰 두었다(`review/consistency/2026/09/13/18_40_54/naming_collision.md` INFO#2 가 grep 0건 확인 후 참고용으로 등재한 것과 동일 사안). 코드 결함은 아니고, 세 번째 "거울상" 목록이 생길 경우 대조표를 함께 갱신해야 함을 남겨 둔다.
  - 제안: 조치 불요.

- **[INFO]** `"where" 검증` 테스트의 이중 루프가 항목·위치마다 `walkTree` 를 반복 호출한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:224-260`.
  - 상세: `for (const entry of GUIDE_NON_EMITTED_VOCABULARY) { for (const { file, line } of refs) { walkTree(root, ["codebase/backend/src"], …) } }` 구조라, 등록 항목·위치 조합 수만큼 `codebase/backend/src` 전체를 훑는 `walkTree` 가 재호출된다. 오늘 목록이 3항목·4위치(상한 5)로 작아 실질 영향은 미미하고 성능보다는 "다음에 이 패턴을 복제할 때 캐싱 없이 그대로 번질 수 있다"는 유지보수성 관점의 참고 사항이다. 상한이 있어(`NON_EMITTED_VOCABULARY_CAP = 5`) 무한정 커질 위험은 낮다.
  - 제안: 조치 불요 — 상한이 이미 이 패턴의 성장을 억제한다.

- **[INFO]** 파일 서두 주석(`guide-identifier-scan.ts:1-124`, 약 124줄)이 코드 선언보다 먼저 오는 구조가 유지된다 (라운드 1부터 이월)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-124`.
  - 상세: 이 저장소가 반복적으로 "틀린 근거는 다음 사람의 판단 기준을 바꾸므로 정정만 하고 지우지 않는다"는 원칙을 지켜 온 파일이고, 파일 자체가 "이 주석을 지우지 말 것"(라운드 1 시점 라인 84, 현재도 동일 문구 유지)이라 명시한다. 실제로 과거 재작성 중 삭제됐다가 `/ai-review` 가 걸러낸 이력(`:87-97`)도 있다. 삭제·이동을 권고하지 않는다.
  - 제안: 조치 불요.

## 요약

3라운드에 걸쳐 지적된 실질적 유지보수성 결함(수집기 근접 중복, 진리표를 겨눌 수 없는 지역 클로저, `where` 단일 매치 검증 공백, 거울상 죽은-항목 검사 중복)이 모두 공유 헬퍼 추출·정본 이관·다중 매치 파서·대조군 추가로 해소된 상태로 이번 라운드에 도달했다. 이번 라운드에서 새로 도입된 코드(`isMessagePrefixOnly` 이관, `parseWhereRefs`, `staleEntries`)를 직접 검토한 결과 새로운 CRITICAL/WARNING 급 결함은 발견하지 못했다. 남은 항목은 전부 라운드 1부터 이월된 INFO 수준(임계값 리터럴 불일치, 두 정규식 관용구 공존, 두 허용목록 이름 근접, 장문 서두 주석)으로, 이미 문서·plan·consistency 산출물에 교차 기록돼 있고 실질 위험이 낮아 이번 라운드에서 조치를 요구하지 않는다. 전체적으로 신규 코드는 파일이 확립한 명명·문서화·테스트(합성 대조군·vacuity floor) 관례를 일관되게 따른다.

## 위험도
LOW
