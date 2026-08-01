# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `plan/in-progress/eslint-unicorn-peer-restore.md` 이 인용하는 `eslint.config.mjs` 구주석의 줄 번호 참조가 현재 파일 상태와 더 이상 일치하지 않음(의도된 역사적 인용)
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md` "이건 단순 bump 가 아니라 명시된 의도를 깬 것이다" 절(파일 내 검색: "`codebase/backend/eslint.config.mjs:16-18` 이 pin 근거를")
  - 상세: 이 절은 `codebase/backend/eslint.config.mjs:16-18` 을 인용하며 dependabot #1049 가 깨뜨리기 전 3줄짜리 구주석("... 버전: ^56 — v57+ 는 eslint peer 를 >=9.20 으로 올려 ... v56 고정.")을 코드 블록으로 그대로 옮겨 적고 있다. 그런데 이번 PR 자체가(같은 커밋에서) 그 주석을 registry 실측 표를 포함한 16~34행짜리 새 주석으로 완전히 재작성했다 — `grep -n "v56 고정" codebase/backend/eslint.config.mjs` 결과 0건으로, 인용된 문구가 현재 파일 어디에도 존재하지 않는다. 이 절 자체는 "dependabot 이 무엇을 깼는가"를 설명하는 과거형 서술("적어두고 있었다")이라 의도적인 역사적 스냅샷이며 오도하려는 의도는 없다. 다만 향후 이 plan 문서만 읽고 `eslint.config.mjs:16-18` 을 직접 열어보는 사람은 다른 텍스트(새 주석의 앞부분)를 보게 되어 잠깐 혼란스러울 수 있다.
  - 제안: 조치 불요(정보성). 편집 여유가 있다면 "(dependabot #1049 가 깨기 전 원문, 이번 PR 이 아래처럼 확장 재작성함)" 같은 한 줄을 덧붙이면 시점 혼동을 줄일 수 있다.

- **[INFO]** 이전 라운드(`review/code/2026/08/01/12_27_15`)에서 Documentation WARNING #1로 지적된 `PROJECT.md` 카운트 drift 가 이번 커밋에서 완전히 해소됨
  - 위치: `PROJECT.md:49-51`
  - 상세: "현재 `typescript` 1건" → "현재 `typescript`·`eslint-plugin-unicorn` 2건"으로 갱신됐고, `.github/dependabot.yml` 의 `ignore` 블록 항목 수와 동기화하라는 **결속** 문구("항목을 추가/제거할 때는 이 문장의 카운트도 같은 커밋에서 함께 갱신할 것(2-place 편집)")가 명시적으로 추가됐다. `eslint-plugin-unicorn` 근거 문단(50-51행)도 사고 배경·주석 참조·회귀 가드 파일 경로까지 갖춰 상세하다. 실측: `.github/dependabot.yml` 의 `dependency-name:` 항목이 정확히 2개(`typescript`, `eslint-plugin-unicorn`)로 카운트와 일치.
  - 제안: 없음(참고 기록).

- **[INFO]** 이전 라운드 Testing WARNING #2(자동 회귀 가드 부재)와 Maintainability WARNING #3(registry 표 3중 중복)도 이번 커밋에서 해소됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`(+ `eslint-unicorn-peer-guard.ts`, `eslint-unicorn-peer-fixture.ts`), `codebase/backend/eslint.config.mjs:16-34`, `.github/dependabot.yml:75-93`
  - 상세: `eslint-unicorn-peer.spec.ts` 는 헤더 주석에 배경·사고 경위·"왜 여기(backend jest)인가"·`lintFixtureText` 가 CLI 서브프로세스를 쓰는 이유(실측 확인됨, Jest VM 의 동적 import 제약 회피)까지 상세히 문서화했고, 각 함수(`parseGteFloor`/`parseCaretFloor`/`parseVersion`/`compareTriple`/`satisfiesFloor`)에 JSDoc 이 붙어 있다. registry 실측 표는 `eslint.config.mjs` 를 단일 SoT 로 삼고 `.github/dependabot.yml`·plan 문서는 "참조만" 하도록 정리되어, 향후 값 갱신 시 한 곳만 고치면 된다. 형제 가드(`typescript-toolchain-guard.ts`)와의 패턴 일치도 주석으로 명시해 두어 유지보수자가 두 가드의 관계를 바로 파악할 수 있다.
  - 제안: 없음(참고 기록). 3건 모두 코드 리뷰 사이클(발견 → RESOLUTION → 재검증)이 의도대로 작동한 좋은 사례.

- 그 외 관점(README/API 문서/설정 문서/CHANGELOG/예제 코드)은 이번 diff 범위(순수 devDependency 롤백 + dependabot 설정 + backend jest 회귀 가드 + plan 문서)에서 해당 없음으로 판단:
  - README·API 문서: 신규 공개 API·엔드포인트·사용자向 기능 없음.
  - CHANGELOG: 확립된 선례(spec/제품 대상 변경만 기재, 직전 동일 클래스 작업 `#1058` 도 미기재) 유지, 갱신 불요.
  - 설정 문서: 신규 환경변수 없음. `eslint-plugin-unicorn` 버전/설정 근거는 코드에 가장 가까운 `eslint.config.mjs` 인라인 주석이 SoT 로 적절히 관리됨.
  - 예제 코드: `eslint-unicorn-peer.spec.ts` 자체가 3케이스(위반/준수/`^_` 면제) + 합성 파서 케이스로 가드 함수들의 사용 예시를 충분히 제공.

## 요약

이번 라운드(13_10_20)는 직전 라운드(12_27_15)의 문서화 관련 WARNING(PROJECT.md 카운트 drift), 테스트 관련 WARNING(자동 회귀 가드 부재), 유지보수성 관련 WARNING(registry 표 3중 중복)을 전부 해소한 fix 커밋을 대상으로 한다. `PROJECT.md`·`eslint.config.mjs`·`.github/dependabot.yml` 세 문서가 서로를 명시적으로 참조하며 결속을 남겼고(개수 2-place 편집 문구, SoT 단일화, "pin 을 풀려면 저 항목도 지워야 한다" 상호 참조), 신설된 회귀 가드 테스트 3파일도 배경·근거·패턴 일치 이유까지 갖춘 모범적인 인라인 문서화 수준이다. 유일하게 발견한 항목은 plan 문서가 인용한 구주석의 줄 번호가 이번 커밋 자체의 주석 재작성으로 stale 해졌다는 INFO 1건이며, 이는 의도된 역사적 서술이라 조치 불요 수준이다. CHANGELOG·README·설정 문서 갱신 필요성도 확립된 선례와 일치해 갭이 없다.

## 위험도
NONE
