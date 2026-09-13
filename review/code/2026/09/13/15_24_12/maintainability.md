# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인 — 이전 라운드(`14_41_14`·`15_03_06`) WARNING 재검증

두 차례 이전 라운드가 잡은 WARNING 2건을 소스를 직접 `Read`/`grep` 해서 독립적으로 재확인했다.
둘 다 실제로 해소돼 있다:

- `guide-sanitized-message-parity.test.ts:16` 의 "자매" 참조 — 이제 신규 파일명
  `` guide-identifier-existence.test.ts `` + 구 파일명 각주(``#1330` 당시`) 병기로 갱신돼 있다.
  `grep -rn "guide-error-code" codebase/ CHANGELOG.md PROJECT.md spec/` 로 저장소 전체를
  재확인한 결과 남은 3건(`guide-sanitized-message-parity.test.ts:16`, `guide-identifier-scan.ts:9`,
  `CHANGELOG.md:77`) 전부 `#1330` 을 가리키는 의도된 역사 서술이며, 존재하지 않는 파일을
  가리키는 죽은 참조는 0건이다.
- `composeTexts` 필터 — `guide-identifier-existence.test.ts:55-58` 이
  `/^docker-compose.*\.ya?ml$/` 로 좁혀져 있다. 확장자만 보던 이전 판(루트의 모든
  `.yml`/`.yaml`, `pnpm-lock.yaml` 784KB 포함)과 달리 파일명까지 판별하며, 주석
  (`:50-54`)이 "이름과 JSDoc 이 약속한 범위보다 구현이 넓었다"는 경위를 직접 남겨 재발을
  막는다.

두 항목은 재-flag 하지 않는다.

## 발견사항

- **[INFO]** `guide-identifier-scan.ts` 내부에 "정규식 `lastIndex` 리셋 → `exec` 루프 →
  `Set`/배열 적재" 패턴이 한 파일 안에서 4회 손으로 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:139-148`
    (`scanIdentifierCitations` 내부 `push` 헬퍼) · `:163-171`(`collectSourceTokens`) ·
    `:197-203`·`:205-211`(`collectEnvDeclarations` 의 두 루프)
  - 상세: 네 곳 모두 `rx.lastIndex = 0` → `while ((m = rx.exec(text)) !== null)` → 토큰
    추가라는 동일한 3줄 뼈대를 반복한다. 공유 헬퍼(`function matchAll(text, rx): string[]`)로
    뽑으면 축이 하나 더 늘 때(이 PR 자체가 "축이 하나 더 필요해졌다"는 이력을 방금 반복했다)
    `lastIndex` 리셋을 빠뜨리는 복붙 실수 여지가 줄어든다. 다만 같은 뼈대가 이 폴더의 다른
    가드(`impl-anchor-parse.ts`, `spec-links.ts`, `no-internal-refs.test.ts`)에도 각자
    반복돼 있어, 이 파일만 국소적으로 추출하면 형제 파일들과 스타일이 갈린다 — 이번 diff 가
    새로 만든 결함이 아니라 폴더 전반의 기존 관례다.
  - 제안: 이번 PR 범위에서 조치 불요. 이 폴더에 가드가 더 늘거나 반복이 5회를 넘으면
    `tree-walk.ts` 근처에 공유 `matchAll` 유틸을 두고 폴더 전체가 함께 옮겨가는 것을 검토할
    지점으로 기록.

- **[INFO]** 같은 설계 근거(`#1330` 축별 실측표 · "허용목록 없음" 번복 서사)가 소스 헤더
  주석 · 테스트 JSDoc · plan 문서 세 곳에 축약 없이 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-76`(헤더 주석) ·
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:18-27`(JSDoc) ·
    `plan/in-progress/guide-identifier-existence.md` §A~C
  - 상세: 이번 PR 이 겪은 실제 비용이 그 값을 보여준다 — 파일명 하나를 바꾸는 데
    `PROJECT.md` · `CHANGELOG.md` · plan · 트래커 등 다수 지점을 손으로 동기화해야 했다.
    세 군데로 나뉜 동일 서사는 다음에 이 가드 계열의 설계(축·허용목록)가 또 바뀔 때 드리프트
    위험을 키운다. 다만 이 프로젝트가 "왜"를 코드에 남기는 관례를 지키는 것 자체는 일관되고,
    이전 두 라운드도 이미 같은 지점을 INFO 로 지적한 뒤 조치 불요로 처분한 상태다 — 이번
    라운드에서도 변화 없음을 재확인했을 뿐 새로운 악화는 없다.
  - 제안: 즉각 조치 불요. 다음에 이 가드 가족의 설계를 다시 바꿀 때는 "코드 헤더가 SoT,
    테스트 JSDoc·plan 은 그것을 가리키기만" 하는 방향으로 점차 정리할 것을 권한다.

- **[INFO]** `collectEnvDeclarations` 가 서로 다른 두 입력(`.env.example` 문법 · compose
  YAML 문법)을 한 함수 시그니처에 담아 두 개의 독립된 정규식·루프를 순차 실행한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:192-214`
  - 상세: 함수 하나가 두 가지 문법(줄 시작 `KEY=` vs 들여쓴 `  KEY:`)을 처리하고 결과를
    하나의 `Set` 으로 합친다. 각 문법이 짧고(6줄 내외) 서로 간섭하지 않아 순환 복잡도는
    낮지만, 이름(`collectEnvDeclarations`)만 보면 두 입력 소스가 문법이 다르다는 사실이
    드러나지 않는다. 실제로는 호출부(`guide-identifier-existence.test.ts:61`)와 헤더 주석이
    이를 분명히 밝히고 있어 오독 위험은 낮다.
  - 제안: 조치 불요 — 두 서브 파서로 쪼갤 만큼 복잡하지 않다. 참고로만 기록.

## 요약

핵심 로직(`scanIdentifierCitations` / `collectSourceTokens` / `collectEnvDeclarations`, 총
214줄)은 함수마다 단일 책임 · 낮은 순환 복잡도 · 얕은 중첩을 유지한다. 매직 넘버는
`EXTERNAL_VOCABULARY_CAP = 5`처럼 이름 붙은 상수로, 테스트의 vacuity-floor 숫자들도 전부
"실측 N" 주석을 동반해 근거가 명시돼 있다. 네이밍(`GUIDE_EXTERNAL_VOCABULARY`, 축 라벨
`field-table`/`code-field`/`backtick`)은 목적이 분명하고 이 폴더의 기존 가드 파일들과
컨벤션이 일치하며, 구 `guide-error-code-scan.ts` 대비 `codeTableRows`/`TABLE_HEADER_WITH_CODE`
같은 문맥 게이팅 로직을 통째로 걷어내 오히려 더 단순해졌다. 이전 두 라운드가 지적한
WARNING 2건(자매 파일의 죽은 참조, `composeTexts` 과다 수집 범위)은 소스를 직접 열어
독립 재검증한 결과 실제로 해소돼 있고, 저장소 전수 grep 으로 다른 잔여 위험도 없음을
확인했다. 남은 것은 이 저장소가 이미 알고 있고 조치 불요로 처분해 온 사소한 INFO(정규식
수집 뼈대의 폴더 전반 반복, 설계 근거 삼중 복제, `collectEnvDeclarations` 의 이중 문법
처리)뿐이다. CRITICAL·WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
