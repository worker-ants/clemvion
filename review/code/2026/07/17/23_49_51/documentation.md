# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 테스트 파일 내 fail-open 에러 메시지가 확장된 config 형태를 반영하지 못함(오래된 리터럴)
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:67`
  - 상세: `mergedRules` 가 비어 있을 때(가드 블록을 못 찾은 fail-open 상태) 던지는 에러 메시지가
    ```
    'eslint.config.mjs 에서 `files: ["src/lib/**"]` 레이어 가드 블록을 찾지 못했거나 병합된 규칙이 ' + "비어 있습니다 ..."
    ```
    로 여전히 `files: ["src/lib/**"]` 만 언급한다. 이 PR 이후 실제 config 의 `files` 는
    `LOWER_LAYERS = ["src/lib/**", "src/types/**"]` 로 확장됐다. 블록 탐색 자체는 의도적으로
    `c.files.includes("src/lib/**")` 리터럴을 그대로 쓰므로(plan 문서가 "무손상" 이라고 명시한
    설계) 검증 로직은 깨지지 않지만, 이 에러 메시지 **텍스트**는 이제 config 의 현재 실제 모양을
    정확히 기술하지 못한다 — 향후 이 fail-open 에러가 실제로 발동했을 때 디버깅하는 사람에게
    "`src/lib/**` 만 있어야 정상" 이라는 잘못된 인상을 줄 수 있다. 이 파일은 바로 이 diff 에서
    편집된 파일이고, 이번 변경의 주제가 정확히 이 스코프 확장이라는 점에서 같은 PR 안에서
    갱신하기 좋은 대상이었다.
  - 제안: 메시지를 `` `files: ${JSON.stringify(LOWER_LAYERS)}` `` 형태로 파생시키거나, 적어도
    "`src/lib/**` 등 하위 계층" 처럼 배열이 확장될 수 있음을 반영하는 표현으로 바꾼다.

- **[INFO]** 동일 spec 문서 내에서 PR 번호 각주 보존 정책이 일관되지 않음
  - 위치: `spec/conventions/frontend-layering.md` §4 vs §4.1
  - 상세: 이번 diff 는 §4.1 의 "이 테스트가 고정하는 것 (전부 실제 mutation 으로 탐지 확인됨 —
    **PR #969**)" 에서 PR 번호를 제거했지만(`"...확인됨)"`), 바로 위 §4 본문의 "PR #969 에서
    `quasis[0].value.raw` 기반 selector 를 추가해 닫았다" 는 PR 번호를 그대로 남겼다. 정식 규약
    문서(`spec/conventions/`)에 PR 번호 같은 일회성 이력을 남길지 여부에 대한 판단이 같은 파일
    안에서 갈린 것으로 보인다. 기능적 문제는 아니며, 단지 규약 표기 스타일의 미세한 비일관.
  - 제안: PR 번호를 규약 본문에 남길지에 대한 방침을 정해 두 곳을 통일한다 (완전히 제거하거나,
    둘 다 유지).

## 확인된 양호 사항 (참고)

- `spec/conventions/frontend-layering.md` 의 rationale 수치(`src/types` 는 `transform.ts` 단일
  파일, `lib` 소비자 2 · `components` 소비자 5)를 실측 `grep` 으로 교차 검증한 결과 정확히 일치.
- `plan/in-progress/spec-draft-frontend-layering.md` → `plan/complete/` 이동 후 남은 상대링크
  (`plan/in-progress/spec-draft-frontend-layering.md`)에 대한 grep 결과 dead link 없음 — 자기
  참조를 포함해 문서 이동이 깔끔하게 처리됨.
- `eslint.config.mjs` 의 `LOWER_LAYERS` export, `rag-types.ts`, `conversation-utils.ts` 주석이
  모두 `spec/conventions/frontend-layering.md` 를 SoT 로 일관되게 가리키도록 갱신됐고, 코드
  주석·spec 본문·plan 결정 기록 3자가 서로 모순 없이 정합함.
- README/CHANGELOG 갱신 불필요 — 이 저장소는 정식 규약을 `spec/conventions/`에, 변경 이력을
  `plan/complete/`에 두는 것이 확립된 관례이며(CLAUDE.md), 이번 변경은 그 관례를 정확히 따름.
  frontend README 에는애초에 레이어링 규칙 언급이 없어 갱신 대상이 아님.

## 요약

이번 변경은 문서화 관점에서 전반적으로 매우 높은 완성도를 보인다 — ESLint config 의 스코프
확장(`src/lib/**` → `LOWER_LAYERS`)에 맞춰 코드 주석 3곳(`eslint.config.mjs`, `rag-types.ts`,
`conversation-utils.ts`)이 규약 문서를 가리키도록 일괄 정리됐고, `spec/conventions/
frontend-layering.md` 는 `partial → implemented` 승격과 함께 CI 강제 범위·rationale·테스트가
고정하는 항목을 정확하게 갱신했으며, `plan/complete/spec-draft-frontend-layering.md` 는 병렬
세션 간 충돌 처분 과정까지 포함해 결정 이력을 상세히 남겼다. 유일하게 발견된 흠은 새로 추가된
스코프 검증 스위트 바로 위에 있는 기존 fail-open 에러 메시지 하나가 옛 `files: ["src/lib/**"]`
리터럴을 그대로 인용해 이번 스코프 확장을 반영하지 못한 것(WARNING)과, spec 본문 내 PR 번호
각주 보존 여부가 §4/§4.1 사이에서 미세하게 갈리는 점(INFO) 뿐이다. 둘 다 차단 사유는 아니다.

## 위험도

LOW
