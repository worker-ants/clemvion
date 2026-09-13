# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인 — 직전 라운드(`14_41_14`) WARNING 재검증

`review/code/2026/09/13/14_41_14/maintainability.md` 가 지적한 두 WARNING 을 소스를 직접
`Read`/`grep` 하여 재검증했다. 둘 다 `RESOLUTION.md` 가 주장한 대로 실제로 고쳐져 있다:

- `guide-sanitized-message-parity.test.ts:16` 의 "자매" 참조 — 이제
  `` 자매 `guide-identifier-existence.test.ts`(`#1330` 당시 `guide-error-code-existence.test.ts`) ``
  로 갱신돼 있다(신규 이름 + 구 이름 각주 병기). `grep -rn "guide-error-code" codebase/ CHANGELOG.md PROJECT.md spec/`
  로 저장소 전체를 재확인한 결과 남은 3건은 전부 의도된 역사 서술(`guide-identifier-scan.ts:9`,
  같은 파일의 §16, `CHANGELOG.md:77`)뿐이다.
- `composeTexts` 필터 — `guide-identifier-existence.test.ts:53-56` 이
  `/^docker-compose.*\.ya?ml$/` 로 좁혀져 있다. 확장자만 보던 이전 판(루트의 모든
  `.yml`/`.yaml`, `pnpm-lock.yaml` 784KB 포함)과 달리 이제 파일명까지 판별하며, 주석이
  "이름과 JSDoc 이 약속한 범위보다 구현이 넓었다" 는 경위를 직접 남겨 재발을 막는다.

이 두 항목은 재-flag 하지 않는다.

## 발견사항

- **[INFO]** `guide-identifier-scan.ts` 내부에 "정규식 `lastIndex` 리셋 → `exec` 루프 →
  `Set`/배열에 적재" 패턴이 한 파일 안에서 4회 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:139-145`
    (`scanIdentifierCitations` 내부 `push` 헬퍼), `:162-172`(`collectSourceTokens`),
    `:196-204`·`:205-212`(`collectEnvDeclarations` 의 두 루프)
  - 상세: 네 곳 모두 `rx.lastIndex = 0` → `while ((m = rx.exec(text)) !== null)` → 토큰
    추가라는 동일한 3줄짜리 뼈대를 손으로 반복한다. 공유 헬퍼(예:
    `function matchAll(text: string, rx: RegExp): string[]`)로 뽑으면 축이 하나 더
    늘 때(이 PR 자체가 "축이 하나 더 필요해졌다"는 이력을 막 반복했다) `lastIndex` 리셋을
    깜빡하는 복붙 실수 여지가 줄어든다. 다만 이 뼈대는 이 폴더의 기존 관례이기도 하다 —
    `impl-anchor-parse.ts:34,39`, `spec-links.ts:213`, `no-internal-refs.test.ts:105` 도
    같은 패턴을 각자 반복한다. 즉 이번 파일만 국소적으로 추출하면 형제 파일들과 스타일이
    갈리므로, 이번 diff 가 새로 만든 결함이 아니라 저장소 전반이 안고 있는 기존 중복이다.
  - 제안: 지금 당장 조치 불요. 이 폴더에 가드가 더 늘거나 이 패턴이 5회를 넘으면
    `tree-walk.ts` 근처에 공유 `matchAll` 유틸을 만들어 이 폴더 전체가 함께 옮겨가는 것을
    검토할 지점으로 기록.

- **[INFO]** 같은 설계 근거(`#1330` 축별 실측표·"허용목록 없음" 번복 서사)가 소스 헤더
  주석·테스트 JSDoc·plan 문서 세 곳에 거의 축약 없이 반복된다 — 이미 알려진 관찰
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-52`(헤더),
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:18-27`(JSDoc),
    `plan/in-progress/guide-identifier-existence.md` §A~B
  - 상세: 직전 라운드 maintainability INFO 로 이미 같은 지점이 지적됐고("조치 불요 — 다음
    설계 변경 때 코드 헤더를 SoT 로 두고 나머지는 가리키기만 하는 방향 권고") `RESOLUTION.md`
    에는 이 항목에 대한 명시적 처분 행이 보이지 않는다(다른 INFO 로 흡수되지 않았다). 재확인
    결과 세 곳 모두 여전히 표·서사가 거의 그대로 복제돼 있다 — 이번 PR 이 새로 만든 결함은
    아니고 상태 변화도 없다.
  - 제안: 이번 라운드에서 조치 불요. 다음에 이 가드 가족의 설계를 다시 바꿀 때만 코드
    헤더 단일화를 고려.

## 요약

핵심 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`, 총
214줄)은 함수마다 단일 책임·낮은 순환 복잡도·얕은 중첩을 유지하며, 매직 넘버는
`EXTERNAL_VOCABULARY_CAP = 5`처럼 이름 붙은 상수로, 테스트의 vacuity-floor 숫자들도 전부
"실측 N" 주석을 동반해 근거가 명시돼 있다. 네이밍(`GUIDE_EXTERNAL_VOCABULARY`, 축 라벨
`field-table`/`code-field`/`backtick`)은 목적이 분명하고 이 폴더의 기존 가드 파일들과
컨벤션이 일치한다. 직전 라운드가 지적한 두 WARNING(자매 파일의 죽은 참조, `composeTexts`
과다 수집 범위)은 소스를 직접 열어 확인한 결과 실제로 해소됐다. 남은 것은 사소한 두 INFO
뿐이다 — 파일 내 정규식-수집 뼈대의 4중 반복(단, 폴더 전체의 기존 관례라 이번 diff 의
신규 결함은 아님)과, 설계 근거 서사가 소스·테스트·plan 세 곳에 축약 없이 중복되는 것(이미
관찰됐고 조치 불요로 처분된 상태 유지). CRITICAL·WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
