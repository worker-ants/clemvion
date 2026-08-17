# 문서화(Documentation) 리뷰 — eia-masking-round2 (`12_57_15`, 라운드 3 / 2차 fresh review)

## 사전 확인

이 PR 은 이미 두 차례 문서화 리뷰(`12_06_12`, `12_33_36`)를 거쳤고 그때 지적된 WARNING(모두
`CHANGELOG.md` 관련 — "트래커에 등재" stale 표현, 이후 "아래 항목" 죽은 포인터)이 각각의
`RESOLUTION.md` 를 통해 실제로 고쳐졌음을 소스에서 재확인했다.

- `CHANGELOG.md:62`: "(**닫는 조건**인 프런트 마커 가드는 위 항목이 폼 프리필에 세웠다 — …)" —
  "위 항목"은 파일 맨 위(3번째 줄)의 신설 `## Unreleased — 마스킹된 폼 기본값이…` 절을 정확히
  가리킨다. 이 파일 자신이 24번째 줄 부근에서 "CHANGELOG 는 최신이 위로 쌓인다"고 명시한
  관례와 방향이 일치한다 — 2라운드 전 WARNING(죽은 "아래 항목" 포인터)은 실제로 해소됐다.
- `dynamic-form-ui.tsx`/`sanitize-error-message.ts`: `MASKED_MARKERS`/`isMaskedMarker` 이름이
  backend·frontend 전역에서 완전히 일치(구 이름 `MASK_MARKERS`/`isMaskedValue` 잔존 0건, grep
  재확인) — 직전 라운드 maintainability WARNING(#6) fix 가 실제로 반영돼 있다.
- `text-muted-foreground` → `text-[hsl(var(--muted-foreground))]` 로 정정됨(`dynamic-form-ui.tsx:474`)
  — 직전 라운드 maintainability WARNING fix 확인.

위 세 항목은 재지적하지 않는다(이미 해소된 과거 지적).

## 발견사항

- **[INFO]** 테스트 파일 상단 모듈 docstring의 "검증 범위" 목록이 이번 PR 로 새로 추가된
  테스트 영역(마스킹된 `defaultValue` 왕복 차단, 7건)을 포함하지 않는다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:12-30`
    (모듈 최상단 JSDoc, `검증 범위:` 불릿 목록)
  - 상세: 이 JSDoc 은 select/radio/number/file/checkbox/textarea/date/text 필드 타입,
    `spec §10.5`/`§1.5` 참조, `defaultValue` 초기화 매트릭스, key prop 보존/리셋, 다중 파일
    제출 등 이 파일이 커버하는 영역을 열거하는 "커버리지 인덱스" 역할을 한다. 이번 PR 이
    파일 끝(580번째 줄 이후)에 `describe("DynamicFormUI — 마스킹된 defaultValue 왕복 차단", …)`
    블록을 새로 추가했고(자체 JSDoc 은 상세하다), 이 블록만으로도 마커 3종 프리필 차단·
    부분-매치 캐너리·안내 힌트 노출/부재·제출 payload 무결성까지 7개 테스트를 담는 실질적인
    새 커버리지 축인데, 파일 최상단 목록에는 이 축이 등재되지 않았다. 이 diff 는 그 상단
    docstring 자체를 건드리지 않았다(`git diff origin/main` 로 확인 — 12-30번째 줄은 변경분에
    없음). 기능에는 영향이 없고 새 `describe` 블록 자체의 JSDoc 이 이미 "왜"를 충분히 설명하므로
    심각도는 낮지만, 파일을 처음 열어 상단 요약만 훑는 사람은 이 회귀 방어 축의 존재를 놓칠 수
    있다.
  - 제안: 상단 "검증 범위" 목록에 "마스킹된 `defaultValue` 프리필 차단(왕복 오염 방지, EIA §R17)"
    한 줄을 추가한다.

## 그 외 확인 사항 (발견 아님, 긍정 확인)

- `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`: frontmatter(`worktree`/`branch`/
  `spec_impact`/`pending_plans`) 완비, 체크리스트 전 항목이 실제 diff 와 1:1 대응, 유일한 미완료
  항목("코드 동결 → 최종 게이트 → push")은 이 라운드가 진행 중임을 정확히 반영한다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`: 새로 등재된 두 트래커 항목
  (마커 미러 계약 테스트, 프리필 가드 후속 3건)과 두 항목의 체크박스 완료 전환(마커 JSDoc 귀속,
  유저가이드 Error 탭 캐비엇) 모두 "이연 사유"가 "해소된 과거 기록"으로 명시적으로 갱신돼
  있어 stale 서술이 없다.
- `spec/5-system/14-external-interaction-api.md` §R17 "프리필 왕복" 신설 불릿, `12-background.md`
  §8.2, `15-chat-channel.md` §R-CC-15(`nodeName`→`nodeLabel`) 세 spec 변경 모두 코드·plan
  체크리스트와 line-level 로 일치하며, `code:` 프런트매터에 `sanitize-error-message.ts`·
  `dynamic-form-ui.tsx` 두 코드 경로가 추가됐다(§14 diff 상단 확인).
- KO/EN 유저 가이드(`run-results.mdx`/`.en.mdx`) Error 탭 캐비엇 문구가 Output 탭 캐비엇과
  같은 패턴("Input/Output과 마찬가지로…")으로 대칭적으로 작성됐고, i18n 신규 키
  `formMaskedDefaultHint` 는 en/ko 양쪽 동일 위치(`runResults` 섹션)에 등록되며 톤(en: 명령형
  안내, ko: 해요체)도 인접 키들과 일관된다. 테스트의 정규식(`/자격증명으로 판별되어
  가려졌어요/`)과 실제 ko 문자열도 정확히 일치한다.
- `sanitize-error-message.ts` 의 마커 상수 재배치(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER` 를 `MASKED_MARKERS` JSDoc 바로 위로 이동 + `{@link}` 상호참조)는 순수
  문서 정리이며 두 라운드 전 documentation WARNING(JSDoc 오귀속)을 실제로 해소했다.

## 요약

두 차례의 fresh 리뷰에서 나온 documentation WARNING(CHANGELOG stale → 죽은 포인터)이 모두
실제로 해소됐음을 소스에서 직접 재확인했고, 이번 라운드에서 새로 찾은 것은 테스트 파일 상단
"검증 범위" 목록이 신규 테스트 블록을 반영하지 않는 INFO 1건뿐이다. JSDoc(특히
`isMaskedMarker`/`MASKED_MARKERS`)이 "왜"까지 담아 원인·경계·트레이드오프를 설명하는 이
저장소의 문서화 관행을 잘 따르고, backend↔frontend 미러 동기화 의무·spec SoT 상호참조·유저
가이드·i18n·CHANGELOG·plan 트래커까지 전 층이 정확히 대응한다.

## 위험도

NONE
