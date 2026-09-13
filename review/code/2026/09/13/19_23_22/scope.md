# 변경 범위(Scope) 리뷰 — error-code-emission-axis

## 검토 방법

`plan/in-progress/error-code-emission-axis.md` 의 체크리스트(발행 축 구현 + `GUIDE_NON_EMITTED_VOCABULARY`
3종 등록 + 가이드 문장 2종 정정 + 대조군/뮤테이션 + `run-test-all.sh`)를 기준선으로 삼아, 프롬프트에
포함된 16개 파일 각각이 그 기준선 안에 있는지 대조했다. 게이트 숫자가 있는 diff hunk 만 "실제 변경"으로
간주했고(전체 파일 컨텍스트에만 있고 diff 에 `+`/`-` 표시가 없는 줄은 기존 코드로 취급), 각 파일을
`Read` 로 재확인하지 않고 프롬프트에 첨부된 unified diff 를 그대로 근거로 썼다(게이트 숫자가 소스 줄
번호와 일치함을 프롬프트 규약이 보장).

## 발견사항

- **[INFO]** 커밋 범위에 `review/consistency/2026/09/13/18_40_54/**` (파일 9~16, 8개 산출물)가 포함돼
  있다.
  - 위치: `review/consistency/2026/09/13/18_40_54/{SUMMARY.md,meta.json,_retry_state.json,cross_spec.md,rationale_continuity.md,convention_compliance.md,plan_coherence.md,naming_collision.md}` (전부 신규 파일, diff 게이트가 파일 전체를 덮음)
  - 상세: 이 파일들은 기능 코드가 아니라 `--impl-prep` 의무 호출(CLAUDE.md "developer 는 구현 착수
    직전 `consistency-check --impl-prep` 의무")의 산출물이다. `review/` 는 gitignore 대상이 아니고
    plan 소실 대비를 위해 커밋에 포함하는 것이 이 저장소의 정착된 관례이므로, 스코프 이탈이 아니라
    정상적인 워크플로 산출물로 판단했다.
  - 제안: 조치 불필요 — 참고용 기록.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업과 다른(더 큰)
  트래커 문서에 14줄짜리 관찰 노트가 추가됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4014-4027` (diff 게이트 기준)
  - 상세: 추가된 내용은 "`--impl-prep` 에서도 consistency-check 예산 초과 결함이 재현됐다"는, 이번
    작업의 `--impl-prep` 실행 중 우연히 발견한 부작용을 **이미 그 결함을 기록해 둔 기존 항목**에
    이어붙인 것이다. 그 항목 자체를 재작성하거나 인접 서술을 건드리지 않고 관찰 한 단락만 추가했으며,
    대상 파일의 다른 부분(4000줄 이상)은 diff 에 전혀 나타나지 않는다. 발견의 성격상 이 작업의
    부산물이 맞는 자리에 정확히 기록된 것으로 판단, 스코프 이탈이 아니다.
  - 제안: 조치 불필요.

- 그 외 8개 파일(CHANGELOG.md·PROJECT.md·logic{,.en}.mdx·guide-identifier-existence.test.ts·
  guide-identifier-scan.ts·plan/in-progress/error-code-emission-axis.md)은 plan 체크리스트 항목과
  1:1로 대응한다:
  - `logic.mdx:114`·`logic.en.mdx:103` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` KO/EN
    문장 정정. plan §D-2 "문장 처분" 표와 정확히 일치.
  - `guide-identifier-scan.ts` — `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정규식,
    `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 3함수,
    `GUIDE_NON_EMITTED_VOCABULARY` 신규 export — plan §B-3·§D-2 술어 구현과 정확히 일치. 함수마다
    JSDoc 이 길지만(예: `GUIDE_NON_EMITTED_VOCABULARY` 선언부 20줄), 이 저장소는 기존에도 같은
    파일에 훨씬 긴 설계 근거 주석(정규식 경계 감사표 등, 이번 diff 밖의 기존 내용)을 유지해 온
    파일이라 튀는 추가가 아니다. 새로 추가된 주석 전부가 신규 코드(정규식 3개·함수 3개·목록 1개)의
    직접적 설계 근거이며, 무관한 기존 절을 재작성하거나 삭제하지 않았다.
  - `guide-identifier-existence.test.ts` — import 4개(`collectQuotedLiterals`,
    `collectMessagePrefixes`, `collectCatalogCodes`, `GUIDE_NON_EMITTED_VOCABULARY`) 전부 새로
    추가된 테스트 블록("발행 축" describe)에서 실제로 소비된다. 미사용 임포트 없음.
  - `PROJECT.md:300` — `guide-identifier-existence.test.ts` 항목 설명에 "발행 축(2026-09-13 추가)"
    한 단락만 추가, 기존 서술(3축·베이스라인 0·외부 어휘 허용목록 등)은 그대로 보존.
  - `CHANGELOG.md` — 이번 변경 요약 항목 신규 추가, 기존 항목 재작성 없음.
  - `plan/in-progress/error-code-emission-axis.md` — 신규 plan 파일, 이 작업 자체의 추적 문서.

- 포맷팅·주석·임포트·설정 관점에서 지적할 무관한 변경은 발견하지 못했다. 모든 diff hunk 가 plan
  체크리스트의 특정 항목에 직접 대응되며, 의도 밖 리팩터링·기능 확장·무관한 파일 수정은 관측되지
  않았다.

## 요약

16개 변경 파일 전부가 plan(`error-code-emission-axis.md`)의 체크리스트 항목과 1:1로 대응한다 — 가이드
문장 2종 정정, 발행 축 술어 구현 3함수 + 신규 면제 목록 1개, 대응 테스트, 그리고 그 변경을 설명하는
CHANGELOG/PROJECT.md 갱신. `review/consistency/**` 8개 파일은 CLAUDE.md 가 의무화한
`--impl-prep` 호출의 산출물이고 다른 plan 파일에 붙인 14줄 노트는 이번 작업 중 발견한 부작용을 올바른
기존 트래커에 기록한 것으로, 둘 다 스코프 이탈이 아니라 정상 워크플로 부산물이다. 불필요한 리팩토링,
과잉 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도
NONE
