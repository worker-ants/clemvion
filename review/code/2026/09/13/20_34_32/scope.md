# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 4, `20_34_32`)

## 검토 방법

`git diff origin/main` 으로 전체 diff(문서에 diff 가 생략된 파일 포함)를 직접 재현해 대조했다.
핵심 코드 두 파일(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)은 diff 전문을
`git diff origin/main -- <path>` 로 재확인했고, 문서 4개(`CHANGELOG.md`·`PROJECT.md`·
`logic.mdx`·`logic.en.mdx`)와 트래커 2개(`plan/in-progress/error-code-emission-axis.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md`)도 각각 직접 열어 확인했다. 커밋
이력(`git log`)으로 이 배치가 `65256a109`(feat) → `a397ccc55`(fix R1) → `a4b98eda8`(fix R2) →
`5778885ce`(fix R3) 4개 커밋의 누적임을 확인했고, 나머지 71개 파일은 전부 `review/code/**`·
`review/consistency/**` 하위의 이전 `/ai-review`·`--impl-prep`/`--impl-done` 세션 산출물(라운드
1~3, 이미 커밋됨)이다. 이번 라운드(`20_34_32` 코드 리뷰, `20_34_48` consistency) 자신의 산출물은
아직 untracked 상태로 diff 밖에 있다.

## 발견사항

- **[INFO]** 커밋 범위에 이전 3라운드의 리뷰/consistency 산출물 71개 파일이 포함돼 있다
  - 위치: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13}/**`,
    `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39,20_13_19}/**` (전부 신규 파일)
  - 상세: 이 파일들은 기능 코드가 아니라 CLAUDE.md 가 의무화한 두 게이트(`developer` 구현 착수
    직전 `--impl-prep`, 구현 완료 후 `/ai-review` + Critical/Warning fix, fix 후 재리뷰 반복)의
    산출물이다. `review/` 는 gitignore 대상이 아니고 소실 방지를 위해 코드와 함께 커밋하는 것이
    이 저장소의 정착된 관례이며, 직전 세 라운드의 scope 리뷰(`review/code/2026/09/13/19_23_22/scope.md`·
    `19_51_33/scope.md`)도 동일하게 판단했다. 스코프 이탈이 아니라 정상 워크플로 부산물이다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` — 이 작업과 별개인 대형
  트래커 문서에 3군데(체크 완료 1건 + 신규 항목 2건 + `--impl-prep` 재현 노트 1건, 총 ~60줄)가
  추가돼 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3404-3459`,
    `:4062-4075` (diff hunk 기준, `git diff origin/main` 으로 직접 확인)
  - 상세: 세 삽입 모두 이번 배치가 직접 만들거나(카탈로그 탈출구 미발화 실측·spec 6파일 서술
    불일치) 우연히 재현한(`--impl-prep` 세션의 consistency 예산 초과 결함) 사실을, **그 사실을
    이미 기록하고 있던 기존 항목에 이어붙이거나 그 항목이 명시적으로 요구한 "별도 plan 항목
    등재"를 신규로 추가**한 것이다. 인접 서술을 재작성하거나 삭제하지 않았고, 그 문서의 다른
    4000줄 이상은 diff 에 나타나지 않는다. `review/**` 는 SoT 가 아니므로 plan 으로 옮기지
    않으면 소실된다는 이 저장소의 반복 교훈과 일치하는 배치다.
  - 제안: 조치 불필요.

- 실질 변경 8개 파일(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`·`logic.en.mdx`·
  `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·
  `plan/in-progress/error-code-emission-axis.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
  일부)은 `plan/in-progress/error-code-emission-axis.md` 가 정의한 작업 범위(가이드 문장 정정
  2건 + 발행 축 술어·데이터·테스트 + 이전 라운드 리뷰 지적 fix)와 1:1 대응한다:
  - `logic.mdx:114`·`logic.en.mdx:103` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가
    "코드로 실패한다"는 서술을 "메시지 접두일 뿐 전용 코드는 없다"로 정정. KO/EN 동형, 각 언어
    본문의 딱 한 문장만 바뀌었고 인접 문장(순환·blocking 노드 제약)은 그대로다.
  - `guide-identifier-scan.ts` — `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정규식,
    공유 수집기 `collectMatches`(+3 얇은 래퍼), 핵심 술어 `isMessagePrefixOnly`,
    `GUIDE_NON_EMITTED_VOCABULARY` 신규 export. `collectMatches` 추출은
    `review/code/2026/09/13/19_23_22/maintainability.md` WARNING#7 에 대한 fix-라운드
    대응이고, `isMessagePrefixOnly` 의 export 승격은 `19_51_33` WARNING#3·architecture
    INFO#1 에 대한 대응이다 — 둘 다 RESOLUTION.md 가 같은 근거를 기록하며, 새로운 스코프
    확장이 아니라 직전 라운드 리뷰 지적에 대한 응답이다. 위쪽 기존 4개 수집기의 수동
    `lastIndex` 관용구는 손대지 않고 그대로 남겼다(주석에 "그 리팩터는 별건" 이라 명시).
  - `guide-identifier-existence.test.ts` — import 8개(`collectQuotedLiterals`,
    `collectMessagePrefixes`, `collectCatalogCodes`, `isMessagePrefixOnly`,
    `GUIDE_NON_EMITTED_VOCABULARY` 등) 전부 새 "발행 축" 테스트 블록에서 실제로 소비된다.
    미사용 임포트 없음. `staleEntries` 헬퍼 신설과 기존 `GUIDE_EXTERNAL_VOCABULARY` 호출부의
    인라인 필터를 그 헬퍼 호출로 교체한 것(라인 406-408)은 두 목록이 같은 판정을 공유하게
    하려는 fix(`19_51_33` maintainability WARNING#4 대응)이며, 그 외 기존 "존재 축" 테스트
    본문은 건드리지 않았다.
  - `PROJECT.md:300` — 해당 테스트 파일 설명 한 항목에 "발행 축(2026-09-13 추가)" 단락만
    추가, 기존 서술(3축·베이스라인 0·외부 어휘 허용목록 등)은 보존.
  - `CHANGELOG.md` — 이번 변경 요약 신규 추가, 기존 항목 재작성 없음.
  - `plan/in-progress/error-code-emission-axis.md` — 신규 plan 파일, 이 작업 자체의 추적
    문서(403줄 신규 추가, 다른 파일과 충돌 없음).
  - 위 파일들에서 요청 범위를 벗어난 무관한 리팩토링·기능 확장·포맷팅/주석/임포트/설정 변경은
    발견하지 못했다.

- 포맷팅·주석·임포트·설정 관점에서 지적할 무관한 변경은 발견하지 못했다. 모든 diff hunk 가 plan
  체크리스트 또는 직전 세 라운드 리뷰의 RESOLUTION.md 기록 지적사항에 직접 대응하며, 의도 밖
  리팩토링·기능 확장·무관한 파일 수정은 관측되지 않았다.

## 요약

79개 변경 파일(신규 리뷰 산출물 71개 + 실질 변경 8개)은 전부 세 범주 중 하나로 설명된다 — (1)
`plan/in-progress/error-code-emission-axis.md` 체크리스트에 1:1 대응하는 실질 코드/문서 변경,
(2) CLAUDE.md 가 의무화한 `--impl-prep`·`/ai-review` 게이트와 그 fix 라운드의 산출물(커밋 관례
준수), (3) 이 배치가 다른 트래커에 남긴 정확한 위치의 관찰/등재 노트. 3라운드에 걸친 fix
diff(`collectMatches` 추출, `isMessagePrefixOnly` export 승격, `staleEntries` 공유, `parseWhereRefs`
다중 매치 지원)는 전부 같은 세션의 이전 라운드 리뷰가 지적한 항목에 정확히 대응하는 응답이지,
새로 스코프를 넓히는 변경이 아니다. 불필요한 리팩토링, 과잉 기능 확장, 무관한 파일 수정, 의미
없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도
NONE
