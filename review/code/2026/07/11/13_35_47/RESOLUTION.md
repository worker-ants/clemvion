# RESOLUTION — 가드 실효성 완성 (review 13_35_47)

Critical 1(testing) · Warning/Info 다수. 위험도 CRITICAL(실제 CI 갭). 조치.

## 조치 항목

| # | 검출 | 내용 | 조치 |
| --- | --- | --- | --- |
| C1 | testing | 실제 `web-chat-checks.yml` `widget` job 에 typecheck 없어 GitHub PR gate 에서 위젯 타입 가드 미발화(내 test-stages 배선은 로컬 harness 만). `next build` 는 `*.test.ts` 미검(mutation 실증) | **fixed**: `widget` job 에 `Typecheck` step 추가(sibling `sdk` job 과 대칭) + "next build typecheck 동반" 부정확 주석 정정 |
| C1b | testing | `web-chat-checks.yml` paths 에 `packages/sdk/**` 있으나 `@workflow/sdk` job 없음 → SDK 타입 가드(client.spec.ts negative) 실제 CI 미발화 | **fixed**: `sdk-client`(@workflow/sdk) job 신설. test(ts-jest)가 negative 검증, build(tsc) 동반. lint 는 SDK eslint.config 부재라 생략(주석 명시) |
| maint-comment | maintainability | `as unknown as this` 트릭 설명이 커밋 메시지에만 | **fixed**: 첫 EventSource stub 에 배경 주석(4곳 대표) |
| maint-redundant | testing·maintainability | `c.items[0]!.buttons!` 앞쪽 `items[0]!` 불필요(noUncheckedIndexedAccess 없음) | **fixed**: `items[0].buttons!` 로 최소화 |
| maint-dup | maintainability | EventSource stub 4곳 손복사(기존 `installControllableSse` 팩토리 미재사용) | **deferred**: test 코드·동작 정확, 공용 헬퍼 추출은 후속(§리뷰 후속) |
| info-outer-cast | testing | `as unknown as typeof EventSource` outer cast redundant | **skipped**: 무해 + stubGlobal 인자 타입 명시성. 4곳 제거·재검증 대비 이득 낮음 |
| info-paths | maintainability | spec-link-checks.yml paths 에 pnpm-lock/workspace 누락 | **no_change_needed**: 의존 변경(pnpm-lock)은 spec 링크 부패와 무관 — sibling 과 형태는 다르나 이 가드는 소스/spec 링크만 대상이라 의도적 생략이 타당 |
| info-frontend-dup | side_effect·scope | spec-link-checks frontend/** 가 frontend-checks 와 이중 실행 | **no_change_needed**: 비용 낮음(가드 vitest 1개), frontend-checks 는 spec/ 미트리거라 spec 변경 커버 위해 유지 |

## TEST 결과

| 단계 | 결과 |
| --- | --- |
| lint | **PASS** (47s) |
| unit | **PASS** |
| build | **PASS** — channel-web-chat typecheck 포함 |
| e2e | **통과** — 252 passed |

## 보류·후속 항목

EventSource stub 공용 헬퍼 추출 → `eia-context-schema-followups.md` §리뷰 후속.
