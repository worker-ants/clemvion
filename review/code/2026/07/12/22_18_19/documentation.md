# 문서화(Documentation) 리뷰 — webchat carousel truncation banner

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 직접 선례(PR #921)가 예고한 후속 기능인데도 항목이 빠짐
  - 위치: 리포지토리 루트 `CHANGELOG.md` (본 diff 파일 목록에 없음)
  - 상세: 이 리포는 웹채팅 위젯의 사용자-가시적 변경마다 `## Unreleased — <feature>` 항목을 CHANGELOG.md 에 남기는 확립된 관례를 갖고 있다(예: 같은 파일 상단에 나열된 chrome i18n 활성화, idle-wait reaper, 세션 컨트롤 등 전부 항목 보유). 특히 이번 변경의 직접 전신인 `fb8d13f64 feat(web-chat): 위젯 table 잘림 배너 총 개수 노출 (§2/R8 parity)` (#921) 은 CHANGELOG.md 에 "위젯 table 잘림 배너가 잘리기 전 총 행 개수를 함께 노출한다" 항목을 추가하면서 **명시적으로** "범위: table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속" 이라고 적어 이번 carousel 후속을 예고했다. `plan/in-progress/webchat-widget-presentation-followups.md` 도 이번 diff 로 그 두 항목을 `[x]` 완료 처리했다. 즉 이번 변경은 CHANGELOG 선례가 정확히 지목한 다음 단계인데도 CHANGELOG.md 에는 대응 항목이 없다. 이는 (a) 기존에 이미 잘린 carousel 응답을 갖고 있던 배포에서 배너가 **소급 노출**되는 사용자-가시적 동작 변화(dead field 활성화 — `side_effect.md` 리뷰가 이미 "배포 노트/QA 체크리스트에 언급하면 좋음" 이라고 지적), (b) 배너 문구 자체가 신규 도입(ko "일부만 표시돼요."/"총 {{count}}개 중 일부만 표시돼요." · en 대응) 이라는 점에서, table 변형과 동일하게 CHANGELOG 항목을 요구하는 사안이다.
  - 제안: PR #921 항목의 형식·톤을 따라 `## Unreleased — 웹채팅 위젯 carousel 잘림 배너 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)` 항목을 CHANGELOG.md 에 추가한다. 배너 문구(ko/en)·"기존 잘린 carousel 응답에 배너가 소급 노출됨"·SoT 스펙 링크(`1-widget-app.md §2·R8`)를 명시하면 table 항목과 대칭을 이룬다.

- **[INFO]** `toCarousel`/`toTable` 함수 자체 docstring이 신규 반환 필드(`truncated`/`totalCount`)를 언급하지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toCarousel()` 상단 JSDoc, `toTable()` 상단 JSDoc
  - 상세: `CarouselData.totalCount`/`TableData.totalCount` 필드 자체에는 잘림 배너 의미를 설명하는 상세 JSDoc이 잘 달려 있고, `asTotalCount()` 헬퍼에도 spec §R8 링크를 포함한 정확한 문서가 있다. 그러나 두 변환 함수(`toCarousel`/`toTable`)의 함수-레벨 docstring 자체는 여전히 "layout/컬럼/행 매핑" 계약만 서술하고 잘림 메타 투영 동작은 언급하지 않는다. `toCarousel`은 이번 diff로 신규 추가된 로직이라 새로 생긴 gap이며, `toTable`은 이전부터 있던 동일 gap이 대칭적으로 남아 있다(이번 diff가 새로 만든 회귀는 아님).
  - 제안: 두 docstring에 "잘림 메타(`truncated`/`totalCount`)는 §R8 규약대로 투영" 한 줄을 추가하면 함수 계약이 인터페이스 문서에만 의존하지 않고 함수 자체에서도 드러난다. 우선순위 낮음.

- **[INFO]** `RESOLUTION.md`의 "channel-web-chat 은 PROJECT.md doc-sync-matrix 밖" 서술이 부정확(결론은 맞으나 근거가 틀림)
  - 위치: `review/code/2026/07/12/21_59_01/RESOLUTION.md` — "documentation·user_guide_sync disk-write gap" 섹션
  - 상세: `.claude/config/doc-sync-matrix.json` 에는 이미 `id: "new-widget-chrome-string"` 항목이 존재한다(트리거: `codebase/channel-web-chat/src/**/*.tsx`, 타겟: `catalog.ts` 의 `WIDGET_STRINGS` {ko,en}). `PROJECT.md` §문서·번역 백서 표에도 동일 행이 122번째 줄로 등재돼 있다(2026-07-12 커밋 `19fca6715`에서 신설, "PROJECT.md 표 + doc-sync-matrix.json 1:1" 이라는 커밋 메시지로 확인됨). 즉 channel-web-chat은 doc-sync-matrix "밖"이 아니라 이미 그 안에 명시적으로 등록돼 있고, 이번 diff는 그 행의 요구사항(TSX 신규 chrome 문자열 → `catalog.ts` ko/en 양쪽 갱신)을 정확히 충족했다(파일 1: `catalog.ts`에 4개 신규 키 ko+en 추가). 결론("이번 라운드에서 무발견 예상")은 맞지만, 근거로 적힌 "doc-sync-matrix 밖"이라는 서술은 사실과 다르다 — 정확한 근거는 "matrix 안에 있고, 요구되는 catalog.ts 양쪽 갱신을 이미 충족했다"이다.
  - 제안: 이 파일은 과거 리뷰 라운드의 아카이브 산출물이라 소급 수정 실익은 낮으나, 다음 라운드의 `user_guide_sync` 리뷰어가 동일한 부정확한 전제를 반복하지 않도록 참고용으로 기록한다.

- 참고(문제 없음으로 확인) — `codebase/channel-web-chat/src/lib/i18n/catalog.ts`의 ko/en 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`) 는 파일 상단 주석이 명시한 "ko/en 키 집합은 반드시 동일해야 한다" 제약을 양쪽 4개 키 모두 충족한다. `presentation.ts`의 `asTotalCount()` 헬퍼·`CarouselData.totalCount` 필드 JSDoc은 spec `§R8`을 정확히 인용하고 실제 스펙 본문(§10.4·§R8, "유한한 비음수 정수만 채택")과 일치한다(코드도 `Number.isInteger` 로 최종 정합). `spec/7-channel-web-chat/1-widget-app.md`의 §2 표·§4 chrome 인벤토리·§R8 서술은 이번 diff로 함께 갱신되어 코드와 line-level로 일치하며, "carousel 은 미구현이라 후속" 이라는 이전 서술이 정확히 대칭 구현으로 교체됐다. `plan/in-progress/webchat-widget-presentation-followups.md`의 체크박스도 실 구현 완료 후 `[x]`로 갱신되어 프로젝트 관례(선체크 금지)를 준수한다.

## 요약

이번 diff는 코드 레벨 문서화(JSDoc/인라인 주석/spec §R8·§2·§4 갱신)는 매우 충실하다 — 특히 `asTotalCount` 헬퍼와 `CarouselData`/`TableData` 필드 JSDoc은 spec 조항을 정확히 인용하고 실제 구현과 line-level로 일치한다. 다만 이 프로젝트가 웹채팅 위젯 변경마다 강하게 지켜온 CHANGELOG.md 갱신 관례가 이번 건에서는 빠졌다는 점이 유일한 실질적 결함이다 — 특히 이번 변경의 직접 선례(PR #921 table 배너)가 CHANGELOG 항목 안에서 "carousel 은 별도 후속" 이라고 명시적으로 예고했던 바로 그 후속이라, 대칭 항목 부재가 더 두드러진다. 그 외에는 함수-레벨 docstring의 사소한 누락(기존 패턴 반복)과 아카이브된 리뷰 문서의 부정확한 부연 설명 정도만 INFO로 남는다.

## 위험도

MEDIUM
