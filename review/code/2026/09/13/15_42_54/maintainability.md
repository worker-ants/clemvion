# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인 — 라운드 1~3(`14_41_14`·`15_03_06`·`15_24_12`) WARNING 재검증

이번은 이 가드 계열에 대한 4번째 유지보수성 리뷰다. 이전 세 라운드가 잡아 고친 WARNING들을
현재 HEAD(`b75fe0ace`)의 실제 소스를 직접 `Read`/`grep` 해 독립 재확인했다.

- **라운드 1/2 WARNING (sibling stale 참조, `composeTexts` 과다 수집)**: 둘 다 여전히
  해소된 상태를 유지한다. `grep -rn "guide-error-code" codebase/ CHANGELOG.md PROJECT.md
  spec/ plan/in-progress/guide-identifier-existence.md` 결과 남은 6건 전부 `#1330`
  당시 이름을 가리키는 의도된 역사 서술이었고(`guide-identifier-scan.ts:9`,
  `guide-sanitized-message-parity.test.ts:16`, `CHANGELOG.md:77`, plan 파일 3곳), 존재하지
  않는 파일을 실제로 가리키는 죽은 참조는 0건이다. `composeTexts` 필터도
  `guide-identifier-existence.test.ts:55-58` 에서 여전히 `/^docker-compose.*\.ya?ml$/` 로
  좁혀져 있다.
- **라운드 3 WARNING#1 (`UPPER_SNAKE` 밑줄-요구 결정에 대조군 부재)**: `guide-identifier-existence.test.ts:299-309`
  에 `` `LLM`/`HTTP` `` 는 안 집고 `` `LLM_TIMEOUT` `` 은 집는 판별 fixture 가 그대로
  남아 있다 — 재발 없음.

세 라운드 모두 재-flag 하지 않는다.

## 발견사항

이번 라운드의 diff(라운드 3 이후 코드 변경 없음 — `plan/in-progress/guide-identifier-existence.md`
체크리스트 표 갱신과 신규 `review/**` 산출물만 추가됨)에서 **새로운 유지보수성 결함은
발견되지 않았다.** 아래는 이전 라운드들이 이미 INFO 로 처분한 항목이 이번 라운드에도
악화되지 않고 그대로임을 재확인한 기록이다.

- **[INFO]** 정규식 `lastIndex` 리셋 → `exec` 루프 → `Set`/배열 적재 패턴이 한 파일 안에서
  4회 반복된다 (변동 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:139-148`(`scanIdentifierCitations`
    내부 `push`) · `:163-171`(`collectSourceTokens`) · `:197-203`·`:205-211`(`collectEnvDeclarations`)
  - 상세: 라운드 3 이 이미 지적하고 조치 불요로 처분한 항목과 동일 위치·동일 형태다. 이
    폴더의 다른 가드(`impl-anchor-parse.ts`, `spec-links.ts`)도 같은 뼈대를 반복하므로 이
    파일만 국소 추출하면 형제 파일과 스타일이 갈린다는 판단도 유효하다.
  - 제안: 조치 불요 유지. 가드가 더 늘면 공유 `matchAll` 유틸 검토.

- **[INFO]** 설계 근거(`#1330` 축별 실측표 · "허용목록 없음" 번복 서사)가 소스 헤더 주석 ·
  테스트 JSDoc · plan 문서 세 곳에 축약 없이 반복된다 (변동 없음)
  - 위치: `guide-identifier-scan.ts:1-76` · `guide-identifier-existence.test.ts:18-27` ·
    `plan/in-progress/guide-identifier-existence.md` §A~C
  - 상세: 이번 PR 이 라운드 1~4 를 거치며 파일명 하나(`guide-error-code-*` →
    `guide-identifier-*`) 바꾸는 데 `PROJECT.md`·`CHANGELOG.md`·plan·sibling 테스트
    JSDoc 등 다수 지점을 손으로 동기화해야 했던 실제 비용을 이 리뷰 자체가 보여준다(라운드
    1 이 sibling 참조 갱신을 한 번 놓쳤던 사례가 그 증거). 다만 "왜"를 코드에 남기는 이
    저장소의 관례 자체는 일관되고, 세 라운드가 이미 같은 결론(즉각 조치 불요)에 도달해 있다.
  - 제안: 즉각 조치 불요 — 다음에 이 가드 가족의 축·허용목록을 다시 바꿀 때 "코드 헤더가
    SoT, 테스트 JSDoc·plan 은 참조만" 하는 방향으로 점차 정리할 것을 재권고.

- **[INFO]** plan 문서(`plan/in-progress/guide-identifier-existence.md`)의 체크리스트가 라운드별
  완료 기준을 표로 관리하도록 이번에 갱신됨 — 유지보수성 관점에서 긍정적
  - 위치: `plan/in-progress/guide-identifier-existence.md` 체크리스트 절 (라운드 1~4 표 +
    "완료 기준은 *미래 라운드가 깨끗할 것*에 달려 있어 원리적으로 조기에 알 수 없다" 서술)
  - 상세: 같은 문서가 "이 항목을 두 PR 연속 거짓으로 체크했다"는 자기 반성과 함께 재발 방지
    규칙("완료 기준을 항목 본문에 적고 그 기준이 관측될 때만 체크")을 명문화했다. 코드는
    아니지만 이 PR 계열의 반복되는 실패 모드(체크박스 조기 확정)를 구조적으로 줄이는 변경이라
    긍정적으로 기록한다.
  - 제안: 없음(정보성, 조치 완료).

## 요약

핵심 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`, 총
214줄)은 함수당 단일 책임·낮은 순환 복잡도·얕은 중첩을 유지하며, 이전 세 라운드가 잡은
WARNING(자매 파일의 죽은 참조, `composeTexts` 과다 수집 범위, `UPPER_SNAKE` 밑줄-요구 무검증
분기)은 소스를 직접 열어 재확인한 결과 전부 해소된 채 유지되고 있다. 이번 라운드의 diff 자체는
`codebase/**` 코드 변경이 없고(plan 체크리스트 갱신 + 리뷰 산출물 추가뿐) 새로운 유지보수성
결함도 발견되지 않았다. 남은 것은 이 저장소가 이미 알고 처분해 온 낮은 비용의 INFO(정규식
수집 뼈대의 폴더 전반 반복, 설계 근거 삼중 복제)뿐이며 이번 라운드에서 악화되지 않았다.
CRITICAL·WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
