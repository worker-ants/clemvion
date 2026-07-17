# 문서화(Documentation) 리뷰 — 레이어 가드 테스트 메시지 상호배타성 보강 + 종결 리뷰 산출물 커밋

## 리뷰 범위 확인

실제 코드 변경은 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 1개 파일이며,
직전 라운드(`review/code/2026/07/17/23_49_51`)의 WARNING #1(테스트 검증력 gap: static 메시지
뒤바뀜 미탐지)·WARNING #2(모듈 JSDoc staleness)를 겨냥한 fix다. 함께 포함된
`spec/conventions/frontend-layering.md` 갱신(§4.1 "메시지 콘텐츠" 항목 추가)과, 직전 리뷰
라운드(`review/code/2026/07/18/00_33_58/*`)의 RESOLUTION.md·SUMMARY.md·개별 reviewer 산출물을
저장소에 기록으로 남기는 신규 파일 12개도 diff 에 포함돼 있다. 후자는 프로젝트 규약상
`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 경로 관례에 맞는 정상 아카이브이며 실행 코드가
아니므로, 문서화 관점에서는 "내용이 그 시점 기준으로 자기 일관적인가" 정도만 확인했다(문제 없음).

## 발견사항

- **[INFO]** 모듈 JSDoc staleness(직전 라운드 WARNING #2)는 이번 diff 에서 정확히 해소됨 — 확인 사항
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:7-18`
  - 상세: 직전 라운드에서 지적된 대로 모듈 최상단 JSDoc 이 `src/lib/**` 단독 스코프만 기술하던 문제가,
    이번 diff 에서 `LOWER_LAYERS`(`src/lib/**`·`src/types/**`) 를 포괄하는 서술로 갱신됐고
    `spec/conventions/frontend-layering.md` SoT 링크도 추가됐다. 아래쪽 실제 파일 내용
    (`describe.each(EXPECTED_LOWER_LAYERS...)` 로 `src/types` 전용 스위트가 이미 존재)과도 이제
    합치한다. 두 describe 스위트의 관심사 분리(합성 config 로 규칙 *내용* 검증 vs 실제 ESLint API 로
    *스코프* 검증)를 JSDoc 에 명시한 것도 이후 유지보수자가 두 스위트의 존재 이유를 헷갈리지 않게
    해주는 유효한 개선이다. 조치 불필요 — 참고로 기록.

- **[INFO]** 최상위 `describe()` 타이틀이 여전히 "src/lib" 단독 명명으로 남아 동일 계열의 잔여 staleness
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:219` (`describe("src/lib layering guard (eslint.config.mjs, 실제 config 로드)", ...)`, 이번 diff 미변경 라인)
  - 상세: 이번 diff 가 모듈 JSDoc 의 "src/lib 단독" 서술은 정확히 고쳤지만, 몇 줄 아래
    `describe` 블록 이름은 `src/types` 확장(`00b3b05a4`) 이후에도 여전히 "src/lib layering guard"
    로 남아 있다. 이 스위트가 실제로 검증하는 것은 (파일 경로 스코프가 아니라) 병합된 규칙의
    *내용*이라 `src/lib` 이라는 이름이 완전히 틀린 것은 아니지만, 파일 전체가 `LOWER_LAYERS` 두 계층을
    다루는 지금 시점엔 최상위 그룹 이름만 예전 단일 계층 명명 관성을 유지하고 있어 vitest
    출력(`describe > it` 트리)을 훑는 사람에게 "이 스위트는 src/lib 전용" 이라는 오인을 줄 수 있다.
    이번 diff 가 정확히 같은 종류의 staleness(JSDoc)를 고친 직후라 잔여 사례로 눈에 띈다.
  - 제안: 급하지 않음(diff 스코프 밖, 신규 도입 문제 아님). 여유 있을 때
    `describe("레이어 가드 (eslint.config.mjs, 실제 config 로드)", ...)` 등으로 일반화하거나
    `LOWER_LAYERS.join(" · ")` 를 타이틀에 인터폴레이션해 config 와 자동 동기화하는 편이 이후
    계층이 또 늘어날 때 같은 staleness 재발을 막는다.

- **[INFO]** 인라인 주석 품질 — 신규 `present`/`absent` 구조에 대한 "왜"가 코드와 정확히 대응
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:226-233`
  - 상세: 새로 추가된 주석("static 메시지의 부분 문자열 문제 → positive 만으로 부족 → negative
    단언 필요")이 실제 `cases` 배열의 `present`/`absent` 필드 및 static 케이스가 `present: []` 인
    이유("두 mark 의 부재가 곧 static 상수라는 증거")까지 정확히 설명한다. RESOLUTION.md 가 주장하는
    실측 mutation 재현 근거와도 서술이 일치한다. 복잡한 로직에 대한 인라인 설명으로 충분히 적절함 —
    별도 조치 불필요.

- **[INFO]** spec 문서(`frontend-layering.md` §4.1) 갱신이 테스트 변경과 정확히 대응
  - 위치: `spec/conventions/frontend-layering.md:89` (§4.1 "메시지 콘텐츠" 신규 불릿)
  - 상세: 새 불릿의 서술("세 진입점 메시지는 공통 부분문자열을 공유하므로 positive `toContain` 만으로는
    상수 뒤바뀜을 못 잡는다 — 각 진입점이 다른 진입점의 고유 문구를 담지 않는지(negative)까지 봐서
    상호 배타적으로 식별한다")이 테스트 파일의 실제 구현(`present`/`absent` 케이스 구조)과 정확히
    일치한다. §4.1 "이 테스트가 고정하는 것" 목록이 이제 테스트 스위트의 실제 보장 항목과 완전
    대응돼, 직전 라운드 INFO #1(목록 gap)도 함께 해소됐다. 조치 불필요.

- **[INFO]** CHANGELOG 미갱신은 타당함
  - 위치: 루트 `CHANGELOG.md` (변경 없음)
  - 상세: 저장소의 `CHANGELOG.md` 는 사용자 가시 기능/버그 fix 단위로 기록되는 관례(예: `#964`,
    `#958` 항목)이며, 이번 diff 는 프로덕션 동작 변경이 없는 회귀 테스트 검증력 보강 + 문서
    staleness 정정이라 이 관례상 CHANGELOG 대상이 아니다. 미기재가 누락이 아님을 확인.

## 요약

이번 diff 의 핵심 문서화 이슈였던 모듈 JSDoc staleness(직전 라운드 WARNING #2)는 `LOWER_LAYERS`
두 계층을 포괄하는 서술과 SoT 링크, 두 스위트의 관심사 분리 설명으로 정확히 해소됐고,
`spec/conventions/frontend-layering.md` §4.1 도 신규 메시지 콘텐츠 검증 항목을 실제 테스트 구조와
정확히 대응시켜 갱신됐다. 신규 인라인 주석(`present`/`absent` 구조의 근거)도 복잡한 로직에 대한
설명으로 적절하다. 유일하게 남은 관찰 사항은 최상위 `describe()` 타이틀이 여전히 "src/lib" 단독
명명을 유지해 이번에 고친 것과 같은 계열의 경미한 잔여 staleness라는 점이나, 이는 이번 diff 가
건드리지 않은 기존 라인이고 실제 검증 내용에는 영향이 없어 INFO 수준이다. README·API 문서·
CHANGELOG·설정 문서 업데이트가 필요한 변경은 없다(테스트 전용 + spec 문서 자체 갱신).

## 위험도
LOW
