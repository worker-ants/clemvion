# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

`git diff origin/main...HEAD` 기준 실제 애플리케이션 코드는 여전히 6개 소스 파일이다:

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` / `.spec.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` / `.spec.ts`

이 diff 는 이미 11회의 코드 리뷰 라운드(`10_32_27`→`11_02_16`→`12_06_20`→`14_30_35`→
`14_55_29`→`15_58_26`→`16_29_50`→`16_44_37`)를 거쳤고, 직전 아키텍처 라운드(`16_44_37`)가
위험도 NONE 으로 결론냈다. `16_44_37` 이후 HEAD 까지의 실질 변경을 직접 대조했다
(`git diff 9482cc0c0..HEAD -- interaction.service.ts websocket.service.ts
strip-external-only-fields.ts`):

- `interaction.service.ts` — `stripAndRedact` 내부 주석에 성능 실측 수치(JSDoc)를 추가한
  것뿐, 함수 시그니처·호출 순서·의존 방향 무엇도 바뀌지 않았다.
- `websocket.service.ts` / `strip-external-only-fields.ts` — **변경 없음** (diff 0).
- 그 사이 커밋(`462455a52`)은 `spec/5-system/6-websocket-protocol.md` 의
  `waitingNodeType` 매핑 문구를 철회한 **spec 문서 전용** 수정으로, 코드 레이어에는
  영향이 없다.

따라서 이번 라운드는 직전 아키텍처 결론을 재확인하고, 신규 escalate 항목은 없다.

## 재확인한 구조적 성질

- **레이어링·순환 의존성 없음**: `strip-external-only-fields.ts` 는 여전히 외부 import 가
  전혀 없는 leaf 유틸(`grep -n "^import" strip-external-only-fields.ts` 결과 없음)이고,
  `interaction.service.ts`(external-interaction 모듈)·`websocket.service.ts`(websocket
  모듈) 두 feature 모듈이 각각 단방향으로만 이를 소비한다(`grep -rln
  stripExternalOnlyFields codebase/backend/src` → 소비처 2개, 서로 직접 의존 없음).
  두 feature 모듈 간 직접 결합은 여전히 없다.
- **단일 책임(SRP) 분리 유지**: `stripExternalOnlyFields`(이름 기반 필드 삭제, 깊이 무관)
  와 `stripAndRedact`(REST 표면 전용 — strip + `deepRedactSecrets` 값 마스킹의 합성,
  `interaction.service.ts` 모듈-private)의 책임이 분리돼 있다. `getStatus` 의 세 출구
  (waiting `nodeOutput`/terminal `result`/`error`)가 여전히 이 헬퍼 하나를 공유해, "출구를
  각자 조립하면 하나씩만 고쳐진다"는 이 결함 계열의 재발 원인이 구조적으로 제거된 상태를
  유지한다.
- **개방-폐쇄(OCP)**: `EXTERNAL_STRIPPED_FIELDS` 배열에 필드명을 추가하는 것만으로 strip
  대상이 확장되고, 순회 로직(`stripDeep`)은 변경할 필요가 없다 — 필드 추가에는 열려 있고
  순회 알고리즘 수정에는 닫혀 있다.
- **경계 연산자 비대칭은 문서화된 의도**: `stripExternalOnlyFields` 는 `>` 고정, 자매
  `deepRedactSecrets`(`>=`)·`sanitizePayloadForWs`(`>`)와 관계가 JSDoc 에 "왜 통일하지
  않았는지"까지 근거와 함께 명시돼 있다(`strip-external-only-fields.ts:52-67`). 안전성의
  근거가 "연산자가 같다"가 아니라 "그 깊이에서 둘 중 하나가 서브트리를 collapse 한다"로
  옮겨져 있어, 표면적 불일치가 실제 결함이 아님이 계약 수준에서 설명된다.

## 발견사항 (이월, 신규 아님 — 상태 불변이라 재-escalate 하지 않음)

- **[INFO]** 재귀 트리 순회(clone-on-write) 스켈레톤이 세 곳 — `strip-external-only-fields.ts`
  의 `stripDeep`, `websocket.service.ts` 의 `sanitizeInner`, `sanitize-error-message.ts`
  의 redact 순회 — 에 독립 구현돼 있다. `14_55_29`·`15_58_26`·`16_29_50`·`16_44_37`
  라운드에서 이미 식별·의도적 defer 됐고(RESOLUTION `12_06_20`/`14_55_29` 참조), 이번
  라운드에도 세 파일 모두 변경이 없어 상태가 그대로다.
- **[INFO]** `stripExternalOnlyFields` 의 `maxDepth` 인자가 호출부 자매 상수
  (`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`)와 "짝을 맞춘다"는 불변식은 타입 시스템이 아니라
  JSDoc 관례 + 회귀 테스트로만 강제된다(호출부가 다른 상수를 실수로 넘겨도 컴파일은 통과한다).
  `16_29_50`/`16_44_37` 라운드가 이미 근거(단일 헬퍼로 접합 시 credential 마스킹·캐시·
  depth 캡 의미가 WS 형태와 REST 형태 사이에서 충돌한다는 실측 기반 판단)와 함께 조치
  불요로 결론냈고, 이번 delta 는 이 표면을 건드리지 않는다.

## 요약

이번 라운드(`21_54_03`)의 코드 레이어 변경은 직전 아키텍처 검증(`16_44_37`) 이후
`interaction.service.ts` 의 JSDoc 주석 한 단락(성능 실측치 병기)뿐이며, `websocket.service.ts`
와 `strip-external-only-fields.ts` 는 diff 0 이다. SOLID·결합도/응집도·레이어 책임·순환
의존성·모듈 경계 어느 관점에서도 구조를 바꾸는 변경이 없다. 핵심 구조 — 공유 leaf 유틸로의
strip 로직 승격, REST/WS 양쪽의 단일 헬퍼 공유(각 표면 내부), 두 feature 모듈 간 무직접
의존, 이름 기반 필드 목록을 통한 OCP 확장성 — 는 여러 라운드에 걸쳐 검증된 상태 그대로다.
이미 추적 중인 두 저위험 INFO(재귀 순회 스켈레톤 3중 중복, 깊이 상수 짝맞춤의 비-타입적
강제)는 이번 delta 의 범위 밖이라 재지적하지 않는다.

## 위험도
NONE
