# 변경 범위(Scope) 리뷰 — 4라운드째 누적 diff

## 검증 방법 (읽기 전용, 저장소 뮤테이션 없음)

- `git diff --stat origin/main...HEAD` 직접 실행 → 40 files changed, 3046(+)/33(-). 프롬프트에 실린
  파일 40개(1~40)와 경로·건수 정확히 일치(누락·추가 없음).
- `git log --oneline -8` 로 커밋 구성 확인: `cb3a45ac0`(핵심 버그 수정) → `cf613bf89`(1라운드
  Critical+Warning 조치) → `9759699f2`(2라운드 Warning 조치, 문단 경계) → `6eff58339`(3라운드
  Warning 조치, 펜스 테스트 fixture 분리). 전부 같은 결함(`extractLinks` 멀티라인 링크 미탐지)의
  수정→리뷰→조치 사이클.
- `git diff origin/main...HEAD -- 'codebase/**/*.ts' | grep -E '^\+.*import|^-.*import'` → **0건**
  (import 변경 없음).
- `git diff --stat origin/main...HEAD -- '*.json' '*.config.*' 'package.json' 'eslint.config.*'
  'tsconfig*'` → 걸리는 파일은 `review/**/_retry_state.json`·`review/**/meta.json` 6개뿐(리뷰
  세션 메타데이터), 실제 빌드/lint 설정 파일은 diff에 전혀 없음.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`, `spec-links.test.ts`,
  `plan/in-progress/harness-review-gate-followups.md` 를 현재 워킹트리에서 직접 `Read`/`grep` 해
  1~3라운드 RESOLUTION.md 가 주장한 조치(§1~§4 JSDoc 갱신, "병렬 fan-out" 취소선 처리, 백틱 런을
  말로 풀어쓴 문장, 펜스 테스트 fixture 에서 빈 줄 제거)가 실제로 반영돼 있음을 재확인했다.
- `git status --short` → 이 세션의 산출물 디렉터리(`review/code/2026/08/29/15_55_00/`, untracked)
  외 변경 없음. 저장소를 고치지 않았다.

## 발견사항

- **[INFO]** 워크트리 슬러그(`eslint10-upgrade-5e3cf9`)와 실제 작업 주제(spec-link 멀티라인 매칭
  버그 수정)가 여전히 불일치한다.
  - 위치: 워크트리 경로 `.claude/worktrees/eslint10-upgrade-5e3cf9/` (파일 아님, 인프라 메타데이터).
  - 상세: 코드 diff에는 eslint10 관련 변경이 여전히 0건이다. 직전 세 라운드(`review/code/2026/08/29/14_36_39/scope.md`,
    `15_01_34/scope.md`, `15_30_59/scope.md`)가 이미 동일 항목을 INFO로 3회 반복 기록했다. 이번
    라운드에서 새로 벌어진 사실은 없어 Scope 위반으로 보지 않는다 — 네 번째 중복 기재를 피하기
    위해 참고로만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 같은 diff에 이전 3개 리뷰 라운드의 산출물(`review/code/2026/08/29/{14_36_39,15_01_34,15_30_59}/**`,
  37개 파일)이 대량으로 실려 있다.
  - 위치: 파일 4~40 전부.
  - 상세: `CLAUDE.md`의 "코드 리뷰 산출물 | `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 저장
    규약과 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무" 조항 그대로다. 세 개 RESOLUTION.md
    표(파일 4의 §조치 항목, 파일 30의 §조치 항목 등)를 실제 코드 diff(파일 1·2)와 대조한 결과,
    나열된 각 조치(함수 분리, 펜스/빈 줄 분기 병합, 회귀 테스트 추가, 인터페이스 주석, plan 동기화,
    fixture 분리)가 모두 diff의 특정 hunk와 1:1로 대응했다 — 자발적 추가 작업이 아니라 그 라운드가
    지적한 항목에 대한 지시된 조치다. 이 관찰은 앞선 세 scope 리뷰(파일 12·25·37)에서도 각각
    독립적으로 동일하게 NONE/INFO로 판정됐고, 이번 라운드의 재확인도 그 결론을 뒤집지 않는다.
  - 제안: 조치 불요 — 저장소의 표준 리뷰-즉시조치 워크플로.

## 항목별 점검

1. **의도 이상의 변경** — 없음. 4개 커밋 전부가 "`extractLinks()`가 멀티라인 마크다운 링크를
   통째로 못 본다"는 단일 결함과, 그 수정을 검증한 3라운드 리뷰가 지적한 항목(예시 문구 자기지시
   링크, 문단 경계 오판, 분기 못 가르는 fixture)의 후속 조치로만 구성된다. 요청 범위를 벗어난
   무관한 기능·모듈 변경은 없다.
2. **불필요한 리팩토링** — 없음. `extractLinks()`를 `buildMaskedDoc()`/`lineForOffset()`로 분리한
   것과 `isFenceBoundary || inFence || isBlank` 병합은 1·2라운드 Warning에 대한 지시된 조치이지
   자발적 정리가 아니다. `slugify`/`headingSlugs`/`collectHeadings` 등 무관한 함수는 diff에 없다.
3. **기능 확장(over-engineering)** — 없음. 오히려 절제가 관찰된다 — 2라운드가 제안한 "AST
   (`fromMarkdown`) 순회 전환"은 별도 설계 결정으로 판단해 이번 라운드까지 실행하지 않고
   `harness-review-gate-followups.md`에 백로그 항목으로만 등재했다(§수렴 예외 근거 명시,
   `git log -S`로 확인 가능한 3개 커밋 모두 정규식 기반 마스킹만 다듬었을 뿐 AST 전환 코드는
   추가하지 않음).
4. **무관한 수정** — 없음. `git diff --stat` 40개 파일 전부가 이 결함의 수정·검증·리뷰-조치
   사이클에 직접 관련되며, plan 문서 diff도 해당 항목(§멀티라인 링크, §AST 전환 판정)에만
   국한되고 인접한 다른 미해결 항목(§11 잔여, origin 브랜치 해석 등)은 손대지 않았다.
5. **포맷팅 변경** — 실질 변경과 섞인 무의미한 공백/줄바꿈 diff 없음.
6. **주석 변경** — 신규 JSDoc/인라인 주석 다수가 있으나 전부 "왜 이렇게 고쳤는가"·"뮤테이션으로
   무엇을 확인했는가"를 근거와 함께 설명하며, 이 저장소의 근거-중심 주석 컨벤션과 일치한다.
   무관한 주석 삭제·왜곡은 없다.
7. **임포트 변경** — 없음(`grep -E '^\+.*import|^-.*import'` 0건, 재확인 완료).
8. **설정 변경** — 없음. `package.json`/`eslint.config.*`/`tsconfig*` 등은 diff 목록에 전혀 없다.

## 요약

40개 파일로 구성된 이번 누적 diff는 세 번의 리뷰-조치 사이클을 거친 "`extractLinks()` 멀티라인
마크다운 링크 미탐지" 단일 결함 수정 작업이며, 실제 코드/문서 변경(구현 2파일 + plan 1파일)은
그 결함의 수정·검증·완료기록에 정확히 국한된다. 나머지 37개 파일은 프로젝트가 상시 승인한
review/fix 워크플로의 정상 산출물로, 각 RESOLUTION.md의 조치 항목이 실제 diff와 1:1 대응함을
직접 대조해 재확인했다. import·설정 변경은 0건이며, AST 전환처럼 범위를 넓힐 수 있었던 제안은
실행하지 않고 백로그로 절제했다. 앞선 세 라운드의 scope 판정(NONE)을 독립적으로 재검증했고
뒤집을 근거를 찾지 못했다.

## 위험도

NONE
