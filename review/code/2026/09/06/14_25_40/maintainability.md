# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 6차례의 `/ai-review`(`10_13_22`→`12_53_28`) 라운드를 거친
`User` 컬럼 방어 3축(`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts`/
`user-secret-absence.ts`) 커밋들과, 그 뒤에 붙은 spec 정정(`0f689bb7e`, 코드 변경 없음
— `spec/conventions/*.md` + `plan/`만 수정)·harness 수정(`8b67300b5`) 두 커밋으로
구성된다. 앞의 6라운드가 지적한 항목(래칫 매직값, `CREATOR_PROJECTION` 단일화, `unwrap`
관측 불가 분기, eager 축 검출력 0건, JSDoc orphan 블록, e2e 라벨 충돌 등)은 이번 세션에서
직접 해당 파일을 열어 재확인했고 전부 반영돼 있어 재발이 없다. `git diff --stat` 으로
6라운드 이후 **실제 애플리케이션 코드가 바뀐 파일은 `.claude/hooks/_lib/review_guard.py` +
`.claude/tests/test_review_guard.py` 하나뿐**임을 확인했으므로(`0f689bb7e`는 spec/plan
문서만, 나머지는 review 산출물 커밋), 이번 라운드는 그 변경분에 검토를 집중했다. 저장소에
뮤테이션은 가하지 않았다(`git status --short` — 세션 산출물 디렉터리 2개만 untracked).

## 발견사항

- **[WARNING]** 블록 리스트 파서가 "줄 전체가 주석/빈 줄"만 건너뛰고, **값 뒤에 붙는
  같은 줄 트레일링 `# comment`** 는 여전히 값의 일부로 삼켜 이 diff 가 닫으려던 것과 같은
  종류의 파서-불일치를 남긴다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code` 함수의
    block-list 분기(`else:  # block list on following` 이후 while 루프, `mm = re.match(r"^\s*-\s*(.+)$", fm[j])` 줄과 그 결과를 그대로 `_clean()` 에 넘기는 부분)
  - 상세: 이번 fix 는 `- <path>` 앞의 **빈 줄·줄 전체 주석**만 건너뛰도록 고쳤다(주석
    본문에 명시: "빈 줄·`#` 주석은 **건너뛴다**"). 그러나 `- codebase/backend/a.ts  # 비고`
    처럼 **값 뒤에 붙는 트레일링 주석**은 `^\s*-\s*(.+)$` 가 `.+` 로 통째로 캡처하고,
    `_clean()`(`strip().strip('"').strip("'")`)은 앞뒤 공백·따옴표만 제거할 뿐 `#` 이후를
    자르지 않는다. 실제로 재현해 보면
    (`re.match(r"^\s*-\s*(.+)$", "  - codebase/backend/a.ts  # trailing note")`) 캡처값이
    `"codebase/backend/a.ts  # trailing note"` 그대로 남고, 이 문자열이 그대로 glob 으로
    컴파일된다 — 어떤 실제 파일 경로와도 매치되지 않는 죽은 패턴이 된다. 반면 프런트엔드가
    쓰는 `gray-matter`(실측: `matter("---\ncode:\n  - codebase/backend/a.ts  # trailing note\n...")`)는
    표준 YAML 규칙대로 트레일링 주석을 정확히 잘라 `"codebase/backend/a.ts"` 만 남긴다.
    즉 이번 fix 가 "두 파서가 유효한 YAML 에 다른 답을 내는" 문제를 **줄-전체 주석·빈 줄**
    두 형태에서는 닫았지만, **같은 줄 트레일링 주석** 형태는 여전히 열려 있다 — 정확히
    같은 실패 모양(파일이 조용히 spec-linked 판정에서 빠짐)을 재현할 수 있는 자리다. 현재
    `spec/**/*.md` 의 `code:` 블록 리스트 항목 중 트레일링 `#` 주석을 쓰는 곳은 없어(직접
    grep 확인) 지금 당장 살아있는 유실은 아니지만, 이 PR 의 커밋 메시지 스스로가 "산문
    규율은 다음 제안을 막지 못한다" — 즉 규칙을 문서화하는 것만으론 재발을 막지 못한다는
    것을 이번 회귀로 증명했다. 새 테스트 3건(`test_parse_block_list_survives_yaml_comment`
    등) 도 이 트레일링 형태는 다루지 않는다.
  - 제안: `mm.group(1)` 을 `_clean()` 에 넘기기 전에 따옴표로 감싸이지 않은 값에 한해
    ` #` 이후를 잘라내는 정규화를 추가하거나(`gray-matter`/YAML 표준과 동일 규칙), 최소한
    `test_parse_block_list_survives_yaml_comment` 옆에 트레일링 주석 케이스를 하나 추가해
    현재 동작(값에 주석이 섞여 들어감)이 의도인지 결함인지를 명시적으로 고정한다.

- **[INFO]** `_parse_frontmatter_code` 최상단 docstring이 새로 추가된 "빈 줄·주석
  건너뛰기" 동작을 언급하지 않는다
  - 위치: `.claude/hooks/_lib/review_guard.py:601-604` (`def _parse_frontmatter_code`
    바로 아래 docstring, `"""Extract the code: glob list ... Returns [] when ..."""`)
  - 상세: 실제 동작 설명은 함수 본문 중간(라인 640-647)의 다국어 인라인 주석에만 있고,
    함수 계약을 요약하는 최상단 docstring 은 여전히 "inline / single-value / block-list"
    세 형태만 언급한다. 함수 시그니처만 보고 호출하는 사람은 block-list 안에 주석이나
    빈 줄이 섞여도 안전한지 docstring 만으로는 알 수 없고, 본문을 끝까지 읽어야 한다.
  - 제안: docstring 에 한 줄 추가(예: "Block-list entries may be interleaved with blank
    lines and `#` comments; only a non-`- `, non-comment, non-blank line ends the list.").

## 요약

이번 라운드에서 실질적으로 새로 검토할 애플리케이션 코드는 `review_guard.py` 의
`_parse_frontmatter_code` block-list 분기 수정과 그 회귀 테스트 3건뿐이며, 나머지는 이미
6라운드를 거쳐 안정화된 `User` 컬럼 방어 코드(재확인 결과 재발 없음)와 spec/plan 문서
정정(코드 변경 없음)이다. 이번 fix 자체는 가독성이 높고(원인·실측 수치·근거를 인접
주석에 남김), 함수 길이·중첩 깊이도 기존 범위를 벗어나지 않으며, 새 테스트 3건이 "주석
줄"·"빈 줄"·"다음 키에서는 멈춘다"(반대 방향 대조군)를 모두 걸어 넓힌 술어의 함정도
스스로 피했다. 다만 이 fix 가 닫으려 한 정확히 같은 결함 클래스(두 YAML 파서의 불일치로
인한 조용한 entry 유실)가 "값 뒤 트레일링 주석" 형태에서는 아직 열려 있고, 이를 막는
테스트도 없다 — 지금 저장소에 이 형태를 쓰는 spec 파일은 없어 당장의 위험은 낮지만, 이
PR 의 교훈("산문 규율은 다음 제안을 막지 못한다")을 그대로 적용하면 이 갭도 다음 라운드
전에 닫아 두는 편이 일관적이다. Critical 급 유지보수성 결함은 발견하지 못했다.

## 위험도

LOW
