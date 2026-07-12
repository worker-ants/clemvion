# 변경 범위(Scope) 리뷰 결과

리뷰 대상: carousel 잘림 배너(총 개수 노출 포함) 구현 — `plan/in-progress/webchat-widget-presentation-followups.md` 미구현 항목 1·2 해소.
비교 대상 파일 7건: `catalog.ts` / `presentation.test.ts` / `presentation.ts` / `presentations.test.tsx` / `presentations.tsx` / plan 파일 / `spec/7-channel-web-chat/1-widget-app.md`.

## 발견사항

- **[INFO]** spec/plan 파일이 코드 구현과 같은 changeset 에 포함됨
  - 위치: `spec/7-channel-web-chat/1-widget-app.md`, `plan/in-progress/webchat-widget-presentation-followups.md`
  - 상세: plan 의 "착수 조건" 절은 "첫 두 항목은 위젯 렌더 표면을 넓히므로 project-planner 가 §2 에 표시 계약을 먼저 정의해야 한다" 고 명시한다. 이번 diff 는 그 spec 계약 정의(§2 표 문구·§4 인벤토리·R8 rationale 확장)와 developer 구현이 한 changeset 으로 함께 리뷰되고 있다. 내용 자체는 정확히 이번 기능(carousel truncated/totalCount 대칭)에만 국한돼 있어 "의도 이상의 변경"은 아니며, plan 의 선행조건이 이미 만족됐다는 근거로 보인다. 다만 스코프 판정 관점에서는 "이 spec/plan 편집이 project-planner 산출물로 별도 커밋/세션에서 온 것인지, developer 세션이 직접 쓴 것인지"는 이 diff 만으로 판별 불가하다는 점만 기록해 둔다(코드 스코프 자체는 이상 없음 — 역할 분리는 별도 관심사).
  - 제안: 조치 불필요. 참고로만 기록.

- **[INFO]** plan 파일에서 미해당 항목(테스트 헬퍼 `payloadOf` 중복)은 의도적으로 손대지 않음
  - 위치: `plan/in-progress/webchat-widget-presentation-followups.md` 세 번째 미구현 항목
  - 상세: diff 는 항목 1·2 체크박스만 `[x]` 로 갱신하고 세 번째(선택 사항) 항목은 그대로 `[ ]` 로 남겨둔다. 스코프 규율이 잘 지켜진 사례로 판단되며 문제로 보지 않는다.

발견된 CRITICAL/WARNING 은 없다.

## 스코프 정합성 확인 (파일별)

1. `catalog.ts`: `carousel.truncatedWithCount`/`carousel.truncated` ko/en 키 4줄만 추가. 기존 `table.*` 키 옆에 나란히 삽입되어 기존 항목 변경 없음. 기능과 정확히 일치.
2. `presentation.test.ts`: `toCarousel` truncated/totalCount 신규 동작 검증 테스트 2건만 추가(`toTable` 대칭 케이스 포함, `NaN`/음수/`Infinity`/문자열 가드). 기존 테스트 미변경.
3. `presentation.ts`: `CarouselData` 인터페이스에 `truncated`/`totalCount` 필드 추가 + `toCarousel` 반환값에 두 필드 계산 로직만 추가. `toTable` 의 기존 패턴(유한 비음수 정수 가드)을 그대로 미러링 — 신규 추상화·리팩터 없음.
4. `presentations.test.tsx`: carousel 배너 렌더 테스트 2건만 추가. 기존 carousel 테스트 블록 미변경.
5. `presentations.tsx`: `CarouselView` 의 구조분해에 `truncated, totalCount` 추가 + 배너 JSX 블록 1개 삽입. `TableView` 의 기존 배너 패턴과 동일 구조로 대칭 구현. 그 외 컴포넌트(`ButtonBar`, `ChartView`, `TemplateView` 등) 무변경.
6. plan 파일: 항목 1·2 체크박스 완료 처리 + "완료" 각주만 추가. worktree frontmatter 갱신은 컨벤션에 따른 정상 절차.
7. spec 파일: "table 잘림 배너" 단독 서술을 "table·carousel 잘림 배너" 대칭 서술로 확장하는 국소 편집 2곳(§2 표 셀, §4 인벤토리 문장) + R8 rationale 문단 확장. 모두 이번 기능의 계약 정의에 해당하며 무관한 절 편집 없음.

포맷팅·주석·임포트·설정 파일 관련 이상 없음 — 모든 diff hunk 가 순수 추가(additive)이며 기존 코드의 개행·들여쓰기·무관 라인 변경이 없다.

## 요약

7개 파일 diff 전부가 "carousel 잘림 배너 + 총 개수 노출"이라는 단일 목표(plan 의 두 미구현 항목)에 정확히 대응한다. 구현은 이미 존재하는 `toTable`/`TableView` 패턴을 그대로 대칭 이식한 것으로, 불필요한 리팩토링·기능 확장·무관 파일 수정·포맷팅 잡음·임포트 변경·설정 변경이 전혀 관찰되지 않는다. plan 의 세 번째(선택) 항목은 의도적으로 미착수 상태로 남겨 스코프 규율을 지켰다. spec/plan 문서 편집도 이번 기능의 표시 계약 정의·완료 기록에 정확히 국한된다.

## 위험도

NONE
