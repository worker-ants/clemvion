# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `allowlistFanoutNodeOutput` JSDoc 의 `{@link WebsocketService.toFanoutEnvelope}` 는 클래스 바깥의 모듈-레벨 함수 JSDoc 안에서 클래스 프라이빗 메서드를 가리킨다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:177` (게이트 기준)
  - 상세: 이 저장소가 TSDoc/TypeDoc 산출물을 실제로 빌드해 링크를 검증하는 파이프라인이 있는지 확인되지 않았다. 링크 자체(대상 심벌 존재)는 유효하지만, 모듈 스코프 함수에서 클래스 멤버를 `{@link Class.method}` 로 참조하는 방식이 도구 체인에 따라 깨질 수 있다.
  - 제안: 툴체인이 JSDoc 링크를 실제로 검증/렌더링하지 않는다면 조치 불요. 향후 문서 생성 파이프라인을 도입할 계획이 있으면 그때 점검.

- **[INFO]** `review/code/2026/08/23/22_51_46/SUMMARY.md`·`api_contract.md` 등 직전 라운드 리뷰 산출물이 인용한 줄 번호(`node-output-allowlist.ts:85-88`, `websocket.service.ts:9,182-205` 등)는 이번 커밋으로 코드가 이동하며 이미 소스와 어긋난다.
  - 위치: `review/code/2026/08/23/22_51_46/SUMMARY.md` (전체)
  - 상세: 다만 이 디렉터리는 CLAUDE.md 정보 저장 위치 표에 따라 "그 시점의 검토 기록"으로 보존되는 것이 관례이고, RESOLUTION.md 가 각 항목의 처리 결과를 별도로 남겨 뒀다. SoT 로 재참조될 문서가 아니므로 결함이 아니라 정상적인 아카이브 동작이다.
  - 제안: 조치 불요(참고용 기록).

## 확인된 항목 (문제 없음)

- **CHANGELOG.md**: 직전 라운드 W3("SSE·fanout 은 여전히 deny-list" 서술이 이번 PR로 거짓이 됨) 이 이 diff 에서 정확히 이 저장소의 자기정정 관례(취소선 원문 보존 + `> 정정` 블록)로 처리됐다. "9키→13키" 수치를 `node-output-allowlist.spec.ts` 의 정렬 리터럴 배열(13개)과 대조해 실측 일치 확인.
- **`node-output-allowlist.ts` 헤더 주석**: 직전 라운드 INFO #11("소비처도 `getStatus` 한 곳" 이 낡음) 이 반영돼 "소비처는 둘이다" 로 정정됐고, JSDoc 표(3그룹)와 배열 인라인 주석(3그룹)이 서로 미러링되어 있다. 표가 참조하는 `spec/5-system/15-chat-channel.md` §(c) *"renderPresentationByType shape 처리 우선순위"* 항목은 실제로 해당 문서 703행에 존재함을 확인했다(hallucination 아님).
- **chat-channel 4키(`payload`/`title`/`rendered`/`nodeType`) "flat legacy shape" 서술**: `discord-message.renderer.ts`/`telegram-message.renderer.ts`/`slack-message.renderer.ts` 의 `extractRendered` 등이 실제로 `nodeOutput.rendered`/`nodeOutput.title`/`nodeOutput.payload`/`nodeOutput.nodeType` 을 top-level 로 직접 읽는 코드를 grep 으로 대조 확인 — 주석·JSDoc·spec 서술이 실코드와 일치한다.
- **spec/5-system/14-external-interaction-api.md, 6-websocket-protocol.md**: §R17 표의 SSE 행 flip, "REST 와 SSE 는 같은 강도" 로 서술 정정, 세 갈래 allowlist 표, 동명 필드(`nodeOutput.nodeType` vs `waitingNodeType`, `nodeOutput.payload` vs webhook 봉투 `payload`) disambiguation 각주까지 자기정정 관례(취소선+정정)로 정확히 갱신됐다. WS §4.4 에도 "envelope 은 공유하지만 `nodeOutput` 키 집합은 공유하지 않는다" 단서가 추가돼 REST/SSE 비대칭 해소가 양쪽 spec 문서에 일관되게 반영됨.
- **신규 캐너리 테스트(`interaction.service.spec.ts`, `websocket.service.spec.ts`, `node-output-allowlist.spec.ts`)**: 전부 "왜 이 테스트가 필요한가"를 설명하는 JSDoc 블록을 달고 있고, 직전 리뷰 라운드 W1/W2 지적과 뮤테이션 번호(M5)를 명시적으로 역참조해 추적 가능성이 높다.
- **plan 문서 2건**: `spec-sync-external-interaction-api-gaps.md` 는 반증된 전제를 `<details>` 로 접어 이력 보존하며 정정했고, `sse-nodeoutput-allowlist.md` 는 배선 지점·설계·검증 기준·뮤테이션 표를 예측/실측 두 칸으로 기록해 정합성이 높다. `spec_impact` 에 `6-websocket-protocol.md` 가 정상적으로 포함돼 있다(RESOLUTION #5 반영 확인).
- README/신규 환경변수: 이 변경은 내부 보안 강화(allowlist 전환)이며 새 공개 API·설정·환경변수를 추가하지 않는다. 관련 `README.md` 를 grep 했으나 `nodeOutput`/`allowlist` 언급이 없어 업데이트 대상도 아니다 — README 업데이트 불요 판단은 타당하다.

## 요약

이번 diff 는 직전 리뷰 라운드(`22_51_46`)가 지적한 문서화 WARNING(CHANGELOG 서술 낡음, `node-output-allowlist.ts` 헤더 주석 낡음)을 모두 이 저장소의 자기정정 관례(취소선 보존 + 정정 블록)로 정확히 처리했다. CHANGELOG·JSDoc·spec 2편·plan 2편이 서로 인용하며 일관된 서사(SSE/REST 강도 통일, chat-channel 4키 추가 사유, 재배치 defer 판단)를 유지하고, 표에 등장하는 spec 참조(`15-chat-channel.md` §(c))와 코드 근거(`extractRendered` 등 top-level 읽기)를 모두 실제 코드/문서 대조로 검증했으나 불일치를 발견하지 못했다. 새로 추가된 캐너리 테스트들도 "왜 필요한가"를 설명하는 JSDoc 을 동반해 인라인 주석 품질이 높다. 발견된 것은 조치가 필요 없는 INFO 2건(모듈-스코프 JSDoc `{@link}` 대상이 클래스 멤버인 점, 과거 리뷰 아카이브의 줄 번호가 최신 코드와 어긋나는 점 — 둘 다 관례상 정상)뿐이다.

## 위험도
NONE
