# 변경 범위(Scope) 리뷰

검토 대상: 웹채팅 위젯 table 잘림 배너 총 개수(`totalCount`) 노출 — 14개 파일(코드 4 · plan 1 · consistency-check 산출물 8 · spec 1).

## 발견사항

- **[INFO]** 배너 문체 정규화(`~됩니다` → `~돼요`)가 `totalCount` 기능 추가와 같은 diff 라인에 번들
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `TableView` 배너 렌더 (구 `일부 행만 표시됩니다.` → `일부 행만 표시돼요.`/`총 N개 중 일부만 표시돼요.`), `presentations.test.tsx` 관련 3개 테스트
  - 상세: 좁게 보면 요청은 "잘림 배너에 총 개수 노출"이지만, 실제 diff 는 기존 폴백 문구의 문체(합쇼체→해요체)까지 함께 바꾼다. 다만 이는 무단 리팩토링이 아니라 `plan/in-progress/spec-draft-webchat-truncation-total-count.md` `### 문체 (consistency WARNING 반영)` 절에 근거(같은 배너 라인을 확장하면서 신규·기존 문구의 톤이 갈리면 안 됨 + `convention_compliance` checker WARNING 대응)가 명시돼 있고, 같은 UI 요소 안에서 두 문구(총개수 있음/없음)의 톤이 갈리지 않게 하려면 사실상 분리하기 어려운 변경이다. 스코프 이탈이라기보다 "정당화된 인접 확장"에 가까우나, 순수 기능 diff 만 기대했다면 리뷰 시 문체 변경분을 별도로 인지할 필요가 있다.
  - 제안: 조치 불요(plan 에 근거 기재됨). 향후 유사 케이스에서도 문체 변경을 문구 diff 와 분리해 plan/PR 설명에 명시하는 관행 유지 권장.

- **[INFO]** `review/consistency/2026/07/11/22_58_26/**` 8개 파일(SUMMARY.md, meta.json, _retry_state.json, 5개 checker 산출물)이 diff 에 포함
  - 위치: `review/consistency/2026/07/11/22_58_26/*`
  - 상세: 얼핏 "무관한 파일 추가"로 보일 수 있으나, `meta.json` 의 `target_path` 가 정확히 이번 변경의 `plan/in-progress/spec-draft-webchat-truncation-total-count.md` 를 가리켜 이번 작업에 대한 필수 `consistency-check --spec` 실행 산출물임이 확인된다(CLAUDE.md: "`project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무"). `review/` 는 gitignore 대상이 아니며 커밋 대상이 맞다. 스코프 이탈 아님.
  - 제안: 조치 불요. 단, `plan_coherence` checker WARNING(followups 체크박스 갱신 누락)이 아직 plan 후속 구현 목록에 반영되지 않은 상태이므로, 그 부분은 별도 checklist 항목으로 후속 커밋에서 다뤄야 함(스코프 판단 밖, 참고만).

- **[INFO]** `CarouselData` 는 손대지 않고 `TableData` 로만 변경 스코프를 한정 — 의도 정합 확인
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toTable`/`TableData`
  - 상세: `truncationMeta` 는 4키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`) 를 이미 흡수하고 있어 `toCarousel` 쪽으로도 확장하고 싶은 유혹이 있었을 텐데, 이번 diff 는 정확히 `rowsTotalCount`→`TableData.totalCount` 투영만 추가하고 `CarouselData`/`itemsTotalCount` 소비는 건드리지 않는다. plan 문서의 "스코프 경계" 절과 정확히 일치 — 기능 확장(over-engineering) 없음.
  - 제안: 조치 불요.

- **[INFO]** spec 편집이 정확히 결정된 두 지점(§2 L48 행, §R8)에 한정
  - 위치: `spec/7-channel-web-chat/1-widget-app.md`
  - 상세: diff 는 §2 표(presentation inline 행)와 §R8 서술부 1개 문단 추가로 국한되며, `frontmatter`(`status: implemented`)나 다른 섹션은 무변경. plan 의 "스코프 경계" 결정("widget-app frontmatter status 유지")과 정확히 일치.
  - 제안: 조치 불요.

전반적으로 무관한 리팩토링, 사용하지 않는 임포트, 포맷팅 잡음, 설정 파일 변경, 요청 밖 기능 확장은 관찰되지 않았다. 코드 diff(`presentation.ts`/`presentations.tsx`) 는 `totalCount` 투영·소비에 정확히 국한되고, 테스트 diff 도 그에 대응하는 케이스(정상/부재/이형/노드경로)만 추가한다. 유일하게 눈에 띄는 점은 배너 문체 정규화가 기능 추가와 같은 hunk 에 섞인 것인데, 이는 plan 문서에 명시적 근거가 남아 있어 "은닉된 무관 변경"이 아니라 "문서화된 인접 확장"으로 판단된다.

## 요약

변경은 계획 문서(`spec-draft-webchat-truncation-total-count.md`)가 스코프로 명시한 "table 잘림 배너에 `totalCount` 투영·노출"에 정확히 국한되며, `CarouselData`/wire/백엔드는 의도대로 무변경이다. 배너 문구의 해요체 정규화가 기능 diff 와 섞여 있으나 plan 에 근거가 문서화돼 있어 무단 확장으로 보기 어렵다. `review/consistency/**` 산출물 포함은 프로젝트 규약상 필수 절차의 커밋 대상이라 스코프 이탈이 아니다. 불필요한 리팩토링, 무관 파일 수정, import/설정 잡음은 발견되지 않았다.

## 위험도
LOW
