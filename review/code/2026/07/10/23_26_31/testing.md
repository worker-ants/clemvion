# 테스트(Testing) 리뷰 — 재검토 (23_04_23 fix 이후)

대상: `codebase/channel-web-chat/src/lib/{conversation,presentation}.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/components/presentations.test.tsx`

전 라운드(`review/code/2026/07/10/23_04_23/testing.md`)에서 INFO 3건(충돌 우선순위 미고정·carousel
itemsTruncated 무소비·non-object truncation 미검증)을 지적했고, `RESOLUTION.md` 는 그중 2건(우선순위
lock-in, non-object no-op)을 이번 diff에 반영하고 나머지 1건(carousel 무소비)은 plan §6 후속으로 명시
defer했다. 본 라운드는 그 반영 상태를 재검증하고 신규 추가된 화이트리스트 테스트를 점검한다.

검증: `npx vitest run src/lib/conversation.test.ts src/lib/presentation.test.ts
src/widget/components/presentations.test.tsx` 재실행 — **3 files / 87 tests 전부 green**(전 라운드 84건
대비 +3: 충돌 우선순위 lock-in 1건, null/문자열 no-op 1건, 미등록 키 비흡수 1건).

## 발견사항

- **[INFO]** 전 라운드 지적 사항 반영 확인 — 충돌 우선순위·non-object 방어 테스트 추가됨
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — "toTable — payload 와 truncation 이 같은
    키를 가지면 top-level truncation 우선"(충돌 lock-in), "toTable — truncation 이 null/문자열이면
    무시(no-op)"
  - 상세: 전 라운드 INFO였던 "값 충돌 시 어느 쪽이 이기는지 테스트 없음"과 "non-object truncation 방어
    미검증"이 정확히 이 두 테스트로 닫혔다. `{ payload: { rowsTruncated: true }, truncation: {
    rowsTruncated: false } }` → `truncated === false`로 top-level 우선을 명시적으로 고정했고, `truncation:
    null`/`"garbage"` 양쪽 모두 no-op(`truncated === false`, `rows` 보존)을 검증한다. 실행 확인 결과
    green — 조치 완료로 판단.
  - 제안: 없음(확인용).

- **[INFO]** 신규 화이트리스트 가드 테스트("미등록 키는 output 으로 흡수하지 않음")가 실제 회귀를 정확히
  포착하는 구조
  - 위치: `presentation.test.ts` 신규 테스트 — `truncation: { rowsTruncated: true, rows: [] }`
  - 상세: `TRUNCATION_KEYS`(`presentation.ts:110-115`)에 없는 `rows` 키를 `truncation` 에 넣어도
    `payload.rows`가 살아남는지(`tb.rows` 가 `truncation.rows: []` 로 덮이지 않는지) 검증한다. 이는
    `side_effect #1`(통째 spread → 장래 payload 렌더 필드 침식 위험)을 코드(화이트리스트)뿐 아니라
    테스트로도 lock-in한 것으로, 만약 누군가 `truncationMeta`를 다시 `{ ...asRecord(v) }` 통째 spread로
    되돌리면 이 테스트가 즉시 red 로 전환된다 — mutation-testing 관점에서 실효성 있는 가드.
  - 제안: 없음(확인용, 긍정 사례).

- **[INFO]** carousel `itemsTruncated`/`toTable`의 `rowsTotalCount`·`itemsTotalCount` 3개 화이트리스트
  키는 여전히 소비처 없이 "흡수만 되고 아무도 안 읽음" 상태 — 전 라운드 지적·RESOLUTION defer 그대로 유지
  - 위치: `presentation.ts:225` (`toTable` 은 `output.rowsTruncated` 단 하나만 읽어 `truncated` 산출),
    `toCarousel`(`presentation.ts:187-202`, `CarouselData` 에 `truncated`/`totalCount` 필드 자체가 없음)
  - 상세: `TRUNCATION_KEYS` 4개 중 실제로 `TableData`/`CarouselData` 변환기가 읽어 렌더 필드에 반영하는
    것은 `rowsTruncated` 하나뿐이다. `rowsTotalCount`(`toTable — top-level truncation.rowsTruncated 를
    truncated 로 흡수` 테스트에서 함께 넘기지만 `tb.truncated` 만 단언, `rowsTotalCount` 자체가 어딘가에
    실렸는지는 검증 대상이 아님)와 `itemsTruncated`/`itemsTotalCount`(carousel 테스트도 "items 파싱이 안
    깨진다"만 확인)는 merge 되긴 하지만 그 merge 결과를 소비하는 코드도, 소비를 검증하는 테스트도 없다.
    `RESOLUTION.md` 가 requirement #3(totalCount 미노출)·testing #12(carousel 무소비)를 "이번 PR 스코프
    밖, plan §6 후속"으로 명시 defer했으므로 이번 라운드의 blocking 사유는 아니다. 다만 재확인 목적으로
    남긴다 — 후속 작업 시 `output.rowsTotalCount`/`itemsTruncated`/`itemsTotalCount` 가 실제로 렌더
    필드로 이어지는 회귀 테스트가 각각 필요하다.
  - 제안: 조치 불요(이미 plan §6 등재). 후속 PR 착수 시 이 노트를 참조.

- **[INFO]** `truncation: null` no-op 테스트에서 동일 입력으로 `toTable` 을 3회 호출(중복 계산)
  - 위치: `presentation.test.ts` — `toTable — truncation 이 null/문자열이면 무시(no-op)`
  - 상세: `toTable({ ...base, truncation: null })` 을 `.truncated` 단언용과 `.rows` 단언용으로 두 번
    별도 호출한다(순수 함수라 결과는 동일하지만 변수로 한 번만 계산해도 됨). 가독성·정확성에 영향 없는
    스타일 수준의 사소한 중복.
  - 제안: 조치 불요. 리팩터 시 `const r = toTable({ ...base, truncation: null }); expect(r.truncated)...;
    expect(r.rows)...;` 로 통합 가능.

## 각 관점별 재확인

1. **테스트 존재 여부**: 이번 라운드 diff(fix 커밋 `da3d2672c`)가 추가한 순수 로직 변경(`TRUNCATION_KEYS`
   화이트리스트)에 대해 화이트리스트 자체를 검증하는 테스트(미등록 키 비흡수)가 신설되어 프로덕션 변경과
   테스트가 1:1로 대응한다.
2. **커버리지 갭**: 신규 갭 없음. 잔존 갭(carousel/totalCount 무소비)은 기존에 식별·defer된 항목 그대로.
3. **엣지 케이스**: null/비객체 truncation, 충돌 값, 미등록 키 — 전 라운드에서 지적된 경계값이 모두
   메워졌다.
4. **Mock 적절성**: 변경 없음(순수 함수 + RTL 실제 렌더, mock 미사용 — 적절).
5. **테스트 격리**: 신규 3건도 로컬 스코프 상수만 사용, 순서 의존 없음.
6. **테스트 가독성**: `it` 설명("병합 우선순위 lock-in — spread 순서를 뒤집는 리팩터가 조용히 통과하지
   못하게 한다")이 테스트의 의도(회귀 방지 목적)를 명확히 서술 — 모범적.
7. **회귀 테스트**: 전체 87건 재실행 green, 기존 테스트 바디 무변경 확인.
8. **테스트 용이성**: 변경 없음(기존 구조 유지, `unknown` 입력을 받는 순수 함수라 여전히 DI 불필요).

## 요약

전 라운드에서 지적한 INFO 3건 중 2건(충돌 우선순위 미고정, non-object truncation 미검증)이 이번
fix 커밋에서 정확히 대응하는 테스트로 닫혔고 전체 87건이 green이다. 신규 추가된 "미등록 키 비흡수"
테스트는 `side_effect #1` 조치(4-키 화이트리스트)를 코드뿐 아니라 회귀 테스트로도 고정해 향후 spread
방식 되돌림을 즉시 잡아낼 수 있는 실효성 있는 가드다. 유일하게 남은 갭(carousel `itemsTruncated`·
`rowsTotalCount`/`itemsTotalCount` 가 merge 만 되고 소비처·검증 모두 없음)은 이미 `RESOLUTION.md`와
plan §6에 스코프 밖 후속으로 명시 등재돼 있어 이번 PR을 막을 사유가 아니다. 발견 사항은 모두 INFO이며
확인·기록 목적이다.

## 위험도
LOW
