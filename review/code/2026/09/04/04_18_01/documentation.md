# 문서화(Documentation) 리뷰

## 검증 방법

이 changeset(`repo-guards/__tests__/` walker 5사본 → `collectTsFiles` 통합 + 넓혀진 nullable
필드를 겨눈 낡은 `.spec.ts` 캐스트 가드 신설)은 이미 7라운드(`01_49_18`~`03_58_32`)의
리뷰·조치를 거쳤다. 그래서 이번 라운드는 diff 를 처음부터 읽는 대신, (a) 직전 라운드(7R,
`03_58_32`)가 지적한 WARNING 이 실제로 올바르게 반영됐는지, (b) 그 수정이 새 결함을 심지
않았는지, (c) 7라운드 동안 반복된 "한 자리만 고치는 버릇" 클래스가 이번에도 재발하지
않았는지를 저장소에서 직접 `Read`/`grep` 으로 확인하는 데 집중했다. 저장소 트리에는 아무것도
쓰지 않았다(`git status --short` 로 확인, 세션 시작 상태와 동일 — untracked
`review/code/2026/09/04/04_18_01/` 만 존재).

## 발견사항

이번 라운드에서 새로 발견한 Critical/Warning 은 없다.

- **[INFO]** `CollectTsFilesOptions.includeSpec` 관련 서술이 여전히 "실사례 하나"/"유일한 축"
  이라고 말하는데 실사용처는 이제 둘이다 — **6R 부터 이미 알려져 명시적으로 유예된 항목의
  재확인**(새 발견 아님)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:213-216`
    (`CollectTsFilesOptions.includeSpec` JSDoc, `"true` 가 필요한 실사례가 하나 있다:
    `masked-reject-callers-guard`…"`) · `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:252`
    (테스트 제목 "`includeSpec` 은 `.spec.ts` 를 되살린다 — masked-reject 가드가 쓰는
    유일한 축")
  - 상세: `git log -S"SRC_ROOT, { includeSpec"` 으로 확인한 결과, `nullable-type-lie-cast.spec.ts:399`
    (`collectTsFiles(SRC_ROOT, { includeSpec: true })`, "저장소 전수" 서브트리)가
    `masked-reject-callers-guard.ts:51` 다음으로 두 번째 실사용처가 됐다(커밋
    `46f464583` "feat(guard): 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트를 가드가 잡는다").
    두 서술 모두 이 두 번째 소비처가 생기기 **전**에 쓰인 문장이라 지금은 사실과 어긋난다.
    다만 이는 새로 발견한 것이 아니라 7R(`03_58_32/maintainability.md`)이 이미 정확히 같은
    위치를 지적했고, 6R RESOLUTION(`review/code/2026/09/04/03_37_37/RESOLUTION.md` INFO#1)이
    "이 파일이 세운 규칙(검증되지 않는 숫자는 적지 않는다)과 충돌하니 지금 개수 표현을 다시
    늘리지 않고 **다음에 이 파일을 만질 때 개수 표현 자체를 뺀다**"고 명시적으로 유예를
    결정한 항목이다. 이번 라운드의 유일한 변경(`masked-reject-callers.spec.ts` 의 JSDoc 재배치,
    7R 조치)은 `source-scan.ts`/`source-scan.spec.ts` 를 건드리지 않았으므로 그 유예 트리거가
    아직 발동하지 않았다 — 상태는 그대로다.
  - 제안: 조치 불필요(기존 결정 유지). `source-scan.ts`/`source-scan.spec.ts` 를 다음에 만질
    기회가 있으면 "하나"/"유일" 대신 "실사례가 있다" 정도로 표현을 낮추는 것을 고려.

## 검증된 항목 (7R 조치가 정확히 반영됨)

- **7R W1 (JSDoc orphan) 수정 확인** — `masked-reject-callers.spec.ts` 를 직접 열어 확인.
  `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)` 용 JSDoc(1~24행)과 `describe('resolveTriggerParameters
  직접 호출부 허용목록', …)` 용 JSDoc(45~61행)이 각자 자신이 설명하는 `describe` 바로 위에
  정확히 붙어 있다. `git show cfc69dd63 -- codebase/` 로 diff 자체도 대조했다 — 6R 이 만든
  orphan(새 블록을 기존 JSDoc 과 그 `describe` 사이에 끼워 넣은 것)을 "새 블록 전체를 앞으로,
  원본 JSDoc 을 자기 `describe` 위로" 되돌리는 정확한 형태로 고쳤다.
- **orphan 패턴 기계적 재스캔** — 이번 세션이 건드린 9개 소스 파일 전체에서 `*/` 다음 줄이
  곧바로 다른 `/**` 로 시작하는 자리를 훑었다(0건). 1R(`stripLiterals`/`countCalls`)·
  7R(`masked-reject-callers.spec.ts`)에서 재발했던 실패 모드가 세 번째로 재발한 자리는
  없음을 확인.
- **"한 자리만 고치는 버릇" 표(plan) 정합성** — `plan/in-progress/entity-nullable-column-type-mismatch.md`
  의 "## 한 자리만 고치는 버릇 — 이 plan 에서 여섯 번 반복했다" 헤딩과 바로 아래 표의 실제
  행 수(1~6, 6행)가 일치한다. 6R 이 스스로 자신의 절에서 냈던 헤딩/표 불일치(W2·W3)가
  고쳐진 채로 유지되고 있다.
- **`"20건"`/`"135 → 115"` 등 하드코딩 개수 상호 참조** — `nullable-type-lie-cast-guard.ts:283`
  의 "DTO 축 48건 중 44건" 인용이 plan 문서(`:430`, `:200`)의 실제 서술과 일치한다. 코드
  docstring 쪽(`widenedEntityFields`, `collectScanTargets`)은 4R 이후 개수를 빼고 "검증
  방법"만 남긴 상태 그대로이고, plan 쪽은 "2026-09-04 실측 135 → 115" 처럼 날짜를 박은 채
  유지되고 있다 — 코드/plan 의 숫자 기재 기준을 나눈 4R 결정(코드=개수 없음, plan=날짜+개수)
  이 흔들리지 않았다.
- **`WIDENED_DECL` 데코레이터 1개 한계** — `nullable-type-lie-cast-guard.ts:160-166` docstring
  이 한계("추가 데코레이터는 1개까지만 본다")와 근거("저장소 전수에 그런 조합은 없다
  (2026-09-04 실측)")를 여전히 명시하고 있다.
- **README/CHANGELOG/API 문서** — 이번 diff 범위(backend 내부 test-tooling·repo-guard 인프라
  + plan 문서)에 신규 공개 API·엔드포인트·환경변수·사용자 대면 기능이 없어 갱신 대상이
  아니다. 이 판단은 1R~7R 문서화 리뷰 전원이 이미 내린 것과 일치한다.

## 요약

이 changeset 은 이미 7라운드의 문서화 리뷰·조치를 거쳐 수렴 단계에 있다. 8라운드째인 이번
리뷰는 직전 라운드(7R)가 잡은 WARNING(JSDoc orphan 재발)의 수정이 실제로 정확히 반영됐음을
diff·현재 파일 양쪽에서 직접 확인했고, 같은 실패 모드(선언 앞 JSDoc 결속이 삽입으로 끊기는
것)가 이번 세션이 건드린 9개 파일 전체에서 세 번째로 재발한 자리는 없다는 것을 기계적으로
재확인했다. plan 문서의 자기 서술("여섯 번 반복" 표)도 헤딩·행 수가 일치한다. 유일하게 남은
항목은 `includeSpec` 옵션의 "실사례 하나"/"유일한 축" 표현이 실사용처 2개(`masked-reject-callers-guard`·
`nullable-type-lie-cast.spec.ts`)보다 좁게 읽힌다는 것인데, 이는 새 발견이 아니라 6R·7R 이
이미 찾아 "이 파일을 다음에 만질 때 개수 표현을 뺀다"는 조건으로 명시적으로 유예해 둔
항목이고 그 트리거가 이번 라운드에도 발동하지 않았다. Critical/Warning 급 문서화 결함은
없다.

## 위험도

LOW
