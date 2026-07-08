# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 커밋 1개에 4개 작업항목(W1 real bug fix, W2 문서 정정, W5/W6 테스트 보강)이 번들됨
  - 위치: 커밋 `865e6b93` 전체
  - 상세: 커밋 메시지·`review/code/2026/07/09/08_18_37/RESOLUTION.md` 의 조치 항목 표에 W1/W2/W5/W6 이 모두 이 커밋으로 명시돼 있고, 이는 round-3 ai-review SUMMARY 에 대한 resolution-applier 성격의 fix 커밋이다. 프로젝트 컨벤션(`CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")상 리뷰 라운드의 Critical/Warning 항목을 같은 턴에 일괄 처리하는 것이 표준 워크플로이므로 scope violation 이 아니다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** `review/code/2026/07/08/18_24_41/RESOLUTION.md` (이전 라운드의 완료된 리뷰 산출물) 을 본 커밋에서 사후 수정
  - 위치: `review/code/2026/07/08/18_24_41/RESOLUTION.md` 마지막 bullet
  - 상세: "9 reviewer" → "9 중 7 산출(2건 disk-write 갭 재발)" 로 사실관계를 정정한 것으로, 이번 커밋의 핵심 의도(navigation 버그 수정)와 직접 관련은 없으나 커밋 메시지에 `docs(W2): round-1 RESOLUTION reviewer 커버리지 서술 정정`으로 명시적으로 예고돼 있고 round-3 RESOLUTION 표에도 W2 항목으로 등재돼 있다. 이미 종결된 과거 리뷰 문서를 사후에 고치는 것 자체는 이례적이지만, 사실 오류 정정이며 의사결정 내용 변경은 아니다.
  - 제안: 조치 불필요. 다만 향후에는 과거 라운드 문서를 직접 고치기보다 신규 RESOLUTION 에 정정 각주를 남기는 편이 이력 보존 측면에서 더 안전할 수 있음(경미한 제안, 차단 사유 아님).

- **[INFO]** `href.test.ts`: 기존 단일 `it` 케이스를 `it.each` 파라미터화 테스트로 구조 변경 + 케이스 3개(CR/LF/slug+CR) 추가
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` (기존 테스트 삭제 후 `it.each` 신설)
  - 상세: 단순 케이스 추가를 넘어 기존 테스트의 구조(단일 `it` → `it.each`)까지 바꿔 diff 가 "리팩토링+확장"처럼 보인다. 다만 커밋 메시지 `testing(W6): href 보안 회귀 it.each 분리 + CR/LF/slug+control-char 케이스`로 명시적으로 의도된 작업이며 round-3 RESOLUTION 표의 W6 항목과 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** W3(open-redirect 유틸 통합)·W4(순환 lint 강제) 는 의도적으로 본 커밋에서 제외되고 defer 로 기록됨
  - 위치: `review/code/2026/07/09/08_18_37/RESOLUTION.md` 조치 항목 표
  - 상세: 범위를 벗어나는 리팩토링(무관 파일 `error-page.tsx` 침범, 리포지토리 전역 lint 정책 변경)을 명시적 근거와 함께 defer 처리 — scope 규율이 잘 지켜진 사례.
  - 제안: 없음. 긍정적 신호로 기록.

핵심 수정(`rerun-modal.tsx`) 은 커밋 메시지가 서술한 real bug(bare path → `buildWorkspaceHref(slug, ...)`) 와 정확히 일치하고, 관련 회귀 테스트(`rerun-modal.test.tsx`)·JSDoc 갱신도 그 수정 범위 내에 있다. 무관한 임포트 추가/정리, 포맷팅 노이즈, 설정 파일 변경, 요청 밖 기능 확장은 발견되지 않았다.

## 요약
이번 커밋은 round-3 ai-review SUMMARY 의 W1(real bug)·W2(문서 정정)·W5/W6(테스트 보강) 조치 항목을 한 번에 반영한 resolution-applier 성격의 fix 커밋으로, 모든 변경이 커밋 메시지 및 동봉된 RESOLUTION.md 표와 1:1 대응한다. 여러 항목이 한 커밋에 번들됐지만 이는 프로젝트가 명시적으로 상시 승인한 "구현 완료 후 리뷰 라운드 fix 일괄 처리" 컨벤션에 해당하며, W3/W4 는 오히려 scope 밖으로 명시적 defer 처리돼 규율이 잘 지켜졌다. 무관한 리팩토링·기능 확장·포맷팅 노이즈·불필요한 임포트·설정 변경은 발견되지 않았다.

## 위험도
NONE
