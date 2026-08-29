# 요구사항(Requirement) 리뷰 — `extractLinks()` 멀티라인 링크 지원 (4라운드 누적 최종 상태)

## 컨텍스트

이번 라운드(`15_55_00`)가 보는 `origin/main...HEAD` diff(`spec-links.ts` +143/-25,
`spec-links.test.ts` +151, `plan/in-progress/harness-review-gate-followups.md`)는 이미
3개 이전 리뷰 라운드(`14_36_39` → `15_01_34` → `15_30_59`)를 거쳐 각 라운드가 낸
CRITICAL/WARNING 을 흡수한 **누적 최종 상태**다. HEAD 는 4개 커밋
(`cb3a45ac0` 최초 구현 → `cf613bf89` plan 자기 트랩 CRITICAL 수정 →
`9759699f2` 빈 줄 문단 경계 수정 → `6eff58339` 펜스 테스트 fixture 오염 수정)으로
구성되며, 이번 라운드는 그 최종 결과물을 처음 보는 시선으로 독립 검증했다.

## 검증 방법

- `npx vitest run` 으로 `spec-links.test.ts`(37건 신규 포함) + `spec-link-integrity.test.ts`
  (라이브 `spec/**`+거버넌스 스캔, positive-only) + `plan-frontmatter.test.ts`(라이브
  `plan/in-progress/**` 링크 스캔 포함) 를 실제 구동 — **194 passed (3 files)**, RED 없음.
  특히 `plan-frontmatter.test.ts` 의 "top-level in-progress plans have no broken relative
  links" 가 통과한다는 것은, 3라운드 전 CRITICAL(plan 문서 자신의 예시 문구가 진짜 링크가
  되어 build 를 깼던 것)이 지금 이 순간 살아있는 트리에서 실제로 해소됐음을 재확인한다.
- `spec-links.ts` 전체 파일과 `spec-impl-evidence.md` §4.2 표를 Read 로 대조.
- `harness-review-gate-followups.md` 의 "현재 상태" 절과 체크박스·취소선 서술을 Read 로
  전문 대조.
- 뮤테이션 없음(읽기 + `vitest run` 만 수행), `git status --short` 로 확인 — 세션 산출물
  디렉터리(`review/code/2026/08/29/15_55_00/`) 외 변경 없음.

## 발견사항

- **[INFO]** `MdLink.raw`(및 `LinkViolation` 이 참조하는 원본 매치 문자열)는 멀티라인 링크의
  중간 줄에 인라인 코드가 있으면 마스킹 후 문자열(백틱 제거된 상태)을 담는다 — 원문 그대로가
  아니다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `extractLinks` 의
    `out.push({ line: lineForOffset(doc, m.index), raw: m[0], target: url })` (`m[0]` 은
    `doc.body`, 즉 마스킹된 전문에서 얻은 매치이지 원문 슬라이스가 아니다).
  - 상세: 인터페이스 주석은 "멀티라인 링크면 개행을 포함한다"까지만 말하고, 인라인 코드가
    섞인 멀티라인 링크에서는 `raw` 가 원문과 달라질 수 있다는 점은 언급하지 않는다. 다만
    `grep -rn "\.raw\b"` 로 확인한 결과 `MdLink.raw` 를 실제로 소비하는 호출부가 현재
    저장소에 전혀 없어(문서화 리뷰가 이미 같은 결론을 냄) 즉각적인 기능 결함은 없다 — 잠재
    계약 갭으로만 기록.
  - 제안: 조치 시급하지 않음. `raw` 를 소비하는 코드가 새로 생길 때 이 사실을 알 수 있도록
    인터페이스 주석에 한 줄 보강(`raw: string; // may reflect inline-code-stripped text for
    multi-line links, not a verbatim slice`)을 고려.

- **[INFO]** ANCHOR 위반이 멀티라인 링크에서도 정확히 탐지되는지를 고정하는 통합 테스트는
  여전히 없다(DEAD 경로만 `describe("멀티라인 링크의 깨진 타깃도 잡힌다", ...)` 에서 고정됨).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (`ANCHOR` 문자열
    검색 결과 기존 단일라인 fixture 3곳에만 존재, 신규 멀티라인 `describe` 블록엔 없음).
  - 상세: `findBrokenLinksInFiles` 의 ANCHOR 분기는 `link.target` 문자열만 사용하고
    `extractLinks` 가 반환하는 `target` 은 멀티라인 여부와 무관하게 동일 형식이라 위험도는
    낮다. 3라운드 전 리뷰(`14_36_39` testing.md)가 이미 같은 지적을 냈고, RESOLUTION 은
    "DEAD 경로가 같은 `extractLinks` 산출을 쓰므로 추가 판별력이 낮다"고 명시적으로 우선순위
    낮음 판정했다 — 그 판단을 뒤집을 새 근거는 이번 검증에서 찾지 못했다.
  - 제안: 그대로 defer 유지 가능. 여유가 있으면 `describe` 블록에 "멀티라인 링크의 깨진
    자기참조 앵커도 잡힌다" 케이스 1개 추가.

- **[INFO]** spec fidelity — `extractLinks()` 의 내부 매칭 전략(줄 단위 vs 전문 매칭)을
  규정하는 spec 문서는 없다. `spec/conventions/spec-impl-evidence.md` §4.2 표
  (`spec-link-integrity.test.ts` 행)는 가드의 **스코프**(3개 트리·target filter 유무·
  `checkSelfAnchors` on/off)만 SoT 로 규정하고, 내부 파싱 알고리즘은 구현 세부사항으로
  남겨둔다. 이번 diff 이후에도 표에 서술된 스코프·filter 동작(`findBrokenLinks`,
  `findBrokenSpecLinksInSources`, `findBrokenGovernanceLinks`, `findBrokenPlanLinks` 네
  진입점의 `checkSelfAnchors`/`targetFilter` 조합)은 코드와 line-level 로 일치한다 —
  불일치 없음, spec drift 아님.

- **[INFO]** (재확인, 이전 라운드들이 이미 낸 CRITICAL 은 전부 해소됨을 직접 재현)
  - 3라운드 전 CRITICAL(plan 예시 문구의 자기 트랩)은 `plan/in-progress/harness-review-gate-followups.md:113-116` 부근에서 펜스 코드블록(` ``` `)으로 감싸져 있고, `plan-frontmatter.test.ts`
    라이브 스캔이 GREEN 임을 이번 라운드가 직접 재실행해 재확인했다.
  - 2라운드 전 WARNING("빈 줄(문단 경계)을 못 잠근다")은 `buildMaskedDoc` 의
    `isBlank` 분기(`spec-links.ts:140-143`)와 회귀 테스트
    `it("**빈 줄**(문단 경계)을 넘는 텍스트는 링크가 아니다", ...)`(`spec-links.test.ts:363`)로
    고정돼 있다.
  - 1라운드 전 WARNING("펜스 테스트가 실은 빈 줄만으로 통과했다")은 fixture 에서 중복
    빈 줄을 제거해 펜스 조건만으로 갈리도록 고쳐졌다(`spec-links.test.ts:374`, RESOLUTION
    `15_30_59` 의 "펜스 조건을 지우면 RED (4 failed/22)" 재뮤테이션 근거 기록).
  - plan 상단 "현재 상태" 요약의 개수(둘)·취소선 서술도 `harness-review-gate-followups.md:24-45`
    에서 실제 해소 이력과 일치함을 확인했다(2026-08-29 `#1235`/`#1229` 둘 다 취소선 처리).

## 요약

`extractLinks()` 를 줄 단위 매칭에서 마스킹된 전문(全文) 매칭 + 이진 탐색 줄 복원으로 바꾼
핵심 수정은 기능적으로 완결돼 있다. 멀티라인 링크 텍스트 포착·목적지 개행 금지·펜스 경계
차단·빈 줄(문단 경계) 차단 네 불변식이 모두 CommonMark 정본 파서(`mdast-util-from-markdown`)
대조로 검증됐고, 3개 선행 리뷰 라운드가 순차로 찾아낸 CRITICAL 1건(plan 문서 자기 트랩) +
WARNING 2건(빈 줄 미잠금, 펜스 fixture 오염)이 모두 코드·테스트·plan 문서 세 곳에서
일관되게 해소된 상태를 이번 라운드가 `vitest run`(194 passed, 라이브 트리 스캔 포함)으로
직접 재현·재확인했다. TODO/FIXME 류 미완성 표식은 없고, `MdLink`/`LinkViolation` 인터페이스
필드 주석도 새 계약(시작 줄·개행 포함 가능)을 반영해 갱신돼 있다. 남은 것은 소비처가 없는
`raw` 필드의 잠재 문서화 갭과 ANCHOR-멀티라인 조합 통합 테스트 부재뿐이며, 둘 다 이전 라운드가
이미 우선순위 낮음으로 판정했고 이번 검증도 그 판단을 뒤집을 근거를 찾지 못했다 — 신규
CRITICAL/WARNING 없음.

## 위험도

NONE
