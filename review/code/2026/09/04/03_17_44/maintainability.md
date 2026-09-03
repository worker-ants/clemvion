# 유지보수성(Maintainability) 리뷰

## 사전 확인

이 diff 는 이미 4개 라운드(01:48~01:49 / 02:12 / 02:35 / 02:57)의 maintainability 리뷰를
거쳤다. `withFiles`/`withFixture` 중복·JSDoc orphan·`stripLiterals` 테스트 부재·"원리적으로
불가능" 오판(정렬 커버리지) 등 앞서 지적된 WARNING 은 전부 소스에 반영된 것을 직접 `Read` 로
재확인했다(각 조치 지점: `source-scan.ts` `stripLiterals`/`countCalls` JSDoc 배치,
`nullable-type-lie-cast.spec.ts` `withFiles`+`withFixture` 얇은 래퍼, `source-scan.spec.ts`
전용 테스트 7건, `collectTsFiles` 정렬 분기 테스트). `collectTsFiles` 위임 1줄 래퍼 4종
(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)의
이름 불일치는 2R·3R·4R 에서 반복 검토 후 "5개 가드 공개 표면을 동시에 바꾸는 별건" 이라는
근거로 명시 유예된 결정이라 이번에도 재론하지 않는다(변경 없음, `git diff` 로 확인).

또한 직전 세 라운드(3R·4R·현재 HEAD 직전 커밋)는 하드코딩 `"20건"` 제거·날짜 명시 등
**주석/plan 텍스트만** 고치는 작업이었다. 그 편집 자체가 새 결함을 낼 수 있는 지점이라
현재 HEAD 상태의 텍스트를 문장 단위로 다시 읽었고, 아래에서 그 결과를 보고한다.

## 발견사항

- **[WARNING]** 단어 중복으로 문장이 깨졌다 — `그 근거와 근거는 그쪽 docstring 에 있다`
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:221-222`
    (`findStaleSpecCasts` JSDoc, `## 오탐 없음은 {@link widenedEntityFields} 가 이름 충돌을
    뺀 덕이다` 절)
  - 상세: `git log -p`로 대조하면 원문은 `"그 근거와 실측 20건은 그쪽 docstring 에 있다"`였다.
    59a229943(리뷰 4R, "20건" grep 일괄 제거)에서 `실측 20건`을 `근거`로 치환했는데, 앞
    줄 끝에 이미 있던 `"그 근거와"`를 함께 고치지 않아 `"그 근거와 근거는 그쪽 docstring 에
    있다"`(직역: "그 근거와 근거는 …")로 단어가 겹치는 비문이 됐다. 기능에는 영향 없지만
    (판정 로직 불변), 이 파일 자체가 "왜 필요한가/왜 오탐이 없나/한계" 를 문장 단위로
    공들여 적어 온 파일이라 이 비문이 유독 눈에 띈다. 다음 사람이 이 절을 읽다가 문장이
    안 이어져 멈추게 된다.
  - 제안: `"그 근거는 그쪽 docstring 에 있다."`로 한 단어(`와` 포함 앞 조각)를 정리한다.

- **[WARNING]** 같은 편집 패턴이 plan 문서에도 반복됐다 — `판정 대상 / 판정 대상이 그만큼
  줄어든다` 중복
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:277-278`
  - 상세: `git log -p` 대조 결과 원문은 `"…오탐하기 때문이다(최소 픽스처로 재현). 판정 대상
    135 → **115**. 재현율을…"`이었다. 이후 라운드에서 "개수엔 날짜를 박는다"(§"숫자를 어디에
    쓸 수 있나") 규칙에 맞춰 `135 → **115**` 를 `**2026-09-04 실측 135 → 115**` 로 감싸고
    앞에 `"이가 그만큼 줄어든다"` 류의 서술을 붙이면서, 줄바꿈 직전에 이미 있던
    `"판정 대상"` 을 지우지 않아 `"… 판정 대상\n판정 대상이 그만큼 줄어든다(…135 → 115)…"`로
    같은 명사구가 두 번 연달아 나온다. 특히 이 plan 문서는 바로 아래
    `## 한 자리만 고치는 버릇 — 이 plan 에서 네 번 반복했다` 절에서 "알아챈 자리만 고치고
    인접 서술을 훑지 않는" 바로 이 실패 클래스를 4회 자인하고 절차(`grep` 전수 확인)까지
    적어 둔 문서다 — 그 문서 자신이 같은 클래스의 다섯 번째 사례를 새로 만든 채로 남아 있다.
  - 제안: `"… 정당한 캐스트를 오탐하기 때문이다(최소 픽스처로 재현). 판정 대상이 그만큼
    줄어든다(**2026-09-04 실측 135 → 115**). 재현율을 잃는 대신 …"` 형태로 중복 어절을 하나
    지운다.

- **[INFO]** (기유예, 변경 없음) `collectTsFiles` 위임 1줄 래퍼 4개가 서로 다른 이름
  (`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로
  남아 있다
  - 위치: `audit-action-binding-guard.ts`(`collectSourceFiles`),
    `masked-reject-callers-guard.ts`(`listSourceFiles`),
    `nullable-type-lie-cast-guard.ts`(`collectScanTargets`),
    `redis-fail-open-catalog-guard.ts`(`listProductionSources`)
  - 상세: 2R(`02_12_38/RESOLUTION.md` INFO#3)·3R(`02_35_22/RESOLUTION.md` INFO#7)·4R
    (`02_57_22/maintainability.md`)에서 이미 세 차례 검토됐고 "지금 통일하면 5개 가드의
    공개 표면을 동시에 바꾸는 별건" 이라는 근거로 유예가 확정된 항목이다. 이번 라운드
    diff 에서 해당 파일들은 변경이 없어(`git diff` 확인) 재론하지 않는다.
  - 제안: 조치 불필요. 5개 가드 파일 중 하나를 다시 만질 기회에 이름 통일을 함께 고려.

## 요약

핵심 리팩터(`repo-guards/__tests__/` walker 5사본 → `collectTsFiles` 통합, `widenedEntityFields`/
`findStaleSpecCasts` 신설)는 이미 네 라운드를 거치며 동작(정렬 커버리지 오판) → 구조(픽스처
헬퍼 중복·이름 매칭 오탐) → 문서(JSDoc 배치·검증 안 되는 숫자)의 순서로 검증됐고, 그 조치가
현재 HEAD 소스에 반영돼 있음을 직접 확인했다. 함수 길이·중첩 깊이·순환 복잡도는 전 파일에
걸쳐 낮게 유지되고(신규 함수 대부분 20줄 안팎, 중첩 2~3단 이내), 각 정규식·필터 축마다 "왜
필요한가/한계" 를 다루는 JSDoc 관례도 일관적으로 지켜진다. 다만 직전 두 라운드(3R·4R)가
반복한 "하드코딩 숫자 제거 + 날짜 명시" 편집 자체가 **문장 접합부를 안 살펴 단어를 중복시키는
새 결함**을 두 자리(코드 JSDoc 1곳·plan 문서 1곳) 남겼다 — 둘 다 기능에는 영향 없는 순수
가독성 결함이지만, 정확히 이 plan 문서가 "한 자리만 고치는 버릇" 으로 네 번 자인하고 절차까지
세운 바로 그 실패 클래스의 재발이라 방치하면 다음 사람이 문장을 읽다 멈춘다. 그 외 신규
CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
