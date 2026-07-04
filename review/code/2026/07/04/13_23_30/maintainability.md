# 유지보수성(Maintainability) 리뷰

## 개요

본 변경은 순수 spec 문서(`spec/**/*.md`) 5개 파일에 대한 갱신이며, PR4(BullMQ stalled 자동 재배달 구현)를
반영해 이전에 "PR4 예약/target/Planned" 로 표기됐던 서술을 "PR4 구현 완료(2026-07-04)" 로 갱신하는
작업이다. 코드(.ts) 변경은 이 payload 에 포함되어 있지 않아, 함수 길이·중첩 깊이·순환 복잡도 관점은
해당 사항이 없다. 아래는 문서로서의 가독성·네이밍(용어)·중복·일관성 관점 검토다.

## 발견사항

- **[INFO]** 동일 사실의 5개 파일 반복 서술 — 갱신 시 N-place 동기화 부담
  - 위치: `spec/5-system/3-error-handling.md:305`, `spec/5-system/4-execution-engine.md:811,822,828,918-919,931,963`, `spec/conventions/error-codes.md:987`, `spec/data-flow/3-execution.md:1142,1163,1172,1187-1188`
  - 상세: "`maxStalledCount=1` 로 1회 자동 재배달 → 소진 시 `finalizeStalledExhausted` 가 `WORKER_HEARTBEAT_TIMEOUT` 발동, `recoverStuckExecutions` 는 은퇴하지 않고 backstop 으로 병존" 이라는 동일 사실이 5개 파일에서 문구만 살짝 바꿔 최소 8곳 이상 반복 서술된다. 이번 diff 자체는 일관되게 잘 갱신됐으나, 이 구조상 향후 유사 정정(예: PR4 이후 `maxStalledCount` 값 변경, `recoverStuckExecutions` 실제 은퇴 등)이 생기면 8곳 이상을 놓치지 않고 동시 수정해야 한다. 실제로 이번 diff의 동기다(과거 "PR3→PR4 관계" 서술이 최소 4개 파일에서 개별적으로 correction 을 필요로 했다).
  - 제안: 이미 각 파일이 서로를 링크(SoT 참조)하는 구조를 갖추고 있으므로, "구현 상태" 한 줄 요약은 SoT 파일(예: `4-execution-engine.md §7.1`) 한 곳에만 상세 서술하고 나머지 파일은 "§7.1 참조" 수준으로 축약하는 편이 향후 드리프트 리스크를 줄인다. 다만 이는 이번 PR 범위를 넘는 구조적 제안이며 즉시 수정을 요구하는 수준은 아니다.

- **[INFO]** 극단적으로 긴 단일 문장/테이블 셀 — 가독성 저하
  - 위치: `spec/5-system/4-execution-engine.md:919` (§4.2 재검증 문단, 약 850자 단일 문장), `spec/5-system/4-execution-engine.md:930` (PR4 절 `maxStalledCount=1` 항목, 약 500자), `spec/conventions/error-codes.md:987` (`WORKER_HEARTBEAT_TIMEOUT` 행, 약 700자 단일 테이블 셀)
  - 상세: diff 로 편집된 문장들 다수가 세미콜론·em dash·괄호 주석을 겹겹이 중첩해 한 문장(또는 한 테이블 셀)에 여러 독립 사실(트리거 종류, bound 값, 근거, 예외 케이스)을 모두 욱여넣는다. 예: `4-execution-engine.md:919` 의 "잔여 race" 문단은 "정상 크래시는 fencing" + "zombie 는 미배제" + "완화 3가지(boot backstop/30분/skip)" + "기존 fail-path 도 동일 노출이라 회귀 아님" 을 쉼표·"— " 로 이어 붙인 하나의 거대 문장이다.
  - 제안: 이런 다중 사실 문장은 기존에도 이 spec 문서군의 스타일(장문 산문형 스펙)이라 이번 diff 만의 신규 패턴은 아니다. 다만 diff 가 문장을 더 길게 만드는 방향으로 편집했으므로(예: 919번 줄은 원본보다 더 길어짐), 향후 대규모 리라이트 시에는 불릿 리스트로 분해하는 것을 고려할 만하다. 리뷰 차단 사유는 아님(기존 문서 컨벤션과 일관).

- **[INFO]** 용어 변경("재시작 트리거" → "부팅 backstop 트리거") 의 일부 잔존 비일관
  - 위치: `spec/5-system/4-execution-engine.md:844` (`3. 전체 Execution Engine 재시작 시 (PR3 — 구현, 2026-07-04):` — 미변경), vs 같은 파일 `:806-822` 는 "부팅 backstop" 으로 전면 개칭
  - 상세: 이번 diff 는 §7.1의 "재시작 트리거"를 "부팅 backstop 트리거"로 일관되게 리네이밍했지만, §7.2 point 3 헤더(`844`번 줄, 이번 diff 에 포함 안 된 컨텍스트 라인)는 여전히 "전체 Execution Engine 재시작 시" 라는 구용어를 쓴다. 의미는 같은 대상(부팅 backstop)을 가리키지만 표기가 섞여 있어, 이 시점 이후 신규 독자가 "재시작"과 "부팅 backstop" 이 같은 개념인지 다시 추적해야 한다.
  - 제안: 이번 PR 은 그 줄을 건드리지 않았으므로 범위 확장을 강제하지는 않으나, 후속 정리(§7.2 헤더도 "부팅 backstop" 용어로 통일) 시 참고할 만한 항목으로 남긴다.

- **[INFO]** `maxStalledCount` 표기 형식 불일치 (`=1` vs `:1`)
  - 위치: `spec/5-system/3-error-handling.md:305,389` (`maxStalledCount=1`), `spec/5-system/4-execution-engine.md:811,822,828,888,930` (`maxStalledCount:1`), `spec/data-flow/3-execution.md:1142,1151,1157` (`maxStalledCount: 1` / `maxStalledCount:1` 혼재)
  - 상세: 동일한 BullMQ 옵션 값을 `error-handling.md`/`error-codes.md` 계열 문서에서는 `key=value`(등호) 표기로, `execution-engine.md`/`data-flow` 계열에서는 `key:value`(콜론, 실제 JS 객체 리터럴 표기) 로 쓴다. 코드 자체 표기(`{ maxStalledCount: 1 }`)와 맞는 쪽은 콜론이므로, 등호 표기는 오브젝트 리터럴이 아닌 "이름=값" 관용구로 의도된 것으로 보이나 두 표기가 문서군 전체에서 뒤섞여 등장한다.
  - 제안: 사소한 스타일 이슈이며 이번 diff 가 새로 만든 비일관은 아니다(기존 문서에도 이미 혼재). 차단 사유 아님.

## 요약

이번 변경은 5개 spec 문서에 걸쳐 "PR4 구현 완료" 사실을 정확하고 상호 참조 가능한 형태로 반영했으며, 코드 소스 변경은 포함되지 않아 함수 길이·중첩·복잡도 등 전통적 코드 메트릭은 해당 사항이 없다. 문서 관점에서는 (1) 동일 사실이 다수 파일에 반복 서술되어 향후 유사 정정 시 동기화 비용이 크다는 점, (2) 일부 문장이 여러 독립 사실을 한 문장/셀에 욱여넣어 가독성이 낮다는 점, (3) 용어("재시작"/"부팅 backstop")·표기(`=` vs `:`) 가 문서군 전반에 걸쳐 부분적으로 혼재한다는 점이 관찰되나, 모두 기존 문서 컨벤션의 연장선이며 이번 diff 자체의 내적 일관성은 양호하다(5개 파일이 서로 모순 없이 정합적으로 갱신됨). 차단할 만한 심각한 유지보수성 결함은 없다.

## 위험도

LOW
