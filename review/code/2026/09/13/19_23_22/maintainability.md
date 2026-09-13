# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

`error-code-emission-axis` 배치의 실질 코드 변경은 두 파일에 집중된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY` 신규)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 7종). 나머지(`CHANGELOG.md`·`PROJECT.md`·두 `logic.mdx`·`plan/**`·`review/consistency/**`)는 문서/프로세스 산출물이라 코드 유지보수성 관점의 발견사항은 없다. 프롬프트에 컨텍스트 예산으로 생략된 두 파일은 `Read` 로 직접 열어 전체 판단했다.

## 발견사항

- **[WARNING]** 신규 수집 함수 3종이 구조적으로 거의 동일하다 — 정규식과 capture group 인덱스만 다르다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:344`(`collectQuotedLiterals`), `:361`(`collectMessagePrefixes`), `:383`(`collectCatalogCodes`)
  - 상세: 세 함수 모두 `for (const text of texts) { for (const m of text.matchAll(RX)) tokens.add(m[N]); } return tokens;` 형태다. 차이는 (a) 사용하는 정규식 상수(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`), (b) capture group 인덱스(2 vs 1 vs 1)뿐이다. 이 파일은 바로 위 주석(라인 242~257)에서 "`lastIndex` 리셋 보일러플레이트를 늘리지 않는다"며 기존 4곳의 수동 `exec` 루프 복제를 의식적으로 피했는데, 그 자리에 형태가 다른 복제(3개의 거의 동일한 함수)를 새로 만들었다. 넷째 축이 추가되면(예: 트래커에 이미 예고된 AST 기반 방출 위치 특정) 복제가 4곳으로 또 늘어난다.
  - 제안: `function collectMatches(texts: readonly string[], rx: RegExp, group: number): Set<string>` 같은 공유 헬퍼로 추출하고 세 함수는 그 위에 얇게 래핑(또는 직접 호출부에서 사용). 정규식·그룹 인덱스만 파라미터화하면 JSDoc 은 각 상수 옆에 그대로 남길 수 있어 지금의 설명력은 잃지 않는다.

- **[INFO]** 같은 파일 안에 정규식 매치 수집의 두 가지 다른 관용구가 공존한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 기존 4곳(`collectSourceTokens:430-440`, `collectEnvDeclarations:472-494`, `scanIdentifierCitations:397-416`)은 `rx.lastIndex = 0` + `while ((m = rx.exec(...)))` 패턴, 신규 3곳(`:344-389`)은 `String.prototype.matchAll` 패턴.
  - 상세: 이 비일관성은 주석(라인 242~251)이 명시적으로 설명하고 있고, 기존 4곳을 한꺼번에 리팩터하는 것은 트래커에 등재된 별건이라 이번 배치 범위를 넘는다는 판단도 합리적이다. 다만 결과적으로 "이 파일에서 정규식 매치를 걷는 올바른 방법"이 두 가지가 되어, 다음에 다섯 번째 축을 추가하는 사람이 어느 관용구를 따라야 할지 즉시 알기 어렵다(문서를 읽어야 안다). 조치가 필요한 결함은 아니고, 참고용으로만 남긴다 — 이미 plan(§체크리스트)과 consistency 세션(plan_coherence INFO#3)이 이 갭을 교차 기록해 두었다.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY` 와 `GUIDE_EXTERNAL_VOCABULARY` 는 이름이 한 토큰(`NON_EMITTED` vs `EXTERNAL`)만 다르고 제약은 정반대다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:275`(`GUIDE_EXTERNAL_VOCABULARY`), `:308`(`GUIDE_NON_EMITTED_VOCABULARY`)
  - 상세: JSDoc(라인 288~301)이 두 목록의 대조표를 명시적으로 싣고 있어 오독 위험을 상당히 낮춰 두었다(이미 `review/consistency/2026/09/13/18_40_54/naming_collision.md` INFO#2 가 grep 0건 확인 후 참고용으로 등재한 것과 동일 사안). 코드 자체 결함은 아니고, 두 목록이 나중에 세 번째 "거울상" 목록으로 늘어날 경우 이름 패턴(`GUIDE_<AXIS>_VOCABULARY`)을 지금처럼 유지하되 대조표를 매번 갱신해야 함을 남겨 둔다.

- **[INFO]** 신규 테스트의 vacuity 임계값(`10`, `30`)이 이름 있는 상수 없이 리터럴로 박혀 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:191-192` (`entry.where.trim().length).toBeGreaterThan(10)`, `entry.why.trim().length).toBeGreaterThan(30)`)
  - 상세: 같은 파일의 자매 검사(`entry.system.trim().length).toBeGreaterThan(2)`, `entry.why.trim().length).toBeGreaterThan(20)`, 라인 255~256)와 값이 다른데(`why` 하한이 20→30) 그 차이의 근거가 주석에 없다. 파일 상단에서 `EXTERNAL_VOCABULARY_CAP` 처럼 의미 있는 임계값은 이름 붙은 상수로 뽑는 관례를 이미 쓰고 있으므로, 이 값들도 그 패턴을 따를 여지가 있다. 다만 이런 "비어 있지 않은지" 하한 검사는 이 파일 전반에 걸쳐 여러 군데 유사한 리터럴로 존재하는 기존 관례이고, 실질적 위험(오독·오탐)은 낮다.

- **[INFO]** 파일 서두 주석(라인 1~124, 약 124줄)이 코드 선언보다 먼저 온다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-124`
  - 상세: 이번 배치가 새로 늘린 것이 아니라 기존에 이미 큰 비중을 차지하던 패턴이고(§발행 축 절 27줄만 이번 추가분), 파일 자체가 "이 주석을 지우지 말 것"(라인 84)이라고 명시적으로 못박아 두었다 — 과거 실제로 이 절이 재작성 중 삭제됐다가 리뷰에서 걸린 이력(라인 87~97)이 있다. 일반적인 "주석이 길면 나쁘다" 기준으로는 지적할 만하지만, 이 저장소는 반복적으로 "틀린 근거는 다음 사람의 판단 기준을 바꾸므로 정정만 하고 지우지 않는다"는 원칙을 지켜 왔고 이 파일이 그 원칙의 직접 사례다. 삭제·이동을 권고하지 않으며 참고로만 남긴다.

## 요약

실질 코드 변경 범위가 좁고(수집기 3종 + 데이터 목록 1종 + 그 위 테스트 7종), 각 함수는 짧고 이름이 목적을 정확히 드러내며 중첩도 얕다. 가장 실질적인 유지보수성 이슈는 신규 수집 함수 3개가 정규식·capture group 인덱스만 다를 뿐 구조가 동일한 근접 중복이라는 점(WARNING) — 파일이 바로 옆에서 다른 종류의 중복(수동 `lastIndex` 보일러플레이트)을 의식적으로 피한 직후에 발생했다는 점에서 지적할 가치가 있다. 나머지는 이미 문서화·추적되고 있거나(이름 유사성, 관용구 혼재) 이 저장소가 반복해 선언한 "근거를 지우지 않는다" 원칙과 직결된 부분(장문 서두 주석)이라 조치를 요구하지 않는 INFO 수준이다. 전체적으로 새 코드는 기존 파일의 명명·문서화·테스트 관례를 일관되게 따르고 있다.

## 위험도
LOW
