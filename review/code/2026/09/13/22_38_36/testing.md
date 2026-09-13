# 테스트(Testing) 리뷰 — error-code-emission-axis (round 9 관측)

## 리뷰 범위와 방법

이 브랜치는 이미 8개 fix 라운드(`a397ccc55`~`061f5153f`)를 거쳤고, 그때마다 testing
관점 지적(진리표 대조군 · 판별 fixture · 헬퍼-테스트≠호출부-테스트 등)이 반복적으로
나와 즉시 반영됐다. 이번 라운드(직전 커밋 `061f5153f`, `HEAD~1..HEAD`)의 **실질 코드
diff** 는 다음 두 파일뿐이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 기능
  변경 2건: (1) `parseWhereRefs` 가 `{ refs, residue }` 로 확장돼 파싱 후 잔여 문자열을
  함께 낸다, (2) `resolveSourceLines` 의 탐색 루트를 `backend/src` 단독에서
  `SOURCE_ROOTS = [backend/src, packages]` 로 기준집합과 통일. 신규 테스트 3건 추가
  (잔여 판별 대조군 2건 + 루트 통일 대조군 1건).
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — **주석만** 변경
  (예고 문장 정정), 실행 코드 변경 없음.

나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 산문·
plan·리뷰 산출물이라 테스트 대상이 아니다.

## 직접 검증

저장소 파일을 수정하지 않고 다음을 직접 실행해 리포트의 주장을 실측으로 확인했다:

```
npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts
→ Test Files 1 passed (1) / Tests 82 passed (82)

python3 scripts/check-frontend-typecheck-ratchet.py
→ OK: frontend 타입 진단 52건 / 15파일 — baseline 과 일치.
```

`parseWhereRefs` 의 반환 타입이 배열에서 `{ refs, residue }` 객체로 바뀌었는데, 이
함수는 `export` 되지 않고 (`grep -rn "parseWhereRefs" src/` 결과 이 테스트 파일
자신뿐) 이 타입 변경이 다른 파일에 영향을 줄 표면이 없다는 것도 확인했다. 이 저장소가
기록해 둔 함정("vitest 는 타입을 strip 하므로 `__tests__` 안 타입 오류를 `tsc -p
tsconfig.json` 이 못 본다")을 알고 있었기 때문에 `tsconfig.json` 이 아니라 ratchet
전용 `tsconfig.typecheck.json` 경로로 재확인했고, baseline 과 정확히 일치했다.

## 신규 테스트 2건에 대한 판별력 재검토

**`[대조군] 구분자를 · 가 아닌 것으로 적으면 잔여로 드러난다`** — `"a.ts:10, 20 —
설명"` 입력을 손으로 추적했다: `head = "a.ts:10, 20 "`, 정규식이 `a.ts:10` 만 매치하고
`, 20` 은 남는다. `rest.replace(/[\s·]/g, "")` 후 잔여는 `",20"` (공백만 지워지고
쉼표·숫자는 남는다) — `residue !== ""` 가 실제로 성립한다. 옛 파서(잔여 없이 `refs`
만 반환)로 되돌리는 뮤테이션을 걸면 이 테스트가 유일하게 갈리는 자리이고, 다른 세
`parseWhereRefs` 계약 테스트(단일/가운뎃점/공백-가운뎃점 구분자)는 전부 `residue: ""`
만 보여 이 뮤턴트를 못 잡는다 — 판별 fixture 로서 유효하다.

**`[루트 통일] packages 에만 있는 파일도 특정된다`** — `SOURCE_ROOTS` 를 `backend/src`
로 되돌리는 뮤테이션을 손으로 추적했다: 이 테스트가 매 실행 도출하는
`onlyInPackages[0]` (packages 안에서 유일하고 backend 에는 없는 basename)은 정의상
`backend/src` 단독 탐색으로는 0건이 되어 `resolveSourceLines` 가 `null` 을 반환한다
→ `expect(...).not.toBeNull()` 이 RED. 실제 등록 3항목(`GUIDE_NON_EMITTED_VOCABULARY`)
은 전부 `backend/src` 를 가리켜 이 회귀를 **발화시키지 못하므로**, 합성이 아니라
"매 실행 저장소를 스캔해 도출"하는 방식으로 실코퍼스 부재를 메운 설계다 — 이 파일이
이미 여러 번 쓴 패턴(합성 입력만이 두 판정을 가른다)의 정당한 재사용이다. vacuity
가드(`onlyInPackages.length > 0`)도 있어 도출 실패가 조용히 통과하지 않는다.

두 신규 테스트 모두 "무엇이 갈리는가"가 코드로 고정돼 있고, 뮤테이션 추론상 실제로
해당 결함 클래스를 잡는다.

## 발견사항

- **[INFO]** `parseWhereRefs` 의 `rest.replace(m[0], "")` 는 위치가 아니라 **문자열
  내용**으로 첫 occurrence 를 지운다 — 동일한 `파일:줄` 표기가 head 안에 두 번 이상
  글자 그대로 반복되는 입력에서는 아직 검증되지 않은 코너케이스가 남는다(순서대로
  처리되므로 실제로는 정상 동작할 것으로 보이나, 그 경우를 겨눈 fixture 는 없다).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `parseWhereRefs` 함수 본문
  - 상세: 현재 등록된 3항목의 `where` 표기(파일당 최대 2줄, 가운뎃점 연결)에는 이 형태가
    없어 실코퍼스로는 관측되지 않는다. 실질 리스크는 낮다 — 다음 사람이 같은 파일을
    두 번 다른 줄로도 아니고 완전히 같은 문자열로 중복 인용하는 오타를 낼 때만 노출된다.
  - 제안: 조치 불필요(낮은 우선순위). 굳이 닫으려면 `matchAll` 인덱스 기반으로 부분
    문자열을 잘라내는 방식으로 바꿀 수 있으나, 이 배치의 스코프를 넘는 강화다.

- **[INFO]** 라운드 8 의 실질 코드 변경(잔여 검출 + 루트 통일)은 이미 뮤테이션 추론
  기준으로 판별력이 확인되는 대조군을 동반하고 있고, 실제 실행(82/82 GREEN)과
  타입체크 ratchet(baseline 일치)로 재확인했다 — 이번 라운드에서 새로 지적할
  커버리지 갭을 찾지 못했다.
  - 위치: (해당 없음 — 긍정 확인)
  - 상세: (위 "직접 검증" · "판별력 재검토" 절 참조)
  - 제안: 없음.

- **[INFO]** `guide-identifier-scan.ts` 는 이번 라운드에서 주석만 바뀌었고 실행
  코드는 변경되지 않았다 — 회귀 테스트 관점에서 별도 검증이 필요 없다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
  - 상세: `git diff HEAD~1 HEAD -- codebase/` 로 직접 확인.
  - 제안: 없음.

## 요약

이번 라운드의 실질 코드 diff 는 `parseWhereRefs` 잔여 검출과 `resolveSourceLines` 탐색
루트 통일 두 가지뿐이며, 둘 다 "두 판정이 갈리는 값"을 고정한 판별 fixture(잔여 comma
케이스·packages-전용 basename 동적 도출)를 동반해 뮤테이션 추론으로 재확인해도 유효하다.
직접 테스트를 실행해 82/82 GREEN, 타입체크 ratchet 을 실행해 baseline(52건/15파일)과
일치함을 확인했으며, 변경된 함수(`parseWhereRefs`)가 비-export 로 다른 파일에서 참조되지
않아 시그니처 변경의 파급 표면도 없음을 grep 으로 확인했다. 이 브랜치는 이미 8라운드에
걸쳐 진리표 대조군·헬퍼-테스트-아님-호출부-테스트·vacuity floor 규율을 촘촘히 적용해 왔고,
이번 라운드의 추가분도 같은 규율을 정확히 따른다 — 새로 지적할 Critical/Warning 급
테스트 갭을 찾지 못했다. 유일하게 남긴 것은 실코퍼스에 없는 이론적 코너케이스(동일
`파일:줄` 표기의 문자 그대로 중복) 하나로, 낮은 우선순위 INFO 다.

## 위험도

NONE
