# Code Review 통합 보고서 (항목 B fix 검증 — 12_23_46)

직전 ai-review(11_49_26)의 concurrency CRITICAL(withTimeout leak) fix(204b9aed6)를 검증. router under-select 를 우회해 concurrency·side_effect 를 직접 재실행.

## 전체 위험도
**LOW (조치 완료 후 해소)** — 원래 CRITICAL 은 fix 로 **해소 확인**. 검증 중 발견된 신규 WARNING 1건(회귀 테스트 open-handle 누수)도 조치 완료.

## Critical 발견사항
없음 — 직전 CRITICAL(withTimeout 이 timeout signal 을 버려 요청 미취소 leak)은 fix(chat() 의 `withTimeout((timeoutSignal) => client.chat(sanitized, opts?.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal))` + Google `chat(params, signal?)` → config.abortSignal)로 **해소**. concurrency 재검증: `AbortSignal.any` 병합 정합(abort-먼저/timeout-먼저 race 모두 정상), Node>=24 호환, timeout signal 이 실제 SDK 로 도달.

## 경고 (WARNING) [조치 완료]
- **[concurrency W]** fix 가 추가한 회귀 테스트 `'merges opts.signal with the timeout signal...'` 의 mock 이 abort 에 비반응이라 `withTimeout` 내부 60s setTimeout 이 clearTimeout 되지 않아 open handle 누수(jest.config "zero open handle" 불변식 위반; `--detectOpenHandles` 로 `with-timeout.util.ts:22` 지목, 프로세스 종료 60.69s). 프로덕션 코드는 안전(실 client 는 abort 시 clearTimeout). **→ FIX**: mock 이 abort 에 반응해 reject 하도록 수정(race settle → clearTimeout). `--detectOpenHandles` 재실행 시 누수 없음, 프로세스 3.93s 종료 확인.

## 참고 (INFO)
- **[concurrency I]** `LlmService.embed()` 도 chat() 과 동일 withTimeout 버그이며 `embedding.service.ts:244`(EMBED_TIMEOUT_MS) 가 **상시 사용 중** — 항목 B 스코프 밖(client.embed 가 signal 미지원이라 provider 별 signal 추가 선행 필요). **→ 후속 task `task_07c120ce` spawn**. (commit 메시지의 "embed 미활성" 은 부정확 — embed timeout 은 활성이나 item B 가 미변경.)
- **[side_effect]** no-timeout 분기 미변경, google optional param 하위호환, embed/chatStream/listModels 미변경 — 부작용 없음 확인(CRITICAL 0, WARNING 0).

## 결론
직전 CRITICAL 해소 + 신규 테스트 WARNING 조치 완료 → 항목 B fix 검증 통과.
