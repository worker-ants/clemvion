# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `node-output-allowlist.ts` 의 컴파일타임 결속 검사(`assertAllowlistCoversHandlerContract`)가 조건부 타입(`extends … ? true : never`)을 값 타입 자리에 쓰는 다소 생소한 TS 관용구다.
  - 위치: `codebase/backend/src/nodes/core/node-output-allowlist.ts:106-114` (함수 `assertAllowlistCoversHandlerContract` 선언부)
  - 상세: 주석으로 의도(*"새 공개 키가 추가되면 이 줄이 타입 오류를 낸다"*)는 충분히 설명돼 있어 기능·이해에 문제는 없다. 다만 이 코드는 이번 PR 이 새로 작성한 것이 아니라 `shared/utils/node-output-allowlist.ts` → `nodes/core/node-output-allowlist.ts` 로 **내용 변경 없이 이동**한 것이다(삭제 diff와 신규 diff 를 대조하면 바이트 단위로 동일). 순수 이동 PR 에서 내용을 손대면 diff 가 "이동"이 아니게 되므로 이번 라운드에 고칠 항목은 아니다.
  - 제안: (선택, 이 PR 대상 아님) 다음에 이 파일을 다른 이유로 열 때 `// TS conditional-type exhaustiveness check` 류의 검색 가능한 키워드를 한 줄 보태면 다음 사람이 이 관용구를 검색하기 쉬워진다.

## 검증한 항목 (재발 없음 확인)

이 diff 에는 `review/code/2026/08/27/19_36_17/` 산출물(같은 코드에 대한 직전 리뷰 세션 결과)이 함께 포함되어 있다. 그 세션의 maintainability 리뷰가 낸 WARNING 2건(모두 "리팩터 도중 JSDoc 이 원래 대상에서 떨어져 나가 엉뚱한 선언에 붙었다")을 현재 코드 상태에서 `Read` 로 직접 재검증했다:

- `swagger-probe.ts`: `schemasOf`(64행)·`schemaOf`(91행) 각각 자신의 JSDoc 을 1개씩만 갖고 있고 중복·오귀속 없음 — **해소 확인**.
- `websocket.service.spec.ts`: `describe('nodeOutput allowlist · fanout 파이프라인 불변식', …)`(799행) 앞의 JSDoc(791-798행)이 그 describe 블록을 정확히 설명하고, 첫 캐너리(812행)는 자신만의 JSDoc(800-811행)을 별도로 갖는다 — **해소 확인**.

두 항목은 RESOLUTION.md 가 주장한 수정과 실측이 일치하므로 이번 라운드에서 재지적하지 않는다.

## 요약

이번 diff 는 함수/파일 리네임(`redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`, `node-output-allowlist.ts` 를 `nodes/core/` 로 재배치), 4개 스펙 파일에 반복되던 Swagger `createDocument` 보일러플레이트를 `swagger-probe.ts` 공유 헬퍼로 추출, JSDoc 오기 정정(`EIA-AU-09`), plan 문서 동기화로 구성된 위생(hygiene) 정리 PR이다. 리네임·이동은 호출부 전수에 걸쳐 정합하게 반영되어 있고(`grep` 실측으로 구 이름·구 경로 잔존 0건 확인), `swagger-probe.ts`/`node-output-allowlist.ts` 모두 "왜 이런 설계인가"를 두텁게 문서화해 가독성이 높다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 매직 넘버도 없다. 직전 리뷰 라운드(`19_36_17`)가 지적한 두 건의 JSDoc 오귀속 WARNING 은 현재 코드에서 실측으로 해소가 확인됐으며, 남은 항목은 이 PR 범위 밖(순수 이동 코드)의 낮은 우선순위 INFO 하나뿐이다.

## 위험도

LOW
