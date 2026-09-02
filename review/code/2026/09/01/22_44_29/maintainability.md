# 유지보수성(Maintainability) 코드 리뷰

## 범위에 대한 메모

이번 changeset 81개 파일 중 실질적으로 사람이 유지보수하는 "코드/문서 소스"는 소수다:

- 실제 코드: `.claude/hooks/_lib/plan_guard.py`(정규식 앵커 확장), `.claude/tests/test_plan_guard.py`(신규
  테스트 3건), `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(멀티라인 ANCHOR 보강),
  `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일)
- 규약 문서: `.claude/docs/plan-lifecycle.md`, `spec/conventions/error-codes.md`
- plan 트래킹 문서 8개(`plan/in-progress/**`, `plan/complete/**`)
- 나머지 60여 개(파일 15~80)는 `review/code/2026/09/01/22_25_37/**` + `review/consistency/2026/09/01/**`
  아래의 **자동 생성 세션 산출물**(`SUMMARY.md`/`_retry_state.json`/`meta.json`/`_target/*.md`/각 checker
  리포트)이다. 이 저장소 관례상 이런 산출물은 gitignore 대상이 아니라 커밋되는 기록물이며, 함수
  길이·중첩·매직 넘버 같은 코드 품질 기준을 적용할 대상이 아니다.

이 changeset 은 직전 리뷰 라운드(`review/code/2026/09/01/22_25_37/`)의 후속(fix 반영본)이다.
`RESOLUTION.md`(파일 15)에 따르면 그 라운드의 INFO 3건 중 2건(매직 넘버 `100` → `MIN_EXPECTED_MD_FILES`
상수화, `TOOL_TAGS` 알파벳 순 정렬)과 WARNING 성격의 testing 지적(`skipDir("archive")` 무검증 분기)이
이미 조치됐다. 실제로 `stray-tool-tags.test.ts` 를 직접 읽어 확인한 결과 세 조치 모두 반영돼 있다 —
`MIN_EXPECTED_MD_FILES = 100`(실측 근거 주석 포함, 오기 정정 이력까지 남김), `TOOL_TAGS` 알파벳순
(`antml < content < function_calls < invoke < parameter`), `collectScanTargets()` 로 `walkTree` 호출을
단일화하고 `mkdtemp` 대조군 fixture(`archived`/`kept.md`)로 `skipDir` 분기를 회귀 고정. 이 부분은 재지적할
결함이 없다.

## 발견사항

- **[WARNING]** 신규 추가된 markdown 문장의 `**` 중첩이 렌더러에서 의도한 강조를 깨뜨린다
  - 위치: `.claude/docs/plan-lifecycle.md:45`
  - 상세: 새로 추가된 불릿의 원문은 다음과 같다 — `` - **이동하는 문서 **자신의** outgoing 링크도 재계산**: 위 항목은 *인입* 참조만 말한다. ... ``. `**` 는 CommonMark/GFM 에서 자기 자신과 중첩(nest)되지 않는 델리미터라, 저자 의도("이동하는 문서 *자신의* outgoing 링크"를 한 문장으로 굵게 하되 그 안의 '자신의'를 한 번 더 강조)와 다르게 파싱된다. 실측(Python-Markdown 렌더 — `pip install markdown` 후 직접 렌더링 확인, 저장소 mutate 없이 scratch 파일로 검증): `<strong>이동하는 문서 </strong>자신의<strong> outgoing 링크도 재계산</strong>` — 정작 강조하려던 "자신의"는 **굵게 렌더링되지 않고**, 대신 무관한 두 구간("이동하는 문서" / "outgoing 링크도 재계산")이 따로따로 굵게 표시된다. 같은 파일의 다른 불릿들(예: 42행 "**이동은 마지막 작업 PR 안에서**: ... **plan 이동만 담은 별 PR 분리 금지**", 47행)은 서로 겹치지 않는 두 개의 독립된 `**...**` 쌍을 쓰는 정상 패턴이라 문제가 없다 — 45행만 하나의 `**...**` 쌍 안에 또 다른 `**...**` 를 끼워 넣어(중첩) 이 파일 안에서도 비일관적이다. 이 문장은 바로 앞 불릿(44행, "인입 참조")과 대비해 "자신의(outgoing) 참조"를 강조하는 것이 요지인데, 렌더링 결과는 그 대비를 전달하지 못한다.
  - 제안: 안쪽 강조를 제거하거나 다른 델리미터로 바꾼다. 예: `` - **이동하는 문서 *자신의* outgoing 링크도 재계산**: ... `` (바깥은 `**`, 안쪽은 `*` — CommonMark 는 서로 다른 델리미터의 중첩은 정상 지원) 또는 안쪽 강조를 아예 빼고 `- **이동하는 문서 자신의 outgoing 링크도 재계산**: ...` 로 단순화.

- **[INFO]** 신규 문단의 괄호 안에 완결된 문장 + 전방 참조가 들어가 있어 한 번에 읽히지 않는다
  - 위치: `spec/conventions/error-codes.md:25-31` (§Overview "적용 범위" 문단)
  - 상세: `` **적용 범위**: 본 규율은 `code:` 의 `ErrorCode` enum(`...error-codes.ts` — 명명이 중앙화된 **대표 surface 중 하나**. 나머지 하나는 아래 문단 참조)뿐 아니라 ... `` — 괄호 안에 마침표로 끝나는 완결 문장("...대표 surface 중 하나.")과 그 뒤에 다음 문단을 가리키는 전방 참조("나머지 하나는 아래 문단 참조")가 들어 있고, 괄호가 닫힌 뒤 바깥 문장("...뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용된다")이 이어진다. 괄호 안에서 문장이 완결되고 다시 바깥 문장이 이어지는 구조라 첫 읽기에서 괄호의 시작과 끝을 놓치기 쉽다. 게다가 바로 다음 문단(29-31행 "**대표 surface 는 둘이다.** ...")이 이 괄호 안의 전방 참조가 가리키는 내용을 이미 완전히 설명하므로, 괄호 안 문장은 사실상 다음 문단의 요약을 미리 축약해 끼워 넣은 것이라 정보가 두 곳에 흩어진다.
  - 제안: 괄호 안에서는 파일 위치 인용만 남기고("...enum(`codebase/backend/src/nodes/core/error-codes.ts`)뿐 아니라...") "대표 surface 중 하나. 나머지 하나는 아래 문단 참조" 부분은 삭제하거나, 바로 다음 문단(29행) 앞으로 옮겨 한 곳에서만 설명하게 한다. 차단 사유는 아님 — spec 규약 문서의 산문이라 팀이 이미 4라운드 `--spec` 검토를 거친 문구임을 고려하면 우선순위는 낮다.

## 요약

이번 changeset 의 실질 코드(`plan_guard.py` 정규식 확장, `test_plan_guard.py` 신규 테스트 3건,
`spec-links.test.ts` 보강, `stray-tool-tags.test.ts` 신규 파일)는 직전 리뷰 라운드에서 지적된 INFO/WARNING
이 모두 반영된 상태로, 함수가 짧고 중첩이 얕으며 공유 헬퍼(`walkTree`, `collectScanTargets`)로 중복을
제거했고 근거 주석이 실측과 일치한다 — 새로 지적할 코드 품질 결함은 없다. 이번 라운드에서 새로 발견한
것은 문서 계층 2건뿐이다: (1) `plan-lifecycle.md` 에 새로 추가된 문장 하나가 `**` 를 자기 자신에
중첩시켜 렌더링 시 의도한 단어("자신의")가 아니라 무관한 구간이 굵게 표시되는 실질적 렌더링 결함(직접
렌더 검증함), (2) `error-codes.md` 새 문단의 괄호 구조가 다음 문단과 정보가 중복돼 약간 읽기 불편함(경미).
두 항목 모두 코드 동작에는 영향이 없고 문서 렌더링/가독성에 국한된다.

## 위험도

LOW
