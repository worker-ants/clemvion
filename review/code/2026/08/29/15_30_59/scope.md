# 변경 범위(Scope) 리뷰

대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`,
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`plan/in-progress/harness-review-gate-followups.md` (실질 코드/문서 변경 3파일) +
`review/code/2026/08/29/{14_36_39,15_01_34}/**` 26개 파일(직전 두 리뷰 라운드의 산출물,
신규 파일). 총 29파일 전부를 확인함.

## 발견사항

- **[INFO]** 리뷰 세션 산출물 26개 파일(`review/code/2026/08/29/14_36_39/**` 12개 +
  `review/code/2026/08/29/15_01_34/**` 14개)이 코드 수정과 같은 diff 에 대량 포함됨.
  - 위치: 파일 4~29 전부 (예: `review/code/2026/08/29/14_36_39/RESOLUTION.md`,
    `review/code/2026/08/29/15_01_34/SUMMARY.md` 등).
  - 상세: 언뜻 "무관한 변경"으로 보이지만, 내용을 대조한 결과 전부 이 저장소의 표준 워크플로
    산출물이다 — `CLAUDE.md`("코드 리뷰 산출물 | `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`",
    "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무") 그대로다. 1라운드(`14_36_39`)가
    Critical 1건(plan 예시 문구가 자기 자신이 고치는 `findBrokenPlanLinks` 가드를 깨뜨림) +
    Warning 5건(함수 분리·펜스 분기 중복·off-by-one 회귀 테스트 부재·인터페이스 계약 미문서화·
    plan 상단 요약 stale)을 지적했고, 그 `RESOLUTION.md` 표의 항목이 실제 코드 diff(파일
    1·2 — `buildMaskedDoc`/`lineForOffset` 분리, `isFenceBoundary || inFence` 병합,
    멀티라인 2개/혼재/3줄 스팬 회귀 테스트, `MdLink`/`LinkViolation` 필드 주석, plan 상단
    "셋"→"둘" 동기화)와 1:1로 대응한다. 2라운드(`15_01_34`)는 문단 경계(빈 줄) 오판
    Warning 1건을 추가로 잡았고, 그 조치(`isBlank` 마스킹 + 회귀 테스트, 뮤테이션으로
    RED/GREEN 확인)도 파일 1·2 diff 에 정확히 반영돼 있다. 자발적 추가 작업이 아니라 그
    라운드들이 지시한 조치를 그대로 수행한 결과다. 이 관찰은 두 선행 라운드의 scope 리뷰
    (파일 12, 파일 25)에서도 각각 독립적으로 동일하게 NONE/INFO 로 판정된 바 있다.
  - 제안: 조치 불요. Scope 위반이 아니라 이 저장소의 표준 리뷰-즉시조치 워크플로.

- **[INFO]** 워크트리 슬러그(`eslint10-upgrade-5e3cf9`)와 실제 작업 주제(spec-link 멀티라인
  매칭 버그 수정)가 불일치.
  - 위치: 워크트리 경로 `.claude/worktrees/eslint10-upgrade-5e3cf9/` (파일 아님, 인프라
    메타데이터).
  - 상세: 코드 diff 자체에는 eslint10 관련 변경이 여전히 0건(`package.json`/`eslint.config.*`
    미포함)이다. 직전 두 라운드(파일 12, 파일 25)가 이미 동일 항목을 INFO 로 기록한 반복
    관찰이며, 이번 라운드에서 새로 벌어진 사실은 없다.
  - 제안: 조치 불요. 신규 관찰 아님 — 중복 재지적 방지 목적으로만 기록.

## 항목별 점검

1. **의도 이상의 변경** — 없음. 실질 diff(파일 1~3)는 "`extractLinks()` 가 멀티라인 마크다운
   링크를 통째로 못 본다"는 단일 결함의 수정·회귀 테스트·완료 기록에 정확히 대응하며, 그 외의
   diff(파일 4~29)는 그 수정을 검증한 두 리뷰 라운드가 지시한 조치를 반영한 산출물이다.
2. **불필요한 리팩토링** — 없음. `extractLinks()` 를 `buildMaskedDoc()`/`lineForOffset()` 로
   나눈 것은 자발적 정리가 아니라 1라운드 Warning(함수 책임 과다·펜스 분기 중복)에 대한 지시된
   조치이고, `slugify`/`headingSlugs`/`collectHeadings` 등 무관한 함수는 손대지 않았다.
3. **기능 확장(over-engineering)** — 없음. 오히려 반대 방향 규율이 관찰된다 — 2라운드가
   제안한 "AST(`fromMarkdown`) 순회로 전환" 은 별도 설계 결정이라 판단하고 **하지 않았다**
   (`harness-review-gate-followups.md` 신규 백로그 항목으로만 등재, developer SKILL 수렴
   예외 근거 명시). 요청 범위를 넘는 구현 확장을 스스로 자제한 사례다.
4. **무관한 수정** — 없음. 3개 실질 파일 모두 이 결함과 직접 관련되고, plan 문서 diff 도
   `harness-review-gate-followups.md` 의 해당 항목에만 국한되며 인접한 다른 미해결 항목
   (§11 잔여, origin 브랜치 해석 4곳 등)은 건드리지 않았다.
5. **포맷팅 변경** — 실질 변경과 섞인 무의미한 공백/줄바꿈 diff 없음.
6. **주석 변경** — 신규 JSDoc/인라인 주석이 많지만 전부 "왜 이렇게 고쳤는가"·"무엇을 지키면
   깨지는가"를 설명하는 근거-중심 주석이며, `MdLink`/`LinkViolation` 필드 주석 추가도 이번에
   실제로 바뀐 계약(멀티라인 시 첫 줄 보고, `raw` 개행 포함)을 반영한다. 무관한 주석 삭제·왜곡
   없음.
7. **임포트 변경** — 없음. 두 `.ts` 파일 모두 기존 import 문 변경 없음.
8. **설정 변경** — 없음. `package.json`/`eslint.config.*`/`tsconfig*` 등은 diff 목록에 없음.

## 요약

실질 코드 변경(구현 2파일 + plan 1파일)은 "`extractLinks()` 가 멀티라인 마크다운 링크를
놓친다"는 단일 결함의 수정·검증·완료 기록에 정확히 국한되며, 요청 범위를 넘는 리팩토링·기능
확장·무관한 수정·포맷팅/주석/임포트/설정 변경은 발견되지 않았다. 같은 diff 에 포함된 26개
리뷰 산출물 파일은 언뜻 대량 무관 변경처럼 보이나, 내용 대조 결과 이 저장소가 상시 승인한
"구현 완료 후 자동 review/fix" 워크플로의 정상 산출물이며 그 안의 모든 조치 항목이 실제
코드 diff 와 1:1 대응한다. 특히 2라운드에서 제안된 AST 전환을 즉시 실행하지 않고 백로그로만
등재한 것은 스코프를 의도적으로 좁게 유지한 사례로 평가한다. 워크트리 슬러그 불일치는
직전 두 라운드가 이미 기록한 반복 관찰이라 정보성으로만 남긴다.

## 위험도

NONE
