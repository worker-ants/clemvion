# 문서화(Documentation) 리뷰 — webchat carousel truncation banner (round 22_40_42)

## 발견사항

- **[WARNING]** spec 본문 내부 자기모순 — carousel 무개수 폴백 배너 문구를 두 곳에서 다르게 인용, 한쪽은 실제 구현과 불일치
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` 150번째 줄 vs 233번째 줄
  - 상세: 같은 spec 파일 안에서 carousel 무개수 폴백 문구를 두 번 리터럴로 인용하는데 서로 다르다.
    - §4 chrome 인벤토리(150번째 줄): `carousel 무개수 "일부 항목만 표시돼요."` — 이 값은 실제 구현과 일치한다.
    - §2 표 아래 서술(233번째 줄): `무개수 폴백(table "일부 행만 표시돼요."·carousel "일부만 표시돼요.")을 렌더한다.` — "항목"이 빠진 **stale** 문구다.
    실제 구현(`codebase/channel-web-chat/src/lib/i18n/catalog.ts`)의 ko `carousel.truncated` 값은 `"일부 항목만 표시돼요."`이고, `presentations.test.tsx`의 신규 테스트(`expect(screen.getByText("일부 항목만 표시돼요.")).toBeInTheDocument()`)도 이 값으로 통과한다. 즉 233번째 줄만 code/테스트/자기 문서(150번째 줄)와 어긋난다. 리뷰 이력을 보면 직전 라운드(`review/code/2026/07/12/22_18_19/maintainability.md`)가 "ko `carousel.truncated`가 en과 달리 도메인 명사(항목)를 생략해 비대칭"이라는 INFO를 남겼고, 이후 catalog.ts 쪽은 "일부 항목만 표시돼요."로 수정됐지만 spec §2 서술(233번째 줄)에는 그 수정이 반영되지 않은 것으로 보인다. spec 은 이 프로젝트의 단일 진실(SoT)이므로 리터럴 인용 문구가 구현과 어긋나면 다음 변경자가 잘못된 문구를 기준으로 삼을 위험이 있다.
  - 제안: 233번째 줄의 `carousel "일부만 표시돼요."`를 `carousel "일부 항목만 표시돼요."`로 정정해 150번째 줄·`catalog.ts`·`presentations.test.tsx`와 통일한다.

- **[INFO]** (직전 라운드에서 이미 지적, 여전히 미해소, 우선순위 낮음) `toCarousel`/`toTable` 함수-레벨 JSDoc이 신규 `truncated`/`totalCount` 투영을 언급하지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toCarousel()`(209번째 줄 위 JSDoc), `toTable()`(238번째 줄 위 JSDoc)
  - 상세: `CarouselData.totalCount`/`TableData.totalCount` 필드 자체와 `asTotalCount()` 헬퍼에는 spec §R8을 정확히 인용한 상세 JSDoc이 있지만, 두 변환 함수 자체의 docstring은 여전히 "layout/컬럼/행 매핑" 계약만 서술하고 잘림 메타 투영은 언급하지 않는다. `review/code/2026/07/12/22_18_19/documentation.md`가 이미 이 gap을 INFO로 남겼고 이번 diff에서도 그대로 남아 있다(새 회귀는 아님, 기존 gap 유지 확인).
  - 제안: 우선순위 낮음. 두 docstring에 "잘림 메타(`truncated`/`totalCount`)는 §R8 규약대로 투영" 한 줄 추가 검토.

- **[INFO]** CHANGELOG.md 갱신 확인 — 직전 라운드 WARNING 해소됨(회귀 없음)
  - 위치: `CHANGELOG.md` 3~5번째 줄 (신규 `## Unreleased — 웹채팅 위젯 carousel 잘림 배너 + 총 개수 노출` 항목)
  - 상세: `review/code/2026/07/12/22_18_19/documentation.md`가 지적한 "CHANGELOG.md 미갱신"(table #921 항목이 예고한 후속인데도 항목 부재) WARNING이 이번 diff에서 해소됐다. 배너 문구(ko `총 N개 중 일부만 표시돼요.`/`일부 항목만 표시돼요.`)·배포-시점 소급 노출 영향·SoT 스펙 링크(`§2·R8·§4`)를 명시해 table 항목(#921)과 형식·톤이 대칭이며, 인용된 폴백 문구도 실제 `catalog.ts` 값과 정확히 일치한다. 조치 불필요 — 확인 기록.

- 참고(문제 없음으로 확인) — `catalog.ts` ko/en 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`) 2개씩 4개는 파일 상단 "ko/en 키 집합 동일 필수" 제약을 충족한다. `asTotalCount()` 헬퍼·`CarouselData.totalCount` 필드 JSDoc은 spec `§R8`을 정확히 인용하고 실제 §10.4·§R8("유한한 비음수 정수만 채택")과 코드가 line-level로 일치한다(`Number.isInteger` 반영). `toCarousel`/`toTable`의 인라인 주석(`// §2/R8 — 흡수된 output.itemsTruncated/itemsTotalCount 를 투영…`, `// 잘리기 전 총 행 개수 — 흡수된 output.rowsTotalCount(§10.4)…`)은 변경된 코드와 정확히 일치한다. `plan/in-progress/webchat-widget-presentation-followups.md`의 체크박스는 실 구현·검증(vitest 350·typecheck·e2e-full) 완료 후 `[x]`로 갱신되어 "선체크 금지" 관례를 준수한다. `review/code/2026/07/12/{21_59_01,22_18_19}/*` 는 프로세스 산출물이며 프로젝트 관례상 커밋 대상이라(gitignore 되지 않음) 문서화 관점에서 별도 조치 불요. README(`codebase/channel-web-chat/README.md`)는 carousel/table/chart/template 렌더러를 이미 총칭으로만 언급하고 있어 이번 세부 배너 기능 추가로 갱신할 대상이 아니다. 백엔드 API·환경변수·설정 옵션 변경은 없다(순수 프론트엔드 위젯 변경).

## 요약

이번 diff는 CHANGELOG·JSDoc·인라인 주석·spec §R8/§2/§4 갱신 등 문서화 전반이 충실하며, 직전 라운드가 지적한 CHANGELOG 미갱신 WARNING도 해소됐다. 유일한 신규 실질 결함은 spec 본문 자체의 내부 불일치다 — `1-widget-app.md` §4(150번째 줄)는 carousel 무개수 폴백 문구를 구현과 동일하게 "일부 항목만 표시돼요."로 인용하는 반면, 같은 문서 §2 서술(233번째 줄)은 "일부만 표시돼요."라는 stale 문구를 남겨 spec이 스스로와도, 구현과도 어긋난다. 나머지는 이전부터 있던 낮은 우선순위 INFO(함수-레벨 JSDoc이 신규 필드를 언급하지 않음, 조치 불필요)만 남는다.

## 위험도

LOW
