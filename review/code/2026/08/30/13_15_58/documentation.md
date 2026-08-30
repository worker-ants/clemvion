# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `CHANGELOG.md` — 직전 라운드(`review/code/2026/08/30/12_41_15/SUMMARY.md` WARNING #6)가 지적한 "이번 diff 의 실질 변경이 CHANGELOG 에 반영되지 않았다"는 이번 diff 에서 해소됐다. `CHANGELOG.md:3-23` 에 신규 `## Unreleased` 항목이 추가됐고, 서술을 코드와 직접 대조했다: (1) 발견형 확장(`src/**` 전수, 개수 판정) — `source-scan.ts`·`update-returning-rows.spec.ts` 와 일치. (2) `kb-stats.helper.ts` 타입 정정 서술 — 실제 diff(`{...}[]` → `[{...}[], number]`)와 일치. (3) "`scripts/eval-retrieval.ts:162` 실형태로 검증" 주장 — `codebase/backend/src/scripts/eval-retrieval.ts:162` 를 직접 열어 `.query<Array<{ workspace_id: string }>>(` 형태가 실존함을 확인(경로 표기는 `src/` 상대 표기 관례를 따름). (4) "양성 6·음성 5" — `source-scan.spec.ts` 의 `it.each` 6개/5개와 정확히 일치. 지어낸 서술이 없다.
  - 위치: `CHANGELOG.md:3` (신규 섹션 헤더)
  - 상세: 조치 확인, 추가 조치 불요.
  - 제안: 없음.

- **[INFO]** `source-scan.ts` 의 신규 JSDoc(`countRawUpdateReturning`/`hasRawUpdateReturning`)이 "왜 필요한가"·"판정 축"·"이 축이 안 보는 것(QueryBuilder 제외 이유, `.query(sqlVar)` blind spot)"을 표와 함께 명시하고, 인라인 주석은 정규식의 중첩 제네릭 처리 한계("2단계 이상 중첩은 여전히 못 받는다")까지 정직하게 문서화한다. 코드(정규식 `/\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)/g`)를 직접 읽어 대조한 결과 서술과 동작이 일치한다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:61-99`(JSDoc), `:102-110`(인라인 주석)
  - 상세: 직전 라운드 testing/requirement WARNING(중첩 제네릭 미탐지·`.query(sqlVar)` 미문서화)이 코드 수정과 문서화 양쪽으로 해소됐다.
  - 제안: 없음.

- **[INFO]** `kb-stats.helper.ts` 의 기존 주석(26-28행, "RETURNING 절은 향후 호출자가 활용할 수 있도록 유지")을 지우지 않고 그 옆에 정정 맥락(29-35행)을 덧붙였다 — 기존 서술이 "소비를 초대"하는 위험한 문구였음을 다음 사람이 놓치지 않도록 명시적으로 연결했다. 코드(타입 인자 `[{...}[], number]`)와 주석 서술이 일치한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:26-38`
  - 상세: 문제 없음.
  - 제안: 없음.

- **[INFO]** `kb-stats.helper.spec.ts` 의 신규 인라인 주석(19-23행, 42행)이 mock shape 변경 이유("과거 4개월 결함과 같은 형태를 인코딩했었다")를 명시하고, 코드(`mockResolvedValue([[...], 1])`, `[[], 0]`)와 정확히 대응한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts:19-23,42`
  - 상세: 문제 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/update-returning-tuple-shape.md` — 해당 항목 체크박스(`- [ ]` → `- [x]`, 304행)가 실제 완료 상태와 일치하고, 완료 주석(313-348행)에 뮤테이션 예측/실측 표가 딸려 있다. 이 항목은 `## 체크리스트`(211행)가 아니라 `## 후속`(254행) 섹션에만 존재해 두 섹션 간 중복·비동기 위험이 없다. plan 이 아직 `in-progress` 로 남아 있는 것도 타당하다 — 같은 `## 후속` 섹션에 미완료 항목(238행, "② `updateExecutionStatus` 트랜잭션화")과 planner 위임 대기 항목(349행)이 남아 있어 전체 완료가 아니다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:304`
  - 상세: 문제 없음.
  - 제안: 없음.

- **[INFO]** `review/code/2026/08/30/12_41_15/RESOLUTION.md` 의 조치 commit SHA(`1a051bbe7`, `31ff78bfd`, `dd273828f`)를 `git log` 로 대조 확인 — 실제 커밋 이력과 일치한다.
  - 위치: `review/code/2026/08/30/12_41_15/RESOLUTION.md:7-12`
  - 상세: 문제 없음(참고용 확인).
  - 제안: 없음.

- **[INFO]** (범위 밖, 이미 추적 중) `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 이 여전히 미등재 — 이번 diff 는 spec 파일을 포함하지 않으며, 직전 라운드의 consistency-check(`review/consistency/2026/08/30/12_17_21/SUMMARY.md` WARNING #4) 와 직전 documentation.md 가 이미 포착·기록한 사실이다. developer 권한 밖(spec 은 read-only)이라 이번 코드 PR 의 조치 대상이 아니다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:402-403`(plan 이 스스로 gap 인지·기록)
  - 상세: 중복 재발견 방지 목적의 참고 기록. 조치 불요.
  - 제안: 없음(planner 턴에서 처리 대상).

## 요약

이번 diff 는 직전 리뷰 라운드(`12_41_15`)가 지적한 문서화 관점 WARNING(CHANGELOG 미갱신)을 포함해 6개 SUMMARY 항목 전체를 코드 수정 + 문서 보강 양쪽으로 다뤘다. `CHANGELOG.md` 신규 항목의 모든 구체적 주장(파일:라인 인용, 양성/음성 테스트 개수, 정규식 동작)을 실제 소스와 하나씩 대조한 결과 지어낸 서술이 없었다. 신규 함수(`countRawUpdateReturning`/`hasRawUpdateReturning`)의 JSDoc 은 "왜 필요한가"·"판정 축"·"의도적으로 안 보는 것"을 표와 함께 명시하는 이 저장소의 확립된 관례를 그대로 따르며, 코드 동작과 정확히 일치한다. `kb-stats.helper.ts`/`kb-stats.helper.spec.ts` 의 인라인 주석도 기존 서술을 지우지 않고 정정 맥락을 옆에 남기는 방식으로 잠재적 오해(거짓 타입 선언)를 다음 사람에게 명시적으로 경고한다. plan 파일의 체크박스·완료 주석도 실제 상태 및 다른 섹션과 정합적이다. 새로 도입된 CRITICAL·WARNING 급 문서화 결함은 발견되지 않았다.

## 위험도
NONE
