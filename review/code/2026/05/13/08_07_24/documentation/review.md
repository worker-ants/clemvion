## 발견사항

### 주석 정확성 · 인라인 주석

- **[WARNING]** `eslint-disable-next-line react-hooks/exhaustive-deps` 억제 근거 미설명
  - 위치: `profile-preferences-card.tsx` — `diff` useMemo의 마지막 줄
  - 상세: `themeLabel` / `localeLabel` 함수가 의존성 배열에서 빠진 이유가 없다. 두 함수가 `t` 에만 의존하고 `t` 는 배열에 포함되어 있으므로 억제가 기술적으로 안전하지만, 그것을 읽는 사람은 알 수 없다. CLAUDE.md 규약 기준("WHY가 non-obvious한 경우에만 주석")으로도 이 케이스는 주석이 정당화된다.
  - 제안: `// themeLabel / localeLabel 은 t 에만 의존하며 t 는 deps 에 포함 — 추가 불필요` 한 줄 추가

- **[INFO]** `useEffect` 격리 설명 주석은 적절함 (`profile/page.tsx` + `profile-preferences-card.tsx`)
  - 위치: `profile/page.tsx:45–48`, `profile-preferences-card.tsx:54–57`
  - 상세: "첫 로드 시 동기화 / edit 모드 도중 덮어쓰지 않는다" 등 non-obvious 인과를 한 줄로 정확히 기록. 프로젝트 규약에 부합.

---

### 중복 유틸리티 미문서화

- **[WARNING]** `axiosMessage` 헬퍼가 3개 파일에 복사되어 있고, 공유 모듈이나 주석이 없다
  - 위치: `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx` 각각 동일 구현
  - 상세: 세 파일이 동기화 없이 독립 진화할 수 있다. 문서화 관점에서 "이것은 의도적 복사본" 혹은 "공유 유틸 위치는 …" 라는 단서가 어디에도 없어, 미래 개발자가 한 곳만 수정하고 나머지를 놓칠 위험이 있다.
  - 제안: 단기적으로는 최소한 plan 또는 코드 inline에 `// @see lib/http-error — 추출 예정` 같은 포인터를 달거나, 다음 리팩토링 phase 항목으로 plan에 추가.

---

### Plan 문서 상태

- **[INFO]** `plan/in-progress/profile-safer-edit.md` Phase 3 체크리스트 미완
  - 위치: Phase 3 전체 (`[ ]` 5개)
  - 상세: 구현(Phase 2)은 완료 표시됐으나 typecheck/lint/e2e/수동 확인이 미완 상태. 이 자체는 정상(in-progress plan)이지만, spec 문서는 이미 최종 상태로 개정돼 있어 "spec = 완료, 구현 검증 = 미완"의 간극이 보인다. 문서만 읽으면 기능이 완성된 것처럼 보일 수 있다.
  - 제안: plan에 "Phase 3 미완 — spec 은 목표 설계 기준으로 선갱신됨" 한 줄 명시하거나, Phase 3 완료 후 `git mv → complete/` 로 이동.

---

### Spec 문서 품질

- **[INFO]** `spec/2-navigation/9-user-profile.md` — Rationale 섹션 충실
  - 위치: 파일 끝 `## Rationale`
  - 상세: footgun 원인, 폐기된 대안 3종, 선택 근거가 구체적으로 기록됨. 프로젝트 규약("결정의 배경·폐기된 대안")을 충실히 이행.

- **[INFO]** `_layout.md` 팝업 메뉴 항목 설명에 spec 내부 링크 포함
  - 위치: `_layout.md` line 101
  - 상세: `[User Profile spec §2](./9-user-profile.md#2-내-프로필-화면)` 앵커가 spec 한글 헤딩과 일치하는지 확인 필요. 마크다운 앵커는 공백→하이픈 변환 규칙을 따르므로 `#2-내-프로필-화면` 이 실제 렌더된 앵커와 다를 수 있다.
  - 제안: GitHub/렌더러에서 앵커 동작 검증.

---

### i18n 딕셔너리

- **[INFO]** `en.ts`의 `changePasswordCardCta` 값에 화살표 문자(`→`) 하드코딩
  - 위치: `en.ts:315`, `ko.ts:315`
  - 상세: 두 언어 모두 동일하게 `→` 기호를 값에 포함. 디자인 변경 시 번역 키를 수정해야 한다는 점이 직관적이지 않다. 문서나 주석은 없으나, 이 정도는 프로젝트 규약(no comments) 범위 내.
  - 제안: 필요 시 아이콘을 JSX 레벨에서 처리하거나 그대로 유지. 현재는 INFO 수준.

---

## 요약

전반적으로 문서화 품질은 양호하다. Spec 문서(`9-user-profile.md`)의 Rationale 섹션이 충실하고, plan 문서가 의사결정 이력을 정확히 추적하며, non-obvious 동작(useEffect 격리, 라이브 프리뷰 원복)에는 적절한 주석이 달려 있다. 가장 실질적인 문서화 결함은 `axiosMessage` 의 3중 복사(공유 모듈 부재 + 위치 포인터 없음)와 `eslint-disable` 억제 이유 미기재 두 가지다. 전자는 미래 유지보수에서 일부 파일만 수정되는 silent drift 위험이 있고, 후자는 프로젝트 자체 규약("WHY가 non-obvious")에 따라 주석이 정당화되는 케이스를 놓친 것이다.

## 위험도

**LOW**