# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, `00_51_50` 라운드)

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.

## 범위 확인

`git diff origin/main...HEAD -- spec/5-system/` 로 재확인한 실제 변경 파일은 2개뿐이다:

- `spec/5-system/14-external-interaction-api.md` — §R17 `nodeOutput` allowlist 표를
  `getStatus` 단일 출구에서 SSE/fanout(`waiting_for_input`)까지 확대. wire 전용 4키
  (`payload`/`title`/`rendered`/`nodeType`, chat-channel 렌더러 소비) 신설. `code:`
  frontmatter 에 `websocket.service.ts` 추가.
- `spec/5-system/6-websocket-protocol.md` — §4.4 wire caveat 블록쿼트에 "SSE/fanout 의
  `nodeOutput` 도 fail-closed allowlist" 한 문장 추가.

근거 코드(`node-output-allowlist.ts`/`websocket.service.ts`/`interaction.service.ts` 와
각 `.spec.ts`)를 절대경로로 직접 열어 위 서술과 실제 구현을 대조했다. 이 작업은 같은
세션에서 이미 5라운드 코드 리뷰 + 4라운드 consistency 검토(마지막 `00_26_17`,
convention_compliance 포함)를 거쳐 RISK=NONE 으로 수렴한 상태이며, 본 라운드는 그 위에서
scope 를 `spec/5-system/` 전체로 넓혀 재검증한다.

## 발견사항

- **[INFO]** `nodeOutput.nodeType` carve-out과 §4.4 `buttonConfig.nodeOutput` 행의 "type 판별자 래퍼 금지" 서술이 인접해 오독 여지
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.4 표 `buttonConfig.nodeOutput` 행("노드 종류는 상위 `payload.nodeType` 로 식별 — `nodeOutput` 에 `type` 판별자 래퍼는 두지 않는다 ([node-output.md Principle 1.1.4]))" — 이번 diff 로 수정된 줄 아님, §4.4 wire caveat 블록쿼트(이번 diff 로 1문장 추가)와 같은 절
  - 관련 규약: `spec/conventions/node-output.md` Principle 1.1.4 / Principle 4.2 (`output.type`/`output.view.type` 판별자 폐기)
  - 상세: `node-output-allowlist.ts`(및 이를 미러하는 `14-external-interaction-api.md` §R17 표)가 신설한 `nodeType` 키는 **§R17 이 정의한 키가 아니라 `NodeHandlerOutput` 계약 밖의 chat-channel legacy flat shape carve-out**이라고 코드 주석·spec 양쪽에서 명시적으로 disclaim 되어 있어(실측: `button-interaction.service.ts` 의 `nodeOutputForEvent = structured ?? flatNodeOutput` — `nodeType` 은 `structured`(=`NodeHandlerOutput` 5필드) 경로가 아니라 `flatNodeOutput`(미마이그레이션 legacy 핸들러) 경로에서만 등장), Principle 1.1.4 가 금지하는 "새 판별자 설계"에는 해당하지 않는다. 다만 §4.4 의 `buttonConfig.nodeOutput` 행은 여전히 "`nodeOutput` 에 `type` 판별자 래퍼는 두지 않는다"만 서술하고 이 legacy carve-out 예외를 언급하지 않아, 같은 절(§4.4) 안에서 "판별자 금지 원칙"과 "그 예외(다른 이름의 유사 필드)"가 교차 참조 없이 병존한다. 실질 계약 위반은 아니며(§R17 이 정본으로 이미 별개 갈래임을 명시), 표 행 자체는 이번 diff 대상이 아니다.
  - 제안: 조치 불요(이번 diff scope 밖, CRITICAL/WARNING 아님). 차후 §4.4 표를 편집할 기회가 있으면 `buttonConfig.nodeOutput` 행 끝에 "단 `nodeType`/`payload`/`title`/`rendered` 4키는 §R17 legacy carve-out 예외" 각주를 붙이면 교차 오독 여지가 줄어든다.

- **[INFO]** `swagger.md` §1-4 open-map 예외와 정합 확인 — 신규 4키에 대한 DTO/Swagger 갱신 불요
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 표(신규 `payload`/`title`/`rendered`/`nodeType` 키 추가)
  - 관련 규약: `spec/conventions/swagger.md` §1-4 "닫힌 union 을 `additionalProperties` 로 뭉개지 않는다" 및 그 아래 `nodeOutput` 전용 각주("`nodeOutput` 과 `buttonConfig.buttons` 는 노드 타입별 자유 payload 로, §1-4 가 말하는 **진짜 열린 map** 이다")
  - 상세: `ExecutionStatusDto.context` 의 `nodeOutput`/`buttonConfig` 서브필드는 swagger.md 가 명시적으로 "진짜 열린 map"으로 지정해 `additionalProperties: true` 를 유지하도록 규정한 필드다. 이번 PR 이 allowlist 상수에 4키를 추가해도 열린 map 스키마 자체는 바뀌지 않으므로 DTO/데코레이터 갱신이 필요 없고, 실제로 diff 에도 `responses.dto.ts` 등 Swagger 관련 파일 변경이 없다 — API 문서 규약 위반 없음(정합 확인, 조치 불요).

- **[INFO]** `spec-impl-evidence.md` frontmatter 스키마 준수 확인
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter(`status: partial`, `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`, `code:` 목록에 `websocket.service.ts` 추가)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §2 frontmatter 스키마
  - 상세: `status: partial` 은 `pending_plans` 를 의무화하는데 해당 plan 파일이 실존(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`, 이번 diff 로 갱신됨)하고, `code:` 글로브 추가도 R-1(최소 1매치, exhaustive 아님) 을 만족한다. 규약 위반 없음.

## 요약

이번 라운드는 target scope 를 `spec/5-system/` 전체로 넓혀 정식 규약 준수를 재검증했으나,
실제 diff 는 §R17 표 확대(`14-external-interaction-api.md`)와 §4.4 wire caveat 1문장
(`6-websocket-protocol.md`) 두 곳뿐이다. 이 변경은 이미 5라운드 코드 리뷰와 4라운드
consistency 검토(직전 `00_26_17` convention_compliance 포함, 그 결과 LOW)를 거쳐 실측
기반으로 수렴된 상태이며, 본 라운드에서 node-output.md(Principle 1.1.4 판별자 금지·Principle
0 5필드·Principle 7 config echo)·swagger.md(§1-4 열린 map 예외)·spec-impl-evidence.md
(frontmatter 스키마) 세 정식 규약을 코드(`node-output-allowlist.ts`/`websocket.service.ts`/
`button-interaction.service.ts`/`discord-message.renderer.ts` 등)와 직접 대조한 결과 CRITICAL/
WARNING 급 위반은 발견되지 않았다. 유일하게 특기할 점은 신설된 chat-channel `nodeType`
carve-out 이 §4.4 표의 기존 "판별자 래퍼 금지" 서술과 같은 절에서 교차 참조 없이 병존한다는
점인데, 이는 legacy flat-shape 전용 예외임이 §R17·코드 주석 양쪽에서 이미 명시적으로
disclaim 되어 있어 실질 위반이 아닌 INFO 수준의 가독성 제안에 그친다. `naming_collision`
checker(같은 세션 `00_51_50`)가 이미 동일 신규 키 4개에 대한 명명 충돌을 전수 재sweep 해
NONE 으로 확인한 것과도 정합된다.

## 위험도

LOW
