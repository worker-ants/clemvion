# RESOLUTION — `00_23_57` ai-review 3라운드 후속 조치

**CRITICAL 0 · WARNING 1 · 위험도 LOW.** forced 7명 전원 결과 확보(`forced_missing` 공집합),
`unfinished` 공집합.

발견의 성격이 **동작(1R WARNING 8) → 구조/CRITICAL(2R) → 문서(3R WARNING 1)** 로 내려왔다 —
이 저장소가 수렴 판정에 쓰는 신호다.

## WARNING 1 — **반영**

신규 테스트 JSDoc 이 *"네 표면에서 각각 고정한다"* 라 해놓고 다섯을 나열했다
(`①findById` · `②findByWorkflow` · `⑥-b nodeExecutions[]` · `getChain` · `stop`).

**이 PR 이 없애려던 결함 클래스가 내 새 주석에서 재발한 것**이라 트래커 이연 대상으로
두지 않고 그 자리에서 고쳤다. 개수를 고치는 대신 **각 표면을 이름으로** 적고, 여섯째
(`BackgroundRunsService`)가 다른 파일에 있음을 명시했다 — 표면이 또 늘어도 이 주석은 낡지
않는다. 표면 목록의 정본은 `toResponseExecution` 의 표임도 함께 가리켰다.

## INFO — 처분

| # | 처분 | 사유 |
|---|---|---|
| 1 | **트래커 등재** | `kb:`/`background:run:` WS 채널 미마스킹. population-parity 논리는 같지만 **외부 fanout 이 없어**(`executionEventSubject` 미경유) 이 PR 이 겨눈 표면이 아니다 |
| 19 | **트래커 등재** | 유저 가이드 Error 탭 캐비엇. 이번엔 변경 대상(`outputData`)에 범위를 맞춰 Output 행만 반영했다 |
| 18 | **반영** | plan 의 "회귀 테스트 8개" → **실측 12개**로 갱신(철회 라운드에서 캐너리가 늘었다) |
| 2·3·4·5 | 조치 불요 | 전부 **이미 문서화된 설계 결정의 재확인**(inputData 비대상 · bare `token=` 기등재 · `maskIfPresent` 시그니처 · 키/값 계층 인식 범위) |
| 6·7 | 조치 불요 | scope — 앞선 두 라운드가 이미 사유와 함께 수용 |
| 8·9·10 | 조치 불요 | maintainability 저위험. 8(JSDoc 블록 귀속)은 typedoc 미도입이라 무해, 9(`void` 앵커)는 상수를 지우면 참조가 끊기도록 의도한 것, 10(파일 누적)은 후속 규모 확대 시 검토 |
| 11~14 | 조치 불요 | side_effect — 전부 영향 범위를 **실측으로 재확인**(캐시 교차 오염 없음 · 타입 소비자 0건 · `stop()` 내부 호출부 반환값 미사용) |
| 15·16·17 | 조치 불요 | testing — perf 자동 회귀는 이 저장소 관례 밖, `emitNodeEvent` llmCalls 대칭은 공유 private 메서드라 위험 낮음, `undefined` fixture 는 `==` 로 동일 경로 |

## 같은 라운드의 `--impl-done`(`00_22_23`) CRITICAL — 별도 해소

`15-chat-channel.md` CCH-MP-06 의 *"`template` 은 `output.rendered` 텍스트 그대로"* 가 새
emit 마스킹과 충돌했다. 코드 경로(`emitNodeEvent` → `executionEvents$` → `ChatChannelDispatcher`)를
확인해 실재를 확증했다.

**(a) 캐비엇 추가를 택했다.** 리뷰어의 (b)안(presentation 필드 carve-out)은 이 PR 이 닫은
외부 누출(`node.completed` 의 `output` → SSE)을 **다시 여는** 조치라 채택할 수 없다.
(a)는 §R17 `ai_message` 불릿의 *"내부 WS·Chat Channel 도 마스킹됨 — 수용된 trade-off"*
선례와도 같은 방향이다. `CCH-MP-01`·`CCH-MP-04` 에도 동일 적용됨을 함께 적었다.

그 밖에 같은 세션의 WARNING/INFO 도 반영했다 — `3-error-handling.md §2.2`
`nodeName`→`nodeLabel`(WS 와 같은 drift), §R17 의 stale *"4곳"* 을 정본 표 참조로 단일화,
집행 완료된 spec draft 를 `complete/` 로 이동하며 **철회된 결정을 근거로 재집행하지 말 것**을
문서 서두에 못박음.

## 검증

TEST WORKFLOW 재수행 결과는 이 커밋 이후 라운드에 기록한다 — 이번 편집은 주석 1건과
spec/plan 문서뿐이라 동작 변경이 없다.
