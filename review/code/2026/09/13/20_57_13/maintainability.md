# 유지보수성(Maintainability) 코드 리뷰 — error-code-emission-axis (라운드 5)

## 검토 범위 및 방법

이 세션은 `error-code-emission-axis` 배치의 **누적 5라운드**(19_23_22 → 19_51_33 → 20_13_13 →
20_34_32 → 20_57_13) 리뷰 중 마지막 라운드다. 실질 코드 변경은 여전히 두 파일에 집중된다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 +
`collectMatches` 공유 헬퍼 + `isMessagePrefixOnly` 정본 + `GUIDE_NON_EMITTED_VOCABULARY`)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 +
`parseWhereRefs`/`staleGuideEntries` 헬퍼 + 대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·두
`logic.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 유지보수성 관점의
발견사항이 없다는 이전 네 라운드의 판단에 동의한다.

프롬프트가 두 핵심 TS 파일의 diff 를 크기 제한으로 생략했으므로 `Read` 로 두 파일 **전문**을
직접 열었고(HEAD `57288e47f`), `git diff afaef5bef...HEAD -- <두 파일>` 로 병합 베이스 대비
누적 diff 전체(라운드 1~4 수정 전부 포함)를 대조했다. 저장소 파일은 건드리지 않았다(읽기
전용 조사만 수행).

**관측된 이상 상태(병렬 리뷰 오염, 자가 회복됨):** 분석 도중 `git status --short` 한 번이
`guide-identifier-existence.test.ts` 를 `M`(수정됨)으로 보고했다. 같은 워킹트리를 동시에
읽는 다른 reviewer 가 뮤테이션 검증 중이었던 것으로 보인다. 즉시 재확인(`git diff`,
`git diff HEAD -- <두 파일>`)한 결과 두 파일 모두 diff 0줄로 **HEAD 와 완전히 일치**했고
이후 `git status --short` 도 계속 clean 하다 — 다른 세션이 `cp` 로 스스로 원복을 마친 것으로
보인다. 이 리포트의 코드 인용은 그 일치를 확인한 시점의 파일 상태를 근거로 한다. 나 자신은
이 워킹트리에 어떤 뮤테이션도 가하지 않았다(`Read` 만 사용).

## 이전 라운드 대비 변화 — 라운드 4 수정 확인

라운드 4 커밋(`57288e47f`)이 두 가지를 고쳤다: (1) `staleEntries` → `staleGuideEntries` 개명
(기존 export 함수 `repo-guards/__tests__/internal-package-registration-guard.ts:129` 과의
이름 충돌 해소), (2) *"발행 축 수집기 3종의 합성 경계 대조군"* JSDoc 을 원래 대상
(`describe("발행 축 수집기 — 경계 대조군"`) 바로 위로 이동. 두 수정 모두 직접 코드를 읽어
확인했다 — 개명 후 저장소 전체에서 `staleGuideEntries` 이름 충돌은 0건(grep 재확인),
JSDoc 은 현재 `guide-identifier-existence.test.ts:569-577` 에서 대상 바로 위에 정확히
붙어 있다(중간에 다른 describe/함수가 끼어들지 않음). 이번 수정 자체가 새로운 유지보수성
결함을 만들지 않았다.

## 발견사항

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 필드가 "산문 + 임베디드 위치 참조"를
  한 문자열에 섞어, 그 참조를 다시 꺼내는 전용 미니 파서(`parseWhereRefs`)를 요구한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:333-354`
    (`where: string` 필드, 예: `"execution-engine.service.ts:7121·7125 — 템플릿 리터럴
    메시지 접두"`), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:54-61`
    (`parseWhereRefs` — `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g` 정규식 + `·` 구분자 분리),
    `:271-284` (그 파서 전용 대조군 `describe` 블록, 4개 `it`)
  - 상세: `where` 는 사람이 읽는 설명(`"— 템플릿 리터럴 메시지 접두"`)과 기계가 검증할
    위치(`file.ts:line[·line...]`)를 한 문자열 안에 섞어 담고 있다. 그 결과 (a) 여러 줄을
    가리키는 표기(`7121·7125`)를 위해 `·` 를 구분자로 쓰는 비표준 미니-DSL이 생겼고, (b) 그
    DSL을 안전하게 파싱하기 위한 정규식 + 전용 대조군 4건이 별도로 필요해졌다(라운드 2 가
    이 정확한 자리에서 "단일 매치만 검증했다" WARNING을 냈고, 그 수정이 지금의 파서다). 만약
    필드 자체를 `where: string`(설명만) + `refs: { file: string; line: number }[]`(구조화된
    위치 배열)로 나눴다면, 파서와 그 파서의 판별 대조군 블록 전체가 사라지고 등록 시점에
    TypeScript 가 형식을 강제했을 것이다. 지금 방식이 틀린 것은 아니다 — 이미 철저히
    테스트되어 있고(파서 자체 대조군 + 존재 검증 둘 다) 등록 3건뿐이라 당장 위험은 낮다.
    다만 향후 등록이 늘거나(상한 5까지 여지가 있다) `where` 표기 형식이 다시 바뀌면, 파싱
    규칙(구분자 `·`, 파일 확장자 `.ts` 고정 등)을 또 조정해야 하는 자리가 바로 여기다.
  - 제안: 급하지 않음(신규 등록이 상한에 가까워지거나 파서를 다시 손댈 일이 생기면) —
    `where` 를 설명 전용으로 남기고 `refs: { file: string; line: number }[]` 필드를 추가해
    구조화된 값을 직접 받는 편이 파서·대조군을 제거하면서 같은 보장(프리텍스트 방지)을 컴파일
    타임에 더 강하게 얻는다.

## 라운드 1~4에서 이월된 항목 (재확인, 변화 없음)

`review/code/2026/09/13/20_34_32/maintainability.md` 가 정리한 이월분을 직접 재확인했고
전부 현재 코드에 그대로 유효하다 — 조치 여부 판단도 동일하게 유지한다(재기술 대신 위치만
갱신):

- `collectMatches` 호출부의 capture-group 인덱스(`2`/`1`/`1`)가 정규식 정의(`scan.ts:260`,
  `:263`, `:266`)와 분리된 숫자 리터럴로 지정된다 — 대조군이 사실상 회귀를 방어하므로 낮은
  우선순위(4라운드 연속 이월).
- vacuity 하한 리터럴(`existence.test.ts:228`〈`>10`〉·`:229`〈`>30`〉, 형제 목록은
  `:404`〈`>2`〉·`:405`〈`>20`〉)이 이름 붙은 상수 없이 존재 — 4라운드 연속 미조치, 실질
  위험 낮음.
- `matchAll`(`scan.ts:281-291`) vs 수동 `lastIndex`(기존 4곳, `scan.ts:456-558`) 관용구 공존
  — 파일 상단 주석(`scan.ts:242-251`)이 명시적으로 유예를 선언한 의도적 상태.
- `GUIDE_EXTERNAL_VOCABULARY`(`scan.ts:300`)/`GUIDE_NON_EMITTED_VOCABULARY`(`scan.ts:333`)
  이름이 한 토큰만 다르고 제약이 정반대 — JSDoc 대조표(`scan.ts:315-318`)로 완화됨.
- `where` 검증(`existence.test.ts:233-269`)이 등록 항목·위치 조합마다 `walkTree` 를 재호출
  — 상한 5(`NON_EMITTED_VOCABULARY_CAP`)가 성장을 억제.
- 파일 서두 주석(`scan.ts:1-124`)이 코드 선언보다 먼저 오는 장문 구조 — "지우지 말 것" 이
  명시된 반증 이력 보존 원칙의 직접 사례.

## 요약

5라운드에 걸쳐 지적된 실질적 유지보수성 결함(수집기 근접 중복, 진리표를 겨눌 수 없는 지역
클로저, `where` 단일 매치 검증 공백, 거울상 죽은-항목 검사 중복과 그 헬퍼의 이름 충돌·판별
대조군 부재, orphan JSDoc)이 이번 라운드 도달 시점에 전부 공유 헬퍼 추출·정본 이관·다중 매치
파서·개명·대조군 추가·주석 재배치로 해소되어 있음을 직접 코드를 읽어 재확인했다. 라운드 4의
개명·주석 이동 수정 자체는 새 결함을 만들지 않았다. 독자적으로 찾은 유일한 신규 관찰은
`GUIDE_NON_EMITTED_VOCABULARY.where` 가 설명 산문과 구조화된 위치 참조를 한 문자열에 섞어
전용 파서·대조군을 요구한다는 점(INFO, 낮은 우선순위 — 이미 철저히 테스트됨)이며, 나머지는
전부 이전 라운드에서 이미 문서화·이월된 항목으로 변화가 없다. 새로운 CRITICAL/WARNING 은
없다. 분석 도중 다른 병렬 세션이 대상 파일을 일시적으로 변형했다가 스스로 원복한 것으로
보이는 흔적을 관측했으나(위 "관측된 이상 상태" 절), 최종 확인 시점 기준 두 파일 모두 HEAD 와
diff 0줄로 일치한다.

## 위험도
LOW
