# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan 문서 §1 의 동기(motivation) 서술이 실제 이관 범위와 살짝 어긋난다
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:21-23`
  - 상세: "`typescript-toolchain-guard.ts` 가 `ROOT` · `listAtPath` **두 심볼만** 필요한데..." 라고
    돼 있으나, 같은 파일의 바로 아래 §1 체크리스트 항목(97~103행, `[x] §1 공유 프리미티브
    _shared.ts 분리`)과 실제 코드(`_shared.ts` 헤더 3~5행, `typescript-toolchain-guard.ts` 헤더
    6~10행)는 모두 **세 심볼**(`repoRoot`/`ROOT`/`PackageManifest`) + YAML 서브셋 추출기
    헬퍼(`blockRange`/`findKeyLine`/`listAtPath`)가 이관됐다고 정확히 기록한다. §1 절의 "문제
    설명" 문장만 2026-08-01 작성 당시 그대로 남아 완료 후 실제 범위와 다른 숫자를 말한다.
  - 제안: 오늘 diff 범위는 아니지만(§1 문제 설명 문단 자체는 이번 hunk 밖), 같은 파일 안에서
    문제 서술과 완료 기록이 다른 심볼 수를 말하는 상태이므로 다음 편집 때 "두 심볼" → "세
    심볼(+ 추출기 헬퍼)" 로 맞추면 향후 참조자의 혼동을 줄인다.

- **[INFO]** 신규 헤더 주석 "YAML 서브셋 파서는 여기 없다" 가 파일에 남은 `blockScalarAtPath`
  와 문면상 겹친다 (실질적 오해 가능성은 낮음 — 아래 참조)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:8-9`
  - 상세: "**YAML 서브셋 파서와 루트 탐색은 여기 없다** — 형제 가드(...)도 쓰므로 중립 모듈
    `_shared.ts` 가 소유한다" 라고 단정하지만, 같은 파일에는 `blockScalarAtPath`(227~264행,
    `key: |` 블록 스칼라 추출 — 그 자체로 또 하나의 YAML 서브셋 파서)가 그대로 남아 있다. 다만
    헤더가 "아래 import 지점의 주석이 그 경계를 설명한다"(9행)로 명시적으로 포인터를 걸어
    두었고, 실제로 import 지점 주석(41~49행)이 "그 둘(`blockRange`/`findKeyLine`)은 `_shared`
    의 `listAtPath` 와 **본 파일의 `blockScalarAtPath`** 가 쓴다"고 정확히 밝히므로 파일 전체를
    읽으면 모순이 해소된다. 다만 헤더 첫 문장만 읽으면(포인터를 따라가지 않으면) "이 파일에
    YAML 파싱이 전혀 없다"로 오독될 여지가 있다.
  - 제안: 헤더 8행을 "**범용** YAML 서브셋 추출기(`findKeyLine`/`blockRange`/`listAtPath`)와 루트
    탐색은 여기 없다"처럼 한정어를 붙이면, 가드 전용 `blockScalarAtPath` 가 남아 있다는 사실과
    완전히 정합된다. 차단성 없음.

- **[검증 후 기각]** `loadTypescriptFrom` 반환 타입 변경 근거가 JSDoc 블록이 아니라 별도의
  plain `//` 주석(`typescript-toolchain-guard.ts:204-207`)으로 붙어 있어 IDE hover/JSDoc 툴링에
  노출되지 않을 것이라는 가설을 세웠으나, TypeScript LanguageService(`getQuickInfoAtPosition`)로
  동일 패턴(`/** JSDoc */` 바로 아래 `// line comment` 후 함수 선언)을 재현해 실측한 결과
  `documentation` 필드에 JSDoc 내용이 정상적으로 채워지는 것을 확인했다. 즉 이 배치는 hover/
  typedoc 노출에 실질적 영향이 없어 발견사항에서 제외한다.

## 요약

이번 변경분은 문서화 관점에서 매우 높은 완성도를 보인다. 신규 파일 `_shared.ts` 는 모듈 존재
이유·설계 기준("두 가드가 실제로 공유하는 것만")·과거 리뷰 지적(비대칭 주입점) 반영 경위까지
헤더에 명시했고, 모든 export(`repoRoot`/`MAX_ROOT_SEARCH_DEPTH`/`blockRange`/`findKeyLine`/
`listAtPath`)에 목적·경계 조건·예시가 담긴 JSDoc 이 붙어 있다. 심볼 이관을 받는 두 소비
가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`)의 헤더도 "무엇이
왜 옮겨졌는지"를 대칭적으로 갱신했고, 재export 범위를 좁게 유지한 이유("이관의 부산물로 API 가
넓어지는 건 이관이 아니다")까지 남겨 향후 유지보수자가 같은 실수를 반복하지 않도록 가드레일을
세웠다. `missingCompilerApi` JSDoc 의 "이 경로로" 라는 모호한 지시어를 실제 분기 경로(비객체
분기가 아니라 filter 경로)로 구체화한 것은 코드로 직접 검증한 결과(TS7 스텁이 객체라 filter 를
탐)와 정확히 일치하는 진짜 "주석 정확성" 개선이다. `discoverWorkspaceDirs`/`validateWorkspace
Patterns`/`repoRoot` 모두 "종전에 왜 테스트 불가능했는지 → 이번에 어떻게 겨냥 가능해졌는지"를
JSDoc 에 남겨, 신규 테스트 파일(`shared.test.ts`, `typescript-toolchain.test.ts` 추가분)의 인라인
주석과 정확히 맞물린다. `plan/in-progress/typescript-toolchain-followups.md` 는 2026-08-10 실측
절과 체크리스트 갱신이 실제 코드 변경과 1:1 로 대응하며, 미착수 항목(§3)도 "미착수 유지" 사유를
실측 근거(dependabot pnpm catalog 지원 여부 미확인)와 함께 정확히 남겨 상태 왜곡이 없다.
README·API 문서·CHANGELOG·환경변수 문서화는 이번 변경(내부 dev-tooling 테스트 인프라 리팩터,
사용자 대면 동작·공개 API·엔드포인트·설정 변경 없음)의 성격상 해당 사항이 없으며, 실제로
`PROJECT.md`·`codebase/frontend/README.md`·`CHANGELOG.md` 어디에도 개별 가드 파일 목록을
나열하는 곳이 없어 갱신 누락도 없다(직접 grep 으로 확인). 발견된 두 항목은 모두 INFO 로, 실질적
오해 가능성이 낮거나(포인터로 이미 해소) 이번 diff 범위 밖의 사전 존재 텍스트에 대한 것이라
차단 사유가 아니다.

## 위험도

LOW
