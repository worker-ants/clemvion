# 테스트(Testing) 리뷰 — carousel 잘림 배너 (3R, 22_18_19 후속)

대상: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`, `src/lib/presentation.ts`(+`.test.ts`),
`src/widget/components/presentations.tsx`(+`.test.tsx`), `src/widget/styles.ts`, `CHANGELOG.md`,
`plan/in-progress/webchat-widget-presentation-followups.md`, `spec/7-channel-web-chat/1-widget-app.md`.
이번 diff 는 직전 라운드(`review/code/2026/07/12/22_18_19`)의 WARNING 3건(CHANGELOG·테스트 부분반영·CSS)을
반영한 결과물이며, 1R/2R 리뷰 산출물도 같은 changeset 으로 커밋되어 diff base(origin/main) 대비 함께 나타난다.

## 발견사항

- **[INFO]** (수렴 확인) 2R WARNING("AI `render_carousel` top-level `truncation` 투영 경로 — 우선순위 lock-in·
  null/문자열 no-op·컴포넌트 렌더 테스트 부재")이 이번 diff 로 실질적으로 해소됨
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:268-281`(`toCarousel — top-level truncation
    이 payload 동명 키보다 우선` / `toCarousel — truncation 이 null/문자열이면 무시`),
    `codebase/channel-web-chat/src/widget/components/presentations.test.tsx:459-475`(`AI render_carousel 의
    top-level truncation(+총 개수) → 총 개수 잘림 배너 노출` / `AI render_carousel 의 truncation 만 있고 총 개수
    부재 → 폴백 잘림 배너`)
  - 상세: 직접 실행 확인(`npx vitest run` — 아래 검증 참고) 결과 신규 테스트 포함 전체 354개 통과. `toTable` 이
    가진 우선순위 lock-in·non-object no-op·AI 경로 실제 렌더 검증 3축이 carousel 에도 각 1건씩 대응해 생겼다 —
    2R 이 지적한 "RESOLUTION 상 전부 반영 표기가 실제로는 부분 반영" 상태는 이제 문자 그대로 해소.

- **[INFO]** 잔여 비대칭 3건 — `toTable` 전용 테스트 중 carousel 버전이 아직 없는 것들 (낮은 위험, 조치 불요 판정)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — `toTable` 에는 있고 `toCarousel` 에는 없는
    케이스: (a) `:313` `truncation 의 미등록 키는 output 으로 흡수하지 않음`, (b) `:284`
    `payload.rowsTruncated=true 는 truncation 부재 시에도 유지`, (c) `:372` `truncated=false 여도 유효
    rowsTotalCount 는 totalCount 로 투영`(즉 `truncated`/`totalCount` 가 서로 독립적으로 판정됨을 보이는 케이스).
    컴포넌트 레벨에서도 `totalCount: 0` 렌더 확인(2R INFO 가 이미 지적)이 carousel 에 여전히 없음
    (`presentations.test.tsx` — `itemsTotalCount: 0` 조합의 컴포넌트 테스트 부재, unit 레벨(`presentation.test.ts:59-64`)만 커버).
  - 상세: `asEnvelope`/`truncationMeta`(병합·우선순위·no-op)와 `asTotalCount`(신뢰성 판정)는 `toTable`/`toCarousel`
    이 **완전히 공유**하는 코드 경로다. 즉 위 3건 + 0 경계 컴포넌트 케이스가 깨지는 리팩터가 있다면 `toTable` 쪽
    동일 로직 테스트가 이미 그 회귀를 잡아낸다 — carousel 전용 버그(예: `output.items` vs `output.rows` 필드명
    분기 실수)가 있을 때만 이 3건의 부재가 실질적 커버리지 갭이 된다. 1R→2R→3R 세 라운드에 걸쳐 "최소 1~2건 추가"
    기준으로 반복 수렴해 온 이력을 볼 때, 완전한 1:1 패리티 추구는 이 시점부터 수확체감 구간으로 판단된다.
  - 제안: 즉시 조치 불요. 다만 향후 carousel 전용 분기(예: 카루셀만의 추가 cap 필드)가 생기면 이 3건 중 최소
    1건(미등록 키 비흡수)은 그 시점에 함께 추가할 것.

- **[INFO]** spec §2(R8) 잔여 문구가 실제 구현/§4/테스트와 불일치 — 향후 "스펙에 맞춰 되돌리는" 실수의 함정
  - 위치: `spec/7-channel-web-chat/1-widget-app.md:233`("없으면 무개수 폴백(table "일부 행만 표시돼요."·carousel
    "일부만 표시돼요.")을 렌더한다.") vs 같은 파일 `:150`("carousel 무개수 "일부 항목만 표시돼요."") 및
    `codebase/channel-web-chat/src/lib/i18n/catalog.ts`(`"carousel.truncated": "일부 항목만 표시돼요."`, ko) 및
    `presentations.test.tsx`/`presentation.test.ts` 의 모든 관련 단언(`"일부 항목만 표시돼요."`).
  - 상세: 2R RESOLUTION 이 "ko 문구 비대칭(I5)"을 고치며 "spec §4 동반 갱신"이라 기록했는데, 실제로는 §4(입력창 근처
    표, 150행)만 "일부 항목만 표시돼요."로 갱신되고 §2/R8 본문(233행)의 인용문은 옛 문구("일부만 표시돼요.")로
    남아 있다. 코드·카탈로그·모든 테스트 단언은 전부 올바른 최신 문구("일부 항목만 표시돼요.")로 정확히 일치하므로
    **현재 테스트는 안전**하다. 다만 §2 본문의 stale 인용이 남아 있으면, 향후 누군가 spec §2 텍스트를 SoT 로 신뢰해
    catalog 값을 "일부만 표시돼요."로 되돌리는 실수를 할 경우 이 회귀는 기존 테스트(정확히 "일부 항목만 표시돼요."를
    단언)가 즉시 잡아낸다 — 즉 테스트 자체는 이미 올바른 안전망이나, spec 내부 모순은 documentation 리뷰 범위로
    별도 정정 권장.
  - 제안: `spec/7-channel-web-chat/1-widget-app.md:233` 의 인용문을 `:150`/catalog 와 일치하도록
    "일부 항목만 표시돼요."로 정정(테스트·코드 변경 불요, 이미 정합).

- **[정보/확인]** 회귀 안전성 — 실행 재확인
  - 상세: 이번 라운드에서 직접 `npx vitest run`(channel-web-chat 전체) 실행 결과 22 test files / 354 tests
    전부 통과 — RESOLUTION 기재값(354)과 정확히 일치, stale 주장 아님을 실측 확인. `presentation.test.ts`/
    `presentations.test.tsx`/`catalog.test.ts` 3파일만 별도 실행 시 96개 전부 통과.

- **[정보/확인]** Mock 적절성·테스트 격리 — 재확인, 이번 diff 로 변경 없음
  - 상세: 신규/기존 unit 테스트는 순수 함수(`toCarousel`/`toTable`/`asTotalCount`)를 mock 없이 직접 검증하고,
    컴포넌트 테스트는 `onButton` 콜백만 `vi.fn()` 스텁 후 실제 DOM 렌더(`@testing-library/react`)로 검증한다.
    각 `it` 이 독립된 payload 리터럴을 구성하고 공유 mutable 상태가 없어 순서 의존성 없이 병렬/개별 실행 가능.

- **[정보/확인]** i18n 카탈로그 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`)는 `catalog.test.ts`
  의 동적 키-순회 parity 가드(ko/en 키 집합 동일성·빈 문자열 금지·`{{placeholder}}` parity·deep-freeze)로 전용
  테스트 없이 자동 커버됨 — 1R/2R 확인 그대로 유효.

## 요약

3번째 라운드인 이번 diff 는 2R 이 지적한 WARNING(RESOLUTION "전부 반영" 표기의 실제 부분 반영 — 우선순위 lock-in·
null/문자열 no-op unit 테스트, AI `render_carousel` 실 렌더 경로 컴포넌트 테스트)을 정확히 겨냥해 해소했다. 직접
실행(`vitest run`, 354/354 통과)으로 회귀 부재와 RESOLUTION 기재값의 정확성을 재확인했고, mock 사용·테스트 격리도
양호하다. 남은 것은 `toTable`/`toCarousel` 이 공유하는 병합·검증 코드에 대한 완전한 1:1 테스트 패리티 3건(미등록 키
비흡수·payload 값 보존·truncated=false 시 totalCount 독립 투영)과 컴포넌트 레벨 0 경계 렌더 확인인데, 모두 공유
코드 경로라 `toTable` 테스트가 사실상 이미 방어하고 있어 위험도는 낮다 — 세 라운드에 걸쳐 "최소 커버리지" 기준으로
수렴해 온 만큼 이 시점에서 추가 조치보다는 향후 carousel 전용 분기 발생 시 보강을 권한다. 추가로 spec §2(R8) 본문에
문구 정정 전(2R 에서 §4 만 갱신되고 §2 는 stale 로 남음) 인용이 하나 남아 있으나, 코드·카탈로그·모든 테스트 단언은
이미 올바른 최신 문구로 일치해 실질적 테스트 리스크는 없다.

## 위험도

LOW
