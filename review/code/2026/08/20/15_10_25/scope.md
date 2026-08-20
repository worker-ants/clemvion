# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 검토 방법

프롬프트가 크기 제한으로 다수 파일의 diff 를 생략했으므로, `git diff origin/main...HEAD`
(101 파일, +5635/-203)로 전체를 직접 대조하고 핵심 코드 파일(`executions.service.ts`,
`executions.service.spec.ts`, `rerun-modal.tsx`, `editor-toolbar-run-input.test.tsx`)은
전문을 읽었다. 이번 라운드는 직전 코드 리뷰(`14_08_45`→`14_44_08`)의 fix 커밋
(`b0d841923`, `29d00021d`)까지 포함한 누적 changeset이며, 그 두 라운드에도 이미 동일 관점의
`scope.md`가 존재해(파일 50, 위험도 NONE 요약) 그 결론이 이번 fix 커밋 이후에도 유지되는지
재검증하는 데 집중했다.

또한 `git log origin/main -3`으로 `c9cc2a923`/`89a816ab9`/`82a967afb`(token 계열 마스킹,
#1181/#1186/#1187)이 이미 `origin/main`에 머지돼 있음을 확인했다 — 이번 changeset의
diff에는 포함되지 않으므로 별개 PR이고, 이번 리뷰의 스코프 판단에서 제외했다.

## 발견사항

이번 changeset은 `plan/in-progress/eia-inputdata-marker-guard.md`가 명시한 단일 목표 —
*"`Execution.inputData` egress 마스킹 카브아웃 폐지, 재제출 소비처(Re-run 모달·에디터
히스토리 로드) 마커 가드 신설"* — 에서 벗어나는 항목을 찾지 못했다.

- **backend 6개 파일**(`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/
  `.spec.ts`, 두 DTO): `MASKED_INPUT_DATA_REASON` 앵커 JSDoc 통째 삭제 + `Execution.inputData`
  를 `redactStoredDataForResponse` 관문 3곳(`toResponseExecution`/`toExecutionDto`/`stop`의
  `...rest` 스프레드)에 편입 + 캐너리 방향 반전(`①②⑧⑧-b`) + 주석/Swagger 문구 갱신. 실제
  diff(`executions.service.ts`)를 직접 읽어 대조한 결과 삭제된 44줄짜리 JSDoc 블록·
  `ResponseExecution` 타입의 `Omit`/필드 추가·세 관문 모두 이 전환 하나로 수렴하며, 무관한
  로직 변경은 없었다.
- **frontend 소비처 3곳**(`rerun-modal.tsx`의 `splitMaskedParameters`/`touchedMaskedKeys`/
  `blockedByMaskedInput`, `editor-toolbar.tsx`의 `hasMaskedMarkerLeaf` 검사,
  `dynamic-form-ui.tsx`→`lib/utils/masked-markers.ts` 정본 승격): `rerun-modal.tsx` 전문을
  읽어 대조한 결과 새로 추가된 코드(마커 감지·차단 판정 두 조건의 합)는 전부 이 PR이 막으려는
  "왕복 오염" 방지 목적에 직접 종속되고, 판정 로직 외의 리팩터링은 없다.
- **신규 테스트**(`editor-toolbar-run-input.test.tsx` +93줄, `rerun-modal.test.tsx` +179줄,
  `masked-markers.test.ts` 신규): 전문을 읽어 확인한 결과 전부 이번 가드 로직(중첩 leaf 검사,
  실제 유입 경로 `getById→JSON.stringify→setJsonInput`, 오탐 경계 캐너리)만 검증하며, 무관한
  스냅샷·포맷팅 변경은 없다.
- **i18n 문자열 4개**(`en`/`ko` × `editor.ts`/`history.ts`): 신규 차단 UX에 필요한 키
  (`runWithInputMasked`, `maskedInputBlocked`)만 ko/en 동시 추가.
- **유저 가이드 mdx 4파일**: 직전 코드 리뷰 라운드의 `user_guide_sync` WARNING(신규 차단 UX가
  가이드에 미반영)을 반영한 것으로, RESOLUTION.md의 처분과 정확히 일치.
- **spec 7개 파일**: consistency 리뷰(`12_08_46`/`12_58_14`)가 지목한 미러 문서 전수를
  갱신 — 새로운 결정을 추가한 것이 아니라 §R17이 이미 "닫는 조건"으로 적어 둔 상태를 문서
  전반에 반영한 것.
- **plan 3개 + review 45개 파일**: `plan/in-progress/*.md` 신설·갱신과
  `review/code/2026/08/20/{14_08_45,14_44_08}/**`, `review/consistency/2026/08/20/{12_08_46,
  12_29_59,12_41_29,12_58_14,14_44_42}/**`는 이 작업의 실제 리뷰·consistency-check 라운드
  산출물이다. 본 저장소 CLAUDE.md는 코드 리뷰·일관성 검토 산출물을 `review/**`에 커밋하는
  것을 정식 워크플로로 규정하며, developer는 `review/**/RESOLUTION.md`에 쓰기 권한이 있다.
  따라서 이 파일들은 "의도 이상의 변경"이 아니라 진행된 리뷰 프로세스의 필수 기록이다.
- **CHANGELOG.md**: 자매 커밋들이 남긴 `## Unreleased — …` 관례를 그대로 따른 항목 1개 추가.

특기할 만한 "범위 이탈 후보"를 개별 점검했으나 전부 정당화됐다:

- `dynamic-form-ui.tsx`에서 `MASKED_MARKERS`/`isMaskedMarker`를 통째로 들어낸 것은 포맷팅이
  섞인 드라이브바이 리팩터가 아니라 함수 전체를 `lib/utils/masked-markers.ts`로 옮긴 것 —
  plan이 "소비처가 셋이 되면서 모달·툴바가 무관한 폼 컴포넌트를 import해야 하는 의존 방향이
  생긴다"고 명시적으로 근거를 적어 둔 리로케이션이다.
- `sanitize-error-message.ts`의 프런트 미러 위치 주석은 옛 경로(`dynamic-form-ui.tsx`)가
  아니라 새 경로(`lib/utils/masked-markers.ts`)를 정확히 가리키도록 갱신돼 있음을 직접
  확인했다 — `14_44_42` consistency 라운드가 지적했던 stale 참조가 이번 최종 diff에는 이미
  반영돼 있다.
- `rerun-modal.tsx`의 `touchedMaskedKeys`/`blockedByMaskedInput` 두 판정을 **합**으로 요구하는
  구조는 리뷰 라운드가 잡은 두 개별 우회(값-기반 우회, 건드림-기반 영구 해제)를 각각 막기
  위한 필수 변경이며, 과잉설계(over-engineering)가 아니라 두 CRITICAL/WARNING의 직접 후속
  조치다.
- 임포트·설정 파일(`package.json`, `tsconfig*`, `.claude/config/**` 등) 변경은 diff에 없음.

## 요약

`git diff origin/main...HEAD` 101개 파일 전부를 대조하고 핵심 코드·테스트 파일은 전문을
읽은 결과, 이번 changeset은 plan 문서가 명시한 단일 목표(`Execution.inputData` egress
마스킹 카브아웃 폐지 + 재제출 소비처 마커 가드)로 수렴한다. backend/frontend 코드 변경은
전부 그 목표에 직접 종속되고, 마커 유틸 승격은 명시된 구조적 필요에 의한 것이며 잔여
드라이브바이 리팩터·불필요한 포맷팅·무관한 주석/임포트 변경은 발견되지 않았다. 유저
가이드·spec 문서 갱신은 같은 changeset 안의 선행 리뷰 라운드가 지적한 갭을 메운 것이고,
plan/review 디렉터리의 다수 파일은 이 저장소가 정식 워크플로로 규정한 리뷰 산출물 커밋
관행이다. 이전 라운드(`14_44_08`)의 scope 리뷰가 지적했던 stale 주석(옛 파일 경로 인용)도
이번 최종 diff에서는 이미 해소되어 있음을 확인했다. 요청 범위를 벗어난 리팩토링·기능
확장·무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
