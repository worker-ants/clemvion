# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan §1 "문제 설명" 문장이 실제 이관 범위(세 심볼 + 추출기 헬퍼)보다 좁게 남아 있다
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:21`
  - 상세: "`typescript-toolchain-guard.ts` 가 `ROOT` · `listAtPath` **두 심볼만** 필요한데..." 라는
    §1 문제 설명 문장이 2026-08-01 작성 당시 그대로 남아 있다. 그런데 같은 파일의 §1 체크리스트
    (동일 파일 `:97`~`:103`, `[x] §1 공유 프리미티브 _shared.ts 분리 + DI 대칭화`)와 실제 코드
    (`_shared.ts` 헤더 `:3`~`:5`, `typescript-toolchain-guard.ts` 헤더 `:7`~`:10`, 직접 확인)는
    모두 `repoRoot`/`ROOT`/`PackageManifest` **세 심볼** + YAML 서브셋 추출기 헬퍼
    (`blockRange`/`findKeyLine`/`listAtPath`)까지 이관됐다고 정확히 기록한다. "문제 설명" 단락만
    완료 후 실제 범위와 다른 숫자를 말하는 채로 남아, 같은 파일 안에서 서로 다른 개수를 말하는
    상태가 됐다.
  - 제안: 이 diff 의 hunk 범위 밖(§1 문제 설명 문단 자체는 이번 변경분에 포함되지 않음)이라
    차단 사유는 아니다. 다음 편집 때 "두 심볼" → "세 심볼(+ 추출기 헬퍼)" 로 맞추면 향후 diff-vs-plan
    대조자의 혼동을 줄인다. (동일 항목이 직전 라운드(`review/code/2026/08/10/11_22_14/documentation.md`)
    에서도 지적됐고 조치 불요로 유예됐다 — 이번 라운드에도 여전히 유효하되 여전히 비차단.)

- **[INFO]** 헤더 주석 "YAML 서브셋 파서와 루트 탐색은 여기 없다" 가 같은 파일에 남은
  `blockScalarAtPath` 와 문면상 겹친다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:8`
  - 상세: 직접 열어 확인한 결과 8~9번째 줄은 "**YAML 서브셋 파서와 루트 탐색은 여기 없다** —
    형제 가드(`typescript-toolchain-guard.ts`)도 쓰므로 중립 모듈 `_shared.ts` 가 소유한다"라고
    단정하는데, 같은 파일에는 `blockScalarAtPath`(그 자체로 또 하나의 YAML 서브셋 파서, `key: |`
    블록 스칼라 추출)가 그대로 남아 있다. 헤더가 "아래 import 지점의 주석이 그 경계를 설명한다"로
    포인터를 걸어 두었고 실제 import 지점 주석(`:41`~`:49`)이 "그 둘(`blockRange`/`findKeyLine`)은
    `_shared` 의 `listAtPath` 와 **본 파일의 `blockScalarAtPath`** 가 쓴다"고 정확히 밝히므로 파일
    전체를 읽으면 모순은 해소되지만, 8번째 줄만 읽으면 "이 파일에 YAML 파싱이 전혀 없다"로
    오독될 여지가 남는다.
  - 제안: 8번째 줄에 "**범용**" 같은 한정어를 붙이면(예: "범용 YAML 서브셋 추출기는 여기 없다")
    가드 전용 `blockScalarAtPath` 잔존과 완전히 정합된다. 차단성 없음 — 직전 라운드에서도 같은
    지적이 있었고 조치 불요로 유예됐다.

- **[INFO]** 전 라운드 SUMMARY 의 INFO 귀속이 원 리포트와 어긋난다 (리뷰 산출물 자체의 정합성)
  - 위치: `review/code/2026/08/10/11_22_14/SUMMARY.md:19`(참고 INFO 표 1행) vs
    `review/code/2026/08/10/11_22_14/documentation.md:32-37`(`[검증 후 기각]` 항목) vs
    `review/code/2026/08/10/11_22_14/maintainability.md:10`(`[INFO]` 항목)
  - 상세: SUMMARY 의 "참고(INFO)" 표 1행은 reviewer 를 `documentation` 로 표기하고 "loadTypescriptFrom
    의 반환 타입 변경 근거가 JSDoc 블록이 아니라 별도 `//` 주석이라 IDE hover 에 안 뜬다"는 발견에
    "조치 불요 — 그 주석은 왜 unknown|null 을 버렸는가라는 리팩터 이력이지 계약이 아니다"라는
    사유를 붙였다. 그런데 이 발견 자체는 원래 `maintainability.md` 의 INFO 항목이고, `documentation.md`
    자신은 같은 주장을 별도로 검증해 TypeScript LanguageService(`getQuickInfoAtPosition`) 실측으로
    **반증(hover 에 정상 노출됨을 확인)** 한 뒤 "발견사항에서 제외"했다 — SUMMARY 가 인용한 근거와
    documentation.md 가 실제로 세운 근거가 다르다. `RESOLUTION.md` 의 "조치하지 않은 것" 표도
    reviewer 를 `documentation · maintainability` 로 합쳐 이 차이를 가린다. 실질 결론(조치 불요)은
    동일하지만, 리포트 간 귀속·근거가 어긋난 채 다음 diff 에 그대로 커밋됐다.
  - 제안: 이 diff 자체를 막을 사유는 아니다(감사 추적용 세션 산출물이지 유지되는 문서가 아님).
    다음에 SUMMARY 를 합성할 때는 원 리포트가 "기각(반증)"한 항목과 "미조치(수용)"한 항목을 같은
    사유 문구로 뭉치지 않는 편이 추후 감사자가 "왜 documentation 리뷰어가 그 결론을 냈는가"를
    추적할 때 덜 헷갈린다.

## 요약

핵심 코드 변경분(파일 7개: `_shared.ts` 신설, 두 소비 가드 리팩터, 대응 테스트 3파일, plan
문서)의 문서화 완성도는 매우 높다. 신규 모듈 `_shared.ts` 는 존재 이유·설계 기준("두 가드가
실제로 공유하는 것만")·과거 리뷰 지적(비대칭 주입점) 반영 경위를 헤더에 명시했고, 모든 export
(`repoRoot`/`MAX_ROOT_SEARCH_DEPTH`/`blockRange`/`findKeyLine`/`listAtPath`)에 목적·경계 조건·예시가
담긴 JSDoc 이 붙어 있다. 두 소비 가드(`internal-package-registration-guard.ts`,
`typescript-toolchain-guard.ts`)의 헤더도 "무엇이 왜 옮겨졌는지"를 대칭적으로 갱신했고, 재export
범위를 좁게 유지한 이유까지 남겼다. `missingCompilerApi` JSDoc 의 모호했던 지시어를 실제 분기
경로로 구체화한 것, `discoverWorkspaceDirs`/`validateWorkspacePatterns`/`repoRoot` 모두 "종전에 왜
테스트 불가능했는지 → 이번에 어떻게 겨냥 가능해졌는지"를 JSDoc 에 남긴 것은 신규 테스트 파일의
인라인 주석과 정확히 맞물리는 진짜 "주석 정확성" 개선이다. `plan/in-progress/typescript-toolchain-followups.md`
는 2026-08-10 실측 절·체크리스트 갱신이 실제 코드 변경과 1:1 대응하고, 미착수 §3 도 사유를
실측 근거와 함께 정확히 남겨 상태 왜곡이 없다. README·API 문서·CHANGELOG·환경변수 문서화는
이번 변경(사용자 대면 동작·공개 API·엔드포인트·설정 변경이 없는 내부 dev-tooling 테스트 인프라
리팩터)의 성격상 해당 사항이 없고, 실제로 `PROJECT.md`·`codebase/frontend/README.md`·
`CHANGELOG.md` 어디에도 개별 가드 파일을 나열하는 곳이 없어 갱신 누락도 없다(직접 확인).
남은 두 INFO(plan §1 "두 심볼" 표현, 헤더 "YAML 파서는 여기 없다" 문면 중첩)는 이번 diff 의
hunk 범위 밖에 있던 사전 존재 텍스트이며 직전 라운드에서도 동일하게 지적·유예된 항목으로,
파일 전체를 읽으면 모순이 해소되는 낮은 실질 오해 가능성이다. 추가로 이번 diff 에는 직전 리뷰
라운드(`11_22_14`)의 산출물 11개(SUMMARY/RESOLUTION/meta/각 reviewer 리포트)가 그대로 신규
파일로 포함돼 있는데, 그중 SUMMARY 의 INFO 귀속 한 건이 원 리포트(documentation.md 의 검증-후-기각
vs maintainability.md 의 미조치)와 어긋나는 사소한 정합성 흠이 있다 — 감사 추적용 세션 산출물의
내부 정합성 문제이지 유지되는 문서 결함은 아니다. 전체적으로 차단 사유는 없다.

## 위험도

LOW
