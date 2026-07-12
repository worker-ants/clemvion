# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `totalCount` 신뢰성 판정 로직이 `toCarousel`/`toTable` 에 그대로 복제됨 — 모듈 자체 `as*` 정규화 헬퍼 관례를 어김
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toCarousel` (신규, `rawTotal`/`totalCount` 블록) vs `toTable` (기존, 동일 블록)
  - 상세: 두 함수 모두 다음 5줄이 프로퍼티 이름(`itemsTotalCount` vs `rowsTotalCount`)만 다르고 완전히 동일하다.
    ```ts
    const rawTotal = output.itemsTotalCount; // toTable 은 rowsTotalCount
    const totalCount =
      typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0
        ? rawTotal
        : undefined;
    ```
    이 파일은 이미 `asArray`/`asRecord`/`asButtons` 같은 소형 `as*` 정규화 헬퍼 패턴을 확립해 두었는데(같은 파일 상단), 이번 신규 로직만 그 관례를 따르지 않고 인라인 복제했다. 신뢰-값 판정 규칙(유한·비음수 정수)이 향후 바뀔 때 한쪽만 수정되고 다른 쪽이 누락되면 `toCarousel`/`toTable` 간 조용한 동작 불일치(회귀)가 생길 위험이 있다.
  - 제안: `function asTotalCount(v: unknown): number | undefined { return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined; }` 형태로 추출해 두 함수에서 공유. 기존 `as*` 헬퍼군과 나란히 두면 파일 내부 일관성도 함께 확보된다.

- **[INFO]** 신규 "신뢰 못 할 totalCount" 테스트가 같은 파일의 기존 파라미터화 패턴(`it.each`)을 따르지 않고 `for` 루프로 회귀
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:261-272` (`toCarousel — 비잘림 기본값 + 신뢰 못 할 totalCount 는 undefined`) vs `presentation.test.ts:531-544` (`toTable — rowsTotalCount 가 %s 이면 totalCount=undefined`, `it.each` 사용)
  - 상세: `toTable` 쪽은 동일한 "이형 값 4종 → undefined" 검증을 `it.each([...])` 로 케이스별 독립 테스트로 분리해 실패 시 어떤 입력값이 깨졌는지 테스트 이름에 바로 드러난다. `toCarousel` 쪽 신규 테스트는 `for (const bad of [...])` 로 한 테스트 안에 4개 값을 묶어, 중간에 하나가 실패하면 나머지 값 검증이 실행되지 않고 실패 지점 파악도 한 단계 더 필요하다. 같은 파일 안에서 동일 목적의 테스트가 서로 다른 스타일을 쓰는 점이 일관성 관점의 사소한 흠이다.
  - 제안: `toCarousel` 테스트도 `it.each` 로 맞추거나(파일 내 스타일 통일), 혹은 두 곳 모두 공용 파라미터 배열을 참조하도록 정리.

- **[INFO]** 잘림 배너 JSX 블록이 `TableView`/`CarouselView` 에 두 번째로 동일 패턴 반복 — 3번째 소비처 등장 시 추출 후보
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`(신규 블록) / `TableView`(기존 블록)
  - 상세: `{truncated && (<div className="wc-X-truncated">{typeof totalCount === "number" ? t("X.truncatedWithCount", {count: totalCount}) : t("X.truncated")}</div>)}` 형태가 클래스명·i18n 키 접두사만 다르고 그대로 반복된다. 다만 이 프로젝트는 동일 저장소 내 `payloadOf` 테스트 헬퍼 중복 건에서 이미 "3번째 소비처가 생기면 공용화, 2곳까지는 그대로 둔다"는 정책을 채택한 바 있어(`plan/in-progress/webchat-widget-presentation-followups.md`), 현재 2곳(table/carousel) 중복은 그 관례상 즉시 조치 대상은 아니다.
  - 제안: 조치 불필요. 다음에 chart/template 등 3번째 잘림 배너가 생기면 공용 `<TruncationBanner truncated totalCount kind t>` 컴포넌트로 추출 검토.

## 요약

이번 변경은 기존 `toTable`/`TableView` 잘림 배너 구현을 `toCarousel`/`CarouselView` 로 대칭 확장한 작은 diff로, 네이밍(`truncated`/`totalCount`)·주석 스타일·i18n catalog 키 구성 모두 기존 관례를 충실히 따르고 있어 가독성과 일관성은 전반적으로 양호하다. 다만 "유한·비음수 정수만 신뢰"하는 검증 로직이 파일 자체의 `as*` 헬퍼 관례를 따르지 않고 `toCarousel`/`toTable` 양쪽에 그대로 복제되어 있어, 규칙 변경 시 한쪽만 갱신되는 drift 위험이 있다(WARNING 1건). 테스트 스타일 미세 불일치(INFO)와 JSX 배너 중복(INFO, 기존 정책상 허용 범위)은 차단 사유가 아니다. 매직 넘버·과도한 중첩·함수 길이 문제는 발견되지 않았다.

## 위험도

LOW
