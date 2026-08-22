# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 추출 과정에서 주석 문구 1곳이 바뀌었다 — 리팩터에 필요한 변경으로 판단
- 위치: `codebase/backend/src/modules/executions/executions.service.ts:559` (`resolveManualOverrideInput` 내부 주석)
- 상세: 원래 `reRun` 인라인 블록의 주석 "검사 시점(raw 우선)은 **이 함수**가 소유한다"가, 추출된 `resolveManualOverrideInput`
  안에서는 "검사 시점(raw 우선)은 **그 wrapper**가 소유한다"로 한 단어 바뀌었다. 로직·에러 코드·응답 봉투는
  diff 상 완전히 동일(정본 plan 이 명시한 "한 글자도 바꾸지 않는다"는 요건은 코드 동작 기준으로는 지켜짐)하고,
  이 문구 변경은 주어("이 함수")가 코드 이동으로 더 이상 정확하지 않게 된 것을 바로잡은 것이라 추출 자체가
  요구하는 필연적 동반 수정이다. 범위 위반이 아니라 참고로 남긴다.
- 제안: 조치 불요.

### [INFO] 앞선 완료 plan(`masked-marker-test-gaps`)의 `complete/` 이동이 이번 PR에 번들됐다 — plan 문서가 근거를 명시
- 위치: `plan/complete/masked-marker-test-gaps.md`(신규) / `plan/in-progress/masked-marker-test-gaps.md`(삭제) /
  `plan/in-progress/rerun-input-resolution-extract.md` `## 함께 처리 — 앞 PR 의 plan 이동` 절
- 상세: 이번 PR 의 핵심 의도는 `reRun` 입력 해석 블록 추출(`rerun-input-resolution-extract` plan) 하나인데,
  별개로 이미 완료된 다른 작업(`masked-marker-test-gaps`, PR #1196 로 종결)의 plan 파일 이동과 잔여 체크박스
  2개 갱신도 같은 diff 에 포함돼 있다. 다만 이는 우연한 혼입이 아니라 `rerun-input-resolution-extract.md` 본문이
  `.claude/docs/plan-lifecycle.md §3`("이동만 담은 별 PR 분리 금지")를 근거로 명시적으로 예고·정당화한 번들링이고,
  이동 대상 파일의 실제 diff(체크박스 `[ ]`→`[x]`, `status: in-progress`→`complete`, `worktree` 필드 등)도 그
  설명과 정확히 일치한다. 코드(`codebase/**`) 변경은 전혀 섞이지 않았다.
- 제안: 조치 불요 — 정책에 부합하는 의도적 번들링이며 문서화도 충분하다.

### [INFO] 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 신규 백로그 항목이 추가됨 — 코드 변경 없는 기록성 수정
- 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (401 코드 drift 관련 신규 체크박스,
  `13-replay-rerun.md §8.1·§8.2` 언급 항목)
- 상세: `/consistency-check --impl-prep` 이 발견한 WARNING(`13-replay-rerun.md` 의 401 코드가 `AUTH_REQUIRED` 대신
  `UNAUTHORIZED` 로 잘못 적혀 있음)을 스스로 고치지 않고 트래커에 새 백로그 항목으로만 등재했다. 문서 본문이
  "spec/ 편집은 developer 권한 밖(CLAUDE.md 역할 표)"이라는 이유를 명시하며 즉시 수정하지 않은 근거를 밝혀
  두었다 — 실제 코드/스펙 변경이 아니라 추적 기록 추가이므로 이번 PR 의 실질 범위(코드 리팩터)를 벗어나지 않는다.
- 제안: 조치 불요.

## 요약
핵심 코드 변경(`executions.service.ts`)은 plan(`rerun-input-resolution-extract.md`)이 예고한 그대로 — `reRun` 의
입력 해석 40줄 블록을 `resolveManualOverrideInput` private 메서드로 순수 추출한 것뿐이며, 에러 코드·응답 봉투 필드·
검증 순서 등 동작은 diff 상 완전히 보존된다. 새 임포트·불필요한 포맷팅·기능 확장·무관한 코드 영역 수정은 없다.
함께 커밋된 plan/review 문서 변경(테스트 갭 plan 의 `complete/` 이동, 신규 plan 생성, 트래커 갱신, consistency-check
산출물)은 모두 개별 plan 문서 안에서 그 포함 근거(plan-lifecycle §3 의 "이동 전용 PR 분리 금지" 등)를 명시적으로
설명하고 있어 은폐된 스코프 확장이 아니라 문서화된 의도적 동반 처리다. 발견된 항목은 전부 INFO 수준으로,
착수/머지를 막을 사유가 없다.

## 위험도
NONE
