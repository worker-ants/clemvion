# RESOLUTION — 항목 B ai-review (11_49_26)

router 가 diff 를 docs-heavy 로 오판해 code reviewer 를 skip → main 이 side_effect·concurrency·maintainability·testing 을 직접 재실행해 실제 findings 확보. concurrency CRITICAL 1건 + WARNING 다수. 전부 조치.

## 조치 항목

| # | 카테고리 | 처분 | 조치 내용 |
|---|---|---|---|
| concurrency C | 동시성 | **fix** | `LlmService.chat` 의 withTimeout 콜백이 timeout signal 을 버려 타임아웃 시 provider 요청 미취소(leak). `chat()` 을 `withTimeout((timeoutSignal) => client.chat(sanitized, opts?.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal))` 로 수정(listModels 패턴 정합). Google client `chat(params, signal?)` 추가 + `generateContent` config.abortSignal 전달. 회귀 테스트 2건(`llm.service.spec`: 타임아웃 발화 시 client.chat signal.aborted, execution abort 병합). |
| side_effect W1 / concurrency W | 부작용/동시성 | **fix(문서)** | default 600000ms behavior change + provider SDK ~120s 타임아웃과의 관계(실효 상한=더 작은 쪽) → §12.16 명문화. embed 경로는 client.embed 가 signal 미지원이라 스코프 밖(별도 후속) 명시. |
| side_effect W2 | 부작용 | **fix** | withTimeout 미배선 = concurrency C 와 동일 근본 → 위 fix 로 해소. |
| maintainability W1 | 유지보수성 | **fix** | tool-loop 재호출(2번째 chat) timeoutMs 미검증 → ai-turn-executor.spec single-turn·multi-turn 2-call 테스트에 배선 대칭 단언 추가. |
| testing W1 | 테스트 | **fix** | `AI_AGENT_LLM_CALL_TIMEOUT_MS=0` 전파 미검증 → executeSingleTurn 이 opts.timeoutMs=0 을 전달하는 테스트 추가. |
| testing W2 | 테스트 | **fix** | signal 검증이 `'signal' in opts` tautology → context.abortSignal 을 실제로 주입하고 `opts.signal === controller.signal` 로 강화. |
| testing W3 | 테스트 | **fix** | tool-loop 후속 chat 미검증 → 위 maintainability W1 과 동일 조치. |

INFO(resume signal no-op·캐스트 disable·스코프 격리·IE-safe): 조치 불요, 검증 완료.

## 초기 router-selected 리뷰 (requirement/documentation)
requirement: NONE (§12.16↔코드 line-level 일치 확인). documentation: FS-write flakiness(output 부재). INFO 2건(감사 추적 권고)만.

## TEST 결과 (조치 후)
- lint / unit / build / e2e — 조치 후 재수행(§아래 최종 재테스트). llm.service.spec 회귀 테스트 + ai-turn-executor.spec 보강 테스트 포함 전량 통과.
