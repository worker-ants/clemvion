# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `CarouselData` 에 non-optional 필드 `truncated: boolean` 추가 — 타입 시그니처 변경
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `CarouselData` 인터페이스, `toCarousel` 반환문
  - 상세: `CarouselData` 는 라이브러리 내부(같은 파일) 타입이고 실제 생성 지점(`toCarousel`)과 유일한 소비 지점(`CarouselView`, `codebase/channel-web-chat/src/widget/components/presentations.tsx`)이 모두 같은 diff 안에서 동기화됐다. `grep` 결과 `toCarousel`/`CarouselData`/`CarouselView` 의 non-test 참조는 이 두 파일뿐이라 외부 호출자에 미치는 파급은 없다.
  - 제안: 조치 불요. 향후 `CarouselData` 를 패키지 경계 밖(별도 패키지 등)으로 export 하게 되면 이 필드가 breaking change 가 될 수 있음을 인지만 해두면 됨.

- **[INFO]** `asTotalCount` 도입으로 `toTable` 의 기존 검증 규칙이 `Number.isFinite` → `Number.isInteger` 로 tighten 됨(동작 변경)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `asTotalCount`(신규), `toTable` 반환문(기존 인라인 로직 대체)
  - 상세: 종전 `toTable` 은 `rowsTotalCount` 가 "유한한 비음수 수"이면 통과시켰으나, 신규 공유 헬퍼는 "유한한 비음수 **정수**"만 통과시킨다. 이는 `toCarousel` 신설에 맞춰 `toTable` 의 기존 동작을 은근히 바꾸는 부수 변경이다. 다만 백엔드 생성 지점(`carousel.handler.ts` `cappedItems.originalLength`, `table.handler.ts` `cappedRows.originalLength`)은 항상 배열 `.length`(정수)이고, 기존 `presentation.test.ts` 의 `rowsTotalCount` 테스트도 전부 정수값만 사용해 실질 회귀는 없음을 확인함. spec §R8("비음수 정수")과도 합치.
  - 제안: 조치 불요(이미 RESOLUTION.md 에서 "toTable 도 동반 tighten, 기존 테스트 무회귀 확인"으로 인지·검증됨). 소수 `rowsTotalCount` 를 실제로 보내는 미지의 호출자가 있다면(현재는 없음) 배너가 조용히 무개수 폴백으로 전환되는 점만 유의.

- **[INFO]** dead field 활성화로 인한 소급(retroactive) UI 노출 — 배포 시점 부작용
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toCarousel`(신규 투영), CHANGELOG.md 명시
  - 상세: `asEnvelope`(백엔드/SSE wire, §10.4)는 이미 `itemsTruncated`/`itemsTotalCount` 를 실어 보내고 있었으나 소비처가 없어 dead field 였다. 이번 변경으로 코드 배포 즉시 — 서버/데이터 변경 없이 — 기존에 이미 잘려 있던 AI carousel 응답들(과거 turn·복원 thread 포함)에 잘림 배너가 소급 노출된다. 이는 "함수가 예상 외 전역 상태를 변경"하는 종류는 아니지만, 배포 타이밍에 따라 사용자에게 보이는 화면이 **서버 재실행 없이** 바뀌는 순수 프런트 렌더링 변경이다.
  - 제안: 조치 불요 — CHANGELOG.md 와 SUMMARY.md(INFO#3)에 이미 명시적으로 문서화됨. 새로운 파일시스템/네트워크/전역 상태 부작용은 아님.

- **[INFO]** i18n catalog 신규 키 2건(`carousel.truncatedWithCount`/`carousel.truncated`) 추가 — 순수 추가, 기존 키 무변경
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`
  - 상세: `deepFreeze` 로 동결된 `WIDGET_STRINGS` 객체에 ko/en 각 2개 키를 신규 추가. 기존 `table.*` 키는 값 변경 없음. `t()` 조회 함수 시그니처·전역 상태·부작용 없음.
  - 제안: 조치 불요.

- **[INFO]** CSS 셀렉터 병합(`.wc-table-truncated` → `.wc-table-truncated, .wc-carousel-truncated`) — 순수 확장
  - 위치: `codebase/channel-web-chat/src/widget/styles.ts`
  - 상세: 기존 `.wc-table-truncated` 규칙 내용은 무변경이고 셀렉터만 `.wc-carousel-truncated` 를 추가해 공유. 스타일 값 자체가 바뀐 게 아니므로 기존 table 잘림 배너의 시각적 회귀는 없음.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**` 하위 이전 라운드(21_59_01, 22_18_19) 산출물(RESOLUTION/SUMMARY/meta.json/_retry_state.json/각 리뷰어 `.md`)이 diff 에 다수 포함됨 — 파일시스템 부작용이 아닌 정상 워크플로 산출물
  - 위치: `review/code/2026/07/12/21_59_01/*`, `review/code/2026/07/12/22_18_19/*`
  - 상세: 이 파일들은 `/ai-review` 파이프라인이 규약(`.claude/skills/code-review-agents/SKILL.md`)에 따라 생성한 리뷰 산출물이며, 리뷰 대상 소스 코드 변경의 "부작용"이 아니라 커밋에 함께 포함된 이전 리뷰 라운드 기록이다. 새로운 전역 변수·네트워크 호출·프로세스 부작용은 없음.
  - 제안: 조치 불요. (side-effect 관점 밖 — documentation/scope 리뷰어 영역)

## 요약

이번 변경은 기존 `TableData.truncated`/`totalCount` + `TableView` 배너 구현을 `CarouselData`/`CarouselView` 로 대칭 확장한 것으로, 신규 non-optional 필드(`CarouselData.truncated`) 추가는 생성·소비 지점이 같은 diff 안에서 동기화돼 외부 호출자 영향이 없다. 공유 헬퍼 `asTotalCount` 도입 과정에서 `toTable` 기존 검증 규칙이 `isFinite`→`isInteger` 로 은근히 tighten 됐으나, 실제 생성 지점(배열 `.length`)과 기존 테스트가 모두 정수만 다뤄 회귀는 없다. dead field(`itemsTruncated`/`itemsTotalCount`) 소비 활성화로 배포 시점에 기존 잘린 carousel 응답에 배너가 소급 노출되는 점은 상태 변경이 아닌 순수 렌더링 변화이며 CHANGELOG/SUMMARY 에 이미 명시돼 있다. 전역 변수 도입, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경, 예상치 못한 파일시스템 부작용은 발견되지 않았다. 전반적으로 부작용 관점 위험은 낮다.

## 위험도

LOW
