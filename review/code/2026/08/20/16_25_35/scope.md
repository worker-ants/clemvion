STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 나열한 165개 파일 중 실 코드/문서 변경은 34개(`CHANGELOG.md`, backend 8개,
frontend 17개, `plan/in-progress/*.md` 3개, `spec/**` 7개 — 1274 insertions / 214
deletions)이고, 나머지 131개는 이 PR 의 리뷰 파이프라인이 같은 브랜치에 누적 생성한
`review/code/2026/08/20/**` · `review/consistency/2026/08/20/**` 세션 산출물이다. 후자는
diff 크기(≈10,653줄)의 대부분을 차지하지만 이 저장소는 `review/` 를 gitignore 하지 않고
검토 사이클 산출물을 그대로 커밋하는 관행을 유지한다(사용자 메모리·`CLAUDE.md` "코드 리뷰
산출물" 경로 규약과 일치, `RESOLUTION.md` 다회 라운드가 실제로 이 산출물을 참조한다) —
이 자체는 scope 위반이 아니라 이 저장소의 표준 워크플로다. 아래 발견사항은 34개 실 변경
파일에 집중했고, `git diff origin/main...HEAD` 로 프롬프트가 생략한 diff(backend
`executions.service.ts`, `rerun-modal.tsx`, `spec-sync-external-interaction-api-gaps.md` 등)를
직접 열어 대조했다.

## 발견사항

없음.

- **의도 이상의 변경 / 무관한 수정**: 34개 실 변경 파일은 전부 단일 결정("`Execution.inputData`
  egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳에 마커 가드")의 직접 산물이거나 그 결정이
  프로젝트 관행상 SoT 로 미러돼야 하는 자리(spec 7곳, i18n dict 4곳, 유저 가이드 MDX 4곳)다.
  코드 영역을 벗어난 수정(예: 인증·노드 핸들러·다른 모듈)은 `git diff --stat` 전수 확인 결과
  전무하다.
- **불필요한 리팩토링**: `MASKED_MARKERS`/`isMaskedMarker`가 `dynamic-form-ui.tsx` 에서
  `lib/utils/masked-markers.ts` 로 승격된 것과, `rerun-modal.tsx` 안에 `isStructuredType` 헬퍼가
  새로 추출된 것 두 곳이 "리팩토링"으로 보일 수 있으나, 둘 다 이번 PR 이 만드는 신규 소비처
  때문에 **직접 필요**해진 것이다(전자: 소비처가 셋이 되며 모달·툴바가 폼 컴포넌트를 import해야
  하는 순환 의존 회피; 후자: `displayValue`/`coerceInput`/차단 판정 세 곳이 같은 "object 또는
  array" 술어를 공유해야 하는 문제를 리뷰 라운드가 실제로 지적한 뒤 도입됨, 코드 주석에 근거
  명시). 동작 무변화 순수 리팩터는 diff 에 없다.
- **기능 확장(over-engineering)**: `blockedByMaskedInput` 판정이 "값 비었는가" → "터치했는가"
  → "터치 AND 마커없음" → "터치 AND 마커없음 AND 구조타입 coerce 성공" 으로 3라운드에 걸쳐
  조건이 늘었지만, 각 조건은 리뷰가 실제로 재현한 우회 경로에 대응하는 방어이지 요청 범위를
  넘는 신규 기능이 아니다(캐너리 테스트로 각 조건의 필요성이 개별 고정돼 있음, `rerun-modal.tsx`
  JSDoc 표 참조). 백로그로 등재만 하고 이번 PR 에서 손대지 않은 항목(마스킹 게이트 4곳 통합
  헬퍼·서버측 마커 리터럴 거부·차단 판정 순수 함수 추출)은 `spec-sync-external-interaction-api-gaps.md`
  트래커에만 기록되고 코드에는 반영되지 않아, over-engineering 유혹을 스스로 자제한 흔적으로
  보인다.
- **포맷팅/주석/임포트 변경**: 별도의 무의미한 공백·줄바꿈 변경은 diff 에서 발견되지 않았다.
  주석 변경은 전부 이번 정책 반전을 서술하는 데 필요한 내용이며(예: `MASKED_INPUT_DATA_REASON`
  JSDoc 앵커 삭제는 그 앵커가 정당화하던 결정 자체가 폐기됐기 때문에 자연스러운 부수효과),
  임포트 변경(`@/lib/utils/masked-markers` 신규 import 4곳)도 코드가 실제로 사용하는 함수에
  대응한다 — 미사용 임포트나 불필요한 정리는 없다.
- **설정 변경**: `.claude/config/**`, `package.json`, CI 워크플로, lint/tsconfig 등 설정 파일은
  이번 diff 에 포함되지 않았다.

## 요약

핵심 변경(34개 파일, 1274줄)은 "`Execution.inputData` egress 마스킹 카브아웃 폐지"라는 단일
목표에 정확히 수렴한다 — backend 마스킹 관문 확장, frontend 3개 소비처(폼 프리필/Re-run
모달/에디터 히스토리 로드) 마커 가드, 그리고 그 결정이 문서화 관행상 미러돼야 하는 spec 7곳·
i18n 4곳·유저 가이드 4곳 갱신까지 전부 같은 결정의 필연적 파급이다. 겉보기엔 "리팩토링"으로
읽힐 수 있는 두 지점(마커 유틸 lib 승격, `isStructuredType` 추출)도 신규 소비처가 만드는 실제
필요에 의한 것이며 근거가 코드 주석에 명시돼 있다. 나머지 131개 파일은 `review/**` 세션
산출물로, 이 저장소가 리뷰 사이클을 git 이력에 그대로 남기는 표준 관행에 해당해 scope 위반이
아니다. 범위 이탈·불필요한 확장·무관한 수정 어느 항목에서도 지적할 사항을 찾지 못했다.

## 위험도

NONE
