# 부작용(Side Effect) 리뷰 — webchat table 잘림 배너 총 개수 노출 (§2/R8)

검토 대상: `codebase/channel-web-chat/src/lib/presentation.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/components/presentations.{tsx,test.tsx}`,
`plan/in-progress/spec-draft-webchat-truncation-total-count.md`,
`spec/7-channel-web-chat/1-widget-app.md`, `review/consistency/2026/07/11/22_58_26/**`.

## 발견사항

- **[INFO] `TableData` 인터페이스 확장 — 하위 호환 additive change**
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:39-47` (`TableData.totalCount?: number` 신설), `:229-235` (`toTable` 반환 객체에 필드 추가)
  - 상세: `toTable(p: unknown): TableData` 함수 시그니처(파라미터/반환 타입 이름) 자체는 불변이며, 반환 객체에 optional 필드 하나만 추가됐다. `totalCount` 를 명시적으로 import/구조분해하지 않는 기존 호출자는 영향받지 않는다(TS 구조적 타이핑). grep 결과 `toTable`/`TableData` 의 내부 소비자는 `presentations.tsx` `TableView` 단 하나뿐이고, 외부 패키지(SDK 등)에서 `TableData` 를 재노출/소비하는 곳은 없다 — 인터페이스 변경의 파급 범위는 이 두 파일에 완결된다.

- **[INFO] `toTable()` 순수성 유지 — 신규 상태/부작용 없음**
  - 위치: `presentation.ts:229-235`
  - 상세: 추가된 로직은 이미 `truncationMeta()`(diff 범위 밖, 기존 `TRUNCATION_KEYS` 화이트리스트에 `rowsTotalCount`/`itemsTotalCount` 가 이미 포함돼 있었음)가 `output` 으로 흡수해 두었던 `output.rowsTotalCount` 를 추가로 읽어 투영할 뿐이다. 입력 `p`/`output`/`config` 를 변이하지 않고 새 리터럴을 반환한다(`asRecord`/`asArray` 는 기존과 동일하게 순수). 전역 변수·모듈 스코프 상태·환경 변수·네트워크 호출은 이번 diff 에 전혀 등장하지 않는다. wire 프로토콜/백엔드도 무변경(이미 실려 오던 필드의 소비 확장) — plan 문서의 "실측" 절이 이를 명시적으로 확인해 두었다.

- **[WARNING] 사용자향 배너 문구·문체 변경 — 임베드 위젯 외부 소비자 회귀 가능성**
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx:196-203` (`TableView` truncated 배너)
  - 상세: 기존에는 잘림 시 항상 고정 문구 `"일부 행만 표시됩니다."`(합쇼체) 였으나, 이번 변경으로 (a) `totalCount` 존재 시 `"총 N개 중 일부만 표시돼요."`, (b) 부재 시에도 문체가 `"일부 행만 표시돼요."`(해요체)로 바뀐다 — 즉 `totalCount` 유무와 무관하게 화면에 노출되는 **모든 잘림 배너 문자열이 예전과 달라진다**. 이 위젯은 고객사 웹사이트에 iframe 으로 임베드되는 서드파티 컴포넌트이므로, 이 저장소가 통제할 수 없는 외부 소비자(임베드 고객사)가 해당 정확한 문자열에 의존하는 스크린샷 테스트·스크래이핑·자동화를 갖고 있었다면 이번 변경이 그쪽에서 조용히 깨질 수 있다. 저장소 내부 검색으로는 이 diff 에 포함된 두 테스트 파일 외에 해당 문자열을 참조하는 다른 코드(e2e 포함, Playwright 스펙 부재 확인)는 없었다.
  - 참고: 변경 자체는 `plan/in-progress/spec-draft-webchat-truncation-total-count.md`(consistency-check LOW, WARNING 1건 — i18n 해요체 컨벤션 정합)와 `spec/7-channel-web-chat/1-widget-app.md` §2/§R8 에 명시적으로 문서화되어 있고, 두 테스트 파일도 신규 문구로 갱신되었다 — **의도된 변경이며 이번 세션 내부에서는 회귀가 아니다.** 다만 "인터페이스 변경이 기존 사용자에 미치는 영향" 관점에서 최종 사용자(고객사)에게 보이는 문자열이 이번 PR로 완전히 교체된다는 사실 자체는 배포 전 인지해 둘 필요가 있다.
  - 제안: 별도 조치는 불요(문서화·테스트 완료 확인). 배포 노트/CHANGELOG 에 "위젯 table 잘림 배너 문구 변경(고객사 스크래이핑 스크립트 영향 가능)"을 한 줄 남겨두면 향후 유사 문의 대응에 도움이 된다.

- **[INFO] 신규 파일 생성(`plan/in-progress/*.md`, `review/consistency/**`)은 코드 로직의 부작용이 아니라 워크플로우 표준 산출물**
  - 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md`, `review/consistency/2026/07/11/22_58_26/*`
  - 상세: 이 파일들은 `project-planner`/`consistency-checker` 스킬이 규약대로 생성한 계획·검토 산출물이며, `presentation.ts`/`presentations.tsx` 의 런타임 동작과는 무관하다. 예상치 못한 파일시스템 부작용으로 볼 수 없다(CLAUDE.md 정보 저장 위치 규약과 일치).

- **[없음] 이벤트/콜백 변경**: `onButton` 콜백 시그니처·호출 지점, `PresentationList`/`PresentationBlock` prop 계약은 이번 diff 에서 불변. `ButtonBar`/carousel/chart/template 렌더 경로는 손대지 않았다.
- **[없음] 환경 변수·네트워크 호출**: 이번 diff 범위 내 `process.env` 참조나 `fetch`/`axios` 등 신규 외부 호출 없음.

## 요약

변경은 이미 위젯 `output` 까지 흡수돼 있던(`truncationMeta` 의 기존 화이트리스트) `rowsTotalCount` 필드를 `toTable()` 이 추가로 읽어 `TableData.totalCount?: number` 로 투영하고, `TableView` 가 이를 배너 문구에 반영하는 좁고 순수한 확장이다. 함수 시그니처·전역 상태·환경 변수·네트워크 호출·콜백 계약 어느 것도 건드리지 않으며, `toTable`/`TableData` 의 유일한 내부 소비자만 영향을 받는다. 유일하게 주목할 지점은 위젯이 렌더하는 최종 사용자 문자열(잘림 배너)이 문체까지 포함해 완전히 교체된다는 점 — 이 저장소 내부에서는 spec·plan·테스트가 모두 함께 갱신돼 회귀가 아니지만, 이 위젯을 임베드하는 외부(고객사) 소비자가 정확한 문자열에 의존했을 가능성은 저장소 grep 만으로는 배제할 수 없는 잔여 리스크다.

## 위험도

LOW
