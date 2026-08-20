STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `git diff origin/main...HEAD` 기준 143개 파일, 5개 커밋(`7da315c10` spec →
`37da9b593` feat → `b0d841923`/`29d00021d`/`38b4669bd` fix(review) 3라운드)으로 구성된다.
단일 목적: **`Execution.inputData` egress 마스킹 카브아웃 폐지** — 재제출 소비처 3곳(폼
프리필·Re-run 모달·에디터 히스토리 로드)에 마커 가드를 세워 조건부 예외를 닫는 작업. 실제
diff(`git diff origin/main...HEAD --stat`)를 프롬프트의 파일 목록과 대조해 전량 확인했다.

## 발견사항

없음. 아래는 판단 근거다.

### 확인한 것 — 범위 이탈 없음

- **핵심 구현** (`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`,
  `execution-response.dto.ts`, `background-run-response.dto.ts`): `MASKED_INPUT_DATA_REASON`
  JSDoc 앵커 삭제 + 세 관문(`toResponseExecution`/`toExecutionDto`/노드 레벨 루프)에 마스킹
  추가. 삭제·추가가 모두 카브아웃 폐지라는 단일 결정에 정확히 대응한다. `git diff` 전문을 직접
  읽어 확인 — 무관한 로직 변경 없음.
- **프런트 가드 3곳** (`rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`): CHANGELOG
  가 서술한 "스칼라는 비우고 차단 / object·array 는 값 보존하고 제출만 차단" 두 형태, "터치 AND
  마커-없음" 두 조건의 합 판정이 코드에 그대로 구현돼 있고 각 결정 옆에 JSDoc 근거(왜 단일
  조건으로는 부족한가, 이전 라운드 WARNING 번호 인용)가 붙어 있다 — 리뷰 라운드 4회에 걸쳐
  좁혀진 이력이 코드 안에 남아 있을 뿐, 요청 범위 밖 로직은 없다.
- **`lib/utils/masked-markers.ts` 신설 (리팩터)**: `dynamic-form-ui.tsx` 안에 있던
  `MASKED_MARKERS`/`isMaskedMarker` 를 공용 모듈로 승격하고 `hasMaskedMarkerLeaf` 를 추가.
  "불필요한 리팩토링"으로 볼 여지가 있어 별도로 검토했으나 — 이번 작업으로 소비처가 1곳(폼)에서
  3곳(폼·모달·툴바)으로 늘면서 모달·툴바가 무관한 폼 UI 컴포넌트를 import 해야 하는 의존
  방향이 실제로 생겼다. 리팩터 사유가 이번 PR 이 만든 필요와 직접 인과관계이고, import 방향
  외 다른 코드는 그대로 이동만 했다(`git diff` 상 로직 변경 없이 파일 이동 + export 추가만
  확인). 범위 이탈로 보지 않는다.
- **i18n 키 4곳(`editor.ts`/`history.ts` × ko/en)**: 신규 안내 문구 2종(`runWithInputMasked`,
  `maskedInputBlocked`) 추가뿐, 기존 키 변경 없음.
- **유저 가이드 MDX 4파일(ko/en × run-results/running-a-workflow)**: 각 파일 1문장만 추가해
  새 UX(마스킹된 입력은 실제 값으로 바꿔야 실행 가능)를 반영 — 무관한 섹션 수정 없음.
- **spec 7개 문서** (`1-data-model.md`, `3-execution.md`, `12-background.md`, `12-webhook.md`,
  `13-replay-rerun.md`, `14-external-interaction-api.md`, `6-websocket-protocol.md`): 전부
  "카브아웃이 SoT 로 미러돼 있던 6개 문서를 함께 뒤집었다"는 CHANGELOG 서술과 정확히 대응하는
  문구 반전. 무관한 spec 섹션 변경 없음.
- **`review/code/**`, `review/consistency/**` (다수)**: 이 PR 진행 중 실행된 4라운드
  code-review + 6라운드 consistency-check 산출물이다. 이 저장소 관례상 리뷰 산출물은 커밋되어
  PR 이력에 남는다(선행 PR 들에서도 동일 패턴, 예: `#1178`~`#1187`) — CLAUDE.md 의 "코드 리뷰
  산출물 → `review/code/<...>/`" 규약과 일치하며, 이번 작업만의 이례적 포함이 아니다. 범위
  이탈로 보지 않는다.
- **`plan/in-progress/*.md` 3개**: 작업 추적 문서(`eia-inputdata-marker-guard.md` 신설,
  `spec-draft-inputdata-egress-masking.md` 신설, `spec-sync-external-interaction-api-gaps.md`
  체크박스 갱신 + 후속 트래커 3건 등재) — 정상적인 plan 라이프사이클 갱신이다.
- **CHANGELOG.md**: 최상단에 신규 `## Unreleased` 절 1개만 추가하고, 기존 `token` 계열 절
  본문은 건드리지 않은 채 구 `inputData` 절에 caveat blockquote 하나만 삽입했다(과거 서술을
  삭제·재작성하지 않고 "이 시점까지의 결정" 이라고 명시). 무관한 항목 rewrite 없음.

### 무관한 파일·설정·임포트 변경 여부

`package.json`/lockfile/CI 설정/lint 설정 등 인프라·설정 파일 변경은 diff 에 없다(`git diff
origin/main...HEAD --stat` 전체 143개 파일이 모두 위 카테고리 안에 든다). 사용하지 않는
import 추가나 무관한 import 정리도 발견되지 않았다 — `dynamic-form-ui.test.tsx` 의 import
변경(`MASKED_MARKERS` 를 `../dynamic-form-ui` 대신 `@/lib/utils/masked-markers` 에서 가져옴)
도 위 리팩터에 종속된 필수 변경이다.

## 요약

143개 파일이라는 규모는 크지만, 실제로 세어보면 (1) 핵심 구현 변경은 소수 파일에 집중돼 있고,
(2) 대부분의 볼륨은 이 작업 자체가 만든 4라운드 code-review + 6라운드 consistency-check 산출물
및 카브아웃 서술이 미러돼 있던 spec 7문서·JSDoc 여러 자리의 "같은 결론을 반복 반영"이며,
(3) 유일하게 "리팩토링"으로 분류될 수 있는 `masked-markers.ts` 승격도 이번 작업이 만든 새
의존 방향(소비처 1→3곳)에 대한 직접 대응이다. `git diff origin/main...HEAD --stat` 로 전체
파일 목록을 실측하고 핵심 diff 를 직접 읽어 대조한 결과, 의도 이상의 변경·무관한 파일 수정·
요청하지 않은 기능 확장·의미 없는 포맷팅 뒤섞임은 발견하지 못했다.

## 위험도

NONE
