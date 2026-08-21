STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) Review — masked-marker-contract-7d2e14 (라운드 6, 13_55_59)

## 검토 방법

이 PR은 이미 5라운드(`11_27_29`→`13_34_34`)의 `/ai-review`→`RESOLUTION` 사이클을 거쳤고
(CRITICAL 0 유지, WARNING 3→3→1→3→3→1, 위험도 MEDIUM→MEDIUM→MEDIUM→MEDIUM→LOW→LOW), 매
라운드가 지적한 요구사항 결함은 실제로 소스에 반영돼 왔다. 직전 라운드(`13_34_34`)의
`requirement.md`는 새 CRITICAL/WARNING 없이 확인용 INFO만 남겼다. 이번 라운드는 그 이후 실제로
바뀐 유일한 코드 변경분 — 커밋 `0e7b6fd4c`(`codebase/backend/src/repo-guards/__tests__/
masked-marker-mirror.spec.ts`)만 새로 추가됐다 — 을 직접 `Read`로 열어 재검증했고, 핵심
구현 파일(`codebase/packages/masked-markers/src/index.ts`, backend
`sanitize-error-message.ts`, frontend `masked-markers.ts`, 양쪽 미러 소멸 가드, spec
`14-external-interaction-api.md` §R17, `plan/in-progress/masked-marker-shared-package.md`)도
현재 worktree 상태 그대로 다시 대조했다.

## 발견사항

- **[WARNING] 라운드6 fix 커밋이 backend JSDoc에 자기모순적인 문장을 만들었다 — "완료형 서술이
  거짓이었다"를 고치려던 자리에서 정확히 같은 성격의 새 결함(garbled merge)이 생겼다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36-37`
    (파일 상단 JSDoc 헤더, `describe` 블록 바로 위 — `git show 0e7b6fd4c -- <이 파일>`로 직접
    diff 대조)
  - 상세: 커밋 `0e7b6fd4c`는 frontend에만 있던 "규칙: 판정 분기를 새로 넣거나 고칠 때는
    양쪽에 대칭 캐너리를 함께 넣는다"는 blockquote 문단을 backend에도 대칭으로 추가하려 했다.
    그런데 실제 편집은 새 blockquote(`> **다만 그 안전은 조건부다.**...`)를 원래 있던 평서문
    ("두 스택이... 어느 쪽이 바뀌든 최소 하나는 실행된다. 값의 미러와 달리 탐지 로직의
    중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**: 한 사본이 낡아도 다른 사본이
    같은 불변식을 자기 트리거에서 계속 지킨다.") **중간에 끼워 넣는** 형태로 이뤄졌다. 그
    결과 새로 추가된 "규칙" 문장의 끝에 원래 평서문의 앞부분("값의 미러와 달리... 무력화하지
    않는다**:")이 그대로 이어붙고, 그 문장의 뒷부분("한 사본이 낡아도...")은 다음 줄에서
    `>` 접두사 없이(blockquote 밖으로) 남았다. frontend 버전(`masked-marker-mirror-guard.ts`
    관점에서 대응하는 `masked-marker-mirror.test.ts:39-47`)은 이 평서문이 blockquote **앞**에
    독립 문단으로 먼저 오고, `> 다만... 규칙: ...넣는다.`로 blockquote가 깔끔하게 끝난다 —
    즉 backend만 구조가 깨졌다. 더 심각한 것은 **내용 자체의 모순**이다: 같은 blockquote
    안에서 "로직 결함은 두 사본에 **동시에** 존재하므로 중복이 그것을 막아 주지 않는다"(줄
    34)라고 조건부·경고 톤으로 말한 직후, 몇 줄 뒤(줄 36 끝~37) "탐지 로직의 중복은
    **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**: 한 사본이 낡아도 다른 사본이 같은
    불변식을 자기 트리거에서 계속 지킨다"라는, 정확히 라운드5(`13_14_29` W3)가 "반증된 절대
    서술"이라며 조건부로 고쳐야 한다고 판정했던 바로 그 무조건적 뉘앙스의 문장이 같은
    문단 안에 다시 나타난다. 즉 이 파일은 지금 "중복이 안전하지 않다"와 "중복이 안전하다"를
    같은 blockquote에서 순서만 바꿔 두 번 말하는 셈이라, 다음에 이 JSDoc을 읽는 사람에게
    이 가드 설계의 핵심 불변식(왜 두 사본을 두는지, 그 안전이 왜 조건부인지)을 오히려 더
    혼란스럽게 전달한다. 이 PR의 라운드4·5·6 전체가 다루는 결함 클래스("고쳤다"고 적은
    자리에 실제로는 비대칭/오류가 남는 것)가 이번엔 **같은 수정 커밋 안에서** 문서 텍스트
    레벨로 재발한 것이다. 테스트 동작에는 영향이 없다(JSDoc 내용은 어떤 assertion에도
    쓰이지 않는다) — 그래서 CRITICAL이 아니라 WARNING이다.
  - 제안: `masked-marker-mirror.spec.ts`의 해당 JSDoc을 frontend `masked-marker-mirror.test.ts`
    구조와 동일하게 재정렬한다 — 평서문("두 스택이... 각 사본이 자기 워크플로에서 같은
    불변식을 계속 지킨다")을 blockquote **앞**에 독립 문단으로 두고, `> 다만 그 안전은
    조건부다... 규칙: ...대칭 캐너리를 함께 넣는다.`로 blockquote를 깔끔하게 끝맺는다. 이번
    PR이 반복해서 배운 대로, "고쳤다"고 커밋하기 전에 실제 렌더링된 문단을 한 번 더 읽는
    것이 값싼 예방책이다.

## 확인 — 새로 지적할 사항 없음 (라운드1~5의 요구사항 충족 상태 재확인)

- `codebase/packages/masked-markers/src/index.ts`의 마커 3종(`VALUE_MASK_MARKER='***'` ·
  `KEY_MASK_MARKER='[REDACTED]'` · `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`) · `isMaskedMarker`
  (정확 일치만 판정) · `MAX_MASK_DEPTH=10`은 이관 전후 backend/frontend 원래 값과 완전히
  동일하다. `MASKED_MARKERS`가 `Set`→`readonly string[]`(`Object.freeze`)로 바뀐 것도 전
  소비처(`grep -rn "MASKED_MARKERS\.has("`)가 `.has()`를 쓰지 않아 파손이 없다(재확인).
- backend `sanitize-error-message.ts`: `MAX_REDACT_DEPTH = MAX_MASK_DEPTH`(지역 별칭),
  `isMaskedMarker`/`MASKED_MARKERS` 재export, `deepRedactCore`의 `depth >= MAX_REDACT_DEPTH`
  치환·`isMaskedMarker(v) ? v : VALUE_MASK_MARKER` 재마스킹 방지 로직 전부 이관 전과 동일한
  동작을 유지한다.
- frontend `masked-markers.ts`: `hasMaskedMarkerLeaf`/`scanForMarker`가 값 검사를 깊이 검사보다
  먼저 수행하는 off-by-one 안전장치(치환 마커가 정확히 depth=10에 놓이므로)가 그대로다.
- backend/frontend 미러 소멸 가드(`masked-marker-mirror-guard.ts` 양쪽)는 `SOT_SYMBOLS`(패키지
  export 파생) · `resolveScanDirs`(2단계 실측 파생, `channel-web-chat` 포함) · AST 기반
  `findRedeclaredSymbols` · 경로 접두 경계(`=== SOT_DIR || startsWith(SOT_DIR + '/')`,
  frontend는 `sotPrefix`로 루프 밖 미리 계산) 모두 두 스택에서 구조적으로 대칭이다(라운드3~5
  WARNING이 지적한 비대칭 전부 코드 레벨에서는 해소됨 — 이번 라운드에서 새로 깨진 것은 위
  WARNING 하나, 코드가 아니라 backend spec.ts의 JSDoc 텍스트뿐).
- spec `spec/5-system/14-external-interaction-api.md:1625-1631`(R17)의 "마커 집합과 깊이
  상한의 SoT는 공유 패키지 `@workflow/masked-markers`다" 서술과 frontmatter `code:` 목록
  (`:16` `codebase/packages/masked-markers/src/index.ts`)이 실제 이관과 line-level로 일치한다.
- `plan/in-progress/masked-marker-shared-package.md`의 작업 체크리스트는 `/ai-review`(진행
  중) 한 항목만 미체크이고 나머지는 전부 `[x]`로 실제 상태와 일치한다. "후속(이 PR 밖)"
  절의 backend 깊이 경계 값-고정 테스트 부재는 의도적 이월로 명시돼 있어 새로운 갭이 아니다.
- TODO/FIXME/HACK/XXX 주석은 관련 파일 전체(`codebase/packages/masked-markers/`, 양쪽
  미러 가드/spec, `sanitize-error-message.ts`, `masked-markers.ts`)에서 검색되지 않는다.

## 요약

이 PR은 backend/frontend에 손으로 복제되던 마스킹 마커 상수·판정 함수·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터이며, 6라운드에 걸친 자체 리뷰
사이클에서 값·시그니처·동작 자체는 단 한 번도 지적받지 않았다 — 모든 WARNING은 그 이관을
지키기 위해 새로 만든 미러 소멸 가드 쪽(배치·감시 목록·스캔 범위·완료형 서술)이었다. 이번
라운드에서 검토한 유일한 신규 변경(커밋 `0e7b6fd4c`, backend spec.ts에 "대칭 캐너리 규칙"
문단 추가)은 목표(양쪽 파일에 같은 규칙 문단을 넣는 것) 자체는 달성했지만, 편집 과정에서
기존 평서문과 새 blockquote가 뒤엉켜 backend JSDoc만 구조가 깨지고 내용도 자기모순적으로
읽히는 새 WARNING을 남겼다 — 정확히 이 PR이 5라운드 동안 반복 경계해 온 "고쳤다고 적은
자리에 실제로는 결함이 남는" 패턴이 이번엔 코드가 아니라 그 패턴을 경고하는 문서 자신에서
한 번 더 재발한 것이다. 기능적 영향은 없다(테스트·가드 동작 무관). 그 외 spec fidelity(R17),
plan 체크리스트 정합, 마커 값·함수 시그니처·off-by-one 깊이 처리, 미러 가드의 코드 레벨
대칭성은 전부 재확인됐고 새로 지적할 CRITICAL/WARNING이 없다.

## 위험도

LOW
