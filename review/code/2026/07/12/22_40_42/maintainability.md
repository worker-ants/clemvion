# 유지보수성(Maintainability) 리뷰

이번 라운드(3R)는 이전 두 라운드(21_59_01, 22_18_19)에서 지적된 maintainability WARNING/INFO 가
실제로 반영됐는지 최종 상태 기준으로 재확인하고, 새로 누적된 diff(CHANGELOG·CSS·테스트 보강·plan 갱신·
prior 리뷰 산출물 커밋) 에서 신규 이슈가 있는지 점검했다.

## 발견사항

- **[WARNING]** spec `§R8` rationale 문단이 자기 문서 내 다른 절과 문구가 어긋남(stale) — carousel 무개수 폴백 문구가 실제 코드값과 불일치
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` L233 (R8 rationale, 이번 diff로 확장된 문단) vs 같은 파일 L150 (§4 chrome 인벤토리, 이번 diff로 함께 수정됨) 및 `codebase/channel-web-chat/src/lib/i18n/catalog.ts` L53/91 (`carousel.truncated` 실제 값)
  - 상세: 2R RESOLUTION(`review/code/2026/07/12/22_18_19/RESOLUTION.md` I5)에서 ko `carousel.truncated` 문구를 "일부만 표시돼요." → "일부 항목만 표시돼요."로 교정하고 "spec §4 동반 갱신"이라 기록했다. 실제로 §4 인벤토리(L150)는 `carousel 무개수 "일부 항목만 표시돼요."`로 정확히 갱신됐고 코드(`catalog.ts`)도 동일하다. 그런데 같은 spec 파일의 §R8 rationale 문단(L233, 이번 changeset이 새로 확장한 텍스트)은 여전히 `carousel "일부만 표시돼요."`로 예전 문구를 인용하고 있어, **한 문서 안에서 두 절이 서로 다른 문자열을 "정답"으로 제시**한다. 코드-스펙 정합성 자체는 코드가 옳은 쪽(§4와 일치)을 따르고 있으므로 런타임 결함은 아니지만, 향후 이 R8 rationale 문단을 근거로 문구를 재작업하거나 회귀 테스트 기대값을 작성하는 사람이 잘못된 문자열을 참조할 위험이 있다. maintainability 관점에서는 "동일 개념을 서술하는 한 문서 내 두 인용문이 diff 작업 중 하나만 갱신되고 다른 하나는 누락된" 전형적인 drift 사례다.
  - 제안: `spec/7-channel-web-chat/1-widget-app.md` L233 의 `carousel "일부만 표시돼요."`를 `carousel "일부 항목만 표시돼요."`로 L150과 동일하게 맞춘다(spec 편집이므로 `project-planner` 경유 원칙 확인, 단순 오탈자성 동기화이므로 경미 수정으로 처리 가능한지 확인).

- **[INFO]** `TableView`/`CarouselView` 잘림 배너 JSX 블록 2번째 반복 — 조치 불요(재확인)
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`(`wc-carousel-truncated`) / `TableView`(`wc-table-truncated`)
  - 상세: `{truncated && (<div className="wc-X-truncated">{typeof totalCount === "number" ? t("X.truncatedWithCount", {count}) : t("X.truncated")}</div>)}` 패턴이 클래스명·i18n 키 접두사만 다르고 그대로 반복된다. 이전 두 라운드(21_59_01, 22_18_19)에서 이미 동일하게 발견돼 "이 저장소는 rule-of-three 정책(`payloadOf` 테스트 헬퍼 중복 사례)을 채택했고 2곳까지는 허용"으로 판정된 사안이며, 이번 최종 상태에서도 3번째 소비처는 아직 없다. 재차 차단 사유로 보지 않는다.
  - 제안: 조치 불필요. chart/template 등 3번째 잘림 배너 도입 시 공용 `<TruncationBanner truncated totalCount kind t>` 추출 검토.

- **[INFO]** `asTotalCount` 헬퍼 추출·`Number.isInteger` tighten·`it.each` 통일 — 이전 라운드 WARNING/INFO 전량 해소 확인(회귀 없음)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` L116-124(`asTotalCount`), L228/256(`toCarousel`/`toTable` 공유 호출), `codebase/channel-web-chat/src/lib/presentation.test.ts` L71(`it.each([NaN, -1, Infinity, 12.5, "5"])`)
  - 상세: 1R에서 지적된 "`toCarousel`/`toTable` 인라인 복제"는 `as*` 헬퍼군(`asArray`/`asRecord`/`asButtons`) 바로 아래에 `asTotalCount(v): number | undefined`로 추출되어 양쪽이 공유하도록 반영됐고, 검증 조건에 `Number.isInteger`가 추가되어 spec §R8 "비음수 정수" 문구와도 합치됐다. 신규 이형-값 테스트도 `toTable` 기존 스타일(`it.each`)로 통일됐다. 새로운 결함 없이 깨끗하게 반영된 것을 최종 코드에서 확인했다.
  - 제안: 없음(유지).

- **[INFO]** `.wc-carousel-truncated` CSS 셀렉터 공유 추가 — 일관성 보강 확인
  - 위치: `codebase/channel-web-chat/src/widget/styles.ts` L65 `.wc-table-truncated, .wc-carousel-truncated { ... }`
  - 상세: 2R WARNING(테이블 배너와 시각적 비대칭)이 셀렉터 콤마 결합으로 해소되어 두 배너가 동일 스타일(폰트 크기·색상·여백)을 공유한다. 매직 넘버(`11px`/`#9ca3af`/`4px`)는 기존 `.wc-table-truncated` 규칙을 그대로 재사용한 것이라 신규 하드코딩이 아니다.
  - 제안: 없음(유지).

## 요약

이번 3R 최종 상태를 기준으로 보면, 지난 두 라운드에서 제기된 maintainability WARNING(검증 로직 인라인 복제)과 관련 INFO(테스트 스타일 불일치, CSS 비대칭)는 모두 정확하게 반영되었고 회귀도 없다. `CarouselData`/`toCarousel`/`CarouselView`의 네이밍·구조·주석 스타일은 기존 `TableData`/`toTable`/`TableView` 패턴과 일관되며, 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 관점에서 새로 도입된 문제는 없다. 이번 라운드에서 새로 발견한 사항은 코드가 아닌 spec 문서 내부의 자기모순이다 — `spec/7-channel-web-chat/1-widget-app.md`의 §4 인벤토리는 carousel 무개수 폴백 문구를 "일부 항목만 표시돼요."로 정확히 교정했지만, 같은 문서의 §R8 rationale 문단은 여전히 옛 문구("일부만 표시돼요.")를 인용하고 있어 한 문서 안에서 두 개의 서로 다른 "정답"이 공존한다. 코드 자체는 옳은 값을 따르고 있어 즉각적 버그는 아니지만, 향후 스펙을 근거로 작업할 사람에게 혼동을 줄 수 있는 문서 drift로 WARNING 처리했다. 그 외 배너 JSX 2곳 반복은 기존에 합의된 rule-of-three 정책상 조치 불요로 재확인했다.

## 위험도

LOW
