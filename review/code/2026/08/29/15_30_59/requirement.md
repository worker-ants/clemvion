# 요구사항(Requirement) 리뷰 결과

## 검증 방법 (읽기 전용)

저장소를 뮤테이션하지 않고 다음을 직접 실행/확인했다 (`git status --short` 로 시작·종료 시 clean 확인):

- `pnpm exec vitest run spec-links.test.ts plan-frontmatter.test.ts` → **175 passed** (신규 케이스 포함).
- `pnpm exec vitest run spec-link-integrity.test.ts` (build-차단 라이브 트리 가드) → **19 passed**.
- `mdast-util-from-markdown` 로 `]`/`(` 사이 개행 허용 여부를 직접 프로브 — `extractLinks` JSDoc 의
  "멀티라인 링크에서도 `](` 는 붙어 있다" 주장을 CommonMark 기준으로 재검증(4 케이스, 전부 일치).
- `MdLink`/`.raw` 필드의 외부 소비처를 `grep -rn "MdLink\b"` 로 전수 확인(자기 파일 외 0건).
- `git show origin/main:plan/in-progress/harness-review-gate-followups.md` 로 이번 PR 이전 상태를
  대조해 아래 발견사항의 "이 diff 가 도입한 것인가, 기존 결함인가"를 구분했다.

## 발견사항

- **[WARNING]** plan 요약의 "남는 이유는 이제 **둘**" 이라는 재계산이, 바로 그 목록 안에 **struck-through
  되지 않은 채 남아 있는 "병렬 fan-out" 항목**과 모순된다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:25`(신규 "둘" 서술) 및 `:35`
    (unstruck 상태로 남은 "병렬 fan-out" 불릿, 이번 diff 의 문맥 줄).
  - 상세: 이번 diff 가 고치는 문단은 정확히 라운드 1 SUMMARY 의 Warning #6("상단 요약 '셋'
    이 갱신 안 됨")에 대한 조치다. 그런데 그 목록에는 §11 잔여 / origin 기본 브랜치 해석 /
    ~~멀티라인 링크(방금 해소)~~ / **병렬 fan-out**(unstruck) 네 항목이 있고, 마지막
    "병렬 fan-out" 불릿은 취소선도 "해소" 표기도 없어 여전히 살아있는 사유처럼 읽힌다. 하지만
    그 항목의 실제 체크박스(`## 병렬 fan-out 중 리뷰어가...` 절, "리뷰 프롬프트가 뮤테이션을
    저장소 밖 scratch 사본으로 강제해야 한다.")는 **이미 `[x]` 완료** 상태이고, `git show
    origin/main:...` 로 대조한 결과 **이 PR 이 시작되기 전부터** 이미 `[x]` 였다. 즉 origin/main
    시점에도 "이제 셋" 이라는 계산이 이미 §11+origin+병렬fan-out(사실상 이미 닫힘) 을 세는
    쪽으로 어긋나 있었고, 이번 diff 는 멀티라인 항목의 해소만 반영해 "셋→둘" 로 고치면서 정작
    같은 목록에 나란히 있는 "병렬 fan-out" 불릿의 취소선 누락은 건드리지 않았다. 결과적으로
    독자가 이 문단만 읽으면 불릿을 세어 **셋**(§11·origin·병렬fan-out)이라고 판단하게 되는데
    본문은 **둘**이라 단언한다 — 같은 문서, 같은 문단 안에서 숫자와 목록이 어긋난다.
    이 저장소가 이미 두 차례(§SUMMARY 라운드 1 Warning #6, 그 이전 `feedback_stale_plan_
    claims_and_checklist_sync`)로 기록한 바로 그 실패 형태("plan 서술은 철회로 거짓이 될 수
    있다")가 세 번째로 재발한 것이다. 근본 원인(병렬 fan-out 불릿 취소선 누락)은 이 PR 이전부터
    있었지만, 이 PR 이 바로 그 문단을 다시 쓰면서도 교정하지 못했다.
  - 제안: "병렬 fan-out" 불릿도 취소선 처리하고 "→ 해소(날짜)" 를 붙이거나, 만약 그 항목을
    의도적으로 별도 트랙(예: 후속 3건이 여전히 열려 있어 완전 종결은 아님)으로 본다면 그 근거를
    명시해 "둘" 계산에서 왜 빠졌는지/포함됐는지 분명히 한다. 어느 쪽이든 숫자와 불릿 개수가
    일치해야 한다.

- **[INFO]** `extractLinks`/`buildMaskedDoc`/`lineForOffset` 핵심 로직은 실측 검증 결과 정확하다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:124-223`.
  - 상세: (1) 신규 멀티라인 테스트 스위트(9건) + 통합 DEAD 회귀(1건) 전부 GREEN. (2) 라운드 2가
    지적했던 "문단 경계(빈 줄)를 링크로 오판" 결함은 `isBlank` 분기(라인 139-142)로 실제 수정돼
    있고, 회귀 테스트("빈 줄을 넘는 텍스트는 링크가 아니다")가 통과한다. (3) JSDoc 의 핵심 전제
    "멀티라인에서도 `](` 는 항상 붙어 있다"(따라서 `cannotContainLink` 사전 필터가 여전히
    유효하다는 주장)를 `mdast-util-from-markdown` 으로 독립 재검증했고, `]`/`(` 사이에 개행이나
    공백이 끼면 CommonMark 도 링크로 파싱하지 않음을 확인했다 — 사전 필터 재사용 근거가 맞다.
    (4) 펜스 경계+내부, 빈 줄이 전부 동일하게 `]` 마스킹되어 앞뒤 텍스트가 붙어 없는 링크를
    만드는 실패 모드(false positive)와, 멀티라인 자체를 놓치는 실패 모드(false negative)
    양쪽 다 회귀 테스트로 잠겨 있다.

- **[INFO]** `MdLink.line`/`.raw` 계약 변경(멀티라인 시 첫 줄 보고, `raw` 에 개행 포함 가능)의
  외부 파급 범위는 실측상 0이다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:73-77`, `:260-265`
    (`LinkViolation.line`).
  - 상세: `grep -rn "MdLink\b"` 전수 결과 이 필드를 소비하는 코드가 `spec-links.ts`/
    `spec-links.test.ts` 자신 외에 없다. 라운드 1·2 documentation 리뷰어가 지적한 "인터페이스
    선언에 계약 변경이 문서화 안 됨" 은 이번 diff 에서 필드 옆 인라인 주석(위 위치)으로 이미
    보강돼 있어 조치됨.

- **[INFO]** Spec fidelity: 이 변경 영역을 규정하는 spec 문서는 `spec/conventions/
  spec-impl-evidence.md` §4.2(가드 존재·대상 스코프 표)뿐이며, 이 절은 "무엇을 검사하는가"
  (spec 본문 vs codebase 소스 vs 거버넌스 vs plan, target filter 유무)만 규정하고 "링크를 줄
  단위로 볼지 전문(全文)으로 볼지"와 같은 탐지 **알고리즘** 세부는 규정하지 않는다. 따라서
  이번 diff 는 spec 본문의 어떤 문장과도 line-level 로 불일치하지 않는다 — spec 이 침묵하는
  구현 디테일 영역(회색지대)이라 CRITICAL 대상 아님. spec 갱신도 불필요.

- **[INFO]** 라운드 1 Critical(plan 예시 문구 `` [a]`code`(b) `` 가 마스킹 후 진짜 링크
  `[a](b)` 가 되어 `plan-frontmatter.test.ts` 를 깼던 것)과 라운드 2 Warning(문단 경계 오판)이
  RESOLUTION.md 의 주장대로 **실제로** 고쳐졌음을 재현 테스트로 교차 확인했다(둘 다 GREEN,
  RESOLUTION 자기보고에 의존하지 않고 독립 재실행).
  - 위치: `plan/in-progress/harness-review-gate-followups.md:104-116`(펜스로 감싼 예시 +
    함정 기록), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:139`(`isBlank`).

- **[INFO]** 남겨진 후속 항목(AST 순회 전환 판정, ANCHOR 경로의 멀티라인 통합 테스트 부재)은
  plan 에 근거와 함께 등재되어 있고 developer SKILL §수렴 예외 조건을 충족한다 — 회피가 아니라
  판정된 defer 다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:138-162`.

## 요약

핵심 구현(`extractLinks`/`buildMaskedDoc`/`lineForOffset`)은 세 라운드에 걸쳐 지적된 결함(멀티라인
미탐지, plan 예시 문구가 진짜 링크가 됨, 문단 경계 오판)을 모두 실제로 고쳤고, 이번 라운드에서
독립적으로 재현한 테스트 실행(175/19 passed)과 CommonMark 파서 대조로 그 수정이 유효함을
확인했다. 기능 완전성·엣지 케이스·에러 시나리오·spec fidelity 관점에서 CRITICAL 급 결함은
발견되지 않았다. 다만 이번 diff 가 직접 수정한 plan 요약 문단("이제 둘")이 같은 목록 안의
"병렬 fan-out" 불릿(이미 완료 상태이나 취소선 누락)과 어긋나, 숫자와 불릿 개수가 일치하지
않는다 — 이 저장소가 반복해 겪은 "plan 서술 stale" 클래스의 재발이라 WARNING 으로 기록한다.

## 위험도
LOW
